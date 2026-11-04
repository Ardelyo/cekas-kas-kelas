"""
Persistensi 24/7 untuk Cloud Run: replikasi snapshot SQLite ke Google Cloud Storage.

Cara kerja (satu penulis, tanpa SDK, hanya stdlib):
  1. Saat boot, jika database lokal kosong/tidak ada -> unduh snapshot terakhir dari bucket.
  2. Setiap penulisan (CekasDB.on_change) menandai 'kotor'; thread latar menunggu
     `debounce` detik lalu mengunggah snapshot gzip.
  3. Unggahan memakai `ifGenerationMatch`: bila ada instance lain yang sudah menulis lebih baru,
     unggahan DITOLAK (HTTP 412) dan replikasi berhenti, jadi data baru tidak pernah tertimpa
     snapshot basi. Pasang max-instances=1 (deploy_gcp.py sudah melakukannya).
  4. `flush()` dipanggil saat shutdown agar perubahan terakhir tidak hilang.
Aktifkan dengan CEKAS_GCS_BUCKET. Aktifkan juga versioning bucket agar tiap versi bisa dipulihkan.
"""

import gzip
import json
import logging
import os
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Callable, Optional

logger = logging.getLogger("cekas.gcs")

DEFAULT_ENDPOINT = "https://storage.googleapis.com"


def get_gcp_access_token() -> Optional[str]:
    """Token dari env, Metadata Server (Cloud Run/GCE), atau ADC lokal."""
    env_token = os.getenv("CEKAS_GCS_TOKEN")
    if env_token:
        return env_token
    try:
        req = urllib.request.Request(
            "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
            headers={"Metadata-Flavor": "Google"},
        )
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return json.loads(resp.read().decode("utf-8")).get("access_token")
    except Exception:
        pass
    for path_str in (
        os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
        str(Path.home() / "AppData/Roaming/gcloud/application_default_credentials.json"),
        str(Path.home() / ".config/gcloud/application_default_credentials.json"),
    ):
        if path_str and Path(path_str).is_file():
            try:
                adc = json.loads(Path(path_str).read_text(encoding="utf-8"))
                payload = urllib.parse.urlencode({
                    "client_id": adc["client_id"], "client_secret": adc["client_secret"],
                    "refresh_token": adc["refresh_token"], "grant_type": "refresh_token",
                }).encode()
                with urllib.request.urlopen(
                    urllib.request.Request("https://oauth2.googleapis.com/token", data=payload), timeout=5
                ) as resp:
                    return json.loads(resp.read().decode()).get("access_token")
            except Exception as exc:
                logger.debug("ADC refresh gagal: %s", exc)
    return None


class GCSStore:
    def __init__(self, bucket: str, object_name: str, endpoint: Optional[str] = None,
                 token_fn: Callable[[], Optional[str]] = get_gcp_access_token, debounce: float = 2.0):
        self.bucket = bucket
        self.object_name = object_name
        self.endpoint = (endpoint or os.getenv("CEKAS_GCS_ENDPOINT") or DEFAULT_ENDPOINT).rstrip("/")
        self.token_fn = token_fn
        self.debounce = debounce
        self.generation: Optional[int] = None  # generasi objek yang terakhir kita baca/tulis
        self.status = {"enabled": True, "last_ok": None, "last_error": None, "conflict": False, "uploads": 0}
        self._db = None
        self._dirty = threading.Event()
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._upload_lock = threading.Lock()

    # ----------------------------------------------------------------- http
    def _request(self, url: str, method: str = "GET", data: Optional[bytes] = None,
                 content_type: str = "application/octet-stream"):
        token = self.token_fn()
        if not token:
            raise RuntimeError("Tidak ada kredensial GCP (metadata server/ADC).")
        headers = {"Authorization": f"Bearer {token}"}
        if data is not None:
            headers["Content-Type"] = content_type
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read()

    def _obj_url(self) -> str:
        return f"{self.endpoint}/storage/v1/b/{self.bucket}/o/{urllib.parse.quote(self.object_name, safe='')}"

    # ------------------------------------------------------------- download
    def download(self) -> Optional[bytes]:
        """Isi snapshot (sudah di-gunzip) atau None bila belum ada."""
        try:
            meta = json.loads(self._request(self._obj_url()))
            gen = int(meta["generation"])
            raw = self._request(f"{self._obj_url()}?alt=media&ifGenerationMatch={gen}")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                self.generation = 0
                return None
            raise
        self.generation = gen
        return gzip.decompress(raw)

    # --------------------------------------------------------------- upload
    def upload(self, data: bytes) -> bool:
        with self._upload_lock:
            if self.status["conflict"]:
                return False
            url = (f"{self.endpoint}/upload/storage/v1/b/{self.bucket}/o"
                   f"?uploadType=media&name={urllib.parse.quote(self.object_name, safe='')}")
            if self.generation is not None:
                url += f"&ifGenerationMatch={self.generation}"
            try:
                body = self._request(url, "POST", gzip.compress(data), "application/gzip")
                self.generation = int(json.loads(body).get("generation", self.generation or 0))
                self.status.update(last_ok=time.time(), last_error=None, uploads=self.status["uploads"] + 1)
                return True
            except urllib.error.HTTPError as e:
                if e.code == 412:
                    self.status.update(conflict=True, last_error="Konflik: ada instance lain yang menulis lebih baru.")
                    logger.critical("Replikasi dihentikan: objek di bucket lebih baru dari yang dimuat instance ini. "
                                    "Pastikan max-instances=1.")
                else:
                    self.status["last_error"] = f"HTTP {e.code}"
                    logger.error("Unggah snapshot gagal: HTTP %s", e.code)
                return False
            except Exception as exc:
                self.status["last_error"] = str(exc)
                logger.error("Unggah snapshot gagal: %s", exc)
                return False

    # --------------------------------------------------------- orchestration
    def attach(self, db) -> None:
        """Mulai mereplikasi `db` (CekasDB) di thread latar."""
        self._db = db
        db.on_change = self.notify
        self._thread = threading.Thread(target=self._loop, name="gcs-replicator", daemon=True)
        self._thread.start()
        self._dirty.set()  # unggah awal setelah boot/restore

    def notify(self) -> None:
        self._dirty.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            if not self._dirty.wait(timeout=1.0):
                continue
            time.sleep(self.debounce)       # gabungkan banyak penulisan beruntun
            self._dirty.clear()
            if not self.upload(self._db.snapshot_bytes()):
                time.sleep(5)               # backoff, lalu coba lagi
                self._dirty.set()

    def flush(self) -> bool:
        """Unggah sinkron bila masih ada perubahan (dipanggil saat shutdown)."""
        if self._db is None:
            return True
        if self._dirty.is_set() or not self.status["last_ok"]:
            self._dirty.clear()
            return self.upload(self._db.snapshot_bytes())
        return True

    def stop(self) -> None:
        self.flush()
        self._stop.set()


def restore_on_boot(db_path: str, store: GCSStore) -> str:
    """Pulihkan database dari bucket bila lokal kosong. Mengembalikan: 'local'|'restored'|'empty'|'error'."""
    local = Path(db_path)
    if local.exists():
        try:
            n = sqlite3.connect(str(local)).execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
            if n > 0:
                store.generation = None
                try:  # ambil generasi terbaru agar unggahan berikutnya sah
                    meta = json.loads(store._request(store._obj_url()))
                    store.generation = int(meta["generation"])
                except urllib.error.HTTPError as e:
                    if e.code == 404:
                        store.generation = 0
                except Exception:
                    pass
                return "local"
        except sqlite3.Error:
            pass
    try:
        data = store.download()
    except Exception as exc:
        logger.error("Restore dari bucket gagal: %s", exc)
        return "error"
    if not data:
        return "empty"

    local.parent.mkdir(parents=True, exist_ok=True)
    tmp = local.with_suffix(".restore.tmp")
    tmp.write_bytes(data)
    check = sqlite3.connect(str(tmp))
    try:
        ok = check.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    except sqlite3.DatabaseError:
        ok = False  # bukan berkas SQLite sama sekali
    finally:
        check.close()
    if not ok:
        tmp.unlink(missing_ok=True)
        logger.error("Snapshot dari bucket rusak (integrity_check gagal); restore dibatalkan.")
        return "error"
    for suffix in ("-wal", "-shm"):
        Path(str(local) + suffix).unlink(missing_ok=True)
    os.replace(tmp, local)
    logger.info("Database dipulihkan dari gs://%s/%s", store.bucket, store.object_name)
    return "restored"

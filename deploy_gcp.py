#!/usr/bin/env python3
"""
CEKAS 24/7 di Google Cloud Run (Pure Python, tanpa gcloud/SDK; hanya REST + ADC).

Yang dilakukan (idempoten, aman dijalankan ulang):
  1. Membuat bucket data (versioning AKTIF) untuk replikasi database -> data tidak hilang saat restart.
  2. Mengunggah database lokal ke bucket bila bucket masih kosong (migrasi sekali).
  3. Build image via Cloud Build, deploy ke Cloud Run dengan min=max=1 instance, CPU selalu aktif.
  4. Memberi service account izin ke bucket, mengisi PUBLIC_URL, mendaftarkan webhook Telegram bertanda-tangan.
  5. Memverifikasi /api/health (termasuk status replikasi).

Pemakaian:
  python deploy_gcp.py --dry-run     # hanya cek konfigurasi & tampilkan rencana (tidak mengubah apa pun)
  python deploy_gcp.py               # deploy sungguhan (butuh: gcloud auth application-default login)
Prasyarat .env: GCP_PROJECT_ID, TELEGRAM_BOT_TOKEN, PIN_BENDAHARA, WEB_ADMIN_PASSWORD,
                TELEGRAM_WEBHOOK_SECRET, CEKAS_SECRET_KEY
"""

import argparse
import gzip
import io
import json
import sqlite3
import sys
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from cekas_app.config import (
    GCP_PROJECT_ID, TELEGRAM_BOT_TOKEN, CLASS_ID, DEFAULT_PIN_BENDAHARA, DB_PATH,
    WEB_ADMIN_PASSWORD, WEB_ADMIN_NAME, SECRET_KEY, TELEGRAM_WEBHOOK_SECRET,
    APPROVAL_THRESHOLD, APPROVALS_NEEDED, NOMINAL_IURAN_MINGGUAN, SEMESTER_START, OLLAMA_URL,
    TEACHER_VERIFICATION, PIN_WALI,
)
from cekas_app.gcs_store import get_gcp_access_token

REGION = "us-central1"
SERVICE_NAME = "cekas"
DATA_BUCKET = f"cekas-data-{GCP_PROJECT_ID}"
DATA_OBJECT = f"cekas/{CLASS_ID}.db.gz"
SRC_BUCKET = f"run-sources-{GCP_PROJECT_ID}-{REGION}"
SRC_OBJECT = f"services/{SERVICE_NAME}/cekas-source.tar.gz"
IMAGE_URI = f"{REGION}-docker.pkg.dev/{GCP_PROJECT_ID}/cloud-run-source-deploy/{SERVICE_NAME}:latest"

REQUIRED = {
    "GCP_PROJECT_ID": GCP_PROJECT_ID, "TELEGRAM_BOT_TOKEN": TELEGRAM_BOT_TOKEN,
    "PIN_BENDAHARA": DEFAULT_PIN_BENDAHARA, "WEB_ADMIN_PASSWORD": WEB_ADMIN_PASSWORD,
    "TELEGRAM_WEBHOOK_SECRET": TELEGRAM_WEBHOOK_SECRET, "CEKAS_SECRET_KEY": SECRET_KEY,
}
if TEACHER_VERIFICATION:
    REQUIRED["PIN_WALI"] = PIN_WALI  # tanpa PIN wali, antrean verifikasi tidak bisa dibuka siapa pun


def api(url: str, token: str, method: str = "GET", data=None, content_type: str = "application/json",
        ok_codes=()):
    headers = {"Authorization": f"Bearer {token}", "x-goog-user-project": GCP_PROJECT_ID}
    if data is not None:
        headers["Content-Type"] = content_type
        if isinstance(data, (dict, list)):
            data = json.dumps(data).encode()
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        if e.code in ok_codes:
            return {"_status": e.code, "_body": body}
        raise RuntimeError(f"HTTP {e.code} {method} {url}\n{body}") from e


def ensure_bucket(token: str, name: str, versioning: bool):
    body = {"name": name, "location": REGION.upper(),
            "iamConfiguration": {"uniformBucketLevelAccess": {"enabled": True}}}
    if versioning:
        body["versioning"] = {"enabled": True}
    r = api(f"https://storage.googleapis.com/storage/v1/b?project={GCP_PROJECT_ID}", token, "POST", body, ok_codes=(409,))
    if r.get("_status") == 409 and versioning:  # sudah ada: pastikan versioning menyala
        api(f"https://storage.googleapis.com/storage/v1/b/{name}", token, "PATCH", {"versioning": {"enabled": True}})
    print(f"      ✓ bucket gs://{name} {'(sudah ada)' if r.get('_status') == 409 else '(dibuat)'}"
          f"{', versioning aktif' if versioning else ''}")


def source_tarball() -> bytes:
    buf = io.BytesIO()
    base = Path(__file__).resolve().parent

    def _f(ti):
        return None if "__pycache__" in ti.name or ti.name.endswith(".pyc") else ti

    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for item in ("Dockerfile", "requirements.txt", "run.py", "cekas_app", "cekas_core"):
            if (base / item).exists():
                tar.add(str(base / item), arcname=item, filter=_f)
    return buf.getvalue()


def local_db_snapshot():
    """Bytes database lokal bila berisi transaksi, selain itu None."""
    p = Path(DB_PATH)
    if not p.exists():
        return None
    try:
        conn = sqlite3.connect(str(p))
        if conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 0:
            return None
        return conn.serialize()
    except sqlite3.Error:
        return None


def env_vars(public_url: str = "") -> list:
    values = {
        "GCP_PROJECT_ID": GCP_PROJECT_ID, "TELEGRAM_BOT_TOKEN": TELEGRAM_BOT_TOKEN, "CLASS_ID": CLASS_ID,
        "PIN_BENDAHARA": DEFAULT_PIN_BENDAHARA, "WEB_ADMIN_PASSWORD": WEB_ADMIN_PASSWORD,
        "WEB_ADMIN_NAME": WEB_ADMIN_NAME, "CEKAS_SECRET_KEY": SECRET_KEY,
        "TELEGRAM_WEBHOOK_SECRET": TELEGRAM_WEBHOOK_SECRET, "CEKAS_DB_PATH": "/tmp/cekas.db",
        "CEKAS_GCS_BUCKET": DATA_BUCKET, "CEKAS_GCS_OBJECT": DATA_OBJECT, "PUBLIC_URL": public_url,
        "APPROVAL_THRESHOLD": str(APPROVAL_THRESHOLD), "APPROVALS_NEEDED": str(APPROVALS_NEEDED),
        "NOMINAL_IURAN_MINGGUAN": str(NOMINAL_IURAN_MINGGUAN), "SEMESTER_START": SEMESTER_START,
        "PIN_WALI": PIN_WALI, "TEACHER_VERIFICATION": "1" if TEACHER_VERIFICATION else "0",
    }
    return [{"name": k, "value": v} for k, v in values.items() if v != ""]


def service_body(public_url: str = "") -> dict:
    return {
        "ingress": "INGRESS_TRAFFIC_ALL", "invokerIamDisabled": True,
        "template": {
            # SATU instance: SQLite hanya boleh punya satu penulis. CPU selalu aktif agar replikasi latar berjalan.
            "scaling": {"minInstanceCount": 1, "maxInstanceCount": 1},
            "timeout": "60s",
            "containers": [{
                "image": IMAGE_URI, "ports": [{"name": "http1", "containerPort": 8080}],
                "resources": {"limits": {"cpu": "1000m", "memory": "512Mi"}, "cpuIdle": False, "startupCpuBoost": True},
                "env": env_vars(public_url),
            }],
        },
    }


def dry_run() -> int:
    print("=== DRY RUN (tidak ada yang diubah) ===")
    missing = [k for k, v in REQUIRED.items() if not v]
    for k, v in REQUIRED.items():
        print(f"  {'✓' if v else '✗'} {k}")
    snap = local_db_snapshot()
    print(f"\nProject      : {GCP_PROJECT_ID or '(kosong)'}   Region: {REGION}")
    print(f"Bucket data  : gs://{DATA_BUCKET}/{DATA_OBJECT}  (versioning aktif)")
    print(f"DB lokal     : {'akan dimigrasi ke bucket jika bucket kosong' if snap else 'kosong/tidak ada (mulai baru)'}")
    print(f"Cloud Run    : {SERVICE_NAME}, min=max=1 instance, CPU selalu aktif, 512Mi")
    print(f"Persetujuan  : pengeluaran >= Rp {APPROVAL_THRESHOLD:,} perlu {APPROVALS_NEEDED} suara".replace(",", "."))
    print(f"Ollama (OCR) : {'diatur' if OLLAMA_URL else 'tidak diatur (fitur foto nota nonaktif di cloud)'}")
    if missing:
        print(f"\n✗ Lengkapi dulu di .env: {', '.join(missing)}")
        return 1
    print("\n✓ Konfigurasi lengkap. Jalankan tanpa --dry-run untuk deploy.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if args.dry_run:
        return dry_run()
    if any(not v for v in REQUIRED.values()):
        return dry_run()

    print("=" * 66)
    print(f"🚀 DEPLOY CEKAS 24/7 · {GCP_PROJECT_ID} · {REGION}")
    print("=" * 66)
    token = get_gcp_access_token()
    if not token:
        print("❌ Tidak ada kredensial. Jalankan dulu: gcloud auth application-default login")
        return 1

    print("[1/6] Menyiapkan penyimpanan data persisten...")
    ensure_bucket(token, DATA_BUCKET, versioning=True)
    obj_url = f"https://storage.googleapis.com/storage/v1/b/{DATA_BUCKET}/o/{urllib.parse.quote(DATA_OBJECT, safe='')}"
    exists = api(obj_url, token, ok_codes=(404,)).get("_status") != 404
    snap = local_db_snapshot()
    if exists:
        print("      ✓ snapshot database sudah ada di bucket; DB lokal TIDAK diunggah (tidak menimpa data cloud).")
    elif snap:
        up = (f"https://storage.googleapis.com/upload/storage/v1/b/{DATA_BUCKET}/o"
              f"?uploadType=media&name={urllib.parse.quote(DATA_OBJECT, safe='')}&ifGenerationMatch=0")
        api(up, token, "POST", gzip.compress(snap), "application/gzip")
        print(f"      ✓ database lokal dimigrasi ke bucket ({len(snap) // 1024} KB).")
    else:
        print("      • bucket kosong & DB lokal kosong: kelas baru akan dibuat saat start.")

    print("[2/6] Mengunggah kode sumber...")
    ensure_bucket(token, SRC_BUCKET, versioning=False)
    tb = source_tarball()
    api(f"https://storage.googleapis.com/upload/storage/v1/b/{SRC_BUCKET}/o?uploadType=media"
        f"&name={urllib.parse.quote(SRC_OBJECT, safe='')}", token, "POST", tb, "application/gzip")
    print(f"      ✓ {len(tb) // 1024} KB")

    print("[3/6] Membangun image (Cloud Build)...")
    build = {"source": {"storageSource": {"bucket": SRC_BUCKET, "object": SRC_OBJECT}},
             "steps": [{"name": "gcr.io/cloud-builders/docker", "args": ["build", "-t", IMAGE_URI, "."]},
                       {"name": "gcr.io/cloud-builders/docker", "args": ["push", IMAGE_URI]}],
             "images": [IMAGE_URI]}
    b_url = f"https://cloudbuild.googleapis.com/v1/projects/{GCP_PROJECT_ID}/locations/{REGION}/builds"
    op = api(b_url, token, "POST", build)
    build_id = op["metadata"]["build"]["id"]
    while True:
        time.sleep(6)
        token = get_gcp_access_token()
        info = api(f"{b_url}/{build_id}", token)
        st = info.get("status")
        print(f"      • {st}")
        if st == "SUCCESS":
            break
        if st in ("FAILURE", "INTERNAL_ERROR", "TIMEOUT", "CANCELLED"):
            print(f"❌ Build gagal: {info.get('statusDetail')}\n   Log: {info.get('logUrl')}")
            return 1

    print("[4/6] Deploy ke Cloud Run...")
    svc = f"https://run.googleapis.com/v2/projects/{GCP_PROJECT_ID}/locations/{REGION}/services/{SERVICE_NAME}"
    create = f"https://run.googleapis.com/v2/projects/{GCP_PROJECT_ID}/locations/{REGION}/services?serviceId={SERVICE_NAME}"

    def deploy(public_url: str):
        body = service_body(public_url)
        if api(svc, token, ok_codes=(404,)).get("_status") == 404:
            api(create, token, "POST", body)
        else:
            api(svc, token, "PATCH", body)
        for _ in range(45):
            time.sleep(4)
            info = api(svc, get_gcp_access_token())
            state = info.get("terminalCondition", {}).get("state", "")
            print(f"      • {state} {info.get('uri') or ''}")
            if state == "CONDITION_SUCCEEDED" and info.get("uri"):
                return info
            if state == "CONDITION_FAILED":
                raise RuntimeError(f"Deploy gagal: {info.get('terminalCondition')}")
        raise RuntimeError("Timeout menunggu Cloud Run siap.")

    info = deploy("")
    uri = info["uri"]
    try:
        api(f"{svc}:setIamPolicy", token, "POST",
            {"policy": {"bindings": [{"role": "roles/run.invoker", "members": ["allUsers"]}]}})
    except Exception:
        pass

    print("[5/6] Memberi izin penyimpanan & mengisi PUBLIC_URL...")
    try:
        proj = api(f"https://cloudresourcemanager.googleapis.com/v1/projects/{GCP_PROJECT_ID}", token)
        sa = info.get("template", {}).get("serviceAccount") or f"{proj['projectNumber']}-compute@developer.gserviceaccount.com"
        pol_url = f"https://storage.googleapis.com/storage/v1/b/{DATA_BUCKET}/iam"
        pol = api(pol_url, token)
        member, role = f"serviceAccount:{sa}", "roles/storage.objectAdmin"
        bindings = pol.setdefault("bindings", [])
        b = next((x for x in bindings if x["role"] == role), None)
        if b is None:
            bindings.append({"role": role, "members": [member]})
        elif member not in b["members"]:
            b["members"].append(member)
        api(pol_url, token, "PUT", pol)
        print(f"      ✓ {sa} -> {role} pada gs://{DATA_BUCKET}")
    except Exception as exc:
        print(f"      ⚠ Gagal mengatur izin otomatis ({exc}).\n"
              f"        Beri service account Cloud Run peran Storage Object Admin pada bucket {DATA_BUCKET} secara manual.")
    deploy(uri)

    print("[6/6] Mendaftarkan webhook Telegram bertanda-tangan...")
    hook = (f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook?url={urllib.parse.quote(uri + '/api/telegram/webhook', safe='')}"
            f"&secret_token={urllib.parse.quote(TELEGRAM_WEBHOOK_SECRET, safe='')}"
            f"&allowed_updates={urllib.parse.quote(json.dumps(['message', 'callback_query']))}&drop_pending_updates=true")
    with urllib.request.urlopen(hook, timeout=20) as r:
        print(f"      ✓ {json.loads(r.read().decode()).get('description', 'ok')}")

    time.sleep(5)
    try:
        with urllib.request.urlopen(uri + "/api/health", timeout=20) as r:
            h = json.loads(r.read().decode())
        rep = h.get("replication")
        print(f"\n✓ Health: {h['status']} · webhook siap: {h['telegram_webhook_ready']} · replikasi: "
              f"{'OK' if rep and rep['ok'] else rep}")
    except Exception as exc:
        print(f"\n⚠ Health check gagal: {exc}")

    print("\n" + "=" * 66)
    print(f"🎉 SELESAI. Dashboard publik : {uri}")
    print(f"   Login Bendahara web      : {uri}/login")
    print(f"   Data tersimpan di        : gs://{DATA_BUCKET}/{DATA_OBJECT} (berversi)")
    print("   Cetak QR dari dashboard (bagian 'Bagikan') dan tempel di kelas.")
    print("=" * 66)
    return 0


if __name__ == "__main__":
    sys.exit(main())

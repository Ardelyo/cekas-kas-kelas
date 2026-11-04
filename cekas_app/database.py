"""
CEKAS Database Operations & State Management
SQLite (WAL), transaksi ACID, RBAC, idempotency, iuran mingguan, dan
ledger tamper-evident (hash chain SHA-256).

Catatan desain:
- Semua mutasi saldo lewat satu fungsi inti `_apply_tx` sehingga satu operasi
  bisnis (mis. bayar iuran) = satu transaksi SQLite yang atomik.
- Tabel `transactions` bersifat append-only; tiap baris memuat hash yang
  mengikat baris sebelumnya. `verify_ledger()` mendeteksi baris yang diubah/dihapus.
- Kolom `classes.saldo`/`alokasi` hanyalah cache; kebenaran ada di ledger.
"""

import hashlib
import hmac
import json
import logging
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any

import functools

from .config import (
    CLASS_ID,
    CLASS_NAME,
    SCHOOL_YEAR,
    DEFAULT_PIN_BENDAHARA,
    NOMINAL_IURAN_MINGGUAN,
    POCKET_CONFIG,
    APPROVAL_THRESHOLD,
    APPROVALS_NEEDED,
    TEACHER_VERIFICATION,
    PIN_WALI,
)
from .formatters import format_rupiah


def _mutating(fn):
    """Setelah operasi tulis berhasil, beri tahu pendengar (replikasi cloud)."""
    @functools.wraps(fn)
    def wrapper(self, *args, **kwargs):
        result = fn(self, *args, **kwargs)
        self._notify()
        return result
    return wrapper

logger = logging.getLogger("cekas.db")

GENESIS = "GENESIS"
PIN_MAX_FAILS = 5
PIN_LOCK_SECONDS = 15 * 60
PIN_ITERATIONS = 200_000
KNOWN_WEAK_PINS = {"192837", "123456", "000000", "111111"}


def _hash_pin(pin: str) -> str:
    salt = secrets.token_hex(8)
    dk = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), PIN_ITERATIONS)
    return f"pbkdf2${PIN_ITERATIONS}${salt}${dk.hex()}"


def _verify_pin(pin: str, stored: str) -> bool:
    stored = str(stored)
    if stored.startswith("pbkdf2$"):
        try:
            _, iters, salt, digest = stored.split("$")
            dk = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), int(iters))
            return hmac.compare_digest(dk.hex(), digest)
        except (ValueError, TypeError):
            return False
    # Format lama (plaintext) dari database versi sebelumnya
    return hmac.compare_digest(pin.encode(), stored.strip().encode())


def _utc_now_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _tx_hash(prev: str, tx_id: int, class_id: str, tx_type: str, amount: int,
             category: str, description: str, input_by: str, created_at: str,
             reverses_tx_id: Optional[int]) -> str:
    payload = "|".join(
        str(x) for x in (prev, tx_id, class_id, tx_type, amount, category,
                         description, input_by, created_at, reverses_tx_id or "")
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class CekasDB:
    def __init__(self, db_path: str = ":memory:"):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        self.on_change = None  # callable tanpa argumen; dipanggil setelah setiap penulisan
        self.require_teacher = TEACHER_VERIFICATION  # True = transaksi ditahan sampai Wali Kelas menyetujui
        self._init_schema()

    def _notify(self):
        cb = self.on_change
        if cb:
            try:
                cb()
            except Exception:  # replikasi tidak boleh menggagalkan transaksi
                logger.exception("on_change callback gagal")

    def snapshot_bytes(self) -> bytes:
        """Salinan konsisten seluruh database (untuk replikasi)."""
        with self._lock:
            return self.conn.serialize()

    # ------------------------------------------------------------------ schema
    def _init_schema(self):
        with self._lock, self.conn:
            self.conn.execute("PRAGMA journal_mode=WAL;")
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS classes (
                    id TEXT PRIMARY KEY,
                    nama TEXT NOT NULL,
                    tahun_ajaran TEXT NOT NULL,
                    saldo INTEGER DEFAULT 0,
                    alokasi TEXT NOT NULL,
                    pin_bendahara TEXT NOT NULL,
                    nominal_iuran INTEGER DEFAULT 10000,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS whitelist_students (
                    class_id TEXT NOT NULL,
                    nis TEXT NOT NULL,
                    nama_resmi TEXT NOT NULL,
                    role TEXT DEFAULT 'siswa',
                    PRIMARY KEY (class_id, nis)
                );
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS members (
                    class_id TEXT NOT NULL,
                    telegram_id INTEGER PRIMARY KEY,
                    nama TEXT NOT NULL,
                    nis TEXT,
                    role TEXT DEFAULT 'siswa',
                    username TEXT,
                    notif_enabled INTEGER DEFAULT 1,
                    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    class_id TEXT NOT NULL,
                    type TEXT NOT NULL, -- 'in', 'out', 'correction'
                    amount INTEGER NOT NULL,
                    category TEXT NOT NULL,
                    description TEXT NOT NULL,
                    input_by TEXT NOT NULL,
                    telegram_id INTEGER NOT NULL,
                    is_reversal INTEGER DEFAULT 0,
                    reverses_tx_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    prev_hash TEXT,
                    hash TEXT
                );
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS weekly_dues (
                    class_id TEXT NOT NULL,
                    nis TEXT NOT NULL,
                    week_num INTEGER NOT NULL,
                    is_paid INTEGER DEFAULT 0,
                    paid_at TIMESTAMP,
                    paid_by_tx_id INTEGER,
                    PRIMARY KEY (class_id, nis, week_num)
                );
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS processed_messages (
                    message_id TEXT PRIMARY KEY,
                    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS proposals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    class_id TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    category TEXT NOT NULL,
                    description TEXT NOT NULL,
                    proposed_by TEXT NOT NULL,
                    proposer_tg INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'open', -- open|approved|rejected|cancelled|failed
                    needed INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    decided_at TEXT,
                    tx_id INTEGER,
                    note TEXT
                );
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS proposal_votes (
                    proposal_id INTEGER NOT NULL,
                    telegram_id INTEGER NOT NULL,
                    voter_name TEXT,
                    vote TEXT NOT NULL, -- yes|no
                    voted_at TEXT NOT NULL,
                    PRIMARY KEY (proposal_id, telegram_id)
                );
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS pending_tx (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    class_id TEXT NOT NULL,
                    kind TEXT NOT NULL,            -- tx | dues | reverse
                    tx_type TEXT,                  -- in | out (untuk tx)
                    amount INTEGER NOT NULL DEFAULT 0,
                    category TEXT,
                    description TEXT NOT NULL DEFAULT '',
                    input_by TEXT NOT NULL,
                    submitter_tg INTEGER NOT NULL,
                    nis TEXT,
                    week_num INTEGER,
                    target_tx_id INTEGER,
                    status TEXT NOT NULL DEFAULT 'pending', -- pending|verified|rejected|cancelled|failed
                    created_at TEXT NOT NULL,
                    decided_at TEXT,
                    decided_by TEXT,
                    tx_id INTEGER,
                    note TEXT
                );
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS pin_attempts (
                    telegram_id INTEGER PRIMARY KEY,
                    fails INTEGER NOT NULL DEFAULT 0,
                    locked_until REAL NOT NULL DEFAULT 0
                );
            """)

            # Migrasi database lama: kolom hash chain
            cols = {r["name"] for r in self.conn.execute("PRAGMA table_info(transactions)")}
            for col in ("prev_hash", "hash"):
                if col not in cols:
                    self.conn.execute(f"ALTER TABLE transactions ADD COLUMN {col} TEXT")

            ccols = {r["name"] for r in self.conn.execute("PRAGMA table_info(classes)")}
            if "pin_wali" not in ccols:
                self.conn.execute("ALTER TABLE classes ADD COLUMN pin_wali TEXT")

            # Satu NIS hanya boleh terikat ke satu akun Telegram
            try:
                self.conn.execute(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_members_class_nis "
                    "ON members(class_id, nis) WHERE nis IS NOT NULL"
                )
            except sqlite3.IntegrityError:
                logger.warning("Ada NIS ganda di tabel members; indeks unik tidak dibuat. Rapikan data lalu restart.")

    # --------------------------------------------------------------- idempotency
    def check_and_mark_message(self, message_id: str) -> bool:
        """Idempotency guard atomik: True jika pesan baru, False jika sudah diproses."""
        if not message_id:
            return True
        with self._lock, self.conn:
            cur = self.conn.execute(
                "INSERT OR IGNORE INTO processed_messages (message_id) VALUES (?)",
                (str(message_id),),
            )
            is_new = cur.rowcount == 1
            self.conn.execute(
                "DELETE FROM processed_messages WHERE processed_at < datetime('now', '-7 days')"
            )
        return is_new

    # --------------------------------------------------------------------- class
    def get_or_create_class(self, class_id: str = CLASS_ID, nama: str = CLASS_NAME) -> Dict[str, Any]:
        with self._lock:
            row = self.conn.execute("SELECT * FROM classes WHERE id = ?", (class_id,)).fetchone()
            initial_pin = None
            if not row:
                initial_pin = DEFAULT_PIN_BENDAHARA or "".join(secrets.choice("0123456789") for _ in range(6))
                initial_alokasi = json.dumps({k: 0 for k in POCKET_CONFIG.keys()})
                with self.conn:
                    self.conn.execute(
                        """INSERT INTO classes (id, nama, tahun_ajaran, saldo, alokasi, pin_bendahara, nominal_iuran)
                           VALUES (?, ?, ?, 0, ?, ?, ?)""",
                        (class_id, nama, SCHOOL_YEAR, initial_alokasi, _hash_pin(initial_pin), NOMINAL_IURAN_MINGGUAN),
                    )
                row = self.conn.execute("SELECT * FROM classes WHERE id = ?", (class_id,)).fetchone()
                if not DEFAULT_PIN_BENDAHARA:
                    logger.warning("PIN Bendahara acak dibuat untuk kelas %s: %s (catat, tidak akan ditampilkan lagi)",
                                   class_id, initial_pin)
            elif not str(row["pin_bendahara"]).startswith("pbkdf2$"):
                # Migrasi PIN plaintext lama -> hash
                legacy = str(row["pin_bendahara"]).strip()
                if legacy in KNOWN_WEAK_PINS:
                    logger.warning("PIN Bendahara kelas %s masih PIN lemah/bawaan. Segera ganti (set_pin).", class_id)
                with self.conn:
                    self.conn.execute("UPDATE classes SET pin_bendahara = ? WHERE id = ?", (_hash_pin(legacy), class_id))
                row = self.conn.execute("SELECT * FROM classes WHERE id = ?", (class_id,)).fetchone()

            if PIN_WALI and not row["pin_wali"]:
                with self.conn:
                    self.conn.execute("UPDATE classes SET pin_wali = ? WHERE id = ?", (_hash_pin(PIN_WALI), class_id))
                row = self.conn.execute("SELECT * FROM classes WHERE id = ?", (class_id,)).fetchone()

            data = dict(row)
            data["alokasi"] = json.loads(data["alokasi"])
            if initial_pin:
                data["initial_pin"] = initial_pin  # hanya ada saat kelas baru dibuat
            return data

    # Alias for compatibility with cekas_core tests
    init_class = get_or_create_class

    @_mutating
    def set_pin(self, class_id: str, new_pin: str):
        new_pin = new_pin.strip()
        if len(new_pin) < 6:
            raise ValueError("PIN minimal 6 karakter.")
        self.get_or_create_class(class_id)
        with self._lock, self.conn:
            self.conn.execute("UPDATE classes SET pin_bendahara = ? WHERE id = ?", (_hash_pin(new_pin), class_id))

    # ---------------------------------------------------------------- whitelist
    @_mutating
    def set_wali_pin(self, class_id: str, new_pin: str):
        new_pin = new_pin.strip()
        if len(new_pin) < 6:
            raise ValueError("PIN Wali Kelas minimal 6 karakter.")
        self.get_or_create_class(class_id)
        with self._lock, self.conn:
            self.conn.execute("UPDATE classes SET pin_wali = ? WHERE id = ?", (_hash_pin(new_pin), class_id))

    def seed_whitelist(self, class_id: str, students: List[Dict[str, str]], replace: bool = True):
        verb = "INSERT OR REPLACE" if replace else "INSERT OR IGNORE"
        with self._lock, self.conn:
            for s in students:
                self.conn.execute(
                    f"""{verb} INTO whitelist_students (class_id, nis, nama_resmi, role)
                        VALUES (?, ?, ?, ?)""",
                    (class_id, s["nis"], s["nama_resmi"], s.get("role", "siswa")),
                )

    def seed_initial_students(self, class_id: str = CLASS_ID):
        """Seed roster contoh XI-F2. Tidak menimpa data yang sudah ada."""
        students = [
            {"nis": "23241001", "nama_resmi": "Ardellio Satria Anindito", "role": "siswa"},
            {"nis": "23241015", "nama_resmi": "Tarina", "role": "bendahara"},
            {"nis": "23241020", "nama_resmi": "Nabila", "role": "siswa"},
            {"nis": "23241025", "nama_resmi": "Cinta", "role": "siswa"},
            {"nis": "23241002", "nama_resmi": "Ahmad Fauzi", "role": "siswa"},
            {"nis": "23241003", "nama_resmi": "Alisha Zahra", "role": "siswa"},
            {"nis": "23241004", "nama_resmi": "Arya Pratama", "role": "siswa"},
            {"nis": "23241005", "nama_resmi": "Budi Santoso", "role": "siswa"},
            {"nis": "23241006", "nama_resmi": "Cantika Putri", "role": "siswa"},
            {"nis": "23241007", "nama_resmi": "Dimas Anggara", "role": "siswa"},
            {"nis": "23241008", "nama_resmi": "Dwi Cahyo", "role": "siswa"},
            {"nis": "23241009", "nama_resmi": "Elvira Rosa", "role": "siswa"},
            {"nis": "23241010", "nama_resmi": "Farhan Makarim", "role": "siswa"},
            {"nis": "23241011", "nama_resmi": "Gita Gutawa", "role": "siswa"},
            {"nis": "23241012", "nama_resmi": "Hafiz Suhendra", "role": "siswa"},
            {"nis": "23241013", "nama_resmi": "Indah Permata", "role": "siswa"},
            {"nis": "23241014", "nama_resmi": "Jovan Andreas", "role": "siswa"},
            {"nis": "23241016", "nama_resmi": "Karisma Ayu", "role": "siswa"},
            {"nis": "23241017", "nama_resmi": "Luthfi Hakim", "role": "siswa"},
            {"nis": "23241018", "nama_resmi": "Maulana Malik", "role": "siswa"},
            {"nis": "23241019", "nama_resmi": "Nadya Shafa", "role": "siswa"},
            {"nis": "23241021", "nama_resmi": "Oki Setiawan", "role": "siswa"},
            {"nis": "23241022", "nama_resmi": "Putri Maharani", "role": "siswa"},
            {"nis": "23241023", "nama_resmi": "Rafi Akbar", "role": "siswa"},
            {"nis": "23241024", "nama_resmi": "Rian Hidayat", "role": "siswa"},
            {"nis": "23241026", "nama_resmi": "Satria Wicaksana", "role": "siswa"},
            {"nis": "23241027", "nama_resmi": "Tiara Andini", "role": "siswa"},
            {"nis": "23241028", "nama_resmi": "Umar Faruq", "role": "siswa"},
            {"nis": "23241029", "nama_resmi": "Vina Panduwinata", "role": "siswa"},
            {"nis": "23241030", "nama_resmi": "Wahyu Wibowo", "role": "siswa"},
            {"nis": "23241031", "nama_resmi": "Xavier Zidane", "role": "siswa"},
            {"nis": "23241032", "nama_resmi": "Yoga Pratama", "role": "siswa"},
            {"nis": "23241033", "nama_resmi": "Zahra Aulia", "role": "siswa"},
            {"nis": "23241034", "nama_resmi": "Wali Kelas XI-F2", "role": "wali_kelas"},
        ]
        self.seed_whitelist(class_id, students, replace=False)

    def get_whitelist_student(self, class_id: str, nis: str) -> Optional[Dict[str, Any]]:
        row = self.conn.execute(
            "SELECT * FROM whitelist_students WHERE class_id = ? AND nis = ?",
            (class_id, nis.strip()),
        ).fetchone()
        return dict(row) if row else None

    def get_all_whitelist_students(self, class_id: str = CLASS_ID) -> List[Dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM whitelist_students WHERE class_id = ? ORDER BY nis ASC", (class_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    # ------------------------------------------------------------------ members
    @_mutating
    def register_member(
        self, class_id: str, telegram_id: int, nis: str, username: str = ""
    ) -> Dict[str, Any]:
        """Daftarkan akun Telegram ke sebuah NIS.

        - Peran selalu 'siswa'. Hak Bendahara HANYA lewat PIN (`claim_bendahara`),
          bukan lewat NIS yang mudah ditebak.
        - Satu NIS hanya bisa terikat ke satu akun; pelepasan lewat `release_nis`.
        """
        nis = nis.strip()
        wl = self.get_whitelist_student(class_id, nis)
        if not wl:
            return {"success": False, "error": f"NIS {nis} tidak terdaftar di whitelist resmi kelas {class_id}."}

        with self._lock, self.conn:
            owner = self.conn.execute(
                "SELECT telegram_id FROM members WHERE class_id = ? AND nis = ?", (class_id, nis)
            ).fetchone()
            if owner and owner["telegram_id"] != telegram_id:
                return {
                    "success": False,
                    "error": f"NIS {nis} sudah terikat ke akun Telegram lain. "
                             f"Jika ini NIS Anda, minta Bendahara melepasnya dengan /lepas {nis}.",
                }
            existing = self.conn.execute(
                "SELECT role, notif_enabled FROM members WHERE telegram_id = ?", (telegram_id,)
            ).fetchone()
            role = existing["role"] if existing and existing["role"] in ("bendahara", "wali_kelas") else "siswa"
            notif = existing["notif_enabled"] if existing else 1
            self.conn.execute(
                """INSERT OR REPLACE INTO members (class_id, telegram_id, nama, nis, role, username, notif_enabled)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (class_id, telegram_id, wl["nama_resmi"], nis, role, username, notif),
            )

        return {"success": True, "nama": wl["nama_resmi"], "role": role, "nis": nis}

    @_mutating
    def release_nis(self, class_id: str, nis: str) -> bool:
        """Lepas ikatan NIS dari akun Telegram (oleh Bendahara)."""
        with self._lock, self.conn:
            cur = self.conn.execute(
                "DELETE FROM members WHERE class_id = ? AND nis = ? AND role NOT IN ('bendahara', 'wali_kelas')",
                (class_id, nis.strip()),
            )
            return cur.rowcount > 0

    def get_member(self, telegram_id: int) -> Optional[Dict[str, Any]]:
        row = self.conn.execute("SELECT * FROM members WHERE telegram_id = ?", (telegram_id,)).fetchone()
        return dict(row) if row else None

    def is_bendahara(self, telegram_id: int) -> bool:
        member = self.get_member(telegram_id)
        return bool(member and member.get("role") == "bendahara")

    def is_wali(self, telegram_id: int) -> bool:
        member = self.get_member(telegram_id)
        return bool(member and member.get("role") == "wali_kelas")

    def get_wali_ids(self, class_id: str = CLASS_ID) -> List[int]:
        rows = self.conn.execute(
            "SELECT telegram_id FROM members WHERE class_id = ? AND role = 'wali_kelas'", (class_id,)).fetchall()
        return [r["telegram_id"] for r in rows]

    @_mutating
    def claim_bendahara(self, class_id: str, telegram_id: int, pin: str, display_name: str = "",
                        now: Optional[float] = None) -> Dict[str, Any]:
        return self._claim_role("bendahara", "pin_bendahara", "Bendahara", class_id, telegram_id, pin, display_name, now)

    @_mutating
    def claim_wali(self, class_id: str, telegram_id: int, pin: str, display_name: str = "",
                   now: Optional[float] = None) -> Dict[str, Any]:
        return self._claim_role("wali_kelas", "pin_wali", "Wali Kelas", class_id, telegram_id, pin, display_name, now)

    def _claim_role(self, role: str, pin_key: str, label: str, class_id: str, telegram_id: int, pin: str,
                    display_name: str = "", now: Optional[float] = None) -> Dict[str, Any]:
        now = time.time() if now is None else now
        with self._lock:
            att = self.conn.execute(
                "SELECT fails, locked_until FROM pin_attempts WHERE telegram_id = ?", (telegram_id,)
            ).fetchone()
            if att and att["locked_until"] > now:
                mins = int((att["locked_until"] - now) // 60) + 1
                return {"success": False, "error": f"Terlalu banyak percobaan. Coba lagi dalam {mins} menit."}

            cls = self.get_or_create_class(class_id)
            if not cls.get(pin_key):
                return {"success": False, "error": f"PIN {label} belum diatur. Minta admin menjalankan set-{'wali-' if role == 'wali_kelas' else ''}pin."}
            if not _verify_pin(pin.strip(), cls[pin_key]):
                fails = (att["fails"] if att else 0) + 1
                locked_until = now + PIN_LOCK_SECONDS if fails >= PIN_MAX_FAILS else 0
                with self.conn:
                    self.conn.execute(
                        "INSERT OR REPLACE INTO pin_attempts (telegram_id, fails, locked_until) VALUES (?, ?, ?)",
                        (telegram_id, 0 if locked_until else fails, locked_until),
                    )
                if locked_until:
                    return {"success": False, "error": "PIN salah. Akses dikunci 15 menit."}
                return {"success": False, "error": f"PIN {label} tidak valid! (sisa percobaan: {PIN_MAX_FAILS - fails})"}

            with self.conn:
                self.conn.execute("DELETE FROM pin_attempts WHERE telegram_id = ?", (telegram_id,))
                member = self.conn.execute("SELECT * FROM members WHERE telegram_id = ?", (telegram_id,)).fetchone()
                if member:
                    self.conn.execute("UPDATE members SET role = ? WHERE telegram_id = ?", (role, telegram_id))
                    nama = member["nama"]
                else:
                    nama = display_name.strip() or f"{label} {telegram_id}"
                    self.conn.execute(
                        """INSERT INTO members (class_id, telegram_id, nama, role, notif_enabled)
                           VALUES (?, ?, ?, ?, 1)""",
                        (class_id, telegram_id, nama, role),
                    )
            return {"success": True, "nama": nama}

    @_mutating
    def toggle_notif(self, telegram_id: int, state: Optional[bool] = None) -> Optional[bool]:
        with self._lock, self.conn:
            row = self.conn.execute(
                "SELECT notif_enabled FROM members WHERE telegram_id = ?", (telegram_id,)
            ).fetchone()
            if not row:
                return None
            current = bool(row["notif_enabled"])
            new_val = (not current) if state is None else state
            self.conn.execute(
                "UPDATE members SET notif_enabled = ? WHERE telegram_id = ?",
                (1 if new_val else 0, telegram_id),
            )
            return new_val

    def get_notif_recipients(self, class_id: str = CLASS_ID, exclude_id: Optional[int] = None) -> List[int]:
        rows = self.conn.execute(
            "SELECT telegram_id FROM members WHERE class_id = ? AND notif_enabled = 1", (class_id,)
        ).fetchall()
        ids = [r["telegram_id"] for r in rows]
        if exclude_id is not None:
            ids = [i for i in ids if i != exclude_id]
        return ids

    # -------------------------------------------------------------- transactions
    def _insert_tx_row(self, cur, class_id: str, tx_type: str, amount: int, category: str,
                       description: str, input_by: str, telegram_id: int,
                       reverses_tx_id: Optional[int] = None) -> int:
        """Sisipkan satu baris ledger + hash chain. Harus dipanggil di dalam transaksi aktif."""
        created_at = _utc_now_str()
        prev = cur.execute(
            "SELECT hash FROM transactions WHERE class_id = ? AND hash IS NOT NULL ORDER BY id DESC LIMIT 1",
            (class_id,),
        ).fetchone()
        prev_hash = prev["hash"] if prev else GENESIS
        cur.execute(
            """INSERT INTO transactions
               (class_id, type, amount, category, description, input_by, telegram_id,
                is_reversal, reverses_tx_id, created_at, prev_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (class_id, tx_type, amount, category, description, input_by, telegram_id,
             1 if tx_type == "correction" else 0, reverses_tx_id, created_at, prev_hash),
        )
        tx_id = cur.lastrowid
        h = _tx_hash(prev_hash, tx_id, class_id, tx_type, amount, category, description,
                     input_by, created_at, reverses_tx_id)
        cur.execute("UPDATE transactions SET hash = ? WHERE id = ?", (h, tx_id))
        return tx_id

    def _load_balances(self, cur, class_id: str):
        row = cur.execute("SELECT saldo, alokasi FROM classes WHERE id = ?", (class_id,)).fetchone()
        if not row:
            raise ValueError(f"Kelas {class_id} belum dibuat.")
        return row["saldo"], json.loads(row["alokasi"])

    def _store_balances(self, cur, class_id: str, saldo: int, alokasi: Dict[str, int]):
        cur.execute(
            "UPDATE classes SET saldo = ?, alokasi = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (saldo, json.dumps(alokasi), class_id),
        )

    def _apply_tx(self, cur, class_id, tx_type, amount, category, description, input_by,
                  telegram_id, allow_overdraft=False) -> Dict[str, Any]:
        """Inti pencatatan. Tidak melakukan commit; pemanggil membuka `with self.conn`."""
        if not isinstance(amount, int) or amount <= 0:
            raise ValueError("Nominal transaksi harus bilangan bulat lebih dari 0!")
        if tx_type not in ("in", "out"):
            raise ValueError(f"Tipe transaksi '{tx_type}' tidak valid.")
        description = (description or "").strip()[:200] or ("Pemasukan kas" if tx_type == "in" else "Pengeluaran kas")
        cat = category if category in POCKET_CONFIG else "operasional"

        saldo, alokasi = self._load_balances(cur, class_id)
        if tx_type == "in":
            saldo += amount
            alokasi[cat] = alokasi.get(cat, 0) + amount
        else:
            available = alokasi.get(cat, 0)
            if amount > available and not allow_overdraft:
                raise ValueError(
                    f"Saldo pos {POCKET_CONFIG[cat]['label']} tidak cukup "
                    f"(tersedia {format_rupiah(available)}, diminta {format_rupiah(amount)})."
                )
            saldo -= amount
            alokasi[cat] = available - amount

        tx_id = self._insert_tx_row(cur, class_id, tx_type, amount, cat, description, input_by, telegram_id)
        self._store_balances(cur, class_id, saldo, alokasi)
        return {
            "tx_id": tx_id,
            "type": tx_type,
            "amount": amount,
            "category": cat,
            "description": description,
            "input_by": input_by,
            "saldo_total": saldo,
            "saldo_pocket": alokasi[cat],
            "alokasi": alokasi,
        }

    @_mutating
    def record_transaction(
        self,
        class_id: str,
        tx_type: str,
        amount: int,
        category: str,
        description: str,
        input_by: str,
        telegram_id: int,
        allow_overdraft: bool = False,
    ) -> Dict[str, Any]:
        with self._lock:
            self.get_or_create_class(class_id)
            with self.conn:
                return self._apply_tx(self.conn.cursor(), class_id, tx_type, amount, category,
                                      description, input_by, telegram_id, allow_overdraft)

    @_mutating
    def reverse_transaction(
        self, class_id: str, tx_id: int, reason: str, reversed_by: str, telegram_id: int
    ) -> Dict[str, Any]:
        with self._lock, self.conn:
            return self._reverse_core(self.conn.cursor(), class_id, tx_id, reason, reversed_by, telegram_id)

    def _reverse_core(self, cur, class_id: str, tx_id: int, reason: str, reversed_by: str,
                      telegram_id: int, suffix: str = "") -> Dict[str, Any]:
        orig_tx = cur.execute(
            "SELECT * FROM transactions WHERE id = ? AND class_id = ?", (tx_id, class_id)
        ).fetchone()
        if not orig_tx:
            raise ValueError(f"Transaksi ID #{tx_id} tidak ditemukan.")
        if orig_tx["is_reversal"] or orig_tx["type"] == "correction":
            raise ValueError(f"Transaksi ID #{tx_id} sudah pernah dibatalkan / dikoreksi.")

        saldo, alokasi = self._load_balances(cur, class_id)
        cat = orig_tx["category"]
        orig_amount = orig_tx["amount"]
        if orig_tx["type"] == "in":
            saldo -= orig_amount
            alokasi[cat] = alokasi.get(cat, 0) - orig_amount
        else:
            saldo += orig_amount
            alokasi[cat] = alokasi.get(cat, 0) + orig_amount

        reason = (reason or "").strip()[:130] or "Koreksi oleh Bendahara"
        correction_id = self._insert_tx_row(
            cur, class_id, "correction", orig_amount, cat, f"KOREKSI #{tx_id}: {reason}{suffix}",
            reversed_by, telegram_id, reverses_tx_id=tx_id,
        )
        cur.execute("UPDATE transactions SET is_reversal = 1 WHERE id = ?", (tx_id,))
        # Jika transaksi ini adalah pembayaran iuran, status lunas ikut dibatalkan
        cur.execute(
            """UPDATE weekly_dues SET is_paid = 0, paid_at = NULL, paid_by_tx_id = NULL
               WHERE class_id = ? AND paid_by_tx_id = ?""",
            (class_id, tx_id),
        )
        self._store_balances(cur, class_id, saldo, alokasi)
        return {
            "correction_id": correction_id,
            "reversed_tx_id": tx_id,
            "orig_type": orig_tx["type"],
            "orig_description": orig_tx["description"],
            "amount": orig_amount,
            "category": cat,
            "saldo_total": saldo,
            "saldo_pocket": alokasi[cat],
            "alokasi": alokasi,
        }

    # -------------------------------------------------------------------- dues
    def _validate_dues(self, class_id: str, nis: str, week_num: int):
        nis = nis.strip()
        wl = self.get_whitelist_student(class_id, nis)
        if not wl:
            raise ValueError(f"NIS {nis} tidak ditemukan di daftar siswa kelas {class_id}.")
        if wl["role"] == "wali_kelas":
            raise ValueError("Wali kelas tidak dikenai iuran.")
        if not isinstance(week_num, int) or week_num < 1 or week_num > 52:
            raise ValueError("Nomor minggu harus antara 1 sampai 52.")
        return nis, wl

    def _dues_core(self, cur, class_id: str, nis: str, week_num: int, recorded_by: str, telegram_id: int,
                   wl: Dict[str, Any], nominal: int, auto_tx: bool = True, suffix: str = "") -> Dict[str, Any]:
        """Catat uang + tandai lunas. Tanpa commit; pemanggil membuka transaksi."""
        existing = cur.execute(
            "SELECT is_paid FROM weekly_dues WHERE class_id = ? AND nis = ? AND week_num = ?",
            (class_id, nis, week_num),
        ).fetchone()
        if existing and existing["is_paid"]:
            raise ValueError(f"Siswa {wl['nama_resmi']} (NIS {nis}) sudah tercatat LUNAS untuk Minggu ke-{week_num}.")
        tx_id = None
        saldo_total = self._load_balances(cur, class_id)[0]
        if auto_tx:
            res = self._apply_tx(
                cur, class_id, "in", nominal, "operasional",
                f"Iuran kas minggu ke-{week_num} ({wl['nama_resmi']}){suffix}", recorded_by, telegram_id,
            )
            tx_id, saldo_total = res["tx_id"], res["saldo_total"]
        cur.execute(
            """INSERT OR REPLACE INTO weekly_dues (class_id, nis, week_num, is_paid, paid_at, paid_by_tx_id)
               VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, ?)""",
            (class_id, nis, week_num, tx_id),
        )
        return {"nis": nis, "nama": wl["nama_resmi"], "week_num": week_num, "nominal": nominal,
                "tx_id": tx_id, "saldo_total": saldo_total}

    @_mutating
    def mark_dues_paid(
        self,
        class_id: str,
        nis: str,
        week_num: int,
        recorded_by: str,
        telegram_id: int,
        auto_tx: bool = True,
    ) -> Dict[str, Any]:
        """Langsung mencatat iuran (tanpa antrean guru). Aplikasi memakai `submit_dues`."""
        nis, wl = self._validate_dues(class_id, nis, week_num)
        with self._lock:
            nominal = self.get_or_create_class(class_id)["nominal_iuran"]
            with self.conn:  # satu transaksi atomik: catat uang + tandai lunas
                return self._dues_core(self.conn.cursor(), class_id, nis, week_num, recorded_by,
                                       telegram_id, wl, nominal, auto_tx)

    # ------------------------------------------------------ verifikasi Wali Kelas
    def _insert_pending(self, cur, class_id: str, kind: str, *, tx_type=None, amount: int = 0, category=None,
                        description: str = "", input_by: str, submitter_tg: int, nis=None, week_num=None,
                        target_tx_id=None) -> int:
        cur.execute(
            """INSERT INTO pending_tx (class_id, kind, tx_type, amount, category, description, input_by,
                                       submitter_tg, nis, week_num, target_tx_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (class_id, kind, tx_type, amount, category, description, input_by, submitter_tg, nis, week_num,
             target_tx_id, _utc_now_str()),
        )
        return cur.lastrowid

    def _pocket_available(self, cur, class_id: str, cat: str) -> int:
        """Saldo pos dikurangi pengeluaran yang sedang menunggu guru (agar tidak dijanjikan dua kali)."""
        _, alokasi = self._load_balances(cur, class_id)
        held = cur.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM pending_tx WHERE class_id = ? AND kind = 'tx' "
            "AND tx_type = 'out' AND status = 'pending' AND category = ?", (class_id, cat)).fetchone()[0]
        return alokasi.get(cat, 0) - held

    @_mutating
    def submit_transaction(self, class_id: str, tx_type: str, amount: int, category: str, description: str,
                           input_by: str, telegram_id: int) -> Dict[str, Any]:
        """Pintu pencatatan aplikasi. Dengan verifikasi guru aktif: dititipkan, saldo BELUM berubah."""
        if not self.require_teacher:
            res = self.record_transaction(class_id, tx_type, amount, category, description, input_by, telegram_id)
            res["pending"] = False
            return res
        if not isinstance(amount, int) or amount <= 0:
            raise ValueError("Nominal transaksi harus bilangan bulat lebih dari 0!")
        if tx_type not in ("in", "out"):
            raise ValueError(f"Tipe transaksi '{tx_type}' tidak valid.")
        cat = category if category in POCKET_CONFIG else "operasional"
        desc = (description or "").strip()[:170] or ("Pemasukan kas" if tx_type == "in" else "Pengeluaran kas")
        self.get_or_create_class(class_id)
        with self._lock, self.conn:
            cur = self.conn.cursor()
            if tx_type == "out":
                avail = self._pocket_available(cur, class_id, cat)
                if amount > avail:
                    raise ValueError(
                        f"Saldo pos {POCKET_CONFIG[cat]['label']} tidak cukup "
                        f"(tersedia {format_rupiah(avail)} setelah pengajuan lain, diminta {format_rupiah(amount)}).")
            pid = self._insert_pending(cur, class_id, "tx", tx_type=tx_type, amount=amount, category=cat,
                                       description=desc, input_by=input_by, submitter_tg=telegram_id)
        return {"pending": True, "pending_id": pid, "type": tx_type, "amount": amount, "category": cat,
                "description": desc, "input_by": input_by}

    @_mutating
    def submit_dues(self, class_id: str, nis: str, week_num: int, recorded_by: str, telegram_id: int) -> Dict[str, Any]:
        if not self.require_teacher:
            res = self.mark_dues_paid(class_id, nis, week_num, recorded_by, telegram_id)
            res["pending"] = False
            return res
        nis, wl = self._validate_dues(class_id, nis, week_num)
        nominal = self.get_or_create_class(class_id)["nominal_iuran"]
        with self._lock, self.conn:
            cur = self.conn.cursor()
            paid = cur.execute("SELECT is_paid FROM weekly_dues WHERE class_id=? AND nis=? AND week_num=?",
                               (class_id, nis, week_num)).fetchone()
            if paid and paid["is_paid"]:
                raise ValueError(f"{wl['nama_resmi']} sudah LUNAS untuk minggu ke-{week_num}.")
            if cur.execute("SELECT 1 FROM pending_tx WHERE class_id=? AND kind='dues' AND nis=? AND week_num=? "
                           "AND status='pending'", (class_id, nis, week_num)).fetchone():
                raise ValueError(f"Iuran {wl['nama_resmi']} minggu ke-{week_num} sudah diajukan, tinggal menunggu guru.")
            pid = self._insert_pending(cur, class_id, "dues", amount=nominal, category="operasional",
                                       description=f"Iuran minggu ke-{week_num} ({wl['nama_resmi']})",
                                       input_by=recorded_by, submitter_tg=telegram_id, nis=nis, week_num=week_num)
        return {"pending": True, "pending_id": pid, "nis": nis, "nama": wl["nama_resmi"], "week_num": week_num,
                "nominal": nominal}

    @_mutating
    def submit_reverse(self, class_id: str, tx_id: int, reason: str, reversed_by: str, telegram_id: int) -> Dict[str, Any]:
        if not self.require_teacher:
            res = self.reverse_transaction(class_id, tx_id, reason, reversed_by, telegram_id)
            res["pending"] = False
            return res
        with self._lock, self.conn:
            cur = self.conn.cursor()
            orig = cur.execute("SELECT * FROM transactions WHERE id=? AND class_id=?", (tx_id, class_id)).fetchone()
            if not orig:
                raise ValueError(f"Transaksi ID #{tx_id} tidak ditemukan.")
            if orig["is_reversal"] or orig["type"] == "correction":
                raise ValueError(f"Transaksi ID #{tx_id} sudah pernah dibatalkan / dikoreksi.")
            if cur.execute("SELECT 1 FROM pending_tx WHERE class_id=? AND kind='reverse' AND target_tx_id=? "
                           "AND status='pending'", (class_id, tx_id)).fetchone():
                raise ValueError(f"Koreksi untuk #{tx_id} sudah diajukan, tinggal menunggu guru.")
            pid = self._insert_pending(cur, class_id, "reverse", amount=orig["amount"], category=orig["category"],
                                       description=(reason or "").strip()[:130] or "Koreksi oleh Bendahara",
                                       input_by=reversed_by, submitter_tg=telegram_id, target_tx_id=tx_id)
        return {"pending": True, "pending_id": pid, "tx_id": tx_id, "amount": orig["amount"],
                "orig_description": orig["description"]}

    def get_pending(self, pid: int) -> Optional[Dict[str, Any]]:
        row = self.conn.execute("SELECT * FROM pending_tx WHERE id = ?", (pid,)).fetchone()
        return dict(row) if row else None

    def list_pending(self, class_id: str = CLASS_ID, status: Optional[str] = "pending", kind: Optional[str] = None,
                     limit: int = 200) -> List[Dict[str, Any]]:
        q, args = "SELECT * FROM pending_tx WHERE class_id = ?", [class_id]
        if status:
            q += " AND status = ?"; args.append(status)
        if kind:
            q += " AND kind = ?"; args.append(kind)
        q += " ORDER BY id ASC LIMIT ?"; args.append(limit)
        return [dict(r) for r in self.conn.execute(q, args).fetchall()]

    def pending_dues_nis(self, class_id: str, week_num: int) -> set:
        return {r["nis"] for r in self.conn.execute(
            "SELECT nis FROM pending_tx WHERE class_id=? AND kind='dues' AND week_num=? AND status='pending'",
            (class_id, week_num))}

    def _require_wali(self, telegram_id: int):
        if not self.is_wali(telegram_id):
            raise ValueError("Hanya Wali Kelas yang dapat memverifikasi. Aktifkan dengan /klaimwali <PIN>.")

    @_mutating
    def verify_pending(self, pid: int, wali_tg: int, wali_name: str) -> Dict[str, Any]:
        """Wali Kelas menyetujui: barulah transaksi masuk ledger (nama guru tercatat di keterangan & hash)."""
        self._require_wali(wali_tg)
        suffix = f" ✓ {wali_name}"
        with self._lock, self.conn:
            cur = self.conn.cursor()
            p = cur.execute("SELECT * FROM pending_tx WHERE id = ?", (pid,)).fetchone()
            if not p:
                raise ValueError(f"Pengajuan #{pid} tidak ditemukan.")
            if p["status"] != "pending":
                raise ValueError(f"Pengajuan #{pid} sudah diproses ({p['status']}).")
            res, note, status, tx_id = None, None, "verified", None
            try:
                if p["kind"] == "tx":
                    res = self._apply_tx(cur, p["class_id"], p["tx_type"], p["amount"], p["category"],
                                         p["description"][:200 - len(suffix)] + suffix, p["input_by"], p["submitter_tg"])
                    tx_id = res["tx_id"]
                elif p["kind"] == "dues":
                    wl = self.get_whitelist_student(p["class_id"], p["nis"])
                    res = self._dues_core(cur, p["class_id"], p["nis"], p["week_num"], p["input_by"],
                                          p["submitter_tg"], wl, p["amount"], suffix=suffix)
                    tx_id = res["tx_id"]
                else:  # reverse
                    res = self._reverse_core(cur, p["class_id"], p["target_tx_id"], p["description"], p["input_by"],
                                             p["submitter_tg"], suffix=suffix)
                    tx_id = res["correction_id"]
            except ValueError as err:  # kondisi berubah sejak diajukan (saldo habis, sudah lunas, dll.)
                res, status, note = None, "failed", str(err)
            cur.execute("UPDATE pending_tx SET status=?, decided_at=?, decided_by=?, tx_id=?, note=? WHERE id=?",
                        (status, _utc_now_str(), wali_name, tx_id, note, pid))
        return {"status": status, "note": note, "pending": self.get_pending(pid), "result": res}

    @_mutating
    def reject_pending(self, pid: int, wali_tg: int, wali_name: str, note: str = "") -> Dict[str, Any]:
        self._require_wali(wali_tg)
        with self._lock, self.conn:
            p = self.conn.execute("SELECT status FROM pending_tx WHERE id = ?", (pid,)).fetchone()
            if not p:
                raise ValueError(f"Pengajuan #{pid} tidak ditemukan.")
            if p["status"] != "pending":
                raise ValueError(f"Pengajuan #{pid} sudah diproses ({p['status']}).")
            self.conn.execute("UPDATE pending_tx SET status='rejected', decided_at=?, decided_by=?, note=? WHERE id=?",
                              (_utc_now_str(), wali_name, (note or "").strip()[:150] or None, pid))
        return self.get_pending(pid)

    @_mutating
    def cancel_pending(self, pid: int, telegram_id: int, as_admin: bool = False) -> Dict[str, Any]:
        with self._lock, self.conn:
            p = self.conn.execute("SELECT * FROM pending_tx WHERE id = ?", (pid,)).fetchone()
            if not p:
                raise ValueError(f"Pengajuan #{pid} tidak ditemukan.")
            if p["status"] != "pending":
                raise ValueError(f"Pengajuan #{pid} sudah diproses ({p['status']}).")
            if not as_admin and telegram_id != p["submitter_tg"] and not self.is_bendahara(telegram_id):
                raise ValueError("Hanya pengaju atau Bendahara yang dapat membatalkan pengajuan.")
            self.conn.execute("UPDATE pending_tx SET status='cancelled', decided_at=? WHERE id=?",
                              (_utc_now_str(), pid))
        return self.get_pending(pid)

    def verify_dues_week(self, class_id: str, week_num: int, wali_tg: int, wali_name: str) -> Dict[str, Any]:
        """Verifikasi semua iuran yang menunggu untuk satu minggu (satu ketukan)."""
        self._require_wali(wali_tg)
        ok, failed, total = 0, 0, 0
        for p in self.list_pending(class_id, "pending", "dues"):
            if p["week_num"] != week_num:
                continue
            r = self.verify_pending(p["id"], wali_tg, wali_name)
            if r["status"] == "verified":
                ok += 1
                total += p["amount"]
            else:
                failed += 1
        return {"week_num": week_num, "verified": ok, "failed": failed, "total": total}

    def get_dues_status(self, class_id: str = CLASS_ID, week_num: int = 1) -> Dict[str, Any]:
        students = self.get_all_whitelist_students(class_id)
        rows = self.conn.execute(
            "SELECT * FROM weekly_dues WHERE class_id = ? AND week_num = ?", (class_id, week_num)
        ).fetchall()
        paid_map = {r["nis"]: dict(r) for r in rows}

        paid_list, unpaid_list = [], []
        for s in students:
            if s["role"] == "wali_kelas":
                continue
            if s["nis"] in paid_map and paid_map[s["nis"]]["is_paid"]:
                paid_list.append(s)
            else:
                unpaid_list.append(s)

        total_students = len(paid_list) + len(unpaid_list)
        pct = (len(paid_list) / total_students * 100) if total_students > 0 else 0
        return {
            "week_num": week_num,
            "total_students": total_students,
            "paid_count": len(paid_list),
            "unpaid_count": len(unpaid_list),
            "percentage": round(pct, 1),
            "paid_students": paid_list,
            "unpaid_students": unpaid_list,
        }

    def get_student_dues_history(self, class_id: str, nis: str, max_weeks: int = 4) -> List[Dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT week_num, is_paid, paid_at FROM weekly_dues WHERE class_id = ? AND nis = ?",
            (class_id, nis.strip()),
        ).fetchall()
        by_week = {r["week_num"]: dict(r) for r in rows}
        return [
            {
                "week_num": w,
                "is_paid": bool(by_week.get(w) and by_week[w]["is_paid"]),
                "paid_at": by_week[w]["paid_at"] if w in by_week else None,
            }
            for w in range(1, max_weeks + 1)
        ]

    def get_recent_transactions(
        self, class_id: str = CLASS_ID, limit: int = 15, category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if category:
            rows = self.conn.execute(
                "SELECT * FROM transactions WHERE class_id = ? AND category = ? ORDER BY id DESC LIMIT ?",
                (class_id, category, limit),
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM transactions WHERE class_id = ? ORDER BY id DESC LIMIT ?",
                (class_id, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    # ---------------------------------------------------------- dues matrix
    def get_dues_matrix(self, class_id: str, weeks: List[int]) -> Dict[str, Any]:
        """Matriks siswa x minggu: {'rows': [{nis,nama,cells:{w:bool}, paid_total}], 'weeks': [...]}."""
        students = [s for s in self.get_all_whitelist_students(class_id) if s["role"] != "wali_kelas"]
        paid = set()
        if weeks:
            marks = ",".join("?" * len(weeks))
            for r in self.conn.execute(
                f"SELECT nis, week_num FROM weekly_dues WHERE class_id = ? AND is_paid = 1 AND week_num IN ({marks})",
                (class_id, *weeks),
            ):
                paid.add((r["nis"], r["week_num"]))
        rows = []
        for s in students:
            cells = {w: (s["nis"], w) in paid for w in weeks}
            rows.append({"nis": s["nis"], "nama": s["nama_resmi"], "cells": cells,
                         "paid_total": sum(cells.values())})
        col_totals = {w: sum(1 for r in rows if r["cells"][w]) for w in weeks}
        return {"weeks": weeks, "rows": rows, "col_totals": col_totals, "n": len(rows)}

    def active_week(self, class_id: str) -> int:
        """Minggu berjalan: dari SEMESTER_START bila diset, jika tidak minggu terakhir yang ada pembayaran."""
        from .config import SEMESTER_START
        from .formatters import current_week
        wk = current_week(SEMESTER_START)
        if wk:
            return wk
        row = self.conn.execute(
            "SELECT MAX(week_num) AS w FROM weekly_dues WHERE class_id = ? AND is_paid = 1", (class_id,)
        ).fetchone()
        return int(row["w"]) if row and row["w"] else 1

    def ledger_head(self, class_id: str = CLASS_ID) -> Optional[str]:
        """Hash transaksi terakhir = 'sidik jari' seluruh buku kas."""
        row = self.conn.execute(
            "SELECT hash FROM transactions WHERE class_id = ? AND hash IS NOT NULL ORDER BY id DESC LIMIT 1",
            (class_id,),
        ).fetchone()
        return row["hash"] if row else None

    # ------------------------------------------------------------ proposals
    def needs_approval(self, tx_type: str, amount: int) -> bool:
        return tx_type == "out" and APPROVAL_THRESHOLD > 0 and amount >= APPROVAL_THRESHOLD

    def _eligible_voters(self, class_id: str, exclude_tg: int) -> int:
        return self.conn.execute(
            "SELECT COUNT(*) FROM members WHERE class_id = ? AND telegram_id != ? AND nis IS NOT NULL",
            (class_id, exclude_tg),
        ).fetchone()[0]

    def _proposal_dict(self, row) -> Dict[str, Any]:
        d = dict(row)
        votes = self.conn.execute(
            "SELECT telegram_id, voter_name, vote FROM proposal_votes WHERE proposal_id = ? ORDER BY voted_at",
            (d["id"],),
        ).fetchall()
        d["votes"] = [dict(v) for v in votes]
        d["yes"] = sum(1 for v in votes if v["vote"] == "yes")
        d["no"] = sum(1 for v in votes if v["vote"] == "no")
        return d

    @_mutating
    def create_proposal(self, class_id: str, amount: int, category: str, description: str,
                        proposed_by: str, proposer_tg: int) -> Dict[str, Any]:
        if not isinstance(amount, int) or amount <= 0:
            raise ValueError("Nominal harus bilangan bulat lebih dari 0.")
        cat = category if category in POCKET_CONFIG else "operasional"
        with self._lock, self.conn:
            cur = self.conn.cursor()
            _, alokasi = self._load_balances(cur, class_id)
            if amount > alokasi.get(cat, 0):
                raise ValueError(
                    f"Saldo pos {POCKET_CONFIG[cat]['label']} tidak cukup "
                    f"(tersedia {format_rupiah(alokasi.get(cat, 0))}, diminta {format_rupiah(amount)})."
                )
            eligible = self._eligible_voters(class_id, proposer_tg)
            if eligible < 1:
                raise ValueError("Belum ada siswa terdaftar (/daftar) yang dapat memberi persetujuan.")
            needed = min(APPROVALS_NEEDED, eligible)
            cur.execute(
                """INSERT INTO proposals (class_id, amount, category, description, proposed_by,
                                          proposer_tg, needed, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (class_id, amount, cat, (description or "").strip()[:200] or "Pengeluaran kas",
                 proposed_by, proposer_tg, needed, _utc_now_str()),
            )
            pid = cur.lastrowid
            row = cur.execute("SELECT * FROM proposals WHERE id = ?", (pid,)).fetchone()
        return self._proposal_dict(row)

    def get_voter_ids(self, class_id: str, exclude_tg: int) -> List[int]:
        rows = self.conn.execute(
            "SELECT telegram_id FROM members WHERE class_id = ? AND nis IS NOT NULL AND telegram_id != ?",
            (class_id, exclude_tg)).fetchall()
        return [r["telegram_id"] for r in rows]

    def get_proposal(self, pid: int) -> Optional[Dict[str, Any]]:
        row = self.conn.execute("SELECT * FROM proposals WHERE id = ?", (pid,)).fetchone()
        return self._proposal_dict(row) if row else None

    def list_proposals(self, class_id: str = CLASS_ID, status: Optional[str] = "open",
                       limit: int = 20) -> List[Dict[str, Any]]:
        if status:
            rows = self.conn.execute(
                "SELECT * FROM proposals WHERE class_id = ? AND status = ? ORDER BY id DESC LIMIT ?",
                (class_id, status, limit)).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM proposals WHERE class_id = ? ORDER BY id DESC LIMIT ?",
                (class_id, limit)).fetchall()
        return [self._proposal_dict(r) for r in rows]

    @_mutating
    def vote_proposal(self, pid: int, telegram_id: int, vote: str) -> Dict[str, Any]:
        """Beri suara. Otomatis mencatat transaksi saat 'setuju' mencapai kuorum."""
        if vote not in ("yes", "no"):
            raise ValueError("Suara tidak valid.")
        with self._lock, self.conn:
            cur = self.conn.cursor()
            prop = cur.execute("SELECT * FROM proposals WHERE id = ?", (pid,)).fetchone()
            if not prop:
                raise ValueError(f"Usulan #{pid} tidak ditemukan.")
            if prop["status"] != "open":
                raise ValueError(f"Usulan #{pid} sudah ditutup ({prop['status']}).")
            member = cur.execute(
                "SELECT nama, nis FROM members WHERE telegram_id = ? AND class_id = ?",
                (telegram_id, prop["class_id"])).fetchone()
            if not member or not member["nis"]:
                raise ValueError("Hanya siswa terdaftar (/daftar) yang dapat memberi suara.")
            if telegram_id == prop["proposer_tg"]:
                raise ValueError("Pengusul tidak dapat memberi suara atas usulannya sendiri.")
            if cur.execute("SELECT 1 FROM proposal_votes WHERE proposal_id = ? AND telegram_id = ?",
                           (pid, telegram_id)).fetchone():
                raise ValueError("Anda sudah memberi suara untuk usulan ini.")
            cur.execute(
                "INSERT INTO proposal_votes (proposal_id, telegram_id, voter_name, vote, voted_at) VALUES (?,?,?,?,?)",
                (pid, telegram_id, member["nama"], vote, _utc_now_str()))

            tally = cur.execute(
                "SELECT SUM(vote='yes') AS y, SUM(vote='no') AS n FROM proposal_votes WHERE proposal_id = ?",
                (pid,)).fetchone()
            yes, no = tally["y"] or 0, tally["n"] or 0
            tx = None
            pend_id = None
            status = "open"
            if yes >= prop["needed"] and self.require_teacher:
                pend_id = self._insert_pending(
                    cur, prop["class_id"], "tx", tx_type="out", amount=prop["amount"], category=prop["category"],
                    description=f"{prop['description']} (usulan #{pid}, disetujui {yes} siswa)",
                    input_by=prop["proposed_by"], submitter_tg=prop["proposer_tg"])
                status = "approved"
                cur.execute("UPDATE proposals SET status='approved', decided_at=?, note=? WHERE id=?",
                            (_utc_now_str(), f"menunggu verifikasi guru (pengajuan #{pend_id})", pid))
            elif yes >= prop["needed"]:
                try:
                    tx = self._apply_tx(
                        cur, prop["class_id"], "out", prop["amount"], prop["category"],
                        f"{prop['description']} (usulan #{pid}, disetujui {yes} siswa)",
                        prop["proposed_by"], prop["proposer_tg"])
                    status = "approved"
                    cur.execute("UPDATE proposals SET status='approved', decided_at=?, tx_id=? WHERE id=?",
                                (_utc_now_str(), tx["tx_id"], pid))
                except ValueError as err:  # saldo berubah sejak diusulkan
                    status = "failed"
                    cur.execute("UPDATE proposals SET status='failed', decided_at=?, note=? WHERE id=?",
                                (_utc_now_str(), str(err), pid))
            elif no >= prop["needed"]:
                status = "rejected"
                cur.execute("UPDATE proposals SET status='rejected', decided_at=? WHERE id=?",
                            (_utc_now_str(), pid))
        result = self.get_proposal(pid)
        result["tx"] = tx
        result["pending_id"] = pend_id
        return result

    @_mutating
    def cancel_proposal(self, pid: int, telegram_id: int, as_admin: bool = False) -> Dict[str, Any]:
        with self._lock, self.conn:
            prop = self.conn.execute("SELECT * FROM proposals WHERE id = ?", (pid,)).fetchone()
            if not prop:
                raise ValueError(f"Usulan #{pid} tidak ditemukan.")
            if prop["status"] != "open":
                raise ValueError(f"Usulan #{pid} sudah ditutup ({prop['status']}).")
            if not as_admin and telegram_id != prop["proposer_tg"] and not self.is_bendahara(telegram_id):
                raise ValueError("Hanya pengusul atau Bendahara yang dapat membatalkan usulan.")
            self.conn.execute("UPDATE proposals SET status='cancelled', decided_at=? WHERE id=?",
                              (_utc_now_str(), pid))
        return self.get_proposal(pid)

    # -------------------------------------------------------- integrity & backup
    def verify_ledger(self, class_id: str = CLASS_ID) -> Dict[str, Any]:
        """Periksa (1) rantai hash tiap transaksi dan (2) saldo cache == hasil hitung ulang dari ledger."""
        rows = self.conn.execute(
            "SELECT * FROM transactions WHERE class_id = ? ORDER BY id ASC", (class_id,)
        ).fetchall()
        types = {r["id"]: r["type"] for r in rows}
        errors: List[str] = []
        expected_prev = GENESIS
        chain_started = False
        legacy = 0
        saldo = 0
        alokasi = {k: 0 for k in POCKET_CONFIG}

        for r in rows:
            # --- hash chain
            if r["hash"] is None:
                if chain_started:
                    errors.append(f"Transaksi #{r['id']}: hash hilang di tengah rantai.")
                legacy += 1
            else:
                chain_started = True
                if r["prev_hash"] != expected_prev:
                    errors.append(f"Transaksi #{r['id']}: rantai putus (ada transaksi sebelumnya yang dihapus/diubah).")
                recomputed = _tx_hash(r["prev_hash"], r["id"], r["class_id"], r["type"], r["amount"],
                                      r["category"], r["description"], r["input_by"], r["created_at"],
                                      r["reverses_tx_id"])
                if recomputed != r["hash"]:
                    errors.append(f"Transaksi #{r['id']}: isi data tidak cocok dengan hash (dimanipulasi).")
                expected_prev = r["hash"]

            # --- saldo
            if r["type"] == "in":
                delta = r["amount"]
            elif r["type"] == "out":
                delta = -r["amount"]
            else:  # correction: kebalikan dari transaksi asal
                delta = -r["amount"] if types.get(r["reverses_tx_id"]) == "in" else r["amount"]
            saldo += delta
            alokasi[r["category"]] = alokasi.get(r["category"], 0) + delta

        cls = self.conn.execute("SELECT saldo, alokasi FROM classes WHERE id = ?", (class_id,)).fetchone()
        if cls:
            if cls["saldo"] != saldo:
                errors.append(f"Saldo tersimpan {format_rupiah(cls['saldo'])} != hasil hitung ledger {format_rupiah(saldo)}.")
            stored = json.loads(cls["alokasi"])
            for k in set(stored) | set(alokasi):
                if stored.get(k, 0) != alokasi.get(k, 0):
                    errors.append(f"Pos {k}: tersimpan {format_rupiah(stored.get(k, 0))} != ledger {format_rupiah(alokasi.get(k, 0))}.")

        return {
            "ok": not errors,
            "errors": errors,
            "tx_count": len(rows),
            "legacy_unhashed": legacy,
            "computed_saldo": saldo,
            "computed_alokasi": alokasi,
        }

    def backup(self, dest_dir: Optional[str] = None, keep: int = 14) -> Optional[str]:
        """Salin konsisten database ke folder backups/ (rotasi `keep` file terbaru)."""
        if self.db_path == ":memory:":
            return None
        folder = Path(dest_dir) if dest_dir else Path(self.db_path).resolve().parent / "backups"
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / f"cekas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        with self._lock:
            dest = sqlite3.connect(str(target))
            try:
                self.conn.backup(dest)
            finally:
                dest.close()
        for old in sorted(folder.glob("cekas_*.db"))[:-keep]:
            try:
                old.unlink()
            except OSError:
                pass
        return str(target)

"""
CEKAS Formatters & Parsing Utilities
Supports standard and natural Indonesian currency strings, dates, and commands.
"""

import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

WIB = timezone(timedelta(hours=7))

# Batas wajar satu transaksi kas kelas (mencegah salah ketik seperti "5000jt").
MAX_NOMINAL = 100_000_000


def current_week(semester_start: str = "", today: Optional[datetime] = None) -> Optional[int]:
    """Nomor minggu (1-52) sejak `semester_start` (YYYY-MM-DD); None jika tidak dikonfigurasi."""
    if not semester_start:
        return None
    try:
        start = datetime.strptime(semester_start, "%Y-%m-%d").date()
    except ValueError:
        return None
    now = (today or datetime.now(WIB)).date()
    return max(1, min(52, (now - start).days // 7 + 1))


def utc_to_wib(ts) -> str:
    """Ubah timestamp SQLite (UTC, 'YYYY-MM-DD HH:MM:SS') menjadi 'DD/MM/YYYY HH:MM' WIB."""
    if not ts:
        return "-"
    try:
        dt = datetime.strptime(str(ts)[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        return dt.astimezone(WIB).strftime("%d/%m/%Y %H:%M")
    except ValueError:
        return str(ts)[:16]


def format_rupiah(amount: float | int) -> str:
    """Format numeric value to Indonesian Rupiah currency format.
    Example: 15000 -> "Rp 15.000"
    """
    num = round(float(amount or 0))
    formatted = f"{abs(num):,}".replace(",", ".")
    sign = "-Rp " if num < 0 else "Rp "
    return f"{sign}{formatted}"

def parse_nominal(input_str: Optional[str]) -> Optional[int]:
    """Parse user input string to integer nominal.
    Supports:
    - "10000" -> 10000
    - "10.000" or "10,000" -> 10000
    - "Rp 10.000" or "rp10000" -> 10000
    - "10k" or "10K" -> 10000
    - "10rb" or "10 rb" or "10 ribu" -> 10000
    - "1.5jt" or "1.5m" -> 1500000
    """
    if not input_str:
        return None

    clean = input_str.strip().lower()
    clean = re.sub(r"^rp\.?\s*", "", clean)

    # Format dengan satuan: boleh desimal ("1.5jt", "2,5k")
    m = re.fullmatch(r"(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m)", clean)
    if m:
        num = float(m.group(1).replace(",", "."))
        mult = 1000 if m.group(2) in ("k", "rb", "ribu") else 1_000_000
        val = round(num * mult)
    elif re.fullmatch(r"\d+", clean):
        val = int(clean)
    elif re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", clean):
        # Pemisah ribuan harus benar-benar per 3 digit ("10.000", "1.250.000").
        # Bentuk ambigu seperti "1.5" atau "10.50" ditolak, bukan ditebak.
        val = int(re.sub(r"[.,]", "", clean))
    else:
        return None

    return val if 0 < val <= MAX_NOMINAL else None

def normalize_category(raw_cat: Optional[str]) -> Optional[str]:
    """Map category alias/synonym to canonical pocket key."""
    if not raw_cat:
        return None
    c = raw_cat.strip().lower()
    
    # Alias umum seperti "kelas", "sakit", "lainnya", "sisa" sengaja tidak dipakai:
    # kata itu sering muncul sebagai awal keterangan dan akan "tertelan" jadi kategori.
    if c in ["operasional", "ops", "rutin", "kebersihan", "kbm"]:
        return "operasional"
    if c in ["sosial", "duka", "santunan", "peduli"]:
        return "sosial"
    if c in ["event", "acara", "bukber", "kegiatan", "perpisahan", "wisuda", "lomba"]:
        return "event"
    if c in ["cadangan", "darurat", "tabungan"]:
        return "cadangan"
    return None

def parse_transaction_args(args_str: Optional[str]) -> Dict[str, Any]:
    """Split transaction arguments into nominal, category, and description."""
    if not args_str:
        return {
            "amount": None,
            "raw_nominal": "",
            "category": "operasional",
            "description": ""
        }
        
    parts = args_str.strip().split()
    if not parts:
        return {
            "amount": None,
            "raw_nominal": "",
            "category": "operasional",
            "description": ""
        }
        
    raw_nominal = parts[0]
    amount = parse_nominal(raw_nominal)
    
    if len(parts) == 1:
        return {
            "amount": amount,
            "raw_nominal": raw_nominal,
            "category": "operasional",
            "description": ""
        }
        
    second_token = parts[1]
    matched_cat = normalize_category(second_token)
    
    if matched_cat:
        category = matched_cat
        description = " ".join(parts[2:]).strip()
    else:
        category = "operasional"
        description = " ".join(parts[1:]).strip()
        
    return {
        "amount": amount,
        "raw_nominal": raw_nominal,
        "category": category,
        "description": description
    }

def format_wib(dt: Optional[datetime] = None) -> str:
    """Format datetime to Indonesian WIB string."""
    if dt is None:
        dt = datetime.now(WIB)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc).astimezone(WIB)
    else:
        dt = dt.astimezone(WIB)
    return dt.strftime("%d/%m/%Y, %H.%M.%S WIB")

"""
Insight keuangan dengan statistik biasa (tanpa pandas): runway, tren mingguan, dan anomali.
Semua fungsi murni terhadap isi database; tidak ada efek samping.
"""

import statistics
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from .config import CLASS_ID, POCKET_CONFIG
from .formatters import WIB, format_rupiah


def _parse(ts: str) -> datetime:
    return datetime.strptime(str(ts)[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)


def _spending(db, class_id: str) -> List[Dict[str, Any]]:
    """Pengeluaran 'asli': bukan koreksi dan belum dibatalkan."""
    rows = db.conn.execute(
        "SELECT id, amount, category, description, created_at FROM transactions "
        "WHERE class_id = ? AND type = 'out' AND is_reversal = 0 ORDER BY id", (class_id,)).fetchall()
    return [dict(r) | {"dt": _parse(r["created_at"])} for r in rows]


def weekly_flow(db, class_id: str = CLASS_ID, weeks: int = 8, now: datetime = None) -> List[Dict[str, Any]]:
    """Arus kas per minggu kalender (Senin-Minggu, WIB), `weeks` minggu terakhir, urut lama -> baru."""
    now = (now or datetime.now(timezone.utc)).astimezone(WIB)
    monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    starts = [monday - timedelta(weeks=i) for i in range(weeks - 1, -1, -1)]
    buckets = [{"start": s, "in": 0, "out": 0} for s in starts]
    rows = db.conn.execute(
        "SELECT type, amount, created_at, reverses_tx_id FROM transactions WHERE class_id = ? ORDER BY id",
        (class_id,)).fetchall()
    types = {r["id"]: r["type"] for r in db.conn.execute("SELECT id, type FROM transactions WHERE class_id = ?", (class_id,))}
    for r in rows:
        when = _parse(r["created_at"]).astimezone(WIB)
        for b in reversed(buckets):
            if when >= b["start"]:
                if r["type"] == "in" or (r["type"] == "correction" and types.get(r["reverses_tx_id"]) == "out"):
                    b["in"] += r["amount"]
                else:
                    b["out"] += r["amount"]
                break
    running = 0
    # saldo akhir tiap minggu dihitung mundur dari saldo sekarang
    saldo_now = db.conn.execute("SELECT saldo FROM classes WHERE id = ?", (class_id,)).fetchone()
    running = saldo_now["saldo"] if saldo_now else 0
    for b in reversed(buckets):
        b["balance_end"] = running
        running -= b["in"] - b["out"]
    return buckets


def runway(db, class_id: str = CLASS_ID, now: datetime = None) -> Dict[str, Any]:
    """Perkiraan berapa minggu saldo bertahan berdasarkan rata-rata belanja mingguan (maks 8 minggu terakhir)."""
    now = now or datetime.now(timezone.utc)
    spend = [s for s in _spending(db, class_id) if s["dt"] >= now - timedelta(weeks=8)]
    saldo = db.conn.execute("SELECT saldo FROM classes WHERE id = ?", (class_id,)).fetchone()["saldo"]
    if len(spend) < 2:
        return {"enough_data": False, "saldo": saldo}
    span_weeks = max((now - min(s["dt"] for s in spend)).days / 7, 1.0)
    avg = sum(s["amount"] for s in spend) / span_weeks
    return {"enough_data": True, "saldo": saldo, "avg_weekly_out": round(avg),
            "weeks_left": (saldo / avg) if avg > 0 else None, "n": len(spend)}


def anomalies(db, class_id: str = CLASS_ID, now: datetime = None) -> List[str]:
    now = now or datetime.now(timezone.utc)
    out: List[str] = []
    spend = _spending(db, class_id)

    # 1. Belanja jauh di atas kebiasaan (butuh riwayat >= 4)
    for i, s in enumerate(spend):
        prior = [p["amount"] for p in spend[:i]]
        if len(prior) >= 4 and s["amount"] > max(3 * statistics.median(prior), 100_000) \
                and (now - s["dt"]).days <= 14:
            out.append(f"Belanja #{s['id']} ({format_rupiah(s['amount'])}) jauh di atas biasanya "
                       f"(median {format_rupiah(round(statistics.median(prior)))}).")

    # 2. Kemungkinan input ganda: nominal, pos, dan keterangan sama dalam 48 jam
    for i, a in enumerate(spend):
        for b in spend[i + 1:]:
            if (b["dt"] - a["dt"]) <= timedelta(hours=48) and a["amount"] == b["amount"] \
                    and a["category"] == b["category"] \
                    and a["description"].strip().lower() == b["description"].strip().lower() \
                    and (now - b["dt"]).days <= 14:
                out.append(f"Belanja #{a['id']} dan #{b['id']} identik ({format_rupiah(a['amount'])}, "
                           f"\"{a['description']}\"). Mungkin tercatat dua kali.")

    # 3. Terlalu banyak koreksi
    since = now - timedelta(days=7)
    n_corr = sum(1 for r in db.conn.execute(
        "SELECT created_at FROM transactions WHERE class_id = ? AND type = 'correction'", (class_id,))
        if _parse(r["created_at"]) >= since)
    if n_corr >= 3:
        out.append(f"{n_corr} koreksi dalam 7 hari terakhir. Periksa apakah ada kesalahan pencatatan berulang.")
    return out


def build_insights(db, class_id: str = CLASS_ID, now: datetime = None) -> List[Dict[str, str]]:
    """Daftar {'level': info|warn|crit, 'text': ...} siap tampil (web & bot)."""
    items: List[Dict[str, str]] = []
    r = runway(db, class_id, now)
    if r["enough_data"] and r["weeks_left"] is not None:
        w = r["weeks_left"]
        text = (f"Dengan belanja rata-rata {format_rupiah(r['avg_weekly_out'])} per minggu, "
                f"saldo cukup sekitar {w:.0f} minggu.")
        items.append({"level": "crit" if w < 4 else "warn" if w < 8 else "info", "text": text})
    elif not r["enough_data"]:
        items.append({"level": "info", "text": "Prakiraan saldo muncul setelah ada minimal 2 pengeluaran."})

    cls = db.get_or_create_class(class_id)
    for key, meta in POCKET_CONFIG.items():
        val = cls["alokasi"].get(key, 0)
        if val < 0:
            items.append({"level": "crit", "text": f"Pos {meta['short']} minus {format_rupiah(-val)}."})
    for a in anomalies(db, class_id, now):
        items.append({"level": "warn", "text": a})
    return items

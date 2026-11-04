"""Penyusun data tampilan web & laporan (murni; tidak menyentuh HTTP)."""

from datetime import datetime, timezone
from typing import Any, Dict, List

import segno

from .config import POCKET_CONFIG
from .formatters import utc_to_wib, WIB


POCKET_CLASS = {"operasional": "op", "sosial": "so", "event": "ev", "cadangan": "ca"}
_BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def _delta(t: Dict[str, Any], types: Dict[int, str]) -> int:
    if t["type"] == "in":
        return t["amount"]
    if t["type"] == "out":
        return -t["amount"]
    return -t["amount"] if types.get(t["reverses_tx_id"]) == "in" else t["amount"]


def _day_label(wib: datetime) -> str:
    today = datetime.now(WIB).date()
    delta = (today - wib.date()).days
    if delta == 0:
        return "Hari ini"
    if delta == 1:
        return "Kemarin"
    return f"{wib.day} {_BLN[wib.month - 1]} {wib.year}" if wib.year != today.year else f"{wib.day} {_BLN[wib.month - 1]}"


def students_view(db, class_id: str, week: int) -> Dict[str, Any]:
    """Siswa untuk satu minggu: dengan inisial & warna avatar tetap per NIS."""
    st = db.get_dues_status(class_id, week)

    def one(s, paid):
        parts = s["nama_resmi"].split()
        ini = (parts[0][0] + (parts[1][0] if len(parts) > 1 else "")).upper()
        return {"nis": s["nis"], "nama": s["nama_resmi"], "first": parts[0], "ini": ini,
                "av": int(s["nis"][-3:] or 0) % 6, "paid": paid}

    return {"paid": [one(s, True) for s in st["paid_students"]], "unpaid": [one(s, False) for s in st["unpaid_students"]],
            "total": st["total_students"], "paid_n": st["paid_count"], "pct": round(st["percentage"])}


def ledger_rows(db, class_id: str, limit: int = 40) -> List[Dict[str, Any]]:
    """Baris buku kas terbaru-dulu dengan kolom Masuk/Keluar dan saldo berjalan yang akurat."""
    all_tx = [dict(r) for r in db.conn.execute(
        "SELECT * FROM transactions WHERE class_id = ? ORDER BY id ASC", (class_id,))]
    types = {t["id"]: t["type"] for t in all_tx}
    run = 0
    rows = []
    for t in all_tx:
        d = _delta(t, types)
        run += d
        meta = POCKET_CONFIG.get(t["category"], {})
        wib = datetime.strptime(str(t["created_at"])[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).astimezone(WIB)
        rows.append({
            "day": _day_label(wib), "time": wib.strftime("%H.%M"), "cls": POCKET_CLASS.get(t["category"], "op"),
            "icon": meta.get("icon", "🧾"),
            "id": t["id"], "when": utc_to_wib(t["created_at"]), "desc": t["description"], "who": t["input_by"],
            "cat": t["category"], "cat_label": meta.get("short", t["category"]),
            "masuk": d if d > 0 else None, "keluar": -d if d < 0 else None, "saldo": run,
            "type": t["type"], "voided": bool(t["is_reversal"]) and t["type"] != "correction",
            "corr": t["type"] == "correction",
        })
    return list(reversed(rows))[:limit]


def pocket_view(cls: Dict[str, Any]) -> Dict[str, Any]:
    pos = sum(max(v, 0) for v in cls["alokasi"].values())
    items, segs = [], []
    for k, meta in POCKET_CONFIG.items():
        v = cls["alokasi"].get(k, 0)
        items.append({"key": k, "cls": POCKET_CLASS[k], "icon": meta["icon"], "label": meta["label"], "short": meta["short"], "note": meta["description"], "value": v})
        if v > 0 and pos > 0:
            segs.append({"key": k, "pct": v / pos * 100, "label": meta["short"]})
    return {"rows": items, "segs": segs}


def spark_svg(flow: List[Dict[str, Any]], width: int = 300, height: int = 72) -> str:
    """Saldo akhir tiap minggu. Skala tunggal; label hanya nilai yang benar-benar dicapai grafik."""
    vals = [b["balance_end"] for b in flow]
    if len(vals) < 2:
        return ""
    lo, hi = min(vals), max(vals)
    pad_l, pad_r, pad_t, pad_b = 4, 44, 8, 18
    span = (hi - lo) or 1
    n = len(vals)
    xs = [pad_l + i * (width - pad_l - pad_r) / (n - 1) for i in range(n)]
    ys = [pad_t + (1 - (v - lo) / span) * (height - pad_t - pad_b) for v in vals]
    pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in zip(xs, ys))
    area = f"{xs[0]:.1f},{height - pad_b} {pts} {xs[-1]:.1f},{height - pad_b}"
    first = flow[0]["start"].strftime("%d/%m")
    last = flow[-1]["start"].strftime("%d/%m")
    v_end = vals[-1]
    end_label = (f"{v_end / 1_000_000:.2f}jt".replace(".", ",") if abs(v_end) >= 1_000_000
                 else f"{v_end / 1000:.0f}rb" if abs(v_end) >= 1000 else str(v_end))
    return (
        f'<svg class="spark" viewBox="0 0 {width} {height}" role="img" '
        f'aria-label="Saldo akhir per minggu, {n} minggu terakhir">'
        f'<line x1="{pad_l}" y1="{height - pad_b}" x2="{width - pad_r}" y2="{height - pad_b}" stroke="currentColor" opacity=".25"/>'
        f'<polygon points="{area}" fill="currentColor" opacity=".14"/>'
        f'<polyline points="{pts}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>'
        f'<circle cx="{xs[-1]:.1f}" cy="{ys[-1]:.1f}" r="4" fill="currentColor"/>'
        f'<text x="{xs[-1] + 7:.1f}" y="{ys[-1] + 3.5:.1f}">{end_label}</text>'
        f'<text x="{pad_l}" y="{height - 4}">{first}</text>'
        f'<text x="{xs[-1]:.1f}" y="{height - 4}" text-anchor="end">{last}</text></svg>'
    )


def qr_svg(url: str) -> str:
    if not url:
        return ""
    svg = segno.make(url, error="m").svg_inline(border=0, dark="#000000", light=None, omitsize=True)
    return svg.replace("#000000", "currentColor").replace("#000", "currentColor")  # ikut tema terang/gelap


def week_window(active: int, end: int = None, size: int = 9) -> List[int]:
    end = end if end else min(52, active + 1)
    end = max(min(52, end), 1)
    start = max(1, end - size + 1)
    return list(range(start, end + 1))


def stamp_text(ledger: Dict[str, Any], head: str = None) -> Dict[str, str]:
    now = datetime.now(WIB).strftime("%d/%m/%Y")
    if ledger["ok"]:
        return {"cls": "", "title": "Terverifikasi", "sub": f"{(head or '—')[:8]} · {now}"}
    return {"cls": "bad", "title": "Perlu diperiksa", "sub": f"{len(ledger['errors'])} masalah"}

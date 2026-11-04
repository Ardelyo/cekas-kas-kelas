"""
Teks siap tempel untuk grup WhatsApp (format *tebal*/_miring_ khas WA).
Kelas Indonesia berkoordinasi di WhatsApp, jadi rekap harus bisa disalin satu ketukan.
"""

from typing import List

from .config import CLASS_ID, POCKET_CONFIG, SCHOOL_NAME
from .formatters import format_rupiah, utc_to_wib


def wa_recap(db, class_id: str = CLASS_ID, week: int = None, public_url: str = "") -> str:
    cls = db.get_or_create_class(class_id)
    week = week or db.active_week(class_id)
    dues = db.get_dues_status(class_id, week_num=week)
    ledger_ok = db.verify_ledger(class_id)["ok"]
    lines: List[str] = [
        f"*REKAP KAS {class_id}* — {SCHOOL_NAME}",
        "",
        f"Saldo kas: *{format_rupiah(cls['saldo'])}*",
    ]
    for key, meta in POCKET_CONFIG.items():
        lines.append(f"• {meta['short']}: {format_rupiah(cls['alokasi'].get(key, 0))}")

    lines += ["", f"*Iuran minggu ke-{week}:* {dues['paid_count']}/{dues['total_students']} lunas "
                  f"({dues['percentage']:.0f}%)"]
    if dues["unpaid_students"]:
        names = ", ".join(s["nama_resmi"].split()[0] for s in dues["unpaid_students"])
        lines.append(f"Belum: {names}")
    else:
        lines.append("Semua sudah lunas 🎉")

    recent = db.get_recent_transactions(class_id, limit=5)
    if recent:
        lines += ["", "*Mutasi terakhir:*"]
        for t in recent:
            sign = "+" if t["type"] == "in" else "−" if t["type"] == "out" else "↩"
            lines.append(f"{utc_to_wib(t['created_at'])[:5]} {sign}{format_rupiah(t['amount'])} {t['description']}")

    lines += ["", f"_Buku kas {'terverifikasi (hash utuh)' if ledger_ok else 'PERLU DIPERIKSA'}_"]
    if public_url:
        lines.append(f"Lihat lengkap: {public_url}")
    return "\n".join(lines)


def wa_reminder(db, class_id: str = CLASS_ID, week: int = None) -> str:
    """Pengingat sopan untuk yang belum bayar (hanya nama depan, nada ramah)."""
    cls = db.get_or_create_class(class_id)
    week = week or db.active_week(class_id)
    dues = db.get_dues_status(class_id, week_num=week)
    if not dues["unpaid_students"]:
        return f"Iuran kas minggu ke-{week} sudah lunas semua. Terima kasih, teman-teman! 🙏"
    names = ", ".join(s["nama_resmi"].split()[0] for s in dues["unpaid_students"])
    return (
        f"Halo teman-teman 👋\n"
        f"Pengingat iuran kas minggu ke-{week} ({format_rupiah(cls['nominal_iuran'])}).\n"
        f"Yang belum: {names}.\n"
        f"Boleh dititipkan ke Bendahara hari ini ya. Terima kasih! 🙏"
    )

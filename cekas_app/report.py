"""Laporan SPJ (HTML mandiri, siap cetak/PDF dari browser)."""

from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .config import CLASS_ID, SCHOOL_NAME, SCHOOL_YEAR
from .formatters import WIB, format_rupiah
from .viewmodel import ledger_rows, pocket_view, qr_svg

_env = Environment(loader=FileSystemLoader(str(Path(__file__).parent / "templates")),
                   autoescape=select_autoescape(["html"]))
_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
          "September", "Oktober", "November", "Desember"]


def render_report(db, class_id: str = CLASS_ID, public_url: str = "") -> str:
    cls = db.get_or_create_class(class_id)
    rows = list(reversed(ledger_rows(db, class_id, limit=10_000)))  # kronologis
    live = [r for r in rows if not r["voided"] and not r["corr"]]
    total_in = sum(r["masuk"] or 0 for r in live)
    total_out = sum(r["keluar"] or 0 for r in live)
    dues = []
    for (wk,) in db.conn.execute(
            "SELECT DISTINCT week_num FROM weekly_dues WHERE class_id = ? AND is_paid = 1 ORDER BY week_num", (class_id,)):
        st = db.get_dues_status(class_id, wk)
        dues.append({"week": wk, "paid": st["paid_count"], "unpaid": st["unpaid_count"]})
    v = db.verify_ledger(class_id)
    now = datetime.now(WIB)
    return _env.get_template("report.html").render(
        class_id=class_id, school=SCHOOL_NAME, school_year=SCHOOL_YEAR, saldo=cls["saldo"],
        pockets=pocket_view(cls)["rows"], rows=rows, total_in=total_in, total_out=total_out, dues=dues,
        nominal=cls["nominal_iuran"], format_rupiah=format_rupiah, head=db.ledger_head(class_id),
        ledger_ok=v["ok"], tx_count=v["tx_count"], public_url=public_url, qr=qr_svg(public_url or ""),
        printed=now.strftime("%d/%m/%Y %H.%M WIB"),
        printed_date=f"{now.day} {_BULAN[now.month - 1]} {now.year}",
    )

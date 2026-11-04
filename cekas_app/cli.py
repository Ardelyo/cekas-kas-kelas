"""
CEKAS Unified CLI Controller (100% Pure Python Edition)
Run Web Dashboard, Telegram Bot (@kacekasbot), Seeder, or Local Financial Operations.
"""

import sys
import argparse
import threading

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from .config import CLASS_ID, DB_PATH, POCKET_CONFIG, TELEGRAM_BOT_TOKEN
from .database import CekasDB
from .formatters import format_rupiah
from .export_excel import generate_excel_report
from .generate_chart import generate_financial_chart


def get_db():
    db = CekasDB(DB_PATH)
    db.get_or_create_class(CLASS_ID)
    return db


def cmd_status():
    db = get_db()
    info = db.get_or_create_class(CLASS_ID)
    print("=" * 58)
    print(f"📊 STATUS KAS DIGITAL {CLASS_ID} - SMA KARTIKA XIX-1 BANDUNG")
    print("=" * 58)
    print(f"💰 Total Saldo: {format_rupiah(info['saldo'])}")
    print("-" * 58)
    print("Pos Alokasi:")
    for k, meta in POCKET_CONFIG.items():
        val = info["alokasi"].get(k, 0)
        pct = (val / info["saldo"] * 100) if info["saldo"] > 0 else 0
        print(f"  {meta['icon']} {meta['label']:<20}: {format_rupiah(val):>14} ({pct:.1f}%)")
    print("=" * 58)


def cmd_verify():
    db = get_db()
    v = db.verify_ledger(CLASS_ID)
    print(f"Transaksi diperiksa : {v['tx_count']} (tanpa hash/lama: {v['legacy_unhashed']})")
    print(f"Saldo hitung ulang  : {format_rupiah(v['computed_saldo'])}")
    if v["ok"]:
        print("✅ LEDGER TERVERIFIKASI: rantai hash utuh & saldo cocok.")
        return 0
    print("🚨 LEDGER BERMASALAH:")
    for e in v["errors"]:
        print(f"  - {e}")
    return 2


def cmd_backup():
    path = get_db().backup()
    print(f"✅ Backup tersimpan di: {path}")


def cmd_set_pin(new_pin: str):
    try:
        get_db().set_pin(CLASS_ID, new_pin)
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)
    print("✅ PIN Bendahara diperbarui (disimpan sebagai hash).")


def cmd_seed(with_sample_tx: bool = True):
    db = get_db()
    db.seed_initial_students(CLASS_ID)
    students = db.get_all_whitelist_students(CLASS_ID)
    print(f"✅ Berhasil mendaftarkan {len(students)} siswa ke whitelist kelas {CLASS_ID}.")

    existing_txs = db.get_recent_transactions(CLASS_ID, limit=1)
    if with_sample_tx and not existing_txs:
        db.record_transaction(CLASS_ID, "in", 340000, "operasional", "Iuran kas kelas minggu 1 (kolektif)", "Tarina", 0)
        db.record_transaction(CLASS_ID, "in", 100000, "sosial", "Dana awal pos sosial & peduli", "Tarina", 0)
        db.record_transaction(CLASS_ID, "in", 150000, "event", "Tabungan awal class meeting", "Tarina", 0)
        db.record_transaction(CLASS_ID, "in", 75000, "cadangan", "Alokasi dana darurat kelas", "Tarina", 0)
        db.record_transaction(CLASS_ID, "out", 35000, "operasional", "Pembelian spidol whiteboard & penghapus", "Tarina", 0)
        db.mark_dues_paid(CLASS_ID, "23241001", 1, "Tarina", 0, auto_tx=True)
        db.mark_dues_paid(CLASS_ID, "23241015", 1, "Tarina", 0, auto_tx=True)
        db.mark_dues_paid(CLASS_ID, "23241020", 1, "Tarina", 0, auto_tx=True)
        db.mark_dues_paid(CLASS_ID, "23241025", 1, "Tarina", 0, auto_tx=True)
        print("✅ Berhasil menginisialisasi transaksi awal & data lunas contoh untuk Kelas XI-F2.")


def cmd_export_excel(output_path="laporan_kas.xlsx"):
    db = get_db()
    stream = generate_excel_report(db, CLASS_ID)
    with open(output_path, "wb") as f:
        f.write(stream.read())
    print(f"✅ Laporan Excel tersimpan di: {output_path}")


def cmd_export_chart(output_path="grafik_kas.png"):
    db = get_db()
    stream = generate_financial_chart(db, CLASS_ID)
    with open(output_path, "wb") as f:
        f.write(stream.read())
    print(f"✅ Infografis tersimpan di: {output_path}")


def cmd_web(host="127.0.0.1", port=8000):
    import uvicorn
    from .web import app
    print(f"🚀 Menjalankan CEKAS Web Dashboard (Pure Python) di http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)


def cmd_bot():
    from .bot import run_bot_polling
    print(f"🤖 Menjalankan Telegram Bot (@kacekasbot) untuk Kelas {CLASS_ID}...")
    run_bot_polling()


def cmd_all(host="127.0.0.1", port=8000):
    import uvicorn
    from .web import app
    from .bot import run_bot_polling

    print("=" * 62)
    print(f"🚀 CEKAS PURE PYTHON SUITE ({CLASS_ID} - SMA Kartika XIX-1)")
    print(f"🌐 Web Dashboard : http://{host}:{port}")
    print(f"🤖 Telegram Bot  : Aktif (@kacekasbot)" if TELEGRAM_BOT_TOKEN else "⚠️ Telegram Bot  : Token belum diisi di .env")
    print("=" * 62)

    web_thread = threading.Thread(
        target=uvicorn.run,
        args=(app,),
        kwargs={"host": host, "port": port, "log_level": "info"},
        daemon=True,
    )
    web_thread.start()

    if TELEGRAM_BOT_TOKEN:
        run_bot_polling()
    else:
        web_thread.join()


def main():
    parser = argparse.ArgumentParser(description="CEKAS Pure Python CLI")
    subparsers = parser.add_subparsers(dest="subcommand", help="Perintah yang tersedia")

    subparsers.add_parser("status", help="Tampilkan status saldo dan pos kas saat ini")
    subparsers.add_parser("seed", help="Inisialisasi data whitelist siswa & transaksi awal")
    subparsers.add_parser("verify", help="Verifikasi integritas ledger (hash chain + saldo)")
    subparsers.add_parser("backup", help="Buat backup database ke folder backups/")
    pin_p = subparsers.add_parser("set-pin", help="Ganti PIN Bendahara (min. 6 karakter)")
    pin_p.add_argument("pin")

    in_p = subparsers.add_parser("tambah", help="Catat pemasukan kas melalui CLI")
    in_p.add_argument("nominal", help="Nominal rupiah (contoh: 20000 atau 20k)")
    in_p.add_argument("keterangan", nargs="?", default="Pemasukan kas", help="Keterangan transaksi")
    in_p.add_argument("--alokasi", default="operasional", help="Pos alokasi (operasional/sosial/event/cadangan)")
    in_p.add_argument("--nama", default="Tarina", help="Nama pencatat")

    out_p = subparsers.add_parser("kurang", help="Catat pengeluaran kas melalui CLI")
    out_p.add_argument("nominal", help="Nominal rupiah (contoh: 35000 atau 35k)")
    out_p.add_argument("keterangan", nargs="?", default="Pengeluaran kas", help="Keterangan transaksi")
    out_p.add_argument("--alokasi", default="operasional", help="Pos alokasi (operasional/sosial/event/cadangan)")
    out_p.add_argument("--nama", default="Tarina", help="Nama pencatat")

    excel_p = subparsers.add_parser("export-excel", help="Ekspor laporan kas format Excel (.xlsx)")
    excel_p.add_argument("-o", "--output", default="laporan_kas.xlsx", help="Nama file output")

    chart_p = subparsers.add_parser("export-chart", help="Ekspor infografis format PNG")
    chart_p.add_argument("-o", "--output", default="grafik_kas.png", help="Nama file output")

    web_p = subparsers.add_parser("web", help="Jalankan Web Dashboard (FastAPI + Jinja2)")
    web_p.add_argument("--host", default="127.0.0.1", help="Host bind")
    web_p.add_argument("--port", type=int, default=8000, help="Port bind")

    subparsers.add_parser("bot", help="Jalankan Telegram Bot (@kacekasbot) polling 24/7")

    all_p = subparsers.add_parser("all", help="Jalankan Web Dashboard + Telegram Bot secara bersamaan")
    all_p.add_argument("--host", default="127.0.0.1", help="Host bind")
    all_p.add_argument("--port", type=int, default=8000, help="Port bind")

    args = parser.parse_args()

    if args.subcommand == "status":
        cmd_status()
    elif args.subcommand == "seed":
        cmd_seed()
    elif args.subcommand == "verify":
        sys.exit(cmd_verify())
    elif args.subcommand == "backup":
        cmd_backup()
    elif args.subcommand == "set-pin":
        cmd_set_pin(args.pin)
    elif args.subcommand in ("tambah", "kurang"):
        from .formatters import parse_nominal, normalize_category
        db = get_db()
        amt = parse_nominal(args.nominal)
        if not amt:
            print(f"❌ Nominal '{args.nominal}' tidak valid.")
            sys.exit(1)
        cat = normalize_category(args.alokasi) or "operasional"
        tx_type = "in" if args.subcommand == "tambah" else "out"
        try:
            res = db.record_transaction(CLASS_ID, tx_type, amt, cat, args.keterangan, args.nama, 0)
        except ValueError as e:
            print(f"❌ {e}")
            sys.exit(1)
        sign = "+" if tx_type == "in" else "-"
        print(f"✅ Transaksi #{res['tx_id']} berhasil dicatat: {sign}{format_rupiah(res['amount'])} [{cat.upper()}] — Saldo Total: {format_rupiah(res['saldo_total'])}")
    elif args.subcommand == "export-excel":
        cmd_export_excel(args.output)
    elif args.subcommand == "export-chart":
        cmd_export_chart(args.output)
    elif args.subcommand == "web":
        cmd_web(args.host, args.port)
    elif args.subcommand == "bot":
        cmd_bot()
    elif args.subcommand == "all":
        cmd_all(args.host, args.port)
    else:
        cmd_status()


if __name__ == "__main__":
    main()

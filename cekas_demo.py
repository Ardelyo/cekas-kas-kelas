#!/usr/bin/env python3
"""
================================================================================
CEKAS (Catatan Keuangan Kelas) - Standalone Pure Python MVP Demonstration
Kelas XI-F2 SMA Kartika XIX-1 Bandung • Kelompok 5
================================================================================
Program demonstrasi mandiri (pure Python, tanpa web) yang mencakup seluruh
fitur keuangan kas kelas secara lokal, offline-first, dan interaktif.
"""

import sys
import os
import time
import argparse
from pathlib import Path
from datetime import datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Import core modules
from cekas_app.config import CLASS_ID, CLASS_NAME, SCHOOL_NAME, SCHOOL_YEAR, POCKET_CONFIG
from cekas_app.database import CekasDB
from cekas_app.formatters import format_rupiah, parse_nominal, parse_transaction_args, format_wib
from cekas_app.export_excel import generate_excel_report
from cekas_app.generate_chart import generate_financial_chart

# Terminal ANSI Color Helpers for clean presentation
BOLD = "\033[1m"
RESET = "\033[0m"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"
WHITE = "\033[97m"

def print_header():
    os.system("cls" if os.name == "nt" else "clear")
    print(f"{GREEN}{BOLD}" + "═" * 65 + f"{RESET}")
    print(f"{GREEN}{BOLD}   ✨ CEKAS (Catatan Keuangan Kelas XI-F2) ✨{RESET}")
    print(f"{WHITE}   {SCHOOL_NAME} • Tahun Ajaran {SCHOOL_YEAR}{RESET}")
    print(f"{CYAN}   Sistem Kas Digital Offline-First & Transparansi Keuangan{RESET}")
    print(f"{GREEN}{BOLD}" + "═" * 65 + f"{RESET}\n")

def render_pocket_bar(amount, total, width=20):
    if total <= 0 or amount <= 0:
        return "░" * width
    filled = min(round((amount / total) * width), width)
    return "█" * filled + "░" * (width - filled)

def show_status(db: CekasDB):
    info = db.get_or_create_class(CLASS_ID)
    saldo_total = info["saldo"]
    alokasi = info["alokasi"]

    print(f"{BOLD}📊 KONDISI KAS SAAT INI:{RESET}")
    print(f"💰 {BOLD}Total Saldo Kas :{RESET} {GREEN}{BOLD}{format_rupiah(saldo_total)}{RESET}")
    print("─" * 65)
    print(f"{BOLD}{'Pos Anggaran':<22} | {'Saldo':<14} | {'Porsi':<6} | Distribusi{RESET}")
    print("─" * 65)

    for k, meta in POCKET_CONFIG.items():
        p_saldo = alokasi.get(k, 0)
        pct = (p_saldo / saldo_total * 100) if saldo_total > 0 else 0
        bar = render_pocket_bar(p_saldo, saldo_total, width=15)
        label = f"{meta['icon']} {meta['label']}"
        print(f"{label:<22} | {format_rupiah(p_saldo):<14} | {pct:>5.1f}% | {bar}")

    print("─" * 65)
    print(f"🕒 {CYAN}Waktu Sinkronisasi: {format_wib()}{RESET}\n")

def record_income_flow(db: CekasDB, interactive=True, nominal_in="50k", pos_in="operasional", desc_in="Iuran kas kelas", by_in="Tarina"):
    print(f"{BOLD}📥 PENCATATAN KAS MASUK (PEMASUKAN){RESET}")
    if interactive:
        print("Format nominal mendukung: 10000, 10.000, 10k, 10rb, 1.5jt")
        nom_str = input("Masukkan nominal (contoh: 25k): ").strip()
        print("\nPilih Pos Anggaran:")
        print("  1. 🧹 Operasional & KBM")
        print("  2. 🤝 Sosial & Peduli")
        print("  3. 🎪 Acara & Kegiatan")
        print("  4. 🛡️ Dana Cadangan")
        pos_choice = input("Pilihan (1-4, default 1): ").strip()
        cat_map = {"1": "operasional", "2": "sosial", "3": "event", "4": "cadangan"}
        cat = cat_map.get(pos_choice, "operasional")
        desc = input("Keterangan pemasukan: ").strip() or "Iuran kas kelas"
        input_by = input("Nama pencatat: ").strip() or "Tarina"
    else:
        nom_str = nominal_in
        cat = pos_in
        desc = desc_in
        input_by = by_in

    amount = parse_nominal(nom_str)
    if not amount or amount <= 0:
        print(f"{RED}❌ Gagal: Nominal '{nom_str}' tidak valid.{RESET}\n")
        return

    res = db.record_transaction(CLASS_ID, "in", amount, cat, desc, input_by, 123456789)
    print(f"{GREEN}✅ BERHASIL DICATAT!{RESET}")
    print(f"   • Nominal       : {GREEN}+{format_rupiah(res['amount'])}{RESET}")
    print(f"   • Masuk ke Pos  : {POCKET_CONFIG[cat]['icon']} {POCKET_CONFIG[cat]['label']}")
    print(f"   • Keterangan    : {res['description']}")
    print(f"   • Saldo Baru    : {BOLD}{format_rupiah(res['saldo_total'])}{RESET}")
    print(f"   • ID Mutasi     : #{res['tx_id']}\n")

def record_expense_flow(db: CekasDB, interactive=True, nominal_in="30k", pos_in="operasional", desc_in="Beli spidol", by_in="Tarina"):
    print(f"{BOLD}📤 PENCATATAN PENGELUARAN (BELANJA KELAS){RESET}")
    if interactive:
        nom_str = input("Masukkan nominal (contoh: 35k): ").strip()
        print("\nPotong dari Pos Anggaran:")
        print("  1. 🧹 Operasional & KBM")
        print("  2. 🤝 Sosial & Peduli")
        print("  3. 🎪 Acara & Kegiatan")
        print("  4. 🛡️ Dana Cadangan")
        pos_choice = input("Pilihan (1-4, default 1): ").strip()
        cat_map = {"1": "operasional", "2": "sosial", "3": "event", "4": "cadangan"}
        cat = cat_map.get(pos_choice, "operasional")
        desc = input("Keterangan belanja: ").strip() or "Kebutuhan kelas"
        input_by = input("Nama pencatat: ").strip() or "Tarina"
    else:
        nom_str = nominal_in
        cat = pos_in
        desc = desc_in
        input_by = by_in

    amount = parse_nominal(nom_str)
    if not amount or amount <= 0:
        print(f"{RED}❌ Gagal: Nominal '{nom_str}' tidak valid.{RESET}\n")
        return

    res = db.record_transaction(CLASS_ID, "out", amount, cat, desc, input_by, 123456789)
    print(f"{YELLOW}✅ PENGELUARAN DICATAT!{RESET}")
    print(f"   • Nominal       : {RED}-{format_rupiah(res['amount'])}{RESET}")
    print(f"   • Dipotong dari : {POCKET_CONFIG[cat]['icon']} {POCKET_CONFIG[cat]['label']}")
    print(f"   • Keterangan    : {res['description']}")
    print(f"   • Saldo Baru    : {BOLD}{format_rupiah(res['saldo_total'])}{RESET}")
    print(f"   • ID Mutasi     : #{res['tx_id']}\n")

def view_dues_matrix(db: CekasDB, week_num=1):
    status = db.get_dues_status(CLASS_ID, week_num=week_num)
    all_students = db.get_all_whitelist_students(CLASS_ID)

    print(f"{BOLD}👥 STATUS IURAN KAS SISWA (MINGGU KE-{week_num}){RESET}")
    print(f"Target: Rp 10.000 / Siswa • Total Siswa: {status['total_students']} Orang")
    print(f"Lunas: {GREEN}{status['paid_count']}{RESET} | Belum Bayar: {RED}{status['unpaid_count']}{RESET} | Terkumpul: {BOLD}{status['percentage']}%{RESET}")
    print("─" * 65)

    paid_nis_set = {s["nis"] for s in status["paid_students"]}
    print(f"{'NIS':<10} | {'Nama Siswa':<30} | {'Status Kas':<15}")
    print("─" * 65)

    for s in all_students:
        if s["role"] == "wali_kelas":
            continue
        is_paid = s["nis"] in paid_nis_set
        badge = f"{GREEN}● LUNAS{RESET}" if is_paid else f"{RED}○ BELUM BAYAR{RESET}"
        print(f"{s['nis']:<10} | {s['nama_resmi']:<30} | {badge}")

    print("─" * 65 + "\n")

def pay_dues_flow(db: CekasDB, interactive=True, nis_in="23241001", week_in=1, by_in="Tarina"):
    print(f"{BOLD}💳 PEMBAYARAN IURAN SISWA{RESET}")
    if interactive:
        nis = input("Masukkan NIS Siswa (contoh: 23241001): ").strip()
        week_str = input("Iuran untuk Minggu ke (1-20, default 1): ").strip() or "1"
        try:
            week_num = int(week_str)
        except ValueError:
            week_num = 1
        recorded_by = input("Nama pencatat: ").strip() or "Tarina"
    else:
        nis = nis_in
        week_num = week_in
        recorded_by = by_in

    try:
        res = db.mark_dues_paid(CLASS_ID, nis, week_num, recorded_by, 123456789, auto_tx=True)
        print(f"{GREEN}✅ Pembayaran Iuran Berhasil Divalidasi!{RESET}")
        print(f"   • Siswa       : {res['nama']} (NIS: {res['nis']})")
        print(f"   • Minggu Ke   : {res['week_num']}")
        print(f"   • Nominal     : {format_rupiah(res['nominal'])}")
        print(f"   • ID Mutasi   : #{res['tx_id']}\n")
    except ValueError as e:
        print(f"{RED}❌ Gagal: {e}{RESET}\n")

def view_ledger(db: CekasDB, limit=15):
    txs = db.get_recent_transactions(CLASS_ID, limit=limit)
    print(f"{BOLD}📑 BUKU KAS UMUM & RIWAYAT MUTASI TERAKHIR{RESET}")
    print("─" * 75)
    print(f"{'ID':<5} | {'Waktu':<16} | {'Tipe':<8} | {'Pos':<12} | {'Nominal':<13} | {'Keterangan'}")
    print("─" * 75)

    if not txs:
        print(f"  {YELLOW}Belum ada mutasi tercatat.{RESET}")
    else:
        for t in txs:
            t_id = f"#{t['id']}"
            t_time = str(t['created_at'])[:16]
            if t['type'] == 'in':
                t_type = f"{GREEN}MASUK{RESET}"
                nom = f"{GREEN}+{format_rupiah(t['amount'])}{RESET}"
            elif t['type'] == 'out':
                t_type = f"{RED}KELUAR{RESET}"
                nom = f"{RED}-{format_rupiah(t['amount'])}{RESET}"
            else:
                t_type = f"{YELLOW}KOREKSI{RESET}"
                nom = f"{YELLOW}{format_rupiah(t['amount'])}{RESET}"

            pos = t['category'].capitalize()
            desc = t['description'][:25]
            print(f"{t_id:<5} | {t_time:<16} | {t_type:<17} | {pos:<12} | {nom:<22} | {desc}")

    print("─" * 75 + "\n")

def reverse_flow(db: CekasDB, interactive=True, tx_id_in=None, reason_in="Salah input manual"):
    print(f"{BOLD}↩️ KOREKSI & PEMBATALAN TRANSAKSI (APPEND-ONLY){RESET}")
    if interactive:
        id_str = input("Masukkan ID Transaksi yang ingin dibatalkan (contoh: 2): ").strip()
        try:
            tx_id = int(id_str)
        except ValueError:
            print(f"{RED}ID tidak valid.{RESET}\n")
            return
        reason = input("Alasan pembatalan/koreksi: ").strip() or "Salah input manual"
    else:
        tx_id = tx_id_in
        reason = reason_in

    try:
        res = db.reverse_transaction(CLASS_ID, tx_id, reason, "Tarina", 123456789)
        print(f"{GREEN}✅ Koreksi Berhasil Diterapkan!{RESET}")
        print(f"   • ID Mutasi Batal : #{res['reversed_tx_id']}")
        print(f"   • ID Koreksi Baru : #{res['correction_id']}")
        print(f"   • Saldo Dipulihkan: {BOLD}{format_rupiah(res['saldo_total'])}{RESET}\n")
    except ValueError as e:
        print(f"{RED}❌ Gagal: {e}{RESET}\n")

def export_files_flow(db: CekasDB):
    print(f"{BOLD}📂 EKSPOR LAPORAN RESMI & INFOGRAFIS{RESET}")
    excel_path = "Laporan_Kas_XI-F2.xlsx"
    chart_path = "Grafik_Kas_XI-F2.png"

    print("1. Membuat buku kas format Excel (.xlsx)...")
    stream_excel = generate_excel_report(db, CLASS_ID)
    with open(excel_path, "wb") as f:
        f.write(stream_excel.read())
    print(f"   {GREEN}✓ Excel tersimpan di:{RESET} {os.path.abspath(excel_path)}")

    print("2. Merender infografis visual format PNG...")
    stream_chart = generate_financial_chart(db, CLASS_ID)
    with open(chart_path, "wb") as f:
        f.write(stream_chart.read())
    print(f"   {GREEN}✓ Infografis tersimpan di:{RESET} {os.path.abspath(chart_path)}\n")

def run_automated_demonstration():
    """Runs a complete end-to-end simulation of CEKAS in pure Python."""
    print_header()
    print(f"{YELLOW}{BOLD}▶ MEMULAI SIMULASI DEMO LENGKAP KAS KELAS XI-F2 (PURE PYTHON){RESET}\n")

    # 1. In-memory isolated DB for demo
    db = CekasDB(":memory:")
    db.get_or_create_class(CLASS_ID)
    db.seed_initial_students(CLASS_ID)
    print(f"{CYAN}[Langkah 1/6]{RESET} Database lokal SQLite WAL diinisialisasi & 34 siswa didaftarkan ke whitelist.")
    time.sleep(1)

    # 2. Initial status
    print(f"\n{CYAN}[Langkah 2/6]{RESET} Kondisi Awal Kas Kelas:")
    show_status(db)
    time.sleep(1)

    # 3. Add incomes
    print(f"{CYAN}[Langkah 3/6]{RESET} Mencatat Pemasukan Kas:")
    record_income_flow(db, interactive=False, nominal_in="340k", pos_in="operasional", desc_in="Iuran kas kelas minggu 1", by_in="Tarina")
    record_income_flow(db, interactive=False, nominal_in="100k", pos_in="sosial", desc_in="Donasi kas peduli sosial", by_in="Tarina")
    record_income_flow(db, interactive=False, nominal_in="150k", pos_in="event", desc_in="Kas tabungan class meeting", by_in="Tarina")
    time.sleep(1)

    # 4. Add expenses
    print(f"{CYAN}[Langkah 4/6]{RESET} Mencatat Pengeluaran Belanja Kelas:")
    record_expense_flow(db, interactive=False, nominal_in="35k", pos_in="operasional", desc_in="Beli spidol whiteboard & penghapus", by_in="Tarina")
    record_expense_flow(db, interactive=False, nominal_in="50k", pos_in="sosial", desc_in="Jenguk teman sakit di RS", by_in="Tarina")
    time.sleep(1)

    # 5. Dues payment
    print(f"{CYAN}[Langkah 5/6]{RESET} Mencatat Pembayaran Iuran Siswa (Ardellio & Budi):")
    pay_dues_flow(db, interactive=False, nis_in="23241001", week_in=1, by_in="Tarina")
    pay_dues_flow(db, interactive=False, nis_in="23241005", week_in=1, by_in="Tarina")
    time.sleep(1)

    # 6. Append-only reversal
    print(f"{CYAN}[Langkah 6/6]{RESET} Menguji Audit Trail & Koreksi Transaksi:")
    print("Skenario: Transaksi #5 salah catat nominal. Lakukan pembatalan aman append-only:")
    reverse_flow(db, interactive=False, tx_id_in=5, reason_in="Nota salah hitung kasir")
    time.sleep(1)

    # Summary
    print(f"\n{GREEN}{BOLD}═══════════════════════════════════════════════════════════════{RESET}")
    print(f"{GREEN}{BOLD}🎉 HASIL AKHIR DEMONSTRASI KAS KELAS:{RESET}")
    print(f"{GREEN}{BOLD}═══════════════════════════════════════════════════════════════{RESET}")
    show_status(db)
    view_ledger(db, limit=8)
    export_files_flow(db)

    print(f"{GREEN}{BOLD}✅ DEMO SELESAI DENGAN SUKSES!{RESET}")
    print(f"Semua fitur berjalan 100% lokal di Python tanpa ketergantungan web maupun internet.\n")

def run_interactive_menu():
    db = CekasDB("cekas.db")
    db.get_or_create_class(CLASS_ID)
    db.seed_initial_students(CLASS_ID)

    while True:
        print_header()
        show_status(db)

        print(f"{BOLD}MENU UTAMA CEKAS:{RESET}")
        print("  1. 📥 Catat Pemasukan Kas")
        print("  2. 📤 Catat Pengeluaran Kas")
        print("  3. 👥 Cek Iuran Kas Siswa (Siapa Belum Bayar)")
        print("  4. 💳 Bayar Iuran Siswa")
        print("  5. 📑 Lihat Buku Kas & Riwayat Mutasi")
        print("  6. ↩️ Koreksi / Batalkan Transaksi (Append-Only)")
        print("  7. 📊 Ekspor Excel (.xlsx) & Infografis (.png)")
        print("  8. 🚀 Jalankan Simulasi Demo Otomatis")
        print("  9. 🚪 Keluar")
        print("─" * 65)

        pilihan = input("Pilih menu (1-9): ").strip()
        print()

        if pilihan == "1":
            record_income_flow(db, interactive=True)
            input("Tekan Enter untuk kembali ke menu...")
        elif pilihan == "2":
            record_expense_flow(db, interactive=True)
            input("Tekan Enter untuk kembali ke menu...")
        elif pilihan == "3":
            w = input("Cek iuran untuk minggu ke (1-20, default 1): ").strip() or "1"
            try:
                view_dues_matrix(db, week_num=int(w))
            except ValueError:
                view_dues_matrix(db, week_num=1)
            input("Tekan Enter untuk kembali ke menu...")
        elif pilihan == "4":
            pay_dues_flow(db, interactive=True)
            input("Tekan Enter untuk kembali ke menu...")
        elif pilihan == "5":
            view_ledger(db)
            input("Tekan Enter untuk kembali ke menu...")
        elif pilihan == "6":
            reverse_flow(db, interactive=True)
            input("Tekan Enter untuk kembali ke menu...")
        elif pilihan == "7":
            export_files_flow(db)
            input("Tekan Enter untuk kembali ke menu...")
        elif pilihan == "8":
            run_automated_demonstration()
            input("Tekan Enter untuk kembali ke menu...")
        elif pilihan == "9" or pilihan.lower() == "q":
            print("Terima kasih telah menggunakan CEKAS! 👋")
            break

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CEKAS Pure Python Demonstration")
    parser.add_argument("--demo", action="store_true", help="Jalankan simulasi otomatis")
    args = parser.parse_args()

    if args.demo:
        run_automated_demonstration()
    else:
        # If in terminal without interactive stdin or requested, default to demo
        if not sys.stdin.isatty():
            run_automated_demonstration()
        else:
            run_interactive_menu()

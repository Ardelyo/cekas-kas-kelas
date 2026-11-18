"""
Seed data contoh setahun untuk CEKAS: iuran Rp 5.000 per siswa per minggu sejak minggu pertama Januari sampai hari ini,
lengkap dengan yang belum bayar, nunggak, bayar telat, pengeluaran, usulan yang disetujui, satu koreksi, dan
beberapa pengajuan yang masih menunggu Wali Kelas.

Semua baris masuk lewat fungsi inti database (rantai hash SHA-256 tetap sah, saldo cache cocok dengan ledger);
hanya cap waktunya yang dimundurkan. Deterministik (seed tetap), jadi hasilnya sama setiap dijalankan.

Pemakaian (MENIMPA transaksi/iuran/usulan kelas di database tujuan; roster siswa tidak diubah):
    python -m cekas_app.seed_demo --db cekas.db --yes
    python -m cekas_app.seed_demo --db cekas.db --start 2026-01-05 --today 2026-11-18 --yes
"""

import argparse
import json
import random
from datetime import date, datetime, timedelta, timezone

from . import database as dbmod
from .config import CLASS_ID, POCKET_CONFIG

NOMINAL = 5000
BENDAHARA = "Bendahara (Web)"
WALI = "Wali Kelas (Web)"
SUFFIX = f" ✓ {WALI}"

# (tanggal, tipe, pos, nominal, keterangan)  tipe: in | out. Pengeluaran >= 50.000 dibuat sebagai usulan yang disetujui.
EVENTS = [
    ("2026-01-05", "in", "operasional", 150000, "Saldo awal kas semester"),
    ("2026-01-05", "in", "cadangan", 300000, "Dana cadangan awal"),
    ("2026-01-05", "in", "sosial", 360000, "Iuran sosial semester 1"),
    ("2026-01-14", "out", "operasional", 45000, "Beli spidol dan penghapus"),
    ("2026-01-28", "out", "operasional", 65000, "Fotokopi soal latihan"),
    ("2026-02-11", "out", "operasional", 80000, "Beli sapu dan pel"),
    ("2026-02-25", "out", "sosial", 150000, "Jenguk teman sakit"),
    ("2026-03-07", "in", "event", 300000, "Hadiah lomba kebersihan antarkelas"),
    ("2026-03-11", "out", "event", 120000, "Konsumsi lomba kebersihan"),
    ("2026-02-18", "out", "operasional", 320000, "Dispenser air kelas"),
    ("2026-03-18", "out", "operasional", 450000, "Cat dinding kelas"),
    ("2026-04-08", "out", "operasional", 35000, "Cetak denah piket"),
    ("2026-04-22", "out", "operasional", 380000, "Kipas angin baru"),
    ("2026-05-06", "out", "operasional", 40000, "Kapur dan spidol"),
    ("2026-05-20", "out", "sosial", 200000, "Sumbangan duka teman sekelas"),
    ("2026-05-27", "out", "operasional", 1150000, "Proyektor mini untuk kelas"),
    ("2026-06-03", "out", "operasional", 85000, "Fotokopi modul ujian akhir"),
    ("2026-06-17", "out", "event", 75000, "Kado ulang tahun Wali Kelas"),
    ("2026-07-20", "in", "sosial", 360000, "Iuran sosial semester 2"),
    ("2026-07-29", "out", "operasional", 520000, "Printer kelas bekas"),
    ("2026-08-12", "in", "event", 450000, "Hasil bazar 17 Agustus"),
    ("2026-08-14", "out", "event", 260000, "Dekorasi dan hadiah lomba 17 Agustus"),
    ("2026-08-26", "out", "operasional", 480000, "Karpet dan rak sepatu kelas"),
    ("2026-09-09", "out", "operasional", 55000, "Tinta printer"),
    ("2026-09-23", "out", "sosial", 150000, "Jenguk teman sakit"),
    ("2026-10-07", "out", "operasional", 275000, "Perbaikan papan tulis"),
    ("2026-10-14", "out", "operasional", 650000, "Kursi dan meja cadangan"),
    ("2026-10-28", "in", "event", 250000, "Sponsor class meeting"),
    ("2026-10-30", "out", "event", 230000, "Konsumsi dan hadiah class meeting"),
    ("2026-11-04", "out", "operasional", 60000, "Fotokopi soal try out"),
    ("2026-11-11", "out", "cadangan", 100000, "Alat kebersihan darurat"),
]
DUP_FOTOKOPI = ("2026-01-28", "Fotokopi soal latihan")  # dicatat dobel lalu dikoreksi keesokan harinya


def _wib(d: date, hour: int, minute: int) -> str:
    """Cap waktu UTC (format database) dari jam dinding WIB."""
    local = datetime(d.year, d.month, d.day, hour, minute, tzinfo=timezone(timedelta(hours=7)))
    return local.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def build(db, start: date, today: date, seed: int = 2026) -> dict:
    rng = random.Random(seed)
    students = [s for s in db.get_all_whitelist_students(CLASS_ID) if s["role"] != "wali_kelas"]
    if not students:
        raise SystemExit("Roster siswa kosong; isi whitelist dulu.")
    n = len(students)
    cur_week = (today - start).days // 7 + 1
    if cur_week > 52:
        raise SystemExit("Rentang lebih dari 52 minggu tidak didukung aplikasi.")

    # ---- profil kebiasaan bayar
    order = list(range(n))
    rng.shuffle(order)
    n_tunggak, n_telat, n_biasa = max(2, n // 12), max(3, n // 7), max(6, n // 4)
    profile = {}
    for k, i in enumerate(order):
        profile[i] = ("penunggak" if k < n_tunggak else "sering telat" if k < n_tunggak + n_telat
                      else "biasa" if k < n_tunggak + n_telat + n_biasa else "rajin")
    p_pay = {"rajin": .97, "biasa": .88, "sering telat": .72, "penunggak": .38}
    p_late = {"rajin": .5, "biasa": .5, "sering telat": .6, "penunggak": .2}  # peluang minggu terlewat dilunasi belakangan

    # ---- iuran: (waktu, nis, minggu)
    dues = []
    paid_weeks = {s["nis"]: set() for s in students}
    for w in range(1, cur_week):  # minggu berjalan diisi terpisah
        monday = start + timedelta(days=7 * (w - 1))
        for i, s in enumerate(students):
            prof = profile[i]
            if rng.random() < p_pay[prof]:
                day = monday + timedelta(days=rng.choice([0, 1, 1, 2, 2, 3, 4]))
                dues.append((_wib(day, rng.randint(7, 15), rng.randint(0, 59)), s["nis"], w))
                paid_weeks[s["nis"]].add(w)
            elif w < cur_week - 1 and rng.random() < p_late[prof]:
                lag = rng.randint(1, 4)
                later = min(cur_week - 1, w + lag)
                day = start + timedelta(days=7 * (later - 1) + rng.randint(0, 4))
                dues.append((_wib(day, rng.randint(7, 15), rng.randint(0, 59)), s["nis"], w))
                paid_weeks[s["nis"]].add(w)

    # minggu berjalan: sebagian sudah disahkan, sebagian menunggu Wali Kelas, sisanya belum bayar
    monday = start + timedelta(days=7 * (cur_week - 1))
    this_week = [i for i in range(n) if rng.random() < {"rajin": .85, "biasa": .65, "sering telat": .4, "penunggak": .1}[profile[i]]]
    pending_idx = this_week[:max(0, min(6, len(this_week) // 4))]
    verified_idx = [i for i in this_week if i not in pending_idx]
    for i in verified_idx:
        day = monday + timedelta(days=rng.choice([0, 0, 1, 2]))
        day = min(day, today)
        dues.append((_wib(day, rng.randint(7, 13), rng.randint(0, 59)), students[i]["nis"], cur_week))
        paid_weeks[students[i]["nis"]].add(cur_week)

    # ---- gabung dengan kejadian lain, urut waktu (id ledger harus mengikuti waktu agar rantai hash sah)
    timeline = []
    for ts, nis, w in dues:
        timeline.append((ts, 1, "dues", (nis, w)))
    for k, (d, typ, cat, amt, desc) in enumerate(EVENTS):
        dd = date.fromisoformat(d)
        if dd <= today:
            timeline.append((_wib(dd, 10 + (k % 4), 5 + (k * 7) % 50), 0 if typ == "in" else 2, "tx", (typ, cat, amt, desc)))
    timeline.sort(key=lambda e: (e[0], e[1]))

    # ---- tulis
    with db._lock, db.conn:
        cur = db.conn.cursor()
        for t in ("transactions", "weekly_dues", "pending_tx", "proposals"):
            cur.execute(f"DELETE FROM {t} WHERE class_id = ?", (CLASS_ID,))
        for t in ("proposal_votes", "processed_messages", "pin_attempts"):
            cur.execute(f"DELETE FROM {t}")
        cur.execute("DELETE FROM sqlite_sequence WHERE name IN ('transactions','pending_tx','proposals')")
        zero = {k: 0 for k in POCKET_CONFIG}
        cur.execute("UPDATE classes SET saldo = 0, alokasi = ?, nominal_iuran = ? WHERE id = ?", (json.dumps(zero), NOMINAL, CLASS_ID))

    real_now = dbmod._utc_now_str
    by_nis = {s["nis"]: s for s in students}
    prop_no = 0
    dup_done = False
    try:
        for ts, _, kind, data in timeline:
            dbmod._utc_now_str = lambda ts=ts: ts
            with db._lock, db.conn:
                cur = db.conn.cursor()
                if kind == "dues":
                    nis, w = data
                    db._dues_core(cur, CLASS_ID, nis, w, BENDAHARA, 0, by_nis[nis], NOMINAL, suffix=SUFFIX)
                    cur.execute("UPDATE weekly_dues SET paid_at = ? WHERE class_id = ? AND nis = ? AND week_num = ?", (ts, CLASS_ID, nis, w))
                else:
                    typ, cat, amt, desc = data
                    note = ""
                    if typ == "out" and amt >= 50000:
                        prop_no += 1
                        voters = rng.sample(students, 3)
                        cur.execute(
                            """INSERT INTO proposals (class_id, amount, category, description, proposed_by, proposer_tg, status,
                                                      needed, created_at, decided_at, note)
                               VALUES (?, ?, ?, ?, ?, 0, 'approved', 3, ?, ?, 'Disetujui 3 siswa')""",
                            (CLASS_ID, amt, cat, desc, BENDAHARA, _shift(ts, hours=-30), ts))
                        pid = cur.lastrowid
                        for k, v in enumerate(voters):
                            cur.execute("INSERT INTO proposal_votes (proposal_id, telegram_id, voter_name, vote, voted_at) VALUES (?, ?, ?, 'yes', ?)",
                                        (pid, 9_000_000 + int(v["nis"][-4:]), v["nama_resmi"], _shift(ts, hours=-24 + 6 * k)))
                        note = f" (usulan #{pid}, disetujui 3 siswa)"
                    res = db._apply_tx(cur, CLASS_ID, typ, amt, cat, (desc[:200 - len(note) - len(SUFFIX)] + note + SUFFIX), BENDAHARA, 0)
                    if typ == "out" and amt >= 50000:
                        cur.execute("UPDATE proposals SET tx_id = ? WHERE id = ?", (res["tx_id"], pid))
                    if (d := (DUP_FOTOKOPI[1] == desc)) and not dup_done:
                        dup_done = True
                        res2 = db._apply_tx(cur, CLASS_ID, typ, amt, cat, desc + " (dobel)" + SUFFIX, BENDAHARA, 0)
                        dupe = res2["tx_id"]
        if dup_done:
            nxt = date.fromisoformat(DUP_FOTOKOPI[0]) + timedelta(days=1)
            dbmod._utc_now_str = lambda: _wib(nxt, 9, 20)
            with db._lock, db.conn:
                db._reverse_core(db.conn.cursor(), CLASS_ID, dupe, "Tercatat dobel", BENDAHARA, 0, suffix=SUFFIX)
    finally:
        dbmod._utc_now_str = real_now

    # ---- pengajuan yang masih menunggu Wali Kelas (waktu nyata sekarang)
    for i in pending_idx:
        dbmod._utc_now_str = lambda ts=_wib(min(today, monday + timedelta(days=2)), 9, 0): ts
        try:
            db.submit_dues(CLASS_ID, students[i]["nis"], cur_week, BENDAHARA, 0)
        finally:
            dbmod._utc_now_str = real_now
    if today >= date(2026, 11, 16):
        dbmod._utc_now_str = lambda: _wib(today, 8, 40)
        try:
            db.submit_transaction(CLASS_ID, "out", 28000, "operasional", "Beli kapur dan penghapus", BENDAHARA, 0)
        finally:
            dbmod._utc_now_str = real_now

    # ---- ringkasan
    ok = db.verify_ledger(CLASS_ID)
    cls = db.get_or_create_class(CLASS_ID)
    rows = []
    for i, s in enumerate(students):
        missed = [w for w in range(1, cur_week) if w not in paid_weeks[s["nis"]]]
        rows.append((s["nama_resmi"], profile[i], len(paid_weeks[s["nis"]]), len(missed), len(missed) * NOMINAL))
    return {"cur_week": cur_week, "students": n, "saldo": cls["saldo"], "alokasi": cls["alokasi"], "ledger_ok": ok["ok"],
            "errors": ok.get("errors", [])[:3], "tx_count": ok.get("tx_count"), "pending": len(pending_idx) + 1,
            "this_week_paid": len(verified_idx), "rows": rows}


def _shift(ts: str, hours: int) -> str:
    return (datetime.strptime(ts, "%Y-%m-%d %H:%M:%S") + timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M:%S")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", required=True)
    ap.add_argument("--start", default="2026-01-05", help="Senin minggu ke-1 (YYYY-MM-DD)")
    ap.add_argument("--today", default=date.today().isoformat())
    ap.add_argument("--yes", action="store_true", help="Setuju menimpa transaksi/iuran di database tujuan")
    a = ap.parse_args()
    if not a.yes:
        raise SystemExit("Perintah ini MENIMPA transaksi dan iuran kelas. Tambahkan --yes bila sudah yakin.")
    db = dbmod.CekasDB(a.db)
    db.get_or_create_class(CLASS_ID)
    r = build(db, date.fromisoformat(a.start), date.fromisoformat(a.today))
    print(f"Minggu berjalan: {r['cur_week']} · siswa: {r['students']} · saldo: Rp {r['saldo']:,} · transaksi: {r['tx_count']}")
    print(f"Buku kas sah: {r['ledger_ok']} {r['errors']} · menunggu Wali Kelas: {r['pending']} · lunas minggu ini: {r['this_week_paid']}")
    print("Alokasi:", r["alokasi"])
    for name, prof, paid, missed, arrears in sorted(r["rows"], key=lambda x: -x[4])[:8]:
        print(f"  {name:28s} {prof:13s} lunas {paid:2d} minggu · belum bayar {missed:2d} · tunggakan Rp {arrears:,}")


if __name__ == "__main__":
    main()

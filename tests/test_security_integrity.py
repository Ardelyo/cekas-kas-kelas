"""Regression test untuk bug keamanan & integritas yang ditemukan saat audit."""
import unittest

from cekas_app.database import CekasDB
from cekas_app.formatters import parse_nominal, parse_transaction_args, utc_to_wib

C = "XI-F2"


def fresh_db() -> CekasDB:
    db = CekasDB(":memory:")
    db.get_or_create_class(C)
    db.set_pin(C, "482915")
    db.seed_initial_students(C)
    return db


class TestAuthAndRoles(unittest.TestCase):
    def test_nis_bendahara_tidak_memberi_hak_bendahara(self):
        db = fresh_db()
        r = db.register_member(C, 999, "23241015", "penyusup")  # NIS Tarina
        self.assertTrue(r["success"])
        self.assertEqual(r["role"], "siswa")
        self.assertFalse(db.is_bendahara(999))

    def test_nis_hanya_bisa_diikat_satu_akun(self):
        db = fresh_db()
        self.assertTrue(db.register_member(C, 1, "23241001")["success"])
        self.assertFalse(db.register_member(C, 2, "23241001")["success"])
        self.assertTrue(db.register_member(C, 1, "23241001")["success"])  # akun sama boleh ulang
        self.assertTrue(db.release_nis(C, "23241001"))
        self.assertTrue(db.register_member(C, 2, "23241001")["success"])

    def test_daftar_ulang_tidak_menurunkan_bendahara(self):
        db = fresh_db()
        db.register_member(C, 7, "23241001")
        self.assertTrue(db.claim_bendahara(C, 7, "482915")["success"])
        db.register_member(C, 7, "23241001")
        self.assertTrue(db.is_bendahara(7))

    def test_pin_benar_dan_salah(self):
        db = fresh_db()
        self.assertFalse(db.claim_bendahara(C, 5, "000000")["success"])
        self.assertTrue(db.claim_bendahara(C, 5, "482915")["success"])
        self.assertTrue(db.is_bendahara(5))

    def test_pin_lockout_setelah_5_gagal(self):
        db = fresh_db()
        t = 1_000_000.0
        for i in range(5):
            self.assertFalse(db.claim_bendahara(C, 6, f"00000{i}", now=t)["success"])
        # PIN benar pun ditolak selama dikunci
        r = db.claim_bendahara(C, 6, "482915", now=t + 60)
        self.assertFalse(r["success"])
        self.assertIn("menit", r["error"])
        # setelah masa kunci habis boleh lagi
        self.assertTrue(db.claim_bendahara(C, 6, "482915", now=t + 16 * 60)["success"])

    def test_pin_disimpan_sebagai_hash(self):
        db = fresh_db()
        stored = db.conn.execute("SELECT pin_bendahara FROM classes").fetchone()[0]
        self.assertTrue(stored.startswith("pbkdf2$"))
        self.assertNotIn("482915", stored)

    def test_migrasi_pin_plaintext_lama(self):
        db = fresh_db()
        with db.conn:
            db.conn.execute("UPDATE classes SET pin_bendahara = '777888' WHERE id = ?", (C,))
        db.get_or_create_class(C)  # memicu migrasi
        self.assertTrue(db.conn.execute("SELECT pin_bendahara FROM classes").fetchone()[0].startswith("pbkdf2$"))
        self.assertTrue(db.claim_bendahara(C, 8, "777888")["success"])

    def test_pin_pendek_ditolak(self):
        with self.assertRaises(ValueError):
            fresh_db().set_pin(C, "123")


class TestMoneyIntegrity(unittest.TestCase):
    def test_tidak_boleh_overdraft_per_pos(self):
        db = fresh_db()
        db.record_transaction(C, "in", 10000, "operasional", "x", "T", 1)
        with self.assertRaises(ValueError):
            db.record_transaction(C, "out", 500000, "sosial", "boros", "T", 1)
        with self.assertRaises(ValueError):  # saldo total cukup, tapi pos tidak
            db.record_transaction(C, "out", 5000, "sosial", "salah pos", "T", 1)
        self.assertEqual(db.get_or_create_class(C)["saldo"], 10000)

    def test_koreksi_iuran_membuka_kembali_status_lunas(self):
        db = fresh_db()
        d = db.mark_dues_paid(C, "23241001", 1, "T", 1)
        db.reverse_transaction(C, d["tx_id"], "salah orang", "T", 1)
        self.assertEqual(db.get_or_create_class(C)["saldo"], 0)
        self.assertFalse(db.get_student_dues_history(C, "23241001", 1)[0]["is_paid"])
        # bisa dibayar ulang
        self.assertEqual(db.mark_dues_paid(C, "23241001", 1, "T", 1)["saldo_total"], 10000)

    def test_bayar_iuran_atomik_saat_gagal(self):
        db = fresh_db()
        original = db._apply_tx

        def boom(*a, **k):
            original(*a, **k)
            raise RuntimeError("gagal setelah tx dicatat")

        db._apply_tx = boom
        with self.assertRaises(RuntimeError):
            db.mark_dues_paid(C, "23241001", 1, "T", 1)
        db._apply_tx = original
        self.assertEqual(db.get_or_create_class(C)["saldo"], 0)
        self.assertEqual(db.get_recent_transactions(C), [])
        self.assertFalse(db.get_student_dues_history(C, "23241001", 1)[0]["is_paid"])

    def test_bayar_dua_kali_ditolak_dan_wali_kelas_bebas_iuran(self):
        db = fresh_db()
        db.mark_dues_paid(C, "23241001", 1, "T", 1)
        with self.assertRaises(ValueError):
            db.mark_dues_paid(C, "23241001", 1, "T", 1)
        with self.assertRaises(ValueError):
            db.mark_dues_paid(C, "23241034", 1, "T", 1)

    def test_nominal_harus_integer_positif(self):
        db = fresh_db()
        for bad in (0, -5, 10.5):
            with self.assertRaises(ValueError):
                db.record_transaction(C, "in", bad, "operasional", "x", "T", 1)

    def test_idempotency_atomik(self):
        db = fresh_db()
        self.assertTrue(db.check_and_mark_message("a:1"))
        self.assertFalse(db.check_and_mark_message("a:1"))


class TestLedgerVerification(unittest.TestCase):
    def _populated(self):
        db = fresh_db()
        db.record_transaction(C, "in", 100000, "operasional", "kas", "T", 1)
        t2 = db.record_transaction(C, "out", 30000, "operasional", "spidol", "T", 1)
        db.mark_dues_paid(C, "23241001", 1, "T", 1)
        db.reverse_transaction(C, t2["tx_id"], "salah", "T", 1)
        return db

    def test_ledger_bersih_lolos(self):
        v = self._populated().verify_ledger(C)
        self.assertTrue(v["ok"], v["errors"])
        self.assertEqual(v["computed_saldo"], 110000)

    def test_ubah_nominal_terdeteksi(self):
        db = self._populated()
        with db.conn:
            db.conn.execute("UPDATE transactions SET amount = 1 WHERE id = 2")
        v = db.verify_ledger(C)
        self.assertFalse(v["ok"])
        self.assertTrue(any("#2" in e for e in v["errors"]))

    def test_hapus_transaksi_terdeteksi(self):
        db = self._populated()
        with db.conn:
            db.conn.execute("DELETE FROM transactions WHERE id = 2")
        self.assertFalse(db.verify_ledger(C)["ok"])

    def test_saldo_cache_dimanipulasi_terdeteksi(self):
        db = self._populated()
        with db.conn:
            db.conn.execute("UPDATE classes SET saldo = saldo + 50000")
        v = db.verify_ledger(C)
        self.assertFalse(v["ok"])
        self.assertTrue(any("Saldo tersimpan" in e for e in v["errors"]))

    def test_data_lama_tanpa_hash_tidak_dianggap_rusak(self):
        db = fresh_db()
        db.record_transaction(C, "in", 5000, "operasional", "lama", "T", 1)
        with db.conn:
            db.conn.execute("UPDATE transactions SET hash = NULL, prev_hash = NULL")
        db.record_transaction(C, "in", 5000, "operasional", "baru", "T", 1)
        v = db.verify_ledger(C)
        self.assertTrue(v["ok"], v["errors"])
        self.assertEqual(v["legacy_unhashed"], 1)


class TestParsers(unittest.TestCase):
    def test_nominal_valid(self):
        for s, want in [("10000", 10000), ("10.000", 10000), ("Rp 10.000", 10000), ("Rp1.500.000", 1500000),
                        ("10k", 10000), ("20K", 20000), ("15rb", 15000), ("1.5jt", 1500000), ("2,5k", 2500)]:
            self.assertEqual(parse_nominal(s), want, s)

    def test_nominal_ambigu_atau_aneh_ditolak(self):
        for s in ("1.5", "10.50", "0", "-5000", "abc", "", None, "1.000.000.000", "5000jt"):
            self.assertIsNone(parse_nominal(s), s)

    def test_kata_umum_tidak_tertelan_jadi_kategori(self):
        r = parse_transaction_args("10k sakit Budi")
        self.assertEqual((r["category"], r["description"]), ("operasional", "sakit Budi"))
        r = parse_transaction_args("5k lainnya parkir")
        self.assertEqual(r["description"], "lainnya parkir")
        r = parse_transaction_args("10k sosial jenguk Budi")
        self.assertEqual((r["category"], r["description"]), ("sosial", "jenguk Budi"))

    def test_waktu_utc_ke_wib(self):
        self.assertEqual(utc_to_wib("2026-11-04 05:45:30"), "04/11/2026 12:45")


class TestBackup(unittest.TestCase):
    def test_backup_membuat_salinan_valid(self):
        import os, sqlite3, tempfile
        d = tempfile.mkdtemp()
        db = CekasDB(os.path.join(d, "x.db"))
        db.get_or_create_class(C)
        db.record_transaction(C, "in", 1000, "operasional", "x", "T", 1)
        path = db.backup()
        n = sqlite3.connect(path).execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        self.assertEqual(n, 1)


if __name__ == "__main__":
    unittest.main()

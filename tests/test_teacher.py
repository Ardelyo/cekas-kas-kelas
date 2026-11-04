"""Verifikasi Wali Kelas: transaksi ditahan sampai guru setuju; iuran diverifikasi per minggu."""
import unittest

from cekas_app.database import CekasDB

C = "XI-F2"
BEND, WALI, S1, S2 = 10, 20, 31, 32


def teacher_db(members=3) -> CekasDB:
    db = CekasDB(":memory:")
    db.require_teacher = True
    db.get_or_create_class(C)
    db.set_pin(C, "482915")
    db.set_wali_pin(C, "739104")
    db.seed_initial_students(C)
    for i in range(members):
        db.register_member(C, 100 + i, f"2324100{i + 1}", f"u{i}")
    db.claim_bendahara(C, BEND, "482915", "Tarina")
    assert db.claim_wali(C, WALI, "739104", "Bu Rina")["success"]
    return db


def saldo(db):
    return db.get_or_create_class(C)["saldo"]


class TestWaliRole(unittest.TestCase):
    def test_hanya_pin_wali_membuat_wali(self):
        db = teacher_db()
        self.assertTrue(db.is_wali(WALI))
        self.assertFalse(db.claim_wali(C, 99, "482915", "Penyusup")["success"])   # PIN bendahara bukan PIN wali
        self.assertFalse(db.claim_wali(C, 99, "000000", "Penyusup")["success"])
        self.assertFalse(db.is_wali(99))

    def test_wali_tidak_dianggap_bendahara_dan_sebaliknya(self):
        db = teacher_db()
        self.assertFalse(db.is_bendahara(WALI))
        self.assertFalse(db.is_wali(BEND))

    def test_pin_wali_belum_diatur(self):
        from unittest import mock
        with mock.patch("cekas_app.database.PIN_WALI", ""):   # lingkungan tes mengisi PIN_WALI; kosongkan
            db = CekasDB(":memory:"); db.get_or_create_class(C)
            r = db.claim_wali(C, 5, "123456", "X")
        self.assertFalse(r["success"])
        self.assertIn("belum diatur", r["error"])

    def test_peran_wali_dipertahankan_saat_daftar_ulang(self):
        db = teacher_db()
        db.register_member(C, 100, "23241001", "u")
        db.claim_wali(C, 100, "739104")
        db.register_member(C, 100, "23241001", "u")
        self.assertTrue(db.is_wali(100))

    def test_wali_bukan_pemilih_usulan(self):
        db = teacher_db()
        self.assertNotIn(WALI, db.get_voter_ids(C, 0))


class TestPemasukanDanPengeluaran(unittest.TestCase):
    def test_pemasukan_ditahan_lalu_dicatat_setelah_guru_setuju(self):
        db = teacher_db()
        r = db.submit_transaction(C, "in", 100000, "operasional", "dana awal", "Tarina", BEND)
        self.assertTrue(r["pending"])
        self.assertEqual(saldo(db), 0)                           # belum berubah
        self.assertEqual(db.get_recent_transactions(C), [])
        v = db.verify_pending(r["pending_id"], WALI, "Bu Rina")
        self.assertEqual(v["status"], "verified")
        self.assertEqual(saldo(db), 100000)
        tx = db.get_recent_transactions(C, 1)[0]
        self.assertIn("✓ Bu Rina", tx["description"])             # nama guru ikut terkunci di hash
        self.assertTrue(db.verify_ledger(C)["ok"])

    def test_bendahara_tidak_bisa_verifikasi_sendiri(self):
        db = teacher_db()
        r = db.submit_transaction(C, "in", 50000, "operasional", "x", "Tarina", BEND)
        for who in (BEND, 100, 999):
            with self.assertRaises(ValueError):
                db.verify_pending(r["pending_id"], who, "Palsu")
        self.assertEqual(saldo(db), 0)

    def test_pengeluaran_dicek_saldo_dan_tidak_dijanjikan_dua_kali(self):
        db = teacher_db()
        db.verify_pending(db.submit_transaction(C, "in", 30000, "sosial", "dana", "T", BEND)["pending_id"], WALI, "Bu Rina")
        a = db.submit_transaction(C, "out", 20000, "sosial", "jenguk", "T", BEND)
        with self.assertRaises(ValueError):                      # 20k sudah tertahan; sisa hanya 10k
            db.submit_transaction(C, "out", 20000, "sosial", "lagi", "T", BEND)
        self.assertEqual(db.verify_pending(a["pending_id"], WALI, "Bu Rina")["status"], "verified")
        self.assertEqual(saldo(db), 10000)

    def test_gagal_bila_saldo_berubah_sebelum_disetujui(self):
        db = teacher_db()
        db.verify_pending(db.submit_transaction(C, "in", 50000, "event", "dana", "T", BEND)["pending_id"], WALI, "Bu Rina")
        a = db.submit_transaction(C, "out", 40000, "event", "a", "T", BEND)
        db.require_teacher = False
        db.record_transaction(C, "out", 40000, "event", "bocor langsung", "T", BEND)   # jalur di luar antrean
        db.require_teacher = True
        v = db.verify_pending(a["pending_id"], WALI, "Bu Rina")
        self.assertEqual(v["status"], "failed")
        self.assertEqual(saldo(db), 10000)

    def test_tolak_dan_batal(self):
        db = teacher_db()
        a = db.submit_transaction(C, "in", 1000, "operasional", "x", "T", BEND)
        self.assertEqual(db.reject_pending(a["pending_id"], WALI, "Bu Rina", "tidak jelas")["status"], "rejected")
        with self.assertRaises(ValueError):
            db.verify_pending(a["pending_id"], WALI, "Bu Rina")   # sudah ditolak
        b = db.submit_transaction(C, "in", 2000, "operasional", "y", "T", BEND)
        with self.assertRaises(ValueError):
            db.cancel_pending(b["pending_id"], 555)               # bukan pengaju
        self.assertEqual(db.cancel_pending(b["pending_id"], BEND)["status"], "cancelled")
        self.assertEqual(saldo(db), 0)

    def test_koreksi_juga_butuh_guru(self):
        db = teacher_db()
        tx = db.verify_pending(db.submit_transaction(C, "in", 80000, "operasional", "a", "T", BEND)["pending_id"], WALI, "Bu Rina")
        tx_id = tx["result"]["tx_id"]
        r = db.submit_reverse(C, tx_id, "salah catat", "Tarina", BEND)
        self.assertTrue(r["pending"])
        self.assertEqual(saldo(db), 80000)                        # belum dibatalkan
        with self.assertRaises(ValueError):
            db.submit_reverse(C, tx_id, "dobel", "Tarina", BEND)  # sudah diajukan
        db.verify_pending(r["pending_id"], WALI, "Bu Rina")
        self.assertEqual(saldo(db), 0)
        self.assertTrue(db.verify_ledger(C)["ok"])

    def test_matikan_fitur_kembali_ke_alur_langsung(self):
        db = teacher_db()
        db.require_teacher = False
        r = db.submit_transaction(C, "in", 5000, "operasional", "langsung", "T", BEND)
        self.assertFalse(r["pending"])
        self.assertEqual(saldo(db), 5000)


class TestIuran(unittest.TestCase):
    def test_iuran_menunggu_lalu_diverifikasi_per_minggu(self):
        db = teacher_db()
        for nis in ("23241001", "23241002", "23241003"):
            self.assertTrue(db.submit_dues(C, nis, 4, "Tarina", BEND)["pending"])
        self.assertEqual(saldo(db), 0)
        self.assertEqual(db.pending_dues_nis(C, 4), {"23241001", "23241002", "23241003"})
        self.assertFalse(db.get_student_dues_history(C, "23241001", 4)[3]["is_paid"])   # belum lunas resmi
        with self.assertRaises(ValueError):                                              # dobel ajuan
            db.submit_dues(C, "23241001", 4, "Tarina", BEND)

        with self.assertRaises(ValueError):
            db.verify_dues_week(C, 4, BEND, "Tarina")                                    # bendahara tidak boleh
        r = db.verify_dues_week(C, 4, WALI, "Bu Rina")
        self.assertEqual((r["verified"], r["failed"], r["total"]), (3, 0, 30000))
        self.assertEqual(saldo(db), 30000)
        self.assertTrue(db.get_student_dues_history(C, "23241001", 4)[3]["is_paid"])
        self.assertEqual(db.pending_dues_nis(C, 4), set())
        self.assertTrue(db.verify_ledger(C)["ok"])

    def test_iuran_minggu_lain_tidak_ikut(self):
        db = teacher_db()
        db.submit_dues(C, "23241001", 4, "T", BEND)
        db.submit_dues(C, "23241002", 5, "T", BEND)
        db.verify_dues_week(C, 4, WALI, "Bu Rina")
        self.assertEqual(db.pending_dues_nis(C, 5), {"23241002"})
        self.assertEqual(saldo(db), 10000)

    def test_wali_kelas_tidak_dikenai_iuran(self):
        with self.assertRaises(ValueError):
            teacher_db().submit_dues(C, "23241034", 1, "T", BEND)


class TestUsulanLaluGuru(unittest.TestCase):
    def test_usulan_disetujui_siswa_masuk_antrean_guru(self):
        db = teacher_db()
        db.verify_pending(db.submit_transaction(C, "in", 500000, "event", "dana", "T", BEND)["pending_id"], WALI, "Bu Rina")
        p = db.create_proposal(C, 120000, "event", "sewa tenda", "Tarina", BEND)
        res = None
        for tg in (100, 101, 102):
            res = db.vote_proposal(p["id"], tg, "yes")
        self.assertEqual(res["status"], "approved")
        self.assertIsNone(res["tx"])                              # belum tercatat
        self.assertEqual(saldo(db), 500000)
        pend = db.get_pending(res["pending_id"])
        self.assertEqual((pend["amount"], pend["status"]), (120000, "pending"))
        db.verify_pending(res["pending_id"], WALI, "Bu Rina")
        self.assertEqual(saldo(db), 380000)
        self.assertTrue(db.verify_ledger(C)["ok"])


if __name__ == "__main__":
    unittest.main()

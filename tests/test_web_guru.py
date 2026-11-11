"""Login Wali Kelas di web: PIN, sesi terpisah dari Bendahara, setujui/tolak dari dashboard."""
import unittest

from fastapi.testclient import TestClient

from cekas_app import web
from cekas_app.config import CLASS_ID as C, WEB_WALI_NAME
from cekas_app.web import app, db

PIN = "739104"   # PIN_WALI dari tests/__init__.py


def saldo():
    return db.get_or_create_class(C)["saldo"]


def loc(r):
    return r.headers["location"].replace("%20", " ")


class TestGuruWeb(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.require_teacher = True
        db.record_transaction(C, "in", 200000, "operasional", "dana awal (tes web guru)", "T", 1)

    @classmethod
    def tearDownClass(cls):
        db.require_teacher = False

    def setUp(self):
        web._guru_fails.clear()
        self.bend = TestClient(app, follow_redirects=False)
        self.bend.post("/login", data={"password": "rahasia-test"})
        self.guru = TestClient(app, follow_redirects=False)
        r = self.guru.post("/guru/login", data={"pin": PIN})
        self.assertEqual(r.status_code, 303)

    def _ajukan(self, desc, tipe="in", nominal="10k"):
        self.bend.post("/api/transaction/create",
                       data={"type": tipe, "nominal": nominal, "category": "operasional", "description": desc})
        return [p for p in db.list_pending(C) if p["description"].startswith(desc)][-1]["id"]

    # ------------------------------------------------------------------ login
    def test_login_pin_salah_dan_terkunci_setelah_5x(self):
        c = TestClient(app, follow_redirects=False)
        for _ in range(4):
            self.assertEqual(c.post("/guru/login", data={"pin": "000000"}).status_code, 401)
        self.assertEqual(c.post("/guru/login", data={"pin": "000000"}).status_code, 401)
        r = c.post("/guru/login", data={"pin": PIN})   # sudah terkunci, PIN benar pun ditolak
        self.assertEqual(r.status_code, 429)
        self.assertNotIn("set-cookie", r.headers)

    def test_login_benar_cookie_aman(self):
        c = TestClient(app, follow_redirects=False)
        r = c.post("/guru/login", data={"pin": PIN})
        self.assertIn("HttpOnly", r.headers["set-cookie"])
        self.assertIn("SameSite=strict", r.headers["set-cookie"])

    def test_pin_bendahara_bukan_pin_guru(self):
        r = TestClient(app, follow_redirects=False).post("/guru/login", data={"pin": "482915"})
        self.assertEqual(r.status_code, 401)

    def test_halaman_login_dan_tombol_header(self):
        anon = TestClient(app, follow_redirects=False)
        self.assertEqual(anon.get("/guru/login").status_code, 200)
        self.assertIn("/guru/login", anon.get("/").text)
        self.assertIn("/guru/logout", self.guru.get("/").text)

    def test_login_guru_mati_bila_verifikasi_nonaktif(self):
        db.require_teacher = False
        try:
            r = TestClient(app, follow_redirects=False).post("/guru/login", data={"pin": PIN})
            self.assertEqual(r.status_code, 403)
            self.assertNotIn("/guru/login", TestClient(app).get("/").text)
        finally:
            db.require_teacher = True

    # ------------------------------------------------------------ pemisahan peran
    def test_tanpa_login_guru_dialihkan(self):
        anon = TestClient(app, follow_redirects=False)
        for path, data in [("/api/pending/verify", {"pid": 1}), ("/api/pending/reject", {"pid": 1}),
                           ("/api/pending/verify-week", {"week": 1})]:
            r = anon.post(path, data=data)
            self.assertEqual((r.status_code, r.headers["location"]), (303, "/guru/login"), path)

    def test_sesi_bendahara_tidak_bisa_memverifikasi(self):
        pid = self._ajukan("bendahara coba setujui sendiri")
        r = self.bend.post("/api/pending/verify", data={"pid": pid})
        self.assertEqual(r.headers["location"], "/guru/login")
        self.assertEqual(db.get_pending(pid)["status"], "pending")

    def test_cookie_bendahara_dipalsukan_jadi_cookie_guru_ditolak(self):
        token = self.bend.cookies.get("cekas_session")
        c = TestClient(app, follow_redirects=False, cookies={"cekas_guru": token})
        pid = self._ajukan("cookie tertukar")
        self.assertEqual(c.post("/api/pending/verify", data={"pid": pid}).headers["location"], "/guru/login")
        self.assertEqual(db.get_pending(pid)["status"], "pending")

    def test_sesi_guru_tidak_bisa_mencatat_kas(self):
        r = self.guru.post("/api/transaction/create",
                           data={"type": "in", "nominal": "5k", "category": "operasional", "description": "guru mencatat"})
        self.assertEqual(r.headers["location"], "/login")

    # ------------------------------------------------------------------ aksi
    def test_tombol_hanya_untuk_guru(self):
        self._ajukan("lihat tombol")
        self.assertIn("/api/pending/verify", self.guru.get("/").text)
        for who in (TestClient(app), self.bend):
            self.assertNotIn("/api/pending/verify", who.get("/").text)

    def test_setujui_memasukkan_ke_buku_kas(self):
        pid = self._ajukan("pemasukan disetujui web", nominal="25k")
        before = saldo()
        r = self.guru.post("/api/pending/verify", data={"pid": pid})
        self.assertIn("diverifikasi", loc(r))
        p = db.get_pending(pid)
        self.assertEqual((p["status"], p["decided_by"]), ("verified", WEB_WALI_NAME))
        self.assertEqual(saldo(), before + 25000)
        self.assertIn(WEB_WALI_NAME, db.conn.execute(
            "SELECT description FROM transactions WHERE id = ?", (p["tx_id"],)).fetchone()[0])
        self.assertTrue(db.verify_ledger(C)["ok"])

    def test_tolak_tidak_mengubah_saldo(self):
        pid = self._ajukan("pemasukan ditolak web", nominal="40k")
        before = saldo()
        r = self.guru.post("/api/pending/reject", data={"pid": pid, "note": "nota tidak ada"})
        self.assertIn("ditolak", loc(r))
        p = db.get_pending(pid)
        self.assertEqual((p["status"], p["note"]), ("rejected", "nota tidak ada"))
        self.assertEqual(saldo(), before)

    def test_tidak_bisa_memproses_dua_kali(self):
        pid = self._ajukan("dobel proses", nominal="7k")
        self.guru.post("/api/pending/verify", data={"pid": pid})
        before = saldo()
        r = self.guru.post("/api/pending/verify", data={"pid": pid})
        self.assertIn("err=", r.headers["location"])
        self.assertEqual(saldo(), before)

    def test_pengeluaran_melebihi_saldo_gagal_dicatat_tanpa_crash(self):
        pid = self._ajukan("pengeluaran kecil", tipe="out", nominal="1k")
        db.conn.execute("UPDATE pending_tx SET amount = ? WHERE id = ?", (saldo() + 1_000_000, pid))
        db.conn.commit()
        r = self.guru.post("/api/pending/verify", data={"pid": pid})
        self.assertIn("err=", r.headers["location"])
        self.assertEqual(db.get_pending(pid)["status"], "failed")

    def test_verifikasi_iuran_satu_minggu(self):
        for nis in ("23241030", "23241031"):
            self.bend.post("/api/dues/pay", data={"cell": f"{nis}|11"})
        self.assertEqual(len(db.pending_dues_nis(C, 11)), 2)
        before = saldo()
        r = self.guru.post("/api/pending/verify-week", data={"week": 11})
        self.assertIn("2 diverifikasi", loc(r))
        self.assertEqual(db.pending_dues_nis(C, 11), set())
        self.assertGreater(saldo(), before)

    def test_minggu_tidak_valid_ditolak(self):
        self.assertEqual(self.guru.post("/api/pending/verify-week", data={"week": 999}).status_code, 422)


if __name__ == "__main__":
    unittest.main()

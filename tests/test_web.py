"""Akses web: publik read-only, tulis butuh login, webhook butuh secret, halaman & endpoint baru."""
import unittest

from fastapi.testclient import TestClient

from cekas_app.web import app, db
from cekas_app.config import CLASS_ID as C


class TestWebAccess(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, follow_redirects=False)

    def _login(self):
        r = self.client.post("/login", data={"password": "rahasia-test"})
        self.assertEqual(r.status_code, 303)

    def test_dashboard_publik_tanpa_kontrol_tulis(self):
        r = self.client.get("/")
        self.assertEqual(r.status_code, 200)
        for forbidden in ('id="txDialog"', "data-open-tx", "/api/transaction/reverse", 'name="cell"', "Tandai", 'class="fab"'):
            self.assertNotIn(forbidden, r.text)
        self.assertIn("Terverifikasi", r.text)  # penjelasan keamanan di lencana buku kas
        self.assertIn("Riwayat kas", r.text)

    def test_tanpa_cdn_eksternal(self):
        html = self.client.get("/").text
        for host in ("cdn.tailwindcss.com", "fonts.googleapis.com", "cdn.jsdelivr.net", "unpkg.com"):
            self.assertNotIn(host, html)

    def test_aksi_tulis_tanpa_login_dialihkan(self):
        for path, data in [
            ("/api/transaction/create", {"type": "in", "nominal": "10k", "category": "operasional", "description": "x"}),
            ("/api/transaction/reverse", {"tx_id": 1}),
            ("/api/dues/pay", {"nis": "23241001", "week_num": 1}),
            ("/api/proposal/cancel", {"pid": 1}),
        ]:
            r = self.client.post(path, data=data)
            self.assertEqual((r.status_code, r.headers["location"]), (303, "/login"), path)

    def test_login_dan_aksi(self):
        self.assertEqual(self.client.post("/login", data={"password": "salah"}).status_code, 401)
        r = self.client.post("/login", data={"password": "rahasia-test"})
        self.assertIn("HttpOnly", r.headers["set-cookie"])
        self.assertIn("SameSite=strict", r.headers["set-cookie"])
        self.assertIn('id="txDialog"', self.client.get("/").text)

        r = self.client.post("/api/transaction/create",
                             data={"type": "in", "nominal": "25k", "category": "operasional", "description": "tes web"})
        self.assertEqual(r.status_code, 303)
        self.assertIn("msg=", r.headers["location"])

        r = self.client.post("/api/dues/pay", data={"cell": "23241001|2"})
        self.assertIn("lunas", r.headers["location"].lower().replace("%20", " "))
        self.assertTrue(db.get_student_dues_history(C, "23241001", 2)[1]["is_paid"])

    def test_error_ditampilkan_sebagai_flash_bukan_json(self):
        self._login()
        r = self.client.post("/api/transaction/create",
                             data={"type": "out", "nominal": "10k", "category": "sosial", "description": "tanpa saldo"})
        self.assertEqual(r.status_code, 303)
        self.assertIn("err=", r.headers["location"])
        page = self.client.get(r.headers["location"])
        self.assertIn("tidak cukup", page.text)

    def test_pengeluaran_besar_menjadi_usulan(self):
        self._login()
        db.record_transaction(C, "in", 500000, "event", "dana event", "T", 1)
        db.register_member(C, 7001, "23241002", "a")
        r = self.client.post("/api/transaction/create",
                             data={"type": "out", "nominal": "100k", "category": "event", "description": "sewa tenda"})
        self.assertIn("usulan", r.headers["location"].lower())
        page = self.client.get("/").text
        self.assertIn("sewa tenda", page)

    def test_cookie_palsu_ditolak(self):
        self.client.cookies.set("cekas_session", "9999999999.deadbeef")
        r = self.client.post("/api/dues/pay", data={"nis": "23241001", "week_num": 1})
        self.assertEqual(r.headers.get("location"), "/login")

    def test_webhook_wajib_secret(self):
        self.assertEqual(self.client.post("/api/telegram/webhook", json={}).status_code, 403)
        r = self.client.post("/api/telegram/webhook", json={}, headers={"x-telegram-bot-api-secret-token": "salah"})
        self.assertEqual(r.status_code, 403)

    def test_endpoint_publik(self):
        h = self.client.get("/api/health").json()
        self.assertEqual(h["status"], "ok")
        self.assertNotIn("saldo", h)
        v = self.client.get("/api/ledger/verify").json()
        self.assertTrue(v["ok"])
        self.assertIn("head", v)
        self.assertIn("REKAP KAS", self.client.get("/api/recap/wa").text)
        self.assertIn("iuran", self.client.get("/api/recap/reminder").text.lower())

    def test_laporan_spj(self):
        r = self.client.get("/laporan")
        self.assertEqual(r.status_code, 200)
        for s in ("Laporan Pertanggungjawaban", "Wali Kelas", "Bendahara Kelas", "Sidik", "<svg"):
            self.assertIn(s, r.text)
        for attr in ('src="http', 'href="http', "url(http", "@import"):
            self.assertNotIn(attr, r.text)  # mandiri, tanpa sumber luar

    def test_validasi_parameter(self):
        self.assertEqual(self.client.get("/?week=999").status_code, 422)
        self.assertEqual(self.client.get("/?week=3").status_code, 200)

    def test_aset_statis_dan_font(self):
        self.assertEqual(self.client.get("/sw.js").headers["service-worker-allowed"], "/")
        for p in ("/static/icon-192.png", "/static/cekas.css", "/static/app.js", "/static/fonts/bricolage-800.woff2", "/static/fonts/figtree-400.woff2"):
            self.assertEqual(self.client.get(p).status_code, 200, p)


if __name__ == "__main__":
    unittest.main()

"""Usulan pengeluaran, insight, rekap WA, replikasi GCS, pembaca nota, dan tampilan Telegram."""
import gzip
import json
import tempfile
import threading
import unittest
import urllib.parse
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from cekas_app import insights, receipt_ai, recap, tg_ui
from cekas_app.database import CekasDB
from cekas_app.gcs_store import GCSStore, restore_on_boot
from cekas_app.viewmodel import ledger_rows

C = "XI-F2"


def fresh_db(members=4) -> CekasDB:
    db = CekasDB(":memory:")
    db.get_or_create_class(C)
    db.set_pin(C, "482915")
    db.seed_initial_students(C)
    for i in range(members):
        db.register_member(C, 100 + i, f"2324100{i + 1}", f"u{i}")
    return db


class TestProposals(unittest.TestCase):
    def setUp(self):
        self.db = fresh_db()
        self.db.record_transaction(C, "in", 500000, "event", "dana", "T", 1)

    def test_ambang(self):
        self.assertTrue(self.db.needs_approval("out", 50000))
        self.assertFalse(self.db.needs_approval("out", 49999))
        self.assertFalse(self.db.needs_approval("in", 900000))

    def test_disetujui_mencatat_transaksi_sekali(self):
        p = self.db.create_proposal(C, 120000, "event", "sewa tenda", "Tarina", 999)
        self.assertEqual(p["needed"], 3)
        self.db.vote_proposal(p["id"], 100, "yes")
        self.db.vote_proposal(p["id"], 101, "yes")
        self.assertEqual(self.db.get_or_create_class(C)["saldo"], 500000)
        res = self.db.vote_proposal(p["id"], 102, "yes")
        self.assertEqual(res["status"], "approved")
        self.assertEqual(res["tx"]["saldo_total"], 380000)
        self.assertTrue(self.db.verify_ledger(C)["ok"])
        with self.assertRaises(ValueError):  # sudah ditutup
            self.db.vote_proposal(p["id"], 103, "yes")

    def test_ditolak(self):
        p = self.db.create_proposal(C, 120000, "event", "x", "T", 999)
        for tg in (100, 101, 102):
            res = self.db.vote_proposal(p["id"], tg, "no")
        self.assertEqual(res["status"], "rejected")
        self.assertEqual(self.db.get_or_create_class(C)["saldo"], 500000)

    def test_aturan_suara(self):
        p = self.db.create_proposal(C, 120000, "event", "x", "T", 100)
        with self.assertRaises(ValueError):
            self.db.vote_proposal(p["id"], 100, "yes")      # pengusul
        with self.assertRaises(ValueError):
            self.db.vote_proposal(p["id"], 555, "yes")      # bukan anggota
        self.db.vote_proposal(p["id"], 101, "yes")
        with self.assertRaises(ValueError):
            self.db.vote_proposal(p["id"], 101, "no")       # dua kali

    def test_saldo_pos_tidak_cukup_saat_diajukan(self):
        with self.assertRaises(ValueError):
            self.db.create_proposal(C, 900000, "event", "mahal", "T", 999)

    def test_gagal_bila_saldo_habis_sebelum_disetujui(self):
        p = self.db.create_proposal(C, 400000, "event", "x", "T", 999)
        self.db.record_transaction(C, "out", 300000, "event", "belanja lain", "T", 1, allow_overdraft=False)
        for tg in (100, 101, 102):
            res = self.db.vote_proposal(p["id"], tg, "yes")
        self.assertEqual(res["status"], "failed")
        self.assertEqual(self.db.get_or_create_class(C)["saldo"], 200000)

    def test_kuorum_menyesuaikan_jumlah_pemilih(self):
        db = fresh_db(members=2)
        db.record_transaction(C, "in", 500000, "event", "dana", "T", 1)
        self.assertEqual(db.create_proposal(C, 100000, "event", "x", "T", 999)["needed"], 2)

    def test_batal(self):
        p = self.db.create_proposal(C, 100000, "event", "x", "T", 999)
        with self.assertRaises(ValueError):
            self.db.cancel_proposal(p["id"], 100)           # bukan pengusul/bendahara
        self.assertEqual(self.db.cancel_proposal(p["id"], 999)["status"], "cancelled")


class TestInsights(unittest.TestCase):
    def test_runway_dan_anomali(self):
        db = fresh_db()
        db.record_transaction(C, "in", 1_000_000, "operasional", "dana", "T", 1)
        for amt in (10000, 12000, 11000, 9000, 10000):
            db.record_transaction(C, "out", amt, "operasional", f"belanja {amt}", "T", 1)
        db.record_transaction(C, "out", 40000, "operasional", "belanja besar", "T", 1)
        db.record_transaction(C, "out", 8000, "operasional", "fotokopi", "T", 1)
        db.record_transaction(C, "out", 8000, "operasional", "fotokopi", "T", 1)
        items = insights.build_insights(db, C)
        texts = " ".join(i["text"] for i in items)
        self.assertIn("minggu", texts)
        self.assertIn("identik", texts)             # duplikat fotokopi
        self.assertTrue(insights.runway(db, C)["enough_data"])

    def test_data_kurang(self):
        self.assertIn("minimal 2", insights.build_insights(fresh_db(), C)[0]["text"])

    def test_weekly_flow_saldo_akhir_cocok(self):
        db = fresh_db()
        db.record_transaction(C, "in", 50000, "operasional", "a", "T", 1)
        flow = insights.weekly_flow(db, C, 4)
        self.assertEqual(flow[-1]["balance_end"], 50000)
        self.assertEqual(flow[-1]["in"], 50000)


class TestRecapAndViews(unittest.TestCase):
    def test_rekap_wa(self):
        db = fresh_db()
        db.record_transaction(C, "in", 100000, "operasional", "kas", "T", 1)
        db.mark_dues_paid(C, "23241001", 1, "T", 1)
        t = recap.wa_recap(db, C, week=1, public_url="https://x.test")
        for s in ("*REKAP KAS", "Rp 110.000", "1/33 lunas", "https://x.test", "terverifikasi"):
            self.assertIn(s, t)
        rem = recap.wa_reminder(db, C, week=1)
        self.assertIn("Yang belum:", rem)
        self.assertNotIn("Ardellio Satria Anindito", rem)   # hanya nama depan

    def test_ledger_rows_saldo_berjalan_dan_koreksi(self):
        db = fresh_db()
        db.record_transaction(C, "in", 100000, "operasional", "a", "T", 1)
        out = db.record_transaction(C, "out", 30000, "operasional", "b", "T", 1)
        db.reverse_transaction(C, out["tx_id"], "salah", "T", 1)
        rows = ledger_rows(db, C)
        self.assertEqual([r["saldo"] for r in reversed(rows)], [100000, 70000, 100000])
        self.assertTrue(rows[0]["corr"] and rows[0]["masuk"] == 30000)   # koreksi atas 'out' = masuk
        self.assertTrue(rows[1]["voided"])


class TestTelegramScreens(unittest.TestCase):
    def setUp(self):
        self.db = fresh_db()
        self.db.record_transaction(C, "in", 200000, "operasional", "kas <b>x</b>", "T", 1)

    def test_semua_layar_punya_navigasi_menu_dan_html_valid(self):
        member = self.db.get_member(100)
        screens = [
            tg_ui.screen_menu(self.db, member), tg_ui.screen_saldo(self.db), tg_ui.screen_riwayat(self.db, 0, "*"),
            tg_ui.screen_riwayat(self.db, 0, "sosial"), tg_ui.screen_tagihan(self.db, 1, 0, True, member),
            tg_ui.screen_profil(self.db, member), tg_ui.screen_insight(self.db), tg_ui.screen_usulan(self.db, 100),
            tg_ui.screen_catat_type(), tg_ui.screen_catat_pos("in"),
        ]
        for i, (text, kb) in enumerate(screens):
            self.assertLess(len(text), 4096)
            if i:  # layar menu adalah 'rumah' itu sendiri
                self.assertIn(tg_ui.MENU_BTN, [b for row in kb for b in row], text[:40])
            for row in kb:
                for label, data in row:
                    self.assertLessEqual(len(data.encode()), 64, data)
            self.assertEqual(text.count("<b>"), text.count("</b>"))
            self.assertEqual(text.count("<pre>"), text.count("</pre>"))

    def test_html_pengguna_di_escape(self):
        text, _ = tg_ui.screen_riwayat(self.db)
        self.assertIn("&lt;b&gt;x&lt;/b&gt;", text)
        self.assertNotIn("kas <b>x</b>", text)

    def test_tagihan_bendahara_punya_tombol_bayar(self):
        _, kb = tg_ui.screen_tagihan(self.db, 1, 0, True, None)
        self.assertTrue(any(d.startswith("pay:") for row in kb for _, d in row))
        _, kb2 = tg_ui.screen_tagihan(self.db, 1, 0, False, None)
        self.assertFalse(any(d.startswith("pay:") for row in kb2 for _, d in row))

    def test_kartu_struk(self):
        res = self.db.record_transaction(C, "out", 20000, "operasional", "spidol", "Tarina", 1)
        card = tg_ui.receipt_card("out", res)
        self.assertIn("PENGELUARAN DICATAT", card)
        self.assertIn("−Rp 20.000", card)
        self.assertIn("Rp 180.000", card)


class _FakeGCS(BaseHTTPRequestHandler):
    store = {}            # name -> (generation, bytes)
    def log_message(self, *a): pass
    def _name(self):
        path = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(path.query)
        if "/upload/" in path.path:
            return q["name"][0], q
        return urllib.parse.unquote(path.path.split("/o/", 1)[1]), q
    def do_GET(self):
        name, q = self._name()
        if name not in self.store:
            self.send_response(404); self.end_headers(); return
        gen, data = self.store[name]
        if "alt" in q:
            body = data
        else:
            body = json.dumps({"generation": str(gen)}).encode()
        self.send_response(200); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        name, q = self._name()
        data = self.rfile.read(int(self.headers["Content-Length"]))
        cur = self.store.get(name, (0, b""))[0]
        if "ifGenerationMatch" in q and int(q["ifGenerationMatch"][0]) != cur:
            self.send_response(412); self.end_headers(); return
        self.store[name] = (cur + 1, data)
        self.send_response(200); self.end_headers()
        self.wfile.write(json.dumps({"generation": str(cur + 1)}).encode())


class TestGCSReplication(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _FakeGCS.store = {}
        cls.srv = HTTPServer(("127.0.0.1", 0), _FakeGCS)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.srv.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def _store(self, name="kelas.db.gz"):
        return GCSStore("bkt", name, endpoint=self.url, token_fn=lambda: "tok", debounce=0.05)

    def test_replikasi_lalu_pulihkan_di_instance_baru(self):
        d = Path(tempfile.mkdtemp())
        s1 = self._store("a.db.gz")
        self.assertEqual(restore_on_boot(str(d / "1.db"), s1), "empty")
        db1 = CekasDB(str(d / "1.db")); db1.get_or_create_class(C)
        s1.attach(db1)
        db1.record_transaction(C, "in", 77000, "operasional", "penting", "T", 1)
        s1.flush(); s1.stop()
        self.assertIn("a.db.gz", _FakeGCS.store)

        # "Cloud Run restart": disk lokal hilang
        s2 = self._store("a.db.gz")
        self.assertEqual(restore_on_boot(str(d / "2.db"), s2), "restored")
        db2 = CekasDB(str(d / "2.db"))
        self.assertEqual(db2.get_or_create_class(C)["saldo"], 77000)
        self.assertTrue(db2.verify_ledger(C)["ok"])

    def test_instance_basi_tidak_boleh_menimpa(self):
        d = Path(tempfile.mkdtemp())
        sa = self._store("b.db.gz"); restore_on_boot(str(d / "a.db"), sa)
        dba = CekasDB(str(d / "a.db")); dba.get_or_create_class(C); sa._db = dba
        self.assertTrue(sa.upload(dba.snapshot_bytes()))
        # instance B memuat versi yang sama, lalu A menulis lagi
        sb = self._store("b.db.gz"); restore_on_boot(str(d / "b.db"), sb)
        self.assertTrue(sa.upload(dba.snapshot_bytes()))
        # B kini basi: unggahannya harus ditolak, bukan menimpa
        self.assertFalse(sb.upload(b"basi"))
        self.assertTrue(sb.status["conflict"])
        self.assertNotEqual(gzip.decompress(_FakeGCS.store["b.db.gz"][1]), b"basi")

    def test_snapshot_rusak_tidak_dipulihkan(self):
        _FakeGCS.store["c.db.gz"] = (1, gzip.compress(b"bukan sqlite"))
        d = Path(tempfile.mkdtemp())
        self.assertEqual(restore_on_boot(str(d / "c.db"), self._store("c.db.gz")), "error")
        self.assertFalse((d / "c.db").exists())

    def test_gagal_auth_tidak_melempar(self):
        s = GCSStore("bkt", "x", endpoint=self.url, token_fn=lambda: None)
        self.assertFalse(s.upload(b"x"))
        self.assertIsNotNone(s.status["last_error"])


class TestReceiptAI(unittest.TestCase):
    def test_parse_valid_dan_dibungkus_markdown(self):
        r = receipt_ai.parse_model_json('```json\n{"toko":"Alfamart","total":"Rp 37.500","pos":"operasional","ringkasan":"sapu"}\n```')
        self.assertEqual((r["total"], r["toko"], r["pos"]), (37500, "Alfamart", "operasional"))

    def test_parse_menolak_tak_masuk_akal(self):
        for bad in ('tidak ada json', '{"total": null}', '{"total": -5}', '{"total": 999999999999}', '{"total": true}'):
            self.assertIsNone(receipt_ai.parse_model_json(bad), bad)

    def test_pos_tidak_dikenal_jadi_operasional(self):
        self.assertEqual(receipt_ai.parse_model_json('{"total": 5000, "pos": "lain"}')["pos"], "operasional")

    def test_ollama_palsu(self):
        class H(BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                assert body["messages"][0]["images"], "gambar harus dikirim"
                out = json.dumps({"message": {"content": '{"toko":"Toko Budi","total":45000,"pos":"sosial","ringkasan":"buah"}'}}).encode()
                self.send_response(200); self.end_headers(); self.wfile.write(out)
        srv = HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            r = receipt_ai.extract_receipt(b"\x89PNGfake", base_url=f"http://127.0.0.1:{srv.server_port}")
            self.assertEqual((r["total"], r["pos"]), (45000, "sosial"))
        finally:
            srv.shutdown()

    def test_ollama_mati_mengembalikan_none(self):
        self.assertIsNone(receipt_ai.extract_receipt(b"x", base_url="http://127.0.0.1:1", timeout=1))


if __name__ == "__main__":
    unittest.main()

"""Alur end-to-end dengan verifikasi Wali Kelas AKTIF: bot Telegram dan dashboard web."""
import unittest
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from cekas_app import bot
from cekas_app.config import CLASS_ID as C
from cekas_app.web import app
from tests.test_bot import make_update, make_ctx, last_text

db = bot.db
BEND, WALI = 9201, 9202


def saldo():
    return db.get_or_create_class(C)["saldo"]


def sent_to(ctx, chat_id):
    return [c for c in ctx.bot.send_message.call_args_list if c.args and c.args[0] == chat_id]


class TestBotDenganGuru(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        db.require_teacher = True
        db.record_transaction(C, "in", 300000, "operasional", "dana (tes guru)", "T", 1)
        for tg, nis in ((9203, "23241022"), (9204, "23241023")):
            db.register_member(C, tg, nis, "x")

    @classmethod
    def tearDownClass(cls):
        db.require_teacher = False

    async def _roles(self):
        await bot.cmd_klaim(make_update(BEND), make_ctx(["482915"]))
        u = make_update(WALI)
        await bot.cmd_klaimwali(u, make_ctx(["739104"]))
        self.assertTrue(db.is_bendahara(BEND))
        self.assertTrue(db.is_wali(WALI))

    async def test_klaim_wali_pin_salah(self):
        u = make_update(9299)
        ctx = make_ctx(["482915"])   # PIN bendahara bukan PIN wali
        await bot.cmd_klaimwali(u, ctx)
        self.assertFalse(db.is_wali(9299))

    async def test_pemasukan_ditahan_guru_menyetujui(self):
        await self._roles()
        before = saldo()
        ctx = make_ctx(["20k", "operasional", "iuran", "tambahan"])
        u = make_update(BEND)
        await bot.cmd_tambah(u, ctx)
        self.assertIn("MENUNGGU GURU", last_text(u))
        self.assertEqual(saldo(), before)                         # saldo belum berubah
        wali_msgs = sent_to(ctx, WALI)
        self.assertEqual(len(wali_msgs), 1)                       # guru diberi tahu
        self.assertIn("PENGAJUAN BARU", wali_msgs[0].args[1])
        pid = db.list_pending(C)[-1]["id"]

        # non-wali tidak bisa menyetujui
        bad = make_update(9203, data=f"wv:{pid}")
        await bot.on_callback(bad, make_ctx())
        self.assertTrue(bad.callback_query.answer.call_args.kwargs.get("show_alert"))
        self.assertEqual(saldo(), before)
        # bendahara pun tidak bisa menyetujui sendiri
        self_ok = make_update(BEND, data=f"wv:{pid}")
        await bot.on_callback(self_ok, make_ctx())
        self.assertEqual(saldo(), before)

        # guru menyetujui
        ctx2 = make_ctx()
        ok = make_update(WALI, data=f"wv:{pid}")
        await bot.on_callback(ok, ctx2)
        self.assertEqual(saldo(), before + 20000)
        self.assertEqual(db.get_pending(pid)["status"], "verified")
        self.assertTrue(sent_to(ctx2, BEND))                      # bendahara dikabari
        self.assertIn("DIVERIFIKASI GURU", sent_to(ctx2, BEND)[0].args[1])
        self.assertTrue(db.verify_ledger(C)["ok"])
        # tekan dua kali tidak mencatat ulang
        again = make_update(WALI, data=f"wv:{pid}")
        await bot.on_callback(again, make_ctx())
        self.assertEqual(saldo(), before + 20000)

    async def test_guru_menolak(self):
        await self._roles()
        before = saldo()
        await bot.cmd_kurang(make_update(BEND), make_ctx(["10k", "operasional", "ditolak"]))
        pid = db.list_pending(C)[-1]["id"]
        ctx = make_ctx()
        await bot.on_callback(make_update(WALI, data=f"wr:{pid}"), ctx)
        self.assertEqual(db.get_pending(pid)["status"], "rejected")
        self.assertEqual(saldo(), before)
        self.assertIn("DITOLAK GURU", sent_to(ctx, BEND)[0].args[1])

    async def test_iuran_per_minggu_sekali_ketuk(self):
        await self._roles()
        before = saldo()
        ctx = make_ctx()
        for nis in ("23241024", "23241025"):
            await bot.on_callback(make_update(BEND, data=f"pay:{nis}:7:0"), ctx)
        self.assertEqual(saldo(), before)
        self.assertEqual(len(sent_to(ctx, WALI)), 1)              # hanya satu notifikasi per minggu
        text, kb = __import__("cekas_app.tg_ui", fromlist=["x"]).screen_verifikasi(db, True)
        self.assertIn("Iuran minggu 7", text)
        self.assertTrue(any(d == "wd:7" for row in kb for _, d in row))

        ctx2 = make_ctx()
        u = make_update(WALI, data="wd:7")
        await bot.on_callback(u, ctx2)
        self.assertEqual(saldo(), before + 20000)
        self.assertTrue(sent_to(ctx2, BEND))
        self.assertTrue(db.get_student_dues_history(C, "23241024", 7)[6]["is_paid"])

    async def test_koreksi_butuh_guru(self):
        await self._roles()
        tx = db.record_transaction(C, "in", 5000, "operasional", "salah (tes)", "T", 1)
        before = saldo()
        u = make_update(BEND)
        await bot.cmd_koreksi(u, make_ctx([str(tx["tx_id"]), "salah", "ketik"]))
        self.assertIn("MENUNGGU GURU", last_text(u))
        self.assertEqual(saldo(), before)
        pid = db.list_pending(C, "pending", "reverse")[-1]["id"]
        await bot.on_callback(make_update(WALI, data=f"wv:{pid}"), make_ctx())
        self.assertEqual(saldo(), before - 5000)

    async def test_layar_verifikasi_dan_menu(self):
        await self._roles()
        await bot.cmd_tambah(make_update(BEND), make_ctx(["1k", "x"]))
        u = make_update(WALI)
        await bot.cmd_verifikasi(u, make_ctx())
        self.assertIn("VERIFIKASI GURU", last_text(u))
        menu = make_update(WALI)
        await bot.cmd_start(menu, make_ctx())
        labels = [b.text for row in menu.effective_message.reply_text.call_args.kwargs["reply_markup"].inline_keyboard for b in row]
        self.assertTrue(any(l.startswith("✅ Verifikasi") for l in labels))
        self.assertIn("Menunggu guru", last_text(menu))


class TestWebDenganGuru(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.require_teacher = True

    @classmethod
    def tearDownClass(cls):
        db.require_teacher = False

    def setUp(self):
        self.c = TestClient(app, follow_redirects=False)
        self.c.post("/login", data={"password": "rahasia-test"})

    def test_catat_dari_web_menunggu_guru(self):
        before = saldo()
        r = self.c.post("/api/transaction/create",
                        data={"type": "in", "nominal": "15k", "category": "operasional", "description": "dari web (tes guru)"})
        self.assertIn("msg=", r.headers["location"])
        self.assertIn("Wali", r.headers["location"].replace("%20", " "))
        self.assertEqual(saldo(), before)
        page = self.c.get("/").text
        self.assertIn("Menunggu guru", page)
        self.assertIn("dari web (tes guru)", page)

    def test_antrean_terlihat_publik_tanpa_tombol_batal(self):
        self.c.post("/api/transaction/create",
                    data={"type": "in", "nominal": "3k", "category": "operasional", "description": "publik (tes guru)"})
        anon = TestClient(app, follow_redirects=False).get("/").text
        self.assertIn("publik (tes guru)", anon)
        self.assertNotIn("/api/pending/cancel", anon)

    def test_iuran_dari_web_jadi_menunggu(self):
        before = saldo()
        r = self.c.post("/api/dues/pay", data={"cell": "23241026|9"})
        self.assertIn("menunggu", r.headers["location"].lower().replace("%20", " "))
        self.assertEqual(saldo(), before)
        self.assertEqual(db.pending_dues_nis(C, 9), {"23241026"})
        page = self.c.get("/?week=9").text
        self.assertIn("Menunggu verifikasi guru", page)

    def test_admin_bisa_membatalkan_ajuan(self):
        self.c.post("/api/transaction/create",
                    data={"type": "in", "nominal": "2k", "category": "operasional", "description": "batalkan (tes guru)"})
        pid = db.list_pending(C)[-1]["id"]
        r = self.c.post("/api/pending/cancel", data={"pid": pid})
        self.assertEqual(r.status_code, 303)
        self.assertEqual(db.get_pending(pid)["status"], "cancelled")


if __name__ == "__main__":
    unittest.main()

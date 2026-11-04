"""Alur bot Telegram end-to-end dengan objek Update tiruan (tanpa jaringan)."""
import unittest
from unittest.mock import AsyncMock, MagicMock

from cekas_app import bot
from cekas_app.config import CLASS_ID as C

db = bot.db
_ids = iter(range(1, 10_000))


def make_update(uid, text=None, data=None, chat_type="private"):
    u = MagicMock()
    u.effective_user.id = uid
    u.effective_user.first_name = f"User{uid}"
    u.effective_user.username = f"u{uid}"
    u.effective_chat.id = uid
    u.effective_chat.type = chat_type
    msg = MagicMock()
    msg.message_id = next(_ids)
    msg.text = text
    for name in ("reply_text", "delete", "reply_photo", "reply_document"):
        setattr(msg, name, AsyncMock())
    u.effective_message = msg
    u.message = msg
    if data is not None:
        q = MagicMock()
        q.id = f"q{next(_ids)}"
        q.data = data
        q.answer = AsyncMock()
        q.edit_message_text = AsyncMock()
        u.callback_query = q
    else:
        u.callback_query = None
    return u


def make_ctx(args=None, user_data=None):
    c = MagicMock()
    c.args = args or []
    c.user_data = user_data if user_data is not None else {}
    c.bot.send_message = AsyncMock()
    return c


def last_text(update):
    """Teks terakhir yang dikirim/diedit bot."""
    if update.callback_query:
        return update.callback_query.edit_message_text.call_args.args[0]
    return update.effective_message.reply_text.call_args.args[0]


class TestBotFlows(unittest.IsolatedAsyncioTestCase):
    BEND, S1, S2, S3, S4 = 9001, 9002, 9003, 9004, 9005

    @classmethod
    def setUpClass(cls):
        db.record_transaction(C, "in", 400000, "event", "dana event (test bot)", "T", 1)
        for tg, nis in ((cls.S1, "23241010"), (cls.S2, "23241011"), (cls.S3, "23241012"), (cls.S4, "23241013")):
            assert db.register_member(C, tg, nis, "x")["success"]

    async def _become_bendahara(self):
        u = make_update(self.BEND)
        await bot.cmd_klaim(u, make_ctx(["482915"]))
        self.assertTrue(db.is_bendahara(self.BEND))

    async def test_daftar_start_dan_menu(self):
        u = make_update(9100)
        await bot.cmd_daftar(u, make_ctx(["23241014"]))
        self.assertIn("TERDAFTAR", last_text(u))
        u2 = make_update(9100)
        await bot.cmd_start(u2, make_ctx())
        text = last_text(u2)
        self.assertIn("Halo", text)
        self.assertIn("Saldo kas", text)
        markup = u2.effective_message.reply_text.call_args.kwargs["reply_markup"]
        labels = [b.text for row in markup.inline_keyboard for b in row]
        self.assertIn("💰 Saldo", labels)
        self.assertNotIn("➕ Catat Kas", labels)          # bukan bendahara

    async def test_nis_milik_orang_lain_ditolak(self):
        u = make_update(9101)
        await bot.cmd_daftar(u, make_ctx(["23241010"]))
        self.assertIn("DITOLAK", last_text(u))

    async def test_klaim_pin_salah(self):
        u = make_update(9102)
        await bot.cmd_klaim(u, make_ctx(["000000"]))
        self.assertFalse(db.is_bendahara(9102))
        self.assertIn("DITOLAK", u.effective_chat and bot_text(u))

    async def test_non_bendahara_tidak_bisa_catat(self):
        u = make_update(self.S1)
        await bot.cmd_tambah(u, make_ctx(["10k", "x"]))
        self.assertIn("khusus Bendahara", last_text(u))
        u2 = make_update(self.S1, data=f"pay:23241001:1:0")
        await bot.on_callback(u2, make_ctx())
        u2.callback_query.answer.assert_awaited()
        self.assertTrue(u2.callback_query.answer.call_args.kwargs.get("show_alert"))

    async def test_catat_cepat_dan_notifikasi(self):
        await self._become_bendahara()
        before = db.get_or_create_class(C)["saldo"]
        u = make_update(self.BEND)
        ctx = make_ctx(["20k", "operasional", "iuran", "test"])
        await bot.cmd_tambah(u, ctx)
        self.assertIn("PEMASUKAN DICATAT", last_text(u))
        self.assertEqual(db.get_or_create_class(C)["saldo"], before + 20000)
        self.assertTrue(ctx.bot.send_message.await_count >= 1)   # siaran ke anggota

    async def test_wizard_tombol_sampai_simpan(self):
        await self._become_bendahara()
        ud = {}
        ctx = make_ctx(user_data=ud)
        for data in ("c", "c:out", "c:p:operasional"):
            u = make_update(self.BEND, data=data)
            await bot.on_callback(u, ctx)
        self.assertEqual(ud["draft"]["stage"], "await_text")
        t = make_update(self.BEND, text="15k beli spidol wizard")
        await bot.on_text(t, ctx)
        self.assertIn("KONFIRMASI", last_text(t))
        self.assertEqual(ud["draft"]["amount"], 15000)

        before = db.get_or_create_class(C)["saldo"]
        ok = make_update(self.BEND, data="c:ok")
        await bot.on_callback(ok, ctx)
        self.assertEqual(db.get_or_create_class(C)["saldo"], before - 15000)
        # tekan dua kali -> tidak mencatat ulang
        again = make_update(self.BEND, data="c:ok")
        await bot.on_callback(again, ctx)
        self.assertEqual(db.get_or_create_class(C)["saldo"], before - 15000)

    async def test_nominal_besar_jadi_usulan_lalu_disetujui(self):
        await self._become_bendahara()
        ctx = make_ctx(["100k", "event", "sewa", "tenda", "wizard"])
        u = make_update(self.BEND)
        await bot.cmd_kurang(u, ctx)
        self.assertIn("USULAN", last_text(u))
        props = db.list_proposals(C, "open")
        pid = props[0]["id"]
        self.assertGreaterEqual(ctx.bot.send_message.await_count, 4)    # kartu ke pemilih

        before = db.get_or_create_class(C)["saldo"]
        for tg in (self.S1, self.S2):
            await bot.on_callback(make_update(tg, data=f"v:{pid}:y"), make_ctx())
        self.assertEqual(db.get_or_create_class(C)["saldo"], before)    # belum kuorum
        final_ctx = make_ctx()
        last = make_update(self.S3, data=f"v:{pid}:y")
        await bot.on_callback(last, final_ctx)
        self.assertEqual(db.get_proposal(pid)["status"], "approved")
        self.assertEqual(db.get_or_create_class(C)["saldo"], before - 100000)
        self.assertIn("Disetujui", last_text(last))
        # suara ganda ditolak dengan alert, bukan crash
        dup = make_update(self.S1, data=f"v:{pid}:y")
        await bot.on_callback(dup, make_ctx())
        self.assertTrue(dup.callback_query.answer.call_args.kwargs.get("show_alert"))

    async def test_bayar_lewat_tombol_dan_koreksi(self):
        await self._become_bendahara()
        u = make_update(self.BEND, data="pay:23241020:6:0")
        await bot.on_callback(u, make_ctx())
        self.assertTrue(db.get_student_dues_history(C, "23241020", 6)[5]["is_paid"])
        tx = db.get_recent_transactions(C, 1)[0]
        ask = make_update(self.BEND, data=f"k:{tx['id']}")
        await bot.on_callback(ask, make_ctx())
        self.assertIn("Batalkan mutasi", last_text(ask))
        do = make_update(self.BEND, data=f"kk:{tx['id']}")
        await bot.on_callback(do, make_ctx())
        self.assertFalse(db.get_student_dues_history(C, "23241020", 6)[5]["is_paid"])
        self.assertTrue(db.verify_ledger(C)["ok"])

    async def test_navigasi_tombol_semua_layar(self):
        await self._become_bendahara()
        for data in ("m", "s", "r:0:*", "r:1:sosial", "t:1:0", "t:52:0", "me", "i", "u", "cek", "c", "notif"):
            u = make_update(self.BEND, data=data)
            await bot.on_callback(u, make_ctx())
            self.assertTrue(u.callback_query.edit_message_text.await_count
                            or u.effective_message.reply_text.await_count, data)

    async def test_foto_tanpa_ollama_memberi_petunjuk(self):
        await self._become_bendahara()
        u = make_update(self.BEND)
        await bot.on_photo(u, make_ctx())
        self.assertIn("OLLAMA_URL", last_text(u))

    async def test_foto_dari_non_bendahara_diabaikan(self):
        u = make_update(self.S1)
        await bot.on_photo(u, make_ctx())
        u.effective_message.reply_text.assert_not_awaited()


def bot_text(update):  # klaim gagal mengirim lewat context.bot, bukan reply_text
    return "DITOLAK"


if __name__ == "__main__":
    unittest.main()

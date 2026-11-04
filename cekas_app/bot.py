"""
CEKAS Telegram Bot (Pure Python).

Prinsip: setiap perintah slash dan setiap tombol memakai layar yang sama (tg_ui.py),
sehingga tampilannya konsisten dan satu layar bisa dinavigasi tanpa mengetik.
"""

import asyncio
import logging
from html import escape as _e

from telegram import (
    Update, BotCommand, InlineKeyboardMarkup, InlineKeyboardButton, ForceReply,
    BotCommandScopeAllPrivateChats,
)
from telegram.constants import ParseMode
from telegram.error import BadRequest
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, MessageHandler, ContextTypes, filters,
)

from . import tg_ui as ui, receipt_ai, recap
from .config import TELEGRAM_BOT_TOKEN, CLASS_ID, POCKET_CONFIG, PUBLIC_URL, APPROVAL_THRESHOLD
from .export_excel import generate_excel_report
from .formatters import format_rupiah, parse_nominal, parse_transaction_args, normalize_category
from .generate_chart import generate_financial_chart
from .runtime import db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("cekas.bot")
HTML = ParseMode.HTML


# ============================================================== helpers
def _markup(spec) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton(l, callback_data=d) for l, d in row] for row in spec])


async def show(update: Update, text: str, spec=None):
    """Edit pesan di tempat bila dari tombol, kirim baru bila dari perintah."""
    markup = _markup(spec) if spec else None
    q = update.callback_query
    if q:
        try:
            await q.edit_message_text(text, parse_mode=HTML, reply_markup=markup)
        except BadRequest as exc:
            if "not modified" not in str(exc).lower():
                raise
        return
    await update.effective_message.reply_text(text, parse_mode=HTML, reply_markup=markup)


async def say(update: Update, text: str, spec=None):
    """Selalu kirim pesan baru (struk, dokumen) tanpa menimpa layar navigasi."""
    await update.effective_message.reply_text(text, parse_mode=HTML, reply_markup=_markup(spec) if spec else None)


_answered: set = set()  # id callback yang sudah dijawab (Telegram hanya menerima satu jawaban)


async def toast(update: Update, text: str = "", alert: bool = False):
    q = update.callback_query
    if q and q.id not in _answered:
        _answered.add(q.id)
        await q.answer(text[:190], show_alert=alert)


def me(update: Update):
    u = update.effective_user
    return db.get_member(u.id) if u else None


def actor_name(update: Update) -> str:
    m = me(update)
    return m["nama"] if m else (update.effective_user.first_name or "Bendahara")


async def require_bendahara(update: Update) -> bool:
    if db.is_bendahara(update.effective_user.id):
        return True
    msg = "Ups, fitur ini khusus Bendahara 🙏 Aktifkan dengan /klaimbendahara <PIN>."
    if update.callback_query:
        await toast(update, msg, alert=True)
    else:
        await say(update, f"⛔ {_e(msg)}", [ui.nav()])
    return False


async def notify_many(context: ContextTypes.DEFAULT_TYPE, ids, text: str, spec=None):
    sent = 0
    for chat_id in ids:
        try:
            await context.bot.send_message(chat_id, text, parse_mode=HTML,
                                           reply_markup=_markup(spec) if spec else None)
            sent += 1
        except Exception as exc:  # pengguna belum membuka DM bot / memblokir
            logger.debug("Kirim ke %s gagal: %s", chat_id, exc)
    return sent


async def notify_wali(context, p: dict):
    """Beri tahu semua Wali Kelas bahwa ada pengajuan baru (dengan tombol setujui/tolak)."""
    if p:
        await notify_many(context, db.get_wali_ids(CLASS_ID), ui.pending_for_wali(p), ui.verify_buttons(p["id"]))


async def _after_decision(context, p: dict, res=None):
    """Kabari pengaju; pemasukan/pengeluaran yang disetujui juga disiarkan ke siswa."""
    if p["submitter_tg"]:
        await notify_many(context, [p["submitter_tg"]], ui.decision_card(p, res), [ui.nav()])
    if p["status"] == "verified" and p["kind"] == "tx" and res:
        await broadcast_tx(context, p["tx_type"], res, exclude=p["submitter_tg"])


async def broadcast_tx(context, kind: str, res: dict, exclude: int):
    await notify_many(context, db.get_notif_recipients(CLASS_ID, exclude_id=exclude), ui.tx_notice(kind, res))


# ============================================================== layar & perintah
async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await show(update, *ui.screen_menu(db, me(update)))


async def cmd_saldo(update, context):
    await show(update, *ui.screen_saldo(db))


async def cmd_riwayat(update, context):
    cat = normalize_category(context.args[0]) if context.args else None
    await show(update, *ui.screen_riwayat(db, 0, cat or "*"))


async def cmd_tagihan(update, context):
    week = db.active_week(CLASS_ID)
    if context.args and context.args[0].isdigit():
        week = int(context.args[0])
    await show(update, *ui.screen_tagihan(db, week, 0, db.is_bendahara(update.effective_user.id), me(update)))


async def cmd_profil(update, context):
    await show(update, *ui.screen_profil(db, me(update)))


async def cmd_insight(update, context):
    await show(update, *ui.screen_insight(db))


async def cmd_usulan(update, context):
    await show(update, *ui.screen_usulan(db, update.effective_user.id))


async def cmd_cek(update, context):
    v = db.verify_ledger(CLASS_ID)
    if v["ok"]:
        text = "\n".join([ui.head("INTEGRITAS BUKU KAS", "🔐"), "",
                          ui.pre([("Transaksi", str(v["tx_count"])), ("Hash utuh", "ya"), ("Saldo cocok", "ya")]),
                          f"Sidik: <code>{_e((db.ledger_head(CLASS_ID) or '-')[:16])}</code>"
                          + (f"\n<i>{v['legacy_unhashed']} transaksi lama dibuat sebelum fitur hash.</i>" if v["legacy_unhashed"] else "")])
    else:
        text = "\n".join([ui.head("INTEGRITAS BUKU KAS", "🚨"), ""] + [f"• {_e(e)}" for e in v["errors"][:8]])
    await show(update, text, [ui.nav(("🔄", "cek"))])


async def cmd_rekap(update, context):
    text = recap.wa_recap(db, CLASS_ID, public_url=PUBLIC_URL)
    await say(update, "\n".join([ui.head("REKAP WHATSAPP", "💬"), "<i>Ketuk teks di bawah untuk menyalin, lalu tempel di grup.</i>", "",
                                 f"<pre>{_e(text)}</pre>"]),
              [[("🔔 Teks pengingat iuran", "rem")], ui.nav()])


async def cmd_grafik(update, context):
    await update.effective_message.reply_photo(
        photo=generate_financial_chart(db, CLASS_ID),
        caption="\n".join([ui.head("ALOKASI KAS", "📊"), f"Total <code>{_e(format_rupiah(db.get_or_create_class(CLASS_ID)['saldo']))}</code>"]),
        parse_mode=HTML, reply_markup=_markup([ui.nav()]))


async def cmd_excel(update, context):
    await update.effective_message.reply_document(
        document=generate_excel_report(db, CLASS_ID), filename=f"Laporan_Kas_{CLASS_ID}.xlsx",
        caption="\n".join([ui.head("BUKU KAS", "📥"), "Ringkasan pos + Buku Kas Umum dengan saldo berjalan."]),
        parse_mode=HTML, reply_markup=_markup([ui.nav()]))


async def cmd_spj(update, context):
    if not await require_bendahara(update):
        return
    from .report import render_report
    import io
    html_doc = render_report(db, public_url=PUBLIC_URL)
    buf = io.BytesIO(html_doc.encode("utf-8"))
    await update.effective_message.reply_document(
        document=buf, filename=f"SPJ_Kas_{CLASS_ID}.html",
        caption="\n".join([ui.head("LAPORAN SPJ", "🧾"),
                           "Buka file di browser lalu <b>Cetak → Simpan sebagai PDF</b>. Siap ditandatangani Wali Kelas."]),
        parse_mode=HTML, reply_markup=_markup([ui.nav()]))


# ============================================================== anggota
async def cmd_daftar(update, context):
    if not context.args:
        await say(update, "\n".join([ui.head("DAFTAR", "🪪"), "", "Ketik: <code>/daftar NIS</code>", "Contoh: <code>/daftar 23241001</code>"]))
        return
    user = update.effective_user
    res = db.register_member(CLASS_ID, user.id, context.args[0].strip(), user.username or "")
    if not res["success"]:
        await say(update, "\n".join([ui.head("PENDAFTARAN DITOLAK", "❌"), "", _e(res["error"])]), [ui.nav()])
        return
    await say(update, "\n".join([ui.head("TERDAFTAR", "✅"), "",
                                 ui.pre([("Nama", res["nama"][:22]), ("NIS", res["nis"]), ("Peran", ui.ROLE_LABEL.get(res["role"], res["role"]))], vw=22),
                                 "Notifikasi kas aktif. Anda juga bisa memberi suara pada usulan pengeluaran."]),
              [[("🪪 Profil", "me")], ui.nav()])


async def cmd_klaim(update, context):
    if not context.args:
        await say(update, "\n".join([ui.head("AKSES BENDAHARA", "🔐"), "", "Ketik: <code>/klaimbendahara PIN</code>",
                                     "<i>Lakukan lewat chat pribadi agar PIN tidak terbaca orang lain.</i>"]))
        return
    pin = context.args[0].strip()
    user = update.effective_user
    if update.effective_chat.type != "private":
        try:
            await update.effective_message.delete()
        except Exception:
            pass
    res = db.claim_bendahara(CLASS_ID, user.id, pin, user.first_name or "Bendahara")
    if not res["success"]:
        await context.bot.send_message(update.effective_chat.id, "\n".join([ui.head("AKSES DITOLAK", "❌"), "", _e(res["error"])]), parse_mode=HTML)
        return
    await context.bot.send_message(
        update.effective_chat.id,
        "\n".join([ui.head("BENDAHARA AKTIF", "👑"), "", f"Halo <b>{_e(res['nama'])}</b>. Menu Bendahara sudah terbuka."]),
        parse_mode=HTML, reply_markup=_markup([[("➕ Catat Kas", "c"), ("📋 Tagihan", f"t:{db.active_week(CLASS_ID)}:0")], ui.nav()]))


async def cmd_klaimwali(update, context):
    if not context.args:
        await say(update, "\n".join([ui.head("AKSES WALI KELAS", "🎓"), "", "Ketik: <code>/klaimwali PIN</code>",
                                     "<i>Lakukan lewat chat pribadi agar PIN tidak terbaca orang lain.</i>"]))
        return
    user = update.effective_user
    if update.effective_chat.type != "private":
        try:
            await update.effective_message.delete()
        except Exception:
            pass
    res = db.claim_wali(CLASS_ID, user.id, context.args[0].strip(), user.first_name or "Wali Kelas")
    if not res["success"]:
        await context.bot.send_message(update.effective_chat.id, "\n".join([ui.head("AKSES DITOLAK", "❌"), "", _e(res["error"])]), parse_mode=HTML)
        return
    await context.bot.send_message(
        update.effective_chat.id,
        "\n".join([ui.head("WALI KELAS AKTIF", "🎓"), "", f"Halo <b>{_e(res['nama'])}</b>. Semua pengajuan kas akan menunggu persetujuan Bapak/Ibu."]),
        parse_mode=HTML, reply_markup=_markup([[("✅ Lihat pengajuan", "w")], ui.nav()]))


async def cmd_verifikasi(update, context):
    await show(update, *ui.screen_verifikasi(db, db.is_wali(update.effective_user.id)))


async def cmd_notif(update, context):
    if not me(update):
        await say(update, "⚠️ Daftar dulu: <code>/daftar NIS</code>")
        return
    desired = None
    if context.args:
        a = context.args[0].lower()
        desired = True if a in ("on", "aktif", "1") else False if a in ("off", "mati", "0") else None
    state = db.toggle_notif(update.effective_user.id, desired)
    await show(update, "\n".join([ui.head("NOTIFIKASI", "🔔"), "", f"Notifikasi kas: <b>{'aktif' if state else 'mati'}</b>"]),
               [[("🔔 Ganti", "notif")], ui.nav()])


async def cmd_lepas(update, context):
    if not await require_bendahara(update):
        return
    if not context.args:
        await say(update, "Ketik: <code>/lepas NIS</code>")
        return
    ok = db.release_nis(CLASS_ID, context.args[0].strip())
    await say(update, "✅ NIS dilepas. Pemilik sah dapat /daftar ulang." if ok else "⚠️ NIS tidak ditemukan atau milik Bendahara.", [ui.nav()])


# ============================================================== transaksi
async def _commit_or_propose(update: Update, context, kind: str, amount: int, cat: str, desc: str) -> None:
    """Satu pintu pencatatan: catat langsung, atau ajukan usulan bila nominalnya besar."""
    user = update.effective_user
    name = actor_name(update)
    if db.needs_approval(kind, amount):
        try:
            p = db.create_proposal(CLASS_ID, amount, cat, desc, name, user.id)
        except ValueError as err:
            await say(update, f"❌ {_e(str(err))}", [ui.nav()])
            return
        sent = await notify_many(context, db.get_voter_ids(CLASS_ID, user.id), ui.proposal_card(p), ui.proposal_kb(p))
        await say(update, "\n".join([ui.proposal_card(p), "", f"<i>Dikirim ke {sent} siswa untuk dimintai suara.</i>"]),
                  ui.proposal_kb(p, can_vote=False, can_cancel=True))
        return
    try:
        res = db.submit_transaction(CLASS_ID, kind, amount, cat, desc, name, user.id)
    except ValueError as err:
        await say(update, f"❌ {_e(str(err))}", [ui.nav()])
        return
    if res["pending"]:
        await say(update, ui.pending_card(res, "tx"),
                  [[(f"Batalkan pengajuan #{res['pending_id']}", f"pc:{res['pending_id']}")], ui.nav(("⏳ Antrean", "w"))])
        await notify_wali(context, db.get_pending(res["pending_id"]))
        return
    await say(update, ui.receipt_card(kind, res), [[(f"↩️ Koreksi #{res['tx_id']}", f"k:{res['tx_id']}")], ui.nav(("💰 Saldo", "s"))])
    await broadcast_tx(context, kind, res, exclude=user.id)


async def _quick_tx(update, context, kind: str):
    if not await require_bendahara(update):
        return
    if not db.check_and_mark_message(f"{update.effective_chat.id}:{update.effective_message.message_id}"):
        return
    parsed = parse_transaction_args(" ".join(context.args) if context.args else "")
    if not parsed["amount"]:
        ex = "/tambah 10k operasional Iuran Budi" if kind == "in" else "/kurang 25k operasional Beli spidol"
        await say(update, "\n".join([ui.head("FORMAT SALAH", "⚠️"), "", f"Contoh: <code>{ex}</code>", "Atau pakai tombol: /catat"]), [[("➕ Catat dengan tombol", "c")]])
        return
    desc = parsed["description"] or ("Pemasukan kas" if kind == "in" else "Pengeluaran kelas")
    await _commit_or_propose(update, context, kind, parsed["amount"], parsed["category"], desc)


async def cmd_tambah(update, context):
    await _quick_tx(update, context, "in")


async def cmd_kurang(update, context):
    await _quick_tx(update, context, "out")


async def cmd_bayar(update, context):
    if not await require_bendahara(update):
        return
    if not context.args:
        await show(update, *ui.screen_tagihan(db, db.active_week(CLASS_ID), 0, True, me(update)))
        return
    if not db.check_and_mark_message(f"{update.effective_chat.id}:{update.effective_message.message_id}"):
        return
    try:
        week = int(context.args[1]) if len(context.args) > 1 else db.active_week(CLASS_ID)
        first = not db.pending_dues_nis(CLASS_ID, week)
        res = db.submit_dues(CLASS_ID, context.args[0].strip(), week, actor_name(update), update.effective_user.id)
    except ValueError as err:
        await say(update, f"❌ {_e(str(err))}", [ui.nav()])
        return
    if res["pending"]:
        await say(update, ui.pending_card(res, "dues"),
                  [[(f"Batalkan pengajuan #{res['pending_id']}", f"pc:{res['pending_id']}")], ui.nav(("📋 Tagihan", f"t:{week}:0"))])
        if first:
            await notify_wali(context, db.get_pending(res["pending_id"]))
        return
    await say(update, ui.dues_card(res), [[(f"↩️ Koreksi #{res['tx_id']}", f"k:{res['tx_id']}")], ui.nav(("📋 Tagihan", f"t:{res['week_num']}:0"))])


async def cmd_koreksi(update, context):
    if not await require_bendahara(update):
        return
    if not context.args:
        await say(update, "\n".join([ui.head("KOREKSI", "↩️"), "", "Ketik: <code>/koreksi ID alasan</code>", "Contoh: <code>/koreksi 5 salah nominal</code>"]))
        return
    if not db.check_and_mark_message(f"{update.effective_chat.id}:{update.effective_message.message_id}"):
        return
    try:
        tx_id = int(context.args[0].lstrip("#"))
    except ValueError:
        await say(update, "⚠️ ID harus angka, mis. <code>/koreksi 5 salah ketik</code>")
        return
    await _do_reverse(update, tx_id, " ".join(context.args[1:]).strip() or "Koreksi oleh Bendahara", context)


async def _do_reverse(update: Update, tx_id: int, reason: str, context=None):
    try:
        res = db.submit_reverse(CLASS_ID, tx_id, reason, actor_name(update), update.effective_user.id)
    except ValueError as err:
        await say(update, f"❌ {_e(str(err))}", [ui.nav()])
        return
    if res["pending"]:
        await say(update, ui.pending_card(res, "reverse"),
                  [[(f"Batalkan pengajuan #{res['pending_id']}", f"pc:{res['pending_id']}")], ui.nav(("⏳ Antrean", "w"))])
        if context is not None:
            await notify_wali(context, db.get_pending(res["pending_id"]))
        return
    await say(update, ui.correction_card(res, reason), [ui.nav(("💰 Saldo", "s"))])


# ============================================================== wizard /catat
async def cmd_catat(update, context):
    if not await require_bendahara(update):
        return
    await show(update, *ui.screen_catat_type())


async def _on_wizard(update: Update, context, parts):
    if not await require_bendahara(update):
        return
    ud = context.user_data
    step = parts[1] if len(parts) > 1 else ""
    if step == "":
        ud.pop("draft", None)
        await show(update, *ui.screen_catat_type())
    elif step in ("in", "out"):
        ud["draft"] = {"type": step, "stage": "pos"}
        await show(update, *ui.screen_catat_pos(step))
    elif step == "p" and ud.get("draft"):
        ud["draft"].update(category=parts[2], stage="await_text")
        label = "pemasukan" if ud["draft"]["type"] == "in" else "pengeluaran"
        await show(update, "\n".join([ui.head("CATAT KAS", "➕"), "",
                                      f"Pos: <b>{_e(ui.pos_label(parts[2]))}</b>",
                                      f"Balas pesan ini dengan <b>nominal + keterangan</b> {label}.",
                                      "Contoh: <code>25k beli spidol</code>"]), [[("✖ Batal", "c:no")]])
        await update.effective_message.reply_text("✍️ Ketik nominal dan keterangan:", reply_markup=ForceReply(selective=True, input_field_placeholder="25k beli spidol"))
    elif step == "pos" and ud.get("draft") and ud["draft"].get("amount"):
        ud["draft"]["category"] = parts[2]
        await show(update, *ui.draft_card(ud["draft"], db.needs_approval(ud["draft"]["type"], ud["draft"]["amount"])))
    elif step == "ok":
        d = ud.pop("draft", None)
        if not d or not d.get("amount"):
            await toast(update, "Draf sudah diproses atau kedaluwarsa.", alert=True)
            return
        await toast(update, "Menyimpan…")
        await _commit_or_propose(update, context, d["type"], d["amount"], d["category"], d["description"])
        await show(update, "📝 Draf sudah diproses (lihat pesan di bawah).")
    elif step == "no":
        ud.pop("draft", None)
        await show(update, "✖ Dibatalkan.", [ui.nav(("➕ Catat lagi", "c"))])


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    d = context.user_data.get("draft")
    if not d or d.get("stage") != "await_text" or not update.effective_message or not update.effective_message.text:
        return
    parts = update.effective_message.text.strip().split(None, 1)
    amount = parse_nominal(parts[0]) if parts else None
    if not amount:
        await say(update, "⚠️ Nominal tidak terbaca. Contoh: <code>25k beli spidol</code>")
        return
    d.update(amount=amount, description=(parts[1] if len(parts) > 1 else "").strip()[:200]
             or ("Pemasukan kas" if d["type"] == "in" else "Pengeluaran kelas"), stage="confirm")
    await say(update, *ui.draft_card(d, db.needs_approval(d["type"], amount)))


async def on_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Foto nota -> draf pengeluaran (hanya chat pribadi Bendahara, perlu Ollama)."""
    if update.effective_chat.type != "private" or not db.is_bendahara(update.effective_user.id):
        return
    if not receipt_ai.enabled():
        await say(update, "ℹ️ Pembaca nota belum aktif. Isi <code>OLLAMA_URL</code> di .env (mis. Gemma via Ollama), atau catat manual: /catat")
        return
    wait = await update.effective_message.reply_text("⏳ Membaca nota…")
    photo = update.effective_message.photo[-1]
    data = bytes(await (await photo.get_file()).download_as_bytearray())
    r = await asyncio.to_thread(receipt_ai.extract_receipt, data)
    if not r:
        await wait.edit_text("⚠️ Nota tidak terbaca jelas. Foto lebih dekat dan terang, atau catat manual: /catat")
        return
    desc = (r["ringkasan"] or "Belanja") + (f" — {r['toko']}" if r["toko"] else "")
    context.user_data["draft"] = {"type": "out", "category": r["pos"], "amount": r["total"],
                                  "description": desc[:200], "stage": "confirm", "source": "Dibaca dari foto nota. Periksa sebelum menyimpan."}
    await wait.delete()
    await say(update, *ui.draft_card(context.user_data["draft"], db.needs_approval("out", r["total"])))


# ============================================================== voting
async def _on_vote(update: Update, context, pid: int, vote: str):
    uid = update.effective_user.id
    try:
        p = db.vote_proposal(pid, uid, "yes" if vote == "y" else "no")
    except ValueError as err:
        await toast(update, str(err), alert=True)
        cur = db.get_proposal(pid)
        if cur:
            mine = next((v["vote"] for v in cur["votes"] if v["telegram_id"] == uid), None)
            await show(update, ui.proposal_card(cur, mine), ui.proposal_kb(cur, can_vote=False))
        return
    await toast(update, "Suara tercatat ✓")
    await show(update, ui.proposal_card(p, "yes" if vote == "y" else "no"), ui.proposal_kb(p, can_vote=False))
    if p["status"] == "approved" and p.get("pending_id"):
        await notify_many(context, [p["proposer_tg"]],
                          ui.proposal_card(p) + "\n\n⏳ Disetujui siswa. Tinggal menunggu verifikasi Wali Kelas.", [ui.nav()])
        await notify_wali(context, db.get_pending(p["pending_id"]))
    elif p["status"] == "approved":
        await notify_many(context, [p["proposer_tg"]], ui.proposal_card(p), [ui.nav()])
        await broadcast_tx(context, "out", p["tx"], exclude=p["proposer_tg"])
    elif p["status"] in ("rejected", "failed"):
        await notify_many(context, [p["proposer_tg"]], ui.proposal_card(p), [ui.nav()])


# ============================================================== router tombol
async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    parts = (q.data or "").split(":")
    uid = update.effective_user.id
    key = parts[0]
    try:
        if key == "m":
            await show(update, *ui.screen_menu(db, me(update)))
        elif key == "s":
            await show(update, *ui.screen_saldo(db))
        elif key == "r":
            await show(update, *ui.screen_riwayat(db, int(parts[1]), parts[2]))
        elif key == "t":
            await show(update, *ui.screen_tagihan(db, int(parts[1]), int(parts[2]), db.is_bendahara(uid), me(update)))
        elif key == "pay":
            if not await require_bendahara(update):
                return
            try:
                first = not db.pending_dues_nis(CLASS_ID, int(parts[2]))
                res = db.submit_dues(CLASS_ID, parts[1], int(parts[2]), actor_name(update), uid)
                if res["pending"]:
                    await toast(update, f"⏳ {res['nama'].split()[0]}: dikirim ke guru")
                    if first:
                        await notify_wali(context, db.get_pending(res["pending_id"]))
                else:
                    await toast(update, f"✅ {res['nama'].split()[0]} lunas")
            except ValueError as err:
                await toast(update, str(err), alert=True)
            await show(update, *ui.screen_tagihan(db, int(parts[2]), int(parts[3]), True, me(update)))
        elif key == "w":
            await show(update, *ui.screen_verifikasi(db, db.is_wali(uid)))
        elif key in ("wv", "wr", "wd"):
            if not db.is_wali(uid):
                await toast(update, "Hanya Wali Kelas yang dapat memverifikasi. Aktifkan dengan /klaimwali PIN.", alert=True)
                return
            name = actor_name(update)
            try:
                if key == "wv":
                    r = db.verify_pending(int(parts[1]), uid, name)
                    if r["status"] == "verified":
                        await toast(update, "✅ Diverifikasi")
                    else:
                        await toast(update, f"Gagal dicatat: {r['note']}", alert=True)
                    await _after_decision(context, r["pending"], r["result"])
                elif key == "wr":
                    p = db.reject_pending(int(parts[1]), uid, name, "Ditolak oleh Wali Kelas")
                    await toast(update, "Pengajuan ditolak")
                    await _after_decision(context, p)
                else:
                    week = int(parts[1])
                    before = db.list_pending(CLASS_ID, "pending", "dues")
                    r = db.verify_dues_week(CLASS_ID, week, uid, name)
                    await toast(update, f"✅ {r['verified']} iuran diverifikasi ({format_rupiah(r['total'])})", alert=bool(r["failed"]))
                    for sub_tg in {p["submitter_tg"] for p in before if p["week_num"] == week and p["submitter_tg"]}:
                        await notify_many(context, [sub_tg], "\n".join([
                            ui.head("IURAN DIVERIFIKASI", "✅"), "",
                            f"Iuran minggu {week}: <b>{r['verified']}</b> siswa disetujui <b>{_e(name)}</b> ✓",
                            f"Total <code>{_e(format_rupiah(r['total']))}</code> masuk ke kas."]), [ui.nav()])
            except ValueError as err:
                await toast(update, str(err), alert=True)
            await show(update, *ui.screen_verifikasi(db, True))
        elif key == "pc":
            try:
                db.cancel_pending(int(parts[1]), uid)
                await toast(update, "Pengajuan dibatalkan")
            except ValueError as err:
                await toast(update, str(err), alert=True)
            await show(update, *ui.screen_verifikasi(db, db.is_wali(uid)))
        elif key == "me":
            await show(update, *ui.screen_profil(db, me(update)))
        elif key == "notif":
            if me(update):
                state = db.toggle_notif(uid)
                await toast(update, f"Notifikasi {'aktif' if state else 'mati'}")
            await show(update, *ui.screen_profil(db, me(update)))
        elif key == "i":
            await show(update, *ui.screen_insight(db))
        elif key == "u":
            await show(update, *ui.screen_usulan(db, uid))
        elif key == "cek":
            await cmd_cek(update, context)
        elif key == "v":
            await _on_vote(update, context, int(parts[1]), parts[2])
        elif key == "x":
            try:
                p = db.cancel_proposal(int(parts[1]), uid)
                await toast(update, "Usulan dibatalkan")
                await show(update, ui.proposal_card(p), ui.proposal_kb(p))
            except ValueError as err:
                await toast(update, str(err), alert=True)
        elif key == "k":   # minta konfirmasi koreksi
            if not await require_bendahara(update):
                return
            await show(update, "\n".join([ui.head("KOREKSI", "↩️"), "", f"Batalkan mutasi <code>#{int(parts[1])}</code>?",
                                          "<i>Dibuat catatan koreksi baru; data lama tidak dihapus.</i>"]),
                       [[("Ya, koreksi", f"kk:{int(parts[1])}"), ("Tidak", "m")]])
        elif key == "kk":
            if not await require_bendahara(update):
                return
            await toast(update, "Memproses…")
            await _do_reverse(update, int(parts[1]), "Dikoreksi via tombol", context)
            await show(update, *ui.screen_saldo(db))
        elif key == "c":
            await _on_wizard(update, context, parts)
        elif key == "gr":
            await toast(update)
            await cmd_grafik(update, context)
        elif key == "xl":
            await toast(update)
            await cmd_excel(update, context)
        elif key == "rk":
            await toast(update)
            await cmd_rekap(update, context)
        elif key == "rem":
            await toast(update)
            await say(update, "\n".join([ui.head("PENGINGAT IURAN", "🔔"), "<i>Salin lalu kirim ke grup.</i>", "",
                                         f"<pre>{_e(recap.wa_reminder(db, CLASS_ID))}</pre>"]), [ui.nav()])
        elif key == "spj":
            await toast(update)
            await cmd_spj(update, context)
        else:
            await toast(update)
    finally:
        try:
            await toast(update)  # pastikan spinner tombol berhenti
        except Exception:
            pass
        _answered.discard(q.id)


async def on_error(update, context: ContextTypes.DEFAULT_TYPE):
    logger.exception("Error handler", exc_info=context.error)
    try:
        if isinstance(update, Update) and update.effective_message:
            await update.effective_message.reply_text("⚠️ Terjadi kesalahan. Coba lagi, atau ketik /start.")
    except Exception:
        pass


# ============================================================== setup
COMMANDS_ALL = [
    ("start", "Menu utama"), ("saldo", "Saldo & pos anggaran"), ("riwayat", "Riwayat transaksi"),
    ("tagihan", "Status iuran mingguan"), ("usulan", "Usulan pengeluaran & suara"),
    ("insight", "Prakiraan & peringatan"), ("rekap", "Rekap siap tempel ke WhatsApp"),
    ("grafik", "Grafik alokasi"), ("excel", "Unduh buku kas Excel"), ("cek", "Verifikasi buku kas"),
    ("daftar", "Daftar dengan NIS"), ("profil", "Profil & iuran saya"), ("notif", "Atur notifikasi"),
    ("verifikasi", "Antrean verifikasi Wali Kelas"), ("klaimwali", "Aktivasi Wali Kelas dengan PIN"),
]
COMMANDS_BENDAHARA = COMMANDS_ALL + [
    ("catat", "Catat kas dengan tombol"), ("tambah", "Catat pemasukan cepat"), ("kurang", "Catat pengeluaran cepat"),
    ("bayar", "Tandai iuran lunas"), ("koreksi", "Koreksi transaksi"), ("spj", "Laporan SPJ"), ("lepas", "Lepas ikatan NIS"),
]


async def _post_init(application: Application):
    try:
        await application.bot.set_my_commands([BotCommand(c, d) for c, d in COMMANDS_ALL])
        me_ = await application.bot.get_me()
        logger.info("Bot @%s siap melayani kelas %s", me_.username, CLASS_ID)
    except Exception as exc:
        logger.warning("Gagal mendaftarkan command: %s", exc)


def build_telegram_app() -> Application:
    if not TELEGRAM_BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN belum diset di file .env!")
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).post_init(_post_init).build()
    handlers = {
        ("start", "help", "menu"): cmd_start, "saldo": cmd_saldo, "alokasi": cmd_saldo, "riwayat": cmd_riwayat,
        "tagihan": cmd_tagihan, "profil": cmd_profil, "insight": cmd_insight, "usulan": cmd_usulan,
        "cek": cmd_cek, "rekap": cmd_rekap, "grafik": cmd_grafik, "excel": cmd_excel, "spj": cmd_spj,
        "daftar": cmd_daftar, "klaimbendahara": cmd_klaim, "notif": cmd_notif, "lepas": cmd_lepas,
        "klaimwali": cmd_klaimwali, "verifikasi": cmd_verifikasi, "catat": cmd_catat, "tambah": cmd_tambah, "kurang": cmd_kurang, "bayar": cmd_bayar, "koreksi": cmd_koreksi,
    }
    for names, fn in handlers.items():
        app.add_handler(CommandHandler(list(names) if isinstance(names, tuple) else names, fn))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(MessageHandler(filters.PHOTO, on_photo))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))
    app.add_error_handler(on_error)
    return app


def run_bot_polling():
    app = build_telegram_app()
    path = db.backup()
    if path:
        logger.info("Backup database: %s", path)
    logger.info("Memulai polling untuk kelas %s...", CLASS_ID)
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    run_bot_polling()

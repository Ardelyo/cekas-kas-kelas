"""
Sistem tampilan Telegram CEKAS. Murni (tanpa import telegram) agar mudah diuji.

Bahasa visual yang dipakai di SEMUA layar:
  • Judul   : <b>IKON JUDUL</b> · KELAS
  • Angka   : selalu dalam blok <pre> rata kanan (font monospace -> kolom lurus)
  • Progres : ▰▰▰▱▱ (10 kotak)
  • Status  : ✅ lunas · ⏳ belum · 📥 masuk · 📤 keluar · ↩️ koreksi
  • Peringatan: 🔴 genting · 🟠 perhatian · ⚪ info
  • Navigasi: baris terakhir tombol selalu ada [🏠 Menu]
Tombol dinyatakan sebagai List[List[(label, callback_data)]]; bot yang mengubahnya jadi InlineKeyboardMarkup.
"""

import html
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from .config import CLASS_ID, SCHOOL_NAME, POCKET_CONFIG, APPROVAL_THRESHOLD
from .formatters import WIB, format_rupiah, utc_to_wib
from . import insights as insights_mod

E = html.escape
Button = Tuple[str, str]
Keyboard = List[List[Button]]
Screen = Tuple[str, Keyboard]

MENU_BTN: Button = ("🏠 Menu", "m")
PAGE = 6
PAY_PAGE = 8
LEVEL_ICON = {"crit": "🔴", "warn": "🟠", "info": "⚪"}
ROLE_LABEL = {"bendahara": "Bendahara", "wali_kelas": "Wali Kelas", "siswa": "Siswa"}
STATUS_LABEL = {"open": "⏳ Menunggu suara", "approved": "✅ Disetujui", "rejected": "❌ Ditolak",
                "cancelled": "⚪ Dibatalkan", "failed": "⚠️ Gagal dicatat"}


# ------------------------------------------------------------------ primitives
def head(title: str, icon: str = "") -> str:
    return f"<b>{icon + ' ' if icon else ''}{E(title)}</b> · {E(CLASS_ID)}"


def pre(rows: List[Tuple[str, str]], lw: int = 11, vw: int = 14) -> str:
    """Blok monospace 'label ....... nilai' dengan nilai rata kanan."""
    return "<pre>" + "\n".join(f"{E(l):<{lw}}{E(v):>{vw}}" for l, v in rows) + "</pre>"


def bar(part: int, total: int, width: int = 10) -> str:
    if total <= 0 or part <= 0:
        return "▱" * width
    filled = max(1, min(round(part / total * width), width))
    return "▰" * filled + "▱" * (width - filled)


def foot() -> str:
    return f"<i>{datetime.now(WIB).strftime('%d/%m %H.%M')} WIB</i>"


def nav(*extra: Button) -> List[Button]:
    return [*extra, MENU_BTN]


def pos_label(cat: str) -> str:
    m = POCKET_CONFIG.get(cat)
    return f"{m['icon']} {m['short']}" if m else cat


def tx_icon(t: str) -> str:
    return {"in": "📥", "out": "📤"}.get(t, "↩️")


# --------------------------------------------------------------------- screens
def screen_menu(db, member: Optional[Dict[str, Any]]) -> Screen:
    cls = db.get_or_create_class(CLASS_ID)
    wk = db.active_week(CLASS_ID)
    dues = db.get_dues_status(CLASS_ID, wk)
    is_b = bool(member and member["role"] == "bendahara")
    n_open = len(db.list_proposals(CLASS_ID, "open"))

    if member:
        who = f"Halo, <b>{E(member['nama'])}</b> 👋 · {ROLE_LABEL.get(member['role'], member['role'])}"
    else:
        who = ("Yuk daftar dulu 🙌 Ketik <code>/daftar NIS</code> biar bisa lihat status iuran "
               "dan ikut memberi suara.")
    text = "\n".join([
        head("CEKAS", "🧾"), f"<i>{E(SCHOOL_NAME)}</i>", "", who, "",
        pre([("Saldo kas", format_rupiah(cls["saldo"])),
             (f"Iuran mg-{wk}", f"{dues['paid_count']}/{dues['total_students']} lunas"),
             ("Usulan", f"{n_open} terbuka")]),
        ("🎉 Iuran minggu ini lunas semua. Keren!" if dues["unpaid_count"] == 0
         else f"⏳ Tinggal {dues['unpaid_count']} teman lagi yang belum bayar."),
        foot(),
    ])
    kb: Keyboard = [
        [("💰 Saldo", "s"), ("📑 Riwayat", "r:0:*")],
        [("📋 Tagihan", f"t:{wk}:0"), ("🪪 Profil", "me")],
        [(f"🗳 Usulan{f' ({n_open})' if n_open else ''}", "u"), ("💡 Insight", "i")],
        [("📊 Grafik", "gr"), ("📥 Excel", "xl"), ("💬 Rekap WA", "rk")],
    ]
    if is_b:
        kb.insert(0, [("➕ Catat Kas", "c"), ("🧾 Laporan SPJ", "spj")])
    return text, kb


def screen_saldo(db) -> Screen:
    cls = db.get_or_create_class(CLASS_ID)
    saldo = cls["saldo"]
    lines = [head("SALDO KAS", "💰"), "", pre([("Total", format_rupiah(saldo))], vw=16), ""]
    for key, meta in POCKET_CONFIG.items():
        val = cls["alokasi"].get(key, 0)
        pct = f"{val / saldo * 100:.0f}%" if saldo > 0 and val > 0 else "0%"
        lines.append(f"{meta['dot']} {meta['icon']} <b>{E(meta['short'])}</b>  <code>{bar(max(val, 0), saldo)}</code> {pct}")
        lines.append(f"      <code>{E(format_rupiah(val))}</code> <i>· {E(meta['description'])}</i>")
    v = db.verify_ledger(CLASS_ID)
    lines += ["", ("🔐 Buku kas aman, tidak ada yang diubah ✨" if v["ok"] else "🚨 <b>Ada yang perlu dicek di buku kas</b>, ketik /cek"), foot()]
    return "\n".join(lines), [nav(("🔄 Segarkan", "s"))]


def screen_riwayat(db, page: int = 0, cat: str = "*") -> Screen:
    cat_f = None if cat == "*" else cat
    rows = db.get_recent_transactions(CLASS_ID, limit=500, category=cat_f)
    pages = max(1, -(-len(rows) // PAGE))
    page = max(0, min(page, pages - 1))
    chunk = rows[page * PAGE:(page + 1) * PAGE]
    title = "RIWAYAT" + (f" · {POCKET_CONFIG[cat]['short'].upper()}" if cat_f else "")
    lines = [head(title, "📑"), ""]
    if not chunk:
        lines.append("<i>Belum ada transaksi.</i>")
    for t in chunk:
        sign = "+" if t["type"] == "in" else "−" if t["type"] == "out" else "↩ "
        void = " <i>(dibatalkan)</i>" if t["is_reversal"] and t["type"] != "correction" else ""
        lines.append(f"{tx_icon(t['type'])} <b>#{t['id']}</b> <code>{sign}{E(format_rupiah(t['amount']))}</code> "
                     f"· {E(POCKET_CONFIG.get(t['category'], {}).get('short', t['category']))}{void}")
        lines.append(f"      {E(t['description'])}")
        lines.append(f"      <i>{E(t['input_by'])} · {utc_to_wib(t['created_at'])}</i>")
    lines += ["", f"<i>Halaman {page + 1}/{pages}</i>"]
    chips = [("Semua" if cat == "*" else "Semua", "r:0:*")] + [
        (("● " if cat == k else "") + m["icon"], f"r:0:{k}") for k, m in POCKET_CONFIG.items()]
    pager: List[Button] = []
    if page > 0:
        pager.append(("◀", f"r:{page - 1}:{cat}"))
    if page < pages - 1:
        pager.append(("▶", f"r:{page + 1}:{cat}"))
    kb = [chips]
    if pager:
        kb.append(pager)
    kb.append(nav())
    return "\n".join(lines), kb


def screen_tagihan(db, week: int, page: int, can_pay: bool, member: Optional[Dict[str, Any]]) -> Screen:
    week = max(1, min(52, week))
    st = db.get_dues_status(CLASS_ID, week)
    nominal = db.get_or_create_class(CLASS_ID)["nominal_iuran"]
    lines = [head(f"IURAN MINGGU {week}", "📋"), "",
             f"<code>{bar(st['paid_count'], st['total_students'], 12)}</code> "
             f"<b>{st['paid_count']}/{st['total_students']}</b> lunas · {E(format_rupiah(nominal))}/siswa", ""]
    if member and member.get("nis") and member["role"] != "wali_kelas":
        mine = member["nis"] in {s["nis"] for s in st["paid_students"]}
        lines += [f"Anda: {'✅ lunas' if mine else '⏳ belum bayar'}", ""]
    unpaid = st["unpaid_students"]
    if unpaid:
        lines.append("<b>Belum bayar</b> · yuk disusul ya 🙏")
        lines += [f"⏳ {E(s['nama_resmi'])}" for s in unpaid]
    else:
        lines += ["🎉 <b>Semua sudah lunas!</b>", f"Keren banget, {E(CLASS_ID)}. Terima kasih ya semuanya 🙏"]
    if st["paid_students"]:
        lines += ["", f"<i>Lunas: {E(', '.join(s['nama_resmi'].split()[0] for s in st['paid_students']))}</i>"]

    kb: Keyboard = []
    if can_pay and unpaid:
        pages = max(1, -(-len(unpaid) // PAY_PAGE))
        page = max(0, min(page, pages - 1))
        row: List[Button] = []
        for s in unpaid[page * PAY_PAGE:(page + 1) * PAY_PAGE]:
            row.append((f"💵 {s['nama_resmi'].split()[0]}", f"pay:{s['nis']}:{week}:{page}"))
            if len(row) == 2:
                kb.append(row)
                row = []
        if row:
            kb.append(row)
        if pages > 1:
            pager = []
            if page > 0:
                pager.append(("◀ Hal", f"t:{week}:{page - 1}"))
            pager.append((f"{page + 1}/{pages}", f"t:{week}:{page}"))
            if page < pages - 1:
                pager.append(("Hal ▶", f"t:{week}:{page + 1}"))
            kb.append(pager)
        lines += ["", "<i>Ketuk nama untuk menandai lunas.</i>"]
    kb.append([(f"◀ Mg {week - 1}", f"t:{week - 1}:0"), (f"Mg {week + 1} ▶", f"t:{week + 1}:0")]
              if 1 < week < 52 else
              [("Mg 2 ▶", "t:2:0")] if week == 1 else [("◀ Mg 51", "t:51:0")])
    kb.append(nav(("🔄", f"t:{week}:{page}")))
    return "\n".join(lines), kb


def screen_profil(db, member: Optional[Dict[str, Any]]) -> Screen:
    if not member:
        return ("\n".join([head("PROFIL", "🪪"), "", "Anda belum terdaftar.",
                           "Ketik <code>/daftar NIS</code> (NIS 8 digit)."]), [nav()])
    lines = [head("PROFIL", "🪪"), "",
             pre([("Nama", member["nama"][:22]), ("NIS", member.get("nis") or "-"),
                  ("Peran", ROLE_LABEL.get(member["role"], member["role"])),
                  ("Notifikasi", "aktif" if member.get("notif_enabled") else "mati")], vw=22)]
    if member.get("nis") and member["role"] != "wali_kelas":
        wk = db.active_week(CLASS_ID)
        start = max(1, wk - 7)
        hist = db.get_student_dues_history(CLASS_ID, member["nis"], max_weeks=wk)[start - 1:]
        paid = sum(h["is_paid"] for h in hist)
        lines += ["", f"<b>Iuran minggu {start}–{wk}</b>  ({paid}/{len(hist)} lunas)",
                  "<code>" + " ".join(f"{h['week_num']:>2}{'●' if h['is_paid'] else '○'}" for h in hist) + "</code>",
                  "<i>● lunas  ○ belum</i>"]
    kb = [[("🔔 Notifikasi: ganti", "notif")], nav()]
    return "\n".join(lines), kb


def screen_insight(db) -> Screen:
    items = insights_mod.build_insights(db, CLASS_ID)
    lines = [head("INSIGHT", "💡"), ""]
    lines += [f"{LEVEL_ICON[i['level']]} {E(i['text'])}" for i in items] or ["<i>Belum ada insight.</i>"]
    lines += ["", foot()]
    return "\n".join(lines), [nav(("🔄", "i"))]


# ------------------------------------------------------------------- proposals
def proposal_card(p: Dict[str, Any], my_vote: Optional[str] = None) -> str:
    meta = POCKET_CONFIG.get(p["category"], {})
    lines = [head(f"USULAN #{p['id']}", "🗳"), "",
             pre([("Nominal", format_rupiah(p["amount"])), ("Pos", meta.get("short", p["category"])),
                  ("Pengusul", p["proposed_by"][:18])], vw=18),
             f"📝 {E(p['description'])}", "",
             f"{STATUS_LABEL.get(p['status'], p['status'])}",
             f"Setuju <b>{p['yes']}</b>/{p['needed']} · Tolak <b>{p['no']}</b>"]
    if p["status"] == "failed" and p.get("note"):
        lines.append(f"<i>{E(p['note'])}</i>")
    if p["status"] == "approved" and p.get("tx_id"):
        lines.append(f"Tercatat sebagai mutasi <code>#{p['tx_id']}</code>")
    if my_vote:
        lines.append(f"<i>Suara Anda: {'✅ setuju' if my_vote == 'yes' else '❌ tolak'}</i>")
    return "\n".join(lines)


def proposal_kb(p: Dict[str, Any], can_vote: bool = True, can_cancel: bool = False) -> Keyboard:
    kb: Keyboard = []
    if p["status"] == "open":
        if can_vote:
            kb.append([("✅ Setuju", f"v:{p['id']}:y"), ("❌ Tolak", f"v:{p['id']}:n")])
        if can_cancel:
            kb.append([("Batalkan usulan", f"x:{p['id']}")])
    kb.append(nav(("🗳 Semua usulan", "u")))
    return kb


def screen_usulan(db, uid: int) -> Screen:
    props = db.list_proposals(CLASS_ID, "open")
    lines = [head("USULAN PENGELUARAN", "🗳"), "",
             f"<i>Pengeluaran ≥ {E(format_rupiah(APPROVAL_THRESHOLD))} butuh persetujuan siswa.</i>" if APPROVAL_THRESHOLD
             else "<i>Persetujuan pengeluaran nonaktif.</i>", ""]
    kb: Keyboard = []
    if not props:
        lines.append("Belum ada usulan 🎈 Belanja besar akan muncul di sini untuk disetujui bareng-bareng.")
    is_b = db.is_bendahara(uid)
    for p in props[:5]:
        mine = next((v["vote"] for v in p["votes"] if v["telegram_id"] == uid), None)
        lines.append(f"<b>#{p['id']}</b> <code>{E(format_rupiah(p['amount']))}</code> · {E(p['description'])}")
        lines.append(f"      oleh {E(p['proposed_by'])} · setuju {p['yes']}/{p['needed']} · tolak {p['no']}"
                     + (f" · Anda: {'✅' if mine == 'yes' else '❌'}" if mine else ""))
        if not mine and p["proposer_tg"] != uid:
            kb.append([(f"✅ #{p['id']}", f"v:{p['id']}:y"), (f"❌ #{p['id']}", f"v:{p['id']}:n")])
        elif p["proposer_tg"] == uid or is_b:
            kb.append([(f"Batalkan #{p['id']}", f"x:{p['id']}")])
    kb.append(nav(("🔄", "u")))
    return "\n".join(lines), kb


# -------------------------------------------------------------------- receipts
def receipt_card(kind: str, res: Dict[str, Any]) -> str:
    title, sign = ("PEMASUKAN DICATAT", "+") if kind == "in" else ("PENGELUARAN DICATAT", "−")
    meta = POCKET_CONFIG[res["category"]]
    return "\n".join([
        head(title, "✅") + f" · <code>#{res['tx_id']}</code>", "",
        pre([("Nominal", f"{sign}{format_rupiah(res['amount'])}"), ("Pos", meta["short"]),
             ("Saldo pos", format_rupiah(res["saldo_pocket"])), ("Total kas", format_rupiah(res["saldo_total"]))]),
        f"📝 {E(res['description'])}",
        f"<i>oleh {E(res['input_by'])} · tercatat rapi ✨</i>",
    ])


def dues_card(res: Dict[str, Any]) -> str:
    return "\n".join([
        head("IURAN LUNAS", "✅") + f" · <code>#{res['tx_id']}</code>", "",
        pre([("Siswa", res["nama"][:22]), ("Minggu", f"ke-{res['week_num']}"),
             ("Nominal", f"+{format_rupiah(res['nominal'])}"), ("Total kas", format_rupiah(res["saldo_total"]))], vw=22),
        "🙌 Makasih sudah bayar!",
    ])


def correction_card(res: Dict[str, Any], reason: str) -> str:
    return "\n".join([
        head("KOREKSI DICATAT", "↩️") + f" · <code>#{res['correction_id']}</code>", "",
        pre([("Membatalkan", f"#{res['reversed_tx_id']}"), ("Nominal", format_rupiah(res["amount"])),
             ("Saldo pos", format_rupiah(res["saldo_pocket"])), ("Total kas", format_rupiah(res["saldo_total"]))]),
        f"📝 {E(res['orig_description'])}", f"Alasan: {E(reason)}",
    ])


def tx_notice(kind: str, res: Dict[str, Any]) -> str:
    meta = POCKET_CONFIG[res["category"]]
    sign = "+" if kind == "in" else "−"
    title = "KAS MASUK" if kind == "in" else "BELANJA KELAS"
    return "\n".join([
        head(title, tx_icon(kind)), "",
        f"<code>{sign}{E(format_rupiah(res['amount']))}</code> · {meta['icon']} {E(meta['short'])}",
        f"📝 {E(res['description'])} <i>({E(res['input_by'])})</i>",
        f"Total kas: <code>{E(format_rupiah(res['saldo_total']))}</code>",
    ])


# ---------------------------------------------------------------------- wizard
def screen_catat_type() -> Screen:
    return ("\n".join([head("CATAT KAS", "➕"), "", "Pilih jenis transaksi."]),
            [[("📥 Pemasukan", "c:in"), ("📤 Pengeluaran", "c:out")], nav()])


def screen_catat_pos(kind: str) -> Screen:
    label = "pemasukan" if kind == "in" else "pengeluaran"
    kb = [[(f"{m['icon']} {m['short']}", f"c:p:{k}") for k, m in list(POCKET_CONFIG.items())[i:i + 2]]
          for i in (0, 2)]
    kb.append(nav(("◀ Kembali", "c")))
    return "\n".join([head("CATAT KAS", "➕"), "", f"Pos mana untuk <b>{label}</b> ini?"]), kb


def draft_card(d: Dict[str, Any], needs_approval: bool = False) -> Screen:
    sign = "+" if d["type"] == "in" else "−"
    rows = [("Jenis", "Pemasukan" if d["type"] == "in" else "Pengeluaran"),
            ("Nominal", f"{sign}{format_rupiah(d['amount'])}"), ("Pos", POCKET_CONFIG[d["category"]]["short"])]
    lines = [head("KONFIRMASI", "📝"), "", pre(rows), f"📝 {E(d['description'])}"]
    if d.get("source"):
        lines.append(f"<i>{E(d['source'])}</i>")
    if needs_approval:
        lines += ["", f"🗳 Nominal ini butuh persetujuan siswa; akan dikirim sebagai <b>usulan</b>."]
    kb: Keyboard = [[("🗳 Ajukan usulan" if needs_approval else "✅ Simpan", "c:ok"), ("✖ Batal", "c:no")]]
    kb.append([(("● " if d["category"] == k else "") + m["icon"], f"c:pos:{k}") for k, m in POCKET_CONFIG.items()])
    return "\n".join(lines), kb

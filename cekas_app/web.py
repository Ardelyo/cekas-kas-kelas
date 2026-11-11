"""
CEKAS Web: dashboard publik read-only, aksi tulis butuh login admin, webhook Telegram bertanda-tangan.
"""

import hashlib
import hmac
import logging
import secrets
import time
from contextlib import asynccontextmanager
from types import SimpleNamespace
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, Request, Form, HTTPException, Depends, Query
from fastapi.responses import (
    HTMLResponse, StreamingResponse, RedirectResponse, JSONResponse, FileResponse, PlainTextResponse,
)
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton

from . import insights, recap, runtime, tg_ui
from .config import (
    CLASS_ID, SCHOOL_NAME, POCKET_CONFIG, TELEGRAM_BOT_TOKEN, PUBLIC_URL, APPROVAL_THRESHOLD, APPROVALS_NEEDED,
    WEB_ADMIN_PASSWORD, WEB_ADMIN_NAME, WEB_WALI_NAME, SECRET_KEY, TELEGRAM_WEBHOOK_SECRET,
)
from .bot import db, build_telegram_app, _post_init, _after_decision, notify_many
from .database import WEB_WALI_ID
from .export_excel import generate_excel_report
from .formatters import format_rupiah, parse_nominal, format_wib, WIB
from .generate_chart import generate_financial_chart
from .report import render_report
from .viewmodel import ledger_rows, pocket_view, spark_svg, qr_svg, students_view

logger = logging.getLogger("cekas.web")

tg_app = None
COOKIE_NAME = "cekas_session"
GURU_COOKIE = "cekas_guru"
SESSION_TTL = 8 * 3600
_SECRET = (SECRET_KEY or secrets.token_hex(32)).encode()
_login_fails: dict = {}  # ip -> (count, locked_until)
_guru_fails: dict = {}   # idem, untuk login Wali Kelas
WEB_TELEGRAM_ID = 0      # 0 = aksi dari web (bukan akun Telegram)


# ------------------------------------------------------------------ sesi admin & guru
def _sign(expiry: int, scope: str = "") -> str:
    # scope kosong = sesi Bendahara (format lama); "guru" memakai tanda tangan berbeda,
    # jadi cookie Bendahara tidak pernah sah sebagai cookie guru, dan sebaliknya.
    msg = f"{scope}:{expiry}" if scope else str(expiry)
    return f"{expiry}.{hmac.new(_SECRET, msg.encode(), hashlib.sha256).hexdigest()}"


def _valid_session(token, scope: str = "") -> bool:
    if not token or "." not in token:
        return False
    exp_s, _, sig = token.partition(".")
    try:
        exp = int(exp_s)
    except ValueError:
        return False
    msg = f"{scope}:{exp_s}" if scope else exp_s
    expected = hmac.new(_SECRET, msg.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected) and exp > time.time()


def is_admin(request: Request) -> bool:
    return bool(WEB_ADMIN_PASSWORD) and _valid_session(request.cookies.get(COOKIE_NAME))


def require_admin(request: Request):
    if not is_admin(request):
        raise HTTPException(status_code=303, headers={"Location": "/login"})


def guru_enabled() -> bool:
    return db.wali_pin_ready(CLASS_ID)


def is_guru(request: Request) -> bool:
    return guru_enabled() and _valid_session(request.cookies.get(GURU_COOKIE), "guru")


def require_guru(request: Request):
    if not is_guru(request):
        raise HTTPException(status_code=303, headers={"Location": "/guru/login"})


def _back(msg: str = "", err: bool = False, to: str = "/", frag: str = "") -> RedirectResponse:
    sep = "&" if "?" in to else "?"
    suffix = f"{sep}{'err' if err else 'msg'}={quote(msg[:200])}" if msg else ""
    return RedirectResponse(url=f"{to}{suffix}{'#' + frag if frag else ''}", status_code=303)


def _public_url(request: Request) -> str:
    return PUBLIC_URL or str(request.base_url).rstrip("/")


# --------------------------------------------------------------------- aplikasi
@asynccontextmanager
async def lifespan(app: FastAPI):
    global tg_app
    if not WEB_ADMIN_PASSWORD:
        logger.warning("WEB_ADMIN_PASSWORD kosong: dashboard hanya-baca, aksi tulis web nonaktif.")
    if not TELEGRAM_WEBHOOK_SECRET:
        logger.warning("TELEGRAM_WEBHOOK_SECRET kosong: endpoint webhook menolak semua request.")
    try:
        db.backup()
    except Exception as exc:
        logger.warning("Backup awal gagal: %s", exc)

    if TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET:
        try:
            tg_app = build_telegram_app()
            await tg_app.initialize()
            await _post_init(tg_app)
            await tg_app.start()
            logger.info("Telegram webhook handler siap.")
        except Exception as exc:
            logger.warning("Gagal menginisialisasi Telegram App: %s", exc)
    yield
    if tg_app:
        try:
            await tg_app.stop()
            await tg_app.shutdown()
        except Exception:
            pass
    runtime.shutdown()  # unggah snapshot terakhir ke Cloud Storage


app = FastAPI(title="CEKAS", version="3.0.0", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
templates.env.filters["idr"] = lambda n: format_rupiah(n).replace("Rp ", "").replace("-", "−")


@app.get("/sw.js", include_in_schema=False)
async def service_worker():
    return FileResponse(STATIC_DIR / "sw.js", media_type="application/javascript",
                        headers={"Service-Worker-Allowed": "/", "Cache-Control": "no-cache"})


def _approval_note() -> str:
    if APPROVAL_THRESHOLD <= 0:
        return "Persetujuan pengeluaran nonaktif."
    return f"Pengeluaran ≥ {format_rupiah(APPROVAL_THRESHOLD)} perlu persetujuan {APPROVALS_NEEDED} siswa."


@app.get("/", response_class=HTMLResponse)
async def dashboard_view(request: Request, week: int = Query(0, ge=0, le=52),
                         msg: str = "", err: str = ""):
    cls = db.get_or_create_class(CLASS_ID)
    cls.pop("pin_bendahara", None)
    active = db.active_week(CLASS_ID)
    week = week or active
    weeks = list(range(1, min(52, max(active, week) + 2) + 1))
    col_totals = db.get_dues_matrix(CLASS_ID, weeks)["col_totals"]
    ledger = db.verify_ledger(CLASS_ID)
    head = db.ledger_head(CLASS_ID)
    props = db.list_proposals(CLASS_ID, "open")
    pend_all = db.list_pending(CLASS_ID) if db.require_teacher else []
    pend_tx = [dict(p, cat_label=POCKET_CONFIG.get(p["category"] or "", {}).get("short", "")) for p in pend_all if p["kind"] != "dues"]
    dues_weeks = {}
    for p in pend_all:
        if p["kind"] == "dues":
            w = dues_weeks.setdefault(p["week_num"], {"week": p["week_num"], "n": 0, "total": 0})
            w["n"] += 1; w["total"] += p["amount"]
    for p in props:
        p["category_label"] = POCKET_CONFIG.get(p["category"], {}).get("short", p["category"])
    url = _public_url(request)
    return templates.TemplateResponse(request=request, name="dashboard.html", context={
        "class_id": CLASS_ID, "school": SCHOOL_NAME, "class_info": cls,
        "pocket": pocket_view(cls), "ledger": ledger_rows(db, CLASS_ID, 40), "ledger_info": ledger,
        "week": week, "weeks": weeks, "col_totals": col_totals, "stu": students_view(db, CLASS_ID, week),
        "active_week": active, "insights": insights.build_insights(db, CLASS_ID),
        "spark": spark_svg(insights.weekly_flow(db, CLASS_ID, 8)),
        "head": head, "proposals": props, "gate": db.require_teacher, "pend_tx": pend_tx,
        "pend_dues": sorted(dues_weeks.values(), key=lambda w: w["week"]),
        "approval_note": _approval_note(), "qr": qr_svg(url), "public_url": url,
        "now_label": datetime.now(WIB).strftime("%d/%m/%Y %H.%M WIB"),
        "is_admin": is_admin(request), "admin_enabled": bool(WEB_ADMIN_PASSWORD),
        "is_guru": is_guru(request), "guru_enabled": guru_enabled(),
        "flash": err or msg, "flash_err": bool(err), "format_rupiah": format_rupiah,
    })


@app.get("/laporan", response_class=HTMLResponse)
async def laporan(request: Request):
    return HTMLResponse(render_report(db, CLASS_ID, _public_url(request)))


# ------------------------------------------------------------------------ auth
@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse(request=request, name="login.html", context={
        "class_id": CLASS_ID, "school": SCHOOL_NAME, "enabled": bool(WEB_ADMIN_PASSWORD),
        "error": "", "is_admin": False, "admin_enabled": False, "guru": False})


@app.post("/login")
async def login(request: Request, password: str = Form(...)):
    ip = request.client.host if request.client else "?"
    count, locked_until = _login_fails.get(ip, (0, 0))

    def page(error: str, code: int):
        return templates.TemplateResponse(request=request, name="login.html", status_code=code, context={
            "class_id": CLASS_ID, "school": SCHOOL_NAME, "enabled": bool(WEB_ADMIN_PASSWORD),
            "error": error, "is_admin": False, "admin_enabled": False, "guru": False})

    if locked_until > time.time():
        return page("Terlalu banyak percobaan. Coba lagi 15 menit lagi.", 429)
    if not WEB_ADMIN_PASSWORD or not hmac.compare_digest(password.encode(), WEB_ADMIN_PASSWORD.encode()):
        count += 1
        _login_fails[ip] = (0, time.time() + 900) if count >= 5 else (count, 0)
        return page("Kata sandi salah.", 401)
    _login_fails.pop(ip, None)
    resp = RedirectResponse(url="/", status_code=303)
    secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    resp.set_cookie(COOKIE_NAME, _sign(int(time.time()) + SESSION_TTL), max_age=SESSION_TTL,
                    httponly=True, samesite="strict", secure=secure)
    return resp


@app.post("/logout")
async def logout():
    resp = RedirectResponse(url="/", status_code=303)
    resp.delete_cookie(COOKIE_NAME)
    return resp


# ------------------------------------------------------------- login Wali Kelas
def _guru_page(request: Request, error: str = "", code: int = 200):
    return templates.TemplateResponse(request=request, name="login.html", status_code=code, context={
        "class_id": CLASS_ID, "school": SCHOOL_NAME, "enabled": guru_enabled(),
        "error": error, "is_admin": False, "admin_enabled": False, "guru": True})


@app.get("/guru/login", response_class=HTMLResponse)
async def guru_login_page(request: Request):
    return _guru_page(request)


@app.post("/guru/login")
async def guru_login(request: Request, pin: str = Form(...)):
    ip = request.client.host if request.client else "?"
    count, locked_until = _guru_fails.get(ip, (0, 0))
    if not guru_enabled():
        return _guru_page(request, "Verifikasi guru belum aktif atau PIN Wali Kelas belum diatur.", 403)
    if locked_until > time.time():
        return _guru_page(request, "Terlalu banyak percobaan. Coba lagi 15 menit lagi.", 429)
    if not db.check_wali_pin(CLASS_ID, pin):
        count += 1
        _guru_fails[ip] = (0, time.time() + 900) if count >= 5 else (count, 0)
        return _guru_page(request, "PIN salah.", 401)
    _guru_fails.pop(ip, None)
    resp = RedirectResponse(url="/#guru", status_code=303)
    secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    resp.set_cookie(GURU_COOKIE, _sign(int(time.time()) + SESSION_TTL, "guru"), max_age=SESSION_TTL,
                    httponly=True, samesite="strict", secure=secure)
    return resp


@app.post("/guru/logout")
async def guru_logout():
    resp = RedirectResponse(url="/", status_code=303)
    resp.delete_cookie(GURU_COOKIE)
    return resp


# ------------------------------------------------------------- publik (hanya baca)
@app.get("/api/health")
async def health_check():
    rep = runtime.store.status if runtime.store else None
    return JSONResponse({
        "status": "ok", "telegram_webhook_ready": tg_app is not None,
        "replication": None if rep is None else {
            "ok": rep["last_error"] is None and not rep["conflict"], "uploads": rep["uploads"],
            "age_s": None if not rep["last_ok"] else round(time.time() - rep["last_ok"]),
            "conflict": rep["conflict"]},
    })


@app.get("/api/ledger/verify")
async def ledger_verify():
    v = db.verify_ledger(CLASS_ID)
    return JSONResponse({"ok": v["ok"], "transactions": v["tx_count"], "head": db.ledger_head(CLASS_ID),
                         "errors": v["errors"]})


@app.get("/api/recap/wa", response_class=PlainTextResponse)
async def recap_wa(request: Request):
    return recap.wa_recap(db, CLASS_ID, public_url=_public_url(request))


@app.get("/api/recap/reminder", response_class=PlainTextResponse)
async def recap_reminder():
    return recap.wa_reminder(db, CLASS_ID)


@app.get("/api/export/excel")
async def export_excel():
    filename = f"Laporan_Kas_{CLASS_ID}_{format_wib()[:10].replace('/', '-')}.xlsx"
    return StreamingResponse(
        generate_excel_report(db, CLASS_ID),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.get("/api/export/chart")
async def export_chart():
    return StreamingResponse(generate_financial_chart(db, CLASS_ID), media_type="image/png")


# ------------------------------------------------------------------ webhook
@app.post("/api/telegram/webhook")
async def telegram_webhook(request: Request):
    global tg_app
    if not TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook belum dikonfigurasi")
    supplied = request.headers.get("x-telegram-bot-api-secret-token", "")
    if not hmac.compare_digest(supplied.encode(), TELEGRAM_WEBHOOK_SECRET.encode()):
        raise HTTPException(status_code=403, detail="Forbidden")
    if tg_app is None:
        if not TELEGRAM_BOT_TOKEN:
            raise HTTPException(status_code=503, detail="TELEGRAM_BOT_TOKEN not configured")
        tg_app = build_telegram_app()
        await tg_app.initialize()
        await tg_app.start()
    update = Update.de_json(await request.json(), tg_app.bot)
    await tg_app.process_update(update)
    return JSONResponse({"ok": True})


# ----------------------------------------------------------------- aksi tulis
async def _push_proposal(p: dict):
    """Kirim kartu usulan ke siswa lewat bot bila bot aktif di proses ini."""
    if not tg_app:
        return 0
    sent = 0
    for chat_id in db.get_voter_ids(CLASS_ID, WEB_TELEGRAM_ID):
        try:
            await tg_app.bot.send_message(
                chat_id, tg_ui.proposal_card(p), parse_mode="HTML",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(l, callback_data=d) for l, d in row]
                                                   for row in tg_ui.proposal_kb(p)]))
            sent += 1
        except Exception:
            pass
    return sent


async def _push_wali(pending_id: int):
    """Beri tahu Wali Kelas lewat bot bila bot aktif di proses ini."""
    p = db.get_pending(pending_id)
    if not tg_app or not p:
        return
    for chat_id in db.get_wali_ids(CLASS_ID):
        try:
            await tg_app.bot.send_message(
                chat_id, tg_ui.pending_for_wali(p), parse_mode="HTML",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(l, callback_data=d) for l, d in row]
                                                   for row in tg_ui.verify_buttons(p["id"])]))
        except Exception:
            pass


def _bot_ctx():
    """Pembungkus tipis agar helper notifikasi bot bisa dipakai dari web (hanya butuh `.bot`)."""
    return SimpleNamespace(bot=tg_app.bot) if tg_app else None


@app.post("/api/pending/verify", dependencies=[Depends(require_guru)])
async def verify_pending(pid: int = Form(...)):
    try:
        r = db.verify_pending(pid, WEB_WALI_ID, WEB_WALI_NAME)
    except ValueError as err:
        return _back(str(err), err=True, frag="guru")
    ctx = _bot_ctx()
    if ctx:
        await _after_decision(ctx, r["pending"], r["result"])
    if r["status"] != "verified":
        return _back(f"Gagal dicatat: {r['note']}", err=True, frag="guru")
    return _back(f"Pengajuan #{pid} diverifikasi ✅", frag="guru")


@app.post("/api/pending/reject", dependencies=[Depends(require_guru)])
async def reject_pending(pid: int = Form(...), note: str = Form("")):
    try:
        p = db.reject_pending(pid, WEB_WALI_ID, WEB_WALI_NAME, note or "Ditolak oleh Wali Kelas")
    except ValueError as err:
        return _back(str(err), err=True, frag="guru")
    ctx = _bot_ctx()
    if ctx:
        await _after_decision(ctx, p)
    return _back(f"Pengajuan #{pid} ditolak.", frag="guru")


@app.post("/api/pending/verify-week", dependencies=[Depends(require_guru)])
async def verify_week(week: int = Form(..., ge=1, le=52)):
    before = db.list_pending(CLASS_ID, "pending", "dues")
    try:
        r = db.verify_dues_week(CLASS_ID, week, WEB_WALI_ID, WEB_WALI_NAME)
    except ValueError as err:
        return _back(str(err), err=True, frag="guru")
    ctx = _bot_ctx()
    if ctx:
        subs = list({p["submitter_tg"] for p in before if p["week_num"] == week and p["submitter_tg"]})
        await notify_many(ctx, subs, "\n".join([
            tg_ui.head("IURAN DIVERIFIKASI", "✅"), "",
            f"Iuran minggu {week}: <b>{r['verified']}</b> siswa disetujui <b>{tg_ui.E(WEB_WALI_NAME)}</b> ✓",
            f"Total <code>{tg_ui.E(format_rupiah(r['total']))}</code> masuk ke kas."]), [tg_ui.nav()])
    msg = f"Iuran minggu {week}: {r['verified']} diverifikasi ({format_rupiah(r['total'])})"
    return _back(msg + (f", {r['failed']} gagal" if r["failed"] else ""), err=bool(r["failed"]), frag="guru")


@app.post("/api/transaction/create", dependencies=[Depends(require_admin)])
async def create_transaction(type: str = Form(...), nominal: str = Form(...),
                             category: str = Form(...), description: str = Form(...)):
    if type not in ("in", "out") or category not in POCKET_CONFIG:
        return _back("Data formulir tidak valid.", err=True)
    amount = parse_nominal(nominal)
    if not amount:
        return _back("Nominal tidak terbaca. Contoh: 25.000 atau 25k.", err=True)
    try:
        if db.needs_approval(type, amount):
            p = db.create_proposal(CLASS_ID, amount, category, description, WEB_ADMIN_NAME, WEB_TELEGRAM_ID)
            sent = await _push_proposal(p)
            return _back(f"Diajukan sebagai usulan #{p['id']}; menunggu {p['needed']} suara siswa"
                         f"{f' (dikirim ke {sent} siswa)' if sent else ' lewat bot Telegram'}.")
        res = db.submit_transaction(CLASS_ID, type, amount, category, description, WEB_ADMIN_NAME, WEB_TELEGRAM_ID)
    except ValueError as e:
        return _back(str(e), err=True)
    if res["pending"]:
        await _push_wali(res["pending_id"])
        return _back(f"Dikirim ke Wali Kelas untuk diverifikasi (#{res['pending_id']}). Saldo berubah setelah disetujui. ⏳")
    return _back(f"Tercatat: {format_rupiah(amount)}.")


@app.post("/api/transaction/reverse", dependencies=[Depends(require_admin)])
async def reverse_transaction(tx_id: int = Form(...), reason: str = Form("Koreksi via web")):
    try:
        res = db.submit_reverse(CLASS_ID, tx_id, reason, WEB_ADMIN_NAME, WEB_TELEGRAM_ID)
    except ValueError as e:
        return _back(str(e), err=True)
    if res["pending"]:
        await _push_wali(res["pending_id"])
        return _back(f"Koreksi #{tx_id} dikirim ke Wali Kelas untuk diverifikasi. ⏳")
    return _back(f"Mutasi #{tx_id} dikoreksi.")


@app.post("/api/dues/pay", dependencies=[Depends(require_admin)])
async def pay_dues(nis: str = Form(None), week_num: int = Form(None), cell: str = Form(None)):
    if cell and "|" in cell:
        nis, _, w = cell.partition("|")
        try:
            week_num = int(w)
        except ValueError:
            return _back("Data tidak valid.", err=True)
    if not nis or not week_num:
        return _back("Data tidak valid.", err=True)
    try:
        first = not db.pending_dues_nis(CLASS_ID, week_num)
        res = db.submit_dues(CLASS_ID, nis, week_num, WEB_ADMIN_NAME, WEB_TELEGRAM_ID)
    except ValueError as e:
        return _back(str(e), err=True)
    if res["pending"]:
        if first:
            await _push_wali(res["pending_id"])
        return _back(f"{res['nama'].split()[0]}: iuran minggu {week_num} menunggu verifikasi guru ⏳", to=f"/?week={week_num}", frag="iuran")
    return _back(f"{res['nama'].split()[0]} lunas minggu {week_num} ✅", to=f"/?week={week_num}", frag="iuran")


@app.post("/api/pending/cancel", dependencies=[Depends(require_admin)])
async def cancel_pending(pid: int = Form(...)):
    try:
        db.cancel_pending(pid, WEB_TELEGRAM_ID, as_admin=True)
    except ValueError as e:
        return _back(str(e), err=True)
    return _back(f"Pengajuan #{pid} dibatalkan.")


@app.post("/api/proposal/cancel", dependencies=[Depends(require_admin)])
async def cancel_proposal(pid: int = Form(...)):
    try:
        db.cancel_proposal(pid, WEB_TELEGRAM_ID, as_admin=True)
    except ValueError as e:
        return _back(str(e), err=True)
    return _back(f"Usulan #{pid} dibatalkan.")

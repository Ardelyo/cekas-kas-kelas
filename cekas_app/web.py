"""
CEKAS Web: dashboard publik read-only, aksi tulis butuh login admin, webhook Telegram bertanda-tangan.
"""

import hashlib
import hmac
import logging
import secrets
import time
from contextlib import asynccontextmanager
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
    WEB_ADMIN_PASSWORD, WEB_ADMIN_NAME, SECRET_KEY, TELEGRAM_WEBHOOK_SECRET,
)
from .bot import db, build_telegram_app, _post_init
from .export_excel import generate_excel_report
from .formatters import format_rupiah, parse_nominal, format_wib, WIB
from .generate_chart import generate_financial_chart
from .report import render_report
from .viewmodel import ledger_rows, pocket_view, spark_svg, qr_svg, students_view

logger = logging.getLogger("cekas.web")

tg_app = None
COOKIE_NAME = "cekas_session"
SESSION_TTL = 8 * 3600
_SECRET = (SECRET_KEY or secrets.token_hex(32)).encode()
_login_fails: dict = {}  # ip -> (count, locked_until)
WEB_TELEGRAM_ID = 0      # 0 = aksi dari web (bukan akun Telegram)


# ------------------------------------------------------------------ sesi admin
def _sign(expiry: int) -> str:
    return f"{expiry}.{hmac.new(_SECRET, str(expiry).encode(), hashlib.sha256).hexdigest()}"


def _valid_session(token) -> bool:
    if not token or "." not in token:
        return False
    exp_s, _, sig = token.partition(".")
    try:
        exp = int(exp_s)
    except ValueError:
        return False
    expected = hmac.new(_SECRET, exp_s.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected) and exp > time.time()


def is_admin(request: Request) -> bool:
    return bool(WEB_ADMIN_PASSWORD) and _valid_session(request.cookies.get(COOKIE_NAME))


def require_admin(request: Request):
    if not is_admin(request):
        raise HTTPException(status_code=303, headers={"Location": "/login"})


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
    for p in props:
        p["category_label"] = POCKET_CONFIG.get(p["category"], {}).get("short", p["category"])
    url = _public_url(request)
    return templates.TemplateResponse(request=request, name="dashboard.html", context={
        "class_id": CLASS_ID, "school": SCHOOL_NAME, "class_info": cls,
        "pocket": pocket_view(cls), "ledger": ledger_rows(db, CLASS_ID, 40), "ledger_info": ledger,
        "week": week, "weeks": weeks, "col_totals": col_totals, "stu": students_view(db, CLASS_ID, week),
        "active_week": active, "insights": insights.build_insights(db, CLASS_ID),
        "spark": spark_svg(insights.weekly_flow(db, CLASS_ID, 8)),
        "head": head, "proposals": props,
        "approval_note": _approval_note(), "qr": qr_svg(url), "public_url": url,
        "now_label": datetime.now(WIB).strftime("%d/%m/%Y %H.%M WIB"),
        "is_admin": is_admin(request), "admin_enabled": bool(WEB_ADMIN_PASSWORD),
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
        "error": "", "is_admin": False, "admin_enabled": False})


@app.post("/login")
async def login(request: Request, password: str = Form(...)):
    ip = request.client.host if request.client else "?"
    count, locked_until = _login_fails.get(ip, (0, 0))

    def page(error: str, code: int):
        return templates.TemplateResponse(request=request, name="login.html", status_code=code, context={
            "class_id": CLASS_ID, "school": SCHOOL_NAME, "enabled": bool(WEB_ADMIN_PASSWORD),
            "error": error, "is_admin": False, "admin_enabled": False})

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
        db.record_transaction(CLASS_ID, type, amount, category, description, WEB_ADMIN_NAME, WEB_TELEGRAM_ID)
    except ValueError as e:
        return _back(str(e), err=True)
    return _back(f"Tercatat: {format_rupiah(amount)}.")


@app.post("/api/transaction/reverse", dependencies=[Depends(require_admin)])
async def reverse_transaction(tx_id: int = Form(...), reason: str = Form("Koreksi via web")):
    try:
        db.reverse_transaction(CLASS_ID, tx_id, reason, WEB_ADMIN_NAME, WEB_TELEGRAM_ID)
    except ValueError as e:
        return _back(str(e), err=True)
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
        res = db.mark_dues_paid(CLASS_ID, nis, week_num, WEB_ADMIN_NAME, WEB_TELEGRAM_ID, auto_tx=True)
    except ValueError as e:
        return _back(str(e), err=True)
    return _back(f"{res['nama'].split()[0]} lunas minggu {week_num} ✅", to=f"/?week={week_num}", frag="iuran")


@app.post("/api/proposal/cancel", dependencies=[Depends(require_admin)])
async def cancel_proposal(pid: int = Form(...)):
    try:
        db.cancel_proposal(pid, WEB_TELEGRAM_ID, as_admin=True)
    except ValueError as e:
        return _back(str(e), err=True)
    return _back(f"Usulan #{pid} dibatalkan.")

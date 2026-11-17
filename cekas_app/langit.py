"""
Integrasi desain "Langit": menyajikan folder design/ di /langit dan menyediakan JSON untuk
dashboard serta login. Semua logika bisnis, sesi, dan batas percobaan memakai yang sudah ada
di web.py; modul ini tidak mengubah perilaku halaman lama.
"""

import time
from pathlib import Path
from typing import Any, Dict

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import insights
from .config import CLASS_ID, SCHOOL_NAME, POCKET_CONFIG, APPROVAL_THRESHOLD, APPROVALS_NEEDED
from .viewmodel import ledger_rows, pocket_view

DESIGN_DIR = Path(__file__).resolve().parent.parent / "design"
POS_KEY = {"operasional": "op", "sosial": "so", "event": "ev", "cadangan": "ca"}


def setup(app, web) -> None:
    db = web.db

    def role_of(request: Request) -> str:
        if web.is_admin(request):
            return "bendahara"
        if web.is_guru(request):
            return "guru"
        return "siswa"

    @app.get("/api/langit/state")
    async def langit_state(request: Request):
        cls = db.get_or_create_class(CLASS_ID)
        cls.pop("pin_bendahara", None)
        active = db.active_week(CLASS_ID)
        ledger = db.verify_ledger(CLASS_ID)
        rows = ledger_rows(db, CLASS_ID, 40)
        pend_all = db.list_pending(CLASS_ID) if db.require_teacher else []
        props = db.list_proposals(CLASS_ID, "open")
        dues: Dict[str, Any] = {}
        for w in range(max(1, active - 3), active + 1):
            st = web.students_view(db, CLASS_ID, w)
            dues[str(w)] = {k: [s["nama"] for s in st[k]] for k in ("paid", "unpaid", "wait")}
        studs = sorted(db.get_all_whitelist_students(CLASS_ID), key=lambda s: s["nama_resmi"])
        names = [s["nama_resmi"] for s in studs]
        return JSONResponse({
            "class_id": CLASS_ID, "school": SCHOOL_NAME, "role": role_of(request),
            "guru_enabled": web.guru_enabled(), "admin_enabled": bool(web.WEB_ADMIN_PASSWORD),
            "saldo": cls["saldo"], "nominal_iuran": cls["nominal_iuran"], "active_week": active, "names": names, "nis": [s["nis"] for s in studs],
            "pockets": [{"key": POS_KEY.get(p["key"], p["key"][:2]), "name": p["short"], "value": p["value"]}
                        for p in pocket_view(cls)["rows"]],
            "ledger": [{"id": r["id"], "when": r["when"], "desc": r["desc"], "by": r["who"],
                        "cat": POS_KEY.get(r["cat"], str(r["cat"])[:2]), "amt": (r["masuk"] or 0) - (r["keluar"] or 0),
                        "voided": r["voided"], "corr": r["corr"]} for r in rows],
            "verify": {"ok": ledger["ok"], "tx_count": ledger["tx_count"], "errors": ledger.get("errors", [])[:3],
                       "head": db.ledger_head(CLASS_ID)},
            "pending": [{"id": p["id"], "kind": p["kind"], "desc": p.get("description"), "amt": p["amount"],
                         "type": p.get("tx_type"), "cat": POS_KEY.get(p.get("category") or "", ""), "week": p.get("week_num"),
                         "nis": p.get("nis"), "by": p.get("input_by")} for p in pend_all],
            "proposals": [{"id": p["id"], "desc": p["description"], "amt": p["amount"], "by": p["proposed_by"],
                           "yes": p["yes"], "needed": p["needed"],
                           "cat": POS_KEY.get(p["category"], str(p["category"])[:2])} for p in props],
            "approval": {"threshold": APPROVAL_THRESHOLD, "needed": APPROVALS_NEEDED},
            "dues": dues,
        }, headers={"Cache-Control": "no-store"})

    @app.post("/api/langit/login")
    async def langit_login(request: Request):
        """JSON {role: 'bendahara'|'guru', secret}. Mengembalikan {ok, error, remaining, locked}."""
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"ok": False, "error": "Permintaan tidak valid."}, status_code=400)
        role = body.get("role") if isinstance(body, dict) else None
        secret = body.get("secret") if isinstance(body, dict) else None
        if role not in ("bendahara", "guru") or not isinstance(secret, str) or not secret or len(secret) > 200:
            return JSONResponse({"ok": False, "error": "Permintaan tidak valid."}, status_code=400)
        ip = request.client.host if request.client else "?"
        fails = web._guru_fails if role == "guru" else web._login_fails
        count, locked_until = fails.get(ip, (0, 0))
        if role == "guru" and not web.guru_enabled():
            return JSONResponse({"ok": False, "error": "Verifikasi Wali Kelas belum aktif."}, status_code=403)
        if role == "bendahara" and not web.WEB_ADMIN_PASSWORD:
            return JSONResponse({"ok": False, "error": "Login Bendahara belum diaktifkan."}, status_code=403)
        if locked_until > time.time():
            return JSONResponse({"ok": False, "locked": True, "retry_after": int(locked_until - time.time()),
                                 "error": "Terlalu banyak percobaan."}, status_code=429)
        if role == "guru":
            good = db.check_wali_pin(CLASS_ID, secret)
        else:
            good = web.hmac.compare_digest(secret.encode(), web.WEB_ADMIN_PASSWORD.encode())
        if not good:
            count += 1
            fails[ip] = (0, time.time() + 900) if count >= 5 else (count, 0)
            locked = count >= 5
            return JSONResponse({"ok": False, "locked": locked, "remaining": max(0, 5 - count),
                                 "retry_after": 900 if locked else 0,
                                 "error": "PIN salah." if role == "guru" else "Kata sandi salah."}, status_code=429 if locked else 401)
        fails.pop(ip, None)
        resp = JSONResponse({"ok": True, "role": role})
        secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
        if role == "guru":
            resp.set_cookie(web.GURU_COOKIE, web._sign(int(time.time()) + web.SESSION_TTL, "guru"),
                            max_age=web.SESSION_TTL, httponly=True, samesite="strict", secure=secure)
        else:
            resp.set_cookie(web.COOKIE_NAME, web._sign(int(time.time()) + web.SESSION_TTL),
                            max_age=web.SESSION_TTL, httponly=True, samesite="strict", secure=secure)
        return resp

    @app.post("/api/langit/logout")
    async def langit_logout():
        resp = JSONResponse({"ok": True})
        resp.delete_cookie(web.COOKIE_NAME)
        resp.delete_cookie(web.GURU_COOKIE)
        return resp

    if DESIGN_DIR.is_dir():
        # dipasang paling akhir: rute /api dan halaman lama tidak terpengaruh
        app.mount("/langit", StaticFiles(directory=str(DESIGN_DIR), html=True), name="langit")

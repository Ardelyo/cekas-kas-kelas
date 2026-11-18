"""
Grafik kas CEKAS (PNG) untuk Telegram (/grafik) dan web (/api/export/chart).

Bahasa visual sama dengan situs "Langit": langit biru bertingkat, kartu putih membulat, tinta navy,
lime sebagai satu-satunya aksen, huruf Inter Tight. Isi: saldo, donat alokasi per pos, progres iuran minggu aktif,
dan tren saldo. Tidak memakai emoji (font matplotlib tidak mendukungnya).
"""

from io import BytesIO
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import font_manager
from matplotlib.patches import Circle, FancyBboxPatch, Wedge

from .config import CLASS_ID, POCKET_CONFIG, PUBLIC_URL
from .formatters import format_rupiah, format_wib

# token desain (sama dengan design/css/tokens.css)
INK, INK_2, INK_3 = "#0b1b3a", "#3b4a68", "#5f6c88"
SKY_1, SKY_2, SKY_3, SKY_DEEP, SKY_NIGHT = "#1e6fe8", "#4d9bf0", "#8ccbf5", "#0a2a78", "#06173f"
LIME, LIME_INK = "#d6ff3f", "#1b2400"
OK, BAD = "#0f8a3e", "#d93a40"
POS_COLOR = {"operasional": "#1e6fe8", "sosial": "#2fb1e6", "event": "#0a2a78", "cadangan": "#7f8fb0"}

_FONT_DIR = Path(__file__).parent / "assets" / "fonts"
_FONTS = {}


def _fp(weight: str = "medium", size: float = 10):
    """FontProperties Inter Tight dari berkas yang ikut di repo (tanpa bergantung font sistem)."""
    path = _FONT_DIR / ("InterTight-extrabold.ttf" if weight == "bold" else "InterTight-medium.ttf")
    if path.exists():
        if str(path) not in _FONTS:
            font_manager.fontManager.addfont(str(path))
            _FONTS[str(path)] = True
        return font_manager.FontProperties(fname=str(path), size=size)
    return font_manager.FontProperties(family="DejaVu Sans", weight="bold" if weight == "bold" else "normal", size=size)


def _t(ax, x, y, s, size=10, weight="medium", color=INK, ha="left", va="center", alpha=1.0, **kw):
    return ax.text(x, y, s, fontproperties=_fp(weight, size), color=color, ha=ha, va=va, alpha=alpha, **kw)


def _card(ax, x, y, w, h, color="#ffffff", alpha=0.95, r=2.6, shadow=True):
    if shadow:
        ax.add_patch(FancyBboxPatch((x + .25, y - .55), w, h, boxstyle=f"round,pad=0,rounding_size={r}",
                                    fc=SKY_NIGHT, ec="none", alpha=.22, zorder=1))
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={r}",
                                fc=color, ec="none", alpha=alpha, zorder=2))


def _sky(ax, W, H):
    """Gradien langit: navy di atas, biru tengah, biru muda di bawah + beberapa awan lembut."""
    stops = np.array([[0x06, 0x17, 0x3f], [0x0a, 0x2a, 0x78], [0x1e, 0x6f, 0xe8], [0x8c, 0xcb, 0xf5]]) / 255.0
    pos = np.array([0.0, 0.32, 0.7, 1.0])
    ys = np.linspace(0, 1, 400)
    img = np.stack([np.interp(ys, pos, stops[:, i]) for i in range(3)], axis=1)[:, None, :]
    ax.imshow(img, extent=[0, W, 0, H], origin="upper", aspect="auto", zorder=0, interpolation="bilinear")
    rng = np.random.default_rng(7)
    for _ in range(34):  # bintang halus di langit atas
        ax.add_patch(Circle((rng.uniform(0, W), rng.uniform(H * .86, H)), rng.uniform(.06, .16), fc="white",
                            ec="none", alpha=rng.uniform(.25, .7), zorder=0.5))
    for cx, cy, s, a in ((16, H * .10, 1.5, .20), (78, H * .07, 1.9, .24), (50, H * .03, 1.4, .16)):
        _cloud(ax, cx, cy, s, a, "white", zorder=0.6)


def _cloud(ax, cx, cy, s=1.0, alpha=1.0, color="white", zorder=3):
    for dx, dy, r in ((-1.5, 0, 1.2), (-.4, .7, 1.6), (.9, .2, 1.4), (2.0, -.1, 1.0), (.3, -.2, 1.5)):
        ax.add_patch(Circle((cx + dx * s, cy + dy * s), r * s, fc=color, ec="none", alpha=alpha, zorder=zorder))


def _spark(ax, x, y, w, h, vals):
    """Garis tren saldo dengan area lembut. Skala tunggal, titik akhir diberi penanda."""
    lo, hi = min(vals), max(vals)
    span = (hi - lo) or 1.0
    xs = np.linspace(x, x + w, len(vals))
    ys = y + (np.array(vals) - lo) / span * h
    ax.fill_between(xs, y - 0.2, ys, color=SKY_1, alpha=.12, zorder=3, linewidth=0)
    ax.plot(xs, ys, color=SKY_1, lw=2.6, solid_capstyle="round", solid_joinstyle="round", zorder=4)
    ax.add_patch(Circle((xs[-1], ys[-1]), .75, fc="white", ec=SKY_1, lw=2.4, zorder=5))
    return lo, hi


def _check(ax, cx, cy, s=1.0, color=LIME_INK, lw=2.2):
    ax.plot([cx - .55 * s, cx - .1 * s, cx + .7 * s], [cy + .05 * s, cy - .45 * s, cy + .55 * s], color=color, lw=lw,
            solid_capstyle="round", solid_joinstyle="round", zorder=7)


def generate_financial_chart(db, class_id: str = CLASS_ID) -> BytesIO:
    cls = db.get_or_create_class(class_id)
    saldo, alokasi = cls["saldo"], cls["alokasi"]
    positive = sum(max(v, 0) for v in alokasi.values())

    # data tambahan (aman bila belum ada transaksi)
    try:
        from .viewmodel import ledger_rows
        rows = [r for r in reversed(ledger_rows(db, class_id, limit=10_000)) if not r["voided"]]
        trend = [r["saldo"] for r in rows][-14:]
    except Exception:
        trend = []
    try:
        wk = db.active_week(class_id)
        dues = db.get_dues_status(class_id, wk)
    except Exception:
        wk, dues = 1, {"paid_count": 0, "total_students": 0, "percentage": 0}
    try:
        ok = db.verify_ledger(class_id)["ok"]
    except Exception:
        ok = True

    W, H = 100.0, 128.0
    fig = plt.figure(figsize=(7.2, 7.2 * H / W), facecolor=SKY_NIGHT)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
    _sky(ax, W, H)

    # ---- kepala
    _cloud(ax, 8.4, H - 6.2, .62, 1.0, "white", zorder=6)
    _t(ax, 13.8, H - 6.2, "cekas", 22, "bold", "white")
    ax.add_patch(FancyBboxPatch((W - 33, H - 9.0), 27, 5.6, boxstyle="round,pad=0,rounding_size=2.8", fc="white", ec="none", alpha=.18, zorder=2))
    _t(ax, W - 19.5, H - 6.2, f"Kelas {class_id}", 11, "medium", "white", ha="center")

    # ---- kartu saldo
    _card(ax, 5, H - 44, 90, 32, r=3.2)
    _t(ax, 10, H - 19.5, f"Saldo kas kelas {class_id}", 11.5, "medium", INK_3)
    big = format_rupiah(saldo)
    _t(ax, 10, H - 28.5, big, 34 if len(big) < 13 else 28, "bold", BAD if saldo < 0 else INK)
    badge = "Terverifikasi" if ok else "Perlu diperiksa"
    bw = 5.5 + len(badge) * 1.18
    ax.add_patch(FancyBboxPatch((10, H - 40.2), bw, 5.4, boxstyle="round,pad=0,rounding_size=2.7",
                                fc=LIME if ok else "#ffe6e6", ec="none", zorder=6))
    if ok:
        _check(ax, 13.1, H - 37.5, .8)
    _t(ax, 15.6 if ok else 12.4, H - 37.5, badge, 9.5, "bold", LIME_INK if ok else BAD, zorder=7)
    if len(trend) >= 2:
        lo, hi = _spark(ax, 62, H - 40, 28, 9, trend)
    else:
        _t(ax, 90, H - 37.5, "Belum ada transaksi", 9.5, "medium", INK_3, ha="right")

    # ---- kartu donat per pos
    top = H - 49
    _card(ax, 5, top - 44, 90, 44, r=3.2)
    _t(ax, 10, top - 5.2, "Uangnya dipakai buat apa?", 13, "bold", INK)
    cx, cy, R, rr = 28.5, top - 25, 14.5, 9.2
    if positive > 0:
        a0 = 90.0
        for key in POCKET_CONFIG:
            v = max(alokasi.get(key, 0), 0)
            if v <= 0:
                continue
            sweep = v / positive * 360.0
            ax.add_patch(Wedge((cx, cy), R, a0 - sweep + 1.1, a0 - 1.1, width=R - rr, fc=POS_COLOR[key], ec="none", zorder=4))
            a0 -= sweep
    else:
        ax.add_patch(Wedge((cx, cy), R, 0, 360, width=R - rr, fc="#e3e9f3", ec="none", zorder=4))
    _t(ax, cx, cy + 1.6, "Total pos" if positive else "Belum ada dana", 8.5, "medium", INK_3, ha="center", zorder=5)
    _t(ax, cx, cy - 2.2, format_rupiah(positive), 13 if positive else 9, "bold", INK, ha="center", zorder=5)
    ly = top - 12.5
    for key, meta in POCKET_CONFIG.items():
        v = alokasi.get(key, 0)
        ax.add_patch(FancyBboxPatch((50, ly - 1.4), 2.8, 2.8, boxstyle="round,pad=0,rounding_size=.8", fc=POS_COLOR[key], ec="none", zorder=5))
        _t(ax, 55, ly + 1.7, meta["short"], 10.5, "bold", INK, zorder=5)
        pct = f"{v / positive * 100:.0f}%" if positive > 0 and v > 0 else "0%"
        _t(ax, 90, ly + 1.7, pct, 9.5, "medium", INK_3, ha="right", zorder=5)
        _t(ax, 55, ly - 1.7, format_rupiah(v), 10.5, "medium", BAD if v < 0 else INK_2, zorder=5)
        ly -= 7.6

    # ---- kartu iuran
    top2 = top - 49
    _card(ax, 5, top2 - 19, 90, 19, r=3.2)
    paid, total = dues.get("paid_count", 0), dues.get("total_students", 0)
    pctd = (paid / total * 100) if total else 0
    _t(ax, 10, top2 - 5, f"Iuran minggu ke-{wk}", 13, "bold", INK)
    _t(ax, 90, top2 - 5, f"{paid} dari {total} lunas" if total else "Belum ada data", 10.5, "medium", INK_3, ha="right")
    ax.add_patch(FancyBboxPatch((10, top2 - 12.2), 80, 3.4, boxstyle="round,pad=0,rounding_size=1.7", fc="#e3e9f3", ec="none", zorder=3))
    if total and paid:
        ax.add_patch(FancyBboxPatch((10, top2 - 12.2), max(3.4, 80 * pctd / 100), 3.4, boxstyle="round,pad=0,rounding_size=1.7", fc=SKY_1, ec="none", zorder=4))
        ax.add_patch(Circle((10 + max(3.4, 80 * pctd / 100) - 1.7, top2 - 10.5), 1.0, fc=LIME, ec="none", zorder=5))
    left = max(total - paid, 0)
    _t(ax, 10, top2 - 16.1, (f"Tinggal {left} teman lagi" if left else "Semua sudah lunas") if total else "", 9.5, "medium", INK_3)
    _t(ax, 90, top2 - 16.1, f"{pctd:.0f}%", 10.5, "bold", SKY_1, ha="right")

    # ---- kaki
    url = (PUBLIC_URL or "cekas.vercel.app").replace("https://", "").replace("http://", "").rstrip("/")
    _t(ax, 6, 3.4, f"{url}  ·  {format_wib()}", 8, "medium", "white", alpha=.85)
    _t(ax, 94, 3.4, "Kas kelas seterang langit", 8, "bold", "white", ha="right", alpha=.85)

    out = BytesIO()
    fig.savefig(out, format="png", dpi=150, facecolor=fig.get_facecolor())
    plt.close(fig)
    out.seek(0)
    return out

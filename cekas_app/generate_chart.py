"""
Grafik kas untuk Telegram & unduhan (PNG). Bahasa visual sama dengan web:
kartu tonal membulat per pos + kartu saldo besar. Tidak memakai emoji (font matplotlib tidak mendukungnya).
"""

from io import BytesIO

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import FancyBboxPatch

from .config import CLASS_ID, POCKET_CONFIG
from .formatters import format_rupiah, format_wib

SURFACE, INK, INK_2 = "#F6FBF7", "#171D1A", "#3F4944"
HERO_BG, HERO_ON = "#B8F0DF", "#00201A"
# (wadah tonal, teks) per pos: sama dengan variabel --pos-* di CSS
TONES = {
    "operasional": ("#B8F0DF", "#00201A"), "sosial": ("#FFD9E3", "#3B0723"),
    "event": ("#FFDDB5", "#2C1600"), "cadangan": ("#D3E4FF", "#001C38"),
}


def _font() -> str:
    names = {f.name for f in font_manager.fontManager.ttflist}
    for cand in ("Figtree", "Segoe UI", "Nunito", "DejaVu Sans"):
        if cand in names:
            return cand
    return "sans-serif"


def _round(ax, x, y, w, h, color, r=0.32):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={r}", fc=color, ec="none"))


def generate_financial_chart(db, class_id: str = CLASS_ID) -> BytesIO:
    cls = db.get_or_create_class(class_id)
    saldo, alokasi = cls["saldo"], cls["alokasi"]
    positive = sum(max(v, 0) for v in alokasi.values())

    plt.rcParams["font.family"] = _font()
    fig = plt.figure(figsize=(8, 5.6), facecolor=SURFACE)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 8); ax.set_ylim(0, 5.6); ax.axis("off")

    # kartu saldo
    _round(ax, 0.3, 3.2, 7.4, 2.1, HERO_BG, r=0.5)
    ax.text(0.7, 4.85, f"Saldo kas kelas {class_id}", fontsize=13, color=HERO_ON, alpha=.8, va="center")
    ax.text(0.7, 4.05, format_rupiah(saldo), fontsize=40, weight="bold", va="center",
            color=("#BA1A1A" if saldo < 0 else HERO_ON))
    ax.text(0.7, 3.5, "Pantau terus, kas kelas kita transparan", fontsize=10.5, color=HERO_ON, alpha=.75, va="center")

    # 4 kartu pos (2x2)
    positions = [(0.3, 1.75), (4.1, 1.75), (0.3, 0.35), (4.1, 0.35)]
    for (x, y), (key, meta) in zip(positions, POCKET_CONFIG.items()):
        bg, on = TONES[key]
        v = alokasi.get(key, 0)
        _round(ax, x, y, 3.6, 1.3, bg, r=0.3)
        ax.text(x + 0.3, y + 0.98, meta["short"], fontsize=12, weight="bold", color=on, va="center")
        pct = f"{v / positive * 100:.0f}%" if positive > 0 and v > 0 else "0%"
        ax.text(x + 3.3, y + 0.98, pct, fontsize=11, color=on, alpha=.7, va="center", ha="right")
        ax.text(x + 0.3, y + 0.46, format_rupiah(v), fontsize=17, weight="bold", va="center",
                color=("#BA1A1A" if v < 0 else on))

    fig.text(0.04, 0.012, f"CEKAS · {format_wib()}", fontsize=7.5, color=INK_2, alpha=.7)
    out = BytesIO()
    fig.savefig(out, format="png", dpi=200, facecolor=fig.get_facecolor())
    plt.close(fig)
    out.seek(0)
    return out

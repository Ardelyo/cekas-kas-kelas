"""Versi aplikasi CEKAS. Naikkan VERSION setiap rilis; commit diisi otomatis saat deploy (APP_COMMIT)."""

import os

VERSION = "2.1.0"
COMMIT = os.getenv("APP_COMMIT", "") or "dev"
REVISION = os.getenv("K_REVISION", "") or "lokal"  # nama revisi Cloud Run, bila berjalan di sana


def info() -> dict:
    return {"app": "CEKAS", "version": VERSION, "commit": COMMIT, "revision": REVISION}


def label() -> str:
    return f"v{VERSION} ({COMMIT})"

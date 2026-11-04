"""
CEKAS Core Database compatibility wrapper (re-exports CekasDB from cekas_app.database).
"""

from cekas_app.database import CekasDB
from cekas_app.config import DEFAULT_PIN_BENDAHARA as DEFAULT_PIN, NOMINAL_IURAN_MINGGUAN

__all__ = ["CekasDB", "DEFAULT_PIN", "NOMINAL_IURAN_MINGGUAN"]

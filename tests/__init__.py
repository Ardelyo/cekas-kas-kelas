"""Isolasi test: JANGAN pernah menyentuh cekas.db asli atau token Telegram sungguhan."""
import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="cekas_test_")
os.environ["CEKAS_DB_PATH"] = os.path.join(_tmp, "test.db")
os.environ["TELEGRAM_BOT_TOKEN"] = ""
os.environ["PIN_BENDAHARA"] = "482915"
os.environ["WEB_ADMIN_PASSWORD"] = "rahasia-test"
os.environ["TELEGRAM_WEBHOOK_SECRET"] = "whsec-test"
os.environ["CEKAS_SECRET_KEY"] = "test-secret-key"

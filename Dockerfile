FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    CEKAS_DB_PATH=/tmp/cekas.db

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY cekas_app/ ./cekas_app/
COPY cekas_core/ ./cekas_core/
COPY run.py .

# Jalankan sebagai pengguna biasa; /tmp tetap bisa ditulis (database diganti dari Cloud Storage saat boot).
RUN useradd --create-home --uid 10001 cekas && chown -R cekas /app
USER cekas

EXPOSE 8080

# Satu worker: SQLite hanya boleh punya satu penulis.
CMD ["uvicorn", "cekas_app.web:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--timeout-graceful-shutdown", "8"]

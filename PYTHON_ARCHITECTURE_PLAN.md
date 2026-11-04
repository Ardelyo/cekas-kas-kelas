# CEKAS (Catatan Keuangan Kelas) - Pure Python Architectural Blueprint & Research
Status: Proposal & Research Document
Branch: pure-python
Author: Ardellio Satria Anindito & Development Team

================================================================================
1. EXECUTIVE SUMMARY & MOTIVATION
================================================================================

CEKAS is currently built on a Node.js + Firebase Cloud Functions (2nd Gen) + Google Cloud Firestore + Vite/React stack. While functional as an initial cloud MVP, this architecture presents significant friction in real-world Indonesian high school / classroom settings:
- Cloud & Internet Dependency: Firestore requires continuous cloud connectivity. A bad cellular signal in class stops the bendahara from recording dues.
- Vendor Lock-In & Cost Barriers: Cloud Functions require GCP Blaze plans with billing enabled for external API calls (Telegram Bot API).
- Complex Credential Chaining: Hardcoded local GCP credential paths create deployment fragility across team members' computers.
- Limited Analytical & AI Extensibility: Node.js lacks the deep native ecosystem for on-device machine learning, OCR, voice transcription, and statistical forecasting.

Transitioning CEKAS into a Pure Python Architecture (Local-First + Python-Centric Core) transforms CEKAS from a standard database CRUD bot into an intelligent, autonomous classroom financial OS.

================================================================================
2. THE SUPERPOWERS OF PYTHON FOR CEKAS
================================================================================

By moving to Python 3.11+, CEKAS unlocks capabilities that would require dozens of fragile external microservices in Node.js:

A. Multimodal OCR Receipt & Nota Scanner (Zero Cloud / Local AI)
- Use Case: Bendahara purchases class cleaning supplies (sapu, pel, spidol) at Alfamart/Indomaret or a local stationery store. Instead of manually typing commands, the bendahara simply snaps a photo of the paper receipt and sends it to the Telegram Bot.
- Tech: Qwen2.5-VL / Gemma-3-Vision via Ollama locally (or EasyOCR / PaddleOCR / pytesseract as lightweight fallbacks).
- Action: The vision pipeline extracts:
  * Merchant Name ("Alfamart Dago")
  * Date & Time
  * Total Transaction Amount (Rp 37.500)
  * Line items list
  * Auto-categorizes into "Operasional" or "Sosial".
  Bot prompts bendahara: "Nota terdeteksi: Rp 37.500 (Operasional - Sapu & Pel). Konfirmasi simpan? [Ya / Batal]".

B. Natural Language & Slang Indonesian Financial Parser
- Current: Rigid format required: `/kurang 35k operasional Beli sapu dan pel`.
- Python Power: Natural conversational parsing using local LLM (Qwen2.5-3B-Instruct / Gemma-2-2B via Ollama) with structured JSON output (Pydantic / Instructor), falling back to high-speed regex.
- Examples parsed seamlessly:
  * "Catat pengeluaran 45rb buat jenguk Fadhil di RS Borromeus dari kas sosial" -> { amount: 45000, category: "sosial", description: "Jenguk Fadhil di RS Borromeus", type: "out" }
  * "Tarina baru bayar kas 20rb buat minggu 3 dan 4" -> { amount: 20000, category: "operasional", description: "Iuran minggu 3 dan 4", target: "Tarina", weeks: [3, 4], type: "in" }

C. Voice-Note to Transaction (Voice-to-Cashbook)
- Use Case: Bendahara in class is busy collecting cash and cannot type. They hold the mic button in Telegram and send a 5-second voice note.
- Tech: faster-whisper (Indonesian language model) running on local CPU/GPU.
- Flow: Telegram voice .ogg -> faster-whisper transcription -> NLP Parser -> Transaction confirmation card.

D. Financial Anomaly Detection & Cash Flow Forecasting
- Tech: Pandas, NumPy, Scikit-learn / Prophet.
- Capabilities:
  * Burn Rate & Runway Calculation: Automatically alert bendahara: "Dengan rata-rata pengeluaran Rp 45.000/minggu, dana Operasional akan habis dalam 3 minggu ke depan."
  * Anomaly Alert: Detect duplicate or unusually large disbursements compared to historical norms.
  * Dues Collection Predictor: Identify patterns of students who frequently delay payment and suggest optimal reminder times.

E. Dynamic Data Visualizations Directly in Telegram
- Current: Text-only tables and emoji bars.
- Python Power: Matplotlib / Seaborn / Pillow generating high-resolution infographic cards rendered as images sent directly in Telegram:
  * Donut charts for pocket allocations (Operasional, Sosial, Event, Cadangan).
  * 36-student weekly payment heatmaps (green/red matrix).
  * Monthly cashflow burn-down curves.

F. Official School SPJ & Audit Report Generation
- School administrators and homeroom teachers (Wali Kelas) require formal printed accounting reports.
- Python Power:
  * ReportLab / WeasyPrint: Generate formal PDF SPJ (Surat Pertanggungjawaban) complete with school letterhead (Kop Surat SMA Kartika XIX-1), signature blocks for Wali Kelas & Bendahara, and timestamped audit logs.
  * OpenPyXL / XlsxWriter: Export multi-tab Excel workbooks with automated SUM formulas, conditional formatting, and balance reconciliation sheets.

================================================================================
3. CROSS-PLATFORM STRATEGY: CAN WE STILL DO CROSS-PLATFORM?
================================================================================

YES — Python provides superior cross-platform flexibility because the presentation layer can be completely decoupled from the core business engine.

1. Universal Interface: Telegram Bot & Telegram Mini App (TMA)
- Platform: iOS, Android, Windows, macOS, Linux, Web.
- Why it wins: 100% of students and teachers already have Telegram. Zero app store friction, zero APK side-loading, instant push notifications.
- Tech: python-telegram-bot (v20+ async) or aiogram 3.x.
- Telegram Mini App (Web App inside Telegram): Built with a Python backend (FastAPI serving a responsive mobile web interface directly within Telegram's in-app webview).

2. Modern Web Dashboard & PWA (Desktop & Mobile Browser)
- Option A (Recommended for simplicity): FastAPI + Jinja2 + HTMX + Tailwind CSS.
  * Zero Node.js build pipeline needed!
  * Fast server-side rendering, ultra-low latency, instant updates.
- Option B (Pure Python Reactive GUI): NiceGUI or Flet.
  * NiceGUI: Vue/Tailwind engine under the hood, but written 100% in pure Python.
  * Flet: Flutter engine driven by pure Python. Compiles to Web, Desktop, and Mobile!

3. Native Desktop App (Windows, macOS, Linux)
- Target: School lab PC, Bendahara's personal laptop, or offline classroom computer.
- Framework: CustomTkinter or PyQt6 / PySide6, or Flet Desktop.
- Packaging: PyInstaller or Nuitka producing a single standalone `.exe` (Windows) or binary (Linux/macOS) with zero Python installation required on the target machine.

4. Mobile Native (Android & iOS)
- Option A: Telegram Mini App (zero install needed by users).
- Option B: PWA (Progressive Web App) served by FastAPI.
- Option C: Flet Mobile or BeeWare / Briefcase for native APK generation if standalone app store distribution is ever desired.

5. Terminal User Interface (TUI)
- Framework: Textual (by Textualize).
- Runs directly inside Windows Terminal / bash / Linux shell for instant developer & server administration without spinning up a browser.

================================================================================
4. DATA ARCHITECTURE: FROM CLOUD VENDOR LOCK-IN TO LOCAL-FIRST
================================================================================

Current State:
- Google Cloud Firestore (Cloud-only, proprietary NoSQL, pricing risk, credential hassle).

Proposed Python-Native Database Strategy:
- Primary Engine: SQLite via SQLAlchemy 2.0 / SQLModel (Pydantic + SQLAlchemy unified).
- Key Advantages:
  * Single file storage (`cekas.db`) — effortlessly backed up or copied.
  * ACID-compliant atomic transactions (eliminates race conditions completely).
  * WAL mode (Write-Ahead Logging) enables high-concurrency simultaneous reads and writes.
  * Blazing fast execution (in-memory microsecond queries).
- Cloud Replication & Multi-Device Sync (Optional):
  * Litestream: Continuous background streaming replication from local SQLite to any S3-compatible cloud storage (Cloudflare R2 free tier, Supabase, Google Cloud Storage, or MinIO).
  * Turso / LibSQL: Cloud-distributed SQLite if real-time distributed multi-node sync is desired.

================================================================================
5. TARGET SYSTEM ARCHITECTURE & FOLDER STRUCTURE
================================================================================

```
cekas/
├── pyproject.toml              # Modern Python packaging (uv / pip)
├── .env.example                # Environment variables
├── cekas/                      # Core Python Package
│   ├── __init__.py
│   ├── config.py               # Pydantic Settings
│   ├── database/               # Database Models & Engine
│   │   ├── __init__.py
│   │   ├── connection.py       # SQLite engine with WAL mode
│   │   ├── models.py           # SQLModel: Class, Member, Transaction, Dues, Audit
│   │   └── crud.py             # Atomic transaction repository operations
│   ├── core/                   # Pure Business Logic
│   │   ├── accounting.py       # Running balance, pocket allocations, reversal
│   │   ├── dues_matrix.py      # Weekly dues computation & status matrix
│   │   ├── rbac.py             # Whitelist NIS & PIN bendahara validation
│   │   └── idempotency.py      # In-memory sliding window deduplication
│   ├── ai/                     # Python AI Superpowers
│   │   ├── ocr_receipt.py      # Local OCR / Multimodal receipt parser
│   │   ├── nlp_parser.py       # Natural language expense & income extraction
│   │   ├── whisper_voice.py    # Voice note speech-to-text
│   │   └── analytics.py        # Anomaly detection & cashflow forecasting
│   ├── reporting/              # Document & Graphic Generation
│   │   ├── charts.py           # Matplotlib / Seaborn visual balance charts
│   │   ├── excel_export.py     # OpenPyXL audit workbooks
│   │   └── pdf_spj.py          # WeasyPrint / ReportLab official school SPJ
│   ├── bot/                    # Telegram Bot Interface
│   │   ├── __init__.py
│   │   ├── telegram_bot.py     # python-telegram-bot v20+ dispatcher
│   │   ├── handlers_member.py  # /start, /saldo, /alokasi, /tagihan, /profil
│   │   ├── handlers_admin.py   # /tambah, /kurang, /bayar, /koreksi, /klaim
│   │   └── formatters.py       # Indonesian currency & timezone formatting
│   └── web/                    # Web & Mini App Interface
│       ├── __init__.py
│       ├── api.py              # FastAPI endpoints for webhooks / API
│       ├── templates/          # Jinja2 / HTMX templates
│       └── static/             # CSS & JS assets
├── tests/                      # Pytest Automated Test Suite
│   ├── test_accounting.py
│   ├── test_parsers.py
│   ├── test_rbac.py
│   └── test_idempotency.py
└── scripts/                    # CLI Utilities
    ├── seed_data.py            # Initial student whitelist & class seeder
    └── run_tui.py              # Textual terminal UI dashboard
```

================================================================================
6. PHASED MIGRATION ROADMAP
================================================================================

Phase 1: Core Engine & Data Parity (Python Core)
- Implement `SQLModel` schema replicating the 4 Firestore collections (Class, Member, Transaction, WeeklyDue).
- Port formatters, nominal parsers, and idempotency logic to pure Python.
- Achieve 100% unit test coverage matching existing test cases with `pytest`.

Phase 2: Telegram Bot & Notification Engine
- Build asynchronous Telegram bot using `python-telegram-bot` (v20+).
- Support all current commands: `/saldo`, `/alokasi`, `/riwayat`, `/tagihan`, `/tambah`, `/kurang`, `/bayar`, `/koreksi`, `/klaimbendahara`, `/daftar`, `/notif`.
- Implement background personal DM notification broadcaster.

Phase 3: Python AI Superpowers Integration
- Integrate receipt scanning via local multimodal vision / OCR.
- Add voice note transcription via `faster-whisper`.
- Add chart generation (`/grafik`) delivering instant visual breakdowns to Telegram.

Phase 4: Reporting & Cross-Platform UI
- Implement official school SPJ PDF generation and Excel export.
- Implement FastAPI + HTMX responsive web dashboard (usable as Telegram Mini App).
- Package desktop executable for Windows/macOS.

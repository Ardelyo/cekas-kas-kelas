#!/usr/bin/env python3
"""
CEKAS - Unified Entrypoint Runner (100% Pure Python Edition)
Usage:
  python run.py status
  python run.py seed
  python run.py export-excel
  python run.py export-chart
  python run.py web
  python run.py bot
  python run.py all
"""

import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from cekas_app.cli import main

if __name__ == "__main__":
    main()

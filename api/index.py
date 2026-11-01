"""Vercel Python function: serves the FastAPI backend under /api (see vercel.json rewrites)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from main import app  # noqa: F401  (Vercel looks for the ASGI `app`)

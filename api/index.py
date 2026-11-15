"""Vercel serverless entry: reuses the local FINN request handler for /api/*."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server import Handler as _Handler  # noqa: E402


class handler(_Handler):
    """Vercel looks for a BaseHTTPRequestHandler subclass named `handler`."""

#!/usr/bin/env python3
"""Run the Diamond Signal Lab web app locally with no external dependencies."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

PORT = int(os.environ.get("PORT", "5173"))
ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".css": "text/css",
        ".csv": "text/csv; charset=utf-8",
        ".html": "text/html; charset=utf-8",
    }

if __name__ == "__main__":
    server = ThreadingHTTPServer(("", PORT), Handler)
    print(f"Diamond Signal Lab running at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")

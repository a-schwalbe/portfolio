#!/usr/bin/env python3
"""
Regenerate src/embeddedData.js from data/stats.csv.
Use this after replacing data/stats.csv if you want the app to keep working by double-clicking index.html.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
csv_path = ROOT / "data" / "stats.csv"
out_path = ROOT / "src" / "embeddedData.js"

if not csv_path.exists():
    raise SystemExit(f"Missing CSV file: {csv_path}")

text = csv_path.read_text(encoding="utf-8-sig")
out_path.write_text(f"window.DEFAULT_BATTING_CSV = {json.dumps(text)};\n", encoding="utf-8")
print(f"Updated {out_path.relative_to(ROOT)} from {csv_path.relative_to(ROOT)}")

#!/usr/bin/env python3
"""
Fetch the Baseball Savant Custom Leaderboard CSV for this project, then import it.

This script is built for a low-frequency scheduled refresh, such as once per morning.

Behavior:
1. Reads config/savant_leaderboard_url.txt unless --url is provided.
2. Forces csv=true on the Baseball Savant leaderboard URL.
3. Sends browser-like headers, including a Referer, because the browser CSV request
   succeeds while generic script/curl requests may receive 403.
4. Tries Python urllib first.
5. If local Windows/Python SSL verification fails, falls back to curl.exe/curl.
6. If Windows curl fails only because certificate revocation checking is unavailable,
   retries curl with --ssl-no-revoke.
7. Imports the fetched CSV into data/stats.csv using tools/import_savant_export.py.

Examples:
  python tools/fetch_savant_leaderboard.py
  python tools/fetch_savant_leaderboard.py --dry-run
  python tools/fetch_savant_leaderboard.py --dry-run --save-raw raw-savant.csv
  python tools/fetch_savant_leaderboard.py --url "https://baseballsavant.mlb.com/leaderboard/custom?..."
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import shutil
import ssl
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

try:
    import certifi
except ImportError:
    certifi = None


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_URL_FILE = PROJECT_ROOT / "config" / "savant_leaderboard_url.txt"
IMPORT_SCRIPT = PROJECT_ROOT / "tools" / "import_savant_export.py"
METADATA_FILE = PROJECT_ROOT / "data" / "last_updated.json"

DEFAULT_TIMEOUT_SECONDS = 60
DEFAULT_RETRIES = 3

BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/149.0.0.0 Safari/537.36"
)


class FetchError(RuntimeError):
    pass


def read_default_url() -> str:
    if not DEFAULT_URL_FILE.exists():
        raise FileNotFoundError(
            f"No URL provided and default URL file is missing: {DEFAULT_URL_FILE}"
        )
    url = DEFAULT_URL_FILE.read_text(encoding="utf-8").strip()
    if not url:
        raise ValueError(f"Default URL file is empty: {DEFAULT_URL_FILE}")
    return url


def build_csv_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if not parsed.scheme or not parsed.netloc:
        raise ValueError("Leaderboard URL must be a full https:// URL.")
    if "baseballsavant.mlb.com" not in parsed.netloc:
        raise ValueError("This script is intended for baseballsavant.mlb.com leaderboard URLs only.")

    query_pairs = parse_qsl(parsed.query, keep_blank_values=True)
    query_pairs = [(k, v) for (k, v) in query_pairs if k.lower() != "csv"]
    query_pairs.append(("csv", "true"))
    new_query = urlencode(query_pairs, doseq=True)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))


def browser_headers(source_url: str) -> dict[str, str]:
    # These headers intentionally mimic the browser "Download CSV" navigation request.
    # The direct CSV endpoint can return a subtly different CSV shape when called with
    # generic script-style CSV headers.
    return {
        "User-Agent": BROWSER_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": source_url,
        "Upgrade-Insecure-Requests": "1",
        "Sec-CH-UA": '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Connection": "close",
    }

def build_ssl_context() -> ssl.SSLContext:
    if certifi is not None:
        return ssl.create_default_context(cafile=certifi.where())
    return ssl.create_default_context()


def fetch_text_with_urllib(
    csv_url: str,
    source_url: str,
    timeout: int,
    retries: int,
) -> tuple[str, dict[str, str]]:
    headers = browser_headers(source_url)
    ssl_context = build_ssl_context()
    last_error: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            request = Request(csv_url, headers=headers, method="GET")
            with urlopen(request, timeout=timeout, context=ssl_context) as response:
                raw = response.read()
                content_type = response.headers.get("Content-Type", "")
                charset = response.headers.get_content_charset() or "utf-8"
                text = raw.decode(charset, errors="replace")
                return text, {
                    "content_type": content_type,
                    "final_url": response.geturl(),
                    "method": "urllib",
                    "status": str(getattr(response, "status", "")),
                }
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(2 * attempt)

    raise FetchError(f"urllib failed after {retries} attempts: {last_error}")


def run_curl(csv_url: str, source_url: str, timeout: int, no_revoke: bool) -> tuple[str, str]:
    curl_path = shutil.which("curl.exe") or shutil.which("curl")
    if not curl_path:
        raise FetchError("curl.exe/curl was not found on PATH.")

    headers = browser_headers(source_url)

    command = [
        curl_path,
        "-L",
        "--fail",
        "--silent",
        "--show-error",
        "--compressed",
        "--max-time",
        str(timeout),
    ]

    if no_revoke:
        command.append("--ssl-no-revoke")

    command.extend(["-A", headers["User-Agent"]])
    for key, value in headers.items():
        if key.lower() == "user-agent":
            continue
        command.extend(["-H", f"{key}: {value}"])

    command.append(csv_url)

    # IMPORTANT:
    # Do not use text=True here. On Windows, subprocess text mode can decode UTF-8
    # output with a Windows code page, turning the UTF-8 BOM into the literal text
    # "ï»¿". When that happens, the first CSV header becomes:
    #   ï»¿"last_name, first_name"
    # and csv.reader no longer recognizes the quote as the start of a quoted field,
    # so it incorrectly splits the header into two columns.
    completed = subprocess.run(
        command,
        cwd=PROJECT_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    stderr_text = completed.stderr.decode("utf-8", errors="replace").strip()

    if completed.returncode != 0:
        mode = "curl --ssl-no-revoke" if no_revoke else "curl"
        raise FetchError(f"{mode} failed with exit code {completed.returncode}: {stderr_text}")

    # Baseball Savant sends UTF-8 CSV. utf-8-sig cleanly removes a real BOM if present.
    csv_text = completed.stdout.decode("utf-8-sig", errors="replace")
    if csv_text.startswith("ï»¿"):
        # Defensive cleanup for already-mojibaked text from an earlier local run.
        csv_text = csv_text.removeprefix("ï»¿")

    mode = "curl --ssl-no-revoke --compressed browser-navigation-headers" if no_revoke else "curl --compressed browser-navigation-headers"
    return csv_text, mode

def fetch_text_with_curl(csv_url: str, source_url: str, timeout: int) -> tuple[str, dict[str, str]]:
    try:
        text, method = run_curl(csv_url, source_url, timeout=timeout, no_revoke=False)
        return text, {"content_type": "unknown-from-curl", "final_url": csv_url, "method": method}
    except FetchError as normal_curl_error:
        err = str(normal_curl_error)
        revocation_error = (
            "CRYPT_E_NO_REVOCATION_CHECK" in err
            or "revocation function was unable to check revocation" in err.lower()
            or "unable to check revocation" in err.lower()
        )

        if not revocation_error:
            raise

        print(
            "curl failed because Windows could not check certificate revocation. "
            "Retrying with curl --ssl-no-revoke...",
            file=sys.stderr,
        )
        text, method = run_curl(csv_url, source_url, timeout=timeout, no_revoke=True)
        return text, {"content_type": "unknown-from-curl", "final_url": csv_url, "method": method}


def fetch_text(
    csv_url: str,
    source_url: str,
    timeout: int,
    retries: int,
) -> tuple[str, dict[str, str]]:
    try:
        return fetch_text_with_urllib(csv_url, source_url, timeout=timeout, retries=retries)
    except FetchError as urllib_error:
        error_text = str(urllib_error)
        print(f"Python urllib fetch failed: {urllib_error}", file=sys.stderr)

        should_try_curl = (
            "CERTIFICATE_VERIFY_FAILED" in error_text
            or "HTTP Error 403" in error_text
            or "Forbidden" in error_text
        )

        if should_try_curl:
            print("Trying curl fallback...", file=sys.stderr)
            try:
                return fetch_text_with_curl(csv_url, source_url, timeout=timeout)
            except FetchError as curl_error:
                raise FetchError(
                    "Both Python urllib and curl failed.\n"
                    f"urllib error: {urllib_error}\n"
                    f"curl error: {curl_error}\n\n"
                    "Your browser can download the CSV, so if this still fails locally, "
                    "try the same script from another network or rely on GitHub Actions to run it."
                ) from curl_error

        raise urllib_error


def looks_like_html(text: str, content_type: str) -> bool:
    prefix = text.lstrip()[:200].lower()
    return "text/html" in content_type.lower() or prefix.startswith("<!doctype") or prefix.startswith("<html")


def sniff_csv_headers(text: str) -> list[str]:
    sample = text[:8192]
    reader = csv.reader(sample.splitlines())
    try:
        return next(reader)
    except StopIteration:
        return []


def validate_csv_text(text: str, content_type: str) -> list[str]:
    if not text.strip():
        raise FetchError("Fetched response is empty.")

    if looks_like_html(text, content_type):
        raise FetchError(
            "Fetched response looks like HTML, not CSV. The URL may have returned a webpage instead of stats.csv."
        )

    headers = [h.strip().strip('"') for h in sniff_csv_headers(text)]
    if len(headers) < 5:
        raise FetchError(f"Fetched response does not look like a useful CSV. Headers seen: {headers}")

    return headers


def write_metadata(
    source_url: str,
    csv_url: str,
    row_count: int,
    headers: Iterable[str],
    method: str,
) -> None:
    METADATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    header_list = list(headers)
    payload = {
        "last_updated_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "Baseball Savant Custom Leaderboard",
        "source_url": source_url,
        "csv_url": csv_url,
        "row_count": row_count,
        "column_count": len(header_list),
        "fetch_method": method,
    }
    METADATA_FILE.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def count_rows(csv_text: str) -> int:
    reader = csv.DictReader(csv_text.splitlines())
    return sum(1 for _ in reader)


def import_downloaded_csv(csv_text: str, allow_missing: bool, dry_run: bool) -> int:
    if not IMPORT_SCRIPT.exists():
        raise FileNotFoundError(f"Missing importer script: {IMPORT_SCRIPT}")

    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", suffix=".csv", delete=False) as tmp:
        tmp.write(csv_text)
        tmp_path = Path(tmp.name)

    try:
        command = [sys.executable, str(IMPORT_SCRIPT), str(tmp_path)]
        if allow_missing:
            command.append("--allow-missing")
        if dry_run:
            command.append("--dry-run")
        subprocess.run(command, cwd=PROJECT_ROOT, check=True)
        return 0
    finally:
        try:
            tmp_path.unlink()
        except FileNotFoundError:
            pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch and import a Baseball Savant Custom Leaderboard CSV.")
    parser.add_argument(
        "--url",
        help="Baseball Savant Custom Leaderboard share URL. Defaults to config/savant_leaderboard_url.txt",
    )
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES)
    parser.add_argument("--allow-missing", action="store_true", help="Pass through to import_savant_export.py")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and validate without changing project data files.")
    parser.add_argument("--save-raw", help="Optional path to save the exact fetched CSV before importing, for debugging.")
    args = parser.parse_args()

    source_url = args.url or read_default_url()
    csv_url = build_csv_url(source_url)

    print("Source leaderboard URL:", source_url)
    print("CSV URL:", csv_url)

    csv_text, response_info = fetch_text(
        csv_url,
        source_url=source_url,
        timeout=args.timeout,
        retries=args.retries,
    )

    if args.save_raw:
        raw_path = Path(args.save_raw).expanduser()
        raw_path.write_text(csv_text, encoding="utf-8", newline="")
        print("Raw fetched CSV saved:", raw_path)

    headers = validate_csv_text(csv_text, response_info.get("content_type", ""))
    rows = count_rows(csv_text)

    print(f"Fetched CSV successfully. Rows: {rows} | Columns: {len(headers)}")
    print("Content-Type:", response_info.get("content_type", "unknown"))
    print("Fetch method:", response_info.get("method", "unknown"))

    result = import_downloaded_csv(csv_text, allow_missing=args.allow_missing, dry_run=args.dry_run)

    if not args.dry_run:
        write_metadata(source_url, csv_url, rows, headers, response_info.get("method", "unknown"))
        print("Update metadata written: data/last_updated.json")

    return result


if __name__ == "__main__":
    raise SystemExit(main())

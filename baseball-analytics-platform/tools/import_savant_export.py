#!/usr/bin/env python3
"""
Import a Baseball Savant Custom Leaderboard CSV into the app.

This importer is intentionally tolerant of the different CSV shapes Baseball Savant
can produce:
  - app/internal headers, such as xwoba, batting_avg, player_age
  - display headers, such as xwOBA, AVG, Age, Barrel%, Hard Hit %
  - CSVs where the season year is only in the URL and the visible "Year" column is
    actually player age
  - player-name columns labeled Player, Name, player_name, or similar

It writes a cleaned app-compatible CSV to data/stats.csv, then regenerates
src/embeddedData.js.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TARGET = PROJECT_ROOT / "data" / "stats.csv"
EMBED_SCRIPT = PROJECT_ROOT / "tools" / "regenerate_embedded_data.py"
DEFAULT_URL_FILE = PROJECT_ROOT / "config" / "savant_leaderboard_url.txt"

REQUIRED_COLUMNS = [
    "last_name, first_name",
    "player_id",
    "year",
    "player_age",
    "ab",
    "pa",
    "hit",
    "home_run",
    "strikeout",
    "walk",
    "k_percent",
    "bb_percent",
    "batting_avg",
    "slg_percent",
    "on_base_percent",
    "on_base_plus_slg",
    "isolated_power",
    "babip",
    "b_rbi",
    "r_total_caught_stealing",
    "r_total_stolen_base",
    "r_run",
    "xba",
    "xslg",
    "woba",
    "xwoba",
    "xobp",
    "xiso",
    "barrel_batted_rate",
    "hard_hit_percent",
    "exit_velocity_avg",
    "avg_best_speed",
    "sweet_spot_percent",
    "solidcontact_percent",
    "whiff_percent",
    "oz_swing_percent",
    "iz_contact_percent",
    "z_swing_miss_percent",
]

DISPLAY_HEADER_MAP = {
    "Rk.": "rank",
    "Rk": "rank",
    "Rank": "rank",
    "Player": "last_name, first_name",
    "Name": "last_name, first_name",
    "player_name": "last_name, first_name",
    "last_name, first_name": "last_name, first_name",
    "Last Name, First Name": "last_name, first_name",
    "Year": "year",
    "Season": "year",
    "Age": "player_age",
    "player_age": "player_age",
    "AB": "ab",
    "PA": "pa",
    "H": "hit",
    "1B": "single",
    "2B": "double",
    "3B": "triple",
    "HR": "home_run",
    "SO": "strikeout",
    "BB": "walk",
    "K%": "k_percent",
    "BB%": "bb_percent",
    "AVG": "batting_avg",
    "SLG": "slg_percent",
    "OBP": "on_base_percent",
    "OPS": "on_base_plus_slg",
    "ISO": "isolated_power",
    "BABIP": "babip",
    "RBI": "b_rbi",
    "LOB": "b_lob",
    "TB": "b_total_bases",
    "CS": "r_total_caught_stealing",
    "SB": "r_total_stolen_base",
    "AB-Scoring": "b_ab_scoring",
    "Balls": "b_ball",
    "Called Strike": "b_called_strike",
    "Catcher Int.": "b_catcher_interf",
    "Foul": "b_foul",
    "Foul Tip": "b_foul_tip",
    "G": "b_game",
    "GIDP": "b_gnd_into_dp",
    "GITP": "b_gnd_into_tp",
    "2B-GRD": "b_gnd_rule_double",
    "HBP": "b_hit_by_pitch",
    "Hit-GB": "b_hit_ground",
    "Hit-FB": "b_hit_fly",
    "HIP": "b_hit_into_play",
    "Hit-LD": "b_hit_line_drive",
    "H-Popup": "b_hit_popup",
    "Out-FB": "b_out_fly",
    "Out-GB": "b_out_ground",
    "Out-LD": "b_out_line_drive",
    "Out-Popup": "b_out_popup",
    "IntentBall": "b_intent_ball",
    "IBB": "b_intent_walk",
    "Interference": "b_interference",
    "Pinch Hit": "b_pinch_hit",
    "Pinch Run": "b_pinch_run",
    "Pitchout": "b_pitchout",
    "G-DH": "b_played_dh",
    "Sac Bunt": "b_sac_bunt",
    "Sac Fly": "b_sac_fly",
    "Swing & Misses": "b_swinging_strike",
    "CS-2B": "r_caught_stealing_2b",
    "CS-3B": "r_caught_stealing_3b",
    "CS-HP": "r_caught_stealing_home",
    "Def Indiff": "r_defensive_indiff",
    "Runner Int.": "r_interference",
    "Pickoff 1B-Out": "r_pickoff_1b",
    "Pickoff 2B-Out": "r_pickoff_2b",
    "Pickoff 3B-Out": "r_pickoff_3b",
    "R": "r_run",
    "SB-2B": "r_stolen_base_2b",
    "SB-3B": "r_stolen_base_3b",
    "SB-HP": "r_stolen_base_home",
    "TotalBalls": "b_total_ball",
    "Sac": "b_total_sacrifices",
    "Total Strikes": "b_total_strike",
    "Total Swings": "b_total_swinging_strike",
    "TP": "b_total_pitches",
    "SB%": "r_stolen_base_pct",
    "Pickoff": "r_total_pickoff",
    "ROE": "b_reached_on_error",
    "Walkoff": "b_walkoff",
    "ROI": "b_reached_on_int",
    "xBA": "xba",
    "xSLG": "xslg",
    "wOBA": "woba",
    "xwOBA": "xwoba",
    "xOBP": "xobp",
    "xISO": "xiso",
    "wOBAcon": "wobacon",
    "xwOBAcon": "xwobacon",
    "BACON": "bacon",
    "xBACON": "xbacon",
    "BA - xBA": "xbadiff",
    "SLG - xSLG": "xslgdiff",
    "wOBA - xwOBA": "wobadiff",
    "Bat Speed": "avg_swing_speed",
    "Fast Swing %": "fast_swing_rate",
    "Blasts / Contact": "blasts_contact",
    "Blasts / Swing": "blasts_swing",
    "Squared-Up / Contact": "squared_up_contact",
    "Squared-Up / Swing": "squared_up_swing",
    "Swing Length": "avg_swing_length",
    "Swords": "swords",
    "Attack Angle": "attack_angle",
    "Attack Direction": "attack_direction",
    "Ideal Attack Angle %": "ideal_angle_rate",
    "Swing Path Tilt": "vertical_swing_path",
    "Avg EV (MPH)": "exit_velocity_avg",
    "Avg LA (°)": "launch_angle_avg",
    "LA Sweet-Spot %": "sweet_spot_percent",
    "Barrels": "barrel",
    "Barrel%": "barrel_batted_rate",
    "Solid Contact %": "solidcontact_percent",
    "Flare/Burner %": "flareburner_percent",
    "Under %": "poorlyunder_percent",
    "Topped %": "poorlytopped_percent",
    "Poor/Weak %": "poorlyweak_percent",
    "Hard Hit %": "hard_hit_percent",
    "EV50": "avg_best_speed",
    "Adjusted EV": "avg_hyper_speed",
    "Zone Swing %": "z_swing_percent",
    "Zone Swing & Miss %": "z_swing_miss_percent",
    "Out of Zone Swing %": "oz_swing_percent",
    "Out of Zone Swing & Miss%": "oz_swing_miss_percent",
    "Out of Zone Contact %": "oz_contact_percent",
    "Out of Zone Swing & Miss": "out_zone_swing_miss",
    "Out of Zone Swings": "out_zone_swing",
    "Out of Zone %": "out_zone_percent",
    "Out of Zone": "out_zone",
    "Meatball Swing %": "meatball_swing_percent",
    "Meatball %": "meatball_percent",
    "# Offspeed": "pitch_count_offspeed",
    "# Fastball": "pitch_count_fastball",
    "# Breaking": "pitch_count_breaking",
    "Pitches": "pitch_count",
    "In Zone Contact %": "iz_contact_percent",
    "In Zone Swing & Miss": "in_zone_swing_miss",
    "In Zone Swings": "in_zone_swing",
    "In Zone %": "in_zone_percent",
    "In Zone": "in_zone",
    "Edge %": "edge_percent",
    "Edge": "edge",
    "Whiff %": "whiff_percent",
    "Swing %": "swing_percent",
    "Pull %": "pull_percent",
    "Straight Away %": "straightaway_percent",
    "Oppo %": "opposite_percent",
    "Batted Balls": "batted_ball",
    "First Strike %": "f_strike_percent",
    "GB%": "groundballs_percent",
    "GB": "groundballs",
    "FB%": "flyballs_percent",
    "FB": "flyballs",
    "LD %": "linedrives_percent",
    "LD": "linedrives",
    "Popup %": "popups_percent",
    "Popups": "popups",
    "Sprint Speed": "sprint_speed",
}


def clean_header(value: str) -> str:
    return value.replace("\ufeff", "").strip().strip('"').strip()


def slug(value: str) -> str:
    value = value.replace("%", " percent ").replace("°", "")
    value = re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_").lower()
    return value or "column"


def clean_value(value: str | None) -> str:
    if value is None:
        return ""
    value = str(value).replace("\ufeff", "").strip()
    if value == "--":
        return ""
    return value.replace("°", "")


def generated_player_id(name: str, year: str) -> str:
    seed = f"{name}|{year}".strip("|") or "player"
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:10]
    base = re.sub(r"[^A-Za-z0-9]+", "-", name.strip().lower()).strip("-") or "player"
    return f"{base}-{year or 'unknown'}-{digest}"


def normalize_header(header: str) -> str:
    cleaned = clean_header(header)
    mapped = DISPLAY_HEADER_MAP.get(cleaned, cleaned)
    if mapped == cleaned and cleaned not in REQUIRED_COLUMNS and (
        " " in cleaned or "%" in cleaned or "." in cleaned or "-" in cleaned or "/" in cleaned or "°" in cleaned
    ):
        mapped = slug(cleaned)
    return mapped


def maybe_split_player_name(first_part: str, second_part: str) -> bool:
    """Return True only when Player was truly split as Last, First by CSV parsing."""
    first = clean_value(first_part)
    second = clean_value(second_part)

    # Already parsed correctly as "Last, First"; do NOT merge with the year.
    if "," in first:
        return False

    # If the next token is a season year, the player name is not split.
    if is_season_year(second):
        return False

    # If the next token looks like an age/AB/stat number, the player name is not split.
    if numeric(second) is not None:
        return False

    return bool(first and second and re.search(r"[A-Za-z]", first) and re.search(r"[A-Za-z]", second))


def maybe_thousands_split(left: str, right: str) -> bool:
    """Return True for malformed unquoted thousands values like 1,278 parsed as ['1','278']."""
    left = clean_value(left)
    right = clean_value(right)
    return bool(re.fullmatch(r"\d{1,3}", left) and re.fullmatch(r"\d{3}", right))


def align_row(headers: list[str], values: list[str]) -> list[str]:
    """
    Align a Baseball Savant row with its header row.

    Two malformed CSV cases can happen depending on how the download is produced:
      1. Player names may appear as unquoted Last, First and split into two tokens.
      2. Large integers may appear with thousands separators like 1,278 and split into two tokens.

    The earlier importer merged the Player column whenever a row had extra tokens.
    That was too aggressive: if the Player column was already correctly parsed as
    'Johnson, Bryce', but another later value like 1,278 caused an extra token, it
    accidentally merged the player with Year and shifted Age/AB/PA/H left.
    """
    values = [clean_value(v) for v in values]

    # First, repair Player only if the name is truly split as two nonnumeric tokens.
    player_indices = [i for i, h in enumerate(headers) if normalize_header(h) == "last_name, first_name"]
    if len(values) > len(headers) and player_indices:
        i = player_indices[0]
        if i + 1 < len(values) and maybe_split_player_name(values[i], values[i + 1]):
            values[i] = f"{values[i]}, {values[i + 1]}".strip()
            del values[i + 1]

    # Then repair any unquoted thousands separators from right-to-left so indices stay stable.
    while len(values) > len(headers):
        fixed = False
        max_i = min(len(values) - 2, len(headers) - 1)
        for i in range(max_i, -1, -1):
            if maybe_thousands_split(values[i], values[i + 1]):
                values[i] = f"{values[i]},{values[i + 1]}"
                del values[i + 1]
                fixed = True
                break
        if not fixed:
            break

    if len(values) < len(headers):
        values += [""] * (len(headers) - len(values))

    return values[: len(headers)]

def parse_fallback_year() -> str:
    if DEFAULT_URL_FILE.exists():
        text = DEFAULT_URL_FILE.read_text(encoding="utf-8", errors="ignore").strip()
        try:
            parsed = urlparse(text)
            year = parse_qs(parsed.query).get("year", [""])[0]
            if re.fullmatch(r"\d{4}", year):
                return year
        except Exception:
            pass
    return str(dt.datetime.now().year)


def numeric(value: str | None) -> float | None:
    if value is None:
        return None
    value = str(value).replace("%", "").replace(",", "").strip()
    if value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def mostly(values: list[str], predicate) -> bool:
    values = [v for v in values if str(v).strip()]
    if not values:
        return False
    return sum(1 for v in values if predicate(v)) / len(values) >= 0.75


def is_season_year(value: str) -> bool:
    n = numeric(value)
    return n is not None and 1900 <= n <= 2100 and float(n).is_integer()


def is_age(value: str) -> bool:
    n = numeric(value)
    return n is not None and 15 <= n <= 55


def looks_like_name(value: str) -> bool:
    value = clean_value(value)
    if not value or len(value) < 3:
        return False
    if numeric(value) is not None:
        return False
    # Avoid picking headers/stat-like strings.
    if not re.search(r"[A-Za-z]", value):
        return False
    if value.lower() in {"null", "none", "nan"}:
        return False
    # Baseball Savant names usually have letters, often with a comma.
    return True



def ratio(values: list[str], predicate) -> float:
    values = [v for v in values if str(v).strip()]
    if not values:
        return 0.0
    return sum(1 for v in values if predicate(v)) / len(values)


def should_repair_missing_age_shift(headers: list[str], rows: list[dict[str, str]]) -> bool:
    """
    Detect Savant CSVs where the header includes Age/player_age, but the actual row
    values skip that field. The visible symptom is:
      player_age contains AB
      ab contains PA
      pa contains H
      hit contains 1B
    """
    required = {"player_age", "ab", "pa", "hit"}
    if not required.issubset(set(headers)):
        return False

    # In valid baseball data, player_age should usually be 15-55 and PA >= AB >= H.
    age_values = [row.get("player_age", "") for row in rows]
    invalid_age_ratio = ratio(age_values, lambda v: (numeric(v) or 0) > 55)

    def pa_less_than_ab(row: dict[str, str]) -> bool:
        pa = numeric(row.get("pa"))
        ab = numeric(row.get("ab"))
        return pa is not None and ab is not None and pa < ab

    pa_lt_ab_ratio = ratio(["1" if pa_less_than_ab(row) else "" for row in rows], lambda v: v == "1")

    # The old broken import showed Max PA lower than Max AB and many impossible ages.
    return invalid_age_ratio >= 0.35 and pa_lt_ab_ratio >= 0.50


def repair_missing_age_shift(headers: list[str], rows: list[dict[str, str]]) -> None:
    """
    Shift values one column to the right starting after player_age.

    Before:
      player_age=actual AB, ab=actual PA, pa=actual H, hit=actual 1B
    After:
      player_age="", ab=actual AB, pa=actual PA, hit=actual H
    """
    try:
        start = headers.index("player_age")
    except ValueError:
        return

    for row in rows:
        old = dict(row)
        row["player_age"] = ""
        for i in range(start + 1, len(headers)):
            row[headers[i]] = old.get(headers[i - 1], "")



def postprocess_rows(headers: list[str], rows: list[dict[str, str]], raw_rows: list[dict[str, str]]) -> tuple[list[str], list[dict[str, str]]]:
    fallback_year = parse_fallback_year()

    # If the column called "year" is actually player age, move it.
    year_values = [row.get("year", "") for row in rows]
    player_age_values = [row.get("player_age", "") for row in rows]

    year_is_season = mostly(year_values, is_season_year)
    year_is_age = mostly(year_values, is_age)
    player_age_is_season = mostly(player_age_values, is_season_year)

    if player_age_is_season and year_is_age:
        # Column names are swapped.
        for row in rows:
            row["year"], row["player_age"] = row.get("player_age", ""), row.get("year", "")
    elif not year_is_season:
        if year_is_age and "player_age" not in headers:
            for row in rows:
                row["player_age"] = row.get("year", "")
            if "player_age" not in headers:
                headers.append("player_age")
        for row in rows:
            row["year"] = fallback_year
        if "year" not in headers:
            headers.append("year")

    # Fill/repair player name.
    for idx, row in enumerate(rows):
        name = row.get("last_name, first_name", "").strip()
        if not name:
            raw = raw_rows[idx] if idx < len(raw_rows) else {}
            # Prefer obvious raw fields first.
            for raw_key in raw:
                key = clean_header(raw_key).lower()
                if key in {"player", "name", "player_name", "last_name, first_name", "last name, first name"}:
                    if looks_like_name(raw[raw_key]):
                        name = clean_value(raw[raw_key])
                        break
            # Then scan the first few raw values for something that looks like a name.
            if not name:
                for raw_key, raw_value in list(raw.items())[:8]:
                    if looks_like_name(raw_value):
                        name = clean_value(raw_value)
                        break
        if not name:
            name = f"Unknown Player {idx + 1}"
        row["last_name, first_name"] = name

    if "last_name, first_name" not in headers:
        headers.insert(0, "last_name, first_name")

    # Fill/repair player_id.
    for row in rows:
        if not row.get("player_id"):
            row["player_id"] = generated_player_id(row.get("last_name, first_name", ""), row.get("year", fallback_year))
    if "player_id" not in headers:
        insert_at = headers.index("last_name, first_name") + 1 if "last_name, first_name" in headers else 0
        headers.insert(insert_at, "player_id")

    # Repair Savant CSVs where Age/player_age appears as a header but the row values
    # skip age and begin immediately with AB/PA/H.
    if should_repair_missing_age_shift(headers, rows):
        print(
            "Detected Savant CSV missing actual Age values; shifting AB/PA/H and later stats into the correct columns.",
            file=sys.stderr,
        )
        repair_missing_age_shift(headers, rows)

    # Preserve unique header order.
    unique_headers = []
    for h in headers:
        if h != "rank" and h not in unique_headers:
            unique_headers.append(h)
    return unique_headers, rows



def is_split_name_header(left: str, right: str) -> bool:
    left_clean = clean_header(left).strip().strip('"').lower()
    right_clean = clean_header(right).strip().strip('"').lower()
    return (
        left_clean in {"last_name", "last name", "last"}
        and right_clean in {"first_name", "first name", "first"}
    )


def repair_split_name_header(raw_headers: list[str]) -> tuple[list[str], int | None]:
    """
    Some Savant CSV responses can send the first header as:
        last_name, first_name,player_id,year,...
    without quotes around last_name, first_name.

    csv.reader then sees 155 headers instead of 154:
        ["last_name", "first_name", "player_id", ...]

    But rows may still be correctly quoted as:
        ["Johnson, Bryce", "669369", "2026", ...]

    This merges the split header back into one logical field.
    """
    headers = list(raw_headers)
    for i in range(len(headers) - 1):
        if is_split_name_header(headers[i], headers[i + 1]):
            headers[i] = "last_name, first_name"
            del headers[i + 1]
            return headers, i
    return headers, None


def repair_values_for_split_name_header(values: list[str], original_header_count: int, repaired_header_count: int, split_index: int | None) -> list[str]:
    values = [clean_value(v) for v in values]

    if split_index is None:
        return values

    # Case 1: header was split but row was already correct/quoted.
    # Example:
    #   headers before repair: 155
    #   headers after repair: 154
    #   row values: 154, with "Johnson, Bryce" as one value
    if len(values) == repaired_header_count:
        return values

    # Case 2: both header and player value are split.
    # Example:
    #   ["Johnson", "Bryce", "669369", "2026", ...]
    if len(values) == original_header_count and split_index + 1 < len(values):
        left = values[split_index]
        right = values[split_index + 1]
        if maybe_split_player_name(left, right):
            values[split_index] = f"{left}, {right}".strip()
            del values[split_index + 1]

    return values



def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        try:
            original_raw_headers = [clean_header(h) for h in next(reader)]
        except StopIteration:
            raise ValueError("CSV appears to have no header row.")

        raw_headers, split_name_header_index = repair_split_name_header(original_raw_headers)
        if split_name_header_index is not None:
            print(
                "Detected split 'last_name, first_name' CSV header; merging it back into one column.",
                file=sys.stderr,
            )

        normalized_headers = []
        used: set[str] = set()
        for h in raw_headers:
            mapped = normalize_header(h)
            candidate = mapped
            if candidate in used:
                i = 2
                while f"{candidate}_{i}" in used:
                    i += 1
                candidate = f"{candidate}_{i}"
            used.add(candidate)
            normalized_headers.append(candidate)

        rows: list[dict[str, str]] = []
        raw_dicts: list[dict[str, str]] = []
        for values in reader:
            values = repair_values_for_split_name_header(
                values,
                original_header_count=len(original_raw_headers),
                repaired_header_count=len(raw_headers),
                split_index=split_name_header_index,
            )
            values = align_row(raw_headers, values)

            raw_dict = {raw_headers[i]: clean_value(values[i]) for i in range(len(raw_headers))}
            row: dict[str, str] = {}
            for old_key, new_key, value in zip(raw_headers, normalized_headers, values):
                if new_key == "rank":
                    continue
                row[new_key] = clean_value(value)
            if any(v for v in row.values()):
                rows.append(row)
                raw_dicts.append(raw_dict)

    headers = [h for h in normalized_headers if h != "rank"]
    return postprocess_rows(headers, rows, raw_dicts)


def load_preferred_column_order() -> list[str]:
    if not DEFAULT_TARGET.exists():
        return []
    with DEFAULT_TARGET.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        try:
            return [clean_header(h) for h in next(reader)]
        except StopIteration:
            return []


def validate_columns(headers: Iterable[str]) -> list[str]:
    header_set = set(headers)
    return [col for col in REQUIRED_COLUMNS if col not in header_set]


def ordered_headers(source_headers: list[str], preferred_headers: list[str]) -> list[str]:
    ordered: list[str] = []
    for col in preferred_headers:
        if col in source_headers and col not in ordered:
            ordered.append(col)
    for col in REQUIRED_COLUMNS:
        if col in source_headers and col not in ordered:
            ordered.append(col)
    for col in source_headers:
        if col not in ordered:
            ordered.append(col)
    return ordered


def summarize(rows: list[dict[str, str]]) -> dict[str, object]:
    years = sorted({row.get("year", "") for row in rows if row.get("year", "")})
    max_ab = max((numeric(row.get("ab")) or 0 for row in rows), default=0)
    max_pa = max((numeric(row.get("pa")) or 0 for row in rows), default=0)
    qualified_100 = sum(1 for row in rows if (numeric(row.get("ab")) or 0) >= 100)
    unnamed = sum(1 for row in rows if row.get("last_name, first_name", "").startswith("Unknown Player "))
    return {
        "rows": len(rows),
        "years": ", ".join(years) if years else "unknown",
        "max_ab": int(max_ab),
        "max_pa": int(max_pa),
        "qualified_100_ab": qualified_100,
        "unnamed": unnamed,
    }


def backup_existing(target: Path) -> Path | None:
    if not target.exists():
        return None
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = target.with_name(f"{target.stem}.backup-{stamp}{target.suffix}")
    shutil.copy2(target, backup)
    return backup


def write_csv(path: Path, headers: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def regenerate_embedded_data() -> None:
    if not EMBED_SCRIPT.exists():
        raise FileNotFoundError(f"Missing embedded data script: {EMBED_SCRIPT}")
    subprocess.run([sys.executable, str(EMBED_SCRIPT)], cwd=PROJECT_ROOT, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a Baseball Savant CSV export into the app.")
    parser.add_argument("csv_path", help="Path to the CSV file downloaded from Baseball Savant.")
    parser.add_argument("--target", default=str(DEFAULT_TARGET), help="Destination CSV path. Default: data/stats.csv")
    parser.add_argument("--allow-missing", action="store_true", help="Import even if scoring-model columns are missing.")
    parser.add_argument("--no-embed", action="store_true", help="Do not regenerate src/embeddedData.js after import.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and summarize without writing files.")
    args = parser.parse_args()

    source = Path(args.csv_path).expanduser().resolve()
    target = Path(args.target).expanduser().resolve()

    headers, rows = read_csv(source)
    missing = validate_columns(headers)

    print("Source:", source)
    print("Rows:", len(rows))
    info = summarize(rows)
    print(f"Years: {info['years']}")
    print(f"Max AB: {info['max_ab']} | Max PA: {info['max_pa']} | 100+ AB rows: {info['qualified_100_ab']}")
    if info["unnamed"]:
        print(f"Warning: {info['unnamed']} rows did not have an obvious player name and were assigned Unknown Player labels.")

    # This warning catches the exact suspicious pattern you saw earlier.
    if info["max_pa"] and info["max_ab"] and info["max_pa"] < info["max_ab"]:
        print("Warning: Max PA is lower than Max AB. That is unusual for baseball data; inspect data/stats.csv if rankings look wrong.")

    if missing:
        print("\nMissing columns needed by the current scoring model:")
        for col in missing:
            print(f"  - {col}")
        if not args.allow_missing:
            print("\nImport stopped. The CSV did not contain enough fields for the current app/scoring logic.")
            print("Do not use --allow-missing unless you are intentionally changing the app/scoring logic.")
            return 2

    if args.dry_run:
        print("\nDry run complete. No files changed.")
        return 0

    preferred = load_preferred_column_order()
    output_headers = ordered_headers(headers, preferred)

    backup = backup_existing(target)
    if backup:
        try:
            shown_backup = backup.relative_to(PROJECT_ROOT)
        except ValueError:
            shown_backup = backup
        print("Backup written:", shown_backup)

    write_csv(target, output_headers, rows)
    try:
        shown_target = target.relative_to(PROJECT_ROOT)
    except ValueError:
        shown_target = target
    print("Imported CSV written:", shown_target)

    if not args.no_embed:
        regenerate_embedded_data()
        print("Embedded fallback regenerated: src/embeddedData.js")

    print("\nDone. Restart/refresh the local app, then click 'Reset to included data' if your browser has an older uploaded CSV cached.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

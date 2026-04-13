#!/usr/bin/env python3
"""
ETL script: fetch all player-season stats from the NBA API and save as
public/data/player_seasons.json for the Two-Point % Explorer web app.

Run from anywhere:
    python fetch_data.py

The output file defaults to  <repo-root>/public/data/player_seasons.json.

Options:
    --start YYYY-YY     First season to fetch  (default: 1996-97)
    --end   YYYY-YY     Last season to fetch   (default: 2024-25)
    --output PATH       Override output file path
    --update-current    Only re-fetch the current/most recent season
"""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
from nba_api.stats.endpoints import leaguedashplayerstats

API_TIMEOUT = 60       # seconds per request
MAX_RETRIES = 3        # attempts before giving up on a season
RETRY_BACKOFF = [2, 4, 8]  # seconds between retries

# stats.nba.com requires browser-like headers or it throttles/times out
NBA_HEADERS = {
    'Host': 'stats.nba.com',
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
    'Origin': 'https://www.nba.com',
    'Referer': 'https://www.nba.com/',
    'Sec-Fetch-Site': 'same-site',
    'Sec-Fetch-Mode': 'cors',
    'Connection': 'keep-alive',
}

# ─── Defaults ────────────────────────────────────────────────────────────────

DEFAULT_START = "1996-97"
DEFAULT_END   = "2024-25"

# Relative to this script's location: go up 3 dirs to repo root
REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OUTPUT = REPO_ROOT / "public" / "data" / "player_seasons.json"

# ─── Helpers ─────────────────────────────────────────────────────────────────

def season_range(start: str, end: str) -> list[str]:
    s, e = int(start[:4]), int(end[:4])
    return [f"{y}-{str(y + 1)[-2:]}" for y in range(s, e + 1)]


def fetch_season(season: str) -> pd.DataFrame:
    """Fetch all player stats for one regular season (Totals), with retries."""
    print(f"  {season}...", end="", flush=True)
    time.sleep(0.7)   # polite rate-limiting

    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = leaguedashplayerstats.LeagueDashPlayerStats(
                season=season,
                season_type_all_star="Regular Season",
                measure_type_detailed_defense="Base",
                per_mode_detailed="Totals",
                timeout=API_TIMEOUT,
                headers=NBA_HEADERS,
            )
            df = resp.get_data_frames()[0]
            df["SEASON"] = season
            print(f" {len(df)} players")
            return df
        except Exception as e:
            last_err = e
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_BACKOFF[attempt]
                print(f" timeout, retrying in {wait}s...", end="", flush=True)
                time.sleep(wait)

    raise RuntimeError(f"Failed after {MAX_RETRIES} attempts: {last_err}")


def process_season(df: pd.DataFrame, season: str) -> list[dict]:
    """Convert one season's raw DataFrame into a list of row dicts."""
    rows = []

    # Some older API versions don't include PLAYER_POSITION.
    has_pos = "PLAYER_POSITION" in df.columns

    for _, r in df.iterrows():
        fgm   = int(r.get("FGM", 0))
        fga   = int(r.get("FGA", 0))
        fg3m  = int(r.get("FG3M", 0))
        fg3a  = int(r.get("FG3A", 0))
        ftm   = int(r.get("FTM", 0))
        fta   = int(r.get("FTA", 0))
        gp    = int(r.get("GP", 1)) or 1

        two_pm = fgm - fg3m
        two_pa = fga - fg3a
        two_pct = (two_pm / two_pa) if two_pa > 0 else 0.0

        rows.append({
            "id":       int(r["PLAYER_ID"]),
            "name":     str(r["PLAYER_NAME"]),
            "season":   season,
            "team":     str(r.get("TEAM_ABBREVIATION", "")),
            "pos":      str(r.get("PLAYER_POSITION", "")) if has_pos else "",
            "gp":       gp,
            # Shooting totals
            "fgm":      fgm,
            "fga":      fga,
            "fg_pct":   round(float(r.get("FG_PCT", 0) or 0), 4),
            "fg3m":     fg3m,
            "fg3a":     fg3a,
            "fg3_pct":  round(float(r.get("FG3_PCT", 0) or 0), 4),
            "ftm":      ftm,
            "fta":      fta,
            "ft_pct":   round(float(r.get("FT_PCT", 0) or 0), 4),
            # 2-point derived
            "two_pm":   two_pm,
            "two_pa":   two_pa,
            "two_pct":  round(two_pct, 4),
            # Counting stat totals
            "oreb":     int(r.get("OREB", 0)),
            "dreb":     int(r.get("DREB", 0)),
            "reb":      int(r.get("REB", 0)),
            "ast":      int(r.get("AST", 0)),
            "stl":      int(r.get("STL", 0)),
            "blk":      int(r.get("BLK", 0)),
            "pts":      int(r.get("PTS", 0)),
            "tov":      int(r.get("TOV", 0)),
        })

    return rows


def fetch_positions_fallback(player_ids: list[int]) -> dict[int, str]:
    """
    If PLAYER_POSITION is missing from LeagueDashPlayerStats, use PlayerIndex
    to build a player_id → position lookup.  Called at most once.
    """
    from nba_api.stats.endpoints import playerindex
    print("  Fetching player positions from PlayerIndex…", end="", flush=True)
    time.sleep(0.7)
    try:
        pi = playerindex.PlayerIndex(league_id="00")
        df = pi.get_data_frames()[0]
        mapping = {}
        for _, r in df.iterrows():
            pid = int(r.get("PERSON_ID", 0))
            pos = str(r.get("POSITION", "") or "")
            if pid:
                mapping[pid] = pos
        print(f" {len(mapping)} players")
        return mapping
    except Exception as e:
        print(f" FAILED ({e})")
        return {}


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Fetch NBA player season stats for the web app.")
    parser.add_argument("--start",          default=DEFAULT_START, metavar="YYYY-YY")
    parser.add_argument("--end",            default=DEFAULT_END,   metavar="YYYY-YY")
    parser.add_argument("--output",         default=str(DEFAULT_OUTPUT), metavar="PATH")
    parser.add_argument("--update-current", action="store_true",
                        help=f"Only re-fetch {DEFAULT_END} (merges into existing file)")
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # If --update-current, load existing data and replace only the latest season
    existing_rows: list[dict] = []
    if args.update_current:
        if output_path.exists():
            with open(output_path) as f:
                existing = json.load(f)
            existing_rows = [r for r in existing.get("data", []) if r["season"] != DEFAULT_END]
            print(f"Loaded {len(existing_rows)} rows from existing file (excluding {DEFAULT_END}).")
        seasons = [DEFAULT_END]
    else:
        seasons = season_range(args.start, args.end)

    print(f"\nFetching {len(seasons)} season(s)…\n")

    all_rows: list[dict] = []
    position_cache: dict[int, str] | None = None  # lazy-loaded if needed

    for season in seasons:
        try:
            df = fetch_season(season)
        except Exception as e:
            print(f"  ERROR fetching {season}: {e}")
            continue

        rows = process_season(df, season)

        # Check if positions are populated
        has_positions = any(r["pos"] for r in rows)
        if not has_positions:
            if position_cache is None:
                position_cache = fetch_positions_fallback([r["id"] for r in rows])
            for r in rows:
                r["pos"] = position_cache.get(r["id"], "")

        all_rows.extend(rows)

    # Merge with preserved existing rows
    final_rows = existing_rows + all_rows

    # Sort by season desc, then by player name
    final_rows.sort(key=lambda r: (r["season"], r["name"]))

    # Build covered seasons list
    seasons_covered = sorted(set(r["season"] for r in final_rows))

    output = {
        "meta": {
            "fetched_at":      datetime.now().isoformat(),
            "seasons_covered": seasons_covered,
            "total_rows":      len(final_rows),
        },
        "data": final_rows,
    }

    with open(output_path, "w") as f:
        json.dump(output, f, separators=(",", ":"))  # compact JSON

    size_kb = output_path.stat().st_size / 1024
    print(f"\nSaved {len(final_rows):,} rows to {output_path} ({size_kb:.0f} KB)")
    if seasons_covered:
        print(f"Seasons: {seasons_covered[0]} → {seasons_covered[-1]}")
    else:
        print("WARNING: no rows saved — all season fetches failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()

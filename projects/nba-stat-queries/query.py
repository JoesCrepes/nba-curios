#!/usr/bin/env python3
"""
NBA Stat Query Tool
===================
Answer natural language questions about NBA player statistics.

Usage examples:
  python query.py "what player has the highest two-point field goal percentage in a single season?"
  python query.py "who has the most assists per game?" --season 2023-24
  python query.py "best three point shooter" --position guard --season 2022-23
  python query.py "most rebounds in a season" --position center --top 10
  python query.py "highest free throw percentage" --min-attempts 100

Two-point % note:
  The NBA API doesn't expose 2P% directly. It's derived as:
    2PM = FGM - FG3M
    2PA = FGA - FG3A
    2P% = 2PM / 2PA
"""

import argparse
import re
import sys
import time
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd
from nba_api.stats.endpoints import leaguedashplayerstats

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────

# Seasons available with reliable 3P data (3-point line added 1979-80).
# We default to the modern-stats era for speed; use --all-seasons to go back further.
MODERN_ERA_START = "1996-97"
THREE_POINT_ERA_START = "1979-80"
CURRENT_SEASON = "2024-25"

# Minimum qualifier thresholds (used when not overridden)
DEFAULT_MIN_ATTEMPTS: dict[str, int] = {
    "2P_PCT":   200,   # 2-point attempts in a season
    "FG_PCT":   300,   # total FG attempts
    "FG3_PCT":  100,   # 3-point attempts
    "FT_PCT":   100,   # free throw attempts
    "PTS":        0,
    "AST":        0,
    "REB":        0,
    "STL":        0,
    "BLK":        0,
    "TOV":        0,
}

# ─────────────────────────────────────────────
# Position mapping
# ─────────────────────────────────────────────

# NBA API position codes returned in the player data
# G, F, C, G-F, F-G, F-C, C-F

POSITION_MAP: dict[str, list[str]] = {
    # Strict
    "guard":         ["G", "G-F", "F-G"],
    "point guard":   ["G"],
    "pg":            ["G"],
    "shooting guard":["G", "G-F"],
    "sg":            ["G", "G-F"],
    # Forwards – intentionally wide because the line is blurry
    "forward":       ["F", "F-G", "G-F", "F-C", "C-F"],
    "small forward": ["F", "F-G", "G-F"],
    "sf":            ["F", "F-G", "G-F"],
    "power forward": ["F", "F-C", "C-F"],
    "pf":            ["F", "F-C", "C-F"],
    # Bigs
    "center":        ["C", "C-F", "F-C"],
    "big":           ["C", "C-F", "F-C"],
    "big man":       ["C", "C-F", "F-C"],
    "big men":       ["C", "C-F", "F-C"],
    # Combo / wing
    "wing":          ["F", "G-F", "F-G"],
    "combo":         ["G-F", "F-G"],
    "stretch":       ["F", "F-C", "C-F"],
}

def resolve_positions(position_str: str) -> list[str]:
    """
    Turn a fuzzy position description into a list of NBA API position codes.
    Returns [] if no match (meaning: no position filter).
    """
    key = position_str.lower().strip()
    if key in POSITION_MAP:
        return POSITION_MAP[key]
    # Try substring match
    for k, v in POSITION_MAP.items():
        if k in key or key in k:
            return v
    return []

# ─────────────────────────────────────────────
# Stat definitions
# ─────────────────────────────────────────────

@dataclass
class StatDef:
    """Describes a queryable stat."""
    column: str              # column name in the final DataFrame
    label: str               # human-readable label
    measure_type: str        # NBA API MeasureType
    per_mode: str            # NBA API PerMode
    computed: bool = False   # True if we derive this from other columns
    ascending: bool = False  # default sort direction for "best"
    description: str = ""    # printed in the results header
    min_attempts_col: str = ""  # column to apply min-attempts filter to

STAT_DEFINITIONS: dict[str, StatDef] = {
    "2P_PCT": StatDef(
        column="2P_PCT",
        label="Two-Point FG%",
        measure_type="Base",
        per_mode="Totals",
        computed=True,
        description="Two-point field goal percentage (2PM/2PA, min {min_att} attempts)",
        min_attempts_col="2PA",
    ),
    "FG_PCT": StatDef(
        column="FG_PCT",
        label="Field Goal %",
        measure_type="Base",
        per_mode="Totals",
        description="Field goal percentage (min {min_att} attempts)",
        min_attempts_col="FGA",
    ),
    "FG3_PCT": StatDef(
        column="FG3_PCT",
        label="Three-Point FG%",
        measure_type="Base",
        per_mode="Totals",
        description="Three-point field goal percentage (min {min_att} attempts)",
        min_attempts_col="FG3A",
    ),
    "FT_PCT": StatDef(
        column="FT_PCT",
        label="Free Throw %",
        measure_type="Base",
        per_mode="Totals",
        description="Free throw percentage (min {min_att} attempts)",
        min_attempts_col="FTA",
    ),
    "PTS": StatDef(
        column="PTS",
        label="Points Per Game",
        measure_type="Base",
        per_mode="PerGame",
        description="Points per game",
    ),
    "AST": StatDef(
        column="AST",
        label="Assists Per Game",
        measure_type="Base",
        per_mode="PerGame",
        description="Assists per game",
    ),
    "REB": StatDef(
        column="REB",
        label="Rebounds Per Game",
        measure_type="Base",
        per_mode="PerGame",
        description="Rebounds per game",
    ),
    "OREB": StatDef(
        column="OREB",
        label="Offensive Rebounds Per Game",
        measure_type="Base",
        per_mode="PerGame",
        description="Offensive rebounds per game",
    ),
    "DREB": StatDef(
        column="DREB",
        label="Defensive Rebounds Per Game",
        measure_type="Base",
        per_mode="PerGame",
        description="Defensive rebounds per game",
    ),
    "STL": StatDef(
        column="STL",
        label="Steals Per Game",
        measure_type="Base",
        per_mode="PerGame",
        description="Steals per game",
    ),
    "BLK": StatDef(
        column="BLK",
        label="Blocks Per Game",
        measure_type="Base",
        per_mode="PerGame",
        description="Blocks per game",
    ),
    "TOV": StatDef(
        column="TOV",
        label="Turnovers Per Game",
        measure_type="Base",
        per_mode="PerGame",
        ascending=True,   # "lowest" turnovers is best
        description="Turnovers per game",
    ),
    "EFF": StatDef(
        column="EFF",
        label="Efficiency",
        measure_type="Base",
        per_mode="PerGame",
        description="NBA efficiency rating per game",
    ),
    "USG_PCT": StatDef(
        column="USG_PCT",
        label="Usage %",
        measure_type="Advanced",
        per_mode="Totals",
        description="Usage percentage",
    ),
    "TS_PCT": StatDef(
        column="TS_PCT",
        label="True Shooting %",
        measure_type="Advanced",
        per_mode="Totals",
        description="True shooting percentage",
    ),
    "AST_PCT": StatDef(
        column="AST_PCT",
        label="Assist %",
        measure_type="Advanced",
        per_mode="Totals",
        description="Assist percentage",
    ),
    "REB_PCT": StatDef(
        column="REB_PCT",
        label="Rebound %",
        measure_type="Advanced",
        per_mode="Totals",
        description="Total rebound percentage",
    ),
}

# ─────────────────────────────────────────────
# Natural language query parser
# ─────────────────────────────────────────────

# Each entry: (regex pattern, stat key)
STAT_PATTERNS: list[tuple[str, str]] = [
    # Two-point
    (r"\btwo.?point\b|\b2.?point\b|\b2p\b|\b2pt\b", "2P_PCT"),
    # Three-point
    (r"\bthree.?point\b|\b3.?point\b|\b3p\b|\b3pt\b|\btriple\b|\bbeyond the arc\b", "FG3_PCT"),
    # Free throw
    (r"\bfree.?throw\b|\bft\b|\bfrom the line\b|\bcharity stripe\b", "FT_PCT"),
    # Field goal (generic – must come after more specific patterns)
    (r"\bfield.?goal\b|\b\bfg%\b|\bshooting percentage\b", "FG_PCT"),
    # Counting stats
    (r"\bpoints?\b|\bscoring\b|\bpointper\b|\bppg\b", "PTS"),
    (r"\bassists?\b|\bdimes?\b|\bplaymaking\b|\bapg\b", "AST"),
    (r"\brebounds?\b|\bboards?\b|\bglass\b|\brpg\b", "REB"),
    (r"\boffensive rebound\b|\boreb\b", "OREB"),
    (r"\bdefensive rebound\b|\bdreb\b", "DREB"),
    (r"\bsteals?\b|\bintercept\b|\bspg\b", "STL"),
    (r"\bblocks?\b|\brejections?\b|\bbpg\b", "BLK"),
    (r"\bturnovers?\b|\btov\b", "TOV"),
    # Advanced
    (r"\btrue shooting\b|\bts%\b|\bts \b", "TS_PCT"),
    (r"\busage\b|\busage%\b|\busg\b", "USG_PCT"),
    (r"\bassist percentage\b|\bast%\b", "AST_PCT"),
    (r"\brebound percentage\b|\breb%\b|\btotal rebound\b", "REB_PCT"),
    (r"\befficiency\b|\beff\b", "EFF"),
]

SORT_DIRECTION_PATTERNS: dict[str, bool] = {
    # True = descending (highest/best)
    r"\bhighest\b|\bbest\b|\bmost\b|\btop\b|\bgreatest\b|\bleader\b|\bmax\b|\brecord\b|\bever\b": False,  # ascending=False
    r"\blowest\b|\bworst\b|\bfewest\b|\bleast\b|\bmin\b|\bminimum\b": True,   # ascending=True
}

SEASON_PATTERNS: dict[str, str] = {
    r"\bthis season\b|\bcurrent season\b|\b2024.25\b": CURRENT_SEASON,
    r"\blast season\b|\bprevious season\b|\b2023.24\b": "2023-24",
    r"\b2022.23\b": "2022-23",
    r"\b2021.22\b": "2021-22",
    r"\b2020.21\b": "2020-21",
    r"\b2019.20\b": "2019-20",
    r"\b2018.19\b": "2018-19",
    r"\b2017.18\b": "2017-18",
    r"\b2016.17\b": "2016-17",
}

POSITION_PATTERNS: list[tuple[str, str]] = [
    (r"\bpoint guards?\b|\bpg\b", "point guard"),
    (r"\bshooting guards?\b|\bsg\b", "shooting guard"),
    (r"\bsmall forwards?\b|\bsf\b", "small forward"),
    (r"\bpower forwards?\b|\bpf\b", "power forward"),
    (r"\bcenters?\b|\bpivots?\b|\bbig men\b|\bbig man\b|\bbigs?\b", "center"),
    (r"\bguards?\b", "guard"),
    (r"\bforwards?\b", "forward"),
    (r"\bwings?\b", "wing"),
]

ALL_TIME_PATTERNS = r"\ball.?time\b|\ball seasons?\b|\bhistory\b|\bhistorical\b|\bever\b|\ball season\b"


@dataclass
class ParsedQuery:
    stat_key: str = "2P_PCT"
    ascending: bool = False        # False = highest first (default "best")
    single_season: bool = True     # True = rank by individual season
    specific_season: Optional[str] = None  # None = search all seasons
    position_filter: list[str] = field(default_factory=list)
    min_attempts: Optional[int] = None
    raw: str = ""


def parse_query(query: str) -> ParsedQuery:
    """
    Convert a natural language query string into a ParsedQuery.
    This is a keyword/regex approach – no LLM required.
    """
    q = query.lower()
    result = ParsedQuery(raw=query)

    # ── Stat ──────────────────────────────────────────────────────────────
    for pattern, stat_key in STAT_PATTERNS:
        if re.search(pattern, q):
            result.stat_key = stat_key
            break

    # ── Sort direction ─────────────────────────────────────────────────────
    stat_def = STAT_DEFINITIONS[result.stat_key]
    for pattern, ascending in SORT_DIRECTION_PATTERNS.items():
        if re.search(pattern, q):
            result.ascending = ascending
            break
    else:
        # Default: use the stat's natural direction
        result.ascending = stat_def.ascending

    # ── Season scope ───────────────────────────────────────────────────────
    for pattern, season in SEASON_PATTERNS.items():
        if re.search(pattern, q):
            result.specific_season = season
            break

    # ── Position ───────────────────────────────────────────────────────────
    for pattern, pos_key in POSITION_PATTERNS:
        if re.search(pattern, q):
            result.position_filter = resolve_positions(pos_key)
            break

    return result


# ─────────────────────────────────────────────
# Season range helpers
# ─────────────────────────────────────────────

def season_range(start: str, end: str) -> list[str]:
    """Generate a list of season strings from start to end, e.g. '1996-97' to '2024-25'."""
    seasons = []
    start_year = int(start[:4])
    end_year = int(end[:4])
    for y in range(start_year, end_year + 1):
        seasons.append(f"{y}-{str(y + 1)[-2:]}")
    return seasons


# ─────────────────────────────────────────────
# Data fetching
# ─────────────────────────────────────────────

def fetch_season(season: str, measure_type: str, per_mode: str, verbose: bool = True) -> pd.DataFrame:
    """Fetch LeagueDashPlayerStats for one season. Returns a DataFrame."""
    if verbose:
        print(f"  Fetching {season}...", end="", flush=True)
    time.sleep(0.65)  # polite rate limiting (NBA API is sensitive)
    try:
        resp = leaguedashplayerstats.LeagueDashPlayerStats(
            season=season,
            season_type_all_star="Regular Season",
            measure_type_detailed_defense=measure_type,
            per_mode_detailed=per_mode,
        )
        df = resp.get_data_frames()[0]
        df["SEASON"] = season
        if verbose:
            print(f" {len(df)} players")
        return df
    except Exception as e:
        if verbose:
            print(f" ERROR: {e}")
        return pd.DataFrame()


def compute_two_point(df: pd.DataFrame) -> pd.DataFrame:
    """Add 2PM, 2PA, 2P_PCT columns derived from FGM/FGA and FG3M/FG3A."""
    df = df.copy()
    df["2PM"] = df["FGM"] - df["FG3M"]
    df["2PA"] = df["FGA"] - df["FG3A"]
    # Avoid division by zero
    df["2P_PCT"] = df.apply(
        lambda r: r["2PM"] / r["2PA"] if r["2PA"] > 0 else None, axis=1
    )
    return df


def filter_by_position(df: pd.DataFrame, position_codes: list[str]) -> pd.DataFrame:
    """
    Filter DataFrame rows by NBA API position codes.
    A player's PLAYER_POSITION may be 'G', 'F', 'C', 'G-F', 'F-C', etc.
    We keep rows where the player's position overlaps with any requested code.
    """
    if not position_codes:
        return df
    mask = df["PLAYER_POSITION"].isin(position_codes)
    return df[mask]


# ─────────────────────────────────────────────
# Main query runner
# ─────────────────────────────────────────────

def run_query(
    parsed: ParsedQuery,
    seasons: list[str],
    top_n: int = 15,
    min_attempts: Optional[int] = None,
    verbose: bool = True,
) -> pd.DataFrame:
    """
    Execute the parsed query across the given seasons.
    Returns a ranked DataFrame.
    """
    stat_def = STAT_DEFINITIONS[parsed.stat_key]
    min_att = min_attempts if min_attempts is not None else DEFAULT_MIN_ATTEMPTS.get(parsed.stat_key, 0)

    if verbose:
        print(f"\nQuerying: {stat_def.label}")
        print(f"Seasons:  {seasons[0]} → {seasons[-1]} ({len(seasons)} seasons)")
        if parsed.position_filter:
            print(f"Position filter: {parsed.position_filter}")
        if min_att:
            print(f"Min attempts:    {min_att}")
        print()

    all_frames: list[pd.DataFrame] = []

    for season in seasons:
        df = fetch_season(season, stat_def.measure_type, stat_def.per_mode, verbose=verbose)
        if df.empty:
            continue

        # Compute derived stats
        if parsed.stat_key == "2P_PCT":
            df = compute_two_point(df)

        # Apply position filter
        if parsed.position_filter:
            df = filter_by_position(df, parsed.position_filter)

        all_frames.append(df)

    if not all_frames:
        print("No data returned.")
        return pd.DataFrame()

    combined = pd.concat(all_frames, ignore_index=True)

    # Apply minimum attempts filter
    if min_att and stat_def.min_attempts_col and stat_def.min_attempts_col in combined.columns:
        combined = combined[combined[stat_def.min_attempts_col] >= min_att]

    # Drop rows where the target stat is null
    combined = combined.dropna(subset=[parsed.stat_key])

    # Sort
    combined = combined.sort_values(parsed.stat_key, ascending=parsed.ascending)

    return combined.head(top_n)


# ─────────────────────────────────────────────
# Display
# ─────────────────────────────────────────────

def fmt_pct(val: float) -> str:
    return f"{val:.1%}"

def fmt_num(val: float) -> str:
    return f"{val:.1f}"

def display_results(df: pd.DataFrame, parsed: ParsedQuery, min_attempts: int) -> None:
    """Print a formatted result table."""
    stat_def = STAT_DEFINITIONS[parsed.stat_key]
    is_pct = parsed.stat_key.endswith("_PCT") or parsed.stat_key == "2P_PCT"

    label = "LOWEST" if parsed.ascending else "HIGHEST"
    desc = stat_def.description.format(min_att=min_attempts)
    print(f"\n{'─'*60}")
    print(f"  {label} {stat_def.label.upper()} — {desc}")
    print(f"{'─'*60}")

    fmt = fmt_pct if is_pct else fmt_num
    rank_width = 4
    name_width = 24
    season_width = 8
    pos_width = 6
    stat_width = 8

    header = (
        f"{'#':>{rank_width}}  "
        f"{'Player':<{name_width}}  "
        f"{'Season':<{season_width}}  "
        f"{'Pos':<{pos_width}}  "
        f"{stat_def.label:>{stat_width}}"
    )

    # Add extra columns depending on the stat
    if parsed.stat_key == "2P_PCT":
        header += f"  {'2PM':>5}  {'2PA':>5}  {'GP':>4}"
    elif parsed.stat_key in ("FG_PCT",):
        header += f"  {'FGM':>5}  {'FGA':>5}  {'GP':>4}"
    elif parsed.stat_key == "FG3_PCT":
        header += f"  {'3PM':>5}  {'3PA':>5}  {'GP':>4}"
    elif parsed.stat_key == "FT_PCT":
        header += f"  {'FTM':>5}  {'FTA':>5}  {'GP':>4}"
    else:
        header += f"  {'GP':>4}  {'Team':<5}"

    print(header)
    print("─" * len(header))

    for rank, (_, row) in enumerate(df.iterrows(), 1):
        line = (
            f"{rank:>{rank_width}}  "
            f"{row['PLAYER_NAME']:<{name_width}}  "
            f"{row.get('SEASON', ''):>{season_width}}  "
            f"{row.get('PLAYER_POSITION', ''):>{pos_width}}  "
            f"{fmt(row[parsed.stat_key]):>{stat_width}}"
        )
        if parsed.stat_key == "2P_PCT":
            line += f"  {int(row.get('2PM', 0)):>5}  {int(row.get('2PA', 0)):>5}  {int(row.get('GP', 0)):>4}"
        elif parsed.stat_key == "FG_PCT":
            line += f"  {int(row.get('FGM', 0)):>5}  {int(row.get('FGA', 0)):>5}  {int(row.get('GP', 0)):>4}"
        elif parsed.stat_key == "FG3_PCT":
            line += f"  {int(row.get('FG3M', 0)):>5}  {int(row.get('FG3A', 0)):>5}  {int(row.get('GP', 0)):>4}"
        elif parsed.stat_key == "FT_PCT":
            line += f"  {int(row.get('FTM', 0)):>5}  {int(row.get('FTA', 0)):>5}  {int(row.get('GP', 0)):>4}"
        else:
            line += f"  {int(row.get('GP', 0)):>4}  {row.get('TEAM_ABBREVIATION', ''):>5}"
        print(line)

    print(f"{'─'*60}")
    print(f"  Showing top {len(df)} results across queried seasons.")
    print()


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Answer natural language NBA stat questions.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # The classic question
  python query.py "highest two-point field goal percentage in a single season"

  # Filter by position (guards only)
  python query.py "highest two-point percentage" --position guard

  # Specific season
  python query.py "best three point shooter" --season 2015-16

  # All seasons, centers only, more results
  python query.py "most rebounds per game" --position center --top 20

  # Lower min-attempts threshold
  python query.py "highest two-point percentage" --min-attempts 50

  # Free throw leaders this season
  python query.py "free throw percentage this season"

  # Explicit stat flag (bypasses NL parsing)
  python query.py --stat FG3_PCT --position guard --season 2015-16

  # Available stats:
  #   2P_PCT  FG_PCT  FG3_PCT  FT_PCT  PTS  AST  REB  STL  BLK  TOV
  #   EFF  TS_PCT  USG_PCT  AST_PCT  REB_PCT  OREB  DREB
        """,
    )
    p.add_argument(
        "query",
        nargs="?",
        default=None,
        help='Natural language question (e.g. "highest two-point percentage")',
    )
    p.add_argument(
        "--stat",
        choices=list(STAT_DEFINITIONS.keys()),
        default=None,
        help="Explicitly specify the stat key (overrides NL parsing)",
    )
    p.add_argument(
        "--position",
        default=None,
        metavar="POS",
        help="Filter by position: guard, forward, center, wing, pg, sf, pf, c, ...",
    )
    p.add_argument(
        "--season",
        default=None,
        metavar="YYYY-YY",
        help="Single season (e.g. 2023-24). Omit to search all modern-era seasons.",
    )
    p.add_argument(
        "--all-seasons",
        action="store_true",
        help=f"Search from {THREE_POINT_ERA_START} instead of {MODERN_ERA_START}",
    )
    p.add_argument(
        "--top",
        type=int,
        default=15,
        metavar="N",
        help="Number of results to show (default: 15)",
    )
    p.add_argument(
        "--min-attempts",
        type=int,
        default=None,
        metavar="N",
        help="Minimum shot/attempt qualifier (overrides stat default)",
    )
    p.add_argument(
        "--ascending",
        action="store_true",
        default=None,
        help="Sort ascending (lowest first) instead of descending",
    )
    p.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress progress output",
    )
    p.add_argument(
        "--list-stats",
        action="store_true",
        help="List all available stat keys and exit",
    )
    return p


def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.list_stats:
        print("\nAvailable stats:")
        print(f"  {'Key':<12} {'Label':<30} Description")
        print("  " + "─" * 70)
        for key, sd in STAT_DEFINITIONS.items():
            print(f"  {key:<12} {sd.label:<30} {sd.description.format(min_att='…')}")
        print()
        sys.exit(0)

    if not args.query and not args.stat:
        parser.print_help()
        sys.exit(1)

    # ── Parse the query ────────────────────────────────────────────────────
    parsed = parse_query(args.query or "")

    # CLI flags override NL-parsed values
    if args.stat:
        parsed.stat_key = args.stat
    if args.position:
        codes = resolve_positions(args.position)
        if not codes:
            print(f"Warning: unrecognized position '{args.position}', ignoring filter.")
            print(f"  Valid values: {', '.join(POSITION_MAP.keys())}")
        parsed.position_filter = codes
    if args.season:
        parsed.specific_season = args.season
    if args.ascending is not None:
        parsed.ascending = args.ascending

    # ── Build season list ──────────────────────────────────────────────────
    if parsed.specific_season:
        seasons = [parsed.specific_season]
    elif args.all_seasons:
        seasons = season_range(THREE_POINT_ERA_START, CURRENT_SEASON)
    else:
        seasons = season_range(MODERN_ERA_START, CURRENT_SEASON)

    # ── Min attempts ──────────────────────────────────────────────────────
    stat_def = STAT_DEFINITIONS[parsed.stat_key]
    min_att = args.min_attempts if args.min_attempts is not None else DEFAULT_MIN_ATTEMPTS.get(parsed.stat_key, 0)

    # ── Execute ────────────────────────────────────────────────────────────
    verbose = not args.quiet
    results = run_query(
        parsed=parsed,
        seasons=seasons,
        top_n=args.top,
        min_attempts=args.min_attempts,
        verbose=verbose,
    )

    if results.empty:
        print("No results found matching your query.")
        sys.exit(0)

    display_results(results, parsed, min_att)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
ETL script to fetch NBA game logs from nba_api and export to JSON.
"""

import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

from nba_api.stats.endpoints import leaguegamefinder
from nba_api.stats.static import teams
import pandas as pd
import time


def get_team_id(team_abbr: str) -> str:
    """Get NBA team ID from abbreviation."""
    nba_teams = teams.get_teams()
    team = [t for t in nba_teams if t['abbreviation'] == team_abbr]

    if not team:
        raise ValueError(f"Team abbreviation '{team_abbr}' not found")

    return str(team[0]['id'])


def fetch_team_season(team_id: str, season: str) -> pd.DataFrame:
    """
    Fetch game log for a team-season using nba_api.

    Args:
        team_id: NBA team ID (e.g., "1610612744" for Warriors)
        season: Season string (e.g., "2015-16")

    Returns:
        DataFrame with game log data
    """
    print(f"Fetching {season} season (Team ID: {team_id})...")

    # Use leaguegamefinder - more reliable than teamgamelog
    time.sleep(0.6)  # Rate limiting

    gamefinder = leaguegamefinder.LeagueGameFinder(
        team_id_nullable=team_id,
        season_nullable=season,
        season_type_nullable='Regular Season'
    )

    df = gamefinder.get_data_frames()[0]
    print(f"  Retrieved {len(df)} games")

    # Debug: print first few rows
    if len(df) > 0:
        print(f"  First game: {df.iloc[0]['GAME_DATE']} vs {df.iloc[0]['MATCHUP']}")

    return df


def process_game_log(df: pd.DataFrame, is_current: bool = False) -> List[Dict[str, Any]]:
    """
    Transform raw game log into simplified format for visualization.

    Returns list of games with cumulative wins.
    """
    # Sort by game date (ascending) - column name varies by endpoint
    if 'Game_ID' in df.columns:
        df = df.sort_values('Game_ID')
    elif 'GAME_ID' in df.columns:
        df = df.sort_values('GAME_ID')
    else:
        df = df.sort_values('GAME_DATE')

    games = []
    wins = 0
    losses = 0

    for idx, row in df.iterrows():
        # Determine win/loss
        wl = row['WL']
        if wl == 'W':
            wins += 1
        else:
            losses += 1

        game_data = {
            'game_num': len(games) + 1,
            'date': row['GAME_DATE'],
            'matchup': row['MATCHUP'],
            'wl': wl,
            'wins': wins,
            'losses': losses,
            'pts_for': int(row['PTS']),
            'pts_against': int(row.get('PTS', 0)) if 'PTS' in row else None,  # Some older data might not have this
            'win_pct': wins / (wins + losses)
        }

        games.append(game_data)

    return games


def save_season_data(config_entry: Dict[str, Any], output_dir: Path):
    """Fetch and save a single season's data."""
    team_abbr = config_entry['team_abbr']
    season = config_entry['season']
    team_id = config_entry.get('team_id') or get_team_id(team_abbr)
    is_current = config_entry.get('is_current', False)

    # Fetch data
    df = fetch_team_season(team_id, season)

    # Process
    games = process_game_log(df, is_current)

    # Prepare output
    output_data = {
        'team': team_abbr,
        'season': season,
        'label': config_entry['label'],
        'description': config_entry['description'],
        'is_current': is_current,
        'fetched_at': datetime.now().isoformat(),
        'games': games,
        'final_record': f"{games[-1]['wins']}-{games[-1]['losses']}" if games else "0-0"
    }

    # Save to JSON
    filename = f"{team_abbr.lower()}-{season.replace('-', '')}.json"
    output_path = output_dir / filename

    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)

    print(f"[OK] Saved to {output_path}")
    print(f"  Record: {output_data['final_record']} ({len(games)} games)\n")


def main():
    parser = argparse.ArgumentParser(description='Fetch NBA season game logs')
    parser.add_argument('--current-only', action='store_true',
                       help='Only update current season data')
    args = parser.parse_args()

    # Load config
    config_path = Path(__file__).parent / 'config.json'
    with open(config_path) as f:
        config = json.load(f)

    # Setup output directory
    output_dir = Path(__file__).parent.parent / 'data'
    output_dir.mkdir(exist_ok=True)

    # Filter seasons if --current-only
    seasons_to_fetch = config['seasons']
    if args.current_only:
        seasons_to_fetch = [s for s in seasons_to_fetch if s.get('is_current', False)]
        print("Fetching current season only...\n")
    else:
        print(f"Fetching {len(seasons_to_fetch)} seasons...\n")

    # Fetch each season
    for season_config in seasons_to_fetch:
        try:
            save_season_data(season_config, output_dir)
        except Exception as e:
            print(f"[ERROR] Error fetching {season_config['label']}: {e}\n")
            continue

    print(f"Done! Data saved to {output_dir}")


if __name__ == '__main__':
    main()

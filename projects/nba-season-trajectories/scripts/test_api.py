#!/usr/bin/env python3
"""Quick test of nba_api"""

from nba_api.stats.endpoints import teamgamelog
from nba_api.stats.static import teams
import time

# Get Warriors team ID
nba_teams = teams.get_teams()
warriors = [t for t in nba_teams if t['abbreviation'] == 'GSW'][0]
print(f"Warriors: {warriors}")
print()

# Try fetching 2015-16 season
print("Attempting to fetch 2015-16 Warriors season...")
time.sleep(1)  # Rate limit

try:
    gamelog = teamgamelog.TeamGameLog(
        team_id=str(warriors['id']),
        season='2015-16',
        season_type_all_star='Regular Season'
    )

    df = gamelog.get_data_frames()[0]
    print(f"Retrieved {len(df)} games")

    if len(df) > 0:
        print(f"\nFirst few games:")
        print(df[['GAME_DATE', 'MATCHUP', 'WL', 'PTS']].head())
        print(f"\nColumns: {list(df.columns)}")
    else:
        print("No games returned!")
        print(f"Response data: {gamelog.get_dict()}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

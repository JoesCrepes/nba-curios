# NBA Season Trajectories

Interactive visualization comparing win trajectories across notable NBA seasons with forecasting capabilities for current seasons.

## Features

- **Historical Comparisons**: Chart game-by-game win progression for legendary teams
- **Current Season Tracking**: Live data for ongoing seasons
- **Forecast Scenarios**: Visualize different rest-of-season projections
- **Flexible Selection**: Add/remove teams and seasons dynamically

## Quick Start

### 1. Fetch Data (Python)

```bash
cd scripts
pip install -r requirements.txt
python fetch_data.py
```

This will populate `data/` with JSON files for each team-season.

### 2. Run Frontend

```bash
npm install
npm run dev
```

Visit http://localhost:5173

## Data Sources

- **Historical data**: [nba_api](https://github.com/swar/nba_api) (official NBA.com stats)
- **Current season**: Auto-updated via GitHub Actions (daily at 8 AM ET)

## Available Seasons

- **1995-96 Chicago Bulls** - 72-10 record
- **2015-16 Golden State Warriors** - 73-9 record
- **2012-13 Oklahoma City Thunder** - 60-22 record
- **2025-26 Oklahoma City Thunder** - Current season (8-0 start!)

Add more by editing `scripts/config.json`.

## Architecture

```
scripts/
  fetch_data.py          # ETL script for nba_api
  config.json            # Team/season definitions
  requirements.txt       # Python dependencies

data/
  warriors-2015-16.json  # Pre-processed game logs
  bulls-1995-96.json
  ...

src/
  components/            # React components
  utils/                 # Forecast logic, data processing
  App.tsx                # Main application
```

## Forecast Models

Three projection methods available:

1. **Linear**: Current win rate extrapolated
2. **Pythagorean**: Based on point differential
3. **Monte Carlo**: Probabilistic simulation (1000 runs)

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Update current season data
cd scripts && python fetch_data.py --current-only
```

## Deployment

Auto-deploys to Vercel on push to `main` branch. Current season data updates daily via GitHub Actions.

## Contributing

To add a new season:

1. Edit `scripts/config.json`:
   ```json
   {
     "seasons": [
       {
         "team": "PHX",
         "season": "2004-05",
         "label": "7 Seconds or Less Suns"
       }
     ]
   }
   ```

2. Run `python scripts/fetch_data.py`
3. New data file auto-loads in UI

## Tech Stack

- React 18 + TypeScript
- Vite
- Recharts (visualization)
- nba_api (data source)

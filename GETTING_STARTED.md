# Getting Started with NBA Curios

Welcome! This guide will help you get the NBA Season Trajectories visualization running locally.

## Prerequisites

- **Python 3.11+** (for data fetching)
- **Node.js 20+** (for frontend)
- **Git** (for version control)

## Quick Start (5 minutes)

### 1. Clone and Navigate

```bash
git clone https://github.com/yourusername/nba-curios.git
cd nba-curios/projects/nba-season-trajectories
```

### 2. Run the Frontend

The data is already fetched and committed, so you can start right away:

```bash
npm install
npm run dev
```

Visit **http://localhost:5173** to see the visualization!

### 3. (Optional) Refresh Data

To fetch the latest season data:

```bash
cd scripts
pip install -r requirements.txt
python fetch_data.py --current-only
cd ..
cp data/*.json public/data/
```

## What You'll See

The visualization displays:

- **73-win Warriors (2015-16)** - Historic 73-9 season
- **72-win Bulls (1995-96)** - Michael Jordan's legendary season
- **60-win Thunder (2012-13)** - KD/Westbrook/Harden era
- **Current Thunder (2024-25)** - Live season with forecasts

### Features

- **Interactive Chart**: Shows cumulative wins over 82 games
- **Team Selection**: Toggle seasons on/off to compare
- **Forecast Scenarios**: For current seasons, see projected finishes:
  - Current pace
  - Strong finish (75% win rate)
  - Average finish (50% win rate)
  - Win out scenario

## Project Structure

```
projects/nba-season-trajectories/
├── src/
│   ├── components/
│   │   ├── TrajectoryChart.tsx    # Main chart component
│   │   └── SeasonSelector.tsx      # Team selector UI
│   ├── utils/
│   │   └── forecast.ts             # Projection algorithms
│   ├── types.ts                    # TypeScript interfaces
│   └── App.tsx                     # Main app component
├── scripts/
│   ├── fetch_data.py              # ETL script
│   └── config.json                # Season configuration
├── data/                          # Source data (JSON)
└── public/data/                   # Build-time data copy
```

## Development Workflow

### Add a New Season

1. Edit `scripts/config.json`:

```json
{
  "team_abbr": "LAL",
  "season": "2019-20",
  "team_id": "1610612747",
  "label": "2020 Lakers",
  "description": "Bubble championship season"
}
```

2. Fetch data:
```bash
cd scripts && python fetch_data.py
```

3. Update `src/App.tsx` to include the new file in `seasonFiles` array

4. Copy to public and restart dev server:
```bash
cd .. && cp data/*.json public/data/ && npm run dev
```

### Customize Forecasts

Edit `src/utils/forecast.ts` to adjust projection logic:

- Modify scenario parameters (win rates, names)
- Add new forecasting methods (Pythagorean, Monte Carlo)
- Customize trajectory calculations

### Styling

- **Dark theme**: Edit colors in `src/App.css`
- **Chart colors**: Modify `TEAM_COLORS` in components
- **Typography**: Update `src/index.css`

## Common Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build

# Data Management
python scripts/fetch_data.py                # Fetch all seasons
python scripts/fetch_data.py --current-only # Only update current season
```

## Troubleshooting

### "Port 5173 is in use"
Vite will automatically try another port (5174, etc.). Check terminal output.

### "Cannot find module 'nba_api'"
```bash
cd scripts
pip install -r requirements.txt
```

### Chart not showing data
1. Check browser console for errors
2. Verify `public/data/*.json` files exist
3. Ensure file names match in `src/App.tsx`

### TypeScript errors
Run type checking:
```bash
npm run build
```

## Next Steps

- **Deploy**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for hosting options
- **Customize**: Fork and add your own teams/seasons
- **Extend**: Add new forecast models or visualizations
- **Contribute**: Open issues or PRs with improvements

## Data Source

All data fetched from official NBA.com stats via [nba_api](https://github.com/swar/nba_api).

- Historical data is static and cached
- Current season updates daily via GitHub Actions
- No API key required (uses public endpoints)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Charts**: Recharts (built on D3)
- **Data**: Python + nba_api + pandas
- **CI/CD**: GitHub Actions
- **Hosting**: Vercel / Netlify / GitHub Pages

## Questions?

- Check existing [issues](https://github.com/yourusername/nba-curios/issues)
- Read the [NBA API docs](https://github.com/swar/nba_api)
- Review example data in `data/` directory

Happy coding! 🏀📊

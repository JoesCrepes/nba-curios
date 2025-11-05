# NBA Curios

A collection of NBA data visualizations and analysis projects.

## Projects

### 1. [NBA Season Trajectories](./projects/nba-season-trajectories)
Interactive visualization comparing win trajectories across notable NBA seasons. Features forecasting for current seasons.

**Featured seasons:**
- 2015-16 Golden State Warriors (73-9)
- 1995-96 Chicago Bulls (72-10)
- 2012-13 Oklahoma City Thunder (60-22, 68-win pace before trades)
- 2024-25 Oklahoma City Thunder (current)

[View Demo →](./projects/nba-season-trajectories)

## Repository Structure

```
nba-curios/
├── projects/           # Individual project directories
│   └── nba-season-trajectories/
│       ├── src/       # Frontend source
│       ├── data/      # Pre-processed JSON data
│       └── scripts/   # Python ETL scripts
├── shared/            # Shared utilities and components
│   ├── components/    # Reusable React components
│   └── utils/         # Shared helper functions
└── README.md
```

## Getting Started

Each project has its own README with specific setup instructions. Generally:

1. **Python ETL** (data fetching):
   ```bash
   cd projects/<project-name>/scripts
   pip install -r requirements.txt
   python fetch_data.py
   ```

2. **Frontend** (visualization):
   ```bash
   cd projects/<project-name>
   npm install
   npm run dev
   ```

## Adding New Projects

1. Create a new directory under `projects/`
2. Follow the existing project structure for consistency
3. Update this README with project description and link
4. Leverage `shared/` for common components and utilities

## Tech Stack

- **Data**: Python 3.11+, nba_api, pandas
- **Frontend**: React 18, TypeScript, Vite
- **Visualization**: Recharts, D3.js
- **Deployment**: Vercel/Netlify (static sites)

## License

MIT

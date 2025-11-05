# Deployment Guide

This repository is structured to support multiple NBA data visualization projects. Currently includes **NBA Season Trajectories**.

## Project Structure

```
nba-curios/
├── projects/
│   └── nba-season-trajectories/    # First visualization project
│       ├── src/                     # React frontend
│       ├── data/                    # Season data (JSON)
│       ├── public/                  # Static assets + data copy
│       └── scripts/                 # Python ETL scripts
├── shared/                          # Shared components (future use)
├── .github/workflows/               # CI/CD automation
└── README.md
```

## Deployment Options

### Option 1: Vercel (Recommended)

**Automatic deployment on push to main:**

1. Connect your GitHub repository to Vercel
2. Vercel will auto-detect the configuration from `vercel.json`
3. Set build settings:
   - **Framework Preset**: None (using custom config)
   - **Root Directory**: Leave blank (handled by vercel.json)
   - **Build Command**: Auto-detected from vercel.json
   - **Output Directory**: Auto-detected from vercel.json

4. Deploy!

**URL**: Your app will be live at `https://your-project.vercel.app`

**Daily data updates**: GitHub Actions automatically fetches current season data daily and commits it. Vercel auto-deploys on commit.

### Option 2: GitHub Pages

**Manual setup required:**

1. Go to repository Settings → Pages
2. Source: GitHub Actions
3. Push to main branch
4. The `.github/workflows/deploy.yml` workflow will build and deploy

**URL**: `https://yourusername.github.io/nba-curios/`

**Note**: GitHub Pages requires the `base` option in vite.config.ts:
```ts
export default defineConfig({
  base: '/nba-curios/',  // Add this line
  plugins: [react()],
  // ...
})
```

### Option 3: Netlify

1. Connect GitHub repository
2. Configure build:
   - **Base directory**: `projects/nba-season-trajectories`
   - **Build command**: `npm install && npm run build`
   - **Publish directory**: `projects/nba-season-trajectories/dist`
3. Deploy!

## GitHub Actions

Two workflows are configured:

### 1. Data Update Workflow (`.github/workflows/update-data.yml`)

- **Schedule**: Runs daily at 8 AM ET (12 PM UTC)
- **Purpose**: Fetches latest current season data
- **Process**:
  1. Runs Python ETL script with `--current-only` flag
  2. Updates data files in `data/` and `public/data/`
  3. Commits changes if data changed
  4. Triggers redeployment automatically

**Manual trigger**: You can also trigger this workflow manually from the Actions tab.

### 2. Deploy Workflow (`.github/workflows/deploy.yml`)

- **Trigger**: Push to main branch (changes in `projects/nba-season-trajectories/`)
- **Purpose**: Builds and deploys to GitHub Pages
- **Note**: Only needed if using GitHub Pages deployment

## Environment Variables

None required for basic deployment!

For future enhancements (API keys, etc.), add them in your hosting provider's dashboard:
- Vercel: Settings → Environment Variables
- Netlify: Site settings → Environment Variables
- GitHub: Settings → Secrets and variables → Actions

## Adding New Seasons

To add more historical seasons or teams:

1. Edit `projects/nba-season-trajectories/scripts/config.json`:

```json
{
  "seasons": [
    {
      "team_abbr": "MIA",
      "season": "2012-13",
      "team_id": "1610612748",
      "label": "LeBron's Heat",
      "description": "27-game win streak season"
    }
  ]
}
```

2. Run the ETL script:
```bash
cd projects/nba-season-trajectories/scripts
python fetch_data.py
```

3. Copy data to public directory:
```bash
cd ..
cp data/*.json public/data/
```

4. Update `src/App.tsx` to include new data file in the `seasonFiles` array

5. Commit and push - deployment happens automatically!

## Monitoring

- **Build Status**: Check GitHub Actions tab for workflow runs
- **Data Freshness**: Each JSON file has a `fetched_at` timestamp
- **Deployment Status**:
  - Vercel: Check dashboard or deployment logs
  - GitHub Pages: Check Actions tab
  - Netlify: Check deployment logs in dashboard

## Troubleshooting

### Build fails with TypeScript errors
- Run `npm run build` locally first to catch errors
- Check that all type imports use `import type { ... }`

### Data not loading
- Verify `public/data/*.json` files exist
- Check browser console for fetch errors
- Ensure file paths match in `App.tsx`

### GitHub Actions failing
- Check Python dependencies in `requirements.txt`
- Verify nba_api is accessible (not rate-limited)
- Check Actions logs for detailed error messages

### Deployment successful but shows old data
- Clear your browser cache
- Check if latest commit triggered rebuild
- Verify data files were committed to git

## Cost

- **GitHub**: Free (including Actions with usage limits)
- **Vercel**: Free tier (sufficient for this project)
- **Netlify**: Free tier (sufficient for this project)
- **GitHub Pages**: Free

All deployment options are free for this project's scale!

## Future Projects

To add new visualization projects:

1. Create new directory: `projects/new-project-name/`
2. Follow same structure as `nba-season-trajectories/`
3. Update root README.md with new project link
4. Use shared components from `shared/` directory
5. Add specific deployment config if needed

This modular structure makes it easy to maintain multiple independent visualizations in one repository while sharing common utilities.

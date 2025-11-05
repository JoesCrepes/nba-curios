# GitHub Pages Deployment Checklist

Follow these steps to deploy your NBA Season Trajectories app to GitHub Pages.

## ✅ Pre-Deployment Checklist

All setup is complete! The following are already configured:

- [x] Vite config updated with GitHub Pages base path
- [x] `.nojekyll` file added to prevent Jekyll processing
- [x] GitHub Actions workflow created (`.github/workflows/deploy.yml`)
- [x] Production build tested locally

## 🚀 Deployment Steps

### Step 1: Push to GitHub

```bash
# Make sure you're in the project root
cd c:\Users\joe.crapo\Desktop\dev\nba-curios

# Add all files
git add .

# Commit
git commit -m "Add NBA Season Trajectories visualization with GitHub Pages support"

# Push to main branch (creates the repo if needed)
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/yourusername/nba-curios`
2. Click **Settings** (top navigation)
3. Click **Pages** (left sidebar)
4. Under "Build and deployment":
   - **Source**: Select **"GitHub Actions"**
5. Click **Save**

### Step 3: Watch the Deployment

1. Go to the **Actions** tab in your repository
2. You should see a workflow run called "Deploy to GitHub Pages"
3. Click on it to watch the progress
4. Wait for both jobs to complete:
   - ✅ **build** (compiles the app)
   - ✅ **deploy** (publishes to GitHub Pages)

### Step 4: Access Your Site

Once deployment completes (usually 2-3 minutes):

🎉 **Your site is live at**: `https://yourusername.github.io/nba-curios/`

## 🔄 Automatic Updates

### Future Deployments

Every time you push to the `main` branch with changes in `projects/nba-season-trajectories/`, GitHub Actions will automatically:
1. Build the project
2. Deploy to GitHub Pages
3. Your site updates in ~2-3 minutes

### Daily Data Updates

The workflow at `.github/workflows/update-data.yml` runs daily at 8 AM ET to:
1. Fetch current season data
2. Commit updates to the repository
3. Trigger automatic redeployment

You can also manually trigger it:
1. Go to **Actions** tab
2. Click **"Update NBA Season Data"**
3. Click **"Run workflow"**

## 🧪 Testing Locally

To test the production build with the GitHub Pages base path:

```bash
cd projects/nba-season-trajectories

# Build for production
npm run build

# Preview the production build
npm run preview
```

Visit `http://localhost:4173` to test.

## 🐛 Troubleshooting

### Deployment fails

**Check the Actions logs:**
1. Go to **Actions** tab
2. Click the failed workflow run
3. Expand the failed step to see error details

**Common issues:**
- Missing `package-lock.json`: Run `npm install` locally and commit
- TypeScript errors: Run `npm run build` locally to catch errors first
- Permissions: Ensure Actions have write permissions (Settings → Actions → General → Workflow permissions)

### Site shows blank page

**Check browser console for errors:**
1. Open DevTools (F12)
2. Look for 404 errors on assets

**Common fixes:**
- Verify `base` in `vite.config.ts` matches your repo name
- Check that `.nojekyll` file exists in `public/`
- Clear browser cache and hard reload (Ctrl+Shift+R)

### Data not loading

**Check data files:**
```bash
# Verify data files exist in public folder
ls projects/nba-season-trajectories/public/data/

# Should show:
# chi-199596.json
# gsw-201516.json
# okc-201213.json
# okc-202526.json
```

**Verify in browser:**
- Visit `https://yourusername.github.io/nba-curios/data/okc-202526.json`
- Should show JSON data, not 404

### Workflow doesn't trigger

**Check workflow file:**
- Verify `.github/workflows/deploy.yml` exists
- Check that you pushed to the `main` branch
- Ensure changes are in `projects/nba-season-trajectories/**` path

**Manual trigger:**
1. Actions tab → "Deploy to GitHub Pages"
2. Click "Run workflow" → Select `main` branch → "Run workflow"

## 📊 Monitoring

### Check deployment status
- **Actions tab**: See build/deploy history
- **Settings → Pages**: Shows current deployment status and URL

### View site analytics (optional)
GitHub Pages doesn't include analytics by default. To add:
1. Add Google Analytics to `index.html`
2. Or use a privacy-friendly service like Plausible

## 🔐 Custom Domain (Optional)

To use a custom domain like `nba-viz.com`:

1. **Add domain in GitHub:**
   - Settings → Pages → Custom domain
   - Enter your domain: `nba-viz.com`
   - Save

2. **Configure DNS:**
   Add these records at your domain provider:
   ```
   Type: A
   Host: @
   Value: 185.199.108.153

   Type: A
   Host: @
   Value: 185.199.109.153

   Type: A
   Host: @
   Value: 185.199.110.153

   Type: A
   Host: @
   Value: 185.199.111.153
   ```

3. **Update Vite config:**
   ```ts
   base: process.env.NODE_ENV === 'production' ? '/' : '/',
   ```

## 💰 Cost

**GitHub Pages is completely FREE for:**
- Public repositories
- 1 GB storage
- 100 GB bandwidth/month
- Custom domains

This project uses ~80 KB total, well under limits!

## ✅ Post-Deployment

After your first successful deployment:

1. ✨ **Test the live site** - Visit your GitHub Pages URL
2. 🔗 **Update README** - Add live demo link
3. 📱 **Test on mobile** - Responsive design should work
4. 🎨 **Share it!** - Post the link and get feedback

---

**Need help?** Check the [GitHub Pages documentation](https://docs.github.com/en/pages) or open an issue in this repository.

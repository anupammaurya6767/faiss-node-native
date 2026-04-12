# GitHub Pages Setup Guide

This guide explains how the repository publishes documentation to GitHub Pages.

### Step 1: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (in left sidebar)
3. Under **Source**, select:
   - **Source**: `GitHub Actions` (not "Deploy from a branch")
4. Click **Save**

That's it. The workflow handles the rest.

### Step 2: Verify Workflow Permissions

The workflow (`.github/workflows/docs.yml`) already includes the required permissions:
- `contents: read` - Read repository
- `pages: write` - Write to GitHub Pages
- `id-token: write` - For OIDC authentication

### Step 3: Push and Deploy

1. Push your code to GitHub:
   ```bash
   git push origin main
   ```

2. The workflow will automatically:
   - Generate TypeDoc and Doxygen documentation
   - Deploy to GitHub Pages
   - Publish a landing page at: `https://<username>.github.io/<repo>/`
   - Publish TypeDoc at: `https://<username>.github.io/<repo>/api/`
   - Publish Doxygen at: `https://<username>.github.io/<repo>/native/`

## How It Works

The workflow automatically deploys when:

### Automatic Deployment

The workflow (`.github/workflows/docs.yml`) I created triggers on:
- **Push to main**: When source files or Doxyfile change
- **Manual trigger**: Via GitHub Actions UI

### Workflow Steps

1. **Checkout**: Gets the latest code
2. **Install Doxygen**: Installs Doxygen and Graphviz
3. **Generate**: Runs `npm run docs` to generate TypeDoc and Doxygen output
4. **Stage**: Builds a small combined Pages site with `/api/` and `/native/`
5. **Deploy**: Deploys to GitHub Pages using official GitHub Actions

### Documentation URL

After first deployment, your docs will be available at:
```
https://<username>.github.io/<repo>/
```

For example:
```
https://anupammaurya6767.github.io/faiss-node-native/
```

## Troubleshooting

### Documentation Not Appearing

1. **Check workflow status**: Go to Actions tab, verify workflow completed
2. **Check Pages settings**: Ensure "GitHub Actions" is selected as source
3. **Check permissions**: Workflow needs `pages: write` permission
4. **Wait a few minutes**: GitHub Pages can take 1-5 minutes to update

### Build Failures

1. **Doxygen not found**: Workflow installs it automatically
2. **Missing files**: Ensure `src/` directory exists
3. **Check logs**: View workflow logs in Actions tab

### Manual Deployment

If automatic deployment isn't working, use the manual workflow:
1. Go to **Actions** → **Manual Documentation Deploy**
2. Click **Run workflow**
3. Optionally add a commit message
4. Click **Run workflow** button

## Custom Domain (Optional)

If you want to use a custom domain:

1. Add `CNAME` file to `docs/html/` with your domain
2. Configure DNS settings for your domain
3. GitHub will automatically detect and use it

## Updating Documentation

The documentation updates automatically when you:
- Push changes to `src/**` files
- Update `Doxyfile`
- Update `README.md` (used as main page)
- Manually trigger the workflow

No manual steps required! 🎉

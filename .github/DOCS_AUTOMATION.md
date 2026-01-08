# Documentation Automation Guide

I set up automated documentation generation using Doxygen, which gets deployed to GitHub Pages automatically. Here's how it works:

## How It Works

### Automatic Workflow (`.github/workflows/docs.yml`)

I configured it to trigger on:
- Push to `main` branch when:
  - `src/**` files change
  - `Doxyfile` changes
  - `README.md` changes
- Manual trigger via GitHub Actions UI

**Process:**
1. Installs Doxygen and Graphviz
2. Generates HTML documentation from C++ and JavaScript source
3. Uploads documentation as artifact
4. Deploys to GitHub Pages automatically

**Result:**
- Documentation available at: `https://<username>.github.io/<repo>/docs/`
- Updates automatically on every relevant push

## Setup Instructions

### One-Time Setup

Here's what I did to set it up:

1. **Enable GitHub Pages:**
   - Go to repository **Settings** → **Pages**
   - Under **Source**, select: **GitHub Actions**
   - Click **Save**

2. **Push to GitHub:**
   ```bash
   git push origin main
   ```

3. **Wait for deployment:**
   - Check **Actions** tab for workflow status
   - First deployment takes 1-5 minutes
   - Documentation will be live at the URL shown in workflow

### Manual Deployment

If I need to deploy manually:

1. Go to **Actions** → **Deploy Documentation to GitHub Pages**
2. Click **Run workflow**
3. Select branch (usually `main`)
4. Click **Run workflow**

Or use the alternative manual workflow:
- **Actions** → **Manual Documentation Deploy**
- More control over commit messages

## Documentation Structure

The generated documentation includes:

- **C++ API**: 
  - `FaissIndexWrapper` class
  - N-API bindings
  - Async workers

- **JavaScript API**:
  - `FaissIndex` class
  - All methods and properties
  - Type definitions

- **Examples**:
  - Code examples from `examples/` directory

- **Main Page**:
  - README.md content as landing page

## Local Development

### Generate Documentation Locally

```bash
# Install Doxygen (if not installed)
# macOS:
brew install doxygen graphviz

# Linux:
sudo apt-get install doxygen graphviz

# Generate docs
npm run docs

# View locally
npm run docs:serve
# Then visit http://localhost:8000
```

### Customizing Documentation

Edit `Doxyfile` to customize:
- Project name and version
- Input files and directories
- Output format and styling
- Main page content

## Troubleshooting

### Documentation Not Updating

1. **Check workflow**: Go to Actions tab, verify workflow ran
2. **Check Pages settings**: Must be set to "GitHub Actions"
3. **Check permissions**: Workflow needs `pages: write`
4. **Wait**: GitHub Pages can take a few minutes to update

### Build Failures

1. **View logs**: Check Actions tab for error details
2. **Doxygen errors**: Check `Doxyfile` syntax
3. **Missing files**: Ensure `src/` directory exists
4. **Path issues**: Verify `docs/html` is generated correctly

### Access Issues

- **404 errors**: Wait a few minutes after deployment
- **Old content**: Clear browser cache
- **Wrong URL**: Check repository name matches GitHub Pages URL

## Workflow Files

- **`.github/workflows/docs.yml`**: Main automated workflow (recommended)
- **`.github/workflows/docs-manual.yml`**: Alternative manual workflow
- **`Doxyfile`**: Doxygen configuration
- **`docs/README.md`**: Documentation directory info

## Best Practices

I try to follow these practices:
1. Keep Doxyfile updated when adding new source files
2. Document code with comments for better auto-generated docs
3. Test locally by running `npm run docs` before pushing
4. Monitor deployments by checking the Actions tab regularly
5. Remember that changes to README.md trigger doc updates

## URL Format

After deployment, documentation is available at:

```
https://<username>.github.io/<repository-name>/docs/
```

For example:
```
https://yourusername.github.io/faiss-node/docs/
```

## Permissions Required

The workflow automatically has these permissions:
- ✅ `contents: read` - Read repository files
- ✅ `pages: write` - Deploy to GitHub Pages
- ✅ `id-token: write` - OIDC authentication

No additional secrets or tokens needed!

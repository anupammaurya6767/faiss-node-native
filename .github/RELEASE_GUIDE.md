# Release and Deployment Guide

This guide explains how to trigger the build and release workflow to publish a new version to npm and create a GitHub release.

## How to Release

### Method 1: Automatic Release (Recommended)

The workflow automatically triggers when you push a version tag:

```bash
# 1. Update version in package.json (already done - 0.1.2)
# 2. Commit changes
git add package.json Doxyfile README.md
git commit -m "Bump version to 0.1.2"

# 3. Create and push version tag
git tag v0.1.2
git push origin main
git push origin v0.1.2
```

**What happens automatically:**
1. ✅ Builds on macOS arm64, macOS x64, and Linux x64
2. ✅ Runs all tests on each platform
3. ✅ Packages prebuilt binaries
4. ✅ Publishes to npm as `@faiss-node/native@0.1.2`
5. ✅ Creates GitHub release with binaries attached

### Method 2: Manual Trigger (GitHub UI)

1. Go to: https://github.com/anupammaurya6767/faiss-node-native/actions
2. Click on "Build and Release" workflow
3. Click "Run workflow" button
4. Select branch (usually `main`)
5. Click "Run workflow"

**Note:** Manual trigger builds binaries but **does NOT publish to npm** (only tag pushes publish).

## Workflow Steps

### Build Jobs (Run in Parallel)

1. **build-macos-arm64** - Builds for Apple Silicon Macs
2. **build-macos-x64** - Builds for Intel Macs
3. **build-linux-x64** - Builds for Linux

Each build job:
- Installs FAISS from source
- Builds native module
- Runs tests
- Packages binary as `.tar.gz`

### Publish Job (Only on Tag Push)

- **publish-npm** - Publishes to npm registry
  - Requires: `NPM_TOKEN` secret in GitHub repository settings
  - Only runs if tag starts with `v` (e.g., `v0.1.2`)

### Release Job (Only on Tag Push)

- **create-release** - Creates GitHub release
  - Attaches all prebuilt binaries
  - Creates release notes
  - Tags the release

## Prerequisites

### GitHub Secrets

Ensure these secrets are set in repository settings:

1. **NPM_TOKEN** - Your npm authentication token
   - Get from: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Create token with "Automation" type
   - Add to: Settings → Secrets and variables → Actions → New repository secret

### GitHub Pages

For documentation deployment:
- Enable in: Settings → Pages → Source: "GitHub Actions"

## Checking Workflow Status

### Via GitHub UI

1. Go to: https://github.com/anupammaurya6767/faiss-node-native/actions
2. Click on the workflow run
3. View logs for each job

### Via Command Line

```bash
# Using GitHub CLI
gh run list --workflow=build-release.yml

# Or check status script
npm run ci:status
```

## Troubleshooting

### Workflow Not Triggering

**Issue:** Tag push didn't trigger workflow
- **Solution:** Ensure tag format is `v*` (e.g., `v0.1.2`, not `0.1.2`)

**Issue:** Manual trigger not available
- **Solution:** Ensure you have write access to the repository

### npm Publish Failing

**Issue:** "ENEEDAUTH" error
- **Solution:** Check `NPM_TOKEN` secret is set correctly in repository settings

**Issue:** "Package already exists"
- **Solution:** Version already published. Bump version in `package.json` and create new tag.

### Build Failing

**Issue:** FAISS build errors
- **Solution:** Check workflow logs for specific error. Usually OpenMP or CMake issues.

**Issue:** Tests failing
- **Solution:** Fix failing tests before releasing. Workflow won't publish if tests fail.

## Release Checklist

Before creating a release:

- [ ] All tests pass locally: `npm test`
- [ ] Version updated in `package.json`
- [ ] Version updated in `Doxyfile`
- [ ] README.md updated (if needed)
- [ ] CHANGELOG.md updated (if you have one)
- [ ] Committed all changes
- [ ] `NPM_TOKEN` secret is set in GitHub
- [ ] Ready to tag and push

## Quick Release Command

```bash
# One-liner to release (after committing version bump)
git tag v0.1.2 && git push origin main && git push origin v0.1.2
```

## What Gets Published

### npm Package
- Package name: `@faiss-node/native`
- Version: From `package.json`
- Includes: Source code, TypeScript definitions, README, LICENSE

### GitHub Release
- Tag: `v0.1.2`
- Assets: Prebuilt binaries for macOS (arm64, x64) and Linux (x64)
- Release notes: Auto-generated from tag

## Post-Release

After successful release:

1. **Verify npm publication:**
   ```bash
   npm view @faiss-node/native version
   ```

2. **Test installation:**
   ```bash
   npm install @faiss-node/native@0.1.2
   ```

3. **Check GitHub release:**
   - Visit: https://github.com/anupammaurya6767/faiss-node-native/releases
   - Verify binaries are attached

4. **Update documentation:**
   - Documentation auto-deploys via `docs.yml` workflow
   - Check: https://anupammaurya6767.github.io/faiss-node-native/

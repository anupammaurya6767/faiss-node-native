# npm Publishing Setup

I've set up automated npm publishing that triggers when you create a version tag. Here's how it works:

## How It Works

### Automatic Publishing

The workflow (`.github/workflows/build-release.yml`) automatically publishes to npm when:
- You create a version tag (e.g., `v0.1.0`, `v1.0.0`)
- All builds pass (macOS arm64, macOS x64, Linux x64)
- All tests pass

### Publishing Process

1. **Builds run** on all platforms (macOS arm64, macOS x64, Linux x64)
2. **Tests run** to ensure everything works
3. **Version is extracted** from the tag (e.g., `v0.1.0` → `0.1.0`)
4. **package.json is updated** with the new version
5. **Package is published** to npm with `--access public` (required for scoped packages)
6. **GitHub Release is created** with prebuilt binaries

## Setup Instructions

### One-Time Setup

1. **Create npm account** (if you don't have one):
   - Go to https://www.npmjs.com/signup
   - Create an account

2. **Create npm access token**:
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token"
   - Select "Automation" token type
   - Copy the token (you'll only see it once!)

3. **Add token to GitHub Secrets**:
   - Go to your repository on GitHub
   - Click **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click **Add secret**

4. **Verify package name is available**:
   - Check if `@faiss-node/native` is available on npm
   - If not, update `package.json` with a different name

## Publishing a New Version

### Step 1: Update Version

I usually update the version in `package.json` first, then create a tag:

```bash
# Update version in package.json
npm version patch  # 0.1.0 → 0.1.1
# or
npm version minor  # 0.1.0 → 0.2.0
# or
npm version major  # 0.1.0 → 1.0.0
```

### Step 2: Create and Push Tag

```bash
# Create tag (npm version already created it, just push)
git push origin main --tags

# Or create tag manually
git tag v0.1.0
git push origin v0.1.0
```

### Step 3: Wait for Publishing

The workflow will:
1. Build on all platforms
2. Run tests
3. Publish to npm
4. Create GitHub release

Check the **Actions** tab to monitor progress.

## Package Details

- **Package name**: `@faiss-node/native`
- **Scope**: `@faiss-node` (scoped package)
- **Access**: Public (required for scoped packages)
- **Registry**: npmjs.org

## Verification

After publishing, verify the package:

```bash
# Check if package exists
npm view @faiss-node/native

# Check specific version
npm view @faiss-node/native@0.1.0

# Install and test
npm install @faiss-node/native@0.1.0
```

## Troubleshooting

### Publishing Fails

1. **Check npm token**: Ensure `NPM_TOKEN` secret is set correctly
2. **Check package name**: Verify `@faiss-node/native` is available
3. **Check version**: Ensure version doesn't already exist on npm
4. **Check logs**: View workflow logs in Actions tab

### Package Not Appearing

- npm can take a few minutes to index new packages
- Check https://www.npmjs.com/package/@faiss-node/native
- Try `npm view @faiss-node/native` after a few minutes

### Authentication Errors

- Verify npm token is valid
- Check token hasn't expired
- Ensure token has "Automation" type (not "Publish")

### Version Already Exists

If the version already exists on npm:
- Use a different version number
- Or unpublish (if within 72 hours): `npm unpublish @faiss-node/native@0.1.0`

## Local Publishing

I've set up a `.env` file for local npm publishing. The npm scripts automatically load the token from `.env`.

### Quick Start

```bash
# Test first (dry run - doesn't actually publish)
npm run publish:dry-run

# Actually publish
npm run publish:local
```

### Manual Setup (Alternative)

If you prefer to set it up manually:

```bash
# Load token from .env and configure npm
export NODE_AUTH_TOKEN=$(grep NPM_TOKEN .env | cut -d '=' -f2)
npm config set //registry.npmjs.org/:_authToken $NODE_AUTH_TOKEN

# Verify authentication
npm whoami

# Publish
npm publish --access public
```

### Manual Publishing (Alternative)

If you prefer to login manually:

```bash
# Login to npm
npm login

# Publish
npm publish --access public
```

### Dry Run (Test Before Publishing)

Test the publish process without actually publishing:

```bash
npm run publish:dry-run
```

## Best Practices

I follow these practices:
1. **Test before tagging**: Run `npm test` locally before creating a tag
2. **Use semantic versioning**: Follow semver (major.minor.patch)
3. **Update CHANGELOG**: Document changes before publishing
4. **Tag from main**: Always tag from the main branch
5. **Monitor workflow**: Check Actions tab after pushing tag

## Workflow Dependencies

The npm publishing job depends on:
- ✅ `build-macos-arm64` - Must pass
- ✅ `build-macos-x64` - Must pass
- ✅ `build-linux-x64` - Must pass

If any build fails, npm publishing won't run.

## Package.json Requirements

For npm publishing, I've ensured:
- ✅ `name` is set to `@faiss-node/native`
- ✅ `version` is set (updated automatically by workflow)
- ✅ `main` points to the entry file
- ✅ `types` points to TypeScript definitions
- ✅ `engines.node` specifies minimum Node version
- ✅ `license` is set to "MIT"

The workflow automatically updates the version in `package.json` before publishing.

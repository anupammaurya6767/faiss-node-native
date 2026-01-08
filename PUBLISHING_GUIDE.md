# Publishing Your First Package to npm

This guide will walk you through publishing `@faiss-node/native` to npm for the first time.

## Prerequisites

1. ✅ npm account created (sign up at https://www.npmjs.com/signup)
2. ✅ npm CLI installed (comes with Node.js)
3. ✅ Package is ready (all tests passing)
4. ✅ NPM_TOKEN configured (already done in `.env`)

## Step-by-Step Publishing Process

### Step 1: Verify Package Information

```bash
# Check package.json has correct info
cat package.json | grep -A 5 '"name"'

# Verify version
cat package.json | grep '"version"'
```

**Current version:** `0.1.0` (first release)

### Step 2: Login to npm

```bash
# Login to npm (will prompt for credentials)
npm login

# Or use your token (already configured in .env)
npm config set //registry.npmjs.org/:_authToken $(grep NPM_TOKEN .env | cut -d "=" -f2)
```

### Step 3: Test Package Locally (Dry Run)

```bash
# Create a tarball and see what will be published
npm pack --dry-run

# Actually create the tarball
npm pack

# Test installing it locally
cd /tmp
mkdir test-package-install
cd test-package-install
npm init -y
npm install /path/to/faiss-node/faiss-node-native-0.1.0.tgz
node -e "const { FaissIndex } = require('@faiss-node/native'); console.log('✅ Package works!');"
```

### Step 4: Verify What Will Be Published

```bash
# Check what files will be included
npm publish --dry-run

# Review the output - should include:
# - src/js/* (JavaScript code)
# - src/cpp/* (C++ source - for users who need to rebuild)
# - binding.gyp (build configuration)
# - package.json
# - README.md
# - LICENSE (if you have one)
```

### Step 5: Publish to npm

```bash
# Make sure you're in the project root
cd /Users/anupam/Desktop/open-source/test/faiss-node

# Publish (uses token from .env automatically)
npm run publish:local

# Or manually:
npm publish --access public
```

**Note:** The `--access public` flag is required for scoped packages (`@faiss-node/native`).

### Step 6: Verify Publication

```bash
# Check your package on npm
open https://www.npmjs.com/package/@faiss-node/native

# Or via CLI
npm view @faiss-node/native

# Test installing from npm
cd /tmp
mkdir test-npm-install
cd test-npm-install
npm init -y
npm install @faiss-node/native
node -e "const { FaissIndex } = require('@faiss-node/native'); const idx = new FaissIndex({ dims: 4 }); console.log('✅ Installed from npm!');"
```

## Version Management

### Semantic Versioning (SemVer)

- **MAJOR.MINOR.PATCH** (e.g., `0.1.0`)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Updating Version

```bash
# Patch version (0.1.0 -> 0.1.1)
npm version patch

# Minor version (0.1.0 -> 0.2.0)
npm version minor

# Major version (0.1.0 -> 1.0.0)
npm version major

# This automatically:
# 1. Updates package.json
# 2. Creates a git commit
# 3. Creates a git tag
```

### Publishing New Versions

```bash
# After bumping version
git push && git push --tags
npm publish --access public
```

## What Gets Published

The following files are included (check `.npmignore` or `package.json` `files` field):

- ✅ `src/js/*` - JavaScript source
- ✅ `src/cpp/*` - C++ source (for rebuilding)
- ✅ `binding.gyp` - Build configuration
- ✅ `package.json` - Package metadata
- ✅ `README.md` - Documentation
- ✅ `LICENSE` - License file (if exists)

Excluded:
- ❌ `test/` - Test files
- ❌ `node_modules/` - Dependencies
- ❌ `.github/` - GitHub workflows
- ❌ `docs/` - Generated documentation
- ❌ `build/` - Build artifacts

## Troubleshooting

### Error: "You must verify your email"
- Go to https://www.npmjs.com/settings/your-username/profile
- Verify your email address

### Error: "Package name already exists"
- Your package name `@faiss-node/native` is unique, so this shouldn't happen
- If it does, check if someone else created it

### Error: "You do not have permission"
- Make sure you're logged in: `npm whoami`
- Check you own the scope: `npm access ls-packages`

### Error: "Invalid package name"
- Scoped packages must use `--access public` flag
- Package name must match `package.json`

## Post-Publication Checklist

- [ ] Package appears on npm: https://www.npmjs.com/package/@faiss-node/native
- [ ] README displays correctly
- [ ] Installation works: `npm install @faiss-node/native`
- [ ] Package can be imported and used
- [ ] Version is correct
- [ ] All metadata (description, keywords, author) is visible

## Next Steps After Publishing

1. **Create a GitHub Release**
   ```bash
   git tag -a v0.1.0 -m "First release: @faiss-node/native v0.1.0"
   git push origin v0.1.0
   ```
   Then create a release on GitHub with release notes

2. **Share Your Package**
   - Post on Twitter/X
   - Share on Reddit (r/node, r/javascript)
   - Add to awesome-nodejs lists
   - Write a blog post

3. **Monitor Usage**
   - Check npm download stats: `npm view @faiss-node/native`
   - Monitor GitHub stars and issues
   - Respond to user questions

4. **Plan Next Version**
   - Collect feedback
   - Plan new features
   - Fix bugs reported by users

## Important Notes

- **Once published, you cannot unpublish** (unless within 72 hours and no one has installed it)
- **Version numbers are immutable** - you can't republish the same version
- **Always test locally first** with `npm pack` and `npm install ./package.tgz`
- **Keep your NPM_TOKEN secure** - never commit it to git

## Quick Reference

```bash
# Login
npm login

# Test
npm pack --dry-run

# Publish
npm publish --access public

# Check
npm view @faiss-node/native

# Update version
npm version patch|minor|major

# Publish new version
npm publish --access public
```

Good luck with your first npm publication! 🚀

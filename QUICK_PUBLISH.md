# Quick Publishing Guide

## 🚀 Publish Your First Package (3 Steps)

### Step 1: Test First (Dry Run)
```bash
npm run publish:dry-run
```
This shows what will be published WITHOUT actually publishing.

### Step 2: Verify Everything Looks Good
Check the output - should show:
- ✅ Package name: `@faiss-node/native`
- ✅ Version: `0.1.0`
- ✅ Author: Your name
- ✅ Description: Looks good
- ✅ Files: Only necessary files (no test/, .github/, etc.)

### Step 3: Publish!
```bash
npm run publish:local
```

That's it! Your package will be live on npm in a few minutes.

## 📍 After Publishing

1. **Check your package**: https://www.npmjs.com/package/@faiss-node/native
2. **Test installation**: 
   ```bash
   cd /tmp && mkdir test && cd test
   npm init -y
   npm install @faiss-node/native
   node -e "const { FaissIndex } = require('@faiss-node/native'); console.log('✅ Works!');"
   ```

## ⚠️ Important Notes

- **You can't unpublish easily** (only within 72 hours if no one installed it)
- **Version numbers are permanent** - can't republish same version
- **Always test with `publish:dry-run` first**

## 🎉 You're Done!

Your package is now live! Share it:
- Twitter/X: "Just published @faiss-node/native - high-performance FAISS bindings for Node.js 🚀"
- GitHub: Update your profile README
- Reddit: r/node, r/javascript

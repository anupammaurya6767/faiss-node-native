# Monitoring CI/CD Pipeline

## GitHub Actions Monitoring

### 1. View Workflow Runs
- Go to: https://github.com/anupammaurya6767/faiss-node-native/actions
- Click on any workflow run to see detailed logs
- Green checkmark = success, red X = failure

### 2. Real-time Monitoring
- Watch the Actions tab while a push is in progress
- Each job shows:
  - ✅ Success (green)
  - ❌ Failure (red)
  - ⏳ In Progress (yellow)
  - ⏸️ Cancelled (grey)

### 3. Key Workflows to Monitor

#### CI Workflow (`.github/workflows/ci.yml`)
- **Triggers**: Push to main, pull requests
- **Tests**: Unit tests, integration tests
- **Platforms**: macOS (Node 18, 20, 22)
- **What to check**:
  - ✅ All test suites pass
  - ✅ Code coverage meets threshold
  - ✅ Native module builds successfully
  - ✅ No SIGSEGV crashes

#### Build & Release Workflow (`.github/workflows/build-release.yml`)
- **Triggers**: Push tags (v*)
- **Builds**: Native modules for macOS
- **Publishes**: npm package
- **What to check**:
  - ✅ Build succeeds on all platforms
  - ✅ npm publish succeeds
  - ✅ Package version is correct

#### Docker Workflow (`.github/workflows/docker.yml`)
- **Triggers**: Push to main, pull requests
- **Tests**: Docker build and tests
- **What to check**:
  - ✅ Docker image builds successfully
  - ✅ Tests pass in Docker environment
  - ✅ No library linking errors

#### Documentation Workflow (`.github/workflows/docs.yml`)
- **Triggers**: Push to main
- **Generates**: Doxygen documentation
- **Deploys**: GitHub Pages
- **What to check**:
  - ✅ Documentation generates without errors
  - ✅ GitHub Pages deployment succeeds

### 4. Setting Up Notifications

#### Email Notifications
1. Go to: https://github.com/anupammaurya6767/faiss-node-native/settings/notifications
2. Enable "Actions" notifications
3. Choose: "Email" for failures only or all activity

#### GitHub Mobile App
- Install GitHub mobile app
- Enable push notifications for Actions
- Get instant alerts on failures

#### Slack/Discord Integration (Optional)
- Use GitHub webhooks
- Set up incoming webhooks in your team chat
- Get notifications for workflow status

### 5. Monitoring Commands (Local)

```bash
# Check workflow status via CLI
gh run list --workflow=ci.yml

# Watch a specific run
gh run watch

# View logs for a failed run
gh run view <run-id> --log-failed

# Check latest workflow status
gh workflow view ci.yml
```

### 6. Common Issues to Watch For

#### Build Failures
- **Symptom**: `ld: library 'omp' not found`
- **Fix**: Check `binding.gyp` libomp paths
- **Monitor**: Build native module step

#### Test Failures
- **Symptom**: SIGSEGV crashes
- **Fix**: Check OpenMP threading settings
- **Monitor**: Test execution step

#### npm Publish Failures
- **Symptom**: Authentication errors
- **Fix**: Check NPM_TOKEN secret
- **Monitor**: Publish step in build-release workflow

#### Documentation Failures
- **Symptom**: Doxygen errors
- **Fix**: Check Doxyfile configuration
- **Monitor**: Docs workflow

### 7. Performance Monitoring

Track these metrics over time:
- **Build time**: Should be < 5 minutes
- **Test time**: Should be < 2 minutes
- **Coverage**: Should maintain > 90%
- **Success rate**: Should be > 95%

### 8. Quick Status Check

```bash
# From project root
cd /Users/anupam/Desktop/open-source/test/faiss-node

# Check if workflows are running
gh run list --limit 5

# Check latest CI status
gh run list --workflow=ci.yml --limit 1

# View latest run details
gh run view --web
```

## Local Testing Checklist

Before pushing, always test locally:

```bash
# 1. Clean build
npm run clean

# 2. Build native module
npm run build

# 3. Run all tests
npm test

# 4. Run CI tests (same as GitHub Actions)
npm run test:ci

# 5. Test package installation
npm pack
# Then test installing the .tgz file in a fresh directory
```

## Troubleshooting

If CI fails but local tests pass:
1. Check environment differences (macOS version, Node version)
2. Check library paths (libomp, openblas)
3. Check OpenMP threading settings
4. Review workflow logs for specific errors

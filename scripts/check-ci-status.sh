#!/bin/bash
# Quick script to check CI/CD status

echo "=== GitHub Actions Status ==="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "⚠️  GitHub CLI (gh) not installed. Install with: brew install gh"
    echo ""
    echo "📊 View status manually at:"
    echo "   https://github.com/anupammaurya6767/faiss-node-native/actions"
    exit 0
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "⚠️  Not authenticated with GitHub. Run: gh auth login"
    echo ""
    echo "📊 View status manually at:"
    echo "   https://github.com/anupammaurya6767/faiss-node-native/actions"
    exit 0
fi

echo "📋 Latest Workflow Runs:"
echo ""
gh run list --limit 5 --workflow=ci.yml

echo ""
echo "📋 Latest Build & Release Runs:"
echo ""
gh run list --limit 3 --workflow=build-release.yml

echo ""
echo "📋 Latest Docker Runs:"
echo ""
gh run list --limit 3 --workflow=docker.yml

echo ""
echo "💡 To view detailed logs:"
echo "   gh run view --web"
echo ""
echo "💡 To watch a running workflow:"
echo "   gh run watch"

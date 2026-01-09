#!/bin/bash
# Script to find which repository is using a custom domain

DOMAIN="${1:-noobkoda.me}"

echo "=== Searching for repositories using $DOMAIN ==="
echo ""

if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not installed"
    echo "Install with: brew install gh"
    echo "Then run: gh auth login"
    exit 1
fi

echo "Fetching repositories..."
REPOS=$(gh repo list anupammaurya6767 --limit 100 --json name -q '.[].name')

FOUND=false
for REPO in $REPOS; do
    echo -n "Checking $REPO... "
    PAGES_CONFIG=$(gh api "repos/anupammaurya6767/$REPO/pages" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        if echo "$PAGES_CONFIG" | grep -q "$DOMAIN"; then
            echo "✅ FOUND!"
            echo "   Repository: $REPO"
            echo "   URL: https://github.com/anupammaurya6767/$REPO/settings/pages"
            echo "   Remove the custom domain from: https://github.com/anupammaurya6767/$REPO/settings/pages"
            FOUND=true
        else
            echo "❌"
        fi
    else
        echo "⚠️  (no Pages configured)"
    fi
done

if [ "$FOUND" = false ]; then
    echo ""
    echo "⚠️  No repository found using $DOMAIN"
    echo "The domain might be configured at the organization level or in a different account."
fi

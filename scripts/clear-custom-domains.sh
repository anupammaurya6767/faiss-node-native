#!/bin/bash
# Script to clear custom domains from repositories

REPOS=("faiss-node-native" "DSA_" "Kanao")

echo "=== Clearing custom domains from repositories ==="
echo ""

for repo in "${REPOS[@]}"; do
    echo "Processing $repo..."
    
    # Check current config
    CURRENT=$(gh api "repos/anupammaurya6767/$repo/pages" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "  Current config found"
        
        # Delete Pages config (this will clear custom domain)
        gh api -X DELETE "repos/anupammaurya6767/$repo/pages" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "  ✅ Cleared Pages config for $repo"
            echo "  ⚠️  You'll need to re-enable Pages in: https://github.com/anupammaurya6767/$repo/settings/pages"
        else
            echo "  ❌ Failed to clear $repo"
        fi
    else
        echo "  ⚠️  No Pages config found (or error)"
    fi
    echo ""
done

echo "=== Done ==="
echo ""
echo "Next steps:"
echo "1. Go to each repo's Settings → Pages"
echo "2. Re-enable Pages (select 'GitHub Actions' as source)"
echo "3. Make sure 'Custom domain' field is empty"
echo "4. Click Save"

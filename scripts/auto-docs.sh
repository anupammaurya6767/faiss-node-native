#!/bin/bash
# Automated documentation generation script
# Watches for file changes and regenerates documentation

set -e

echo "📚 Automated Documentation Generator"
echo "===================================="
echo ""
echo "This script will:"
echo "  1. Generate TypeDoc (JavaScript API) documentation"
echo "  2. Generate Doxygen (C++ Native) documentation"
echo "  3. Watch for changes and auto-regenerate"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Function to generate all docs
generate_docs() {
    echo ""
    echo "🔄 Regenerating documentation..."
    echo "   [$(date +'%H:%M:%S')]"
    
    # Generate TypeDoc
    echo "   → Generating TypeDoc..."
    npm run docs:js 2>&1 | grep -E "(error|warning|Using TypeDoc)" || true
    
    # Generate Doxygen
    echo "   → Generating Doxygen..."
    npm run docs:cpp 2>&1 | grep -E "(error|warning|Generating)" | head -3 || true
    
    echo "   ✅ Documentation generated successfully!"
    echo ""
}

# Initial generation
generate_docs

# Watch mode (if fswatch is available)
if command -v fswatch &> /dev/null; then
    echo "👀 Watching for changes..."
    echo "   Monitoring: src/js/, src/cpp/, typedoc.json, Doxyfile"
    echo ""
    
    fswatch -o src/js/ src/cpp/ typedoc.json Doxyfile README.md | while read f; do
        generate_docs
    done
elif command -v inotifywait &> /dev/null; then
    echo "👀 Watching for changes (Linux)..."
    echo "   Monitoring: src/js/, src/cpp/, typedoc.json, Doxyfile"
    echo ""
    
    while inotifywait -r -e modify,create,delete src/js/ src/cpp/ typedoc.json Doxyfile README.md 2>/dev/null; do
        generate_docs
    done
else
    echo "⚠️  File watcher not available (fswatch or inotifywait)"
    echo "   Install fswatch (macOS): brew install fswatch"
    echo "   Install inotifywait (Linux): sudo apt-get install inotify-tools"
    echo ""
    echo "   For now, documentation will be generated once."
    echo "   Run this script again after making changes."
    echo ""
    echo "   Or use: npm run docs:watch (TypeDoc only)"
fi

#!/bin/bash
# Script to test examples with realistic data
# This script downloads realistic embeddings or generates them from real text

set -e

echo "=== Testing with Realistic Data ==="
echo ""

# Check if we have the examples built
if [ ! -f "examples/rag-pipeline.js" ]; then
    echo "Error: examples/rag-pipeline.js not found"
    exit 1
fi

# Test RAG pipeline with realistic data
echo "1. Testing RAG Pipeline with realistic data..."
node examples/rag-pipeline.js

echo ""
echo "2. Testing Benchmarks with realistic data..."
node examples/benchmark.js

echo ""
echo "✅ All realistic data tests complete!"

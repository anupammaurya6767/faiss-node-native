#!/usr/bin/env bash
set -euo pipefail

# Example end-to-end CLI workflow using raw float32 vector files.

INDEX_PATH="./tmp/example-index.faiss"
VECTORS_PATH="./tmp/example-vectors.bin"
QUERY_PATH="./tmp/example-query.bin"

mkdir -p ./tmp

node - <<'NODE'
const fs = require('fs');

const vectors = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

const query = new Float32Array([1, 0, 0, 0]);

fs.writeFileSync('./tmp/example-vectors.bin', Buffer.from(vectors.buffer));
fs.writeFileSync('./tmp/example-query.bin', Buffer.from(query.buffer));
NODE

npm run cli -- create --output "$INDEX_PATH" --type FLAT_L2 --dims 4
npm run cli -- add --index "$INDEX_PATH" --file "$VECTORS_PATH" --batch 2
npm run cli -- search --index "$INDEX_PATH" --query "$QUERY_PATH" --k 2
npm run cli -- info --index "$INDEX_PATH"
npm run cli -- validate --index "$INDEX_PATH"

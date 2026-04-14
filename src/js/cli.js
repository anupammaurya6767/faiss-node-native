#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const {
  FaissIndex,
  FaissBinaryIndex,
  normalizeVectors,
} = require('./index');

function usage() {
  return `
faiss-node <command> [options]

Commands:
  create    Create an empty index file and metadata sidecar
  train     Train an existing index from a raw Float32 binary file
  add       Add vectors from a raw Float32 binary file
  search    Search using query vectors from a raw Float32 binary file
  info      Print index metadata and inspection details
  validate  Run a best-effort validation pass against an index

Examples:
  faiss-node create --output index.faiss --type HNSW --dims 768
  faiss-node add --index index.faiss --file vectors.bin --batch 10000
  faiss-node search --index index.faiss --query query.bin --k 10
  faiss-node info --index index.faiss
  faiss-node create --output binary.faiss --binary --type BINARY_HNSW --dims 256

Notes:
  - Float indexes use raw little-endian Float32 buffers.
  - Binary indexes use raw Uint8 buffers where each vector consumes dims / 8 bytes.
  - Dimensions are inferred from the index metadata sidecar when possible.
  - create/train/add write a .meta.json file next to the FAISS index.
`.trim();
}

function parseArgs(argv) {
  const positional = [];
  const options = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        options[key] = next;
        i += 1;
      } else {
        options[key] = true;
      }
    } else {
      positional.push(token);
    }
  }

  return {
    command: positional[0] || null,
    positional: positional.slice(1),
    options,
  };
}

function getRequiredOption(options, name) {
  const value = options[name];
  if (value === undefined || value === true || value === '') {
    throw new Error(`Missing required option --${name}`);
  }
  return value;
}

function parseIntegerOption(options, name, fallback) {
  if (options[name] === undefined) {
    return fallback;
  }

  const value = Number(options[name]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }

  return value;
}

function parseBooleanOption(options, name, fallback = false) {
  if (options[name] === undefined) {
    return fallback;
  }

  if (options[name] === true) {
    return true;
  }

  if (typeof options[name] === 'string') {
    const value = options[name].toLowerCase();
    if (value === 'true' || value === '1' || value === 'yes') {
      return true;
    }
    if (value === 'false' || value === '0' || value === 'no') {
      return false;
    }
  }

  return Boolean(options[name]);
}

async function readFloat32File(filename, dims) {
  const buffer = await fs.readFile(filename);
  if (buffer.byteLength % 4 !== 0) {
    throw new Error(`File ${filename} is not a valid Float32 buffer`);
  }

  const floatArray = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  const data = new Float32Array(floatArray);
  if (data.length % dims !== 0) {
    throw new Error(
      `Float32 data length (${data.length}) in ${filename} must be a multiple of dims (${dims})`
    );
  }

  return data;
}

async function readUint8File(filename) {
  const buffer = await fs.readFile(filename);
  return new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

function typedArrayToJson(value) {
  if (ArrayBuffer.isView(value)) {
    return Array.from(value);
  }

  if (Array.isArray(value)) {
    return value.map(typedArrayToJson);
  }

  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      output[key] = typedArrayToJson(nestedValue);
    }
    return output;
  }

  return value;
}

function createProgressLogger(label) {
  return (update) => {
    const percent = typeof update.percentage === 'number'
      ? ` (${update.percentage.toFixed(1)}%)`
      : '';
    const processed = update.processed !== undefined ? ` ${update.processed}/${update.total}` : '';
    console.error(`${label}: ${update.stage || `batch ${update.batch}/${update.totalBatches}`}${processed}${percent}`);
  };
}

function buildConfigFromOptions(options) {
  const config = {
    dims: parseIntegerOption(options, 'dims'),
  };

  if (options.type !== undefined) {
    config.type = options.type;
  }
  if (options.factory !== undefined) {
    config.factory = options.factory;
  }
  if (options.metric !== undefined) {
    config.metric = options.metric;
  }
  if (options.nlist !== undefined) {
    config.nlist = parseIntegerOption(options, 'nlist');
  }
  if (options.nprobe !== undefined) {
    config.nprobe = parseIntegerOption(options, 'nprobe');
  }
  if (options.M !== undefined) {
    config.M = parseIntegerOption(options, 'M');
  }
  if (options.efConstruction !== undefined) {
    config.efConstruction = parseIntegerOption(options, 'efConstruction');
  }
  if (options.efSearch !== undefined) {
    config.efSearch = parseIntegerOption(options, 'efSearch');
  }
  if (options.pqSegments !== undefined) {
    config.pqSegments = parseIntegerOption(options, 'pqSegments');
  }
  if (options.pqBits !== undefined) {
    config.pqBits = parseIntegerOption(options, 'pqBits');
  }
  if (options.sqType !== undefined) {
    config.sqType = options.sqType;
  }

  return config;
}

function buildBinaryConfigFromOptions(options) {
  const config = {
    dims: parseIntegerOption(options, 'dims'),
  };

  if (options.type !== undefined) {
    config.type = options.type;
  }
  if (options.factory !== undefined) {
    config.factory = options.factory;
  }
  if (options.nlist !== undefined) {
    config.nlist = parseIntegerOption(options, 'nlist');
  }
  if (options.nprobe !== undefined) {
    config.nprobe = parseIntegerOption(options, 'nprobe');
  }
  if (options.M !== undefined) {
    config.M = parseIntegerOption(options, 'M');
  }
  if (options.efConstruction !== undefined) {
    config.efConstruction = parseIntegerOption(options, 'efConstruction');
  }
  if (options.efSearch !== undefined) {
    config.efSearch = parseIntegerOption(options, 'efSearch');
  }
  if (options.hashBits !== undefined) {
    config.hashBits = parseIntegerOption(options, 'hashBits');
  }
  if (options.hashNflip !== undefined) {
    const hashNflip = Number(options.hashNflip);
    if (!Number.isInteger(hashNflip) || hashNflip < 0) {
      throw new Error('--hashNflip must be a non-negative integer');
    }
    config.hashNflip = hashNflip;
  }

  return config;
}

async function readMetadata(indexPath) {
  try {
    return JSON.parse(await fs.readFile(`${indexPath}.meta.json`, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function inferIndexKindFromOptions(options) {
  if (parseBooleanOption(options, 'binary', false)) {
    return 'binary';
  }

  if (typeof options.type === 'string' && options.type.startsWith('BINARY_')) {
    return 'binary';
  }

  if (typeof options.factory === 'string' && /^B[A-Za-z0-9,_]/.test(options.factory)) {
    return 'binary';
  }

  return 'float';
}

function inferIndexKindFromMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  if (metadata.kind === 'binary' || metadata?.index?.kind === 'binary') {
    return 'binary';
  }

  const type = metadata?.index?.stats?.type || metadata?.index?.config?.type;
  if (typeof type === 'string' && type.startsWith('BINARY_')) {
    return 'binary';
  }

  if (metadata?.index?.stats?.metric === 'hamming') {
    return 'binary';
  }

  return 'float';
}

async function loadIndex(indexPath, options = {}) {
  const metadata = await readMetadata(indexPath);
  const kind = inferIndexKindFromOptions(options) === 'binary'
    ? 'binary'
    : (inferIndexKindFromMetadata(metadata) || 'float');

  if (kind === 'binary') {
    return FaissBinaryIndex.loadWithMetadata(indexPath);
  }

  return FaissIndex.loadWithMetadata(indexPath);
}

async function maybeNormalize(vectors, dims, options) {
  if (!parseBooleanOption(options, 'normalize', false)) {
    return vectors;
  }
  return normalizeVectors(vectors, dims);
}

async function handleCreate(options) {
  const output = getRequiredOption(options, 'output');
  const kind = inferIndexKindFromOptions(options);
  const config = kind === 'binary'
    ? buildBinaryConfigFromOptions(options)
    : buildConfigFromOptions(options);
  const IndexClass = kind === 'binary' ? FaissBinaryIndex : FaissIndex;
  const index = new IndexClass(config);

  await index.saveWithMetadata(output, {
    cli: {
      command: 'create',
      kind,
      createdFrom: process.argv.slice(2),
    },
  });

  console.log(index.inspect({ format: 'text' }));
  console.error(`Created ${output}`);
}

async function handleTrain(options) {
  const indexPath = getRequiredOption(options, 'index');
  const filePath = getRequiredOption(options, 'file');
  const index = await loadIndex(indexPath, options);
  const stats = index.getStats();
  const isBinary = stats.metric === 'hamming';
  const vectors = isBinary
    ? await readUint8File(filePath)
    : await maybeNormalize(await readFloat32File(filePath, stats.dims), stats.dims, options);

  await index.trainWithProgress(vectors, { onProgress: createProgressLogger('train') });
  await index.saveWithMetadata(indexPath, {
    cli: {
      command: 'train',
      kind: isBinary ? 'binary' : 'float',
      file: filePath,
    },
  });

  console.log(index.inspect({ format: 'text' }));
}

async function handleAdd(options) {
  const indexPath = getRequiredOption(options, 'index');
  const filePath = getRequiredOption(options, 'file');
  const batchSize = parseIntegerOption(options, 'batch', 10000);
  const index = await loadIndex(indexPath, options);
  const stats = index.getStats();
  const isBinary = stats.metric === 'hamming';
  const vectors = isBinary
    ? await readUint8File(filePath)
    : await maybeNormalize(await readFloat32File(filePath, stats.dims), stats.dims, options);
  const autoTrain = parseBooleanOption(options, 'auto-train', true);

  if (!stats.isTrained) {
    if (!autoTrain) {
      throw new Error('Index is not trained. Run `faiss-node train` first or pass --auto-train.');
    }

    console.error('Index is not trained; training on the provided vectors before add.');
    await index.trainWithProgress(vectors, { onProgress: createProgressLogger('train') });
  }

  await index.addWithProgress(vectors, {
    batchSize,
    onProgress: createProgressLogger('add'),
  });

  await index.saveWithMetadata(indexPath, {
    cli: {
      command: 'add',
      kind: isBinary ? 'binary' : 'float',
      file: filePath,
      batchSize,
    },
  });

  console.log(index.inspect({ format: 'text' }));
}

async function handleSearch(options) {
  const indexPath = getRequiredOption(options, 'index');
  const filePath = getRequiredOption(options, 'query');
  const k = parseIntegerOption(options, 'k', null);
  if (k === null) {
    throw new Error('Missing required option --k');
  }
  const index = await loadIndex(indexPath, options);
  const stats = index.getStats();
  const isBinary = stats.metric === 'hamming';
  const queries = isBinary
    ? await readUint8File(filePath)
    : await maybeNormalize(await readFloat32File(filePath, stats.dims), stats.dims, options);
  const queryCount = isBinary
    ? queries.length / stats.bytesPerVector
    : queries.length / stats.dims;

  const result = queryCount === 1
    ? await index.search(queries, k)
    : await index.searchBatch(queries, k);

  console.log(JSON.stringify(typedArrayToJson(result), null, 2));
}

async function handleInfo(options) {
  const indexPath = getRequiredOption(options, 'index');
  const index = await loadIndex(indexPath, options);
  const useJson = parseBooleanOption(options, 'json', false);
  if (useJson) {
    console.log(JSON.stringify(typedArrayToJson(index.inspect()), null, 2));
    return;
  }

  console.log(index.inspect({ format: 'text' }));
}

async function handleValidate(options) {
  const indexPath = getRequiredOption(options, 'index');
  const index = await loadIndex(indexPath, options);
  const report = await index.validate();
  console.log(JSON.stringify(typedArrayToJson(report), null, 2));
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!command || command === 'help' || command === '--help') {
    console.log(usage());
    return;
  }

  if (command === 'create') {
    await handleCreate(options);
    return;
  }

  if (command === 'train') {
    await handleTrain(options);
    return;
  }

  if (command === 'add') {
    await handleAdd(options);
    return;
  }

  if (command === 'search') {
    await handleSearch(options);
    return;
  }

  if (command === 'info') {
    await handleInfo(options);
    return;
  }

  if (command === 'validate') {
    await handleValidate(options);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
});

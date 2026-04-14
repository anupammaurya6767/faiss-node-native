const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const cliPath = path.join(__dirname, '../../src/js/cli.js');

function writeFloat32File(filename, values) {
  const array = new Float32Array(values);
  fs.writeFileSync(filename, Buffer.from(array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength)));
}

function writeUint8File(filename, values) {
  fs.writeFileSync(filename, Buffer.from(Uint8Array.from(values)));
}

describe('CLI', () => {
  test('create, add, search, info, and validate commands work end to end', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faiss-node-cli-'));
    const indexPath = path.join(tempDir, 'index.faiss');
    const vectorsPath = path.join(tempDir, 'vectors.bin');
    const queryPath = path.join(tempDir, 'query.bin');
    try {
      writeFloat32File(vectorsPath, [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
      ]);
      writeFloat32File(queryPath, [1, 0, 0, 0]);

      const createOut = execFileSync('node', [
        cliPath,
        'create',
        '--output', indexPath,
        '--type', 'FLAT_L2',
        '--dims', '4',
      ], { encoding: 'utf8', timeout: 5000 });

      expect(createOut).toContain('Type: FLAT_L2');
      expect(fs.existsSync(indexPath)).toBe(true);
      expect(fs.existsSync(`${indexPath}.meta.json`)).toBe(true);

      const addOut = execFileSync('node', [
        cliPath,
        'add',
        '--index', indexPath,
        '--file', vectorsPath,
        '--batch', '2',
      ], { encoding: 'utf8', timeout: 5000 });

      expect(addOut).toContain('Vectors: 3');

      const searchOut = execFileSync('node', [
        cliPath,
        'search',
        '--index', indexPath,
        '--query', queryPath,
        '--k', '2',
      ], { encoding: 'utf8', timeout: 5000 });

      const searchResult = JSON.parse(searchOut);
      expect(searchResult.labels[0]).toBe(0);
      expect(searchResult.distances[0]).toBeCloseTo(0, 5);

      const infoOut = execFileSync('node', [
        cliPath,
        'info',
        '--index', indexPath,
      ], { encoding: 'utf8', timeout: 5000 });

      expect(infoOut).toContain('Type: FLAT_L2');

      const validateOut = execFileSync('node', [
        cliPath,
        'validate',
        '--index', indexPath,
      ], { encoding: 'utf8', timeout: 5000 });

      const validation = JSON.parse(validateOut);
      expect(validation.valid).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('binary create, add, search, info, and validate commands work end to end', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faiss-node-cli-binary-'));
    const indexPath = path.join(tempDir, 'binary.faiss');
    const vectorsPath = path.join(tempDir, 'vectors.bin');
    const queryPath = path.join(tempDir, 'query.bin');
    try {
      writeUint8File(vectorsPath, [
        0x00, 0x00,
        0xff, 0xff,
        0xf0, 0x0f,
      ]);
      writeUint8File(queryPath, [0x00, 0x00]);

      const createOut = execFileSync('node', [
        cliPath,
        'create',
        '--output', indexPath,
        '--binary',
        '--type', 'BINARY_FLAT',
        '--dims', '16',
      ], { encoding: 'utf8', timeout: 5000 });

      expect(createOut).toContain('Type: BINARY_FLAT');
      expect(fs.existsSync(indexPath)).toBe(true);
      expect(fs.existsSync(`${indexPath}.meta.json`)).toBe(true);

      const addOut = execFileSync('node', [
        cliPath,
        'add',
        '--index', indexPath,
        '--binary',
        '--file', vectorsPath,
      ], { encoding: 'utf8', timeout: 5000 });

      expect(addOut).toContain('Vectors: 3');

      const searchOut = execFileSync('node', [
        cliPath,
        'search',
        '--index', indexPath,
        '--binary',
        '--query', queryPath,
        '--k', '2',
      ], { encoding: 'utf8', timeout: 5000 });

      const searchResult = JSON.parse(searchOut);
      expect(searchResult.labels[0]).toBe(0);
      expect(searchResult.distances[0]).toBe(0);

      const infoOut = execFileSync('node', [
        cliPath,
        'info',
        '--index', indexPath,
        '--binary',
      ], { encoding: 'utf8', timeout: 5000 });

      expect(infoOut).toContain('Dims: 16 bits');

      const validateOut = execFileSync('node', [
        cliPath,
        'validate',
        '--index', indexPath,
        '--binary',
      ], { encoding: 'utf8', timeout: 5000 });

      const validation = JSON.parse(validateOut);
      expect(validation.valid).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

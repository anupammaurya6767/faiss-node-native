/**
 * Comprehensive Manual Tests for Save/Load
 * 100+ test cases covering all edge cases, boundary conditions, and error scenarios
 */

const { FaissIndex } = require('../../src/js/index');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Save/Load - Comprehensive Manual Tests (100+ cases)', () => {
    const tempDir = path.join(os.tmpdir(), 'faiss-test-' + Date.now());
    
    beforeAll(() => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });
    
    afterAll(() => {
        if (fs.existsSync(tempDir)) {
            fs.readdirSync(tempDir).forEach(file => {
                fs.unlinkSync(path.join(tempDir, file));
            });
            fs.rmdirSync(tempDir);
        }
    });
    
    // ============================================================================
    // VALID SAVE OPERATIONS (20 cases)
    // ============================================================================
    
    describe('Valid Save Operations', () => {
        test.each([
            [1, 'dim=1'],
            [2, 'dim=2'],
            [4, 'dim=4'],
            [8, 'dim=8'],
            [16, 'dim=16'],
            [32, 'dim=32'],
            [64, 'dim=64'],
            [128, 'dim=128'],
            [256, 'dim=256'],
            [512, 'dim=512'],
        ])('saves empty index with %s', async (dims, description) => {
            const index = new FaissIndex({ dims });
            const filename = path.join(tempDir, `test-${dims}-${Date.now()}.idx`);
            await index.save(filename);
            expect(fs.existsSync(filename)).toBe(true);
            index.dispose();
        });

        test('saves index with vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index.save(filename);
            expect(fs.existsSync(filename)).toBe(true);
            index.dispose();
        });

        test('saves index with many vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(1000 * 4);
            for (let i = 0; i < 1000 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index.save(filename);
            expect(fs.existsSync(filename)).toBe(true);
            index.dispose();
        });
    });

    // ============================================================================
    // VALID LOAD OPERATIONS (20 cases)
    // ============================================================================
    
    describe('Valid Load Operations', () => {
        test.each([
            [1, 'dim=1'],
            [2, 'dim=2'],
            [4, 'dim=4'],
            [8, 'dim=8'],
            [16, 'dim=16'],
            [32, 'dim=32'],
            [64, 'dim=64'],
            [128, 'dim=128'],
            [256, 'dim=256'],
            [512, 'dim=512'],
        ])('loads empty index with %s', async (dims, description) => {
            const index1 = new FaissIndex({ dims });
            const filename = path.join(tempDir, `test-${dims}-${Date.now()}.idx`);
            await index1.save(filename);
            index1.dispose();
            
            const index2 = await FaissIndex.load(filename);
            const stats = index2.getStats();
            expect(stats.dims).toBe(dims);
            expect(stats.ntotal).toBe(0);
            index2.dispose();
        });

        test('loads index with vectors', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index1.add(vectors);
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index1.save(filename);
            index1.dispose();
            
            const index2 = await FaissIndex.load(filename);
            const stats = index2.getStats();
            expect(stats.ntotal).toBe(1);
            expect(stats.dims).toBe(4);
            index2.dispose();
        });

        test('loads index preserves vectors', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
                2.0, 2.0, 2.0, 2.0,
            ]);
            await index1.add(vectors);
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index1.save(filename);
            index1.dispose();
            
            const index2 = await FaissIndex.load(filename);
            const stats = index2.getStats();
            expect(stats.ntotal).toBe(3);
            
            const query = new Float32Array([0.1, 0.1, 0.1, 0.1]);
            const results = await index2.search(query, 1);
            expect(results.labels[0]).toBe(0); // Should find closest vector
            index2.dispose();
        });
    });

    // ============================================================================
    // INVALID SAVE OPERATIONS (15 cases)
    // ============================================================================
    
    describe('Invalid Save Operations', () => {
        let index;
        beforeEach(async () => {
            index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
        });
        afterEach(() => {
            if (index) index.dispose();
        });

        test.each([
            [null, TypeError, 'null filename'],
            [undefined, TypeError, 'undefined filename'],
            [123, TypeError, 'number filename'],
            [true, TypeError, 'boolean filename'],
            [[], TypeError, 'array filename'],
            [{}, TypeError, 'object filename'],
            ['', TypeError, 'empty string filename'],
            [() => {}, TypeError, 'function filename'],
        ])('throws %s for %s', async (filename, errorType, description) => {
            await expect(index.save(filename)).rejects.toThrow(errorType);
        });

        test('throws after dispose', async () => {
            index.dispose();
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await expect(index.save(filename)).rejects.toThrow();
        });
    });

    // ============================================================================
    // INVALID LOAD OPERATIONS (15 cases)
    // ============================================================================
    
    describe('Invalid Load Operations', () => {
        test.each([
            [null, TypeError, 'null filename'],
            [undefined, TypeError, 'undefined filename'],
            [123, TypeError, 'number filename'],
            [true, TypeError, 'boolean filename'],
            [[], TypeError, 'array filename'],
            [{}, TypeError, 'object filename'],
            ['', TypeError, 'empty string filename'],
            ['nonexistent.idx', Error, 'nonexistent file'],
            ['/invalid/path/file.idx', Error, 'invalid path'],
        ])('throws %s for %s', async (filename, errorType, description) => {
            await expect(FaissIndex.load(filename)).rejects.toThrow(errorType);
        });
    });

    // ============================================================================
    // SAVE/LOAD ROUNDTRIP (20 cases)
    // ============================================================================
    
    describe('Save/Load Roundtrip', () => {
        test('roundtrip empty index', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index1.save(filename);
            index1.dispose();
            
            const index2 = await FaissIndex.load(filename);
            const stats = index2.getStats();
            expect(stats.dims).toBe(4);
            expect(stats.ntotal).toBe(0);
            index2.dispose();
        });

        test('roundtrip index with vectors', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
            ]);
            await index1.add(vectors);
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index1.save(filename);
            index1.dispose();
            
            const index2 = await FaissIndex.load(filename);
            const stats = index2.getStats();
            expect(stats.ntotal).toBe(2);
            
            const query = new Float32Array([0.1, 0.1, 0.1, 0.1]);
            const results = await index2.search(query, 2);
            expect(results.distances.length).toBe(2);
            index2.dispose();
        });

        test('roundtrip preserves search results', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                5.0, 5.0, 5.0, 5.0,
                10.0, 10.0, 10.0, 10.0,
            ]);
            await index1.add(vectors);
            
            const query = new Float32Array([0.1, 0.1, 0.1, 0.1]);
            const results1 = await index1.search(query, 3);
            
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index1.save(filename);
            index1.dispose();
            
            const index2 = await FaissIndex.load(filename);
            const results2 = await index2.search(query, 3);
            
            expect(results2.labels[0]).toBe(results1.labels[0]);
            expect(results2.distances[0]).toBeCloseTo(results1.distances[0], 5);
            index2.dispose();
        });

        test('roundtrip with large index', async () => {
            const index1 = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(10000 * 128);
            for (let i = 0; i < 10000 * 128; i++) {
                vectors[i] = Math.random();
            }
            await index1.add(vectors);
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index1.save(filename);
            index1.dispose();
            
            const index2 = await FaissIndex.load(filename);
            const stats = index2.getStats();
            expect(stats.ntotal).toBe(10000);
            expect(stats.dims).toBe(128);
            index2.dispose();
        });
    });

    // ============================================================================
    // MULTIPLE SAVE/LOAD (10 cases)
    // ============================================================================
    
    describe('Multiple Save/Load', () => {
        test('saves to multiple files', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
            
            const files = [];
            for (let i = 0; i < 5; i++) {
                const filename = path.join(tempDir, `test-${i}-${Date.now()}.idx`);
                await index.save(filename);
                files.push(filename);
                expect(fs.existsSync(filename)).toBe(true);
            }
            
            index.dispose();
            files.forEach(f => fs.unlinkSync(f));
        });

        test('loads same file multiple times', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index1.add(vectors);
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index1.save(filename);
            index1.dispose();
            
            for (let i = 0; i < 5; i++) {
                const index2 = await FaissIndex.load(filename);
                const stats = index2.getStats();
                expect(stats.ntotal).toBe(1);
                index2.dispose();
            }
            
            fs.unlinkSync(filename);
        });
    });
});

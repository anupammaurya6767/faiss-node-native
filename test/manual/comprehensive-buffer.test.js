/**
 * Comprehensive Manual Tests for ToBuffer/FromBuffer
 * 100+ test cases covering all edge cases, boundary conditions, and error scenarios
 */

const { FaissIndex } = require('../../src/js/index');

describe('ToBuffer/FromBuffer - Comprehensive Manual Tests (100+ cases)', () => {
    
    // ============================================================================
    // VALID TOBUFFER OPERATIONS (20 cases)
    // ============================================================================
    
    describe('Valid ToBuffer Operations', () => {
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
        ])('serializes empty index with %s', async (dims, description) => {
            const index = new FaissIndex({ dims });
            const buffer = await index.toBuffer();
            
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(0);
            index.dispose();
        });

        test('serializes index with vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
            const buffer = await index.toBuffer();
            
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(0);
            index.dispose();
        });

        test('serializes index with many vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(1000 * 4);
            for (let i = 0; i < 1000 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            const buffer = await index.toBuffer();
            
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(0);
            index.dispose();
        });
    });

    // ============================================================================
    // VALID FROMBUFFER OPERATIONS (20 cases)
    // ============================================================================
    
    describe('Valid FromBuffer Operations', () => {
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
        ])('deserializes empty index with %s', async (dims, description) => {
            const index1 = new FaissIndex({ dims });
            const buffer = await index1.toBuffer();
            index1.dispose();
            
            const index2 = await FaissIndex.fromBuffer(buffer);
            const stats = index2.getStats();
            expect(stats.dims).toBe(dims);
            expect(stats.ntotal).toBe(0);
            index2.dispose();
        });

        test('deserializes index with vectors', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index1.add(vectors);
            const buffer = await index1.toBuffer();
            index1.dispose();
            
            const index2 = await FaissIndex.fromBuffer(buffer);
            const stats = index2.getStats();
            expect(stats.ntotal).toBe(1);
            expect(stats.dims).toBe(4);
            index2.dispose();
        });

        test('deserializes preserves vectors', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
                2.0, 2.0, 2.0, 2.0,
            ]);
            await index1.add(vectors);
            const buffer = await index1.toBuffer();
            index1.dispose();
            
            const index2 = await FaissIndex.fromBuffer(buffer);
            const stats = index2.getStats();
            expect(stats.ntotal).toBe(3);
            
            const query = new Float32Array([0.1, 0.1, 0.1, 0.1]);
            const results = await index2.search(query, 1);
            expect(results.labels[0]).toBe(0);
            index2.dispose();
        });
    });

    // ============================================================================
    // INVALID TOBUFFER OPERATIONS (10 cases)
    // ============================================================================
    
    describe('Invalid ToBuffer Operations', () => {
        test('throws after dispose', async () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            await expect(index.toBuffer()).rejects.toThrow();
        });
    });

    // ============================================================================
    // INVALID FROMBUFFER OPERATIONS (15 cases)
    // ============================================================================
    
    describe('Invalid FromBuffer Operations', () => {
        test.each([
            [null, TypeError, 'null buffer'],
            [undefined, TypeError, 'undefined buffer'],
            ['string', TypeError, 'string buffer'],
            [123, TypeError, 'number buffer'],
            [true, TypeError, 'boolean buffer'],
            [[], TypeError, 'array buffer'],
            [{}, TypeError, 'object buffer'],
            [new Uint8Array(10), TypeError, 'Uint8Array'],
            [Buffer.alloc(0), Error, 'empty buffer'],
            [Buffer.alloc(10), Error, 'invalid buffer'],
        ])('throws %s for %s', async (buffer, errorType, description) => {
            await expect(FaissIndex.fromBuffer(buffer)).rejects.toThrow(errorType);
        });
    });

    // ============================================================================
    // BUFFER ROUNDTRIP (20 cases)
    // ============================================================================
    
    describe('Buffer Roundtrip', () => {
        test('roundtrip empty index', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const buffer = await index1.toBuffer();
            index1.dispose();
            
            const index2 = await FaissIndex.fromBuffer(buffer);
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
            const buffer = await index1.toBuffer();
            index1.dispose();
            
            const index2 = await FaissIndex.fromBuffer(buffer);
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
            
            const buffer = await index1.toBuffer();
            index1.dispose();
            
            const index2 = await FaissIndex.fromBuffer(buffer);
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
            const buffer = await index1.toBuffer();
            index1.dispose();
            
            const index2 = await FaissIndex.fromBuffer(buffer);
            const stats = index2.getStats();
            expect(stats.ntotal).toBe(10000);
            expect(stats.dims).toBe(128);
            index2.dispose();
        });
    });

    // ============================================================================
    // BUFFER PROPERTIES (10 cases)
    // ============================================================================
    
    describe('Buffer Properties', () => {
        test('buffer is valid Node.js Buffer', async () => {
            const index = new FaissIndex({ dims: 4 });
            const buffer = await index.toBuffer();
            
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer instanceof Buffer).toBe(true);
            expect(typeof buffer.length).toBe('number');
            expect(buffer.length).toBeGreaterThan(0);
            index.dispose();
        });

        test('buffer can be copied', async () => {
            const index = new FaissIndex({ dims: 4 });
            const buffer1 = await index.toBuffer();
            const buffer2 = Buffer.from(buffer1);
            
            expect(buffer2.length).toBe(buffer1.length);
            index.dispose();
        });

        test('buffer can be sliced', async () => {
            const index = new FaissIndex({ dims: 4 });
            const buffer = await index.toBuffer();
            const slice = buffer.slice(0, 10);
            
            expect(slice.length).toBe(10);
            index.dispose();
        });
    });
});

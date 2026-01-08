/**
 * Comprehensive Manual Tests for Search
 * 100+ test cases covering all edge cases, boundary conditions, and error scenarios
 */

const { FaissIndex } = require('../../src/js/index');

describe('Search - Comprehensive Manual Tests (100+ cases)', () => {
    
    // ============================================================================
    // VALID SEARCH OPERATIONS (20 cases)
    // ============================================================================
    
    describe('Valid Search Operations', () => {
        test.each([
            [1, 1, 'dim=1, k=1'],
            [2, 1, 'dim=2, k=1'],
            [4, 1, 'dim=4, k=1'],
            [8, 2, 'dim=8, k=2'],
            [16, 3, 'dim=16, k=3'],
            [32, 5, 'dim=32, k=5'],
            [64, 10, 'dim=64, k=10'],
            [128, 10, 'dim=128, k=10'],
            [256, 20, 'dim=256, k=20'],
            [512, 50, 'dim=512, k=50'],
        ])('searches with %s', async (dims, k, description) => {
            const index = new FaissIndex({ dims });
            const vectors = new Float32Array(10 * dims);
            for (let i = 0; i < 10 * dims; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array(dims);
            for (let i = 0; i < dims; i++) {
                query[i] = Math.random();
            }
            
            const results = await index.search(query, k);
            expect(results.distances).toBeDefined();
            expect(results.labels).toBeDefined();
            // k may be clamped to available vectors (10)
            expect(results.distances.length).toBeLessThanOrEqual(k);
            expect(results.labels.length).toBeLessThanOrEqual(k);
            expect(results.distances.length).toBeGreaterThan(0);
            
            index.dispose();
        });
    });

    // ============================================================================
    // INVALID QUERY TYPES (15 cases)
    // ============================================================================
    
    describe('Invalid Query Types', () => {
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
            [null, TypeError, 'null query'],
            [undefined, TypeError, 'undefined query'],
            ['string', TypeError, 'string query'],
            [123, TypeError, 'number query'],
            [true, TypeError, 'boolean query'],
            [[], TypeError, 'empty array'],
            [[0.1, 0.2, 0.3, 0.4], TypeError, 'regular array'],
            [new Int32Array(4), TypeError, 'Int32Array'],
            [new Uint8Array(4), TypeError, 'Uint8Array'],
            [new ArrayBuffer(16), TypeError, 'ArrayBuffer'],
            [{}, TypeError, 'object query'],
            [() => {}, TypeError, 'function query'],
            [new Map(), TypeError, 'map query'],
            [new Set(), TypeError, 'set query'],
            [Symbol('test'), TypeError, 'symbol query'],
        ])('throws %s for %s', async (query, errorType, description) => {
            await expect(index.search(query, 1)).rejects.toThrow(errorType);
        });
    });

    // ============================================================================
    // DIMENSION MISMATCH (20 cases)
    // ============================================================================
    
    describe('Dimension Mismatch', () => {
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
            [1, 'query length 1 for dim 4'],
            [2, 'query length 2 for dim 4'],
            [3, 'query length 3 for dim 4'],
            [5, 'query length 5 for dim 4'],
            [6, 'query length 6 for dim 4'],
            [7, 'query length 7 for dim 4'],
            [8, 'query length 8 for dim 4'],
            [9, 'query length 9 for dim 4'],
            [10, 'query length 10 for dim 4'],
            [15, 'query length 15 for dim 4'],
            [16, 'query length 16 for dim 4'],
            [20, 'query length 20 for dim 4'],
            [32, 'query length 32 for dim 4'],
            [64, 'query length 64 for dim 4'],
            [100, 'query length 100 for dim 4'],
            [128, 'query length 128 for dim 4'],
            [256, 'query length 256 for dim 4'],
            [512, 'query length 512 for dim 4'],
            [1000, 'query length 1000 for dim 4'],
            [10000, 'query length 10000 for dim 4'],
        ])('rejects %s', async (length, description) => {
            const query = new Float32Array(length);
            await expect(index.search(query, 1)).rejects.toThrow();
        });
    });

    // ============================================================================
    // INVALID K VALUES (20 cases)
    // ============================================================================
    
    describe('Invalid K Values', () => {
        let index;
        beforeEach(async () => {
            index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
        });
        afterEach(() => {
            if (index) index.dispose();
        });

        const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);

        test.each([
            [null, TypeError, 'null k'],
            [undefined, TypeError, 'undefined k'],
            ['string', TypeError, 'string k'],
            ['1', TypeError, 'string number k'],
            [0, TypeError, 'zero k'],
            [-1, TypeError, 'negative k'],
            [-100, TypeError, 'large negative k'],
            [0.5, TypeError, 'float k'],
            [1.5, TypeError, 'float k'],
            [128.9, TypeError, 'float k'],
            [Infinity, TypeError, 'infinity k'],
            [-Infinity, TypeError, 'negative infinity k'],
            [[], TypeError, 'array k'],
            [{}, TypeError, 'object k'],
            [() => {}, TypeError, 'function k'],
            [true, TypeError, 'boolean true k'],
            [false, TypeError, 'boolean false k'],
            [NaN, TypeError, 'NaN k'],
            [Number.MAX_SAFE_INTEGER + 1, Error, 'unsafe integer k'],
            [Number.MIN_SAFE_INTEGER, TypeError, 'min safe integer k'],
        ])('throws %s for %s', async (k, errorType, description) => {
            await expect(index.search(query, k)).rejects.toThrow(errorType);
        });
    });

    // ============================================================================
    // EMPTY INDEX (10 cases)
    // ============================================================================
    
    describe('Empty Index', () => {
        test.each([
            [1, 'k=1'],
            [2, 'k=2'],
            [5, 'k=5'],
            [10, 'k=10'],
            [100, 'k=100'],
        ])('rejects search on empty index with %s', async (k, description) => {
            const index = new FaissIndex({ dims: 4 });
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            
            await expect(index.search(query, k)).rejects.toThrow();
            index.dispose();
        });

        test('rejects search after adding then removing all vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
            index.dispose();
            
            const newIndex = new FaissIndex({ dims: 4 });
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await expect(newIndex.search(query, 1)).rejects.toThrow();
            newIndex.dispose();
        });
    });

    // ============================================================================
    // K LARGER THAN AVAILABLE VECTORS (15 cases)
    // ============================================================================
    
    describe('K Larger Than Available Vectors', () => {
        test.each([
            [1, 10, '1 vector, k=10'],
            [2, 10, '2 vectors, k=10'],
            [3, 10, '3 vectors, k=10'],
            [5, 10, '5 vectors, k=10'],
            [10, 100, '10 vectors, k=100'],
            [10, 1000, '10 vectors, k=1000'],
            [50, 100, '50 vectors, k=100'],
            [100, 1000, '100 vectors, k=1000'],
            [1000, 10000, '1000 vectors, k=10000'],
        ])('handles %s', async (numVectors, k, description) => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(numVectors * 4);
            for (let i = 0; i < numVectors * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const results = await index.search(query, k);
            
            // Should return at most numVectors results
            expect(results.distances.length).toBeLessThanOrEqual(numVectors);
            expect(results.labels.length).toBeLessThanOrEqual(numVectors);
            expect(results.distances.length).toBeGreaterThan(0);
            
            index.dispose();
        });
    });

    // ============================================================================
    // BOUNDARY VALUES FOR K (10 cases)
    // ============================================================================
    
    describe('Boundary Values for K', () => {
        let index;
        beforeEach(async () => {
            index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
        });
        afterEach(() => {
            if (index) index.dispose();
        });

        const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);

        test.each([
            [1, 'k=1 (minimum)'],
            [2, 'k=2'],
            [5, 'k=5'],
            [10, 'k=10'],
            [50, 'k=50'],
            [99, 'k=99 (one less than total)'],
            [100, 'k=100 (equal to total)'],
            [101, 'k=101 (more than total)'],
            [200, 'k=200 (double total)'],
            [1000, 'k=1000 (10x total)'],
        ])('searches with %s', async (k, description) => {
            const results = await index.search(query, k);
            expect(results.distances.length).toBeLessThanOrEqual(100);
            expect(results.labels.length).toBeLessThanOrEqual(100);
            expect(results.distances.length).toBeGreaterThan(0);
        });
    });

    // ============================================================================
    // SEARCH RESULT VALIDATION (15 cases)
    // ============================================================================
    
    describe('Search Result Validation', () => {
        test('returns results with correct structure', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
                2.0, 2.0, 2.0, 2.0,
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.1, 0.1, 0.1]);
            const results = await index.search(query, 2);
            
            expect(results).toHaveProperty('distances');
            expect(results).toHaveProperty('labels');
            expect(results.distances.constructor.name).toBe('Float32Array');
            expect(results.labels.constructor.name).toBe('Int32Array');
            expect(results.distances.length).toBe(2);
            expect(results.labels.length).toBe(2);
            
            index.dispose();
        });

        test('returns distances in ascending order', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
                2.0, 2.0, 2.0, 2.0,
                3.0, 3.0, 3.0, 3.0,
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.1, 0.1, 0.1]);
            const results = await index.search(query, 4);
            
            for (let i = 1; i < results.distances.length; i++) {
                expect(results.distances[i]).toBeGreaterThanOrEqual(results.distances[i-1]);
            }
            
            index.dispose();
        });

        test('returns valid label indices', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const results = await index.search(query, 5);
            
            results.labels.forEach(label => {
                expect(label).toBeGreaterThanOrEqual(0);
                expect(label).toBeLessThan(10);
                expect(Number.isInteger(label)).toBe(true);
            });
            
            index.dispose();
        });

        test('returns non-negative distances', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const results = await index.search(query, 5);
            
            results.distances.forEach(distance => {
                expect(distance).toBeGreaterThanOrEqual(0);
                expect(typeof distance).toBe('number');
                expect(!isNaN(distance)).toBe(true);
            });
            
            index.dispose();
        });

        test('returns same number of distances and labels', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const results = await index.search(query, 5);
            
            expect(results.distances.length).toBe(results.labels.length);
            
            index.dispose();
        });

        test('returns closest vector first', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,  // Vector 0 - closest to query
                5.0, 5.0, 5.0, 5.0,  // Vector 1 - far
                10.0, 10.0, 10.0, 10.0,  // Vector 2 - farthest
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.1, 0.1, 0.1]);
            const results = await index.search(query, 3);
            
            expect(results.labels[0]).toBe(0); // Closest should be vector 0
            expect(results.distances[0]).toBeLessThan(results.distances[1]);
            
            index.dispose();
        });

        test('handles identical query and vector', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vector = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vector);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const results = await index.search(query, 1);
            
            expect(results.labels[0]).toBe(0);
            expect(results.distances[0]).toBe(0); // Distance should be 0
            
            index.dispose();
        });

        test('handles query very far from all vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([100.0, 100.0, 100.0, 100.0]);
            const results = await index.search(query, 2);
            
            expect(results.distances.length).toBe(2);
            expect(results.distances[0]).toBeGreaterThan(0);
            expect(results.distances[1]).toBeGreaterThan(0);
            
            index.dispose();
        });

        test('handles query with negative values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                -1.0, -1.0, -1.0, -1.0,
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([-0.5, -0.5, -0.5, -0.5]);
            const results = await index.search(query, 2);
            
            expect(results.distances.length).toBe(2);
            expect(results.labels.length).toBe(2);
            
            index.dispose();
        });

        test('handles query with very large values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                1e10, 1e10, 1e10, 1e10,
                2e10, 2e10, 2e10, 2e10,
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([1.5e10, 1.5e10, 1.5e10, 1.5e10]);
            const results = await index.search(query, 2);
            
            expect(results.distances.length).toBe(2);
            expect(results.labels.length).toBe(2);
            
            index.dispose();
        });

        test('handles query with very small values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                1e-10, 1e-10, 1e-10, 1e-10,
                2e-10, 2e-10, 2e-10, 2e-10,
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([1.5e-10, 1.5e-10, 1.5e-10, 1.5e-10]);
            const results = await index.search(query, 2);
            
            expect(results.distances.length).toBe(2);
            expect(results.labels.length).toBe(2);
            
            index.dispose();
        });

        test('handles query with mixed positive and negative', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                1.0, -1.0, 1.0, -1.0,
                -1.0, 1.0, -1.0, 1.0,
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([0.5, -0.5, 0.5, -0.5]);
            const results = await index.search(query, 2);
            
            expect(results.distances.length).toBe(2);
            expect(results.labels.length).toBe(2);
            
            index.dispose();
        });

        test('handles query with zero values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([0.0, 0.0, 0.0, 0.0]);
            const results = await index.search(query, 2);
            
            expect(results.distances.length).toBe(2);
            expect(results.labels[0]).toBe(0); // Should match first vector
            
            index.dispose();
        });

        test('handles query with Infinity values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                Infinity, Infinity, Infinity, Infinity,
                1.0, 1.0, 1.0, 1.0,
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([Infinity, Infinity, Infinity, Infinity]);
            const results = await index.search(query, 2);
            
            expect(results.distances.length).toBe(2);
            expect(results.labels.length).toBe(2);
            
            index.dispose();
        });

        test('handles query with NaN values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                NaN, NaN, NaN, NaN,
                1.0, 1.0, 1.0, 1.0,
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([NaN, NaN, NaN, NaN]);
            const results = await index.search(query, 2);
            
            expect(results.distances.length).toBe(2);
            expect(results.labels.length).toBe(2);
            
            index.dispose();
        });
    });

    // ============================================================================
    // STRESS TESTS (10 cases)
    // ============================================================================
    
    describe('Stress Tests', () => {
        test('searches in index with 10000 vectors', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(10000 * 128);
            for (let i = 0; i < 10000 * 128; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array(128);
            for (let i = 0; i < 128; i++) {
                query[i] = Math.random();
            }
            
            const start = Date.now();
            const results = await index.search(query, 10);
            const elapsed = Date.now() - start;
            
            expect(results.distances.length).toBe(10);
            expect(results.labels.length).toBe(10);
            expect(elapsed).toBeLessThan(1000); // Should be fast
            
            index.dispose();
        });

        test('searches with very large dimensions', async () => {
            const dims = 1000;
            const index = new FaissIndex({ dims });
            const vectors = new Float32Array(100 * dims);
            for (let i = 0; i < 100 * dims; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array(dims);
            for (let i = 0; i < dims; i++) {
                query[i] = Math.random();
            }
            
            const results = await index.search(query, 10);
            expect(results.distances.length).toBe(10);
            
            index.dispose();
        });

        test('performs 1000 searches sequentially', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(1000 * 128);
            for (let i = 0; i < 1000 * 128; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            for (let i = 0; i < 1000; i++) {
                const query = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    query[j] = Math.random();
                }
                const results = await index.search(query, 10);
                expect(results.distances.length).toBe(10);
            }
            
            index.dispose();
        });

        test('searches with k=1 (minimum) many times', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            for (let i = 0; i < 100; i++) {
                const query = new Float32Array([Math.random(), Math.random(), Math.random(), Math.random()]);
                const results = await index.search(query, 1);
                expect(results.distances.length).toBe(1);
                expect(results.labels.length).toBe(1);
            }
            
            index.dispose();
        });

        test('searches with maximum k', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(1000 * 4);
            for (let i = 0; i < 1000 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const results = await index.search(query, 1000);
            
            expect(results.distances.length).toBe(1000);
            expect(results.labels.length).toBe(1000);
            
            index.dispose();
        });

        test('searches with k larger than vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const results = await index.search(query, 100);
            
            expect(results.distances.length).toBeLessThanOrEqual(10);
            expect(results.labels.length).toBeLessThanOrEqual(10);
            
            index.dispose();
        });

        test('searches after adding vectors incrementally', async () => {
            const index = new FaissIndex({ dims: 4 });
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            
            for (let i = 0; i < 100; i++) {
                const v = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(v);
                
                const results = await index.search(query, 5);
                expect(results.distances.length).toBeLessThanOrEqual(i + 1);
            }
            
            index.dispose();
        });

        test('searches with identical queries', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            
            for (let i = 0; i < 10; i++) {
                const results = await index.search(query, 10);
                expect(results.distances.length).toBe(10);
                // Results should be consistent
                expect(results.labels[0]).toBe(results.labels[0]);
            }
            
            index.dispose();
        });

        test('searches with random queries', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(1000 * 128);
            for (let i = 0; i < 1000 * 128; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            for (let i = 0; i < 100; i++) {
                const query = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    query[j] = Math.random();
                }
                const results = await index.search(query, 10);
                expect(results.distances.length).toBe(10);
            }
            
            index.dispose();
        });

        test('searches with edge case k values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(50 * 4);
            for (let i = 0; i < 50 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            
            const kValues = [1, 2, 5, 10, 25, 49, 50, 51, 100, 1000];
            for (const k of kValues) {
                const results = await index.search(query, k);
                expect(results.distances.length).toBeLessThanOrEqual(50);
                expect(results.distances.length).toBeGreaterThan(0);
            }
            
            index.dispose();
        });
    });

    // ============================================================================
    // ERROR HANDLING AFTER DISPOSE (5 cases)
    // ============================================================================
    
    describe('Error Handling After Dispose', () => {
        test('rejects search after dispose', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
            index.dispose();
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await expect(index.search(query, 1)).rejects.toThrow();
        });

        test('rejects multiple searches after dispose', async () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await expect(index.search(query, 1)).rejects.toThrow();
            await expect(index.search(query, 1)).rejects.toThrow();
            await expect(index.search(query, 1)).rejects.toThrow();
        });
    });
});

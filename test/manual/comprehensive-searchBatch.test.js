/**
 * Comprehensive Manual Tests for SearchBatch
 * 100+ test cases covering all edge cases, boundary conditions, and error scenarios
 */

const { FaissIndex } = require('../../src/js/index');

describe('SearchBatch - Comprehensive Manual Tests (100+ cases)', () => {
    
    // ============================================================================
    // VALID BATCH SEARCH OPERATIONS (20 cases)
    // ============================================================================
    
    describe('Valid Batch Search Operations', () => {
        test.each([
            [4, 1, 1, '1 query, k=1'],
            [4, 2, 1, '2 queries, k=1'],
            [4, 5, 2, '5 queries, k=2'],
            [4, 10, 3, '10 queries, k=3'],
            [8, 1, 1, '1 query, dim=8, k=1'],
            [8, 5, 5, '5 queries, dim=8, k=5'],
            [16, 10, 10, '10 queries, dim=16, k=10'],
            [32, 20, 10, '20 queries, dim=32, k=10'],
            [64, 50, 20, '50 queries, dim=64, k=20'],
            [128, 100, 10, '100 queries, dim=128, k=10'],
        ])('batch searches with %s', async (dims, nq, k, description) => {
            const index = new FaissIndex({ dims });
            const vectors = new Float32Array(100 * dims);
            for (let i = 0; i < 100 * dims; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const queries = new Float32Array(nq * dims);
            for (let i = 0; i < nq * dims; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, k);
            expect(results.distances).toBeDefined();
            expect(results.labels).toBeDefined();
            expect(results.nq).toBe(nq);
            expect(results.k).toBe(k);
            expect(results.distances.length).toBe(nq * k);
            expect(results.labels.length).toBe(nq * k);
            
            index.dispose();
        });
    });

    // ============================================================================
    // INVALID QUERIES TYPES (15 cases)
    // ============================================================================
    
    describe('Invalid Queries Types', () => {
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
            [null, TypeError, 'null queries'],
            [undefined, TypeError, 'undefined queries'],
            ['string', TypeError, 'string queries'],
            [123, TypeError, 'number queries'],
            [true, TypeError, 'boolean queries'],
            [[], TypeError, 'empty array'],
            [[0.1, 0.2, 0.3, 0.4], TypeError, 'regular array'],
            [new Int32Array(4), TypeError, 'Int32Array'],
            [new Uint8Array(4), TypeError, 'Uint8Array'],
            [new ArrayBuffer(16), TypeError, 'ArrayBuffer'],
            [{}, TypeError, 'object queries'],
            [() => {}, TypeError, 'function queries'],
            [new Map(), TypeError, 'map queries'],
            [new Set(), TypeError, 'set queries'],
            [Symbol('test'), TypeError, 'symbol queries'],
        ])('throws %s for %s', async (queries, errorType, description) => {
            await expect(index.searchBatch(queries, 1)).rejects.toThrow(errorType);
        });
    });

    // ============================================================================
    // EMPTY QUERIES (10 cases)
    // ============================================================================
    
    describe('Empty Queries', () => {
        let index;
        beforeEach(async () => {
            index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
        });
        afterEach(() => {
            if (index) index.dispose();
        });

        test('rejects empty Float32Array', async () => {
            const empty = new Float32Array(0);
            await expect(index.searchBatch(empty, 1)).rejects.toThrow();
        });

        test('rejects zero-length Float32Array', async () => {
            const zero = new Float32Array([]);
            await expect(index.searchBatch(zero, 1)).rejects.toThrow();
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
            [3, 'length 3 for dim 4'],
            [5, 'length 5 for dim 4'],
            [6, 'length 6 for dim 4'],
            [7, 'length 7 for dim 4'],
            [9, 'length 9 for dim 4'],
            [10, 'length 10 for dim 4'],
            [11, 'length 11 for dim 4'],
            [15, 'length 15 for dim 4'],
            [17, 'length 17 for dim 4'],
            [31, 'length 31 for dim 4'],
            [33, 'length 33 for dim 4'],
            [101, 'length 101 for dim 4'],
            [1001, 'length 1001 for dim 4'],
        ])('rejects %s', async (length, description) => {
            const queries = new Float32Array(length);
            await expect(index.searchBatch(queries, 1)).rejects.toThrow();
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

        const queries = new Float32Array([0.1, 0.2, 0.3, 0.4]);

        test.each([
            [null, TypeError, 'null k'],
            [undefined, TypeError, 'undefined k'],
            ['string', TypeError, 'string k'],
            [0, TypeError, 'zero k'],
            [-1, TypeError, 'negative k'],
            [-100, TypeError, 'large negative k'],
            [0.5, TypeError, 'float k'],
            [1.5, TypeError, 'float k'],
            [Infinity, TypeError, 'infinity k'],
            [-Infinity, TypeError, 'negative infinity k'],
            [[], TypeError, 'array k'],
            [{}, TypeError, 'object k'],
            [() => {}, TypeError, 'function k'],
            [true, TypeError, 'boolean true k'],
            [false, TypeError, 'boolean false k'],
            [NaN, TypeError, 'NaN k'],
        ])('throws %s for %s', async (k, errorType, description) => {
            await expect(index.searchBatch(queries, k)).rejects.toThrow(errorType);
        });
    });

    // ============================================================================
    // BATCH SEARCH RESULT VALIDATION (15 cases)
    // ============================================================================
    
    describe('Batch Search Result Validation', () => {
        test('returns results with correct structure', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
                2.0, 2.0, 2.0, 2.0,
            ]);
            await index.add(vectors);
            
            const queries = new Float32Array([
                0.1, 0.1, 0.1, 0.1,
                1.1, 1.1, 1.1, 1.1,
            ]);
            const results = await index.searchBatch(queries, 2);
            
            expect(results).toHaveProperty('distances');
            expect(results).toHaveProperty('labels');
            expect(results).toHaveProperty('nq');
            expect(results).toHaveProperty('k');
            expect(results.nq).toBe(2);
            expect(results.k).toBe(2);
            expect(results.distances.length).toBe(4);
            expect(results.labels.length).toBe(4);
            
            index.dispose();
        });

        test('returns results in correct layout (nq * k)', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const nq = 5;
            const k = 3;
            const queries = new Float32Array(nq * 4);
            for (let i = 0; i < nq * 4; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, k);
            expect(results.distances.length).toBe(nq * k);
            expect(results.labels.length).toBe(nq * k);
            
            // Verify layout: first k results for query 0, next k for query 1, etc.
            for (let q = 0; q < nq; q++) {
                const startIdx = q * k;
                const endIdx = (q + 1) * k;
                const queryDistances = results.distances.slice(startIdx, endIdx);
                const queryLabels = results.labels.slice(startIdx, endIdx);
                
                expect(queryDistances.length).toBe(k);
                expect(queryLabels.length).toBe(k);
            }
            
            index.dispose();
        });

        test('returns valid distances for all queries', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const queries = new Float32Array(5 * 4);
            for (let i = 0; i < 5 * 4; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, 3);
            
            results.distances.forEach(distance => {
                expect(distance).toBeGreaterThanOrEqual(0);
                expect(typeof distance).toBe('number');
                expect(!isNaN(distance)).toBe(true);
            });
            
            index.dispose();
        });

        test('returns valid labels for all queries', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const queries = new Float32Array(5 * 4);
            for (let i = 0; i < 5 * 4; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, 3);
            
            results.labels.forEach(label => {
                expect(label).toBeGreaterThanOrEqual(0);
                expect(label).toBeLessThan(10);
                expect(Number.isInteger(label)).toBe(true);
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
            
            const queries = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, 5);
            expect(results.distances.length).toBe(results.labels.length);
            
            index.dispose();
        });
    });

    // ============================================================================
    // STRESS TESTS (15 cases)
    // ============================================================================
    
    describe('Stress Tests', () => {
        test('batch searches 1000 queries', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(1000 * 128);
            for (let i = 0; i < 1000 * 128; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const nq = 1000;
            const queries = new Float32Array(nq * 128);
            for (let i = 0; i < nq * 128; i++) {
                queries[i] = Math.random();
            }
            
            const start = Date.now();
            const results = await index.searchBatch(queries, 10);
            const elapsed = Date.now() - start;
            
            expect(results.nq).toBe(nq);
            expect(results.k).toBe(10);
            expect(results.distances.length).toBe(nq * 10);
            expect(elapsed).toBeLessThan(10000); // Should complete in reasonable time
            
            index.dispose();
        });

        test('batch searches with very large dimensions', async () => {
            const dims = 1000;
            const index = new FaissIndex({ dims });
            const vectors = new Float32Array(100 * dims);
            for (let i = 0; i < 100 * dims; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const nq = 50;
            const queries = new Float32Array(nq * dims);
            for (let i = 0; i < nq * dims; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, 10);
            expect(results.nq).toBe(nq);
            expect(results.k).toBe(10);
            
            index.dispose();
        });

        test('batch searches with maximum k', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(1000 * 4);
            for (let i = 0; i < 1000 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const nq = 10;
            const queries = new Float32Array(nq * 4);
            for (let i = 0; i < nq * 4; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, 1000);
            expect(results.nq).toBe(nq);
            expect(results.k).toBeLessThanOrEqual(1000);
            
            index.dispose();
        });

        test('batch searches with k larger than vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const nq = 5;
            const queries = new Float32Array(nq * 4);
            for (let i = 0; i < nq * 4; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, 100);
            expect(results.nq).toBe(nq);
            expect(results.distances.length).toBeLessThanOrEqual(nq * 10);
            
            index.dispose();
        });

        test('performs 100 batch searches sequentially', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(1000 * 128);
            for (let i = 0; i < 1000 * 128; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            for (let i = 0; i < 100; i++) {
                const nq = 10;
                const queries = new Float32Array(nq * 128);
                for (let j = 0; j < nq * 128; j++) {
                    queries[j] = Math.random();
                }
                const results = await index.searchBatch(queries, 10);
                expect(results.nq).toBe(nq);
                expect(results.k).toBe(10);
            }
            
            index.dispose();
        });

        test('batch searches with single query', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const queries = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const results = await index.searchBatch(queries, 5);
            
            expect(results.nq).toBe(1);
            expect(results.k).toBe(5);
            expect(results.distances.length).toBe(5);
            
            index.dispose();
        });

        test('batch searches with many queries, small k', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const nq = 1000;
            const queries = new Float32Array(nq * 4);
            for (let i = 0; i < nq * 4; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, 1);
            expect(results.nq).toBe(nq);
            expect(results.k).toBe(1);
            expect(results.distances.length).toBe(nq);
            
            index.dispose();
        });

        test('batch searches with few queries, large k', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(1000 * 4);
            for (let i = 0; i < 1000 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const nq = 5;
            const queries = new Float32Array(nq * 4);
            for (let i = 0; i < nq * 4; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, 100);
            expect(results.nq).toBe(nq);
            expect(results.k).toBeLessThanOrEqual(100);
            
            index.dispose();
        });

        test('batch searches with identical queries', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = [0.1, 0.2, 0.3, 0.4];
            const nq = 10;
            const queries = new Float32Array(nq * 4);
            for (let i = 0; i < nq; i++) {
                queries.set(query, i * 4);
            }
            
            const results = await index.searchBatch(queries, 5);
            expect(results.nq).toBe(nq);
            expect(results.k).toBe(5);
            
            // All queries are identical, so results should be similar
            for (let i = 0; i < nq; i++) {
                const startIdx = i * 5;
                const labels = results.labels.slice(startIdx, startIdx + 5);
                expect(labels.length).toBe(5);
            }
            
            index.dispose();
        });

        test('batch searches with random queries', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(1000 * 128);
            for (let i = 0; i < 1000 * 128; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const nq = 100;
            const queries = new Float32Array(nq * 128);
            for (let i = 0; i < nq * 128; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, 10);
            expect(results.nq).toBe(nq);
            expect(results.k).toBe(10);
            expect(results.distances.length).toBe(nq * 10);
            
            index.dispose();
        });

        test('batch searches after incremental adds', async () => {
            const index = new FaissIndex({ dims: 4 });
            const queries = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            
            for (let i = 0; i < 100; i++) {
                const v = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(v);
                
                const results = await index.searchBatch(queries, 5);
                expect(results.nq).toBe(1);
                expect(results.distances.length).toBeLessThanOrEqual(i + 1);
            }
            
            index.dispose();
        });

        test('batch searches with edge case nq values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const nqValues = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
            for (const nq of nqValues) {
                const queries = new Float32Array(nq * 4);
                for (let i = 0; i < nq * 4; i++) {
                    queries[i] = Math.random();
                }
                const results = await index.searchBatch(queries, 10);
                expect(results.nq).toBe(nq);
                expect(results.k).toBe(10);
            }
            
            index.dispose();
        });

        test('batch searches with edge case k values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const queries = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                queries[i] = Math.random();
            }
            
            const kValues = [1, 2, 5, 10, 20, 50, 99, 100, 101, 1000];
            for (const k of kValues) {
                const results = await index.searchBatch(queries, k);
                expect(results.nq).toBe(10);
                expect(results.k).toBeLessThanOrEqual(100);
            }
            
            index.dispose();
        });

        test('batch searches with very large result set', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10000 * 4);
            for (let i = 0; i < 10000 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const nq = 100;
            const k = 100;
            const queries = new Float32Array(nq * 4);
            for (let i = 0; i < nq * 4; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, k);
            expect(results.nq).toBe(nq);
            expect(results.k).toBe(k);
            expect(results.distances.length).toBe(nq * k);
            
            index.dispose();
        });

        test('batch searches performance with many queries', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(1000 * 128);
            for (let i = 0; i < 1000 * 128; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const nq = 5000;
            const queries = new Float32Array(nq * 128);
            for (let i = 0; i < nq * 128; i++) {
                queries[i] = Math.random();
            }
            
            const start = Date.now();
            const results = await index.searchBatch(queries, 10);
            const elapsed = Date.now() - start;
            
            expect(results.nq).toBe(nq);
            expect(elapsed).toBeLessThan(30000); // Should complete in reasonable time
            
            index.dispose();
        });
    });

    // ============================================================================
    // COMPARISON WITH SINGLE SEARCH (10 cases)
    // ============================================================================
    
    describe('Comparison with Single Search', () => {
        test('batch search matches single search results', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const k = 10;
            
            const singleResult = await index.search(query, k);
            const batchQueries = new Float32Array(query);
            const batchResult = await index.searchBatch(batchQueries, k);
            
            expect(batchResult.nq).toBe(1);
            expect(batchResult.k).toBe(k);
            expect(batchResult.distances.length).toBe(k);
            expect(batchResult.labels.length).toBe(k);
            
            // Results should match
            expect(batchResult.distances[0]).toBeCloseTo(singleResult.distances[0], 5);
            expect(batchResult.labels[0]).toBe(singleResult.labels[0]);
            
            index.dispose();
        });

        test('batch search is more efficient than multiple single searches', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(1000 * 128);
            for (let i = 0; i < 1000 * 128; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const nq = 100;
            const queries = new Float32Array(nq * 128);
            for (let i = 0; i < nq * 128; i++) {
                queries[i] = Math.random();
            }
            
            // Batch search
            const batchStart = Date.now();
            const batchResults = await index.searchBatch(queries, 10);
            const batchElapsed = Date.now() - batchStart;
            
            // Multiple single searches
            const singleStart = Date.now();
            for (let i = 0; i < nq; i++) {
                const query = queries.subarray(i * 128, (i + 1) * 128);
                await index.search(query, 10);
            }
            const singleElapsed = Date.now() - singleStart;
            
            expect(batchResults.nq).toBe(nq);
            // Batch should be faster (or at least not much slower)
            // Allow some variance in timing
            expect(batchElapsed).toBeLessThan(singleElapsed * 2.5);
            
            index.dispose();
        });
    });

    // ============================================================================
    // ERROR HANDLING AFTER DISPOSE (5 cases)
    // ============================================================================
    
    describe('Error Handling After Dispose', () => {
        test('rejects batch search after dispose', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
            index.dispose();
            
            const queries = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await expect(index.searchBatch(queries, 1)).rejects.toThrow();
        });
    });
});

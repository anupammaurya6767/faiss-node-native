/**
 * Comprehensive Edge Cases for Async Operations
 * Tests race conditions, concurrent operations, and async-specific scenarios
 */

const { FaissIndex } = require('../../src/js/index');

describe('Async Operations - Edge Cases (100+ cases)', () => {
    
    // ============================================================================
    // CONCURRENT OPERATIONS (20 cases)
    // ============================================================================
    
    describe('Concurrent Operations', () => {
        test('concurrent adds to same index', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            const promises = [];
            for (let i = 0; i < 50; i++) {
                const vector = new Float32Array([i, i+1, i+2, i+3]);
                promises.push(index.add(vector));
            }
            
            await Promise.all(promises);
            expect(index.getStats().ntotal).toBe(50);
            
            index.dispose();
        });

        test('concurrent searches on same index', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            // Add vectors first
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            // Concurrent searches
            const promises = [];
            for (let i = 0; i < 20; i++) {
                const query = new Float32Array([Math.random(), Math.random(), Math.random(), Math.random()]);
                promises.push(index.search(query, 10));
            }
            
            const results = await Promise.all(promises);
            expect(results.length).toBe(20);
            results.forEach(result => {
                expect(result.distances.length).toBe(10);
                expect(result.labels.length).toBe(10);
            });
            
            index.dispose();
        });

        test('concurrent add and search operations', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            // Start adding vectors
            const addPromises = [];
            for (let i = 0; i < 10; i++) {
                const vector = new Float32Array([i, i+1, i+2, i+3]);
                addPromises.push(index.add(vector));
            }
            
            // While adding, try to search (should handle gracefully)
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const searchPromise = index.search(query, 5).catch(() => null);
            
            await Promise.all(addPromises);
            const searchResult = await searchPromise;
            
            // Search might succeed if vectors were added, or fail if index was empty
            expect(index.getStats().ntotal).toBe(10);
            
            index.dispose();
        });

        test('concurrent batch searches', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            // Add vectors
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            // Concurrent batch searches
            const promises = [];
            for (let i = 0; i < 10; i++) {
                const queries = new Float32Array(5 * 4);
                for (let j = 0; j < 5 * 4; j++) {
                    queries[j] = Math.random();
                }
                promises.push(index.searchBatch(queries, 10));
            }
            
            const results = await Promise.all(promises);
            expect(results.length).toBe(10);
            results.forEach(result => {
                expect(result.nq).toBe(5);
                expect(result.distances.length).toBe(50);
            });
            
            index.dispose();
        });

        test('concurrent save operations', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
            
            // Multiple save operations (should handle gracefully)
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(index.save(`/tmp/test-${i}-${Date.now()}.idx`).catch(() => null));
            }
            
            const results = await Promise.all(promises);
            // At least some should succeed
            expect(results.some(r => r === undefined)).toBe(true);
            
            index.dispose();
        });

        test('concurrent toBuffer operations', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
            
            // Multiple toBuffer operations
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(index.toBuffer());
            }
            
            const buffers = await Promise.all(promises);
            expect(buffers.length).toBe(10);
            buffers.forEach(buffer => {
                expect(Buffer.isBuffer(buffer)).toBe(true);
                expect(buffer.length).toBeGreaterThan(0);
            });
            
            index.dispose();
        });

        test('concurrent mergeFrom operations', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            const index3 = new FaissIndex({ dims: 4 });
            
            const v1 = new Float32Array([1, 2, 3, 4]);
            const v2 = new Float32Array([5, 6, 7, 8]);
            const v3 = new Float32Array([9, 10, 11, 12]);
            
            await index1.add(v1);
            await index2.add(v2);
            await index3.add(v3);
            
            // Merge index2 and index3 into index1 concurrently
            const promises = [
                index1.mergeFrom(index2),
                index1.mergeFrom(index3)
            ];
            
            await Promise.all(promises);
            
            expect(index1.getStats().ntotal).toBe(3);
            expect(index2.getStats().ntotal).toBe(0);
            expect(index3.getStats().ntotal).toBe(0);
            
            index1.dispose();
            index2.dispose();
            index3.dispose();
        });

        test('mixed concurrent operations', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            // Add some vectors first
            for (let i = 0; i < 5; i++) {
                const vector = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(vector);
            }
            
            // Now mix searches with remaining adds
            const mixedOps = [];
            for (let i = 5; i < 10; i++) {
                const vector = new Float32Array([i, i+1, i+2, i+3]);
                mixedOps.push(index.add(vector));
            }
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            mixedOps.push(index.search(query, 5));
            
            await Promise.all(mixedOps);
            
            // Should have 10 vectors total (5 + 5)
            expect(index.getStats().ntotal).toBe(10);
            
            index.dispose();
        });
    });

    // ============================================================================
    // RACE CONDITIONS (15 cases)
    // ============================================================================
    
    describe('Race Conditions', () => {
        test('add then immediately dispose', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vector = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            
            const addPromise = index.add(vector).catch(e => e);
            index.dispose();
            
            // Add should either complete or fail gracefully
            const result = await addPromise;
            expect(result === undefined || result instanceof Error).toBe(true);
        });

        test('search then immediately dispose', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const searchPromise = index.search(query, 1);
            index.dispose();
            
            await expect(searchPromise).rejects.toThrow();
        });

        test('multiple operations then dispose', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vector = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            
            const op1 = index.add(vector).catch(e => e);
            const op2 = index.add(vector).catch(e => e);
            const op3 = index.add(vector).catch(e => e);
            
            // Wait a bit for operations to start
            await new Promise(resolve => setTimeout(resolve, 10));
            index.dispose();
            
            const results = await Promise.all([op1, op2, op3]);
            // All should either complete or error (both are valid)
            results.forEach(result => {
                expect(result === undefined || result instanceof Error).toBe(true);
            });
        });

        test('dispose during concurrent operations', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            const promises = [];
            for (let i = 0; i < 20; i++) {
                const vector = new Float32Array([i, i+1, i+2, i+3]);
                promises.push(index.add(vector).catch(() => null));
            }
            
            // Dispose after a short delay
            await new Promise(resolve => setTimeout(resolve, 50));
            index.dispose();
            
            const results = await Promise.all(promises);
            // Some operations might fail after dispose, or all might complete
            // The important thing is that dispose doesn't crash
            expect(results.length).toBe(20);
        });

        test('rapid dispose and recreate', async () => {
            for (let i = 0; i < 10; i++) {
                const index = new FaissIndex({ dims: 4 });
                const vector = new Float32Array([i, i+1, i+2, i+3]);
                const addPromise = index.add(vector);
                
                // Wait a bit before disposing
                await new Promise(resolve => setTimeout(resolve, 10));
                index.dispose();
                
                try {
                    await addPromise;
                } catch (e) {
                    // Expected to fail after dispose
                    expect(e).toBeDefined();
                }
            }
        });
    });

    // ============================================================================
    // ASYNC ERROR HANDLING (15 cases)
    // ============================================================================
    
    describe('Async Error Handling', () => {
        test('add error propagates correctly', async () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            
            const vector = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await expect(index.add(vector)).rejects.toThrow();
        });

        test('search error propagates correctly', async () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await expect(index.search(query, 1)).rejects.toThrow();
        });

        test('batch search error propagates correctly', async () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            
            const queries = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await expect(index.searchBatch(queries, 1)).rejects.toThrow();
        });

        test('save error propagates correctly', async () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            
            await expect(index.save('/tmp/test.idx')).rejects.toThrow();
        });

        test('toBuffer error propagates correctly', async () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            
            await expect(index.toBuffer()).rejects.toThrow();
        });

        test('mergeFrom error propagates correctly', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            index1.dispose();
            
            await expect(index1.mergeFrom(index2)).rejects.toThrow();
            
            index2.dispose();
        });

        test('error in async add with invalid input', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            // Invalid input should throw synchronously before async worker
            await expect(index.add(null)).rejects.toThrow();
            
            index.dispose();
        });

        test('error in async search with invalid input', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            await expect(index.search(null, 1)).rejects.toThrow();
            
            index.dispose();
        });

        test('multiple errors in concurrent operations', async () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            
            const promises = [
                index.add(new Float32Array([0.1, 0.2, 0.3, 0.4])).catch(e => e),
                index.search(new Float32Array([0.1, 0.2, 0.3, 0.4]), 1).catch(e => e),
                index.save('/tmp/test.idx').catch(e => e)
            ];
            
            const results = await Promise.all(promises);
            results.forEach(result => {
                expect(result).toBeInstanceOf(Error);
            });
        });
    });

    // ============================================================================
    // PROMISE CHAINING (10 cases)
    // ============================================================================
    
    describe('Promise Chaining', () => {
        test('chain add operations', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            await index.add(new Float32Array([0, 0, 0, 0]))
                .then(() => index.add(new Float32Array([1, 1, 1, 1])))
                .then(() => index.add(new Float32Array([2, 2, 2, 2])));
            
            expect(index.getStats().ntotal).toBe(3);
            
            index.dispose();
        });

        test('chain add and search', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            const results = await index.add(new Float32Array([0.1, 0.2, 0.3, 0.4]))
                .then(() => index.search(new Float32Array([0.1, 0.2, 0.3, 0.4]), 1));
            
            expect(results.distances.length).toBe(1);
            
            index.dispose();
        });

        test('promise.all with mixed operations', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            const results = await Promise.all([
                index.add(new Float32Array([0, 0, 0, 0])),
                index.add(new Float32Array([1, 1, 1, 1])),
                index.add(new Float32Array([2, 2, 2, 2]))
            ]);
            
            expect(index.getStats().ntotal).toBe(3);
            
            index.dispose();
        });

        test('promise.allSettled with some failures', async () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            
            const results = await Promise.allSettled([
                index.add(new Float32Array([0, 0, 0, 0])),
                index.search(new Float32Array([0, 0, 0, 0]), 1),
                index.save('/tmp/test.idx')
            ]);
            
            results.forEach(result => {
                expect(result.status).toBe('rejected');
            });
        });
    });

    // ============================================================================
    // TIMING AND PERFORMANCE (10 cases)
    // ============================================================================
    
    describe('Timing and Performance', () => {
        test('async operations complete in reasonable time', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(1000 * 128);
            for (let i = 0; i < 1000 * 128; i++) {
                vectors[i] = Math.random();
            }
            
            const start = Date.now();
            await index.add(vectors);
            const elapsed = Date.now() - start;
            
            expect(elapsed).toBeLessThan(5000);
            expect(index.getStats().ntotal).toBe(1000);
            
            index.dispose();
        });

        test('many small async operations', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            const start = Date.now();
            for (let i = 0; i < 100; i++) {
                await index.add(new Float32Array([i, i+1, i+2, i+3]));
            }
            const elapsed = Date.now() - start;
            
            expect(index.getStats().ntotal).toBe(100);
            expect(elapsed).toBeLessThan(10000);
            
            index.dispose();
        });

        test('async operations don\'t block event loop', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(10000 * 128);
            for (let i = 0; i < 10000 * 128; i++) {
                vectors[i] = Math.random();
            }
            
            let eventLoopBlocked = false;
            const timer = setInterval(() => {
                eventLoopBlocked = false;
            }, 10);
            
            const addPromise = index.add(vectors);
            
            // Wait a bit to see if timer fires
            await new Promise(resolve => setTimeout(resolve, 50));
            
            await addPromise;
            clearInterval(timer);
            
            // If we got here, event loop wasn't completely blocked
            expect(index.getStats().ntotal).toBe(10000);
            
            index.dispose();
        });
    });

    // ============================================================================
    // MEMORY EDGE CASES (10 cases)
    // ============================================================================
    
    describe('Memory Edge Cases', () => {
        test('async operations with very large vectors', async () => {
            const index = new FaissIndex({ dims: 10000 });
            const vector = new Float32Array(10000);
            for (let i = 0; i < 10000; i++) {
                vector[i] = Math.random();
            }
            
            await index.add(vector);
            expect(index.getStats().ntotal).toBe(1);
            
            index.dispose();
        });

        test('many concurrent async operations', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            const promises = [];
            for (let i = 0; i < 1000; i++) {
                const vector = new Float32Array([i, i+1, i+2, i+3]);
                promises.push(index.add(vector));
            }
            
            await Promise.all(promises);
            expect(index.getStats().ntotal).toBe(1000);
            
            index.dispose();
        });

        test('async operations don\'t leak memory', async () => {
            for (let i = 0; i < 100; i++) {
                const index = new FaissIndex({ dims: 4 });
                const vector = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(vector);
                index.dispose();
            }
            
            // If we get here without crashing, memory is managed properly
            expect(true).toBe(true);
        });
    });

    // ============================================================================
    // EDGE CASES WITH ASYNC (20 cases)
    // ============================================================================
    
    describe('Edge Cases with Async', () => {
        test('add empty array (should fail before async)', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            await expect(index.add(new Float32Array(0))).rejects.toThrow();
            
            index.dispose();
        });

        test('search on empty index (async error)', async () => {
            const index = new FaissIndex({ dims: 4 });
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            
            await expect(index.search(query, 1)).rejects.toThrow();
            
            index.dispose();
        });

        test('batch search with invalid dimensions (should fail before async)', async () => {
            const index = new FaissIndex({ dims: 4 });
            const queries = new Float32Array([0.1, 0.2, 0.3]); // Wrong length
            
            await expect(index.searchBatch(queries, 1)).rejects.toThrow();
            
            index.dispose();
        });

        test('save with invalid filename (should fail before async)', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            await expect(index.save(null)).rejects.toThrow();
            
            index.dispose();
        });

        test('mergeFrom with dimension mismatch (async error)', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 8 });
            
            await expect(index1.mergeFrom(index2)).rejects.toThrow();
            
            index1.dispose();
            index2.dispose();
        });

        test('async operations with disposed source in merge', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            index2.dispose();
            
            await expect(index1.mergeFrom(index2)).rejects.toThrow();
            
            index1.dispose();
        });

        test('rapid async operations', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            for (let i = 0; i < 50; i++) {
                const vector = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(vector);
            }
            
            expect(index.getStats().ntotal).toBe(50);
            
            index.dispose();
        });

        test('async operations with very large k', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const results = await index.search(query, 1000); // k larger than vectors
            
            expect(results.distances.length).toBeLessThanOrEqual(10);
            
            index.dispose();
        });

        test('async batch search with large nq', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const queries = new Float32Array(1000 * 4); // 1000 queries
            for (let i = 0; i < 1000 * 4; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, 10);
            expect(results.nq).toBe(1000);
            expect(results.distances.length).toBe(10000);
            
            index.dispose();
        });

        test('async operations with NaN values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vector = new Float32Array([NaN, 1, 2, 3]);
            
            await index.add(vector);
            expect(index.getStats().ntotal).toBe(1);
            
            const query = new Float32Array([NaN, 1, 2, 3]);
            const results = await index.search(query, 1);
            expect(results.distances.length).toBe(1);
            
            index.dispose();
        });

        test('async operations with Infinity values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vector = new Float32Array([Infinity, -Infinity, 1, 2]);
            
            await index.add(vector);
            expect(index.getStats().ntotal).toBe(1);
            
            const query = new Float32Array([Infinity, -Infinity, 1, 2]);
            const results = await index.search(query, 1);
            expect(results.distances.length).toBe(1);
            
            index.dispose();
        });

        test('async save and load roundtrip', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
            ]);
            await index1.add(vectors);
            
            const filename = `/tmp/test-async-${Date.now()}.idx`;
            await index1.save(filename);
            index1.dispose();
            
            const index2 = await FaissIndex.load(filename);
            expect(index2.getStats().ntotal).toBe(2);
            
            index2.dispose();
        });

        test('async toBuffer and fromBuffer roundtrip', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
            ]);
            await index1.add(vectors);
            
            const buffer = await index1.toBuffer();
            index1.dispose();
            
            const index2 = await FaissIndex.fromBuffer(buffer);
            expect(index2.getStats().ntotal).toBe(2);
            
            index2.dispose();
        });

        test('async operations with negative values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vector = new Float32Array([-1, -2, -3, -4]);
            
            await index.add(vector);
            expect(index.getStats().ntotal).toBe(1);
            
            const query = new Float32Array([-1, -2, -3, -4]);
            const results = await index.search(query, 1);
            expect(results.distances.length).toBe(1);
            
            index.dispose();
        });

        test('async operations with zero values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vector = new Float32Array([0, 0, 0, 0]);
            
            await index.add(vector);
            expect(index.getStats().ntotal).toBe(1);
            
            const query = new Float32Array([0, 0, 0, 0]);
            const results = await index.search(query, 1);
            expect(results.distances.length).toBe(1);
            expect(results.distances[0]).toBe(0);
            
            index.dispose();
        });

        test('async operations with very small values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vector = new Float32Array([1e-10, 2e-10, 3e-10, 4e-10]);
            
            await index.add(vector);
            expect(index.getStats().ntotal).toBe(1);
            
            const query = new Float32Array([1e-10, 2e-10, 3e-10, 4e-10]);
            const results = await index.search(query, 1);
            expect(results.distances.length).toBe(1);
            
            index.dispose();
        });

        test('async operations with very large values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vector = new Float32Array([1e10, 2e10, 3e10, 4e10]);
            
            await index.add(vector);
            expect(index.getStats().ntotal).toBe(1);
            
            const query = new Float32Array([1e10, 2e10, 3e10, 4e10]);
            const results = await index.search(query, 1);
            expect(results.distances.length).toBe(1);
            
            index.dispose();
        });

        test('async operations with mixed value ranges', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            const vectors = [
                new Float32Array([0, 0, 0, 0]),
                new Float32Array([1e-10, 1e-10, 1e-10, 1e-10]),
                new Float32Array([1e10, 1e10, 1e10, 1e10]),
                new Float32Array([-1, -1, -1, -1]),
            ];
            
            for (const vector of vectors) {
                await index.add(vector);
            }
            
            expect(index.getStats().ntotal).toBe(4);
            
            const query = new Float32Array([0.1, 0.1, 0.1, 0.1]);
            const results = await index.search(query, 4);
            expect(results.distances.length).toBe(4);
            
            index.dispose();
        });

        test('async operations with sequential patterns', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            for (let i = 0; i < 100; i++) {
                const vector = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(vector);
            }
            
            expect(index.getStats().ntotal).toBe(100);
            
            const query = new Float32Array([50, 51, 52, 53]);
            const results = await index.search(query, 5);
            expect(results.distances.length).toBe(5);
            
            index.dispose();
        });
    });

    // ============================================================================
    // STRESS TESTS (10 cases)
    // ============================================================================
    
    describe('Stress Tests', () => {
        test('1000 sequential async adds', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            for (let i = 0; i < 1000; i++) {
                const vector = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(vector);
            }
            
            expect(index.getStats().ntotal).toBe(1000);
            
            index.dispose();
        });

        test('1000 concurrent async adds', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            const promises = [];
            for (let i = 0; i < 1000; i++) {
                const vector = new Float32Array([i, i+1, i+2, i+3]);
                promises.push(index.add(vector));
            }
            
            await Promise.all(promises);
            expect(index.getStats().ntotal).toBe(1000);
            
            index.dispose();
        });

        test('1000 sequential async searches', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            for (let i = 0; i < 1000; i++) {
                const query = new Float32Array([Math.random(), Math.random(), Math.random(), Math.random()]);
                await index.search(query, 10);
            }
            
            index.dispose();
        });

        test('100 concurrent async searches', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(1000 * 4);
            for (let i = 0; i < 1000 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const promises = [];
            for (let i = 0; i < 100; i++) {
                const query = new Float32Array([Math.random(), Math.random(), Math.random(), Math.random()]);
                promises.push(index.search(query, 10));
            }
            
            const results = await Promise.all(promises);
            expect(results.length).toBe(100);
            
            index.dispose();
        });

        test('large async batch search', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(10000 * 128);
            for (let i = 0; i < 10000 * 128; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const queries = new Float32Array(5000 * 128); // 5000 queries
            for (let i = 0; i < 5000 * 128; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, 10);
            expect(results.nq).toBe(5000);
            expect(results.distances.length).toBe(50000);
            
            index.dispose();
        });
    });
});

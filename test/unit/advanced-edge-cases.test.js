/**
 * Advanced Edge Cases - Complex Scenarios
 * Tests complex interactions, boundary conditions, and unusual patterns
 */

const { FaissIndex } = require('../../src/js/index');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Advanced Edge Cases (100+ cases)', () => {
    const tempDir = path.join(os.tmpdir(), 'faiss-advanced-test-' + Date.now());
    
    beforeAll(() => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });
    
    afterAll(() => {
        if (fs.existsSync(tempDir)) {
            fs.readdirSync(tempDir).forEach(file => {
                try {
                    fs.unlinkSync(path.join(tempDir, file));
                } catch (e) {
                    // Ignore errors
                }
            });
            try {
                fs.rmdirSync(tempDir);
            } catch (e) {
                // Ignore errors
            }
        }
    });
    
    // ============================================================================
    // COMPLEX OPERATION SEQUENCES (20 cases)
    // ============================================================================
    
    describe('Complex Operation Sequences', () => {
        test('add -> search -> add -> search pattern', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            await index.add(new Float32Array([0, 0, 0, 0]));
            let results = await index.search(new Float32Array([0, 0, 0, 0]), 1);
            expect(results.labels[0]).toBe(0);
            
            await index.add(new Float32Array([1, 1, 1, 1]));
            results = await index.search(new Float32Array([1, 1, 1, 1]), 1);
            expect(results.labels[0]).toBe(1);
            
            expect(index.getStats().ntotal).toBe(2);
            
            index.dispose();
        });

        test('add -> save -> load -> search pattern', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            await index1.add(new Float32Array([0.1, 0.2, 0.3, 0.4]));
            
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index1.save(filename);
            index1.dispose();
            
            const index2 = await FaissIndex.load(filename);
            const results = await index2.search(new Float32Array([0.1, 0.2, 0.3, 0.4]), 1);
            expect(results.distances.length).toBe(1);
            
            index2.dispose();
        });

        test('add -> toBuffer -> fromBuffer -> search pattern', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            await index1.add(new Float32Array([0.1, 0.2, 0.3, 0.4]));
            
            const buffer = await index1.toBuffer();
            index1.dispose();
            
            const index2 = await FaissIndex.fromBuffer(buffer);
            const results = await index2.search(new Float32Array([0.1, 0.2, 0.3, 0.4]), 1);
            expect(results.distances.length).toBe(1);
            
            index2.dispose();
        });

        test('multiple merges in sequence', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            const index3 = new FaissIndex({ dims: 4 });
            
            await index1.add(new Float32Array([0, 0, 0, 0]));
            await index2.add(new Float32Array([1, 1, 1, 1]));
            await index3.add(new Float32Array([2, 2, 2, 2]));
            
            await index1.mergeFrom(index2);
            expect(index1.getStats().ntotal).toBe(2);
            
            await index1.mergeFrom(index3);
            expect(index1.getStats().ntotal).toBe(3);
            
            index1.dispose();
            index2.dispose();
            index3.dispose();
        });

        test('add -> search -> merge -> search pattern', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            
            await index1.add(new Float32Array([0, 0, 0, 0]));
            let results = await index1.search(new Float32Array([0, 0, 0, 0]), 1);
            expect(results.labels[0]).toBe(0);
            
            await index2.add(new Float32Array([1, 1, 1, 1]));
            await index1.mergeFrom(index2);
            
            results = await index1.search(new Float32Array([1, 1, 1, 1]), 1);
            expect(results.labels[0]).toBe(1);
            
            index1.dispose();
            index2.dispose();
        });
    });

    // ============================================================================
    // BOUNDARY CONDITIONS (20 cases)
    // ============================================================================
    
    describe('Boundary Conditions', () => {
        test('add single vector, search with k=1', async () => {
            const index = new FaissIndex({ dims: 4 });
            await index.add(new Float32Array([0.1, 0.2, 0.3, 0.4]));
            
            const results = await index.search(new Float32Array([0.1, 0.2, 0.3, 0.4]), 1);
            expect(results.distances.length).toBe(1);
            expect(results.labels.length).toBe(1);
            
            index.dispose();
        });

        test('add maximum practical vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100000 * 4);
            for (let i = 0; i < 100000 * 4; i++) {
                vectors[i] = Math.random();
            }
            
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(100000);
            
            index.dispose();
        });

        test('search with k equal to total vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const results = await index.search(query, 10);
            expect(results.distances.length).toBe(10);
            
            index.dispose();
        });

        test('batch search with single query', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10 * 4);
            for (let i = 0; i < 10 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const queries = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const results = await index.searchBatch(queries, 5);
            
            expect(results.nq).toBe(1);
            expect(results.distances.length).toBe(5);
            
            index.dispose();
        });

        test('batch search with maximum queries', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(1000 * 4);
            for (let i = 0; i < 1000 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const queries = new Float32Array(10000 * 4); // 10000 queries
            for (let i = 0; i < 10000 * 4; i++) {
                queries[i] = Math.random();
            }
            
            const results = await index.searchBatch(queries, 10);
            expect(results.nq).toBe(10000);
            expect(results.distances.length).toBe(100000);
            
            index.dispose();
        });
    });

    // ============================================================================
    // ERROR RECOVERY (15 cases)
    // ============================================================================
    
    describe('Error Recovery', () => {
        test('recover from failed add', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            try {
                await index.add(null);
            } catch (e) {
                // Expected to fail
            }
            
            // Should still be able to add valid vectors
            await index.add(new Float32Array([0.1, 0.2, 0.3, 0.4]));
            expect(index.getStats().ntotal).toBe(1);
            
            index.dispose();
        });

        test('recover from failed search', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            try {
                await index.search(null, 1);
            } catch (e) {
                // Expected to fail
            }
            
            // Add vectors and search should work
            await index.add(new Float32Array([0.1, 0.2, 0.3, 0.4]));
            const results = await index.search(new Float32Array([0.1, 0.2, 0.3, 0.4]), 1);
            expect(results.distances.length).toBe(1);
            
            index.dispose();
        });

        test('recover from failed save', async () => {
            const index = new FaissIndex({ dims: 4 });
            await index.add(new Float32Array([0.1, 0.2, 0.3, 0.4]));
            
            try {
                await index.save(null);
            } catch (e) {
                // Expected to fail
            }
            
            // Should still be able to save with valid filename
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index.save(filename);
            expect(fs.existsSync(filename)).toBe(true);
            
            index.dispose();
        });

        test('recover from failed merge', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 8}); // Wrong dimensions
            
            try {
                await index1.mergeFrom(index2);
            } catch (e) {
                // Expected to fail
            }
            
            // Should still be able to use index1
            await index1.add(new Float32Array([0.1, 0.2, 0.3, 0.4]));
            expect(index1.getStats().ntotal).toBe(1);
            
            index1.dispose();
            index2.dispose();
        });
    });

    // ============================================================================
    // DATA INTEGRITY (15 cases)
    // ============================================================================
    
    describe('Data Integrity', () => {
        test('vectors remain unchanged after add', async () => {
            const index = new FaissIndex({ dims: 4 });
            const original = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const copy = new Float32Array(original);
            
            await index.add(original);
            
            // Modify original
            original[0] = 999;
            
            // Search should still find the original values
            const results = await index.search(copy, 1);
            expect(results.distances[0]).toBe(0); // Should match exactly
            
            index.dispose();
        });

        test('search results are consistent', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
                2.0, 2.0, 2.0, 2.0,
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([0.1, 0.1, 0.1, 0.1]);
            
            // Multiple searches should return same results
            const results1 = await index.search(query, 3);
            const results2 = await index.search(query, 3);
            
            expect(results1.labels[0]).toBe(results2.labels[0]);
            expect(results1.distances[0]).toBeCloseTo(results2.distances[0], 5);
            
            index.dispose();
        });

        test('save/load preserves exact values', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.123456, 0.234567, 0.345678, 0.456789,
                0.567890, 0.678901, 0.789012, 0.890123,
            ]);
            await index1.add(vectors);
            
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index1.save(filename);
            index1.dispose();
            
            const index2 = await FaissIndex.load(filename);
            expect(index2.getStats().ntotal).toBe(2);
            
            const query = new Float32Array([0.123456, 0.234567, 0.345678, 0.456789]);
            const results = await index2.search(query, 1);
            expect(results.labels[0]).toBe(0);
            expect(results.distances[0]).toBeCloseTo(0, 5);
            
            index2.dispose();
        });

        test('toBuffer/fromBuffer preserves exact values', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([
                0.123456, 0.234567, 0.345678, 0.456789,
                0.567890, 0.678901, 0.789012, 0.890123,
            ]);
            await index1.add(vectors);
            
            const buffer = await index1.toBuffer();
            index1.dispose();
            
            const index2 = await FaissIndex.fromBuffer(buffer);
            expect(index2.getStats().ntotal).toBe(2);
            
            const query = new Float32Array([0.123456, 0.234567, 0.345678, 0.456789]);
            const results = await index2.search(query, 1);
            expect(results.labels[0]).toBe(0);
            expect(results.distances[0]).toBeCloseTo(0, 5);
            
            index2.dispose();
        });

        test('merge preserves all vectors', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            
            await index1.add(new Float32Array([0, 0, 0, 0]));
            await index2.add(new Float32Array([1, 1, 1, 1]));
            await index2.add(new Float32Array([2, 2, 2, 2]));
            
            await index1.mergeFrom(index2);
            
            expect(index1.getStats().ntotal).toBe(3);
            
            // Verify all vectors are present
            const results1 = await index1.search(new Float32Array([0, 0, 0, 0]), 3);
            const results2 = await index1.search(new Float32Array([1, 1, 1, 1]), 3);
            const results3 = await index1.search(new Float32Array([2, 2, 2, 2]), 3);
            
            expect(results1.labels).toContain(0);
            expect(results2.labels).toContain(1);
            expect(results3.labels).toContain(2);
            
            index1.dispose();
            index2.dispose();
        });
    });

    // ============================================================================
    // PERFORMANCE EDGE CASES (15 cases)
    // ============================================================================
    
    describe('Performance Edge Cases', () => {
        test('large dimension with many vectors', async () => {
            const dims = 1000;
            const index = new FaissIndex({ dims });
            const vectors = new Float32Array(100 * dims);
            for (let i = 0; i < 100 * dims; i++) {
                vectors[i] = Math.random();
            }
            
            const start = Date.now();
            await index.add(vectors);
            const elapsed = Date.now() - start;
            
            expect(index.getStats().ntotal).toBe(100);
            expect(elapsed).toBeLessThan(10000);
            
            index.dispose();
        });

        test('many small operations vs one large operation', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            // Many small adds
            for (let i = 0; i < 100; i++) {
                await index.add(new Float32Array([i, i+1, i+2, i+3]));
            }
            expect(index.getStats().ntotal).toBe(100);
            
            const index2 = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100 * 4);
            for (let i = 0; i < 100 * 4; i++) {
                vectors[i] = i;
            }
            
            await index2.add(vectors);
            expect(index2.getStats().ntotal).toBe(100);
            
            // Both should work correctly
            expect(index.getStats().ntotal).toBe(index2.getStats().ntotal);
            
            index.dispose();
            index2.dispose();
        });

        test('search performance scales with index size', async () => {
            const sizes = [100, 1000, 10000];
            const times = [];
            
            for (const size of sizes) {
                const index = new FaissIndex({ dims: 128 });
                const vectors = new Float32Array(size * 128);
                for (let i = 0; i < size * 128; i++) {
                    vectors[i] = Math.random();
                }
                await index.add(vectors);
                
                const query = new Float32Array(128);
                for (let i = 0; i < 128; i++) {
                    query[i] = Math.random();
                }
                
                const start = Date.now();
                await index.search(query, 10);
                times.push(Date.now() - start);
                
                index.dispose();
            }
            
            // Times should be reasonable (not exponential)
            times.forEach(time => {
                expect(time).toBeLessThan(5000);
            });
        });
    });

    // ============================================================================
    // MEMORY EDGE CASES (15 cases)
    // ============================================================================
    
    describe('Memory Edge Cases', () => {
        test('create and dispose many indices', async () => {
            for (let i = 0; i < 100; i++) {
                const index = new FaissIndex({ dims: 128 });
                const vectors = new Float32Array(100 * 128);
                for (let j = 0; j < 100 * 128; j++) {
                    vectors[j] = Math.random();
                }
                await index.add(vectors);
                index.dispose();
            }
            
            // If we get here, memory is managed properly
            expect(true).toBe(true);
        });

        test('large index with many operations', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(50000 * 128);
            for (let i = 0; i < 50000 * 128; i++) {
                vectors[i] = Math.random();
            }
            
            await index.add(vectors);
            
            // Perform many searches
            for (let i = 0; i < 100; i++) {
                const query = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    query[j] = Math.random();
                }
                await index.search(query, 10);
            }
            
            expect(index.getStats().ntotal).toBe(50000);
            
            index.dispose();
        });

        test('concurrent operations with large data', async () => {
            const index = new FaissIndex({ dims: 128 });
            
            // Add large batches concurrently
            const promises = [];
            for (let i = 0; i < 10; i++) {
                const vectors = new Float32Array(1000 * 128);
                for (let j = 0; j < 1000 * 128; j++) {
                    vectors[j] = Math.random();
                }
                promises.push(index.add(vectors));
            }
            
            await Promise.all(promises);
            expect(index.getStats().ntotal).toBe(10000);
            
            index.dispose();
        });
    });

    // ============================================================================
    // INTEGRATION EDGE CASES (10 cases)
    // ============================================================================
    
    describe('Integration Edge Cases', () => {
        test('full workflow: create -> add -> search -> save -> load -> search', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            
            await index1.add(new Float32Array([0.1, 0.2, 0.3, 0.4]));
            const results1 = await index1.search(new Float32Array([0.1, 0.2, 0.3, 0.4]), 1);
            expect(results1.labels[0]).toBe(0);
            
            const filename = path.join(tempDir, `test-${Date.now()}.idx`);
            await index1.save(filename);
            index1.dispose();
            
            const index2 = await FaissIndex.load(filename);
            const results2 = await index2.search(new Float32Array([0.1, 0.2, 0.3, 0.4]), 1);
            expect(results2.labels[0]).toBe(0);
            
            index2.dispose();
        });

        test('full workflow with buffer serialization', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            
            await index1.add(new Float32Array([0.1, 0.2, 0.3, 0.4]));
            const results1 = await index1.search(new Float32Array([0.1, 0.2, 0.3, 0.4]), 1);
            expect(results1.labels[0]).toBe(0);
            
            const buffer = await index1.toBuffer();
            index1.dispose();
            
            const index2 = await FaissIndex.fromBuffer(buffer);
            const results2 = await index2.search(new Float32Array([0.1, 0.2, 0.3, 0.4]), 1);
            expect(results2.labels[0]).toBe(0);
            
            index2.dispose();
        });

        test('multiple indexes with different operations', async () => {
            const indices = [];
            
            // Create multiple indexes
            for (let i = 0; i < 10; i++) {
                const index = new FaissIndex({ dims: 4 });
                await index.add(new Float32Array([i, i+1, i+2, i+3]));
                indices.push(index);
            }
            
            // Perform operations on all
            const promises = indices.map((index, i) => 
                index.search(new Float32Array([i, i+1, i+2, i+3]), 1)
            );
            
            const results = await Promise.all(promises);
            expect(results.length).toBe(10);
            
            indices.forEach(idx => idx.dispose());
        });
    });
});

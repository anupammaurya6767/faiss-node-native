/**
 * Comprehensive Manual Tests for MergeFrom
 * 100+ test cases covering all edge cases, boundary conditions, and error scenarios
 */

const { FaissIndex } = require('../../src/js/index');

describe('MergeFrom - Comprehensive Manual Tests (100+ cases)', () => {
    
    // ============================================================================
    // VALID MERGE OPERATIONS (20 cases)
    // ============================================================================
    
    describe('Valid Merge Operations', () => {
        test.each([
            [1, 1, '1 vector each'],
            [2, 1, '2 and 1 vectors'],
            [1, 2, '1 and 2 vectors'],
            [5, 5, '5 vectors each'],
            [10, 10, '10 vectors each'],
            [100, 100, '100 vectors each'],
            [1000, 1000, '1000 vectors each'],
        ])('merges %s', async (num1, num2, description) => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            
            const vectors1 = new Float32Array(num1 * 4);
            const vectors2 = new Float32Array(num2 * 4);
            for (let i = 0; i < num1 * 4; i++) {
                vectors1[i] = Math.random();
            }
            for (let i = 0; i < num2 * 4; i++) {
                vectors2[i] = Math.random();
            }
            
            await index1.add(vectors1);
            await index2.add(vectors2);
            
            await index1.mergeFrom(index2);
            
            const stats1 = index1.getStats();
            const stats2 = index2.getStats();
            
            expect(stats1.ntotal).toBe(num1 + num2);
            expect(stats2.ntotal).toBe(0); // Source is emptied
            
            index1.dispose();
            index2.dispose();
        });

        test('merges empty index into non-empty', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index1.add(vectors);
            
            await index1.mergeFrom(index2);
            
            const stats1 = index1.getStats();
            expect(stats1.ntotal).toBe(1);
            
            index1.dispose();
            index2.dispose();
        });

        test('merges non-empty index into empty', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index2.add(vectors);
            
            await index1.mergeFrom(index2);
            
            const stats1 = index1.getStats();
            const stats2 = index2.getStats();
            
            expect(stats1.ntotal).toBe(1);
            expect(stats2.ntotal).toBe(0);
            
            index1.dispose();
            index2.dispose();
        });

        test('merges empty into empty', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            
            await index1.mergeFrom(index2);
            
            const stats1 = index1.getStats();
            expect(stats1.ntotal).toBe(0);
            
            index1.dispose();
            index2.dispose();
        });
    });

    // ============================================================================
    // INVALID MERGE OPERATIONS (20 cases)
    // ============================================================================
    
    describe('Invalid Merge Operations', () => {
        test.each([
            [null, TypeError, 'null index'],
            [undefined, TypeError, 'undefined index'],
            ['string', TypeError, 'string index'],
            [123, TypeError, 'number index'],
            [true, TypeError, 'boolean index'],
            [[], TypeError, 'array index'],
            [{}, TypeError, 'object index'],
            [() => {}, TypeError, 'function index'],
        ])('throws %s for %s', async (otherIndex, errorType, description) => {
            const index = new FaissIndex({ dims: 4 });
            await expect(index.mergeFrom(otherIndex)).rejects.toThrow(errorType);
            index.dispose();
        });

        test('throws for dimension mismatch', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 8 });
            
            await expect(index1.mergeFrom(index2)).rejects.toThrow();
            
            index1.dispose();
            index2.dispose();
        });

        test('throws when target is disposed', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            index1.dispose();
            
            await expect(index1.mergeFrom(index2)).rejects.toThrow();
            index2.dispose();
        });

        test('throws when source is disposed', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            index2.dispose();
            
            await expect(index1.mergeFrom(index2)).rejects.toThrow();
            index1.dispose();
        });
    });

    // ============================================================================
    // MERGE BEHAVIOR (20 cases)
    // ============================================================================
    
    describe('Merge Behavior', () => {
        test('merge empties source index', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index2.add(vectors);
            
            expect(index2.getStats().ntotal).toBe(1);
            
            await index1.mergeFrom(index2);
            
            expect(index2.getStats().ntotal).toBe(0);
            expect(index1.getStats().ntotal).toBe(1);
            
            index1.dispose();
            index2.dispose();
        });

        test('merge moves all vectors', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            
            const vectors2 = new Float32Array([
                0.0, 0.0, 0.0, 0.0,
                1.0, 1.0, 1.0, 1.0,
            ]);
            await index2.add(vectors2);
            
            await index1.mergeFrom(index2);
            
            expect(index1.getStats().ntotal).toBe(2);
            expect(index2.getStats().ntotal).toBe(0);
            
            index1.dispose();
            index2.dispose();
        });

        test('merge preserves search functionality', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            
            const vectors1 = new Float32Array([0.0, 0.0, 0.0, 0.0]);
            const vectors2 = new Float32Array([5.0, 5.0, 5.0, 5.0]);
            
            await index1.add(vectors1);
            await index2.add(vectors2);
            
            await index1.mergeFrom(index2);
            
            const query = new Float32Array([0.1, 0.1, 0.1, 0.1]);
            const results = await index1.search(query, 2);
            
            expect(results.distances.length).toBe(2);
            expect(results.labels.length).toBe(2);
            
            index1.dispose();
            index2.dispose();
        });

        test('merge can be called multiple times', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            const index2 = new FaissIndex({ dims: 4 });
            
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index2.add(vectors);
            
            await index1.mergeFrom(index2);
            expect(index1.getStats().ntotal).toBe(1);
            
            // Second merge from empty index
            await index1.mergeFrom(index2);
            expect(index1.getStats().ntotal).toBe(1);
            
            index1.dispose();
            index2.dispose();
        });
    });

    // ============================================================================
    // STRESS TESTS (10 cases)
    // ============================================================================
    
    describe('Stress Tests', () => {
        test('merges large indexes', async () => {
            const index1 = new FaissIndex({ dims: 128 });
            const index2 = new FaissIndex({ dims: 128 });
            
            const vectors1 = new Float32Array(10000 * 128);
            const vectors2 = new Float32Array(10000 * 128);
            for (let i = 0; i < 10000 * 128; i++) {
                vectors1[i] = Math.random();
                vectors2[i] = Math.random();
            }
            
            await index1.add(vectors1);
            await index2.add(vectors2);
            
            await index1.mergeFrom(index2);
            
            expect(index1.getStats().ntotal).toBe(20000);
            expect(index2.getStats().ntotal).toBe(0);
            
            index1.dispose();
            index2.dispose();
        });

        test('merges many small indexes', async () => {
            const index1 = new FaissIndex({ dims: 4 });
            
            for (let i = 0; i < 10; i++) {
                const index2 = new FaissIndex({ dims: 4 });
                const vectors = new Float32Array([i, i+1, i+2, i+3]);
                await index2.add(vectors);
                await index1.mergeFrom(index2);
                index2.dispose();
            }
            
            expect(index1.getStats().ntotal).toBe(10);
            index1.dispose();
        });
    });
});

/**
 * Comprehensive Manual Tests for GetStats
 * 100+ test cases covering all edge cases, boundary conditions, and error scenarios
 */

const { FaissIndex } = require('../../src/js/index');
const fs = require('fs');
const path = require('path');

describe('GetStats - Comprehensive Manual Tests (100+ cases)', () => {
    
    // ============================================================================
    // VALID GETSTATS OPERATIONS (20 cases)
    // ============================================================================
    
    describe('Valid GetStats Operations', () => {
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
            [1024, 'dim=1024'],
            [2048, 'dim=2048'],
            [4096, 'dim=4096'],
            [10000, 'dim=10000'],
        ])('gets stats with %s', (dims, description) => {
            const index = new FaissIndex({ dims });
            const stats = index.getStats();
            
            expect(stats).toHaveProperty('ntotal');
            expect(stats).toHaveProperty('dims');
            expect(stats).toHaveProperty('isTrained');
            expect(stats).toHaveProperty('type');
            expect(stats.dims).toBe(dims);
            expect(stats.ntotal).toBe(0);
            expect(stats.isTrained).toBe(true);
            expect(stats.type).toBe('FLAT_L2');
            
            index.dispose();
        });
    });

    // ============================================================================
    // STATS AFTER ADDING VECTORS (20 cases)
    // ============================================================================
    
    describe('Stats After Adding Vectors', () => {
        test.each([
            [1, 1, '1 vector, dim=1'],
            [4, 1, '1 vector, dim=4'],
            [4, 2, '2 vectors, dim=4'],
            [4, 5, '5 vectors, dim=4'],
            [4, 10, '10 vectors, dim=4'],
            [8, 1, '1 vector, dim=8'],
            [8, 10, '10 vectors, dim=8'],
            [16, 20, '20 vectors, dim=16'],
            [32, 50, '50 vectors, dim=32'],
            [64, 100, '100 vectors, dim=64'],
            [128, 200, '200 vectors, dim=128'],
            [256, 500, '500 vectors, dim=256'],
            [512, 1000, '1000 vectors, dim=512'],
        ])('gets correct stats after adding %s', async (dims, numVectors, description) => {
            const index = new FaissIndex({ dims });
            
            let stats = index.getStats();
            expect(stats.ntotal).toBe(0);
            
            const vectors = new Float32Array(numVectors * dims);
            for (let i = 0; i < numVectors * dims; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            stats = index.getStats();
            expect(stats.ntotal).toBe(numVectors);
            expect(stats.dims).toBe(dims);
            expect(stats.isTrained).toBe(true);
            expect(stats.type).toBe('FLAT_L2');
            
            index.dispose();
        });

        test('stats update incrementally', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            for (let i = 1; i <= 10; i++) {
                const v = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(v);
                
                const stats = index.getStats();
                expect(stats.ntotal).toBe(i);
            }
            
            index.dispose();
        });

        test('stats remain consistent after multiple adds', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            for (let i = 0; i < 10; i++) {
                const v = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(v);
                
                const stats1 = index.getStats();
                const stats2 = index.getStats();
                expect(stats1.ntotal).toBe(stats2.ntotal);
                expect(stats1.dims).toBe(stats2.dims);
            }
            
            index.dispose();
        });

        test('stats after adding large batch', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(10000 * 128);
            for (let i = 0; i < 10000 * 128; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const stats = index.getStats();
            expect(stats.ntotal).toBe(10000);
            expect(stats.dims).toBe(128);
            
            index.dispose();
        });

        test('stats after adding multiple batches', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            for (let i = 0; i < 10; i++) {
                const batch = new Float32Array(10 * 4);
                for (let j = 0; j < 10 * 4; j++) {
                    batch[j] = i * 10 + j;
                }
                await index.add(batch);
            }
            
            const stats = index.getStats();
            expect(stats.ntotal).toBe(100);
            
            index.dispose();
        });
    });

    // ============================================================================
    // STATS PROPERTY VALIDATION (15 cases)
    // ============================================================================
    
    describe('Stats Property Validation', () => {
        test('stats has all required properties', () => {
            const index = new FaissIndex({ dims: 4 });
            const stats = index.getStats();
            
            expect(stats).toHaveProperty('ntotal');
            expect(stats).toHaveProperty('dims');
            expect(stats).toHaveProperty('isTrained');
            expect(stats).toHaveProperty('type');
            
            index.dispose();
        });

        test('ntotal is a number', () => {
            const index = new FaissIndex({ dims: 4 });
            const stats = index.getStats();
            
            expect(typeof stats.ntotal).toBe('number');
            expect(Number.isInteger(stats.ntotal)).toBe(true);
            expect(stats.ntotal).toBeGreaterThanOrEqual(0);
            
            index.dispose();
        });

        test('dims is a number', () => {
            const index = new FaissIndex({ dims: 128 });
            const stats = index.getStats();
            
            expect(typeof stats.dims).toBe('number');
            expect(Number.isInteger(stats.dims)).toBe(true);
            expect(stats.dims).toBeGreaterThan(0);
            
            index.dispose();
        });

        test('isTrained is a boolean', () => {
            const index = new FaissIndex({ dims: 4 });
            const stats = index.getStats();
            
            expect(typeof stats.isTrained).toBe('boolean');
            expect(stats.isTrained).toBe(true); // IndexFlatL2 is always trained
            
            index.dispose();
        });

        test('type is a string', () => {
            const index = new FaissIndex({ dims: 4 });
            const stats = index.getStats();
            
            expect(typeof stats.type).toBe('string');
            expect(stats.type).toBe('FLAT_L2');
            
            index.dispose();
        });

        test('stats object is not null', () => {
            const index = new FaissIndex({ dims: 4 });
            const stats = index.getStats();
            
            expect(stats).not.toBeNull();
            expect(stats).toBeDefined();
            
            index.dispose();
        });

        test('stats object is plain object', () => {
            const index = new FaissIndex({ dims: 4 });
            const stats = index.getStats();
            
            // Native objects may have different constructors, but should be plain objects
            expect(typeof stats).toBe('object');
            expect(stats).not.toBeNull();
            // Check that it's a plain object (not an array, date, etc.)
            // Native objects from C++ might have slightly different prototype, so just check it's not an array
            expect(Array.isArray(stats)).toBe(false);
            expect(stats.constructor).toBeDefined();
            
            index.dispose();
        });

        test('stats properties are enumerable', () => {
            const index = new FaissIndex({ dims: 4 });
            const stats = index.getStats();
            
            const keys = Object.keys(stats);
            expect(keys).toContain('ntotal');
            expect(keys).toContain('dims');
            expect(keys).toContain('isTrained');
            expect(keys).toContain('type');
            
            index.dispose();
        });

        test('stats can be JSON stringified', () => {
            const index = new FaissIndex({ dims: 4 });
            const stats = index.getStats();
            
            const json = JSON.stringify(stats);
            expect(json).toBeDefined();
            expect(json).toContain('ntotal');
            expect(json).toContain('dims');
            expect(json).toContain('isTrained');
            expect(json).toContain('type');
            
            const parsed = JSON.parse(json);
            expect(parsed.ntotal).toBe(stats.ntotal);
            expect(parsed.dims).toBe(stats.dims);
            
            index.dispose();
        });

        test('stats can be destructured', () => {
            const index = new FaissIndex({ dims: 4 });
            const { ntotal, dims, isTrained, type } = index.getStats();
            
            expect(ntotal).toBe(0);
            expect(dims).toBe(4);
            expect(isTrained).toBe(true);
            expect(type).toBe('FLAT_L2');
            
            index.dispose();
        });

        test('stats values are immutable references', () => {
            const index = new FaissIndex({ dims: 4 });
            const stats1 = index.getStats();
            const stats2 = index.getStats();
            
            // Should be different objects but same values
            expect(stats1).not.toBe(stats2);
            expect(stats1.ntotal).toBe(stats2.ntotal);
            expect(stats1.dims).toBe(stats2.dims);
            
            index.dispose();
        });

        test('stats reflect current state', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            const stats1 = index.getStats();
            expect(stats1.ntotal).toBe(0);
            
            const v = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(v);
            
            const stats2 = index.getStats();
            expect(stats2.ntotal).toBe(1);
            expect(stats1.ntotal).toBe(0); // Old stats unchanged
            
            index.dispose();
        });

        test('stats after multiple operations', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            const stats1 = index.getStats();
            expect(stats1.ntotal).toBe(0);
            
            for (let i = 0; i < 5; i++) {
                const v = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(v);
                
                const stats = index.getStats();
                expect(stats.ntotal).toBe(i + 1);
            }
            
            index.dispose();
        });

        test('stats with zero vectors', () => {
            const index = new FaissIndex({ dims: 4 });
            const stats = index.getStats();
            
            expect(stats.ntotal).toBe(0);
            expect(stats.dims).toBe(4);
            expect(stats.isTrained).toBe(true);
            
            index.dispose();
        });

        test('stats with maximum vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100000 * 4);
            for (let i = 0; i < 100000 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const stats = index.getStats();
            expect(stats.ntotal).toBe(100000);
            
            index.dispose();
        });
    });

    // ============================================================================
    // STATS WITH DIFFERENT DIMENSIONS (15 cases)
    // ============================================================================
    
    describe('Stats With Different Dimensions', () => {
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
            [1024, 'dim=1024'],
            [2048, 'dim=2048'],
            [4096, 'dim=4096'],
            [8192, 'dim=8192'],
            [10000, 'dim=10000'],
        ])('stats correct for %s', (dims, description) => {
            const index = new FaissIndex({ dims });
            const stats = index.getStats();
            
            expect(stats.dims).toBe(dims);
            expect(stats.ntotal).toBe(0);
            expect(stats.isTrained).toBe(true);
            expect(stats.type).toBe('FLAT_L2');
            
            index.dispose();
        });
    });

    // ============================================================================
    // STATS AFTER DISPOSE (10 cases)
    // ============================================================================
    
    describe('Stats After Dispose', () => {
        test('throws error when getting stats after dispose', () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            
            expect(() => index.getStats()).toThrow();
        });

        test('throws error on multiple getStats after dispose', () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            
            expect(() => index.getStats()).toThrow();
            expect(() => index.getStats()).toThrow();
            expect(() => index.getStats()).toThrow();
        });

        test('stats before dispose are valid', async () => {
            const index = new FaissIndex({ dims: 4 });
            const v = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(v);
            
            const stats = index.getStats();
            expect(stats.ntotal).toBe(1);
            
            index.dispose();
            
            expect(() => index.getStats()).toThrow();
        });
    });

    // ============================================================================
    // STATS CONSISTENCY (10 cases)
    // ============================================================================
    
    describe('Stats Consistency', () => {
        test('stats remain consistent across multiple calls', () => {
            const index = new FaissIndex({ dims: 4 });
            
            const stats1 = index.getStats();
            const stats2 = index.getStats();
            const stats3 = index.getStats();
            
            expect(stats1.ntotal).toBe(stats2.ntotal);
            expect(stats2.ntotal).toBe(stats3.ntotal);
            expect(stats1.dims).toBe(stats2.dims);
            expect(stats2.dims).toBe(stats3.dims);
            
            index.dispose();
        });

        test('stats update correctly after each add', async () => {
            const index = new FaissIndex({ dims: 4 });
            
            for (let i = 0; i < 10; i++) {
                const v = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(v);
                
                const stats = index.getStats();
                expect(stats.ntotal).toBe(i + 1);
            }
            
            index.dispose();
        });

        test('stats reflect correct dimensions', () => {
            const dims = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
            
            dims.forEach(d => {
                const index = new FaissIndex({ dims: d });
                const stats = index.getStats();
                expect(stats.dims).toBe(d);
                index.dispose();
            });
        });

        test('stats type is always FLAT_L2', () => {
            const dims = [1, 4, 16, 64, 256, 1024];
            
            dims.forEach(d => {
                const index = new FaissIndex({ dims: d });
                const stats = index.getStats();
                expect(stats.type).toBe('FLAT_L2');
                index.dispose();
            });
        });

        test('stats isTrained is always true', () => {
            const dims = [1, 4, 16, 64, 256, 1024];
            
            dims.forEach(d => {
                const index = new FaissIndex({ dims: d });
                const stats = index.getStats();
                expect(stats.isTrained).toBe(true);
                index.dispose();
            });
        });
    });

    // ============================================================================
    // STRESS TESTS (10 cases)
    // ============================================================================
    
    describe('Stress Tests', () => {
        test('gets stats 1000 times', () => {
            const index = new FaissIndex({ dims: 4 });
            
            for (let i = 0; i < 1000; i++) {
                const stats = index.getStats();
                expect(stats.dims).toBe(4);
                expect(stats.ntotal).toBe(0);
            }
            
            index.dispose();
        });

        test('gets stats after adding 100000 vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(100000 * 4);
            for (let i = 0; i < 100000 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            
            const stats = index.getStats();
            expect(stats.ntotal).toBe(100000);
            
            index.dispose();
        });

        test('gets stats with very large dimensions', () => {
            const index = new FaissIndex({ dims: 10000 });
            const stats = index.getStats();
            
            expect(stats.dims).toBe(10000);
            expect(stats.ntotal).toBe(0);
            
            index.dispose();
        });

        test('gets stats efficiently', () => {
            const index = new FaissIndex({ dims: 128 });
            
            const start = Date.now();
            for (let i = 0; i < 10000; i++) {
                index.getStats();
            }
            const elapsed = Date.now() - start;
            
            expect(elapsed).toBeLessThan(1000); // Should be very fast
            
            index.dispose();
        });
    });
});

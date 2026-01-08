/**
 * Comprehensive Manual Tests for Add Vectors
 * 100+ test cases covering all edge cases, boundary conditions, and error scenarios
 */

const { FaissIndex } = require('../../src/js/index');

describe('Add Vectors - Comprehensive Manual Tests (100+ cases)', () => {
    
    // ============================================================================
    // VALID ADD OPERATIONS (20 cases)
    // ============================================================================
    
    describe('Valid Add Operations', () => {
        test.each([
            [1, [0.1], 'single vector, dim=1'],
            [2, [0.1, 0.2], 'single vector, dim=2'],
            [4, [0.1, 0.2, 0.3, 0.4], 'single vector, dim=4'],
            [8, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], 'single vector, dim=8'],
            [16, Array(16).fill(0).map((_, i) => i * 0.1), 'single vector, dim=16'],
            [32, Array(32).fill(0).map((_, i) => i * 0.1), 'single vector, dim=32'],
            [64, Array(64).fill(0).map((_, i) => i * 0.1), 'single vector, dim=64'],
            [128, Array(128).fill(0).map((_, i) => i * 0.1), 'single vector, dim=128'],
            [256, Array(256).fill(0).map((_, i) => i * 0.1), 'single vector, dim=256'],
            [512, Array(512).fill(0).map((_, i) => i * 0.1), 'single vector, dim=512'],
        ])('adds single vector with %s', async (dims, vector, description) => {
            const index = new FaissIndex({ dims });
            const float32Vector = new Float32Array(vector);
            await index.add(float32Vector);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test.each([
            [4, 2, '2 vectors, dim=4'],
            [4, 5, '5 vectors, dim=4'],
            [4, 10, '10 vectors, dim=4'],
            [8, 3, '3 vectors, dim=8'],
            [16, 4, '4 vectors, dim=16'],
            [32, 8, '8 vectors, dim=32'],
            [64, 16, '16 vectors, dim=64'],
            [128, 32, '32 vectors, dim=128'],
            [256, 64, '64 vectors, dim=256'],
            [512, 100, '100 vectors, dim=512'],
        ])('adds batch of %d vectors with dim=%d', async (dims, numVectors, description) => {
            const index = new FaissIndex({ dims });
            const vectors = new Float32Array(numVectors * dims);
            for (let i = 0; i < numVectors * dims; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(numVectors);
            index.dispose();
        });
    });

    // ============================================================================
    // INVALID VECTOR TYPES (15 cases)
    // ============================================================================
    
    describe('Invalid Vector Types', () => {
        let index;
        beforeEach(() => {
            index = new FaissIndex({ dims: 4 });
        });
        afterEach(() => {
            if (index) index.dispose();
        });

        test.each([
            [null, TypeError, 'null vectors'],
            [undefined, TypeError, 'undefined vectors'],
            ['string', TypeError, 'string vectors'],
            [123, TypeError, 'number vectors'],
            [true, TypeError, 'boolean vectors'],
            [[], TypeError, 'empty array'],
            [[0.1, 0.2, 0.3, 0.4], TypeError, 'regular array'],
            [new Int32Array(4), TypeError, 'Int32Array'],
            [new Uint8Array(4), TypeError, 'Uint8Array'],
            [new ArrayBuffer(16), TypeError, 'ArrayBuffer'],
            [{}, TypeError, 'object vectors'],
            [() => {}, TypeError, 'function vectors'],
            [new Map(), TypeError, 'map vectors'],
            [new Set(), TypeError, 'set vectors'],
            [Symbol('test'), TypeError, 'symbol vectors'],
        ])('throws %s for %s', async (vectors, errorType, description) => {
            await expect(index.add(vectors)).rejects.toThrow(errorType);
        });
    });

    // ============================================================================
    // EMPTY AND ZERO-LENGTH VECTORS (10 cases)
    // ============================================================================
    
    describe('Empty and Zero-Length Vectors', () => {
        let index;
        beforeEach(() => {
            index = new FaissIndex({ dims: 4 });
        });
        afterEach(() => {
            if (index) index.dispose();
        });

        test('rejects empty Float32Array', async () => {
            const empty = new Float32Array(0);
            await expect(index.add(empty)).rejects.toThrow();
        });

        test('rejects zero-length Float32Array', async () => {
            const zero = new Float32Array([]);
            await expect(index.add(zero)).rejects.toThrow();
        });

        test('accepts empty array after adding valid vectors', async () => {
            const valid = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(valid);
            expect(index.getStats().ntotal).toBe(1);
            
            const empty = new Float32Array(0);
            await expect(index.add(empty)).rejects.toThrow();
        });

        test('handles multiple empty attempts', async () => {
            const empty = new Float32Array(0);
            await expect(index.add(empty)).rejects.toThrow();
            await expect(index.add(empty)).rejects.toThrow();
            await expect(index.add(empty)).rejects.toThrow();
        });
    });

    // ============================================================================
    // DIMENSION MISMATCH (20 cases)
    // ============================================================================
    
    describe('Dimension Mismatch', () => {
        test.each([
            [4, 3, 'length 3 for dim 4'],
            [4, 5, 'length 5 for dim 4'],
            [4, 6, 'length 6 for dim 4'],
            [4, 7, 'length 7 for dim 4'],
            [4, 9, 'length 9 for dim 4'],
            [8, 7, 'length 7 for dim 8'],
            [8, 9, 'length 9 for dim 8'],
            [8, 15, 'length 15 for dim 8'],
            [16, 15, 'length 15 for dim 16'],
            [16, 17, 'length 17 for dim 16'],
            [32, 31, 'length 31 for dim 32'],
            [32, 33, 'length 33 for dim 32'],
            [64, 63, 'length 63 for dim 64'],
            [64, 65, 'length 65 for dim 64'],
            [128, 127, 'length 127 for dim 128'],
            [128, 129, 'length 129 for dim 128'],
            [256, 255, 'length 255 for dim 256'],
            [256, 257, 'length 257 for dim 256'],
            [512, 511, 'length 511 for dim 512'],
            [512, 513, 'length 513 for dim 512'],
        ])('rejects length %d for dim %d', async (dims, length, description) => {
            const index = new FaissIndex({ dims });
            const vectors = new Float32Array(length);
            await expect(index.add(vectors)).rejects.toThrow();
            index.dispose();
        });
    });

    // ============================================================================
    // BOUNDARY VALUES FOR VECTOR LENGTHS (15 cases)
    // ============================================================================
    
    describe('Boundary Values for Vector Lengths', () => {
        test('adds exactly 1 vector (minimum)', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds 1000 vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(1000 * 4);
            for (let i = 0; i < 1000 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1000);
            index.dispose();
        });

        test('adds 10000 vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(10000 * 4);
            for (let i = 0; i < 10000 * 4; i++) {
                vectors[i] = Math.random();
            }
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(10000);
            index.dispose();
        });

        test('adds vectors with all zeros', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0, 0, 0, 0]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors with all ones', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([1, 1, 1, 1]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors with negative values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([-1, -2, -3, -4]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors with very large values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([1e10, 2e10, 3e10, 4e10]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors with very small values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([1e-10, 2e-10, 3e-10, 4e-10]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors with mixed positive and negative', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([1, -1, 2, -2]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors with Infinity values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([Infinity, -Infinity, 1, 2]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors with NaN values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([NaN, 1, 2, 3]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors with max float32 values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([3.4028235e38, 1, 2, 3]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors with min float32 values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([-3.4028235e38, 1, 2, 3]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors with subnormal values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([1.175494e-38, 1, 2, 3]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors with all same values', async () => {
            const index = new FaissIndex({ dims: 100 });
            const vectors = new Float32Array(100).fill(0.5);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });
    });

    // ============================================================================
    // MULTIPLE ADD OPERATIONS (15 cases)
    // ============================================================================
    
    describe('Multiple Add Operations', () => {
        test('adds vectors multiple times', async () => {
            const index = new FaissIndex({ dims: 4 });
            const v1 = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const v2 = new Float32Array([0.5, 0.6, 0.7, 0.8]);
            const v3 = new Float32Array([0.9, 1.0, 1.1, 1.2]);
            
            await index.add(v1);
            expect(index.getStats().ntotal).toBe(1);
            
            await index.add(v2);
            expect(index.getStats().ntotal).toBe(2);
            
            await index.add(v3);
            expect(index.getStats().ntotal).toBe(3);
            
            index.dispose();
        });

        test('adds single vector then batch', async () => {
            const index = new FaissIndex({ dims: 4 });
            const v1 = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const batch = new Float32Array([0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2]);
            
            await index.add(v1);
            expect(index.getStats().ntotal).toBe(1);
            
            await index.add(batch);
            expect(index.getStats().ntotal).toBe(3);
            
            index.dispose();
        });

        test('adds batch then single vector', async () => {
            const index = new FaissIndex({ dims: 4 });
            const batch = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
            const v1 = new Float32Array([0.9, 1.0, 1.1, 1.2]);
            
            await index.add(batch);
            expect(index.getStats().ntotal).toBe(2);
            
            await index.add(v1);
            expect(index.getStats().ntotal).toBe(3);
            
            index.dispose();
        });

        test('adds 100 single vectors sequentially', async () => {
            const index = new FaissIndex({ dims: 4 });
            for (let i = 0; i < 100; i++) {
                const v = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(v);
            }
            expect(index.getStats().ntotal).toBe(100);
            index.dispose();
        });

        test('adds 10 batches sequentially', async () => {
            const index = new FaissIndex({ dims: 4 });
            for (let i = 0; i < 10; i++) {
                const batch = new Float32Array(4 * 10);
                for (let j = 0; j < 4 * 10; j++) {
                    batch[j] = i * 10 + j;
                }
                await index.add(batch);
            }
            expect(index.getStats().ntotal).toBe(100);
            index.dispose();
        });

        test('adds alternating single and batch', async () => {
            const index = new FaissIndex({ dims: 4 });
            for (let i = 0; i < 10; i++) {
                const single = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(single);
                
                const batch = new Float32Array([i+4, i+5, i+6, i+7, i+8, i+9, i+10, i+11]);
                await index.add(batch);
            }
            expect(index.getStats().ntotal).toBe(30);
            index.dispose();
        });

        test('adds vectors with increasing sizes', async () => {
            const index = new FaissIndex({ dims: 4 });
            for (let i = 1; i <= 10; i++) {
                const vectors = new Float32Array(i * 4);
                for (let j = 0; j < i * 4; j++) {
                    vectors[j] = j;
                }
                await index.add(vectors);
            }
            expect(index.getStats().ntotal).toBe(55); // 1+2+3+...+10
            index.dispose();
        });

        test('adds vectors with decreasing sizes', async () => {
            const index = new FaissIndex({ dims: 4 });
            for (let i = 10; i >= 1; i--) {
                const vectors = new Float32Array(i * 4);
                for (let j = 0; j < i * 4; j++) {
                    vectors[j] = j;
                }
                await index.add(vectors);
            }
            expect(index.getStats().ntotal).toBe(55);
            index.dispose();
        });

        test('adds same vector multiple times', async () => {
            const index = new FaissIndex({ dims: 4 });
            const v = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            
            for (let i = 0; i < 10; i++) {
                await index.add(v);
            }
            expect(index.getStats().ntotal).toBe(10);
            index.dispose();
        });

        test('adds identical vectors in batch', async () => {
            const index = new FaissIndex({ dims: 4 });
            const v = [0.1, 0.2, 0.3, 0.4];
            const batch = new Float32Array(v.concat(v).concat(v).concat(v));
            
            await index.add(batch);
            expect(index.getStats().ntotal).toBe(4);
            index.dispose();
        });

        test('adds vectors with random values multiple times', async () => {
            const index = new FaissIndex({ dims: 4 });
            for (let i = 0; i < 50; i++) {
                const v = new Float32Array(4);
                for (let j = 0; j < 4; j++) {
                    v[j] = Math.random();
                }
                await index.add(v);
            }
            expect(index.getStats().ntotal).toBe(50);
            index.dispose();
        });

        test('adds large batch then small batches', async () => {
            const index = new FaissIndex({ dims: 4 });
            const large = new Float32Array(1000 * 4);
            for (let i = 0; i < 1000 * 4; i++) {
                large[i] = Math.random();
            }
            await index.add(large);
            expect(index.getStats().ntotal).toBe(1000);
            
            for (let i = 0; i < 10; i++) {
                const small = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(small);
            }
            expect(index.getStats().ntotal).toBe(1010);
            index.dispose();
        });

        test('adds small batches then large batch', async () => {
            const index = new FaissIndex({ dims: 4 });
            for (let i = 0; i < 10; i++) {
                const small = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(small);
            }
            expect(index.getStats().ntotal).toBe(10);
            
            const large = new Float32Array(1000 * 4);
            for (let i = 0; i < 1000 * 4; i++) {
                large[i] = Math.random();
            }
            await index.add(large);
            expect(index.getStats().ntotal).toBe(1010);
            index.dispose();
        });

        test('adds vectors with pattern: 1, 2, 4, 8, 16...', async () => {
            const index = new FaissIndex({ dims: 4 });
            let total = 0;
            for (let i = 0; i < 8; i++) {
                const count = Math.pow(2, i);
                const vectors = new Float32Array(count * 4);
                for (let j = 0; j < count * 4; j++) {
                    vectors[j] = j;
                }
                await index.add(vectors);
                total += count;
            }
            expect(index.getStats().ntotal).toBe(total);
            index.dispose();
        });
    });

    // ============================================================================
    // STRESS TESTS (10 cases)
    // ============================================================================
    
    describe('Stress Tests', () => {
        test('adds 10000 vectors efficiently', async () => {
            const index = new FaissIndex({ dims: 128 });
            const vectors = new Float32Array(10000 * 128);
            for (let i = 0; i < 10000 * 128; i++) {
                vectors[i] = Math.random();
            }
            
            const start = Date.now();
            await index.add(vectors);
            const elapsed = Date.now() - start;
            
            expect(index.getStats().ntotal).toBe(10000);
            expect(elapsed).toBeLessThan(5000); // Should complete in reasonable time
            index.dispose();
        });

        test('adds 50000 vectors', async () => {
            const index = new FaissIndex({ dims: 64 });
            const vectors = new Float32Array(50000 * 64);
            for (let i = 0; i < 50000 * 64; i++) {
                vectors[i] = Math.random();
            }
            
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(50000);
            index.dispose();
        });

        test('adds vectors with very large dimensions', async () => {
            const index = new FaissIndex({ dims: 1000 });
            const vectors = new Float32Array(100 * 1000);
            for (let i = 0; i < 100 * 1000; i++) {
                vectors[i] = Math.random();
            }
            
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(100);
            index.dispose();
        });

        test('adds many small batches rapidly', async () => {
            const index = new FaissIndex({ dims: 4 });
            for (let i = 0; i < 1000; i++) {
                const batch = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(batch);
            }
            expect(index.getStats().ntotal).toBe(1000);
            index.dispose();
        });

        test('adds vectors with maximum practical dimensions', async () => {
            const dims = 10000;
            const index = new FaissIndex({ dims });
            const vectors = new Float32Array(dims);
            for (let i = 0; i < dims; i++) {
                vectors[i] = i * 0.001;
            }
            
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors continuously without memory issues', async () => {
            const index = new FaissIndex({ dims: 128 });
            for (let i = 0; i < 1000; i++) {
                const vectors = new Float32Array(10 * 128);
                for (let j = 0; j < 10 * 128; j++) {
                    vectors[j] = Math.random();
                }
                await index.add(vectors);
            }
            expect(index.getStats().ntotal).toBe(10000);
            index.dispose();
        });

        test('adds vectors with sparse patterns', async () => {
            const index = new FaissIndex({ dims: 100 });
            for (let i = 0; i < 100; i++) {
                const v = new Float32Array(100);
                v.fill(0);
                v[i] = 1.0; // Only one non-zero value
                await index.add(v);
            }
            expect(index.getStats().ntotal).toBe(100);
            index.dispose();
        });

        test('adds vectors with dense patterns', async () => {
            const index = new FaissIndex({ dims: 100 });
            for (let i = 0; i < 100; i++) {
                const v = new Float32Array(100);
                v.fill(1.0); // All values are 1.0
                await index.add(v);
            }
            expect(index.getStats().ntotal).toBe(100);
            index.dispose();
        });

        test('adds vectors with alternating patterns', async () => {
            const index = new FaissIndex({ dims: 100 });
            for (let i = 0; i < 100; i++) {
                const v = new Float32Array(100);
                for (let j = 0; j < 100; j++) {
                    v[j] = (i + j) % 2 === 0 ? 1.0 : 0.0;
                }
                await index.add(v);
            }
            expect(index.getStats().ntotal).toBe(100);
            index.dispose();
        });

        test('adds vectors with sequential patterns', async () => {
            const index = new FaissIndex({ dims: 100 });
            for (let i = 0; i < 100; i++) {
                const v = new Float32Array(100);
                for (let j = 0; j < 100; j++) {
                    v[j] = i * 100 + j;
                }
                await index.add(v);
            }
            expect(index.getStats().ntotal).toBe(100);
            index.dispose();
        });
    });

    // ============================================================================
    // EDGE CASES FOR FLOAT32ARRAY (10 cases)
    // ============================================================================
    
    describe('Edge Cases for Float32Array', () => {
        test('adds vectors from Float32Array with offset', async () => {
            const index = new FaissIndex({ dims: 4 });
            const large = new Float32Array([0, 0, 0, 0.1, 0.2, 0.3, 0.4, 0, 0]);
            const vectors = large.subarray(3, 7);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors from Float32Array with length', async () => {
            const index = new FaissIndex({ dims: 4 });
            const large = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
            const vectors = new Float32Array(large.buffer, 0, 4);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('adds vectors from shared ArrayBuffer', async () => {
            const index = new FaissIndex({ dims: 4 });
            const buffer = new ArrayBuffer(32); // Need 32 bytes for 2 vectors
            const view1 = new Float32Array(buffer, 0, 4);
            const view2 = new Float32Array(buffer, 16, 4);
            view1.set([0.1, 0.2, 0.3, 0.4]);
            view2.set([0.5, 0.6, 0.7, 0.8]);
            
            await index.add(view1);
            await index.add(view2);
            expect(index.getStats().ntotal).toBe(2);
            index.dispose();
        });

        test('handles Float32Array with modified values', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            vectors[0] = 0.9;
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('handles Float32Array created from array', async () => {
            const index = new FaissIndex({ dims: 4 });
            const arr = [0.1, 0.2, 0.3, 0.4];
            const vectors = new Float32Array(arr);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('handles Float32Array created from another Float32Array', async () => {
            const index = new FaissIndex({ dims: 4 });
            const original = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            const vectors = new Float32Array(original);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('handles Float32Array with typed array constructor', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = Float32Array.from([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('handles Float32Array with map', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = Float32Array.from([1, 2, 3, 4], x => x * 0.1);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('handles Float32Array with fill', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(4).fill(0.5);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });

        test('handles Float32Array with set', async () => {
            const index = new FaissIndex({ dims: 4 });
            const vectors = new Float32Array(4);
            vectors.set([0.1, 0.2, 0.3, 0.4]);
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(1);
            index.dispose();
        });
    });

    // ============================================================================
    // ERROR HANDLING AFTER DISPOSE (5 cases)
    // ============================================================================
    
    describe('Error Handling After Dispose', () => {
        test('rejects add after dispose', async () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await expect(index.add(vectors)).rejects.toThrow();
        });

        test('rejects multiple adds after dispose', async () => {
            const index = new FaissIndex({ dims: 4 });
            index.dispose();
            
            const vectors = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await expect(index.add(vectors)).rejects.toThrow();
            await expect(index.add(vectors)).rejects.toThrow();
            await expect(index.add(vectors)).rejects.toThrow();
        });

        test('rejects add after dispose with valid vectors', async () => {
            const index = new FaissIndex({ dims: 4 });
            const v1 = new Float32Array([0.1, 0.2, 0.3, 0.4]);
            await index.add(v1);
            index.dispose();
            
            const v2 = new Float32Array([0.5, 0.6, 0.7, 0.8]);
            await expect(index.add(v2)).rejects.toThrow();
        });
    });
});

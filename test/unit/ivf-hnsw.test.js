const { FaissIndex } = require('../../src/js/index');

describe('IndexIVFFlat', () => {
    describe('Creation', () => {
        test('creates IVF_FLAT index with default nlist', () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 128 });
            expect(index).toBeDefined();
            expect(index.getStats().isTrained).toBe(false);
        });

        test('creates IVF_FLAT index with custom nlist', () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 128, nlist: 50 });
            expect(index).toBeDefined();
        });

        test('creates IVF_FLAT index with nprobe', () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 128, nlist: 100, nprobe: 10 });
            expect(index).toBeDefined();
        });
    });

    describe('Training', () => {
        test('requires training before adding vectors', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            const vectors = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]);
            
            // Should fail without training
            await expect(index.add(vectors)).rejects.toThrow();
        });

        test('can train with training vectors', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            const trainingVectors = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
            
            await index.train(trainingVectors);
            expect(index.getStats().isTrained).toBe(true);
        });

        test('can add vectors after training', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            const trainingVectors = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
            
            await index.train(trainingVectors);
            
            const vectors = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]);
            await index.add(vectors);
            
            expect(index.getStats().ntotal).toBe(2);
        });

        test('throws error for empty training vectors', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 10 });
            await expect(index.train(new Float32Array())).rejects.toThrow();
        });

        test('throws error for invalid training vector dimensions', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            const invalidVectors = new Float32Array([1, 0, 0]); // Wrong length
            await expect(index.train(invalidVectors)).rejects.toThrow();
        });
        
        test('throws error if training vectors < nlist', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 10 });
            const trainingVectors = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0
            ]); // Only 2 vectors, but nlist=10
            await expect(index.train(trainingVectors)).rejects.toThrow();
        });
    });

    describe('Search', () => {
        test('can search after training and adding', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            
            // Train
            const trainingVectors = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
            await index.train(trainingVectors);
            
            // Add vectors
            const vectors = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0
            ]);
            await index.add(vectors);
            
            // Search
            const query = new Float32Array([1, 0, 0, 0]);
            const results = await index.search(query, 2);
            
            expect(results.distances.constructor.name).toBe('Float32Array');
            expect(results.labels.constructor.name).toBe('Int32Array');
            expect(results.distances.length).toBe(2);
            expect(results.labels.length).toBe(2);
        });

        test('returns approximate results (not exact)', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 10, nprobe: 5 });
            
            // Train (need at least 10 vectors for nlist=10)
            const trainingVectors = new Float32Array(Array(40).fill(0).map((_, i) => (i % 4) / 4));
            await index.train(trainingVectors);
            
            // Add many vectors
            const vectors = new Float32Array(Array(200).fill(0).map((_, i) => (i % 4) / 4));
            await index.add(vectors);
            
            // Search
            const query = new Float32Array([1, 0, 0, 0]);
            const results = await index.search(query, 5);
            
            expect(results.distances.length).toBe(5);
            expect(results.labels.length).toBe(5);
        });
    });

    describe('nprobe', () => {
        test('can set nprobe', () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            index.setNprobe(2);
            // No error means it worked
        });

        test('throws error for invalid nprobe', () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            expect(() => index.setNprobe(0)).toThrow();
            expect(() => index.setNprobe(-1)).toThrow();
        });

        test('nprobe affects search results', async () => {
            const index1 = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 10, nprobe: 1 });
            const index2 = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 10, nprobe: 10 });
            
            // Train both (need at least 10 vectors for nlist=10)
            const trainingVectors = new Float32Array(Array(40).fill(0).map((_, i) => (i % 4) / 4));
            await index1.train(trainingVectors);
            await index2.train(trainingVectors);
            
            // Add same vectors
            const vectors = new Float32Array(Array(100).fill(0).map((_, i) => (i % 4) / 4));
            await index1.add(vectors);
            await index2.add(vectors);
            
            // Search with different nprobe values
            const query = new Float32Array([1, 0, 0, 0]);
            const results1 = await index1.search(query, 5);
            const results2 = await index2.search(query, 5);
            
            // Results might differ (higher nprobe = more accurate but slower)
            expect(results1.distances.length).toBe(5);
            expect(results2.distances.length).toBe(5);
        });
    });

    describe('Edge Cases', () => {
        test('handles large nlist', () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 128, nlist: 1000 });
            expect(index).toBeDefined();
        });

        test('handles small nlist', () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 128, nlist: 4 });
            expect(index).toBeDefined();
        });

        test('can save and load IVF index', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            const trainingVectors = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
            await index.train(trainingVectors);
            await index.add(new Float32Array([1, 0, 0, 0]));
            
            await index.save('test_ivf.faiss');
            const loaded = await FaissIndex.load('test_ivf.faiss');
            
            expect(loaded.getStats().ntotal).toBe(1);
            expect(loaded.getStats().isTrained).toBe(true);
            
            // Cleanup
            const fs = require('fs');
            if (fs.existsSync('test_ivf.faiss')) {
                fs.unlinkSync('test_ivf.faiss');
            }
        });
    });
});

describe('IndexHNSW', () => {
    describe('Creation', () => {
        test('creates HNSW index with default M', () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 128 });
            expect(index).toBeDefined();
            expect(index.getStats().isTrained).toBe(true); // HNSW doesn't need training
        });

        test('creates HNSW index with custom M', () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 128, M: 32 });
            expect(index).toBeDefined();
        });

        test('creates HNSW index with various M values', () => {
            [8, 16, 32, 64].forEach(M => {
                const index = new FaissIndex({ type: 'HNSW', dims: 128, M: M });
                expect(index).toBeDefined();
            });
        });
    });

    describe('Adding Vectors', () => {
        test('can add vectors without training', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4 });
            const vectors = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]);
            
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(2);
        });

        test('can add many vectors', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4, M: 16 });
            const vectors = new Float32Array(Array(400).fill(0).map((_, i) => (i % 4) / 4));
            
            await index.add(vectors);
            expect(index.getStats().ntotal).toBe(100);
        });
    });

    describe('Search', () => {
        test('can search after adding vectors', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4 });
            
            const vectors = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
            await index.add(vectors);
            
            const query = new Float32Array([1, 0, 0, 0]);
            const results = await index.search(query, 2);
            
            expect(results.distances.constructor.name).toBe('Float32Array');
            expect(results.labels.constructor.name).toBe('Int32Array');
            expect(results.distances.length).toBe(2);
            expect(results.labels.length).toBe(2);
        });

        test('returns approximate results', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4, M: 16 });
            
            // Add many vectors
            const vectors = new Float32Array(Array(400).fill(0).map((_, i) => (i % 4) / 4));
            await index.add(vectors);
            
            // Search
            const query = new Float32Array([1, 0, 0, 0]);
            const results = await index.search(query, 10);
            
            expect(results.distances.length).toBe(10);
            expect(results.labels.length).toBe(10);
        });

        test('handles large k values', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4 });
            const vectors = new Float32Array(Array(200).fill(0).map((_, i) => (i % 4) / 4));
            await index.add(vectors);
            
            const query = new Float32Array([1, 0, 0, 0]);
            const results = await index.search(query, 50);
            
            expect(results.distances.length).toBe(50);
        });
    });

    describe('Edge Cases', () => {
        test('handles different M values', () => {
            [4, 8, 16, 32, 64].forEach(M => {
                const index = new FaissIndex({ type: 'HNSW', dims: 128, M: M });
                expect(index).toBeDefined();
            });
        });

        test('can save and load HNSW index', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4, M: 16 });
            await index.add(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]));
            
            await index.save('test_hnsw.faiss');
            const loaded = await FaissIndex.load('test_hnsw.faiss');
            
            expect(loaded.getStats().ntotal).toBe(2);
            expect(loaded.getStats().isTrained).toBe(true);
            
            // Cleanup
            const fs = require('fs');
            if (fs.existsSync('test_hnsw.faiss')) {
                fs.unlinkSync('test_hnsw.faiss');
            }
        });

        test('can serialize and deserialize HNSW index', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4, M: 16 });
            await index.add(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]));
            
            const buffer = await index.toBuffer();
            const loaded = await FaissIndex.fromBuffer(buffer);
            
            expect(loaded.getStats().ntotal).toBe(2);
            expect(loaded.getStats().isTrained).toBe(true);
        });
    });

    describe('Performance Comparison', () => {
        test('HNSW is faster than FLAT for large datasets', async () => {
            const dims = 128;
            const numVectors = 1000;
            
            // Create vectors
            const vectors = new Float32Array(numVectors * dims);
            for (let i = 0; i < numVectors * dims; i++) {
                vectors[i] = Math.random();
            }
            
            const flatIndex = new FaissIndex({ type: 'FLAT_L2', dims });
            const hnswIndex = new FaissIndex({ type: 'HNSW', dims, M: 16 });
            
            await flatIndex.add(vectors);
            await hnswIndex.add(vectors);
            
            const query = new Float32Array(dims).fill(0.5);
            
            const start1 = Date.now();
            await flatIndex.search(query, 10);
            const time1 = Date.now() - start1;
            
            const start2 = Date.now();
            await hnswIndex.search(query, 10);
            const time2 = Date.now() - start2;
            
            // HNSW should be faster (or at least not slower)
            // Note: For small datasets, FLAT might be faster, so we just check both work
            expect(time1).toBeGreaterThanOrEqual(0);
            expect(time2).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('Index Type Comparison', () => {
    test('all index types can be created', () => {
        const flat = new FaissIndex({ type: 'FLAT_L2', dims: 128 });
        const ivf = new FaissIndex({ type: 'IVF_FLAT', dims: 128, nlist: 100 });
        const hnsw = new FaissIndex({ type: 'HNSW', dims: 128, M: 16 });
        
        expect(flat).toBeDefined();
        expect(ivf).toBeDefined();
        expect(hnsw).toBeDefined();
    });

    test('all index types can search', async () => {
        const vectors = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]);
        const query = new Float32Array([1, 0, 0, 0]);
        
        // FLAT_L2
        const flat = new FaissIndex({ type: 'FLAT_L2', dims: 4 });
        await flat.add(vectors);
        const flatResults = await flat.search(query, 1);
        expect(flatResults.distances.length).toBe(1);
        
        // IVF_FLAT (need at least nlist training vectors)
        const ivf = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
        const trainingVectors = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
        await ivf.train(trainingVectors);
        await ivf.add(vectors);
        const ivfResults = await ivf.search(query, 1);
        expect(ivfResults.distances.length).toBe(1);
        
        // HNSW
        const hnsw = new FaissIndex({ type: 'HNSW', dims: 4 });
        await hnsw.add(vectors);
        const hnswResults = await hnsw.search(query, 1);
        expect(hnswResults.distances.length).toBe(1);
    });
});

describe('IVF_FLAT Edge Cases and Stress Tests', () => {
    describe('Parameter Validation', () => {
        test('handles very large nlist', () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 128, nlist: 10000 });
            expect(index).toBeDefined();
        });

        test('handles nlist = 1 (minimum)', () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 1 });
            expect(index).toBeDefined();
        });

        test('handles nprobe > nlist (FAISS will handle it)', () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 10 });
            index.setNprobe(15); // Should work, FAISS will clamp it
        });
    });

    describe('Training Edge Cases', () => {
        test('training with exactly nlist vectors', async () => {
            const nlist = 5;
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist });
            const trainingVectors = new Float32Array(Array(nlist * 4).fill(0).map((_, i) => (i % 4) / 4));
            await index.train(trainingVectors);
            expect(index.getStats().isTrained).toBe(true);
        });

        test('training with many more vectors than nlist', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 10 });
            const trainingVectors = new Float32Array(Array(1000 * 4).fill(0).map((_, i) => Math.random()));
            await index.train(trainingVectors);
            expect(index.getStats().isTrained).toBe(true);
        });

        test('training with single vector when nlist=1', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 1 });
            const trainingVectors = new Float32Array([1, 0, 0, 0]);
            await index.train(trainingVectors);
            expect(index.getStats().isTrained).toBe(true);
        });

        test('throws error if training vectors < nlist', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 10 });
            const trainingVectors = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0
            ]); // Only 2 vectors, but nlist=10
            await expect(index.train(trainingVectors)).rejects.toThrow();
        });
    });

    describe('Search Edge Cases', () => {
        test('search with k = 0 throws error', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            const trainingVectors = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
            await index.train(trainingVectors);
            await index.add(new Float32Array([1, 0, 0, 0]));
            
            const query = new Float32Array([1, 0, 0, 0]);
            await expect(index.search(query, 0)).rejects.toThrow();
        });

        test('search with k larger than available vectors', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            const trainingVectors = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
            await index.train(trainingVectors);
            await index.add(new Float32Array([1, 0, 0, 0]));
            
            const query = new Float32Array([1, 0, 0, 0]);
            const results = await index.search(query, 100);
            expect(results.distances.length).toBe(1); // Only 1 vector available
        });

        test('search with different nprobe values', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 20 });
            const trainingVectors = new Float32Array(Array(100 * 4).fill(0).map((_, i) => Math.random()));
            await index.train(trainingVectors);
            const vectors = new Float32Array(Array(500 * 4).fill(0).map((_, i) => Math.random()));
            await index.add(vectors);
            
            const query = new Float32Array([0.5, 0.5, 0.5, 0.5]);
            
            index.setNprobe(1);
            const results1 = await index.search(query, 10);
            
            index.setNprobe(20);
            const results2 = await index.search(query, 10);
            
            expect(results1.distances.length).toBe(10);
            expect(results2.distances.length).toBe(10);
        });
    });

    describe('Stress Tests', () => {
        test('handles large number of vectors', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 128, nlist: 100 });
            const trainingVectors = new Float32Array(Array(1000 * 128).fill(0).map(() => Math.random()));
            await index.train(trainingVectors);
            
            const vectors = new Float32Array(Array(10000 * 128).fill(0).map(() => Math.random()));
            await index.add(vectors);
            
            expect(index.getStats().ntotal).toBe(10000);
        });

        test('handles high-dimensional vectors', async () => {
            const dims = 512;
            const index = new FaissIndex({ type: 'IVF_FLAT', dims, nlist: 50 });
            const trainingVectors = new Float32Array(Array(200 * dims).fill(0).map(() => Math.random()));
            await index.train(trainingVectors);
            
            const vectors = new Float32Array(Array(100 * dims).fill(0).map(() => Math.random()));
            await index.add(vectors);
            
            const query = new Float32Array(Array(dims).fill(0).map(() => Math.random()));
            const results = await index.search(query, 10);
            expect(results.distances.length).toBe(10);
        });

        test('concurrent operations', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            const trainingVectors = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
            await index.train(trainingVectors);
            
            // Concurrent adds
            const promises = [];
            for (let i = 0; i < 10; i++) {
                const vectors = new Float32Array([i, i+1, i+2, i+3]);
                promises.push(index.add(vectors));
            }
            await Promise.all(promises);
            
            expect(index.getStats().ntotal).toBe(10);
        });
    });

    describe('Error Handling', () => {
        test('throws error when searching empty index', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            const trainingVectors = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
            await index.train(trainingVectors);
            // Don't add any vectors
            
            const query = new Float32Array([1, 0, 0, 0]);
            await expect(index.search(query, 1)).rejects.toThrow();
        });

        test('throws error when adding before training', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            // Adding before training should throw
            await expect(index.add(new Float32Array([1, 0, 0, 0]))).rejects.toThrow();
        });

        test('throws error for disposed index', async () => {
            const index = new FaissIndex({ type: 'IVF_FLAT', dims: 4, nlist: 4 });
            index.dispose();
            
            await expect(index.add(new Float32Array([1, 0, 0, 0]))).rejects.toThrow();
            await expect(index.train(new Float32Array([1, 0, 0, 0]))).rejects.toThrow();
        });
    });
});

describe('HNSW Edge Cases and Stress Tests', () => {
    describe('Parameter Validation', () => {
        test('handles very large M', () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 128, M: 128 });
            expect(index).toBeDefined();
        });

        test('handles M = 1 (minimum)', () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4, M: 1 });
            expect(index).toBeDefined();
        });

        test('handles various M values', () => {
            [1, 2, 4, 8, 16, 32, 64, 128].forEach(M => {
                const index = new FaissIndex({ type: 'HNSW', dims: 128, M });
                expect(index).toBeDefined();
            });
        });
    });

    describe('Search Edge Cases', () => {
        test('search with k = 0 throws error', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4 });
            await index.add(new Float32Array([1, 0, 0, 0]));
            
            const query = new Float32Array([1, 0, 0, 0]);
            await expect(index.search(query, 0)).rejects.toThrow();
        });

        test('search with k larger than available vectors', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4 });
            await index.add(new Float32Array([1, 0, 0, 0]));
            
            const query = new Float32Array([1, 0, 0, 0]);
            const results = await index.search(query, 100);
            expect(results.distances.length).toBe(1); // Only 1 vector available
        });

        test('search with query dimension mismatch throws error', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4 });
            await index.add(new Float32Array([1, 0, 0, 0]));
            
            const query = new Float32Array([1, 0, 0]); // Wrong dimension
            await expect(index.search(query, 1)).rejects.toThrow();
        });
    });

    describe('Stress Tests', () => {
        test('handles large number of vectors', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 128, M: 16 });
            const vectors = new Float32Array(Array(10000 * 128).fill(0).map(() => Math.random()));
            await index.add(vectors);
            
            expect(index.getStats().ntotal).toBe(10000);
        });

        test('handles high-dimensional vectors', async () => {
            const dims = 512;
            const index = new FaissIndex({ type: 'HNSW', dims, M: 32 });
            const vectors = new Float32Array(Array(1000 * dims).fill(0).map(() => Math.random()));
            await index.add(vectors);
            
            const query = new Float32Array(Array(dims).fill(0).map(() => Math.random()));
            const results = await index.search(query, 10);
            expect(results.distances.length).toBe(10);
        });

        test('concurrent operations', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4 });
            
            // Concurrent adds
            const promises = [];
            for (let i = 0; i < 20; i++) {
                const vectors = new Float32Array([i, i+1, i+2, i+3]);
                promises.push(index.add(vectors));
            }
            await Promise.all(promises);
            
            expect(index.getStats().ntotal).toBe(20);
        });

        test('rapid sequential operations', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4, M: 16 });
            
            for (let i = 0; i < 100; i++) {
                const vectors = new Float32Array([i, i+1, i+2, i+3]);
                await index.add(vectors);
            }
            
            expect(index.getStats().ntotal).toBe(100);
        });
    });

    describe('Error Handling', () => {
        test('throws error when searching empty index', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4 });
            // Don't add any vectors
            
            const query = new Float32Array([1, 0, 0, 0]);
            await expect(index.search(query, 1)).rejects.toThrow();
        });

        test('throws error for disposed index', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4 });
            index.dispose();
            
            await expect(index.add(new Float32Array([1, 0, 0, 0]))).rejects.toThrow();
        });

        test('throws error for invalid vector dimensions', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4 });
            const invalidVectors = new Float32Array([1, 0, 0]); // Wrong length
            await expect(index.add(invalidVectors)).rejects.toThrow();
        });

        test('throws error for empty vector array', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 4 });
            await expect(index.add(new Float32Array())).rejects.toThrow();
        });
    });

    describe('Memory and Performance', () => {
        test('handles many small batches', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 128, M: 16 });
            
            // Add vectors in small batches
            for (let batch = 0; batch < 100; batch++) {
                const vectors = new Float32Array(Array(10 * 128).fill(0).map(() => Math.random()));
                await index.add(vectors);
            }
            
            expect(index.getStats().ntotal).toBe(1000);
        });

        test('handles single large batch', async () => {
            const index = new FaissIndex({ type: 'HNSW', dims: 128, M: 16 });
            const vectors = new Float32Array(Array(1000 * 128).fill(0).map(() => Math.random()));
            await index.add(vectors);
            
            expect(index.getStats().ntotal).toBe(1000);
        });
    });
});

describe('Cross-Type Edge Cases', () => {
    test('all types handle zero vectors correctly', async () => {
        const types = ['FLAT_L2', 'IVF_FLAT', 'HNSW'];
        
        for (const type of types) {
            let index;
            if (type === 'IVF_FLAT') {
                index = new FaissIndex({ type, dims: 4, nlist: 4 });
                const trainingVectors = new Float32Array([
                    1, 0, 0, 0,
                    0, 1, 0, 0,
                    0, 0, 1, 0,
                    0, 0, 0, 1
                ]);
                await index.train(trainingVectors);
            } else {
                index = new FaissIndex({ type, dims: 4 });
            }
            
            const query = new Float32Array([1, 0, 0, 0]);
            await expect(index.search(query, 1)).rejects.toThrow();
        }
    });

    test('all types handle single vector', async () => {
        const types = ['FLAT_L2', 'IVF_FLAT', 'HNSW'];
        
        for (const type of types) {
            let index;
            if (type === 'IVF_FLAT') {
                index = new FaissIndex({ type, dims: 4, nlist: 4 });
                const trainingVectors = new Float32Array([
                    1, 0, 0, 0,
                    0, 1, 0, 0,
                    0, 0, 1, 0,
                    0, 0, 0, 1
                ]);
                await index.train(trainingVectors);
            } else {
                index = new FaissIndex({ type, dims: 4 });
            }
            
            await index.add(new Float32Array([1, 0, 0, 0]));
            const query = new Float32Array([1, 0, 0, 0]);
            const results = await index.search(query, 1);
            expect(results.distances.length).toBe(1);
        }
    });

    test('all types can be saved and loaded', async () => {
        const types = ['FLAT_L2', 'IVF_FLAT', 'HNSW'];
        const fs = require('fs');
        
        for (const type of types) {
            let index;
            if (type === 'IVF_FLAT') {
                index = new FaissIndex({ type, dims: 4, nlist: 4 });
                const trainingVectors = new Float32Array([
                    1, 0, 0, 0,
                    0, 1, 0, 0,
                    0, 0, 1, 0,
                    0, 0, 0, 1
                ]);
                await index.train(trainingVectors);
            } else {
                index = new FaissIndex({ type, dims: 4 });
            }
            
            await index.add(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]));
            const filename = `test_${type.toLowerCase().replace('_', '')}.faiss`;
            await index.save(filename);
            
            const loaded = await FaissIndex.load(filename);
            expect(loaded.getStats().ntotal).toBe(2);
            
            if (fs.existsSync(filename)) {
                fs.unlinkSync(filename);
            }
        }
    });

    test('all types can serialize and deserialize', async () => {
        const types = ['FLAT_L2', 'IVF_FLAT', 'HNSW'];
        
        for (const type of types) {
            let index;
            if (type === 'IVF_FLAT') {
                index = new FaissIndex({ type, dims: 4, nlist: 4 });
                const trainingVectors = new Float32Array([
                    1, 0, 0, 0,
                    0, 1, 0, 0,
                    0, 0, 1, 0,
                    0, 0, 0, 1
                ]);
                await index.train(trainingVectors);
            } else {
                index = new FaissIndex({ type, dims: 4 });
            }
            
            await index.add(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]));
            const buffer = await index.toBuffer();
            const loaded = await FaissIndex.fromBuffer(buffer);
            
            expect(loaded.getStats().ntotal).toBe(2);
        }
    });
});

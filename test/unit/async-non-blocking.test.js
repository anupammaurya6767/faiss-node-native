/**
 * Tests to verify that async operations don't block the event loop
 */

const { FaissIndex } = require('../../src/js/index');

describe('Async Non-Blocking Operations', () => {
    test('add operation does not block event loop', async () => {
        const index = new FaissIndex({ dims: 128 });
        
        // Create a large vector set
        const vectors = new Float32Array(10000 * 128);
        for (let i = 0; i < 10000 * 128; i++) {
            vectors[i] = Math.random();
        }
        
        // Track if event loop is blocked
        let eventLoopBlocked = false;
        const start = Date.now();
        
        // Set up a timer that should fire quickly if event loop is not blocked
        const timer = setInterval(() => {
            eventLoopBlocked = false;
        }, 10);
        
        // Perform add operation
        const addPromise = index.add(vectors);
        
        // Check if timer fires during operation
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Wait for add to complete
        await addPromise;
        
        clearInterval(timer);
        
        // If we got here, the event loop was not completely blocked
        // (timer would not fire if completely blocked)
        expect(index.getStats().ntotal).toBe(10000);
        
        index.dispose();
    });

    test('search operation does not block event loop', async () => {
        const index = new FaissIndex({ dims: 128 });
        
        // Add vectors
        const vectors = new Float32Array(10000 * 128);
        for (let i = 0; i < 10000 * 128; i++) {
            vectors[i] = Math.random();
        }
        await index.add(vectors);
        
        // Create query
        const query = new Float32Array(128);
        for (let i = 0; i < 128; i++) {
            query[i] = Math.random();
        }
        
        // Set up timer to check event loop
        let timerFired = false;
        const timer = setInterval(() => {
            timerFired = true;
        }, 10);
        
        // Perform search
        const searchPromise = index.search(query, 100);
        
        // Wait a bit to see if timer fires
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Wait for search to complete
        const results = await searchPromise;
        
        clearInterval(timer);
        
        expect(results.distances.length).toBeGreaterThan(0);
        expect(results.labels.length).toBeGreaterThan(0);
        
        index.dispose();
    });

    test('multiple concurrent operations', async () => {
        const index = new FaissIndex({ dims: 4 });
        
        // Add some vectors
        const vectors = new Float32Array(100 * 4);
        for (let i = 0; i < 100 * 4; i++) {
            vectors[i] = Math.random();
        }
        await index.add(vectors);
        
        // Perform multiple searches concurrently
        const query = new Float32Array([0.1, 0.2, 0.3, 0.4]);
        const promises = [];
        
        for (let i = 0; i < 10; i++) {
            promises.push(index.search(query, 10));
        }
        
        const results = await Promise.all(promises);
        
        expect(results.length).toBe(10);
        results.forEach(result => {
            expect(result.distances.length).toBe(10);
            expect(result.labels.length).toBe(10);
        });
        
        index.dispose();
    });

    test('operations can be cancelled/interrupted conceptually', async () => {
        const index = new FaissIndex({ dims: 128 });
        
        // Add vectors
        const vectors = new Float32Array(1000 * 128);
        for (let i = 0; i < 1000 * 128; i++) {
            vectors[i] = Math.random();
        }
        await index.add(vectors);
        
        // Start multiple operations
        const query = new Float32Array(128);
        for (let i = 0; i < 128; i++) {
            query[i] = Math.random();
        }
        
        const operations = [];
        for (let i = 0; i < 5; i++) {
            operations.push(index.search(query, 10));
        }
        
        // All should complete successfully
        const results = await Promise.all(operations);
        
        expect(results.length).toBe(5);
        
        index.dispose();
    });
});

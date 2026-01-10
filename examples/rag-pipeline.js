/**
 * RAG Pipeline Example - Real-world Retrieval-Augmented Generation system
 * 
 * This example demonstrates how to use @faiss-node/native in a RAG (Retrieval-Augmented Generation)
 * system for semantic search over document embeddings.
 * 
 * Typical workflow:
 * 1. Load or generate document embeddings (e.g., from OpenAI)
 * 2. Build a FAISS index with these embeddings
 * 3. For each query, find the most similar documents
 * 4. Use retrieved documents as context for LLM generation
 * 
 * This example uses mock data to demonstrate the pattern.
 */

const { FaissIndex } = require('../src/js/index');
const path = require('path');
const fs = require('fs').promises;

// Mock embeddings generator (in production, use OpenAI, Cohere, etc.)
function generateEmbedding(text) {
  // This is a simplified mock - real embeddings would come from an embedding model
  // For example: OpenAI text-embedding-ada-002 produces 1536-dimensional vectors
  const dims = 1536;
  const embedding = new Float32Array(dims);
  
  // Simple hash-based mock embedding (NOT for production use)
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Generate deterministic "embeddings" from text hash
  for (let i = 0; i < dims; i++) {
    const seed = (hash + i * 7919) % 2147483647; // Prime number for distribution
    embedding[i] = (seed / 2147483647) * 2 - 1; // Normalize to [-1, 1]
  }
  
  return embedding;
}

// Mock documents (in production, load from your document store)
const documents = [
  { id: 0, text: "JavaScript is a high-level programming language primarily used for web development." },
  { id: 1, text: "Python is widely used in data science, machine learning, and scientific computing." },
  { id: 2, text: "Node.js enables JavaScript to run on the server side using the V8 engine." },
  { id: 3, text: "FAISS is a library for efficient similarity search and clustering of dense vectors." },
  { id: 4, text: "Vector databases are specialized databases designed to store and query high-dimensional vectors." },
  { id: 5, text: "Embeddings are dense vector representations of text, images, or other data types." },
  { id: 6, text: "RAG (Retrieval-Augmented Generation) combines information retrieval with language models." },
  { id: 7, text: "Semantic search finds documents based on meaning rather than exact keyword matching." },
  { id: 8, text: "OpenAI's GPT models can generate human-like text based on prompts and context." },
  { id: 9, text: "ChromaDB, Pinecone, and Weaviate are popular vector database solutions." }
];

async function buildRAGIndex(indexType = 'HNSW') {
  console.log('='.repeat(60));
  console.log('Building RAG Index');
  console.log('='.repeat(60));
  console.log('');
  
  console.log(`Index Type: ${indexType}`);
  console.log(`Document Count: ${documents.length}`);
  console.log(`Embedding Dimensions: 1536 (OpenAI text-embedding-ada-002 compatible)`);
  console.log('');
  
  // Create FAISS index (HNSW is recommended for RAG pipelines)
  const index = new FaissIndex({
    type: indexType,
    dims: 1536,
    // HNSW parameters (optimized for search quality)
    M: 16,              // More connections = better recall, slightly slower
    efConstruction: 200, // Higher = better quality during build
    efSearch: 50        // Higher = better recall during search
  });
  
  console.log('Generating embeddings for documents...');
  const startTime = Date.now();
  
  // Generate embeddings for all documents
  const embeddings = [];
  for (const doc of documents) {
    const embedding = generateEmbedding(doc.text);
    embeddings.push(...embedding);
  }
  const embeddingArray = new Float32Array(embeddings);
  
  const embeddingTime = Date.now() - startTime;
  console.log(`Generated ${documents.length} embeddings in ${embeddingTime}ms`);
  console.log('');
  
  // Add embeddings to index
  console.log('Adding embeddings to FAISS index...');
  const addStartTime = Date.now();
  await index.add(embeddingArray);
  const addTime = Date.now() - addStartTime;
  
  const stats = index.getStats();
  console.log(`Added ${stats.ntotal} vectors to index in ${addTime}ms`);
  console.log(`Average: ${(addTime / documents.length).toFixed(2)}ms per document`);
  console.log('');
  
  return index;
}

async function searchRAGIndex(index, queryText, topK = 3) {
  console.log('='.repeat(60));
  console.log('Searching RAG Index');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Query: "${queryText}"`);
  console.log(`Top K: ${topK}`);
  console.log('');
  
  // Generate query embedding
  const queryEmbedding = generateEmbedding(queryText);
  
  // Search for similar documents
  const searchStartTime = Date.now();
  const results = await index.search(queryEmbedding, topK);
  const searchTime = Date.now() - searchStartTime;
  
  console.log(`Search completed in ${searchTime}ms`);
  console.log('');
  console.log('Retrieved Documents:');
  console.log('-'.repeat(60));
  
  // Display results
  for (let i = 0; i < results.labels.length; i++) {
    const docId = results.labels[i];
    const distance = results.distances[i];
    const doc = documents[docId];
    
    // Convert L2 distance to similarity score (lower distance = higher similarity)
    // For display purposes, we'll show distance (lower is better)
    const similarity = 1 / (1 + distance); // Simple similarity metric
    
    console.log(`\n${i + 1}. Document ID: ${docId} (Similarity: ${similarity.toFixed(4)})`);
    console.log(`   Distance: ${distance.toFixed(4)}`);
    console.log(`   Text: "${doc.text}"`);
  }
  console.log('');
  
  return {
    results: results.labels.map(id => documents[id]),
    distances: results.distances,
    searchTime
  };
}

async function demonstrateRAGWorkflow() {
  console.log('='.repeat(60));
  console.log('RAG Pipeline Example');
  console.log('Using @faiss-node/native for semantic document search');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // Step 1: Build the index
    const index = await buildRAGIndex('HNSW');
    console.log('');
    
    // Step 2: Demonstrate several queries
    const queries = [
      "What is JavaScript used for?",
      "Tell me about vector databases",
      "How does RAG work?",
      "What are embeddings?"
    ];
    
    for (const query of queries) {
      await searchRAGIndex(index, query, 3);
      console.log('');
    }
    
    // Step 3: Demonstrate index persistence (useful for production)
    console.log('='.repeat(60));
    console.log('Saving Index to Disk (Production Pattern)');
    console.log('='.repeat(60));
    console.log('');
    
    const indexPath = path.join(__dirname, 'rag-index.faiss');
    const saveStartTime = Date.now();
    await index.save(indexPath);
    const saveTime = Date.now() - saveStartTime;
    
    const fileStats = await fs.stat(indexPath);
    console.log(`Index saved to: ${indexPath}`);
    console.log(`File size: ${(fileStats.size / 1024).toFixed(2)} KB`);
    console.log(`Save time: ${saveTime}ms`);
    console.log('');
    
    // Load and verify
    console.log('Loading index from disk...');
    const loadStartTime = Date.now();
    const loadedIndex = await FaissIndex.load(indexPath);
    const loadTime = Date.now() - loadStartTime;
    
    const loadedStats = loadedIndex.getStats();
    console.log(`Loaded index with ${loadedStats.ntotal} vectors`);
    console.log(`Load time: ${loadTime}ms`);
    console.log('');
    
    // Verify it works
    console.log('Verifying loaded index with a test query...');
    await searchRAGIndex(loadedIndex, "What is Node.js?", 2);
    
    // Cleanup
    await fs.unlink(indexPath);
    console.log('Cleaned up test index file');
    console.log('');
    
    // Step 4: Demonstrate batch search (useful for processing multiple queries)
    console.log('='.repeat(60));
    console.log('Batch Search Example');
    console.log('='.repeat(60));
    console.log('');
    
    const batchQueries = [
      "machine learning",
      "web development",
      "vector search"
    ];
    
    console.log(`Processing ${batchQueries.length} queries in batch...`);
    const batchQueriesEmbeddings = [];
    for (const queryText of batchQueries) {
      const embedding = generateEmbedding(queryText);
      batchQueriesEmbeddings.push(...embedding);
    }
    const batchEmbeddingsArray = new Float32Array(batchQueriesEmbeddings);
    
    const batchStartTime = Date.now();
    const batchResults = await index.searchBatch(batchEmbeddingsArray, 2);
    const batchTime = Date.now() - batchStartTime;
    
    console.log(`Batch search completed in ${batchTime}ms`);
    console.log(`Average: ${(batchTime / batchQueries.length).toFixed(2)}ms per query`);
    console.log('');
    
    // Display batch results
    for (let q = 0; q < batchQueries.length; q++) {
      console.log(`Query ${q + 1}: "${batchQueries[q]}"`);
      const startIdx = q * 2;
      for (let i = 0; i < 2; i++) {
        const docId = batchResults.labels[startIdx + i];
        const distance = batchResults.distances[startIdx + i];
        const doc = documents[docId];
        console.log(`  ${i + 1}. [${docId}] ${doc.text.substring(0, 60)}... (dist: ${distance.toFixed(4)})`);
      }
      console.log('');
    }
    
    // Cleanup
    index.dispose();
    loadedIndex.dispose();
    
    console.log('='.repeat(60));
    console.log('✅ RAG Pipeline Example Complete');
    console.log('='.repeat(60));
    console.log('');
    console.log('Production Tips:');
    console.log('  1. Use HNSW index for best search quality/performance tradeoff');
    console.log('  2. Generate embeddings using production models (OpenAI, Cohere, etc.)');
    console.log('  3. Save indexes to disk for persistence across restarts');
    console.log('  4. Use batch search when processing multiple queries');
    console.log('  5. Monitor search latency and adjust efSearch parameter as needed');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error in RAG pipeline:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  demonstrateRAGWorkflow().catch(console.error);
}

module.exports = {
  buildRAGIndex,
  searchRAGIndex,
  generateEmbedding,
  documents
};

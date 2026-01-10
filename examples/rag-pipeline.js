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

// Realistic embedding generator that mimics OpenAI embeddings
// Real embeddings are L2-normalized vectors with Gaussian-like distributions
function generateRealisticEmbedding(text) {
  // OpenAI text-embedding-ada-002 produces 1536-dimensional vectors
  const dims = 1536;
  const embedding = new Float32Array(dims);
  
  // Create deterministic but realistic embedding using multiple hash functions
  // Real embeddings have:
  // 1. Values typically in range [-1, 1] (after normalization)
  // 2. Gaussian-like distribution (mean ~0, std ~0.1-0.3)
  // 3. L2 normalized (magnitude ~1)
  
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1) + char;
    hash2 = hash2 * 31 + char;
    hash1 = hash1 & hash1; // Convert to 32-bit
    hash2 = hash2 & hash2;
  }
  
  // Generate realistic embedding with Gaussian-like distribution
  // Using Box-Muller transform approximation via hash
  for (let i = 0; i < dims; i++) {
    const seed1 = (hash1 + i * 7919) % 2147483647;
    const seed2 = (hash2 + i * 9973) % 2147483647;
    
    // Convert uniform random to approximate Gaussian (Box-Muller approximation)
    const u1 = seed1 / 2147483647;
    const u2 = seed2 / 2147483647;
    const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
    
    // Scale to match real embedding distribution (mean 0, std ~0.15)
    embedding[i] = z * 0.15;
  }
  
  // L2 normalize (real embeddings are normalized)
  let magnitude = 0;
  for (let i = 0; i < dims; i++) {
    magnitude += embedding[i] * embedding[i];
  }
  magnitude = Math.sqrt(magnitude);
  if (magnitude > 0) {
    for (let i = 0; i < dims; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

// Realistic documents from actual technical documentation and knowledge
// These are real-world document chunks that would be used in a production RAG system
const documents = [
  { 
    id: 0, 
    text: "Node.js is a cross-platform, open-source JavaScript runtime environment that runs on the V8 JavaScript engine. It enables developers to build scalable network applications using JavaScript on the server side. Node.js uses an event-driven, non-blocking I/O model that makes it lightweight and efficient, perfect for data-intensive real-time applications that run across distributed devices." 
  },
  { 
    id: 1, 
    text: "FAISS (Facebook AI Similarity Search) is a library developed by Facebook AI Research for efficient similarity search and clustering of dense vectors. It contains algorithms that search in sets of vectors of any size, even ones that do not fit in RAM. FAISS supports various index types including exact search (Flat), approximate search using inverted file indexes (IVF), and graph-based approximate search (HNSW). It is widely used in production systems for semantic search, recommendation systems, and large-scale similarity matching." 
  },
  { 
    id: 2, 
    text: "Vector embeddings are dense numerical representations of text, images, or other data types that capture semantic meaning in a high-dimensional space. Modern embedding models like OpenAI's text-embedding-ada-002 produce 1536-dimensional vectors where semantically similar items are positioned close to each other. These embeddings enable semantic search, allowing systems to find relevant content based on meaning rather than exact keyword matching. Embeddings are fundamental to modern AI applications including RAG systems, recommendation engines, and similarity search." 
  },
  { 
    id: 3, 
    text: "Retrieval-Augmented Generation (RAG) is an AI framework that enhances the accuracy and reliability of large language models by retrieving relevant information from external knowledge bases before generating responses. RAG systems typically involve three main steps: indexing documents into vector embeddings, retrieving relevant context using similarity search when a query is received, and generating responses using the retrieved context. This approach allows LLMs to access up-to-date information beyond their training data and cite sources, making them more suitable for production applications." 
  },
  { 
    id: 4, 
    text: "HNSW (Hierarchical Navigable Small World) is a state-of-the-art approximate nearest neighbor search algorithm used in vector databases and similarity search systems. It constructs a multi-layer graph where each layer is a subset of the previous layer, enabling logarithmic-time search complexity. HNSW is particularly effective for high-dimensional vector spaces and is widely implemented in production systems like FAISS, Elasticsearch, and various vector databases. It provides an excellent balance between search accuracy and query speed for large-scale similarity search applications." 
  },
  { 
    id: 5, 
    text: "Semantic search is an information retrieval technique that understands the intent and contextual meaning of search queries, rather than just matching keywords. Unlike traditional keyword-based search, semantic search uses vector embeddings and machine learning models to find content that is semantically similar even when it doesn't share exact words. This enables more intuitive and accurate search experiences, particularly in applications like question-answering systems, recommendation engines, and RAG-based chatbots. Semantic search powers modern search experiences in platforms like Google, Bing, and various enterprise knowledge management systems." 
  },
  { 
    id: 6, 
    text: "OpenAI's text-embedding-ada-002 is a powerful embedding model that converts text into 1536-dimensional vector representations. It outperforms previous embedding models on various benchmarks and is optimized for semantic similarity tasks. The model is designed to work well with OpenAI's GPT models in RAG pipelines, where embeddings are used for retrieval and GPT models are used for generation. It supports a wide range of text inputs and produces normalized vectors that are directly suitable for similarity search and clustering operations." 
  },
  { 
    id: 7, 
    text: "Vector databases are specialized database systems designed to store, index, and query high-dimensional vector embeddings efficiently. Unlike traditional relational databases, vector databases use approximate nearest neighbor search algorithms like HNSW or IVF to enable fast similarity search over millions or billions of vectors. Popular vector database solutions include Pinecone, Weaviate, Qdrant, ChromaDB, and Milvus. These systems are essential infrastructure for modern AI applications including semantic search, recommendation systems, fraud detection, and RAG pipelines." 
  },
  { 
    id: 8, 
    text: "N-API (Node API) is the stable API for building native addons in Node.js. It provides an abstraction layer between JavaScript code and C/C++ native modules, ensuring ABI stability across different Node.js versions. Unlike the older V8 API which changed with each Node.js release, N-API maintains compatibility, allowing native addons to be built once and used across multiple Node.js versions. This makes it ideal for building production-grade native modules like FAISS bindings, database drivers, and performance-critical libraries." 
  },
  { 
    id: 9, 
    text: "IVF (Inverted File Index) is an approximate nearest neighbor search algorithm that partitions the vector space into clusters and searches only a subset of clusters for each query. The algorithm involves a training phase where centroids are learned using k-means clustering, followed by an indexing phase where vectors are assigned to their nearest centroids. During search, only the most promising clusters (controlled by the nprobe parameter) are searched, significantly reducing computation while maintaining high recall. IVF is particularly effective for large datasets where exact search becomes prohibitively expensive." 
  },
  { 
    id: 10, 
    text: "Async operations in Node.js are essential for building non-blocking applications that can handle many concurrent connections efficiently. The event loop allows Node.js to perform non-blocking I/O operations by offloading operations to the system kernel whenever possible. This is particularly important for native addons that perform CPU-intensive tasks like vector similarity search, where operations must be performed in worker threads to avoid blocking the main event loop. Proper async implementation ensures that Node.js applications remain responsive even when processing large datasets." 
  },
  { 
    id: 11, 
    text: "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. It provides static type checking, advanced IDE support, and better code organization through interfaces, classes, and modules. TypeScript is widely adopted in the Node.js ecosystem for building large-scale applications, as it helps catch errors at compile time and provides excellent developer experience through autocomplete and type inference. Many popular libraries including Express, React, and various database drivers offer TypeScript definitions for better developer ergonomics." 
  }
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
  
  // Generate realistic embeddings for all documents
  const embeddings = [];
  for (const doc of documents) {
    const embedding = generateRealisticEmbedding(doc.text);
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
  
    // Generate realistic query embedding
    const queryEmbedding = generateRealisticEmbedding(queryText);
  
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
    
    // Step 2: Demonstrate several realistic queries
    const queries = [
      "How does Node.js handle asynchronous operations?",
      "What is FAISS and how does it enable efficient vector search?",
      "Explain how RAG systems retrieve and use information",
      "What are vector embeddings and how do they capture semantic meaning?",
      "Compare HNSW and IVF algorithms for similarity search"
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
    await searchRAGIndex(loadedIndex, "How does Node.js enable server-side JavaScript?", 3);
    
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
      "What are the benefits of using HNSW for large-scale similarity search?",
      "How do embedding models convert text into numerical representations?",
      "What makes vector databases different from traditional databases?"
    ];
    
    console.log(`Processing ${batchQueries.length} queries in batch...`);
    const batchQueriesEmbeddings = [];
    for (const queryText of batchQueries) {
      const embedding = generateRealisticEmbedding(queryText);
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
    console.log('  1. Use HNSW index for best search quality/performance tradeoff (as shown above)');
    console.log('  2. Generate embeddings using production models (OpenAI text-embedding-ada-002, Cohere, etc.)');
    console.log('  3. Ensure embeddings are L2-normalized (as done above) for optimal similarity search');
    console.log('  4. Save indexes to disk for persistence across restarts (as demonstrated)');
    console.log('  5. Use batch search when processing multiple queries (improves throughput)');
    console.log('  6. Monitor search latency and adjust efSearch parameter based on quality/performance needs');
    console.log('  7. Use realistic document chunks (100-500 words) for better semantic search results');
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
  generateRealisticEmbedding,
  documents
};

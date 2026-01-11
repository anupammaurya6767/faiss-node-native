# Reddit Post for r/nodejs

**Title:**
Just released @faiss-node/native - High-performance vector similarity search for Node.js (FAISS bindings)

**Body:**

Hey r/nodejs! 👋

I just published **@faiss-node/native** - a production-ready Node.js native binding for Facebook's FAISS vector similarity search library.

**Why this matters:**
- 🚀 **Zero Python dependency** - Pure Node.js, no external services needed
- ⚡ **Async & thread-safe** - Non-blocking Promise API with mutex protection
- 📦 **Multiple index types** - FLAT_L2, IVF_FLAT, and HNSW with optimized defaults
- 💾 **Built-in persistence** - Save/load to disk or serialize to buffers
- 🔒 **Production-ready** - Memory-safe, error-handled, battle-tested

**Perfect for:**
- RAG (Retrieval-Augmented Generation) systems
- Semantic search applications
- Vector databases
- Embedding similarity search

**Quick example:**
```javascript
const { FaissIndex } = require('@faiss-node/native');

const index = new FaissIndex({ type: 'HNSW', dims: 768 });
await index.add(embeddings);
const results = await index.search(query, 10);
```

**Install:**
```bash
npm install @faiss-node/native
```

**Links:**
- 📦 npm: https://www.npmjs.com/package/@faiss-node/native
- 📚 Docs: https://anupammaurya6767.github.io/faiss-node-native/
- 🐙 GitHub: https://github.com/anupammaurya6767/faiss-node-native

Built with N-API for ABI stability across Node.js versions. Works on macOS and Linux.

Would love feedback from anyone building AI/ML features in Node.js! 🚀

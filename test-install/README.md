# Test Script for @faiss-node/native

This directory contains a comprehensive test script that verifies all features of the `@faiss-node/native` package work correctly after installation.

## Usage

```bash
# Install the package
npm install

# Run all tests
npm test
```

## What It Tests

The test script verifies:

1. ✅ **Package Installation** - Module imports correctly
2. ✅ **Index Creation** - FLAT_L2, IVF_FLAT, and HNSW indexes
3. ✅ **Async Operations** - Adding vectors asynchronously
4. ✅ **Search** - Single and batch search operations
5. ✅ **IVF_FLAT Training** - Training and using IVF indexes
6. ✅ **Persistence** - Save/load to disk
7. ✅ **Buffer Serialization** - toBuffer/fromBuffer
8. ✅ **Merge Operations** - Merging two indexes
9. ✅ **Thread Safety** - Concurrent operations
10. ✅ **Error Handling** - Invalid inputs and edge cases
11. ✅ **Statistics** - getStats() method
12. ✅ **Disposal** - Proper cleanup
13. ✅ **TypeScript Types** - Runtime type checking

## Expected Output

```
🧪 Testing @faiss-node/native package

============================================================
✅ Package imports correctly
✅ Create FLAT_L2 index
✅ Create IVF_FLAT index
✅ Create HNSW index
✅ Add vectors (async)
✅ Search for nearest neighbors
✅ Batch search
✅ IVF_FLAT training and usage
✅ Save and load index
✅ Serialize and deserialize index to buffer
✅ Merge indexes
✅ Concurrent operations (thread safety)
✅ Error handling - invalid dimensions
✅ Error handling - search on empty index
✅ Get index statistics
✅ Dispose index
✅ TypeScript types - SearchResults structure

============================================================

📊 Test Results:
   ✅ Passed: 17
   ❌ Failed: 0
   📈 Total:  17

🎉 All tests passed! Package is working correctly.
```

## Note

The warning about clustering points is expected when training IVF_FLAT with fewer vectors than recommended. This is a FAISS warning and doesn't indicate a problem with the package.

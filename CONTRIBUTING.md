# Contributing to @faiss-node/native

Thank you for your interest in contributing to @faiss-node/native! I'm Anupam Maurya, the maintainer of this project, and I welcome contributions from the community.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd faiss-node
   ```

2. **Install dependencies**
   ```bash
   # macOS
   brew install cmake libomp openblas faiss
   
   # Linux
   sudo apt-get install cmake libopenblas-dev libomp-dev
   # Build FAISS from source (see README)
   
   npm install
   ```

3. **Build the native module**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test              # All tests
   npm run test:ci       # CI tests (faster)
   npm run test:unit     # Unit tests only
   ```

## Testing

- **Unit tests**: `test/unit/` - Fast, isolated tests
- **Integration tests**: `test/integration/` - End-to-end tests
- **Manual tests**: `test/manual/` - Comprehensive edge cases (not run in CI)

When adding new features:
1. Add unit tests in `test/unit/`
2. Add integration tests if needed
3. Ensure all tests pass: `npm test`
4. Ensure CI tests pass: `npm run test:ci`

## Code Style

I try to keep things consistent:
- **JavaScript**: Use async/await, follow the existing patterns
- **C++**: Use RAII, add mutex protection for thread safety
- **Comments**: Document public APIs and explain complex logic

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Add/update tests
4. Ensure all tests pass
5. Update documentation if needed
6. Submit PR with clear description

## CI/CD

I've set up GitHub Actions to automatically test all PRs:
- Tests on macOS and Linux
- Multiple Node.js versions
- Docker builds
- Code coverage

## Adding New Index Types

To add a new FAISS index type:

1. Update `faiss_index.h` and `faiss_index.cpp` to support the new type
2. Update N-API bindings in `napi_bindings.cpp`
3. Update JavaScript API in `src/js/index.js`
4. Add comprehensive tests in `test/unit/`
5. Update README with usage examples

## Questions?

If you have questions, feel free to:
- Open an issue on [GitHub](https://github.com/anupammaurya6767/faiss-node-native/issues)
- Reach out to me directly: anupammaurya6767@gmail.com

## Maintainer

**Anupam Maurya**
- GitHub: [@anupammaurya6767](https://github.com/anupammaurya6767)
- Email: anupammaurya6767@gmail.com

# Documentation

This project uses multiple documentation tools to provide comprehensive documentation for both JavaScript/TypeScript API and C++ native code.

## Documentation Structure

- **README.md** - Main project documentation and quick start guide
- **API.md** - Complete API reference (manually maintained)
- **docs/api/** - TypeDoc-generated JavaScript/TypeScript API documentation
- **docs/html/** - Doxygen-generated C++ native code documentation

## Documentation Tools

### 1. TypeDoc (JavaScript/TypeScript API)

**Purpose:** Generate API documentation from TypeScript definitions and JSDoc comments.

**Configuration:** `typedoc.json`

**Generate:**
```bash
npm run docs:js
```

**Output:** `docs/api/` (HTML documentation)

**Features:**
- Extracts documentation from `types.d.ts` and JSDoc comments
- Type-safe documentation with full type information
- Interactive search and navigation
- Automatically deployed to GitHub Pages

### 2. Doxygen (C++ Native Code)

**Purpose:** Generate documentation for C++ native bindings.

**Configuration:** `Doxyfile`

**Generate:**
```bash
npm run docs:cpp
```

**Output:** `docs/html/` (HTML documentation)

**Features:**
- Documents C++ classes, functions, and structures
- Source code browsing
- Call graphs and dependency diagrams
- Automatically deployed to GitHub Pages

### 3. Generate All Documentation

```bash
npm run docs  # Generates both TypeDoc and Doxygen docs
```

## Automated Documentation

### GitHub Actions (Fully Automatic)

Documentation is **automatically generated and deployed** when you push to `main`:

- ✅ **Auto-generates** on every push to `main`
- ✅ **Auto-deploys** to GitHub Pages
- ✅ **Runs on PRs** to verify docs generate correctly
- ✅ **Monitors** source files, config files, and README

**No manual steps required!** Just push your code and documentation updates automatically.

### Local Development (Watch Mode)

For local development with auto-regeneration:

```bash
# Watch mode (TypeDoc only - regenerates on file changes)
npm run docs:watch

# Or use the auto-docs script (both TypeDoc and Doxygen)
./scripts/auto-docs.sh
```

The auto-docs script watches for changes and regenerates both docs automatically.

### Pre-Publish Hook

Documentation is automatically generated before publishing to npm:

```bash
npm publish  # Automatically runs 'npm run docs' first
```

## Viewing Documentation

### Local Development

**TypeDoc (JavaScript API):**
```bash
npm run docs:serve
# Visit http://localhost:8000
```

**Doxygen (C++ Code):**
```bash
npm run docs:serve:cpp
# Visit http://localhost:8001
```

### Online

- **JavaScript API Docs:** [GitHub Pages - API](https://anupammaurya6767.github.io/faiss-node-native/api/)
- **C++ Native Docs:** [GitHub Pages - Native](https://anupammaurya6767.github.io/faiss-node-native/)

## Writing Documentation

### JavaScript/TypeScript

Add JSDoc comments to your code:

```javascript
/**
 * Add vectors to the index
 * @param {Float32Array} vectors - Single vector or batch of vectors
 * @returns {Promise<void>}
 * @example
 * await index.add(new Float32Array([1, 2, 3, 4]));
 */
async add(vectors) {
  // ...
}
```

TypeDoc will automatically extract:
- Parameter types from TypeScript definitions
- Return types
- JSDoc comments
- Examples

### C++

Add Doxygen comments:

```cpp
/**
 * Add vectors to the index
 * @param vectors Pointer to float array (n * dims elements)
 * @param n Number of vectors
 * @throws std::runtime_error if index is disposed
 */
void Add(const float* vectors, size_t n);
```

## Automated Deployment

Both documentation types are automatically deployed to GitHub Pages:

- **TypeDoc:** Deployed via `.github/workflows/docs-typedoc.yml`
- **Doxygen:** Deployed via `.github/workflows/docs.yml`

Documentation is updated automatically when:
- Code is pushed to `main` branch
- Source files are modified
- Documentation configuration files are updated

## Best Practices

1. **Keep JSDoc comments up-to-date** - They're the source of truth for API docs
2. **Use TypeScript types** - TypeDoc extracts types automatically
3. **Add examples** - Use `@example` tags in JSDoc
4. **Document parameters** - Use `@param` for all parameters
5. **Document return values** - Use `@returns` for return types
6. **Document errors** - Use `@throws` for exceptions

## Troubleshooting

### TypeDoc not generating

```bash
# Install dependencies
npm install

# Check TypeDoc version
npx typedoc --version

# Generate with verbose output
npx typedoc --verbose
```

### Doxygen not generating

```bash
# Check Doxygen installation
doxygen --version

# Generate with verbose output
doxygen Doxyfile 2>&1 | head -20
```

### Documentation not deploying

- Check GitHub Actions workflow runs
- Verify GitHub Pages is enabled in repository settings
- Check for errors in workflow logs

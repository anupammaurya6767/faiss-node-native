# Documentation

This directory contains the auto-generated API documentation that I set up using Doxygen.

## Viewing Documentation

- **Online**: Visit [GitHub Pages](https://anupammaurya6767.github.io/faiss-node-native/) (automatically deployed)
- **Local**: Run `npm run docs:serve` and visit http://localhost:8000

## Generating Documentation

```bash
npm run docs
```

This generates HTML documentation in `docs/html/` using Doxygen.

## Documentation Structure

- **C++ API**: Native bindings and FAISS wrapper classes
- **JavaScript API**: High-level FaissIndex class
- **Examples**: Code examples from `examples/` directory

## Auto-Deployment

I've set it up so documentation automatically deploys to GitHub Pages when:
- Code is pushed to `main` branch
- Source files (`src/**`) or `Doxyfile` are modified
- I manually trigger it via workflow_dispatch

See `.github/workflows/docs.yml` for the deployment workflow I created.

# Documentation

This repository publishes two documentation views:

- **GitHub Pages home**: [Documentation Home](https://anupammaurya6767.github.io/faiss-node-native/)
- **JS/TS API**: [TypeDoc](https://anupammaurya6767.github.io/faiss-node-native/api/)
- **C++ native API**: [Doxygen](https://anupammaurya6767.github.io/faiss-node-native/native/)

## Generate locally

```bash
npm run docs
```

That command generates:

- `docs/api/` for TypeDoc output
- `docs/html/` for Doxygen output

## Preview locally

```bash
npm run docs:serve
npm run docs:serve:cpp
```

- `docs:serve` serves the JS/TS docs at `http://localhost:8000`
- `docs:serve:cpp` serves the C++ docs at `http://localhost:8001`

## Deployment

GitHub Pages is published through GitHub Actions. The Pages workflow builds both documentation sets, stages a small landing page, and publishes:

- `/` as the documentation home page
- `/api/` for TypeDoc
- `/native/` for Doxygen

See `.github/workflows/docs.yml` for the main deployment workflow.

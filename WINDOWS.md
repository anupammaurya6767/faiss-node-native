# Windows Support Guide

This guide helps Windows developers get started with `@faiss-node/native` using WSL2 or Docker.

## Why Windows Requires Special Setup

FAISS is a C++ library that requires Linux/macOS build tools and dependencies. Windows native compilation is complex due to:
- FAISS dependencies (OpenMP, OpenBLAS) requiring Unix-like environment
- Native module compilation needing `node-gyp` with Linux toolchain
- CMake and C++ compiler configuration challenges on Windows

**Recommended approaches (in order of preference):**

1. **WSL2 + Linux** (Best for development) ⭐
2. **VS Code Dev Container** (Best for team consistency)
3. **Docker Desktop** (Good for containerized workflows)

---

## Option 1: WSL2 Setup (Recommended)

WSL2 provides a full Linux environment on Windows, making it the easiest path for development.

### Prerequisites

1. **Install WSL2** (if not already installed):
   ```powershell
   wsl --install
   ```
   This installs Ubuntu by default. Restart your computer after installation.

2. **Update Ubuntu**:
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   ```

### Installation Steps

1. **Install Node.js** (using nvm recommended):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   source ~/.bashrc
   nvm install --lts
   nvm use --lts
   ```

2. **Install build dependencies**:
   ```bash
   sudo apt-get update
   sudo apt-get install -y cmake libopenblas-dev libomp-dev build-essential git
   ```

3. **Build FAISS from source**:
   ```bash
   git clone https://github.com/facebookresearch/faiss.git /tmp/faiss
   cd /tmp/faiss
   cmake -B build \
       -DFAISS_ENABLE_GPU=OFF \
       -DFAISS_ENABLE_PYTHON=OFF \
       -DBUILD_TESTING=OFF \
       -DCMAKE_BUILD_TYPE=Release \
       -DCMAKE_INSTALL_PREFIX=/usr/local \
       -DCMAKE_CXX_FLAGS="-fopenmp" \
       -DCMAKE_C_FLAGS="-fopenmp"
   cmake --build build -j$(nproc)
   sudo cmake --install build
   sudo ldconfig
   cd ~
   rm -rf /tmp/faiss
   ```

4. **Clone and setup the project**:
   ```bash
   git clone https://github.com/anupammaurya6767/faiss-node-native.git
   cd faiss-node-native
   npm install
   npm run build
   ```

5. **Verify installation**:
   ```bash
   npm test
   ```

### VS Code Integration with WSL2

1. **Install VS Code** and the **WSL extension**:
   - Install [VS Code](https://code.visualstudio.com/)
   - Install the [Remote - WSL](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl) extension

2. **Open project in WSL**:
   ```bash
   code .
   ```
   This opens VS Code connected to your WSL2 environment.

3. **Terminal automatically uses WSL2** - all commands run in Linux.

---

## Option 2: VS Code Dev Container

VS Code Dev Containers provide a consistent development environment using Docker.

### Prerequisites

1. **Install Docker Desktop for Windows**:
   - Download from [Docker Desktop](https://www.docker.com/products/docker-desktop/)
   - Ensure WSL2 backend is enabled (Settings → General → Use WSL 2 based engine)

2. **Install VS Code** with **Dev Containers extension**:
   - Install [VS Code](https://code.visualstudio.com/)
   - Install the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension

### Setup Steps

1. **Clone the repository** (in Windows or WSL2):
   ```bash
   git clone https://github.com/anupammaurya6767/faiss-node-native.git
   cd faiss-node-native
   ```

2. **Open in Dev Container**:
   - Open VS Code
   - Press `F1` or `Ctrl+Shift+P`
   - Type "Dev Containers: Reopen in Container"
   - Select it

3. **Wait for container to build** (first time takes 5-10 minutes):
   - Docker will build the container with all dependencies
   - FAISS will be compiled automatically
   - Node modules will be installed

4. **Start developing**:
   ```bash
   npm run build
   npm test
   ```

### Dev Container Features

- ✅ All dependencies pre-installed (FAISS, CMake, build tools)
- ✅ Consistent environment across team members
- ✅ No manual setup required
- ✅ Works offline after initial build
- ✅ Isolated from your Windows system

---

## Option 3: Docker Desktop (Manual)

For users comfortable with Docker, you can run the project in a container.

### Setup Steps

1. **Install Docker Desktop** (if not already installed):
   - Download from [Docker Desktop](https://www.docker.com/products/docker-desktop/)
   - Ensure WSL2 backend is enabled

2. **Build the Docker image**:
   ```bash
   docker build -t faiss-node:dev --target builder .
   ```

3. **Run container interactively**:
   ```bash
   docker run -it --rm -v ${PWD}:/app -w /app faiss-node:dev bash
   ```

4. **Inside the container**:
   ```bash
   npm install
   npm run build
   npm test
   ```

5. **For development with file watching**:
   ```bash
   docker run -it --rm \
     -v ${PWD}:/app \
     -v /app/node_modules \
     -w /app \
     faiss-node:dev \
     npm run build
   ```

---

## Troubleshooting

### WSL2 Issues

**Problem: `ldconfig` not finding libraries**
```bash
# Solution: Run ldconfig after FAISS installation
sudo ldconfig
```

**Problem: Node-gyp build fails**
```bash
# Solution: Clear node-gyp cache
npm cache clean --force
rm -rf ~/.node-gyp
npm rebuild
```

**Problem: Out of memory during FAISS build**
```bash
# Solution: Build with fewer parallel jobs
cmake --build build -j2  # Instead of -j$(nproc)
```

### Docker Issues

**Problem: Container can't access Windows files**
- Ensure Docker Desktop is using WSL2 backend
- Check Settings → Resources → WSL Integration

**Problem: Build takes too long**
- First build includes FAISS compilation (5-10 minutes)
- Subsequent builds use cache and are faster
- Use `--target builder` to skip test stage

**Problem: Permission denied errors**
- Run Docker Desktop as Administrator
- Check WSL2 integration in Docker Desktop settings

### General Issues

**Problem: Cannot find FAISS headers**
```bash
# Verify FAISS installation
ls -la /usr/local/include/faiss/impl/FaissAssert.h

# If missing, reinstall FAISS
# See Option 1, Step 3
```

**Problem: Module not found after installation**
```bash
# Rebuild native module
npm run build

# Clear npm cache
npm cache clean --force
```

---

## Performance Notes

- **WSL2**: Nearly native Linux performance, recommended for development
- **Dev Container**: Slight overhead from containerization, but consistent
- **Docker Desktop**: Good for testing, but may be slower for development

For best performance during development, use **WSL2**.

---

## Additional Resources

- [WSL2 Documentation](https://docs.microsoft.com/en-us/windows/wsl/)
- [VS Code Dev Containers](https://code.visualstudio.com/docs/remote/containers)
- [Docker Desktop for Windows](https://docs.docker.com/desktop/windows/)
- [FAISS GitHub Repository](https://github.com/facebookresearch/faiss)

---

## Need Help?

- Open an issue on [GitHub](https://github.com/anupammaurya6767/faiss-node-native/issues)
- Check existing issues for similar problems
- Review [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines

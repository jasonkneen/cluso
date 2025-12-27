# Electron Optimization Guide

This document outlines the optimizations applied to reduce Cluso's package size and improve distribution.

## Current Optimizations

### 1. **ASAR Packaging** (`asar: true`)
- Compresses all app files into a single archive
- Reduces file count and improves loading speed
- Native modules are unpacked automatically via `asarUnpack`

### 2. **Maximum Compression** (`compression: "maximum"`)
- Uses highest compression level for all assets
- Significantly reduces final package size

### 3. **Aggressive File Exclusion**
Excludes unnecessary files from the build:
- Test files and directories
- Documentation (README, CHANGELOG, LICENSE)
- Source maps (*.map)
- Git metadata
- TypeScript source files from node_modules
- Examples and demos
- Heavy ML dependencies (lancedb, onnxruntime, llama-cpp, sharp)

### 4. **Production Dependencies Only**
Build script runs `npm prune --production` to remove dev dependencies before packaging.

### 5. **Platform-Specific Builds**
- Only builds for target platform (e.g., arm64 macOS)
- Doesn't include binaries for other platforms

## NPX Distribution

### Usage
```bash
npx ai-cluso
```

The launcher (`bin/cluso.js`):
1. Checks for local Electron installation
2. Downloads Electron on first run if needed
3. Launches the app with Electron

This allows distribution without bundling the ~150MB Electron binary.

## Size Analysis

Run the bundle size analyzer:
```bash
npm run analyze
```

This shows:
- Top 20 largest dependencies
- Total node_modules size
- dist/ folder breakdown
- electron/ folder size
- Optimization suggestions

## Build Commands

### Standard Build
```bash
npm run electron:build:mac
```

### Production Build (Optimized)
```bash
npm run electron:build
```

This automatically:
1. Cleans previous builds
2. Builds with production optimizations
3. Prunes dev dependencies
4. Runs electron-builder with maximum compression
5. Reinstalls dependencies for development

## Further Optimizations

### 1. Tree-Shake Dependencies
Some large dependencies can be tree-shaken:
- Shiki language/theme imports
- Radix UI components (only import what you use)
- Lodash (use individual imports)

### 2. Code Splitting
Consider lazy-loading heavy features:
- MCP servers
- LSP clients
- AI SDK providers

### 3. Asset Optimization
- Compress images before bundling
- Use modern formats (WebP, AVIF)
- Lazy-load fonts

### 4. Electron Binary Optimization
Consider using:
- `electron-packager` instead of `electron-builder` (lighter)
- Custom Electron builds with unused features removed

## Size Targets

Current unoptimized size: ~150-200MB (macOS arm64)

**Targets after optimization:**
- **DMG installer**: 60-80MB (with max compression)
- **Extracted app**: 120-150MB
- **NPX download**: 40-60MB (app only, Electron downloaded separately)

## Monitoring

After each build:
1. Check release/ folder size
2. Run `npm run analyze` to identify regressions
3. Review electron-builder output for warnings

## Resources

- [electron-builder compression docs](https://www.electron.build/configuration/configuration#Configuration-compression)
- [ASAR packaging](https://www.electronjs.org/docs/latest/tutorial/asar-archives)
- [Electron app size guide](https://www.electronjs.org/docs/latest/tutorial/application-distribution)

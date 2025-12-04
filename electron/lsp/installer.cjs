/**
 * LSP Server Installer
 *
 * Handles automatic downloading and installation of LSP servers.
 * Three installation methods:
 * 1. NPM packages (via bundled bun or system npm)
 * 2. Go packages (via go install)
 * 3. GitHub releases (binary downloads)
 *
 * Binaries are cached in app data directory for persistence.
 */

const path = require('path')
const fs = require('fs').promises
const fsSync = require('fs')
const os = require('os')
const { spawn, execFileSync } = require('child_process')

// Cache version - bump to invalidate all cached LSP servers
const CACHE_VERSION = '1'

/**
 * Get the LSP cache directory (XDG-compliant on Linux/macOS)
 */
function getCacheDir() {
  const appName = 'cluso'

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName, 'lsp')
  } else if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName, 'lsp')
  } else {
    // Linux - use XDG_DATA_HOME
    const xdgData = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')
    return path.join(xdgData, appName, 'lsp')
  }
}

/**
 * Get the bin directory for installed LSP servers
 */
function getBinDir() {
  return path.join(getCacheDir(), 'bin')
}

/**
 * Get the node_modules directory for npm packages
 */
function getNodeModulesDir() {
  return path.join(getCacheDir(), 'node_modules')
}

/**
 * Ensure cache directories exist and validate cache version
 */
async function ensureCacheDir() {
  const cacheDir = getCacheDir()
  const versionFile = path.join(cacheDir, '.cache-version')

  try {
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.mkdir(getBinDir(), { recursive: true })

    // Check cache version
    try {
      const version = await fs.readFile(versionFile, 'utf-8')
      if (version.trim() !== CACHE_VERSION) {
        console.log('[LSP Installer] Cache version mismatch, clearing cache')
        await clearCache()
      }
    } catch {
      // Version file doesn't exist, write it
      await fs.writeFile(versionFile, CACHE_VERSION)
    }
  } catch (err) {
    console.error('[LSP Installer] Failed to create cache directory:', err)
    throw err
  }
}

/**
 * Clear the entire LSP cache
 */
async function clearCache() {
  const cacheDir = getCacheDir()
  try {
    const entries = await fs.readdir(cacheDir)
    for (const entry of entries) {
      if (entry === '.cache-version') continue
      await fs.rm(path.join(cacheDir, entry), { recursive: true, force: true })
    }
    await fs.mkdir(getBinDir(), { recursive: true })
    await fs.writeFile(path.join(cacheDir, '.cache-version'), CACHE_VERSION)
    console.log('[LSP Installer] Cache cleared')
  } catch (err) {
    console.error('[LSP Installer] Failed to clear cache:', err)
  }
}

/**
 * Get path to bundled bun binary (Cluso bundles bun)
 */
function getBundledBunPath() {
  // In development, use system bun
  if (process.env.NODE_ENV === 'development') {
    try {
      const cmd = process.platform === 'win32' ? 'where' : 'which'
      return execFileSync(cmd, ['bun'], { encoding: 'utf-8' }).trim().split('\n')[0]
    } catch {
      return null
    }
  }

  // In production, use bundled bun
  const resourcesPath = process.resourcesPath || path.join(__dirname, '..', '..', 'resources')
  const bunName = process.platform === 'win32' ? 'bun.exe' : 'bun'
  const bunPath = path.join(resourcesPath, 'bin', bunName)

  if (fsSync.existsSync(bunPath)) {
    return bunPath
  }

  // Fallback to system bun
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    return execFileSync(cmd, ['bun'], { encoding: 'utf-8' }).trim().split('\n')[0]
  } catch {
    return null
  }
}

/**
 * Get path to system npm
 */
function getNpmPath() {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    return execFileSync(cmd, ['npm'], { encoding: 'utf-8' }).trim().split('\n')[0]
  } catch {
    return null
  }
}

/**
 * Install an npm package
 * @param {Object} options
 * @param {string} options.packageName - npm package name (e.g., 'typescript-language-server')
 * @param {string} options.entryPoint - Path to binary within node_modules (e.g., '.bin/typescript-language-server')
 * @param {Function} onProgress - Progress callback (optional)
 */
async function installNpmPackage(options, onProgress) {
  const { packageName, entryPoint } = options

  await ensureCacheDir()

  const nodeModulesDir = getNodeModulesDir()
  const binPath = path.join(nodeModulesDir, entryPoint)

  // Check if already installed
  try {
    await fs.access(binPath)
    console.log(`[LSP Installer] ${packageName} already installed at ${binPath}`)
    return binPath
  } catch {
    // Not installed, proceed
  }

  if (onProgress) onProgress({ stage: 'installing', package: packageName })
  console.log(`[LSP Installer] Installing npm package: ${packageName}`)

  // Try bun first (faster), then npm
  const bunPath = getBundledBunPath()
  const npmPath = getNpmPath()

  if (!bunPath && !npmPath) {
    throw new Error('Neither bun nor npm found. Cannot install LSP server.')
  }

  await fs.mkdir(nodeModulesDir, { recursive: true })

  // Create a minimal package.json if it doesn't exist
  const packageJsonPath = path.join(getCacheDir(), 'package.json')
  try {
    await fs.access(packageJsonPath)
  } catch {
    await fs.writeFile(packageJsonPath, JSON.stringify({ name: 'cluso-lsp', private: true }, null, 2))
  }

  return new Promise((resolve, reject) => {
    const cwd = getCacheDir()
    let proc

    // Split package names if multiple are provided (e.g., "typescript-language-server typescript")
    const packages = packageName.split(/\s+/).filter(Boolean)

    if (bunPath) {
      console.log(`[LSP Installer] Using bun: ${bunPath}`)
      console.log(`[LSP Installer] Installing packages:`, packages)
      proc = spawn(bunPath, ['add', ...packages], {
        cwd,
        env: { ...process.env, BUN_INSTALL_CACHE_DIR: path.join(cwd, '.bun-cache') },
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } else {
      console.log(`[LSP Installer] Using npm: ${npmPath}`)
      console.log(`[LSP Installer] Installing packages:`, packages)
      proc = spawn(npmPath, ['install', ...packages, '--save'], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    }

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', async (code) => {
      if (code !== 0) {
        console.error(`[LSP Installer] Install failed:`, stderr)
        reject(new Error(`Failed to install ${packageName}: ${stderr}`))
        return
      }

      // Verify the binary exists
      try {
        await fs.access(binPath)
        console.log(`[LSP Installer] Successfully installed ${packageName}`)
        if (onProgress) onProgress({ stage: 'complete', package: packageName })
        resolve(binPath)
      } catch {
        reject(new Error(`Installed ${packageName} but binary not found at ${entryPoint}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn package manager: ${err.message}`))
    })
  })
}

/**
 * Install a Go package
 * @param {Object} options
 * @param {string} options.packagePath - Go package path (e.g., 'golang.org/x/tools/gopls@latest')
 * @param {string} options.binaryName - Name of the resulting binary (e.g., 'gopls')
 * @param {Function} onProgress - Progress callback (optional)
 */
async function installGoPackage(options, onProgress) {
  const { packagePath, binaryName } = options

  await ensureCacheDir()

  const ext = process.platform === 'win32' ? '.exe' : ''
  const binPath = path.join(getBinDir(), binaryName + ext)

  // Check if already installed
  try {
    await fs.access(binPath)
    console.log(`[LSP Installer] ${binaryName} already installed at ${binPath}`)
    return binPath
  } catch {
    // Not installed, proceed
  }

  // Check for Go
  let goPath
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    goPath = execFileSync(cmd, ['go'], { encoding: 'utf-8' }).trim().split('\n')[0]
  } catch {
    throw new Error('Go is required to install ' + binaryName)
  }

  if (onProgress) onProgress({ stage: 'installing', package: binaryName })
  console.log(`[LSP Installer] Installing Go package: ${packagePath}`)

  return new Promise((resolve, reject) => {
    const proc = spawn(goPath, ['install', packagePath], {
      env: { ...process.env, GOBIN: getBinDir() },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stderr = ''

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', async (code) => {
      if (code !== 0) {
        console.error(`[LSP Installer] Go install failed:`, stderr)
        reject(new Error(`Failed to install ${binaryName}: ${stderr}`))
        return
      }

      // Verify the binary exists
      try {
        await fs.access(binPath)
        console.log(`[LSP Installer] Successfully installed ${binaryName}`)
        if (onProgress) onProgress({ stage: 'complete', package: binaryName })
        resolve(binPath)
      } catch {
        reject(new Error(`Installed ${binaryName} but binary not found`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to run go install: ${err.message}`))
    })
  })
}

/**
 * Download and install from GitHub releases
 * @param {Object} options
 * @param {string} options.repo - GitHub repo (e.g., 'rust-lang/rust-analyzer')
 * @param {string} options.binaryName - Name of the binary to extract
 * @param {Function} options.getAssetName - Function to get asset name: (release, platform, arch) => assetName
 * @param {Function} onProgress - Progress callback (optional)
 */
async function installFromGitHub(options, onProgress) {
  const { repo, binaryName, getAssetName } = options

  await ensureCacheDir()

  const ext = process.platform === 'win32' ? '.exe' : ''
  const binPath = path.join(getBinDir(), binaryName + ext)

  // Check if already installed
  try {
    await fs.access(binPath)
    console.log(`[LSP Installer] ${binaryName} already installed at ${binPath}`)
    return binPath
  } catch {
    // Not installed, proceed
  }

  if (onProgress) onProgress({ stage: 'fetching', package: binaryName })
  console.log(`[LSP Installer] Fetching latest release from ${repo}`)

  // Fetch latest release info
  const releaseUrl = `https://api.github.com/repos/${repo}/releases/latest`
  const releaseRes = await fetch(releaseUrl, {
    headers: { 'User-Agent': 'Cluso-LSP-Installer' },
  })

  if (!releaseRes.ok) {
    throw new Error(`Failed to fetch release info: ${releaseRes.status}`)
  }

  const release = await releaseRes.json()
  const platform = process.platform
  const arch = process.arch

  // Get the appropriate asset name
  const assetName = getAssetName(release, platform, arch)
  if (!assetName) {
    throw new Error(`No compatible release found for ${platform}-${arch}`)
  }

  // Find the asset
  const asset = release.assets.find((a) => a.name === assetName)
  if (!asset) {
    throw new Error(`Asset ${assetName} not found in release`)
  }

  if (onProgress) onProgress({ stage: 'downloading', package: binaryName, size: asset.size })
  console.log(`[LSP Installer] Downloading ${assetName} (${(asset.size / 1024 / 1024).toFixed(2)} MB)`)

  // Download the asset
  const downloadRes = await fetch(asset.browser_download_url, {
    headers: { 'User-Agent': 'Cluso-LSP-Installer' },
  })

  if (!downloadRes.ok) {
    throw new Error(`Failed to download: ${downloadRes.status}`)
  }

  const buffer = Buffer.from(await downloadRes.arrayBuffer())
  const archivePath = path.join(getBinDir(), assetName)
  await fs.writeFile(archivePath, buffer)

  if (onProgress) onProgress({ stage: 'extracting', package: binaryName })
  console.log(`[LSP Installer] Extracting ${assetName}`)

  // Extract based on file type
  try {
    if (assetName.endsWith('.zip')) {
      await extractZip(archivePath, getBinDir(), binaryName)
    } else if (assetName.endsWith('.tar.gz') || assetName.endsWith('.tar.xz')) {
      await extractTar(archivePath, getBinDir(), binaryName)
    } else if (assetName.endsWith('.gz') && !assetName.endsWith('.tar.gz')) {
      // Single gzipped file
      await extractGz(archivePath, binPath)
    } else {
      // Assume it's the binary itself
      await fs.rename(archivePath, binPath)
    }
  } finally {
    // Clean up archive
    try {
      await fs.unlink(archivePath)
    } catch {
      // Ignore
    }
  }

  // Make executable on Unix
  if (process.platform !== 'win32') {
    await fs.chmod(binPath, 0o755)
  }

  // Verify the binary exists
  try {
    await fs.access(binPath)
    console.log(`[LSP Installer] Successfully installed ${binaryName}`)
    if (onProgress) onProgress({ stage: 'complete', package: binaryName })
    return binPath
  } catch {
    throw new Error(`Extracted ${binaryName} but binary not found`)
  }
}

/**
 * Extract a zip archive
 */
async function extractZip(archivePath, destDir, binaryName) {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const targetBin = binaryName + ext

  // Use unzip on Unix, PowerShell on Windows
  if (process.platform === 'win32') {
    execFileSync('powershell', [
      '-Command',
      `Expand-Archive -Path "${archivePath}" -DestinationPath "${destDir}" -Force`,
    ])
  } else {
    execFileSync('unzip', ['-o', '-q', archivePath, '-d', destDir])
  }

  // Find the binary in extracted files
  await findAndMoveBinary(destDir, targetBin)
}

/**
 * Extract a tar.gz or tar.xz archive
 */
async function extractTar(archivePath, destDir, binaryName) {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const targetBin = binaryName + ext

  execFileSync('tar', ['-xf', archivePath, '-C', destDir])

  // Find the binary in extracted files
  await findAndMoveBinary(destDir, targetBin)
}

/**
 * Extract a gzipped file
 */
async function extractGz(archivePath, destPath) {
  const zlib = require('zlib')
  const compressed = await fs.readFile(archivePath)
  const decompressed = zlib.gunzipSync(compressed)
  await fs.writeFile(destPath, decompressed)
}

/**
 * Find a binary in extracted directory and move it to bin root
 */
async function findAndMoveBinary(dir, binaryName) {
  const binPath = path.join(dir, binaryName)

  // Check if already at root
  try {
    await fs.access(binPath)
    return
  } catch {
    // Not at root, search subdirectories
  }

  // Search recursively (max 3 levels deep)
  async function searchDir(searchPath, depth = 0) {
    if (depth > 3) return null

    const entries = await fs.readdir(searchPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(searchPath, entry.name)

      if (entry.isFile() && entry.name === binaryName) {
        return fullPath
      }

      if (entry.isDirectory()) {
        const found = await searchDir(fullPath, depth + 1)
        if (found) return found
      }
    }

    return null
  }

  const found = await searchDir(dir)
  if (found && found !== binPath) {
    await fs.rename(found, binPath)
  }
}

/**
 * Check if a binary exists in our cache
 */
async function isCached(binaryName) {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const binPath = path.join(getBinDir(), binaryName + ext)

  try {
    await fs.access(binPath)
    return true
  } catch {
    return false
  }
}

/**
 * Get the path to a cached binary
 */
function getCachedBinaryPath(binaryName) {
  const ext = process.platform === 'win32' ? '.exe' : ''
  return path.join(getBinDir(), binaryName + ext)
}

/**
 * Get path to an npm package binary
 */
function getNpmBinaryPath(entryPoint) {
  return path.join(getNodeModulesDir(), entryPoint)
}

module.exports = {
  getCacheDir,
  getBinDir,
  getNodeModulesDir,
  ensureCacheDir,
  clearCache,
  getBundledBunPath,
  installNpmPackage,
  installGoPackage,
  installFromGitHub,
  isCached,
  getCachedBinaryPath,
  getNpmBinaryPath,
  CACHE_VERSION,
}

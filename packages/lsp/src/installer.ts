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

import path from 'path'
import fs from 'fs/promises'
import fsSync from 'fs'
import os from 'os'
import { spawn, execFileSync } from 'child_process'
import zlib from 'zlib'
import type { InstallProgressCallback, CacheInfo } from './types'

// Cache version - bump to invalidate all cached LSP servers
export const CACHE_VERSION = '1'

// Configurable app name (set via init or use default)
let appName = 'lsp-client'
let customCacheDir: string | null = null
let bundledBunPath: string | null = null

/**
 * Initialize the installer with options
 */
export function initInstaller(options: {
  appName?: string
  cacheDir?: string
  bunPath?: string
}): void {
  if (options.appName) appName = options.appName
  if (options.cacheDir) customCacheDir = options.cacheDir
  if (options.bunPath) bundledBunPath = options.bunPath
}

/**
 * Get the LSP cache directory (XDG-compliant on Linux/macOS)
 */
export function getCacheDir(): string {
  if (customCacheDir) return customCacheDir

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName, 'lsp')
  } else if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      appName,
      'lsp'
    )
  } else {
    // Linux - use XDG_DATA_HOME
    const xdgData = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')
    return path.join(xdgData, appName, 'lsp')
  }
}

/**
 * Get the bin directory for installed LSP servers
 */
export function getBinDir(): string {
  return path.join(getCacheDir(), 'bin')
}

/**
 * Get the node_modules directory for npm packages
 */
export function getNodeModulesDir(): string {
  return path.join(getCacheDir(), 'node_modules')
}

/**
 * Ensure cache directories exist and validate cache version
 */
export async function ensureCacheDir(): Promise<void> {
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
export async function clearCache(): Promise<void> {
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
 * Get cache info for display
 */
export async function getCacheInfo(): Promise<CacheInfo> {
  const cacheDir = getCacheDir()
  let size = 0
  const packages: string[] = []

  async function getSize(dir: string): Promise<number> {
    let total = 0
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          total += await getSize(fullPath)
        } else {
          const stat = await fs.stat(fullPath)
          total += stat.size
        }
      }
    } catch {
      // Ignore errors
    }
    return total
  }

  try {
    size = await getSize(cacheDir)

    // List installed packages
    const binDir = getBinDir()
    try {
      const binEntries = await fs.readdir(binDir)
      packages.push(...binEntries.filter((e) => !e.startsWith('.')))
    } catch {
      // No bin dir yet
    }

    const nodeModulesDir = getNodeModulesDir()
    try {
      const nodeModulesBin = path.join(nodeModulesDir, '.bin')
      const binEntries = await fs.readdir(nodeModulesBin)
      packages.push(...binEntries.filter((e) => !e.startsWith('.')))
    } catch {
      // No node_modules yet
    }
  } catch {
    // Cache doesn't exist yet
  }

  return {
    path: cacheDir,
    size,
    version: CACHE_VERSION,
    packages: [...new Set(packages)], // Deduplicate
  }
}

/**
 * Check if a binary exists in PATH using execFileSync (safe, no shell injection)
 */
export function which(binary: string): string | null {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const result = execFileSync(cmd, [binary], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    // 'where' on Windows can return multiple lines, take the first
    return result.split('\n')[0].trim() || null
  } catch {
    return null
  }
}

/**
 * Get path to bundled bun binary
 */
export function getBundledBunPath(): string | null {
  // Use configured bundled path if set
  if (bundledBunPath && fsSync.existsSync(bundledBunPath)) {
    return bundledBunPath
  }

  // In development, use system bun
  if (process.env.NODE_ENV === 'development') {
    return which('bun')
  }

  // Try to find bun in resources (Electron app)
  const resourcesPath =
    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ||
    path.join(__dirname, '..', '..', 'resources')
  const bunName = process.platform === 'win32' ? 'bun.exe' : 'bun'
  const bunPath = path.join(resourcesPath, 'bin', bunName)

  if (fsSync.existsSync(bunPath)) {
    return bunPath
  }

  // Fallback to system bun
  return which('bun')
}

/**
 * Get path to system npm
 */
export function getNpmPath(): string | null {
  return which('npm')
}

/**
 * Install an npm package
 */
export async function installNpmPackage(
  options: {
    packageName: string
    entryPoint: string
  },
  onProgress?: InstallProgressCallback
): Promise<string> {
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
    await fs.writeFile(
      packageJsonPath,
      JSON.stringify({ name: `${appName}-lsp`, private: true }, null, 2)
    )
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
      proc = spawn(npmPath!, ['install', ...packages, '--save'], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    }

    let stderr = ''

    proc.stderr?.on('data', (data: Buffer) => {
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
 */
export async function installGoPackage(
  options: {
    packagePath: string
    binaryName: string
  },
  onProgress?: InstallProgressCallback
): Promise<string> {
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
  const goPath = which('go')
  if (!goPath) {
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

    proc.stderr?.on('data', (data: Buffer) => {
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
 */
export async function installFromGitHub(
  options: {
    repo: string
    binaryName: string
    getAssetName: (
      release: { tag_name: string },
      platform: NodeJS.Platform,
      arch: NodeJS.Architecture
    ) => string | null
  },
  onProgress?: InstallProgressCallback
): Promise<string> {
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
    headers: { 'User-Agent': `${appName}-LSP-Installer` },
  })

  if (!releaseRes.ok) {
    throw new Error(`Failed to fetch release info: ${releaseRes.status}`)
  }

  const release = (await releaseRes.json()) as {
    tag_name: string
    assets: Array<{ name: string; size: number; browser_download_url: string }>
  }
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
    headers: { 'User-Agent': `${appName}-LSP-Installer` },
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
async function extractZip(archivePath: string, destDir: string, binaryName: string): Promise<void> {
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
async function extractTar(archivePath: string, destDir: string, binaryName: string): Promise<void> {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const targetBin = binaryName + ext

  execFileSync('tar', ['-xf', archivePath, '-C', destDir])

  // Find the binary in extracted files
  await findAndMoveBinary(destDir, targetBin)
}

/**
 * Extract a gzipped file
 */
async function extractGz(archivePath: string, destPath: string): Promise<void> {
  const compressed = await fs.readFile(archivePath)
  const decompressed = zlib.gunzipSync(compressed)
  await fs.writeFile(destPath, decompressed)
}

/**
 * Find a binary in extracted directory and move it to bin root
 */
async function findAndMoveBinary(dir: string, binaryName: string): Promise<void> {
  const binPath = path.join(dir, binaryName)

  // Check if already at root
  try {
    await fs.access(binPath)
    return
  } catch {
    // Not at root, search subdirectories
  }

  // Search recursively (max 3 levels deep)
  async function searchDir(searchPath: string, depth = 0): Promise<string | null> {
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
export async function isCached(binaryName: string): Promise<boolean> {
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
export function getCachedBinaryPath(binaryName: string): string {
  const ext = process.platform === 'win32' ? '.exe' : ''
  return path.join(getBinDir(), binaryName + ext)
}

/**
 * Get path to an npm package binary
 */
export function getNpmBinaryPath(entryPoint: string): string {
  return path.join(getNodeModulesDir(), entryPoint)
}

/**
 * File Watcher - Watches project directory for file changes
 *
 * Uses chokidar to monitor the project folder and emits events
 * to the renderer when files are added, changed, or deleted.
 * Respects .gitignore patterns.
 */

const chokidar = require('chokidar')
const path = require('path')
const fs = require('fs').promises

// Store active watchers by project path
const watchers = new Map()

// Reference to main window for sending events
let mainWindow = null

// Reference to LSP manager (set lazily to avoid circular deps)
let lspManager = null

/**
 * Get the LSP manager (lazy load to avoid circular dependencies)
 */
function getLspManager() {
  if (!lspManager) {
    try {
      const lsp = require('./lsp/index.cjs')
      lspManager = lsp.getManager()
    } catch (err) {
      // LSP not available
    }
  }
  return lspManager
}

/**
 * Set the main window reference for IPC
 */
function setMainWindow(win) {
  mainWindow = win
}

/**
 * Send file change event to renderer and notify LSP
 */
function sendFileChange(type, filePath, projectPath) {
  if (!mainWindow || mainWindow.isDestroyed()) return

  mainWindow.webContents.send('file-watcher:change', {
    type, // 'add' | 'change' | 'unlink'
    path: filePath,
    relativePath: path.relative(projectPath, filePath),
    projectPath,
    timestamp: Date.now(),
  })

  // Notify LSP of file changes (async, don't block)
  const mgr = getLspManager()
  if (mgr) {
    if (type === 'add' || type === 'change') {
      // Touch file to notify LSP servers
      mgr.touchFile(filePath, false).catch(err => {
        console.log('[FileWatcher] LSP touch failed:', err.message)
      })
    }
    if (type === 'change') {
      // Also notify of save (file was modified externally)
      mgr.fileSaved(filePath).catch(err => {
        console.log('[FileWatcher] LSP save notify failed:', err.message)
      })
    }
  }
}

/**
 * Start watching a project directory
 */
async function startWatching(projectPath) {
  // Don't start duplicate watchers
  if (watchers.has(projectPath)) {
    console.log('[FileWatcher] Already watching:', projectPath)
    return { success: true, alreadyWatching: true }
  }

  console.log('[FileWatcher] Starting watch on:', projectPath)

  // Default ignore patterns (common non-source files)
  const defaultIgnored = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/coverage/**',
    '**/*.log',
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/*.map',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml',
    '**/bun.lockb',
  ]

  // Try to read .gitignore for additional patterns
  let gitignorePatterns = []
  try {
    const gitignorePath = path.join(projectPath, '.gitignore')
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8')
    gitignorePatterns = gitignoreContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(pattern => {
        // Convert gitignore patterns to glob patterns
        if (pattern.startsWith('/')) {
          return pattern.slice(1) // Remove leading slash
        }
        return '**/' + pattern // Make pattern match anywhere
      })
    console.log('[FileWatcher] Loaded .gitignore patterns:', gitignorePatterns.length)
  } catch {
    // No .gitignore or couldn't read it - that's fine
  }

  const ignored = [...defaultIgnored, ...gitignorePatterns]

  const watcher = chokidar.watch(projectPath, {
    ignored,
    persistent: true,
    ignoreInitial: true, // Don't emit events for existing files
    awaitWriteFinish: {
      stabilityThreshold: 100, // Wait for file to be fully written
      pollInterval: 50,
    },
    // Only watch specific extensions to reduce noise
    // Comment out to watch all files
    // depth: 10, // Limit depth to prevent runaway watching
  })

  // Track ready state
  let isReady = false

  watcher
    .on('ready', () => {
      isReady = true
      console.log('[FileWatcher] Ready, watching:', projectPath)
    })
    .on('add', (filePath) => {
      if (!isReady) return // Ignore initial scan
      console.log('[FileWatcher] File added:', filePath)
      sendFileChange('add', filePath, projectPath)
    })
    .on('change', (filePath) => {
      console.log('[FileWatcher] File changed:', filePath)
      sendFileChange('change', filePath, projectPath)
    })
    .on('unlink', (filePath) => {
      console.log('[FileWatcher] File deleted:', filePath)
      sendFileChange('unlink', filePath, projectPath)
    })
    .on('error', (error) => {
      console.error('[FileWatcher] Error:', error)
    })

  watchers.set(projectPath, watcher)

  return { success: true }
}

/**
 * Stop watching a project directory
 */
async function stopWatching(projectPath) {
  const watcher = watchers.get(projectPath)
  if (!watcher) {
    console.log('[FileWatcher] Not watching:', projectPath)
    return { success: true, wasNotWatching: true }
  }

  console.log('[FileWatcher] Stopping watch on:', projectPath)
  await watcher.close()
  watchers.delete(projectPath)

  return { success: true }
}

/**
 * Stop all watchers (for cleanup on app quit)
 */
async function stopAll() {
  console.log('[FileWatcher] Stopping all watchers')
  for (const [projectPath, watcher] of watchers) {
    await watcher.close()
    console.log('[FileWatcher] Stopped:', projectPath)
  }
  watchers.clear()
}

/**
 * Get list of currently watched paths
 */
function getWatchedPaths() {
  return Array.from(watchers.keys())
}

module.exports = {
  setMainWindow,
  startWatching,
  stopWatching,
  stopAll,
  getWatchedPaths,
}

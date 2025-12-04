/**
 * mgrep.cjs - Local semantic code search integration
 *
 * Wraps @ai-cluso/mgrep-local for use in the Electron main process.
 * Provides local embedding-based code search with file watcher integration.
 */

const path = require('path')
const os = require('os')
const fs = require('fs').promises
const { glob } = require('glob')

// Lazy-load the mgrep-local package to avoid startup delays
let MgrepLocalService = null
let mainWindow = null

// Multi-project state tracking - Map of projectPath -> service state
const projects = new Map()  // projectPath -> { service, isInitialized, isIndexing, lastError }

// Legacy: track "active" project for backward compatibility with single-project API
let activeProjectPath = null

/**
 * Set the main window for sending events to renderer
 */
function setMainWindow(win) {
  mainWindow = win
}

/**
 * Send event to renderer process
 */
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

/**
 * Load the mgrep-local module lazily
 */
async function loadModule() {
  if (!MgrepLocalService) {
    try {
      const mgrep = require('@ai-cluso/mgrep-local')
      MgrepLocalService = mgrep.MgrepLocalService
      console.log('[mgrep] Module loaded successfully')
    } catch (error) {
      console.error('[mgrep] Failed to load module:', error)
      throw new Error(`Failed to load mgrep-local: ${error.message}`)
    }
  }
}

/**
 * Get or create project state
 */
function getProjectState(projectDir) {
  if (!projects.has(projectDir)) {
    projects.set(projectDir, {
      service: null,
      isInitialized: false,
      isIndexing: false,
      lastError: null,
    })
  }
  return projects.get(projectDir)
}

/**
 * Initialize the mgrep service for a project
 * Supports multiple concurrent projects
 */
async function initialize(projectDir) {
  try {
    await loadModule()

    const state = getProjectState(projectDir)

    // If already initialized for this project, return success
    if (state.service && state.isInitialized) {
      // Set as active project
      activeProjectPath = projectDir
      return { success: true, message: 'Already initialized' }
    }

    // Dispose old service for this project if exists
    if (state.service) {
      await state.service.dispose()
      state.service = null
      state.isInitialized = false
    }

    // Set as active project
    activeProjectPath = projectDir

    // Create database path in project's .mgrep-local directory
    // LanceDB uses a directory, not a file
    const dbPath = path.join(projectDir, '.mgrep-local', 'vectors')
    await fs.mkdir(dbPath, { recursive: true })

    // Model cache in user's home directory (shared across projects)
    const modelCacheDir = path.join(os.homedir(), '.cache', 'mgrep-local', 'models')

    console.log('[mgrep] Initializing service for:', projectDir)
    console.log('[mgrep] Database path:', dbPath)
    console.log('[mgrep] Model cache:', modelCacheDir)

    // Create service instance
    // Note: MgrepLocalService is a singleton - for multi-project support,
    // we'll need to either modify the class or use separate instances per project
    // For now, use getInstance which will reuse if same options
    state.service = MgrepLocalService.getInstance({
      workspaceDir: projectDir,
      dbPath,
      modelCacheDir,
      verbose: process.env.NODE_ENV === 'development',
    })

    // Subscribe to service events
    state.service.onEvent((event) => {
      console.log('[mgrep] Event:', event.type, 'for project:', projectDir)
      // Include projectPath in events so UI knows which project
      sendToRenderer('mgrep:event', { ...event, projectPath: projectDir })

      // Update state based on events
      if (event.type === 'ready') {
        state.isInitialized = true
        state.lastError = null
      } else if (event.type === 'indexing-start') {
        state.isIndexing = true
      } else if (event.type === 'indexing-complete') {
        state.isIndexing = false
      } else if (event.type === 'error') {
        state.lastError = event.error
      }
    })

    // Initialize the service
    await state.service.initialize()
    state.isInitialized = true
    state.lastError = null

    console.log('[mgrep] Service initialized successfully for:', projectDir)

    // Automatically scan and index files in the project
    // This runs async - we don't wait for it to complete before returning
    scanAndIndexProject(projectDir).catch(err => {
      console.error('[mgrep] Auto-index failed:', err)
    })

    return { success: true }
  } catch (error) {
    console.error('[mgrep] Initialization failed for', projectDir, ':', error)
    const state = getProjectState(projectDir)
    state.lastError = error.message
    return { success: false, error: error.message }
  }
}

/**
 * Search the codebase
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @param {string} options.projectPath - Specific project to search (defaults to active project)
 */
async function search(query, options = {}) {
  const projectDir = options.projectPath || activeProjectPath
  console.log('[mgrep] Search called:', { query, projectDir, options })

  if (!projectDir) {
    console.error('[mgrep] Search: No project specified')
    return { success: false, error: 'No project specified and no active project' }
  }

  const state = projects.get(projectDir)
  if (!state?.service || !state.isInitialized) {
    console.error('[mgrep] Search: Service not initialized for', projectDir)
    return { success: false, error: `mgrep not initialized for project: ${projectDir}` }
  }

  try {
    // Check stats first to see if index has data
    const stats = await state.service.getStats()
    console.log('[mgrep] Search: Index stats:', JSON.stringify(stats))

    if (stats.totalChunks === 0) {
      console.log('[mgrep] Search: Index is empty!')
      return { success: true, results: [], projectPath: projectDir, message: 'Index is empty' }
    }

    console.log('[mgrep] Search: Calling service.search...')
    const results = await state.service.search(query, {
      limit: options.limit ?? 10,
      threshold: options.threshold ?? 0.3,
    })

    console.log('[mgrep] Search: Got', results?.length || 0, 'results')
    return { success: true, results, projectPath: projectDir }
  } catch (error) {
    console.error('[mgrep] Search failed:', error.message)
    console.error('[mgrep] Search error stack:', error.stack)
    return { success: false, error: error.message }
  }
}

/**
 * Index a single file
 * @param {string} filePath - File path to index
 * @param {string} content - File content
 * @param {string} projectDir - Project directory (auto-detected from filePath if not provided)
 */
async function indexFile(filePath, content, projectDir = null) {
  // Auto-detect project from file path
  if (!projectDir) {
    for (const [projPath] of projects) {
      if (filePath.startsWith(projPath)) {
        projectDir = projPath
        break
      }
    }
  }

  if (!projectDir) {
    return { success: false, error: 'Could not determine project for file' }
  }

  const state = projects.get(projectDir)
  if (!state?.service || !state.isInitialized) {
    return { success: false, error: 'mgrep not initialized for this project' }
  }

  try {
    const chunks = await state.service.indexFile(filePath, content)
    return { success: true, chunks }
  } catch (error) {
    console.error('[mgrep] Index file failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Handle file change event from file watcher
 * Auto-routes to the correct project based on file path
 */
async function onFileChange(event) {
  const filePath = event.path || event.filePath

  // Find the project this file belongs to
  let projectDir = null
  for (const [projPath] of projects) {
    if (filePath.startsWith(projPath)) {
      projectDir = projPath
      break
    }
  }

  if (!projectDir) {
    return { success: false, error: 'File does not belong to any indexed project' }
  }

  const state = projects.get(projectDir)
  if (!state?.service || !state.isInitialized) {
    return { success: false, error: 'mgrep not initialized for this project' }
  }

  try {
    await state.service.onFileChange(event)
    return { success: true }
  } catch (error) {
    console.error('[mgrep] File change handling failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Index multiple files (bulk indexing)
 * @param {Array} files - Files to index
 * @param {string} projectDir - Project directory (defaults to active project)
 */
async function indexFiles(files, projectDir = null) {
  projectDir = projectDir || activeProjectPath
  console.log(`[mgrep] indexFiles called with ${files.length} files for project:`, projectDir)

  if (!projectDir) {
    console.error('[mgrep] indexFiles: No project specified')
    return { success: false, error: 'No project specified' }
  }

  const state = projects.get(projectDir)
  if (!state?.service || !state.isInitialized) {
    console.error('[mgrep] indexFiles: Service not initialized for', projectDir)
    return { success: false, error: 'mgrep not initialized for this project' }
  }

  try {
    state.isIndexing = true
    sendToRenderer('mgrep:event', { type: 'indexing-start', totalFiles: files.length, projectPath: projectDir })
    console.log(`[mgrep] Starting indexFiles with service for ${files.length} files...`)
    console.log(`[mgrep] First file to index:`, files[0]?.filePath, `(${files[0]?.content?.length} chars)`)
    console.log(`[mgrep] Service type:`, state.service?.constructor?.name)
    console.log(`[mgrep] Service indexFiles method:`, typeof state.service?.indexFiles)

    const result = await state.service.indexFiles(files)
    console.log(`[mgrep] indexFiles result:`, JSON.stringify(result))
    console.log(`[mgrep] Result details - filesProcessed:`, result?.filesProcessed, 'totalChunks:', result?.totalChunks)

    state.isIndexing = false
    sendToRenderer('mgrep:event', {
      type: 'indexing-complete',
      projectPath: projectDir,
      ...result,
    })

    return { success: true, ...result }
  } catch (error) {
    state.isIndexing = false
    console.error('[mgrep] Bulk index failed:', error.message)
    console.error('[mgrep] Bulk index error stack:', error.stack)
    sendToRenderer('mgrep:event', {
      type: 'error',
      projectPath: projectDir,
      error: error.message,
    })
    return { success: false, error: error.message }
  }
}

/**
 * Get current status for a specific project or active project
 * @param {string} projectDir - Project path (defaults to active project)
 */
async function getStatus(projectDir = null) {
  projectDir = projectDir || activeProjectPath

  if (!projectDir || !projects.has(projectDir)) {
    return {
      success: true,
      status: {
        ready: false,
        indexing: false,
        stats: null,
        projectPath: null,
        error: null,
      },
    }
  }

  const state = projects.get(projectDir)

  if (!state.service) {
    return {
      success: true,
      status: {
        ready: false,
        indexing: false,
        stats: null,
        projectPath: projectDir,
        error: state.lastError,
      },
    }
  }

  try {
    const status = await state.service.getStatus()
    return {
      success: true,
      status: {
        ...status,
        projectPath: projectDir,
      },
    }
  } catch (error) {
    return {
      success: true,
      status: {
        ready: state.isInitialized,
        indexing: state.isIndexing,
        stats: null,
        projectPath: projectDir,
        error: error.message,
      },
    }
  }
}

/**
 * Get status of ALL indexed projects
 * This is the new multi-project API
 */
async function getAllProjectsStatus() {
  const result = []

  for (const [projectDir, state] of projects) {
    let status = {
      projectPath: projectDir,
      ready: state.isInitialized,
      indexing: state.isIndexing,
      stats: null,
      error: state.lastError,
      isActive: projectDir === activeProjectPath,
    }

    if (state.service && state.isInitialized) {
      try {
        const serviceStatus = await state.service.getStatus()
        status = { ...status, ...serviceStatus }
      } catch (error) {
        status.error = error.message
      }
    }

    result.push(status)
  }

  return { success: true, projects: result }
}

/**
 * Set the active project (for backward compatibility)
 */
function setActiveProject(projectDir) {
  if (projects.has(projectDir)) {
    activeProjectPath = projectDir
    return { success: true }
  }
  return { success: false, error: 'Project not found' }
}

/**
 * Get index statistics for a specific project
 */
async function getStats(projectDir = null) {
  projectDir = projectDir || activeProjectPath
  if (!projectDir) {
    return { success: false, error: 'No project specified' }
  }

  const state = projects.get(projectDir)
  if (!state?.service || !state.isInitialized) {
    return { success: false, error: 'mgrep not initialized for this project' }
  }

  try {
    const stats = await state.service.getStats()
    return { success: true, stats, projectPath: projectDir }
  } catch (error) {
    console.error('[mgrep] Get stats failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Clear the index for a specific project
 */
async function clearIndex(projectDir = null) {
  projectDir = projectDir || activeProjectPath
  if (!projectDir) {
    return { success: false, error: 'No project specified' }
  }

  const state = projects.get(projectDir)
  if (!state?.service || !state.isInitialized) {
    return { success: false, error: 'mgrep not initialized for this project' }
  }

  try {
    await state.service.clear()
    return { success: true, projectPath: projectDir }
  } catch (error) {
    console.error('[mgrep] Clear index failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Scan and index all code files in a project
 * Called automatically after initialization
 */
async function scanAndIndexProject(projectDir) {
  console.log('[mgrep] ========================================')
  console.log('[mgrep] scanAndIndexProject STARTING for:', projectDir)
  console.log('[mgrep] ========================================')

  const state = projects.get(projectDir)
  if (!state?.service || !state.isInitialized) {
    console.error('[mgrep] scanAndIndexProject: Service not initialized for', projectDir)
    throw new Error('Service not initialized')
  }

  console.log('[mgrep] Service state:', {
    hasService: !!state.service,
    isInitialized: state.isInitialized,
    isIndexing: state.isIndexing,
  })

  sendToRenderer('mgrep:event', { type: 'scanning-start', projectPath: projectDir })

  // Define patterns for code files to index
  const codePatterns = [
    '**/*.js',
    '**/*.jsx',
    '**/*.ts',
    '**/*.tsx',
    '**/*.py',
    '**/*.rb',
    '**/*.go',
    '**/*.rs',
    '**/*.java',
    '**/*.c',
    '**/*.cpp',
    '**/*.h',
    '**/*.hpp',
    '**/*.cs',
    '**/*.swift',
    '**/*.kt',
    '**/*.scala',
    '**/*.php',
    '**/*.vue',
    '**/*.svelte',
    '**/*.md',
    '**/*.json',
    '**/*.yaml',
    '**/*.yml',
    '**/*.toml',
    '**/*.sql',
    '**/*.sh',
    '**/*.bash',
    '**/*.zsh',
  ]

  // Directories to ignore
  const ignorePatterns = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/coverage/**',
    '**/.cache/**',
    '**/.mgrep-local/**',
    '**/vendor/**',
    '**/__pycache__/**',
    '**/.venv/**',
    '**/venv/**',
    '**/target/**',
    '**/.idea/**',
    '**/.vscode/**',
  ]

  try {
    console.log('[mgrep] Step 1: Globbing for files in:', projectDir)

    // Find all matching files
    const files = await glob(codePatterns, {
      cwd: projectDir,
      ignore: ignorePatterns,
      nodir: true,
      absolute: true,
    })

    console.log(`[mgrep] Step 2: Found ${files.length} files`)
    if (files.length > 0) {
      console.log('[mgrep] First 5 files:', files.slice(0, 5))
    }

    sendToRenderer('mgrep:event', {
      type: 'scanning-complete',
      projectPath: projectDir,
      filesFound: files.length,
    })

    if (files.length === 0) {
      console.log('[mgrep] No files found, returning early')
      return { success: true, filesProcessed: 0, totalChunks: 0 }
    }

    // Read file contents and prepare for indexing
    console.log('[mgrep] Step 3: Reading file contents...')
    const filesToIndex = []
    let skippedCount = 0
    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        // Skip very large files (>1MB) to avoid memory issues
        if (content.length < 1024 * 1024) {
          filesToIndex.push({ filePath, content })
        } else {
          skippedCount++
        }
      } catch (err) {
        // Skip files that can't be read (binary, permissions, etc.)
        skippedCount++
      }
    }

    console.log(`[mgrep] Step 4: Ready to index ${filesToIndex.length} files (skipped ${skippedCount})`)

    if (filesToIndex.length === 0) {
      console.log('[mgrep] No readable files, returning early')
      return { success: true, filesProcessed: 0, totalChunks: 0 }
    }

    // Use the existing indexFiles function
    console.log('[mgrep] Step 5: Calling indexFiles...')
    const result = await indexFiles(filesToIndex, projectDir)

    console.log(`[mgrep] Step 6: indexFiles returned:`, JSON.stringify(result))

    // Verify stats after indexing
    console.log('[mgrep] Step 7: Getting post-index stats...')
    try {
      const statsResult = await getStats(projectDir)
      console.log(`[mgrep] Post-index stats:`, JSON.stringify(statsResult))

      // Send an update event with the stats so UI refreshes
      sendToRenderer('mgrep:event', {
        type: 'stats-updated',
        projectPath: projectDir,
        stats: statsResult.stats,
      })
    } catch (statsErr) {
      console.error('[mgrep] Failed to get post-index stats:', statsErr)
    }

    console.log('[mgrep] ========================================')
    console.log('[mgrep] scanAndIndexProject COMPLETE for:', projectDir)
    console.log('[mgrep] ========================================')

    return result
  } catch (error) {
    console.error('[mgrep] ========================================')
    console.error('[mgrep] scanAndIndexProject FAILED:', error.message)
    console.error('[mgrep] Error stack:', error.stack)
    console.error('[mgrep] ========================================')
    sendToRenderer('mgrep:event', {
      type: 'error',
      projectPath: projectDir,
      error: error.message,
    })
    throw error
  }
}

/**
 * Remove a project from tracking (does not delete database files)
 */
async function removeProject(projectDir) {
  if (!projects.has(projectDir)) {
    return { success: false, error: 'Project not found' }
  }

  const state = projects.get(projectDir)
  if (state.service) {
    try {
      await state.service.dispose()
    } catch (error) {
      console.error('[mgrep] Dispose failed:', error)
    }
  }

  projects.delete(projectDir)

  // Update active project if needed
  if (activeProjectPath === projectDir) {
    activeProjectPath = projects.size > 0 ? projects.keys().next().value : null
  }

  return { success: true }
}

/**
 * Shutdown ALL services
 */
async function shutdown() {
  for (const [projectDir, state] of projects) {
    if (state.service) {
      try {
        await state.service.dispose()
        console.log('[mgrep] Service disposed for:', projectDir)
      } catch (error) {
        console.error('[mgrep] Dispose failed for', projectDir, ':', error)
      }
    }
  }

  projects.clear()
  MgrepLocalService = null
  activeProjectPath = null
}

module.exports = {
  setMainWindow,
  initialize,
  search,
  indexFile,
  indexFiles,
  onFileChange,
  getStatus,
  getAllProjectsStatus,  // New: get all projects
  setActiveProject,      // New: set active project
  removeProject,         // New: remove a project
  getStats,
  clearIndex,
  resync: scanAndIndexProject,  // Manual resync for debugging
  shutdown,
}

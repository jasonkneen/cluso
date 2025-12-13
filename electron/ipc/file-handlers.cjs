const { ipcMain, dialog } = require('electron')
const fs = require('fs').promises
const path = require('path')
const fileWatcher = require('../file-watcher.cjs')
const mgrep = require('../mgrep.cjs')
const { validatePath, RateLimiter } = require('../shared/file-utils.cjs')

// Rate limiter for file search operations (max 2 concurrent, 500ms between starts)
const fileSearchLimiter = new RateLimiter(2, 500)

function registerFileHandlers() {
  // File operations handlers
  ipcMain.handle('files:readFile', async (event, filePath) => {
    const validation = validatePath(filePath, { allowHomeDir: true })
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    try {
      const content = await fs.readFile(validation.path, 'utf-8')
      return { success: true, data: content }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:selectFile', async (event, filePath) => {
    const validation = validatePath(filePath, { allowHomeDir: true })
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    try {
      const content = await fs.readFile(validation.path, 'utf-8')
      return { success: true, data: { path: validation.path, content } }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:listDirectory', async (event, dirPath) => {
    try {
      const targetDir = dirPath || process.cwd()
      const validation = validatePath(targetDir, { allowHomeDir: true })
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }
      const resolvedDir = validation.path
      console.log('[Files] Listing directory:', resolvedDir)
      const entries = await fs.readdir(resolvedDir, { withFileTypes: true })
      const files = entries.map(entry => ({
        name: entry.name,
        path: path.join(resolvedDir, entry.name),
        isDirectory: entry.isDirectory()
      }))
      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
      console.log('[Files] Found', files.length, 'entries')
      return { success: true, data: files }
    } catch (error) {
      console.error('[Files] Error listing directory:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:listPrompts', async () => {
    try {
      const promptsDir = path.join(process.cwd(), 'prompts')
      await fs.mkdir(promptsDir, { recursive: true })
      const files = await fs.readdir(promptsDir)
      const prompts = files.filter(f => f.endsWith('.txt') || f.endsWith('.md'))
      return { success: true, data: prompts.map(f => f.replace(/\.(txt|md)$/, '')) }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:readPrompt', async (event, name) => {
    try {
      if (!name || /[\\/]/.test(String(name)) || String(name).includes('..')) {
        return { success: false, error: 'Invalid prompt name' }
      }
      const promptsDir = path.join(process.cwd(), 'prompts')
      const txtPath = path.join(promptsDir, `${name}.txt`)
      const mdPath = path.join(promptsDir, `${name}.md`)

      let content = ''
      try {
        content = await fs.readFile(txtPath, 'utf-8')
      } catch {
        content = await fs.readFile(mdPath, 'utf-8')
      }

      return { success: true, data: content }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:writeFile', async (event, filePath, content) => {
    console.log('[Files] writeFile called with path:', filePath)
    const validation = validatePath(filePath, { allowHomeDir: true })
    if (!validation.valid) {
      console.log('[Files] ❌ Path validation failed:', validation.error)
      return { success: false, error: validation.error }
    }

    try {
      await fs.writeFile(validation.path, content, 'utf-8')
      console.log('[Files] ✅ Successfully wrote file:', validation.path)
      return { success: true }
    } catch (error) {
      console.error('[Files] ❌ Error writing file:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:createFile', async (event, filePath, content = '') => {
    const validation = validatePath(filePath, { allowHomeDir: true })
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    try {
      try {
        await fs.access(validation.path)
        return { success: false, error: 'File already exists' }
      } catch {
        // File doesn't exist, good to create
      }
      await fs.writeFile(validation.path, content, 'utf-8')
      console.log('[Files] Created file:', validation.path)
      return { success: true }
    } catch (error) {
      console.error('[Files] Error creating file:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:deleteFile', async (event, filePath) => {
    const validation = validatePath(filePath, { allowHomeDir: true })
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    try {
      await fs.unlink(validation.path)
      console.log('[Files] Deleted file:', validation.path)
      return { success: true }
    } catch (error) {
      console.error('[Files] Error deleting file:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:renameFile', async (event, oldPath, newPath) => {
    const oldValidation = validatePath(oldPath, { allowHomeDir: true })
    const newValidation = validatePath(newPath, { allowHomeDir: true })
    if (!oldValidation.valid) {
      return { success: false, error: oldValidation.error }
    }
    if (!newValidation.valid) {
      return { success: false, error: newValidation.error }
    }
    try {
      await fs.rename(oldValidation.path, newValidation.path)
      console.log('[Files] Renamed file:', oldValidation.path, '->', newValidation.path)
      return { success: true }
    } catch (error) {
      console.error('[Files] Error renaming file:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:createDirectory', async (event, dirPath) => {
    const validation = validatePath(dirPath, { allowHomeDir: true })
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    try {
      await fs.mkdir(validation.path, { recursive: true })
      console.log('[Files] Created directory:', validation.path)
      return { success: true }
    } catch (error) {
      console.error('[Files] Error creating directory:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:deleteDirectory', async (event, dirPath) => {
    const validation = validatePath(dirPath, { allowHomeDir: true })
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
    try {
      await fs.rm(validation.path, { recursive: true, force: true })
      console.log('[Files] Deleted directory:', validation.path)
      return { success: true }
    } catch (error) {
      console.error('[Files] Error deleting directory:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:exists', async (event, filePath) => {
    const validation = validatePath(filePath, { allowHomeDir: true })
    if (!validation.valid) {
      return { success: false, exists: false, error: validation.error }
    }
    try {
      await fs.access(validation.path)
      return { success: true, exists: true }
    } catch {
      return { success: true, exists: false }
    }
  })

  // Find files by name (searches recursively, case-insensitive)
  // Used by source patch to find component definition files when only filename is known
  ipcMain.handle('files:findFiles', async (event, searchDir, filename) => {
    try {
      const validation = validatePath(searchDir, { allowHomeDir: true })
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }
      const resolvedSearchDir = validation.path

      console.log('[Files] findFiles called:', { searchDir: resolvedSearchDir, filename })
      const results = []
      const searchLower = filename.toLowerCase()

      async function searchDirectory(dir, depth = 0) {
        if (depth > 10 || results.length >= 20) return

        try {
          const entries = await fs.readdir(dir, { withFileTypes: true })
          for (const entry of entries) {
            if (results.length >= 20) break

            // Skip common non-source directories
            if (entry.name === 'node_modules' ||
                entry.name === '.git' ||
                entry.name === 'dist' ||
                entry.name === 'build' ||
                entry.name === '.next' ||
                entry.name === 'coverage') {
              continue
            }

            const fullPath = path.join(dir, entry.name)

            if (entry.isDirectory()) {
              await searchDirectory(fullPath, depth + 1)
            } else if (entry.isFile()) {
              // Case-insensitive filename match
              if (entry.name.toLowerCase() === searchLower) {
                results.push(fullPath)
                console.log('[Files] Found match:', fullPath)
              }
            }
          }
        } catch (err) {
          // Skip directories we can't read
        }
      }

      await searchDirectory(resolvedSearchDir)
      console.log('[Files] findFiles found', results.length, 'matches')
      return { success: true, data: results }
    } catch (error) {
      console.error('[Files] findFiles error:', error.message)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:copyFile', async (event, srcPath, destPath) => {
    const srcValidation = validatePath(srcPath, { allowHomeDir: true })
    const destValidation = validatePath(destPath, { allowHomeDir: true })
    if (!srcValidation.valid) {
      return { success: false, error: srcValidation.error }
    }
    if (!destValidation.valid) {
      return { success: false, error: destValidation.error }
    }
    try {
      await fs.copyFile(srcValidation.path, destValidation.path)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:searchInFiles', async (event, searchPattern, dirPath, options = {}) => {
    return fileSearchLimiter.execute(async () => {
      try {
        const searchDirRaw = dirPath || process.cwd()
        const validation = validatePath(searchDirRaw, { allowHomeDir: true })
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }
        const { filePattern = '*', maxResults = 100, caseSensitive = false } = options
        const results = []
        const searchDir = validation.path
        const regex = new RegExp(searchPattern, caseSensitive ? 'g' : 'gi')

        async function searchDirectory(dir, depth = 0) {
          if (depth > 10 || results.length >= maxResults) return

          const entries = await fs.readdir(dir, { withFileTypes: true })
          for (const entry of entries) {
            if (results.length >= maxResults) break

            const fullPath = path.join(dir, entry.name)

            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) {
              continue
            }

            if (entry.isDirectory()) {
              await searchDirectory(fullPath, depth + 1)
            } else if (entry.isFile()) {
              if (filePattern !== '*') {
                const patterns = filePattern.split(',').map(p => p.trim())
                const matches = patterns.some(p => {
                  if (p.startsWith('*.')) {
                    return entry.name.endsWith(p.slice(1))
                  }
                  return entry.name.includes(p)
                })
                if (!matches) continue
              }

              try {
                const content = await fs.readFile(fullPath, 'utf-8')
                const lines = content.split('\n')
                for (let i = 0; i < lines.length; i++) {
                  if (regex.test(lines[i])) {
                    results.push({
                      file: fullPath,
                      line: i + 1,
                      content: lines[i].trim().substring(0, 200),
                    })
                    if (results.length >= maxResults) break
                  }
                }
              } catch {
                // Skip files that can't be read as text
              }
            }
          }
        }

        await searchDirectory(searchDir)
        return { success: true, data: results }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
  })

  ipcMain.handle('files:glob', async (event, pattern, dirPath) => {
    return fileSearchLimiter.execute(async () => {
      try {
        const searchDirRaw = dirPath || process.cwd()
        const validation = validatePath(searchDirRaw, { allowHomeDir: true })
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }
        const searchDir = validation.path
        const results = []

        function matchGlob(filename, pattern) {
          const regexPattern = pattern
            .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
            .replace(/\*/g, '[^/]*')
            .replace(/<<<DOUBLESTAR>>>/g, '.*')
            .replace(/\?/g, '.')
          return new RegExp(`^${regexPattern}$`).test(filename)
        }

        async function searchDirectory(dir, relativePath = '') {
          if (results.length >= 1000) return

          const entries = await fs.readdir(dir, { withFileTypes: true })
          for (const entry of entries) {
            if (results.length >= 1000) break

            const fullPath = path.join(dir, entry.name)
            const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name

            if (entry.name === 'node_modules' || entry.name === '.git') {
              continue
            }

            if (entry.isDirectory()) {
              if (pattern.includes('**')) {
                await searchDirectory(fullPath, relPath)
              }
            }

            if (matchGlob(relPath, pattern) || matchGlob(entry.name, pattern)) {
              results.push({
                path: fullPath,
                relativePath: relPath,
                isDirectory: entry.isDirectory(),
              })
            }

            if (entry.isDirectory() && !pattern.includes('**')) {
              if (pattern.includes('/')) {
                await searchDirectory(fullPath, relPath)
              }
            }
          }
        }

        await searchDirectory(searchDir)
        return { success: true, data: results }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
  })

  ipcMain.handle('files:readMultiple', async (event, filePaths) => {
    try {
      const results = await Promise.all(
        (filePaths || []).map(async (rawPath) => {
          const validation = validatePath(rawPath, { allowHomeDir: true })
          if (!validation.valid) {
            return { path: rawPath, success: false, error: validation.error }
          }
          try {
            const content = await fs.readFile(validation.path, 'utf-8')
            return { path: validation.path, success: true, content }
          } catch (err) {
            return { path: validation.path, success: false, error: err.message }
          }
        })
      )
      return { success: true, data: results }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:getTree', async (event, dirPath, options = {}) => {
    try {
      const { maxDepth = 5, includeHidden = false } = options
      const searchDirRaw = dirPath || process.cwd()
      const validation = validatePath(searchDirRaw, { allowHomeDir: true })
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }
      const searchDir = validation.path

      async function buildTree(dir, depth = 0) {
        if (depth >= maxDepth) return null

        const entries = await fs.readdir(dir, { withFileTypes: true })
        const children = []

        for (const entry of entries) {
          if (!includeHidden && entry.name.startsWith('.')) continue
          if (entry.name === 'node_modules') continue

          const fullPath = path.join(dir, entry.name)
          const node = {
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : 'file',
          }

          if (entry.isDirectory()) {
            const subTree = await buildTree(fullPath, depth + 1)
            if (subTree) {
              node.children = subTree
            }
          }

          children.push(node)
        }

        return children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      }

      const tree = await buildTree(searchDir)
      return { success: true, data: tree }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:getCwd', async () => {
    try {
      return { success: true, data: process.cwd() }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('files:saveImage', async (event, base64DataUrl, destPath) => {
    console.log('[Files] saveImage called with destPath:', destPath)

    const validation = validatePath(destPath, { allowHomeDir: true })
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    try {
      const matches = base64DataUrl.match(/^data:(.+);base64,(.+)$/)
      if (!matches) {
        return { success: false, error: 'Invalid base64 data URL format' }
      }

      const mimeType = matches[1]
      const base64Data = matches[2]
      const buffer = Buffer.from(base64Data, 'base64')

      const dir = path.dirname(validation.path)
      await fs.mkdir(dir, { recursive: true })

      await fs.writeFile(validation.path, buffer)
      console.log('[Files] Image saved successfully:', validation.path, 'size:', buffer.length)

      return {
        success: true,
        data: {
          path: validation.path,
          size: buffer.length,
          mimeType
        }
      }
    } catch (error) {
      console.error('[Files] saveImage error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Project Folder'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    const folderPath = result.filePaths[0]
    const folderName = path.basename(folderPath)
    return { success: true, data: { path: folderPath, name: folderName } }
  })

  // File watcher handlers
  ipcMain.handle('file-watcher:start', async (event, projectPath) => {
    return fileWatcher.startWatching(projectPath)
  })

  ipcMain.handle('file-watcher:stop', async (event, projectPath) => {
    return fileWatcher.stopWatching(projectPath)
  })

  ipcMain.handle('file-watcher:get-watched', async () => {
    return fileWatcher.getWatchedPaths()
  })

  // Mgrep handlers
  ipcMain.handle('mgrep:initialize', async (event, projectPath) => {
    return mgrep.initialize(projectPath)
  })

  ipcMain.handle('mgrep:search', async (event, query, options) => {
    return mgrep.search(query, options)
  })

  ipcMain.handle('mgrep:index-file', async (event, filePath, content, projectPath) => {
    return mgrep.indexFile(filePath, content, projectPath)
  })

  ipcMain.handle('mgrep:index-files', async (event, files, projectPath) => {
    return mgrep.indexFiles(files, projectPath)
  })

  ipcMain.handle('mgrep:on-file-change', async (event, changeEvent) => {
    return mgrep.onFileChange(changeEvent)
  })

  ipcMain.handle('mgrep:get-status', async (event, projectPath) => {
    return mgrep.getStatus(projectPath)
  })

  ipcMain.handle('mgrep:get-all-projects-status', async () => {
    return mgrep.getAllProjectsStatus()
  })

  ipcMain.handle('mgrep:set-active-project', async (event, projectPath) => {
    return mgrep.setActiveProject(projectPath)
  })

  ipcMain.handle('mgrep:remove-project', async (event, projectPath) => {
    return mgrep.removeProject(projectPath)
  })

  ipcMain.handle('mgrep:get-stats', async (event, projectPath) => {
    return mgrep.getStats(projectPath)
  })

  ipcMain.handle('mgrep:clear-index', async (event, projectPath) => {
    return mgrep.clearIndex(projectPath)
  })

  ipcMain.handle('mgrep:resync', async (event, projectPath) => {
    try {
      return await mgrep.resync(projectPath)
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Lint code snippet using ESLint
  ipcMain.handle('files:lintCode', async (event, code, filePath) => {
    try {
      // Create a temp file with the code to lint
      const os = require('os')
      const tempDir = os.tmpdir()
      const ext = filePath?.endsWith('.tsx') ? '.tsx' : filePath?.endsWith('.ts') ? '.ts' : '.jsx'
      const tempFile = path.join(tempDir, `cluso-lint-${Date.now()}${ext}`)

      await fs.writeFile(tempFile, code, 'utf-8')

      // Try to run ESLint on the temp file
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)

      try {
        // Use project's ESLint if available, otherwise fall back to global
        const eslintPath = filePath
          ? path.join(path.dirname(filePath), 'node_modules', '.bin', 'eslint')
          : 'eslint'

        const { stdout, stderr } = await execAsync(
          `${eslintPath} --format=json "${tempFile}"`,
          { timeout: 5000 }
        )

        const results = JSON.parse(stdout)
        const errors = []

        for (const result of results) {
          for (const msg of result.messages || []) {
            if (msg.severity === 2) { // Only errors, not warnings
              errors.push(`Line ${msg.line}: ${msg.message} (${msg.ruleId})`)
            }
          }
        }

        // Clean up temp file
        await fs.unlink(tempFile).catch(() => {})

        return {
          success: true,
          data: {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
          }
        }
      } catch (execError) {
        // Clean up temp file
        await fs.unlink(tempFile).catch(() => {})

        // ESLint returns exit code 1 when there are errors
        if (execError.stdout) {
          try {
            const results = JSON.parse(execError.stdout)
            const errors = []

            for (const result of results) {
              for (const msg of result.messages || []) {
                if (msg.severity === 2) {
                  errors.push(`Line ${msg.line}: ${msg.message} (${msg.ruleId})`)
                }
              }
            }

            return {
              success: true,
              data: {
                valid: errors.length === 0,
                errors: errors.length > 0 ? errors : undefined
              }
            }
          } catch (parseErr) {
            // Couldn't parse ESLint output
          }
        }

        // ESLint not available or other error - just skip linting
        console.log('[Files] ESLint not available:', execError.message?.substring(0, 100))
        return { success: true, data: { valid: true } }
      }
    } catch (error) {
      console.error('[Files] lintCode error:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Get specific lines from a source file
  // Used by visual editor to fetch code for editing based on data-cluso-id metadata
  ipcMain.handle('files:getSourceLines', async (event, params) => {
    const { filePath, startLine, lineCount = 20, projectPath } = params

    try {
      // Resolve file path relative to project
      let fullPath = filePath
      if (projectPath && !path.isAbsolute(filePath)) {
        fullPath = path.join(projectPath, filePath)
      }

      // Validate path
      const validation = validatePath(fullPath, { allowHomeDir: true })
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      // Read file
      const content = await fs.readFile(validation.path, 'utf-8')
      const lines = content.split('\n')

      // Extract requested lines (1-indexed)
      const start = Math.max(0, (startLine || 1) - 1)
      const end = Math.min(lines.length, start + lineCount)
      const sourceLines = lines.slice(start, end)

      return {
        success: true,
        data: {
          filePath: validation.path,
          startLine: start + 1,
          endLine: end,
          totalLines: lines.length,
          lines: sourceLines,
          content: sourceLines.join('\n')
        }
      }
    } catch (error) {
      console.error('[Files] getSourceLines error:', error.message)
      return { success: false, error: error.message }
    }
  })
}

module.exports = registerFileHandlers

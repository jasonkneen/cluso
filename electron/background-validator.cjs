/**
 * Background Validator - Runs linting, type checks, and validation
 *
 * Triggered by file changes from the file watcher.
 * Debounces multiple rapid changes to avoid excessive validation runs.
 * Reports issues back to the renderer as validation issues.
 */

const { execFile } = require('child_process')
const path = require('path')
const fs = require('fs').promises

// Reference to main window for sending events
let mainWindow = null

// Debounce timers by project path
const debounceTimers = new Map()

// Validation state by project path
const validationState = new Map()

/**
 * Set the main window reference for IPC
 */
function setMainWindow(win) {
  mainWindow = win
}

/**
 * Send validation event to renderer
 */
function sendValidationEvent(type, projectPath, data) {
  if (!mainWindow || mainWindow.isDestroyed()) return

  mainWindow.webContents.send('background-validator:event', {
    type, // 'start' | 'complete' | 'error' | 'issue'
    projectPath,
    timestamp: Date.now(),
    ...data,
  })
}

/**
 * Detect project type by checking for config files
 */
async function detectProjectType(projectPath) {
  const checks = {
    typescript: ['tsconfig.json'],
    eslint: ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.cjs', 'eslint.config.js', 'eslint.config.mjs'],
    prettier: ['.prettierrc', '.prettierrc.js', '.prettierrc.json', 'prettier.config.js'],
    biome: ['biome.json', 'biome.jsonc'],
    packageJson: ['package.json'],
  }

  const detected = {}

  for (const [type, files] of Object.entries(checks)) {
    for (const file of files) {
      try {
        await fs.access(path.join(projectPath, file))
        detected[type] = file
        break
      } catch {
        // File doesn't exist
      }
    }
  }

  return detected
}

/**
 * Safe execFile wrapper that doesn't throw
 */
function execFileNoThrow(command, args, options) {
  return new Promise((resolve) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        error,
        exitCode: error ? error.code : 0,
      })
    })
  })
}

/**
 * Run TypeScript type check
 */
async function runTypeCheck(projectPath) {
  const tscPath = path.join(projectPath, 'node_modules', '.bin', 'tsc')

  // Check if tsc exists
  try {
    await fs.access(tscPath)
  } catch {
    return { tool: 'typescript', success: true, issues: [], skipped: true }
  }

  const result = await execFileNoThrow(tscPath, ['--noEmit', '--pretty', 'false'], {
    cwd: projectPath,
    maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    timeout: 60000, // 60 second timeout
  })

  const output = result.stdout + result.stderr
  const issues = parseTypeScriptOutput(output, projectPath)

  return {
    tool: 'typescript',
    success: issues.length === 0,
    issues,
    raw: output,
  }
}

/**
 * Parse TypeScript compiler output into structured issues
 */
function parseTypeScriptOutput(output, projectPath) {
  const issues = []
  // Match: path/file.ts(line,col): error TS1234: message
  const regex = /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/gm

  let match
  while ((match = regex.exec(output)) !== null) {
    const [, filePath, line, col, severity, code, message] = match
    issues.push({
      file: path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath),
      relativePath: path.isAbsolute(filePath) ? path.relative(projectPath, filePath) : filePath,
      line: parseInt(line, 10),
      column: parseInt(col, 10),
      severity: severity === 'error' ? 'error' : 'warning',
      code,
      message: message.trim(),
      tool: 'typescript',
    })
  }

  return issues
}

/**
 * Run ESLint
 */
async function runESLint(projectPath) {
  const eslintPath = path.join(projectPath, 'node_modules', '.bin', 'eslint')

  // Check if eslint exists
  try {
    await fs.access(eslintPath)
  } catch {
    return { tool: 'eslint', success: true, issues: [], skipped: true }
  }

  const result = await execFileNoThrow(eslintPath, ['.', '--format', 'json', '--max-warnings', '-1'], {
    cwd: projectPath,
    maxBuffer: 1024 * 1024 * 10,
    timeout: 60000,
  })

  try {
    const results = JSON.parse(result.stdout)
    const issues = parseESLintOutput(results, projectPath)
    return {
      tool: 'eslint',
      success: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    }
  } catch {
    // ESLint output wasn't valid JSON (might be an error message)
    return {
      tool: 'eslint',
      success: true,
      issues: [],
      raw: result.stdout || result.stderr,
    }
  }
}

/**
 * Parse ESLint JSON output into structured issues
 */
function parseESLintOutput(results, projectPath) {
  const issues = []

  for (const file of results) {
    if (file.messages && file.messages.length > 0) {
      for (const msg of file.messages) {
        issues.push({
          file: file.filePath,
          relativePath: path.relative(projectPath, file.filePath),
          line: msg.line || 1,
          column: msg.column || 1,
          severity: msg.severity === 2 ? 'error' : 'warning',
          code: msg.ruleId || 'unknown',
          message: msg.message,
          tool: 'eslint',
          fixable: !!msg.fix,
        })
      }
    }
  }

  return issues
}

/**
 * Run all applicable validations for a project
 */
async function runValidation(projectPath, changedFiles = []) {
  const state = validationState.get(projectPath) || { running: false, issues: [] }

  if (state.running) {
    console.log('[Validator] Already running for:', projectPath)
    return
  }

  state.running = true
  state.lastRun = Date.now()
  validationState.set(projectPath, state)

  console.log('[Validator] Starting validation for:', projectPath)
  sendValidationEvent('start', projectPath, { changedFiles })

  const projectType = await detectProjectType(projectPath)
  console.log('[Validator] Detected project type:', projectType)

  const results = []
  const allIssues = []

  // Run TypeScript check if tsconfig.json exists
  if (projectType.typescript) {
    try {
      const tsResult = await runTypeCheck(projectPath)
      results.push(tsResult)
      allIssues.push(...tsResult.issues)
      console.log('[Validator] TypeScript:', tsResult.issues.length, 'issues')
    } catch (err) {
      console.error('[Validator] TypeScript error:', err)
    }
  }

  // Run ESLint if config exists
  if (projectType.eslint) {
    try {
      const eslintResult = await runESLint(projectPath)
      results.push(eslintResult)
      allIssues.push(...eslintResult.issues)
      console.log('[Validator] ESLint:', eslintResult.issues.length, 'issues')
    } catch (err) {
      console.error('[Validator] ESLint error:', err)
    }
  }

  // Update state
  state.running = false
  state.issues = allIssues
  state.lastComplete = Date.now()
  validationState.set(projectPath, state)

  // Send completion event with all issues
  sendValidationEvent('complete', projectPath, {
    results,
    issues: allIssues,
    summary: {
      errors: allIssues.filter(i => i.severity === 'error').length,
      warnings: allIssues.filter(i => i.severity === 'warning').length,
      total: allIssues.length,
    },
  })

  console.log('[Validator] Complete:', allIssues.length, 'total issues')

  return { results, issues: allIssues }
}

/**
 * Handle file change event - debounce and trigger validation
 */
function onFileChange(projectPath, filePath, changeType) {
  // Clear existing debounce timer
  if (debounceTimers.has(projectPath)) {
    clearTimeout(debounceTimers.get(projectPath).timer)
  }

  // Track changed files during debounce window
  const existing = debounceTimers.get(projectPath) || { files: new Set() }
  existing.files.add(filePath)

  // Set new debounce timer (wait 1.5 seconds after last change)
  existing.timer = setTimeout(() => {
    const changedFiles = Array.from(existing.files)
    debounceTimers.delete(projectPath)

    // Only validate source files
    const sourceFiles = changedFiles.filter(f => {
      const ext = path.extname(f).toLowerCase()
      return ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.mjs', '.cjs'].includes(ext)
    })

    if (sourceFiles.length > 0) {
      runValidation(projectPath, sourceFiles)
    }
  }, 1500)

  debounceTimers.set(projectPath, existing)
}

/**
 * Get current validation state for a project
 */
function getValidationState(projectPath) {
  return validationState.get(projectPath) || { running: false, issues: [] }
}

/**
 * Manually trigger validation
 */
async function triggerValidation(projectPath) {
  return runValidation(projectPath)
}

/**
 * Clear validation state for a project
 */
function clearValidation(projectPath) {
  if (debounceTimers.has(projectPath)) {
    clearTimeout(debounceTimers.get(projectPath).timer)
    debounceTimers.delete(projectPath)
  }
  validationState.delete(projectPath)
}

/**
 * Stop all validators and clear state
 */
function stopAll() {
  for (const [, data] of debounceTimers) {
    clearTimeout(data.timer)
  }
  debounceTimers.clear()
  validationState.clear()
}

module.exports = {
  setMainWindow,
  onFileChange,
  getValidationState,
  triggerValidation,
  clearValidation,
  stopAll,
}

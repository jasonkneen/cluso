/**
 * MLX Server Manager - Setup and manage the qwen3-embeddings-mlx server
 *
 * Provides automated setup and management of the MLX embedding server
 * for GPU-accelerated embeddings on Apple Silicon.
 */

import { execSync, spawn, ChildProcess } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Default installation directory
const MLX_HOME = join(homedir(), '.cache', 'mgrep-local', 'mlx')
const MLX_REPO = 'https://github.com/jakedahn/qwen3-embeddings-mlx.git'
const PID_FILE = join(MLX_HOME, 'server.pid')

export interface MlxSetupOptions {
  installDir?: string
  verbose?: boolean
  pythonPath?: string
}

export interface MlxServerOptions {
  port?: number
  model?: '0.6B' | '4B' | '8B'
  verbose?: boolean
}

/**
 * Find Python 3.10+ installation
 */
function findPython(): string | null {
  const candidates = [
    '/opt/homebrew/bin/python3.12',
    '/opt/homebrew/bin/python3.11',
    '/opt/homebrew/bin/python3.10',
    '/usr/local/bin/python3.12',
    '/usr/local/bin/python3.11',
    '/usr/local/bin/python3.10',
    'python3.12',
    'python3.11',
    'python3.10',
    'python3',
  ]

  for (const python of candidates) {
    try {
      const version = execSync(`${python} --version 2>&1`, { encoding: 'utf-8' }).trim()
      const match = version.match(/Python (\d+)\.(\d+)/)
      if (match) {
        const major = parseInt(match[1])
        const minor = parseInt(match[2])
        if (major === 3 && minor >= 10) {
          return python
        }
      }
    } catch {
      // Not found, try next
    }
  }

  return null
}

/**
 * Check if MLX server is already set up
 */
export function isMlxInstalled(installDir = MLX_HOME): boolean {
  const venvPath = join(installDir, 'qwen3-embeddings-mlx', '.venv')
  const serverPath = join(installDir, 'qwen3-embeddings-mlx', 'server.py')
  return existsSync(venvPath) && existsSync(serverPath)
}

/**
 * Get the server directory path
 */
export function getMlxServerDir(installDir = MLX_HOME): string {
  return join(installDir, 'qwen3-embeddings-mlx')
}

/**
 * Setup the MLX embedding server
 */
export async function setupMlxServer(options: MlxSetupOptions = {}): Promise<void> {
  const installDir = options.installDir ?? MLX_HOME
  const verbose = options.verbose ?? false

  const log = (...args: unknown[]) => {
    if (verbose) console.log('[mlx-setup]', ...args)
  }

  // Find Python 3.10+
  const python = options.pythonPath ?? findPython()
  if (!python) {
    throw new Error(
      'Python 3.10+ required but not found.\n' +
      'Install with: brew install python@3.12'
    )
  }

  log('Using Python:', python)

  // Create install directory
  if (!existsSync(installDir)) {
    log('Creating install directory:', installDir)
    mkdirSync(installDir, { recursive: true })
  }

  const repoDir = join(installDir, 'qwen3-embeddings-mlx')

  // Clone repository if not exists
  if (!existsSync(repoDir)) {
    log('Cloning qwen3-embeddings-mlx...')
    execSync(`git clone ${MLX_REPO}`, {
      cwd: installDir,
      stdio: verbose ? 'inherit' : 'pipe',
    })
  } else {
    log('Repository already exists, pulling latest...')
    try {
      execSync('git pull', {
        cwd: repoDir,
        stdio: verbose ? 'inherit' : 'pipe',
      })
    } catch {
      log('Git pull failed, continuing with existing code')
    }
  }

  const venvPath = join(repoDir, '.venv')

  // Create venv if not exists
  if (!existsSync(venvPath)) {
    log('Creating Python virtual environment...')
    execSync(`${python} -m venv --without-pip "${venvPath}"`, {
      cwd: repoDir,
      stdio: verbose ? 'inherit' : 'pipe',
    })

    // Bootstrap pip
    log('Installing pip...')
    const venvPython = join(venvPath, 'bin', 'python')
    execSync(`curl -sS https://bootstrap.pypa.io/get-pip.py | "${venvPython}"`, {
      cwd: repoDir,
      shell: '/bin/bash',
      stdio: verbose ? 'inherit' : 'pipe',
    })
  }

  // Install dependencies
  log('Installing dependencies (this may take a few minutes)...')
  const pipPath = join(venvPath, 'bin', 'pip')
  execSync(`"${pipPath}" install -r requirements.txt`, {
    cwd: repoDir,
    stdio: verbose ? 'inherit' : 'pipe',
  })

  log('MLX server setup complete!')
  log('Server directory:', repoDir)
}

/**
 * Start the MLX server
 */
export function startMlxServer(options: MlxServerOptions = {}): ChildProcess {
  const port = options.port ?? 8000
  const model = options.model ?? '0.6B'
  const verbose = options.verbose ?? false

  const serverDir = getMlxServerDir()
  if (!isMlxInstalled()) {
    throw new Error(
      'MLX server not installed. Run: mgrep-local mlx setup'
    )
  }

  const venvPython = join(serverDir, '.venv', 'bin', 'python')
  const serverScript = join(serverDir, 'server.py')

  // Check if already running
  if (isMlxServerRunning()) {
    throw new Error('MLX server is already running')
  }

  const env = {
    ...process.env,
    MLX_MODEL: model,
    PORT: String(port),
  }

  const serverProcess = spawn(venvPython, [serverScript], {
    cwd: serverDir,
    env,
    detached: true,
    stdio: verbose ? 'inherit' : 'ignore',
  })

  // Save PID for later management
  if (serverProcess.pid) {
    writeFileSync(PID_FILE, String(serverProcess.pid))
  }

  // Unref to allow parent to exit
  serverProcess.unref()

  return serverProcess
}

/**
 * Stop the MLX server
 */
export function stopMlxServer(): boolean {
  if (!existsSync(PID_FILE)) {
    return false
  }

  try {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim())
    process.kill(pid, 'SIGTERM')
    unlinkSync(PID_FILE)
    return true
  } catch {
    // Process might already be dead
    try {
      unlinkSync(PID_FILE)
    } catch {}
    return false
  }
}

/**
 * Check if MLX server is running
 */
export function isMlxServerRunning(): boolean {
  if (!existsSync(PID_FILE)) {
    return false
  }

  try {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim())
    // Signal 0 checks if process exists
    process.kill(pid, 0)
    return true
  } catch {
    // Process doesn't exist, clean up stale PID file
    try {
      unlinkSync(PID_FILE)
    } catch {}
    return false
  }
}

/**
 * Get MLX server status
 */
export async function getMlxStatus(serverUrl = 'http://localhost:8000'): Promise<{
  installed: boolean
  running: boolean
  serverUrl: string
  modelLoaded: boolean
  installDir: string
}> {
  const installed = isMlxInstalled()
  const processRunning = isMlxServerRunning()

  let modelLoaded = false
  if (processRunning) {
    try {
      const response = await fetch(`${serverUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      })
      modelLoaded = response.ok
    } catch {
      // Server not responding
    }
  }

  return {
    installed,
    running: processRunning,
    serverUrl,
    modelLoaded,
    installDir: getMlxServerDir(),
  }
}

/**
 * Wait for server to be ready
 */
export async function waitForServer(
  serverUrl = 'http://localhost:8000',
  timeoutMs = 60000
): Promise<boolean> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${serverUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      })
      if (response.ok) {
        return true
      }
    } catch {
      // Not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return false
}

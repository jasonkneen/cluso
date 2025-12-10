const path = require('path')
const os = require('os')
const fsSync = require('fs')

// Simple rate limiter for file operations
class RateLimiter {
  constructor(maxConcurrent = 2, minIntervalMs = 500) {
    this.maxConcurrent = maxConcurrent
    this.minIntervalMs = minIntervalMs
    this.activeCount = 0
    this.queue = []
    this.lastCallTime = 0
  }

  async execute(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject })
      this.processQueue()
    })
  }

  async processQueue() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return
    }

    const now = Date.now()
    const timeSinceLast = now - this.lastCallTime
    if (timeSinceLast < this.minIntervalMs) {
      setTimeout(() => this.processQueue(), this.minIntervalMs - timeSinceLast)
      return
    }

    const { fn, resolve, reject } = this.queue.shift()
    this.activeCount++
    this.lastCallTime = Date.now()

    try {
      const result = await fn()
      resolve(result)
    } catch (error) {
      reject(error)
    } finally {
      this.activeCount--
      this.processQueue()
    }
  }
}

function validatePath(filePath, options = {}) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'Invalid path' }
  }

  // Resolve the path (handles .., ., etc)
  let resolved = path.resolve(filePath)

  // Resolve symlinks to prevent symlink-based bypasses
  try {
    if (fsSync.existsSync(resolved)) {
      resolved = fsSync.realpathSync(resolved)
    }
  } catch (e) {
    // If we can't resolve, use the original resolved path
  }

  const projectRoot = path.resolve(process.cwd())

  // By default, only allow project root
  // Use allowHomeDir: true only for specific trusted operations
  if (resolved.startsWith(projectRoot + path.sep) || resolved === projectRoot) {
    return { valid: true, path: resolved }
  }

  // Allow home directory only if explicitly requested (for user config files, etc)
  if (options.allowHomeDir) {
    const homeDir = os.homedir()
    // Still block sensitive directories even in home
    const blockedDirs = ['.ssh', '.aws', '.gnupg', '.kube', '.config/gcloud']
    const relativePath = path.relative(homeDir, resolved)
    const isBlocked = blockedDirs.some(dir =>
      relativePath.startsWith(dir + path.sep) || relativePath === dir
    )
    if (!isBlocked && (resolved.startsWith(homeDir + path.sep) || resolved === homeDir)) {
      return { valid: true, path: resolved }
    }
  }

  return { valid: false, error: 'Path outside allowed directories' }
}

module.exports = {
  RateLimiter,
  validatePath
}

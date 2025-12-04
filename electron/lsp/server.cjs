/**
 * LSP Server Definitions
 *
 * Each server definition includes:
 * - id: Unique identifier
 * - name: Human-readable name
 * - extensions: File extensions this server handles
 * - rootPatterns: Files/dirs that indicate project root
 * - spawn: Function to spawn the server process
 * - installable: Whether we can auto-install this server
 */

const path = require('path')
const { spawn, execFileSync } = require('child_process')
const fs = require('fs').promises

/**
 * Find the nearest directory containing one of the target files
 */
async function findProjectRoot(startPath, patterns, excludePatterns = []) {
  let current = path.dirname(startPath)
  const home = require('os').homedir()

  while (current !== home && current !== '/' && current !== path.parse(current).root) {
    // Check exclusions first
    for (const exclude of excludePatterns) {
      try {
        await fs.access(path.join(current, exclude))
        return null // Found exclusion, skip this server
      } catch {
        // Not found, continue
      }
    }

    // Check for root patterns
    for (const pattern of patterns) {
      try {
        await fs.access(path.join(current, pattern))
        return current
      } catch {
        // Not found, continue up
      }
    }

    current = path.dirname(current)
  }

  return null
}

/**
 * Check if a binary exists in PATH using execFileSync (safe, no shell injection)
 */
function which(binary) {
  try {
    // Use 'which' on Unix, 'where' on Windows
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const result = execFileSync(cmd, [binary], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    // 'where' on Windows can return multiple lines, take the first
    return result.split('\n')[0].trim() || null
  } catch {
    return null
  }
}

/**
 * Server Definitions
 */
const SERVERS = {
  typescript: {
    id: 'typescript',
    name: 'TypeScript',
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    rootPatterns: ['package.json', 'tsconfig.json', 'jsconfig.json'],
    excludePatterns: ['deno.json', 'deno.jsonc'],
    installable: true,
    installed: false,

    async checkInstalled() {
      // Check for typescript-language-server
      if (which('typescript-language-server')) return true
      // Check in node_modules
      try {
        require.resolve('typescript-language-server')
        return true
      } catch {
        return false
      }
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      // Try global install first
      const globalBin = which('typescript-language-server')
      if (globalBin) {
        return spawn(globalBin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      // Try npx (using spawn with array args, not shell interpolation)
      const npxBin = which('npx')
      if (npxBin) {
        return spawn(npxBin, ['typescript-language-server', ...args], {
          cwd: root,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      }

      return null
    },

    initialization: {
      preferences: {
        includeCompletionsForModuleExports: true,
        includeCompletionsWithInsertText: true,
      },
    },
  },

  eslint: {
    id: 'eslint',
    name: 'ESLint',
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'],
    rootPatterns: ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yaml', 'eslint.config.js', 'eslint.config.mjs'],
    installable: true,
    installed: false,

    async checkInstalled() {
      if (which('vscode-eslint-language-server')) return true
      try {
        require.resolve('vscode-langservers-extracted')
        return true
      } catch {
        return false
      }
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const globalBin = which('vscode-eslint-language-server')
      if (globalBin) {
        return spawn(globalBin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      // Try npx with vscode-langservers-extracted
      const npxBin = which('npx')
      if (npxBin) {
        return spawn(npxBin, ['vscode-eslint-language-server', ...args], {
          cwd: root,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      }

      return null
    },

    initialization: {
      settings: {
        validate: 'on',
        run: 'onType',
      },
    },
  },

  json: {
    id: 'json',
    name: 'JSON',
    extensions: ['.json', '.jsonc'],
    rootPatterns: ['package.json'],
    installable: true,
    installed: false,

    async checkInstalled() {
      if (which('vscode-json-language-server')) return true
      try {
        require.resolve('vscode-langservers-extracted')
        return true
      } catch {
        return false
      }
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const globalBin = which('vscode-json-language-server')
      if (globalBin) {
        return spawn(globalBin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      const npxBin = which('npx')
      if (npxBin) {
        return spawn(npxBin, ['vscode-json-language-server', ...args], {
          cwd: root,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      }

      return null
    },
  },

  css: {
    id: 'css',
    name: 'CSS/SCSS/Less',
    extensions: ['.css', '.scss', '.sass', '.less'],
    rootPatterns: ['package.json'],
    installable: true,
    installed: false,

    async checkInstalled() {
      if (which('vscode-css-language-server')) return true
      try {
        require.resolve('vscode-langservers-extracted')
        return true
      } catch {
        return false
      }
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const globalBin = which('vscode-css-language-server')
      if (globalBin) {
        return spawn(globalBin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      const npxBin = which('npx')
      if (npxBin) {
        return spawn(npxBin, ['vscode-css-language-server', ...args], {
          cwd: root,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      }

      return null
    },
  },

  html: {
    id: 'html',
    name: 'HTML',
    extensions: ['.html', '.htm'],
    rootPatterns: ['package.json', 'index.html'],
    installable: true,
    installed: false,

    async checkInstalled() {
      if (which('vscode-html-language-server')) return true
      try {
        require.resolve('vscode-langservers-extracted')
        return true
      } catch {
        return false
      }
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const globalBin = which('vscode-html-language-server')
      if (globalBin) {
        return spawn(globalBin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      const npxBin = which('npx')
      if (npxBin) {
        return spawn(npxBin, ['vscode-html-language-server', ...args], {
          cwd: root,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      }

      return null
    },
  },

  python: {
    id: 'python',
    name: 'Python (Pyright)',
    extensions: ['.py', '.pyi'],
    rootPatterns: ['pyproject.toml', 'setup.py', 'requirements.txt', 'Pipfile'],
    installable: true,
    installed: false,

    async checkInstalled() {
      return !!which('pyright-langserver') || !!which('pyright')
    },

    async spawn(root, options = {}) {
      const env = { ...process.env, ...options.env }

      const langserverBin = which('pyright-langserver')
      if (langserverBin) {
        return spawn(langserverBin, ['--stdio'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      const pyrightBin = which('pyright')
      if (pyrightBin) {
        return spawn(pyrightBin, ['--langserver', '--stdio'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      // Try npx
      const npxBin = which('npx')
      if (npxBin) {
        return spawn(npxBin, ['pyright', '--langserver', '--stdio'], {
          cwd: root,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      }

      return null
    },
  },

  go: {
    id: 'go',
    name: 'Go (gopls)',
    extensions: ['.go'],
    rootPatterns: ['go.mod', 'go.sum'],
    installable: false, // Requires Go toolchain
    installed: false,

    async checkInstalled() {
      return !!which('gopls')
    },

    async spawn(root, options = {}) {
      const bin = which('gopls')
      if (!bin) return null

      const env = { ...process.env, ...options.env }
      return spawn(bin, [], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
    },
  },

  rust: {
    id: 'rust',
    name: 'Rust (rust-analyzer)',
    extensions: ['.rs'],
    rootPatterns: ['Cargo.toml'],
    installable: false, // Requires rustup
    installed: false,

    async checkInstalled() {
      return !!which('rust-analyzer')
    },

    async spawn(root, options = {}) {
      const bin = which('rust-analyzer')
      if (!bin) return null

      const env = { ...process.env, ...options.env }
      return spawn(bin, [], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
    },
  },

  yaml: {
    id: 'yaml',
    name: 'YAML',
    extensions: ['.yaml', '.yml'],
    rootPatterns: ['package.json'],
    installable: true,
    installed: false,

    async checkInstalled() {
      return !!which('yaml-language-server')
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const bin = which('yaml-language-server')
      if (bin) {
        return spawn(bin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      const npxBin = which('npx')
      if (npxBin) {
        return spawn(npxBin, ['yaml-language-server', ...args], {
          cwd: root,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      }

      return null
    },
  },
}

/**
 * Get servers that handle a given file extension
 */
function getServersForExtension(ext) {
  return Object.values(SERVERS).filter(server =>
    server.extensions.includes(ext.toLowerCase())
  )
}

/**
 * Get a server by ID
 */
function getServer(id) {
  return SERVERS[id] || null
}

/**
 * Get all server definitions
 */
function getAllServers() {
  return { ...SERVERS }
}

module.exports = {
  SERVERS,
  findProjectRoot,
  which,
  getServersForExtension,
  getServer,
  getAllServers,
}

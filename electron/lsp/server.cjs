/**
 * LSP Server Definitions
 *
 * Each server definition includes:
 * - id: Unique identifier
 * - name: Human-readable name
 * - extensions: File extensions this server handles
 * - rootPatterns: Files/dirs that indicate project root
 * - spawn: Function to spawn the server process
 * - install: Function to install the server (if installable)
 * - checkInstalled: Function to check if installed
 */

const path = require('path')
const { spawn, execFileSync } = require('child_process')
const fs = require('fs').promises
const installer = require('./installer.cjs')

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
      // Check in our cache first
      const cachedPath = installer.getNpmBinaryPath('.bin/typescript-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      // Check system PATH
      if (which('typescript-language-server')) return true
      return false
    },

    async install(onProgress) {
      return installer.installNpmPackage(
        {
          packageName: 'typescript-language-server typescript',
          entryPoint: '.bin/typescript-language-server',
        },
        onProgress
      )
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      // Check our cache first
      const cachedPath = installer.getNpmBinaryPath('.bin/typescript-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      // Try global install
      const globalBin = which('typescript-language-server')
      if (globalBin) {
        return spawn(globalBin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      // Auto-install if not found
      console.log('[LSP] Auto-installing typescript-language-server...')
      const installedPath = await this.install()
      return spawn(installedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
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
    rootPatterns: [
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.json',
      '.eslintrc.yaml',
      'eslint.config.js',
      'eslint.config.mjs',
    ],
    installable: true,
    installed: false,

    async checkInstalled() {
      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-eslint-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      if (which('vscode-eslint-language-server')) return true
      return false
    },

    async install(onProgress) {
      return installer.installNpmPackage(
        {
          packageName: 'vscode-langservers-extracted',
          entryPoint: '.bin/vscode-eslint-language-server',
        },
        onProgress
      )
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-eslint-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const globalBin = which('vscode-eslint-language-server')
      if (globalBin) {
        return spawn(globalBin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      console.log('[LSP] Auto-installing vscode-eslint-language-server...')
      const installedPath = await this.install()
      return spawn(installedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
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
      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-json-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      if (which('vscode-json-language-server')) return true
      return false
    },

    async install(onProgress) {
      return installer.installNpmPackage(
        {
          packageName: 'vscode-langservers-extracted',
          entryPoint: '.bin/vscode-json-language-server',
        },
        onProgress
      )
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-json-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const globalBin = which('vscode-json-language-server')
      if (globalBin) {
        return spawn(globalBin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      console.log('[LSP] Auto-installing vscode-json-language-server...')
      const installedPath = await this.install()
      return spawn(installedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
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
      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-css-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      if (which('vscode-css-language-server')) return true
      return false
    },

    async install(onProgress) {
      return installer.installNpmPackage(
        {
          packageName: 'vscode-langservers-extracted',
          entryPoint: '.bin/vscode-css-language-server',
        },
        onProgress
      )
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-css-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const globalBin = which('vscode-css-language-server')
      if (globalBin) {
        return spawn(globalBin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      console.log('[LSP] Auto-installing vscode-css-language-server...')
      const installedPath = await this.install()
      return spawn(installedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
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
      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-html-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      if (which('vscode-html-language-server')) return true
      return false
    },

    async install(onProgress) {
      return installer.installNpmPackage(
        {
          packageName: 'vscode-langservers-extracted',
          entryPoint: '.bin/vscode-html-language-server',
        },
        onProgress
      )
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-html-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const globalBin = which('vscode-html-language-server')
      if (globalBin) {
        return spawn(globalBin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      console.log('[LSP] Auto-installing vscode-html-language-server...')
      const installedPath = await this.install()
      return spawn(installedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
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
      const cachedPath = installer.getNpmBinaryPath('.bin/pyright-langserver')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      return !!which('pyright-langserver') || !!which('pyright')
    },

    async install(onProgress) {
      return installer.installNpmPackage(
        {
          packageName: 'pyright',
          entryPoint: '.bin/pyright-langserver',
        },
        onProgress
      )
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/pyright-langserver')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const langserverBin = which('pyright-langserver')
      if (langserverBin) {
        return spawn(langserverBin, ['--stdio'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      const pyrightBin = which('pyright')
      if (pyrightBin) {
        return spawn(pyrightBin, ['--langserver', '--stdio'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      console.log('[LSP] Auto-installing pyright...')
      const installedPath = await this.install()
      return spawn(installedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
    },
  },

  go: {
    id: 'go',
    name: 'Go (gopls)',
    extensions: ['.go'],
    rootPatterns: ['go.mod', 'go.sum'],
    installable: true, // Can install via go install
    installed: false,

    async checkInstalled() {
      // Check our cache
      if (await installer.isCached('gopls')) return true
      return !!which('gopls')
    },

    async install(onProgress) {
      return installer.installGoPackage(
        {
          packagePath: 'golang.org/x/tools/gopls@latest',
          binaryName: 'gopls',
        },
        onProgress
      )
    },

    async spawn(root, options = {}) {
      const env = { ...process.env, ...options.env }

      // Check our cache
      if (await installer.isCached('gopls')) {
        const cachedPath = installer.getCachedBinaryPath('gopls')
        return spawn(cachedPath, [], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      const bin = which('gopls')
      if (bin) {
        return spawn(bin, [], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      // Try to auto-install if Go is available
      if (which('go')) {
        console.log('[LSP] Auto-installing gopls...')
        const installedPath = await this.install()
        return spawn(installedPath, [], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      return null
    },
  },

  rust: {
    id: 'rust',
    name: 'Rust (rust-analyzer)',
    extensions: ['.rs'],
    rootPatterns: ['Cargo.toml'],
    installable: true, // Can download from GitHub releases
    installed: false,

    async checkInstalled() {
      if (await installer.isCached('rust-analyzer')) return true
      return !!which('rust-analyzer')
    },

    async install(onProgress) {
      return installer.installFromGitHub(
        {
          repo: 'rust-lang/rust-analyzer',
          binaryName: 'rust-analyzer',
          getAssetName: (release, platform, arch) => {
            const platformMap = {
              darwin: 'apple-darwin',
              linux: 'unknown-linux-gnu',
              win32: 'pc-windows-msvc',
            }
            const archMap = {
              x64: 'x86_64',
              arm64: 'aarch64',
            }

            const p = platformMap[platform]
            const a = archMap[arch]
            if (!p || !a) return null

            const ext = platform === 'win32' ? '.zip' : '.gz'
            return `rust-analyzer-${a}-${p}${ext}`
          },
        },
        onProgress
      )
    },

    async spawn(root, options = {}) {
      const env = { ...process.env, ...options.env }

      if (await installer.isCached('rust-analyzer')) {
        const cachedPath = installer.getCachedBinaryPath('rust-analyzer')
        return spawn(cachedPath, [], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      const bin = which('rust-analyzer')
      if (bin) {
        return spawn(bin, [], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      console.log('[LSP] Auto-installing rust-analyzer...')
      const installedPath = await this.install()
      return spawn(installedPath, [], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
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
      const cachedPath = installer.getNpmBinaryPath('.bin/yaml-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      return !!which('yaml-language-server')
    },

    async install(onProgress) {
      return installer.installNpmPackage(
        {
          packageName: 'yaml-language-server',
          entryPoint: '.bin/yaml-language-server',
        },
        onProgress
      )
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/yaml-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const bin = which('yaml-language-server')
      if (bin) {
        return spawn(bin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      console.log('[LSP] Auto-installing yaml-language-server...')
      const installedPath = await this.install()
      return spawn(installedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
    },
  },

  tailwindcss: {
    id: 'tailwindcss',
    name: 'Tailwind CSS',
    extensions: ['.css', '.html', '.jsx', '.tsx', '.vue', '.svelte'],
    rootPatterns: ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs', 'tailwind.config.mjs'],
    installable: true,
    installed: false,

    async checkInstalled() {
      const cachedPath = installer.getNpmBinaryPath('.bin/tailwindcss-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      return !!which('tailwindcss-language-server')
    },

    async install(onProgress) {
      return installer.installNpmPackage(
        {
          packageName: '@tailwindcss/language-server',
          entryPoint: '.bin/tailwindcss-language-server',
        },
        onProgress
      )
    },

    async spawn(root, options = {}) {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/tailwindcss-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const bin = which('tailwindcss-language-server')
      if (bin) {
        return spawn(bin, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      console.log('[LSP] Auto-installing tailwindcss-language-server...')
      const installedPath = await this.install()
      return spawn(installedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
    },
  },
}

/**
 * Get servers that handle a given file extension
 */
function getServersForExtension(ext) {
  return Object.values(SERVERS).filter((server) => server.extensions.includes(ext.toLowerCase()))
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

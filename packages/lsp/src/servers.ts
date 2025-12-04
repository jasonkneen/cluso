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

import path from 'path'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import type { ChildProcess } from 'child_process'
import type { ServerDefinition, SpawnOptions, InstallProgressCallback } from './types'
import * as installer from './installer'

/**
 * Find the nearest directory containing one of the target files
 */
export async function findProjectRoot(
  startPath: string,
  patterns: string[],
  excludePatterns: string[] = []
): Promise<string | null> {
  let current = path.dirname(startPath)
  const home = os.homedir()

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
 * Server Definitions
 */
export const SERVERS: Record<string, ServerDefinition> = {
  typescript: {
    id: 'typescript',
    name: 'TypeScript',
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    rootPatterns: ['package.json', 'tsconfig.json', 'jsconfig.json'],
    excludePatterns: ['deno.json', 'deno.jsonc'],
    installable: true,

    async checkInstalled(): Promise<boolean> {
      const cachedPath = installer.getNpmBinaryPath('.bin/typescript-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      if (installer.which('typescript-language-server')) return true
      return false
    },

    async install(onProgress?: InstallProgressCallback): Promise<string> {
      return installer.installNpmPackage(
        {
          packageName: 'typescript-language-server typescript',
          entryPoint: '.bin/typescript-language-server',
        },
        onProgress
      )
    },

    async spawn(root: string, options: SpawnOptions = {}): Promise<ChildProcess | null> {
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
      const globalBin = installer.which('typescript-language-server')
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

    async checkInstalled(): Promise<boolean> {
      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-eslint-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      if (installer.which('vscode-eslint-language-server')) return true
      return false
    },

    async install(onProgress?: InstallProgressCallback): Promise<string> {
      return installer.installNpmPackage(
        {
          packageName: 'vscode-langservers-extracted',
          entryPoint: '.bin/vscode-eslint-language-server',
        },
        onProgress
      )
    },

    async spawn(root: string, options: SpawnOptions = {}): Promise<ChildProcess | null> {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-eslint-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const globalBin = installer.which('vscode-eslint-language-server')
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

    async checkInstalled(): Promise<boolean> {
      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-json-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      if (installer.which('vscode-json-language-server')) return true
      return false
    },

    async install(onProgress?: InstallProgressCallback): Promise<string> {
      return installer.installNpmPackage(
        {
          packageName: 'vscode-langservers-extracted',
          entryPoint: '.bin/vscode-json-language-server',
        },
        onProgress
      )
    },

    async spawn(root: string, options: SpawnOptions = {}): Promise<ChildProcess | null> {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-json-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const globalBin = installer.which('vscode-json-language-server')
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

    async checkInstalled(): Promise<boolean> {
      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-css-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      if (installer.which('vscode-css-language-server')) return true
      return false
    },

    async install(onProgress?: InstallProgressCallback): Promise<string> {
      return installer.installNpmPackage(
        {
          packageName: 'vscode-langservers-extracted',
          entryPoint: '.bin/vscode-css-language-server',
        },
        onProgress
      )
    },

    async spawn(root: string, options: SpawnOptions = {}): Promise<ChildProcess | null> {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-css-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const globalBin = installer.which('vscode-css-language-server')
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

    async checkInstalled(): Promise<boolean> {
      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-html-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      if (installer.which('vscode-html-language-server')) return true
      return false
    },

    async install(onProgress?: InstallProgressCallback): Promise<string> {
      return installer.installNpmPackage(
        {
          packageName: 'vscode-langservers-extracted',
          entryPoint: '.bin/vscode-html-language-server',
        },
        onProgress
      )
    },

    async spawn(root: string, options: SpawnOptions = {}): Promise<ChildProcess | null> {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/vscode-html-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const globalBin = installer.which('vscode-html-language-server')
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

    async checkInstalled(): Promise<boolean> {
      const cachedPath = installer.getNpmBinaryPath('.bin/pyright-langserver')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      return !!installer.which('pyright-langserver') || !!installer.which('pyright')
    },

    async install(onProgress?: InstallProgressCallback): Promise<string> {
      return installer.installNpmPackage(
        {
          packageName: 'pyright',
          entryPoint: '.bin/pyright-langserver',
        },
        onProgress
      )
    },

    async spawn(root: string, options: SpawnOptions = {}): Promise<ChildProcess | null> {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/pyright-langserver')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const langserverBin = installer.which('pyright-langserver')
      if (langserverBin) {
        return spawn(langserverBin, ['--stdio'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      const pyrightBin = installer.which('pyright')
      if (pyrightBin) {
        return spawn(pyrightBin, ['--langserver', '--stdio'], {
          cwd: root,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
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
    installable: true,

    async checkInstalled(): Promise<boolean> {
      if (await installer.isCached('gopls')) return true
      return !!installer.which('gopls')
    },

    async install(onProgress?: InstallProgressCallback): Promise<string> {
      return installer.installGoPackage(
        {
          packagePath: 'golang.org/x/tools/gopls@latest',
          binaryName: 'gopls',
        },
        onProgress
      )
    },

    async spawn(root: string, options: SpawnOptions = {}): Promise<ChildProcess | null> {
      const env = { ...process.env, ...options.env }

      if (await installer.isCached('gopls')) {
        const cachedPath = installer.getCachedBinaryPath('gopls')
        return spawn(cachedPath, [], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      const bin = installer.which('gopls')
      if (bin) {
        return spawn(bin, [], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      // Try to auto-install if Go is available
      if (installer.which('go')) {
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
    installable: true,

    async checkInstalled(): Promise<boolean> {
      if (await installer.isCached('rust-analyzer')) return true
      return !!installer.which('rust-analyzer')
    },

    async install(onProgress?: InstallProgressCallback): Promise<string> {
      return installer.installFromGitHub(
        {
          repo: 'rust-lang/rust-analyzer',
          binaryName: 'rust-analyzer',
          getAssetName: (_release, platform, arch) => {
            const platformMap: Record<string, string> = {
              darwin: 'apple-darwin',
              linux: 'unknown-linux-gnu',
              win32: 'pc-windows-msvc',
            }
            const archMap: Record<string, string> = {
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

    async spawn(root: string, options: SpawnOptions = {}): Promise<ChildProcess | null> {
      const env = { ...process.env, ...options.env }

      if (await installer.isCached('rust-analyzer')) {
        const cachedPath = installer.getCachedBinaryPath('rust-analyzer')
        return spawn(cachedPath, [], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      }

      const bin = installer.which('rust-analyzer')
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

    async checkInstalled(): Promise<boolean> {
      const cachedPath = installer.getNpmBinaryPath('.bin/yaml-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      return !!installer.which('yaml-language-server')
    },

    async install(onProgress?: InstallProgressCallback): Promise<string> {
      return installer.installNpmPackage(
        {
          packageName: 'yaml-language-server',
          entryPoint: '.bin/yaml-language-server',
        },
        onProgress
      )
    },

    async spawn(root: string, options: SpawnOptions = {}): Promise<ChildProcess | null> {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/yaml-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const bin = installer.which('yaml-language-server')
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
    rootPatterns: [
      'tailwind.config.js',
      'tailwind.config.ts',
      'tailwind.config.cjs',
      'tailwind.config.mjs',
    ],
    installable: true,

    async checkInstalled(): Promise<boolean> {
      const cachedPath = installer.getNpmBinaryPath('.bin/tailwindcss-language-server')
      try {
        await fs.access(cachedPath)
        return true
      } catch {
        // Not in cache
      }
      return !!installer.which('tailwindcss-language-server')
    },

    async install(onProgress?: InstallProgressCallback): Promise<string> {
      return installer.installNpmPackage(
        {
          packageName: '@tailwindcss/language-server',
          entryPoint: '.bin/tailwindcss-language-server',
        },
        onProgress
      )
    },

    async spawn(root: string, options: SpawnOptions = {}): Promise<ChildProcess | null> {
      const args = ['--stdio']
      const env = { ...process.env, ...options.env }

      const cachedPath = installer.getNpmBinaryPath('.bin/tailwindcss-language-server')
      try {
        await fs.access(cachedPath)
        return spawn(cachedPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        // Not in cache
      }

      const bin = installer.which('tailwindcss-language-server')
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
export function getServersForExtension(ext: string): ServerDefinition[] {
  return Object.values(SERVERS).filter((server) => server.extensions.includes(ext.toLowerCase()))
}

/**
 * Get a server by ID
 */
export function getServer(id: string): ServerDefinition | null {
  return SERVERS[id] || null
}

/**
 * Get all server definitions
 */
export function getAllServers(): Record<string, ServerDefinition> {
  return { ...SERVERS }
}

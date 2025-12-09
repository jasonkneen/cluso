/**
 * Web API Adapter
 * Makes HTTP fetch calls to a backend API server
 * Used when running in web-only mode without Electron
 */

import type {
  APIAdapter,
  Result,
  GitStatus,
  DirectoryEntry,
  FileStat,
  FileTreeNode,
  SearchMatch,
  GlobMatch,
  OAuthStartResult,
  OAuthStatus,
  SearchOptions,
  TreeOptions,
  SaveImageResult,
} from './types'

/**
 * Create a web API adapter that fetches from a backend server
 * @param baseUrl - Base URL of the API server (e.g., 'http://localhost:3001')
 */
export function createWebAdapter(baseUrl: string): APIAdapter {
  const api = baseUrl.replace(/\/$/, '') // Remove trailing slash

  async function fetchJson<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${api}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  return {
    git: {
      async getCurrentBranch(): Promise<Result<string>> {
        try {
          const data = await fetchJson<Result<string>>('/api/git/current-branch')
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async getBranches(): Promise<Result<string[]>> {
        try {
          const data = await fetchJson<Result<string[]>>('/api/git/branches')
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async getStatus(): Promise<Result<GitStatus>> {
        try {
          const data = await fetchJson<Result<GitStatus>>('/api/git/status')
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async checkout(branch: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/git/checkout', {
            method: 'POST',
            body: JSON.stringify({ branch }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async checkoutFile(filePath: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/git/checkout-file', {
            method: 'POST',
            body: JSON.stringify({ filePath }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async createBranch(name: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/git/create-branch', {
            method: 'POST',
            body: JSON.stringify({ name }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async commit(message: string): Promise<Result<string>> {
        try {
          const data = await fetchJson<Result<string>>('/api/git/commit', {
            method: 'POST',
            body: JSON.stringify({ message }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async push(): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/git/push', {
            method: 'POST',
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async pull(): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/git/pull', {
            method: 'POST',
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async stash(message?: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/git/stash', {
            method: 'POST',
            body: JSON.stringify({ message }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async stashPop(): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/git/stash-pop', {
            method: 'POST',
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },
    },

    files: {
      async readFile(path: string): Promise<Result<string>> {
        try {
          const data = await fetchJson<Result<string>>('/api/files/read', {
            method: 'POST',
            body: JSON.stringify({ path }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async writeFile(path: string, content: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/files/write', {
            method: 'POST',
            body: JSON.stringify({ path, content }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async createFile(path: string, content?: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/files/create', {
            method: 'POST',
            body: JSON.stringify({ path, content }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async deleteFile(path: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/files/delete', {
            method: 'POST',
            body: JSON.stringify({ path }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async renameFile(oldPath: string, newPath: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/files/rename', {
            method: 'POST',
            body: JSON.stringify({ oldPath, newPath }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async copyFile(srcPath: string, destPath: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/files/copy', {
            method: 'POST',
            body: JSON.stringify({ srcPath, destPath }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async saveImage(
        base64DataUrl: string,
        destPath: string
      ): Promise<Result<SaveImageResult>> {
        try {
          const data = await fetchJson<Result<SaveImageResult>>(
            '/api/files/save-image',
            {
              method: 'POST',
              body: JSON.stringify({ base64DataUrl, destPath }),
            }
          )
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async exists(path: string): Promise<Result<boolean>> {
        try {
          const data = await fetchJson<Result<boolean>>('/api/files/exists', {
            method: 'POST',
            body: JSON.stringify({ path }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async stat(path: string): Promise<Result<FileStat>> {
        try {
          const data = await fetchJson<Result<FileStat>>('/api/files/stat', {
            method: 'POST',
            body: JSON.stringify({ path }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async listDirectory(path?: string): Promise<Result<DirectoryEntry[]>> {
        try {
          const data = await fetchJson<Result<DirectoryEntry[]>>(
            '/api/files/list-directory',
            {
              method: 'POST',
              body: JSON.stringify({ path }),
            }
          )
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async createDirectory(path: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/files/create-directory', {
            method: 'POST',
            body: JSON.stringify({ path }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async deleteDirectory(path: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/files/delete-directory', {
            method: 'POST',
            body: JSON.stringify({ path }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async getCwd(): Promise<Result<string>> {
        try {
          const data = await fetchJson<Result<string>>('/api/files/cwd')
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async searchInFiles(
        pattern: string,
        dirPath?: string,
        options?: SearchOptions
      ): Promise<Result<SearchMatch[]>> {
        try {
          const data = await fetchJson<Result<SearchMatch[]>>(
            '/api/files/search',
            {
              method: 'POST',
              body: JSON.stringify({ pattern, dirPath, options }),
            }
          )
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async glob(pattern: string, dirPath?: string): Promise<Result<GlobMatch[]>> {
        try {
          const data = await fetchJson<Result<GlobMatch[]>>('/api/files/glob', {
            method: 'POST',
            body: JSON.stringify({ pattern, dirPath }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async getTree(path?: string, options?: TreeOptions): Promise<Result<FileTreeNode[]>> {
        try {
          const data = await fetchJson<Result<FileTreeNode[]>>('/api/files/tree', {
            method: 'POST',
            body: JSON.stringify({ path, options }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async readMultiple(
        paths: string[]
      ): Promise<Result<Array<{ path: string; content: string; error?: string }>>> {
        try {
          const data = await fetchJson<
            Result<Array<{ path: string; content: string; error?: string }>>
          >('/api/files/read-multiple', {
            method: 'POST',
            body: JSON.stringify({ paths }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },
    },

    oauth: {
      async startLogin(mode: 'max' | 'console'): Promise<Result<OAuthStartResult>> {
        try {
          const data = await fetchJson<Result<OAuthStartResult>>(
            '/api/oauth/start-login',
            {
              method: 'POST',
              body: JSON.stringify({ mode }),
            }
          )
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async completeLogin(
        code: string,
        verifier: string,
        state: string
      ): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/oauth/complete-login', {
            method: 'POST',
            body: JSON.stringify({ code, verifier, state }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async getStatus(): Promise<Result<OAuthStatus>> {
        try {
          const data = await fetchJson<Result<OAuthStatus>>('/api/oauth/status')
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async logout(): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/oauth/logout', {
            method: 'POST',
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async getAccessToken(): Promise<Result<string>> {
        try {
          const data = await fetchJson<Result<string>>('/api/oauth/access-token')
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },
    },

    backup: {
      async create(): Promise<Result<string>> {
        try {
          const data = await fetchJson<Result<string>>('/api/backup/create', {
            method: 'POST',
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async list(): Promise<
        Result<Array<{ name: string; timestamp: number; size: number }>>
      > {
        try {
          const data = await fetchJson<
            Result<Array<{ name: string; timestamp: number; size: number }>>
          >('/api/backup/list')
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async restore(backupName: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/backup/restore', {
            method: 'POST',
            body: JSON.stringify({ backupName }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async delete(backupName: string): Promise<Result<void>> {
        try {
          const data = await fetchJson<Result<void>>('/api/backup/delete', {
            method: 'POST',
            body: JSON.stringify({ backupName }),
          })
          return data
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },
    },
  }
}

/**
 * Electron API Adapter
 * Thin wrapper around window.electronAPI for use in Electron runtime
 * Provides consistent Result<T> return types
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
 * Create an Electron API adapter
 * Wraps window.electronAPI and converts responses to Result<T> format
 */
export function createElectronAdapter(): APIAdapter {
  const api = window.electronAPI
  if (!api) {
    throw new Error('electronAPI is not available in this context')
  }

  return {
    git: {
      async getCurrentBranch(): Promise<Result<string>> {
        try {
          const result = await api.git.getCurrentBranch()
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async getBranches(): Promise<Result<string[]>> {
        try {
          const result = await api.git.getBranches()
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async getStatus(): Promise<Result<GitStatus>> {
        try {
          const result = await api.git.getStatus()
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async checkout(branch: string): Promise<Result<void>> {
        try {
          const result = await api.git.checkout(branch)
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async checkoutFile(filePath: string): Promise<Result<void>> {
        try {
          const result = await api.git.checkout(filePath)
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async createBranch(name: string): Promise<Result<void>> {
        try {
          const result = await api.git.createBranch(name)
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async commit(message: string): Promise<Result<string>> {
        try {
          const result = await api.git.commit(message)
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async push(): Promise<Result<void>> {
        try {
          const result = await api.git.push()
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async pull(): Promise<Result<void>> {
        try {
          const result = await api.git.pull()
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async stash(message?: string): Promise<Result<void>> {
        try {
          const result = message
            ? await api.git.stashWithMessage(message)
            : await api.git.stash()
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async stashPop(): Promise<Result<void>> {
        try {
          const result = await api.git.stashPop()
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
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
          const result = await api.files.readFile(path)
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async writeFile(path: string, content: string): Promise<Result<void>> {
        try {
          const result = await api.files.writeFile(path, content)
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async createFile(path: string, content?: string): Promise<Result<void>> {
        try {
          const result = await api.files.createFile(path, content)
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async deleteFile(path: string): Promise<Result<void>> {
        try {
          const result = await api.files.deleteFile(path)
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async renameFile(oldPath: string, newPath: string): Promise<Result<void>> {
        try {
          const result = await api.files.renameFile(oldPath, newPath)
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async copyFile(srcPath: string, destPath: string): Promise<Result<void>> {
        try {
          const result = await api.files.copyFile(srcPath, destPath)
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
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
          const result = await api.files.saveImage(base64DataUrl, destPath)
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async exists(path: string): Promise<Result<boolean>> {
        try {
          const result = await api.files.exists(path)
          return result.success
            ? { success: true, data: result.exists }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async stat(path: string): Promise<Result<FileStat>> {
        try {
          const result = await api.files.stat(path)
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async listDirectory(path?: string): Promise<Result<DirectoryEntry[]>> {
        try {
          const result = await api.files.listDirectory(path)
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async createDirectory(path: string): Promise<Result<void>> {
        try {
          const result = await api.files.createDirectory(path)
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async deleteDirectory(path: string): Promise<Result<void>> {
        try {
          const result = await api.files.deleteDirectory(path)
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async getCwd(): Promise<Result<string>> {
        try {
          const result = await api.files.getCwd()
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
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
          const result = await api.files.searchInFiles(pattern, dirPath, options)
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async glob(pattern: string, dirPath?: string): Promise<Result<GlobMatch[]>> {
        try {
          const result = await api.files.glob(pattern, dirPath)
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async getTree(path?: string, options?: TreeOptions): Promise<Result<FileTreeNode[]>> {
        try {
          const result = await api.files.getTree(path, options)
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
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
          const result = await api.files.readMultiple(paths)
          return result.success
            ? { success: true, data: result.data }
            : { success: false, error: result.error || 'Unknown error' }
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
          const result = await api.oauth.startLogin(mode)
          if (result.success && result.authUrl) {
            return {
              success: true,
              data: {
                authUrl: result.authUrl,
                verifier: '', // Will be stored internally by electron layer
                state: '', // Will be stored internally by electron layer
              },
            }
          }
          return { success: false, error: result.error || 'Unknown error' }
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
          const result = await api.oauth.completeLogin(code)
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async getStatus(): Promise<Result<OAuthStatus>> {
        try {
          const result = await api.oauth.getStatus()
          return result.authenticated !== undefined
            ? {
                success: true,
                data: {
                  authenticated: result.authenticated,
                  expiresAt: result.expiresAt,
                },
              }
            : { success: false, error: 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async logout(): Promise<Result<void>> {
        try {
          const result = await api.oauth.logout()
          return result.success
            ? { success: true, data: undefined }
            : { success: false, error: result.error || 'Unknown error' }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      async getAccessToken(): Promise<Result<string>> {
        try {
          const result = await api.oauth.getAccessToken()
          return result.success && result.accessToken
            ? { success: true, data: result.accessToken }
            : { success: false, error: result.error || 'Unknown error' }
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
        return {
          success: false,
          error: 'Backup not implemented in Electron adapter yet',
        }
      },

      async list(): Promise<
        Result<Array<{ name: string; timestamp: number; size: number }>>
      > {
        return {
          success: false,
          error: 'Backup not implemented in Electron adapter yet',
        }
      },

      async restore(backupName: string): Promise<Result<void>> {
        return {
          success: false,
          error: 'Backup not implemented in Electron adapter yet',
        }
      },

      async delete(backupName: string): Promise<Result<void>> {
        return {
          success: false,
          error: 'Backup not implemented in Electron adapter yet',
        }
      },
    },
  }
}

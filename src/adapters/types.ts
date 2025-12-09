/**
 * API Adapter Types
 * Defines the unified interface for API operations across Electron and Web environments
 * Components use this interface without needing to know which runtime they're in
 */

/**
 * Standard result type for all async operations
 * Provides consistent error handling across adapters
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Git status information
 */
export interface GitStatus {
  files: Array<{ status: string; file: string }>
  hasChanges: boolean
}

/**
 * File information for directory listings
 */
export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
}

/**
 * File metadata
 */
export interface FileStat {
  size: number
  isFile: boolean
  isDirectory: boolean
  created: string
  modified: string
}

/**
 * File tree node for hierarchical directory browsing
 */
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

/**
 * Search result in files
 */
export interface SearchMatch {
  file: string
  line: number
  content: string
}

/**
 * Glob pattern match result
 */
export interface GlobMatch {
  path: string
  relativePath: string
  isDirectory: boolean
}

/**
 * OAuth flow start result with authorization URL
 */
export interface OAuthStartResult {
  authUrl: string
  verifier: string
  state: string
}

/**
 * OAuth authentication status
 */
export interface OAuthStatus {
  authenticated: boolean
  expiresAt: number | null
}

/**
 * File system search options
 */
export interface SearchOptions {
  filePattern?: string
  maxResults?: number
  caseSensitive?: boolean
}

/**
 * File tree browsing options
 */
export interface TreeOptions {
  maxDepth?: number
  includeHidden?: boolean
}

/**
 * Result from saving a base64-encoded image
 */
export interface SaveImageResult {
  path: string
  size: number
  mimeType: string
}

/**
 * Unified API Adapter Interface
 * Components import and use this interface, adapters implement it
 * Provides abstraction between React components and runtime-specific APIs
 */
export interface APIAdapter {
  /**
   * Git operations (only available in Electron mode)
   */
  git: {
    /**
     * Get the currently checked out branch
     */
    getCurrentBranch(): Promise<Result<string>>

    /**
     * Get list of all branches in the repository
     */
    getBranches(): Promise<Result<string[]>>

    /**
     * Get current git status (changed files, staged changes, etc.)
     */
    getStatus(): Promise<Result<GitStatus>>

    /**
     * Checkout a specific branch
     */
    checkout(branch: string): Promise<Result<void>>

    /**
     * Discard changes to a specific file (checkout from HEAD)
     */
    checkoutFile(filePath: string): Promise<Result<void>>

    /**
     * Create a new branch
     */
    createBranch(name: string): Promise<Result<void>>

    /**
     * Create a commit with the given message
     */
    commit(message: string): Promise<Result<string>>

    /**
     * Push commits to remote
     */
    push(): Promise<Result<void>>

    /**
     * Pull commits from remote
     */
    pull(): Promise<Result<void>>

    /**
     * Stash current changes with optional message
     */
    stash(message?: string): Promise<Result<void>>

    /**
     * Apply and remove the most recent stash
     */
    stashPop(): Promise<Result<void>>
  }

  /**
   * File operations
   */
  files: {
    /**
     * Read file contents as string
     */
    readFile(path: string): Promise<Result<string>>

    /**
     * Write or overwrite file contents
     */
    writeFile(path: string, content: string): Promise<Result<void>>

    /**
     * Create a new file (fails if it already exists)
     */
    createFile(path: string, content?: string): Promise<Result<void>>

    /**
     * Delete a file
     */
    deleteFile(path: string): Promise<Result<void>>

    /**
     * Rename a file
     */
    renameFile(oldPath: string, newPath: string): Promise<Result<void>>

    /**
     * Copy a file
     */
    copyFile(srcPath: string, destPath: string): Promise<Result<void>>

    /**
     * Save a base64-encoded image to disk
     */
    saveImage(base64DataUrl: string, destPath: string): Promise<Result<SaveImageResult>>

    /**
     * Check if a file or directory exists
     */
    exists(path: string): Promise<Result<boolean>>

    /**
     * Get file/directory metadata
     */
    stat(path: string): Promise<Result<FileStat>>

    /**
     * List contents of a directory
     */
    listDirectory(path?: string): Promise<Result<DirectoryEntry[]>>

    /**
     * Create a directory
     */
    createDirectory(path: string): Promise<Result<void>>

    /**
     * Delete a directory (recursively)
     */
    deleteDirectory(path: string): Promise<Result<void>>

    /**
     * Get current working directory
     */
    getCwd(): Promise<Result<string>>

    /**
     * Search for text pattern in files
     */
    searchInFiles(
      pattern: string,
      dirPath?: string,
      options?: SearchOptions
    ): Promise<Result<SearchMatch[]>>

    /**
     * Find files matching glob pattern
     */
    glob(pattern: string, dirPath?: string): Promise<Result<GlobMatch[]>>

    /**
     * Get file tree structure
     */
    getTree(path?: string, options?: TreeOptions): Promise<Result<FileTreeNode[]>>

    /**
     * Read multiple files efficiently
     */
    readMultiple(paths: string[]): Promise<
      Result<Array<{ path: string; content: string; error?: string }>>
    >
  }

  /**
   * OAuth operations
   */
  oauth: {
    /**
     * Start OAuth login flow
     * Returns authUrl to open in browser, plus verifier and state for completion
     */
    startLogin(mode: 'max' | 'console'): Promise<Result<OAuthStartResult>>

    /**
     * Complete OAuth flow after user authorization
     * @param code - Authorization code from OAuth callback
     * @param verifier - PKCE verifier from startLogin
     * @param state - State value from startLogin (CSRF protection)
     */
    completeLogin(
      code: string,
      verifier: string,
      state: string
    ): Promise<Result<void>>

    /**
     * Get OAuth authentication status
     */
    getStatus(): Promise<Result<OAuthStatus>>

    /**
     * Clear OAuth tokens and log out
     */
    logout(): Promise<Result<void>>

    /**
     * Get valid access token (handles refresh if needed)
     */
    getAccessToken(): Promise<Result<string>>
  }

  /**
   * Backup operations
   */
  backup: {
    /**
     * Create a backup of the project
     */
    create(): Promise<Result<string>>

    /**
     * List available backups
     */
    list(): Promise<Result<Array<{ name: string; timestamp: number; size: number }>>>

    /**
     * Restore from a backup
     */
    restore(backupName: string): Promise<Result<void>>

    /**
     * Delete a backup
     */
    delete(backupName: string): Promise<Result<void>>
  }
}

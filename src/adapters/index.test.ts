/**
 * API Adapter Tests
 * Shows how to test components that use the adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getAdapter, setAdapter, resetAdapter, isElectronMode } from './index'
import type { APIAdapter, Result } from './types'

/**
 * Mock adapter for testing
 */
function createMockAdapter(): APIAdapter {
  return {
    git: {
      getCurrentBranch: vi.fn(async () => ({
        success: true,
        data: 'main',
      })),
      getBranches: vi.fn(async () => ({
        success: true,
        data: ['main', 'develop'],
      })),
      getStatus: vi.fn(async () => ({
        success: true,
        data: {
          files: [],
          hasChanges: false,
        },
      })),
      checkout: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      checkoutFile: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      createBranch: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      commit: vi.fn(async () => ({
        success: true,
        data: 'abc123',
      })),
      push: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      pull: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      stash: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      stashPop: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
    },
    files: {
      readFile: vi.fn(async () => ({
        success: true,
        data: 'file content',
      })),
      writeFile: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      createFile: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      deleteFile: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      renameFile: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      copyFile: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      saveImage: vi.fn(async () => ({
        success: true,
        data: { path: '/path', size: 123, mimeType: 'image/png' },
      })),
      exists: vi.fn(async () => ({
        success: true,
        data: true,
      })),
      stat: vi.fn(async () => ({
        success: true,
        data: {
          size: 1024,
          isFile: true,
          isDirectory: false,
          created: '2024-01-01',
          modified: '2024-01-01',
        },
      })),
      listDirectory: vi.fn(async () => ({
        success: true,
        data: [
          { name: 'file.txt', path: '/path/file.txt', isDirectory: false },
        ],
      })),
      createDirectory: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      deleteDirectory: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      getCwd: vi.fn(async () => ({
        success: true,
        data: '/current/dir',
      })),
      searchInFiles: vi.fn(async () => ({
        success: true,
        data: [
          { file: 'file.txt', line: 10, content: 'search result' },
        ],
      })),
      glob: vi.fn(async () => ({
        success: true,
        data: [{ path: '/path/file.txt', relativePath: 'file.txt', isDirectory: false }],
      })),
      getTree: vi.fn(async () => ({
        success: true,
        data: [
          {
            name: 'dir',
            path: '/path/dir',
            type: 'directory',
            children: [
              { name: 'file.txt', path: '/path/dir/file.txt', type: 'file' },
            ],
          },
        ],
      })),
      readMultiple: vi.fn(async () => ({
        success: true,
        data: [
          { path: '/path/file.txt', content: 'content' },
        ],
      })),
    },
    oauth: {
      startLogin: vi.fn(async () => ({
        success: true,
        data: {
          authUrl: 'https://auth.example.com',
          verifier: 'verifier123',
          state: 'state123',
        },
      })),
      completeLogin: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      getStatus: vi.fn(async () => ({
        success: true,
        data: {
          authenticated: true,
          expiresAt: Date.now() + 3600000,
        },
      })),
      logout: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      getAccessToken: vi.fn(async () => ({
        success: true,
        data: 'token123',
      })),
    },
    backup: {
      create: vi.fn(async () => ({
        success: true,
        data: 'backup-2024-01-01-123456',
      })),
      list: vi.fn(async () => ({
        success: true,
        data: [
          { name: 'backup-1', timestamp: 1704067200000, size: 1024 },
        ],
      })),
      restore: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
      delete: vi.fn(async () => ({
        success: true,
        data: undefined,
      })),
    },
  }
}

describe('API Adapter', () => {
  beforeEach(() => {
    resetAdapter()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getAdapter', () => {
    it('should return cached adapter on subsequent calls', () => {
      const adapter1 = getAdapter()
      const adapter2 = getAdapter()
      expect(adapter1).toBe(adapter2)
    })
  })

  describe('setAdapter', () => {
    it('should allow setting a custom adapter', async () => {
      const mockAdapter = createMockAdapter()
      setAdapter(mockAdapter)

      const adapter = getAdapter()
      expect(adapter).toBe(mockAdapter)
    })

    it('should use the mock adapter for operations', async () => {
      const mockAdapter = createMockAdapter()
      setAdapter(mockAdapter)

      const adapter = getAdapter()
      const result = await adapter.files.readFile('/path/to/file')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('file content')
      }
    })
  })

  describe('resetAdapter', () => {
    it('should clear the cached adapter', () => {
      const adapter1 = getAdapter()
      resetAdapter()
      const adapter2 = getAdapter()

      // After reset, getAdapter should return a new instance
      // (though they might be the same adapter type if both use web)
      expect(adapter1).not.toBe(adapter2)
    })
  })

  describe('Mock Adapter - Git Operations', () => {
    beforeEach(() => {
      const mockAdapter = createMockAdapter()
      setAdapter(mockAdapter)
    })

    it('should get current branch', async () => {
      const adapter = getAdapter()
      const result = await adapter.git.getCurrentBranch()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('main')
      }
    })

    it('should get branches list', async () => {
      const adapter = getAdapter()
      const result = await adapter.git.getBranches()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toContain('main')
        expect(result.data).toContain('develop')
      }
    })

    it('should handle checkout', async () => {
      const adapter = getAdapter()
      const result = await adapter.git.checkout('develop')

      expect(result.success).toBe(true)
    })

    it('should handle commit', async () => {
      const adapter = getAdapter()
      const result = await adapter.git.commit('My commit message')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('abc123')
      }
    })
  })

  describe('Mock Adapter - File Operations', () => {
    beforeEach(() => {
      const mockAdapter = createMockAdapter()
      setAdapter(mockAdapter)
    })

    it('should read file', async () => {
      const adapter = getAdapter()
      const result = await adapter.files.readFile('/path/to/file')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('file content')
      }
    })

    it('should write file', async () => {
      const adapter = getAdapter()
      const result = await adapter.files.writeFile('/path/to/file', 'new content')

      expect(result.success).toBe(true)
    })

    it('should list directory', async () => {
      const adapter = getAdapter()
      const result = await adapter.files.listDirectory('/path')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0)
        expect(result.data[0].name).toBe('file.txt')
      }
    })

    it('should check if file exists', async () => {
      const adapter = getAdapter()
      const result = await adapter.files.exists('/path/to/file')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(true)
      }
    })
  })

  describe('Mock Adapter - OAuth Operations', () => {
    beforeEach(() => {
      const mockAdapter = createMockAdapter()
      setAdapter(mockAdapter)
    })

    it('should start login', async () => {
      const adapter = getAdapter()
      const result = await adapter.oauth.startLogin('console')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.authUrl).toContain('auth.example.com')
      }
    })

    it('should get oauth status', async () => {
      const adapter = getAdapter()
      const result = await adapter.oauth.getStatus()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.authenticated).toBe(true)
      }
    })

    it('should logout', async () => {
      const adapter = getAdapter()
      const result = await adapter.oauth.logout()

      expect(result.success).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle failed operations', async () => {
      const mockAdapter = createMockAdapter()
      // Make one operation fail
      mockAdapter.files.readFile = vi.fn(async () => ({
        success: false,
        error: 'File not found',
      }))
      setAdapter(mockAdapter)

      const adapter = getAdapter()
      const result = await adapter.files.readFile('/nonexistent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('File not found')
      }
    })
  })

  describe('Result Type Discrimination', () => {
    it('should properly discriminate between success and failure', async () => {
      const mockAdapter = createMockAdapter()
      setAdapter(mockAdapter)

      const adapter = getAdapter()
      const result = await adapter.files.readFile('/path')

      // TypeScript should narrow the type correctly
      if (result.success) {
        const content: string = result.data // Should be valid
        expect(content).toBe('file content')
      } else {
        const error: string = result.error // Should be valid
        expect(error).toBeDefined()
      }
    })
  })
})

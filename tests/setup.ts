import '@testing-library/jest-dom/vitest'
import { vi, beforeEach } from 'vitest'

// Mock crypto for Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {
    randomUUID: () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
  } as unknown as Crypto
}

// Mock fetch for tests (default to a successful JSON response)
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue({ success: true, data: {} }),
} as any)

// Mock window.electronAPI for frontend tests
const mockElectronAPI = {
  aiSdk: {
    initialize: vi.fn().mockResolvedValue({ success: true }),
    stream: vi.fn().mockResolvedValue({ success: true, requestId: 'test-request-id' }),
    generate: vi.fn().mockResolvedValue({ success: true, text: 'Test response' }),
    executeMCPTool: vi.fn().mockResolvedValue({ success: true, content: [{ type: 'text', text: 'Tool result' }] }),
    getModels: vi.fn().mockResolvedValue({ models: ['gpt-4o', 'claude-3-5-sonnet'], providers: ['openai', 'anthropic'] }),
    getProvider: vi.fn().mockResolvedValue({ provider: 'openai' }),
    onTextChunk: vi.fn().mockReturnValue(() => {}),
    onStepFinish: vi.fn().mockReturnValue(() => {}),
    onComplete: vi.fn().mockReturnValue(() => {}),
    onError: vi.fn().mockReturnValue(() => {}),
    removeAllListeners: vi.fn(),
  },
  oauth: {
    getAccessToken: vi.fn().mockResolvedValue({ success: true, accessToken: 'mock-access-token' }),
    getStatus: vi.fn().mockResolvedValue({ authenticated: true }),
  },
  codex: {
    getAccessToken: vi.fn().mockResolvedValue({ success: true, accessToken: 'mock-codex-token' }),
    getStatus: vi.fn().mockResolvedValue({ authenticated: true }),
  },
  mcp: {
    callTool: vi.fn().mockResolvedValue({ success: true, content: [{ type: 'text', text: 'MCP result' }] }),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
    getStatus: vi.fn().mockResolvedValue({}),
  },
  selectorAgent: {
    init: vi.fn().mockResolvedValue({ success: true }),
    prime: vi.fn().mockResolvedValue({ success: true }),
    select: vi.fn().mockResolvedValue({ success: true }),
    send: vi.fn().mockResolvedValue({ success: true }),
    isActive: vi.fn().mockResolvedValue({ active: false }),
    getContextState: vi.fn().mockResolvedValue({ isPrimed: false, pageUrl: null, pageTitle: null, lastPrimedAt: null }),
    reset: vi.fn().mockResolvedValue({ success: true }),
    interrupt: vi.fn().mockResolvedValue({ success: true }),
    onTextChunk: vi.fn().mockReturnValue(() => {}),
    onSelectionResult: vi.fn().mockReturnValue(() => {}),
    onReady: vi.fn().mockReturnValue(() => {}),
    onError: vi.fn().mockReturnValue(() => {}),
  },
  isElectron: true,
}

// Set up window with electronAPI - we need to be careful about jsdom
if (typeof window !== 'undefined') {
  // @ts-expect-error - Adding electronAPI to window
  window.electronAPI = mockElectronAPI
} else {
  // For non-jsdom environments
  Object.defineProperty(globalThis, 'window', {
    value: {
      electronAPI: mockElectronAPI,
    },
    writable: true,
  })
}

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  // Restore default mock implementations
  mockElectronAPI.aiSdk.initialize.mockResolvedValue({ success: true })
  mockElectronAPI.aiSdk.stream.mockResolvedValue({ success: true, requestId: 'test-request-id' })
  mockElectronAPI.aiSdk.generate.mockResolvedValue({ success: true, text: 'Test response' })
})

export { mockElectronAPI }

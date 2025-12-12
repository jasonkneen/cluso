/**
 * Real tests for useAIChatV2 hook and its utility functions
 *
 * These tests import the actual hook and utility functions and test them directly.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { mockElectronAPI } from './setup'

// Import the REAL exports from the hook
import {
  getProviderForModel,
  toCoreMessages,
  mergeTools,
  mcpToolsToAISDKFormat,
  useAIChatV2,
  type ChatMessage,
  type ToolsMap,
  type MCPToolDefinition,
  type CoreMessage,
  type ProviderType,
  type ToolCallPart,
  type ToolResultPart,
  type ProviderConfig,
} from '../hooks/useAIChatV2'

// ============================================================================
// getProviderForModel Tests - Testing the REAL function
// ============================================================================

describe('getProviderForModel (real function from useAIChatV2)', () => {
  describe('Google models', () => {
    const googleModels = [
      'gemini-3-pro-preview',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]

    googleModels.forEach(model => {
      it(`should return 'google' for ${model}`, () => {
        expect(getProviderForModel(model)).toBe('google')
      })
    })
  })

  describe('OpenAI models', () => {
    const openaiModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1',
      'o1-mini',
      'o1-preview',
      'o3',
      'o3-mini',
    ]

    openaiModels.forEach(model => {
      it(`should return 'openai' for ${model}`, () => {
        expect(getProviderForModel(model)).toBe('openai')
      })
    })
  })

  describe('Anthropic models', () => {
    const anthropicModels = [
      'claude-3-5-sonnet',
      'claude-3-5-sonnet-20241022',
      'claude-4-sonnet',
      'claude-4-sonnet-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-opus',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ]

    anthropicModels.forEach(model => {
      it(`should return 'anthropic' for ${model}`, () => {
        expect(getProviderForModel(model)).toBe('anthropic')
      })
    })
  })

  describe('Claude Code models', () => {
    const claudeCodeModels = [
      'claude-code',
      'claude-sonnet-4-5',
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-5',
      'claude-opus-4-5-20251101',
      'claude-haiku-4-5',
      'claude-haiku-4-5-20251001',
    ]

    claudeCodeModels.forEach(model => {
      it(`should return 'claude-code' for ${model}`, () => {
        expect(getProviderForModel(model)).toBe('claude-code')
      })
    })
  })

  describe('Codex models', () => {
    const codexModels = [
      'codex',
      'codex-gpt-4o',
      'codex-o1',
      'codex-o1-pro',
      'gpt-5.1-codex',
      'gpt-5.1-codex-mini',
      'gpt-5.1-nano',
      'gpt-5-codex',
      'gpt-5-codex-mini',
    ]

    codexModels.forEach(model => {
      it(`should return 'codex' for ${model}`, () => {
        expect(getProviderForModel(model)).toBe('codex')
      })
    })
  })

  describe('Unknown models', () => {
    it('should return null for unknown model', () => {
      expect(getProviderForModel('unknown-model')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(getProviderForModel('')).toBeNull()
    })

    it('should return null for llama-3', () => {
      expect(getProviderForModel('llama-3-70b')).toBeNull()
    })
  })
})

// ============================================================================
// toCoreMessages Tests - Testing the REAL function
// ============================================================================

describe('toCoreMessages (real function)', () => {
  it('should convert ChatMessage array to CoreMessage array', () => {
    const chatMessages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
      { id: '2', role: 'assistant', content: 'Hi there!', timestamp: new Date() },
    ]

    const coreMessages = toCoreMessages(chatMessages)

    expect(coreMessages).toHaveLength(2)
    expect(coreMessages[0]).toEqual({ role: 'user', content: 'Hello' })
    expect(coreMessages[1]).toEqual({ role: 'assistant', content: 'Hi there!' })
  })

  it('should handle system messages', () => {
    const chatMessages: ChatMessage[] = [
      { id: '1', role: 'system', content: 'You are helpful', timestamp: new Date() },
      { id: '2', role: 'user', content: 'Question', timestamp: new Date() },
    ]

    const coreMessages = toCoreMessages(chatMessages)

    expect(coreMessages[0]).toEqual({ role: 'system', content: 'You are helpful' })
    expect(coreMessages[1]).toEqual({ role: 'user', content: 'Question' })
  })

  it('should handle empty array', () => {
    expect(toCoreMessages([])).toEqual([])
  })

  it('should strip extra fields (id, timestamp, model)', () => {
    const chatMessages: ChatMessage[] = [
      { id: 'msg-123', role: 'user', content: 'Test', timestamp: new Date(), model: 'gpt-4o' },
    ]

    const coreMessages = toCoreMessages(chatMessages)

    expect(coreMessages[0]).toEqual({ role: 'user', content: 'Test' })
    expect((coreMessages[0] as Record<string, unknown>).id).toBeUndefined()
    expect((coreMessages[0] as Record<string, unknown>).timestamp).toBeUndefined()
    expect((coreMessages[0] as Record<string, unknown>).model).toBeUndefined()
  })

  it('should preserve complex content exactly', () => {
    const complexContent = 'Line 1\nLine 2\n\n```python\nprint("hello")\n```'
    const chatMessages: ChatMessage[] = [
      { id: '1', role: 'user', content: complexContent, timestamp: new Date() },
    ]

    const coreMessages = toCoreMessages(chatMessages)
    expect(coreMessages[0].content).toBe(complexContent)
  })

  it('should handle multi-turn conversation', () => {
    const chatMessages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'What is 2+2?', timestamp: new Date() },
      { id: '2', role: 'assistant', content: '2+2 equals 4.', timestamp: new Date() },
      { id: '3', role: 'user', content: 'And 4+4?', timestamp: new Date() },
      { id: '4', role: 'assistant', content: '4+4 equals 8.', timestamp: new Date() },
    ]

    const coreMessages = toCoreMessages(chatMessages)

    expect(coreMessages).toHaveLength(4)
    expect(coreMessages[0].role).toBe('user')
    expect(coreMessages[1].role).toBe('assistant')
    expect(coreMessages[2].role).toBe('user')
    expect(coreMessages[3].role).toBe('assistant')
  })
})

// ============================================================================
// mergeTools Tests - Testing the REAL function
// ============================================================================

describe('mergeTools (real function)', () => {
  it('should merge two tool maps', () => {
    const tools1: ToolsMap = {
      tool1: { description: 'Tool 1', parameters: { type: 'object', properties: {} } },
    }
    const tools2: ToolsMap = {
      tool2: { description: 'Tool 2', parameters: { type: 'object', properties: {} } },
    }

    const merged = mergeTools(tools1, tools2)

    expect(merged).toHaveProperty('tool1')
    expect(merged).toHaveProperty('tool2')
    expect(merged.tool1.description).toBe('Tool 1')
    expect(merged.tool2.description).toBe('Tool 2')
  })

  it('should override earlier tools with later ones', () => {
    const tools1: ToolsMap = {
      tool: { description: 'Original', parameters: { type: 'object' } },
    }
    const tools2: ToolsMap = {
      tool: { description: 'Override', parameters: { type: 'string' } },
    }

    const merged = mergeTools(tools1, tools2)

    expect(merged.tool.description).toBe('Override')
    expect(merged.tool.parameters).toEqual({ type: 'string' })
  })

  it('should handle empty tool maps', () => {
    const merged = mergeTools({}, {})
    expect(Object.keys(merged)).toHaveLength(0)
  })

  it('should handle single tool map', () => {
    const tools: ToolsMap = {
      single: { description: 'Single', parameters: {} },
    }

    const merged = mergeTools(tools)
    expect(merged).toEqual(tools)
  })

  it('should merge many tool maps', () => {
    const maps: ToolsMap[] = [
      { tool0: { description: 'Tool 0', parameters: {} } },
      { tool1: { description: 'Tool 1', parameters: {} } },
      { tool2: { description: 'Tool 2', parameters: {} } },
      { tool3: { description: 'Tool 3', parameters: {} } },
      { tool4: { description: 'Tool 4', parameters: {} } },
    ]

    const merged = mergeTools(...maps)
    expect(Object.keys(merged)).toHaveLength(5)
    expect(merged.tool0.description).toBe('Tool 0')
    expect(merged.tool4.description).toBe('Tool 4')
  })

  it('should handle no arguments', () => {
    const merged = mergeTools()
    expect(merged).toEqual({})
  })

  it('should preserve tool parameters structure', () => {
    const tools: ToolsMap = {
      complexTool: {
        description: 'Complex tool',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name' },
            count: { type: 'number', description: 'Count' },
          },
          required: ['name'],
        },
      },
    }

    const merged = mergeTools(tools)
    expect(merged.complexTool.parameters).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name' },
        count: { type: 'number', description: 'Count' },
      },
      required: ['name'],
    })
  })
})

// ============================================================================
// mcpToolsToAISDKFormat Tests - Testing the REAL function
// ============================================================================

describe('mcpToolsToAISDKFormat (real function)', () => {
  const mockCaller = vi.fn()

  it('should convert MCP tools to ToolsMap format', () => {
    const mcpTools = [
      {
        name: 'read_file',
        description: 'Read a file from disk',
        inputSchema: {
          type: 'object' as const,
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
        serverId: 'filesystem',
      },
    ]

    const converted = mcpToolsToAISDKFormat(mcpTools, mockCaller)

    expect(converted).toHaveProperty('mcp_filesystem_read_file')
    expect(converted.mcp_filesystem_read_file.description).toBe('Read a file from disk')
  })

  it('should generate unique names for tools from multiple servers', () => {
    const mcpTools = [
      { name: 'tool1', serverId: 'server1', inputSchema: { type: 'object' as const } },
      { name: 'tool2', serverId: 'server1', inputSchema: { type: 'object' as const } },
      { name: 'tool1', serverId: 'server2', inputSchema: { type: 'object' as const } },
    ]

    const converted = mcpToolsToAISDKFormat(mcpTools, mockCaller)

    expect(Object.keys(converted)).toHaveLength(3)
    expect(converted).toHaveProperty('mcp_server1_tool1')
    expect(converted).toHaveProperty('mcp_server1_tool2')
    expect(converted).toHaveProperty('mcp_server2_tool1')
  })

  it('should provide default description for tools without one', () => {
    const mcpTools = [
      { name: 'unnamed_tool', serverId: 'test', inputSchema: { type: 'object' as const } },
    ]

    const converted = mcpToolsToAISDKFormat(mcpTools, mockCaller)

    expect(converted.mcp_test_unnamed_tool.description).toBe('MCP tool: unnamed_tool')
  })

  it('should preserve inputSchema as parameters', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path' },
        encoding: { type: 'string', description: 'File encoding' },
      },
      required: ['path'],
    }

    const mcpTools = [
      { name: 'read', serverId: 'fs', inputSchema: schema },
    ]

    const converted = mcpToolsToAISDKFormat(mcpTools, mockCaller)

    expect(converted.mcp_fs_read.parameters).toEqual(schema)
  })

  it('should handle tools with no inputSchema', () => {
    const mcpTools = [
      { name: 'no_params', serverId: 'test', inputSchema: undefined as unknown as { type: 'object' } },
    ]

    const converted = mcpToolsToAISDKFormat(mcpTools, mockCaller)

    expect(converted.mcp_test_no_params.parameters).toEqual({ type: 'object', properties: {} })
  })

  it('should handle empty MCP tools array', () => {
    const converted = mcpToolsToAISDKFormat([], mockCaller)
    expect(converted).toEqual({})
  })
})

// ============================================================================
// useAIChatV2 Hook Tests - Testing the REAL hook
// ============================================================================

describe('useAIChatV2 hook (real hook)', () => {
  beforeEach(() => {
    // Ensure tests default to Electron mode unless explicitly overridden.
    window.electronAPI = mockElectronAPI as any
  })

  // Helper to wait for initialization
  const waitForInit = async (result: { current: { isInitialized: boolean } }) => {
    await new Promise(resolve => setTimeout(resolve, 10))
    // Force a re-render check
    return result.current.isInitialized
  }

  it('should return correct initial state', () => {
    const { result } = renderHook(() => useAIChatV2())

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.stream).toBe('function')
    expect(typeof result.current.generate).toBe('function')
  })

  it('should call initialize on mount', () => {
    renderHook(() => useAIChatV2())

    // The initialize should be called
    expect(mockElectronAPI.aiSdk.initialize).toHaveBeenCalled()
  })

  describe('generate method', () => {
    it('should call electronAPI.aiSdk.generate with correct parameters', async () => {
      const { result } = renderHook(() => useAIChatV2())

      await act(async () => {
        await result.current.generate({
          modelId: 'claude-3-5-sonnet',
          messages: [{ role: 'user', content: 'Hello' }],
          providers: [{ id: 'anthropic', apiKey: 'test-key' }],
        })
      })

      expect(mockElectronAPI.aiSdk.generate).toHaveBeenCalled()
      const generateCall = mockElectronAPI.aiSdk.generate.mock.calls[0][0]
      expect(generateCall.modelId).toBe('claude-3-5-sonnet')
      expect(generateCall.providers).toEqual({ anthropic: 'test-key' })
    })

    it('should return text from successful generation', async () => {
      mockElectronAPI.aiSdk.generate.mockResolvedValue({
        success: true,
        text: 'Generated response',
      })

      const { result } = renderHook(() => useAIChatV2())

      let response: { text: string | null } | undefined
      await act(async () => {
        response = await result.current.generate({
          modelId: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
          providers: [{ id: 'openai', apiKey: 'test-key' }],
        })
      })

      expect(response?.text).toBe('Generated response')
    })

    it('should handle errors from generation', async () => {
      mockElectronAPI.aiSdk.generate.mockResolvedValue({
        success: false,
        error: 'API error',
      })

      const onError = vi.fn()
      const { result } = renderHook(() => useAIChatV2({ onError }))

      let response: { text: string | null } | undefined
      await act(async () => {
        response = await result.current.generate({
          modelId: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
          providers: [{ id: 'openai', apiKey: 'test-key' }],
        })
      })

      expect(response?.text).toBeNull()
      expect(onError).toHaveBeenCalled()
      expect(result.current.error).toBeInstanceOf(Error)
    })
  })

  describe('callbacks', () => {
    it('should call onResponse callback with generated text', async () => {
      mockElectronAPI.aiSdk.generate.mockResolvedValue({
        success: true,
        text: 'Test response',
      })

      const onResponse = vi.fn()
      const { result } = renderHook(() => useAIChatV2({ onResponse }))

      await act(async () => {
        await result.current.generate({
          modelId: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
          providers: [{ id: 'openai', apiKey: 'test-key' }],
        })
      })

      expect(onResponse).toHaveBeenCalledWith('Test response')
    })

    it('should call onFinish callback after generation', async () => {
      mockElectronAPI.aiSdk.generate.mockResolvedValue({
        success: true,
        text: 'Done',
      })

      const onFinish = vi.fn()
      const { result } = renderHook(() => useAIChatV2({ onFinish }))

      await act(async () => {
        await result.current.generate({
          modelId: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
          providers: [{ id: 'openai', apiKey: 'test-key' }],
        })
      })

      expect(onFinish).toHaveBeenCalled()
    })

    it('should call onToolCall callback for tool calls', async () => {
      mockElectronAPI.aiSdk.generate.mockResolvedValue({
        success: true,
        text: 'Using tool...',
        toolCalls: [
          { toolCallId: 'tc_1', toolName: 'getWeather', args: { city: 'London' } },
        ],
      })

      const onToolCall = vi.fn()
      const { result } = renderHook(() => useAIChatV2({ onToolCall }))

      await act(async () => {
        await result.current.generate({
          modelId: 'gpt-4o',
          messages: [{ role: 'user', content: 'Weather?' }],
          providers: [{ id: 'openai', apiKey: 'test-key' }],
        })
      })

      expect(onToolCall).toHaveBeenCalledWith({
        type: 'tool-call',
        toolCallId: 'tc_1',
        toolName: 'getWeather',
        args: { city: 'London' },
      })
    })
  })

  describe('error handling', () => {
    it('should return error when electronAPI is not available', async () => {
      // Force Electron mode (isElectron=true) but without the AI SDK API.
      // This should trigger the Electron-mode "AI SDK not available" error path.
      const original = window.electronAPI
      // @ts-expect-error - Removing electronAPI
      window.electronAPI = { isElectron: true } as any

      const onError = vi.fn()
      const { result } = renderHook(() => useAIChatV2({ onError }))

      let response: { text: string | null } | undefined
      await act(async () => {
        response = await result.current.generate({
          modelId: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
          providers: [{ id: 'openai', apiKey: 'test-key' }],
        })
      })

      expect(response?.text).toBeNull()
      expect(onError).toHaveBeenCalledWith(expect.any(Error))
      expect(onError.mock.calls[0][0].message).toContain('AI SDK not available')

      // Restore
      // @ts-expect-error - Restoring electronAPI
      window.electronAPI = original
    })
  })

  describe('tools serialization', () => {
    it('should strip execute functions from tools before sending', async () => {
      const { result } = renderHook(() => useAIChatV2())

      const tools: ToolsMap = {
        testTool: {
          description: 'Test tool',
          parameters: { type: 'object' },
          execute: async () => ({ result: 'done' }), // This should be stripped
        },
      }

      await act(async () => {
        await result.current.generate({
          modelId: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
          providers: [{ id: 'openai', apiKey: 'test-key' }],
          tools,
        })
      })

      const generateCall = mockElectronAPI.aiSdk.generate.mock.calls[0][0]
      expect(generateCall.tools.testTool.execute).toBeUndefined()
      expect(generateCall.tools.testTool.description).toBe('Test tool')
    })
  })

  describe('stream method', () => {
    it('should call electronAPI.aiSdk.stream', async () => {
      const { result } = renderHook(() => useAIChatV2())

      // Start a stream (don't await - it's a Promise that resolves on complete)
      act(() => {
        result.current.stream({
          modelId: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
          providers: [{ id: 'openai', apiKey: 'test-key' }],
        })
      })

      // Give it a tick to start
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(mockElectronAPI.aiSdk.stream).toHaveBeenCalled()
    })

    it('should set isLoading to true when streaming starts', async () => {
      const { result } = renderHook(() => useAIChatV2())

      act(() => {
        result.current.stream({
          modelId: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
          providers: [{ id: 'openai', apiKey: 'test-key' }],
        })
      })

      // Should be loading while streaming
      expect(result.current.isLoading).toBe(true)
    })
  })
})

// ============================================================================
// Type Safety Tests
// ============================================================================

describe('Type exports', () => {
  it('should export ProviderType with correct values', () => {
    const providers: ProviderType[] = ['google', 'openai', 'anthropic', 'claude-code', 'codex']
    expect(providers).toHaveLength(5)
  })

  it('should export ChatMessage interface correctly', () => {
    const message: ChatMessage = {
      id: 'test',
      role: 'user',
      content: 'Hello',
      timestamp: new Date(),
    }
    expect(message.role).toBe('user')
  })

  it('should export ToolCallPart interface correctly', () => {
    const toolCall: ToolCallPart = {
      type: 'tool-call',
      toolCallId: 'tc_1',
      toolName: 'test',
      args: {},
    }
    expect(toolCall.type).toBe('tool-call')
  })

  it('should export ToolResultPart interface correctly', () => {
    const toolResult: ToolResultPart = {
      type: 'tool-result',
      toolCallId: 'tc_1',
      toolName: 'test',
      result: { data: 'value' },
    }
    expect(toolResult.type).toBe('tool-result')
  })

  it('should export CoreMessage interface correctly', () => {
    const message: CoreMessage = {
      role: 'user',
      content: 'Hello',
    }
    expect(message.role).toBe('user')
  })

  it('should export MCPToolDefinition interface correctly', () => {
    const mcpTool: MCPToolDefinition = {
      name: 'test',
      description: 'Test tool',
      inputSchema: { type: 'object' },
      serverId: 'test-server',
    }
    expect(mcpTool.serverId).toBe('test-server')
  })

  it('should export ProviderConfig interface correctly', () => {
    const config: ProviderConfig = {
      id: 'openai',
      apiKey: 'sk-test',
    }
    expect(config.id).toBe('openai')
  })
})

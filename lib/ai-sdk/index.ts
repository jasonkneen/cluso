/**
 * Main AI SDK Wrapper Export
 * Provides the unified interface for all AI SDK operations
 */

import { CoreMessage, LanguageModel } from 'ai'
import type {
  AISDKWrapperConfig,
  ModelConfig,
  AITool,
  GenerationResponse,
  StreamEvent,
  StreamOptions,
  GenerateOptions,
  MCPServerConfig,
} from './types'
import {
  createLanguageModel,
  createModelMap,
  getModel,
  getProviderFeatures,
  validateModelConfig,
} from './provider-factory'
import {
  streamModelResponse,
  generateModelResponse,
  streamEventsToReadable,
  parseStreamingEvents,
  aggregateStreamingEvents,
  streamWithToolExecution,
} from './streaming'
import { ToolManager, mcpToolsToAISDKFormat, mergeToolSets } from './tool-manager'
import {
  createErrorHandlingMiddleware,
  createMiddlewareFromConfig,
  applyMiddleware,
} from './middleware'
import {
  retryWithBackoff,
  createFetchWithRetry,
  AISDKError,
  APIError,
  RateLimitError,
  AuthenticationError,
  ValidationError,
  TimeoutError,
  getErrorMessage,
  isRetryableError,
  withTimeout,
} from './error-handling'

/**
 * Main AI SDK Wrapper Class
 * Provides a unified interface for working with multiple AI providers
 */
export class AISDKWrapper {
  private models: Record<string, LanguageModel> = {}
  private toolManager: ToolManager
  private config: AISDKWrapperConfig
  private defaultModelId: string | null = null

  constructor(config: AISDKWrapperConfig) {
    this.config = config

    // Initialize models
    this.models = createModelMap(config.models)

    // Set default model
    if (config.defaultModel) {
      if (!this.models[config.defaultModel]) {
        throw new Error(`Default model "${config.defaultModel}" not found`)
      }
      this.defaultModelId = config.defaultModel
    } else {
      // Use first model as default
      const modelIds = Object.keys(this.models)
      if (modelIds.length > 0) {
        this.defaultModelId = modelIds[0]
      }
    }

    // Initialize tool manager
    this.toolManager = new ToolManager()
    if (config.tools) {
      this.toolManager.registerTools(config.tools)
    }
  }

  /**
   * Get the model to use for a request
   */
  getModel(modelId?: string): LanguageModel {
    const id = modelId || this.defaultModelId
    if (!id) {
      throw new Error('No model available. Configure at least one model.')
    }

    const model = this.models[id]
    if (!model) {
      throw new Error(`Model "${id}" not found`)
    }

    // Apply middleware
    return applyMiddleware(model, this.config)
  }

  /**
   * Register a new tool
   */
  registerTool(tool: AITool): void {
    this.toolManager.registerTool(tool)
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: AITool[]): void {
    this.toolManager.registerTools(tools)
  }

  /**
   * Stream text response with tool support
   */
  async *streamText(
    messages: CoreMessage[],
    options?: StreamOptions & { modelId?: string }
  ): AsyncGenerator<StreamEvent> {
    const model = this.getModel(options?.modelId)
    const tools = options?.tools || this.toolManager.getAllTools()

    yield* streamModelResponse(model, messages, tools, options)
  }

  /**
   * Generate complete response (non-streaming)
   */
  async generateText(
    messages: CoreMessage[],
    options?: GenerateOptions & { modelId?: string }
  ): Promise<GenerationResponse> {
    const model = this.getModel(options?.modelId)
    const tools = options?.tools || this.toolManager.getAllTools()

    return generateModelResponse(model, messages, tools, options)
  }

  /**
   * Stream with automatic tool execution
   */
  async streamWithTools(
    messages: CoreMessage[],
    options?: StreamOptions & {
      modelId?: string
      autoExecuteTools?: boolean
      onToolCall?: (toolName: string, args: unknown) => void
    }
  ): Promise<GenerationResponse> {
    const model = this.getModel(options?.modelId)
    const tools = options?.tools || this.toolManager.getAllTools()

    return streamWithToolExecution(model, messages, tools, options)
  }

  /**
   * Convert streaming response to a readable stream
   */
  async toReadableStream(
    messages: CoreMessage[],
    options?: StreamOptions & { modelId?: string }
  ): Promise<ReadableStream<string>> {
    const generator = this.streamText(messages, options)
    return streamEventsToReadable(generator)
  }

  /**
   * Convert readable stream back to events
   */
  async *fromReadableStream(
    stream: ReadableStream<string>
  ): AsyncGenerator<StreamEvent> {
    yield* parseStreamingEvents(stream)
  }

  /**
   * Aggregate streaming events into complete response
   */
  async aggregateStream(
    messages: CoreMessage[],
    options?: StreamOptions & { modelId?: string }
  ): Promise<GenerationResponse> {
    const generator = this.streamText(messages, options)
    return aggregateStreamingEvents(generator)
  }

  /**
   * Get tool by name
   */
  getTool(name: string): AITool | undefined {
    return this.toolManager.getTool(name)
  }

  /**
   * Get all registered tools
   */
  getAllTools(): AITool[] {
    return this.toolManager.getAllTools()
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): AITool[] {
    return this.toolManager.getToolsByCategory(category)
  }

  /**
   * Execute a tool directly
   */
  async executeTool(toolName: string, args: unknown): Promise<unknown> {
    return this.toolManager.executeTool(toolName, args)
  }

  /**
   * Get model capabilities
   */
  getModelCapabilities(modelId?: string) {
    const id = modelId || this.defaultModelId
    if (!id) {
      throw new Error('No model available')
    }

    // Find the config for this model
    const config = this.config.models.find(
      (m) => m.modelId === id || m.provider === id
    )
    if (!config) {
      throw new Error(`Model "${id}" not found in configuration`)
    }

    return getProviderFeatures(config.provider)
  }

  /**
   * Get tool execution statistics
   */
  getToolStats() {
    return this.toolManager.getExecutionStats()
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return Object.keys(this.models)
  }

  /**
   * Add MCP tools to the wrapper
   */
  addMCPTools(mcpTools: Parameters<typeof mcpToolsToAISDKFormat>[0]): void {
    // Convert MCP tools to AITool format
    const sdkFormat = mcpToolsToAISDKFormat(mcpTools)

    // Register as regular tools
    for (const tool of mcpTools) {
      this.registerTool({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema as any,
        execute: async (input) => {
          // MCP execution is handled separately
          return { status: 'pending', input }
        },
        tags: ['mcp'],
      })
    }
  }
}

/**
 * Factory function to create wrapper with default configuration
 */
export function createAISDKWrapper(config: AISDKWrapperConfig): AISDKWrapper {
  return new AISDKWrapper(config)
}

/**
 * Re-export types
 */
export type {
  AISDKWrapperConfig,
  ModelConfig,
  AITool,
  GenerationResponse,
  StreamEvent,
  StreamOptions,
  GenerateOptions,
  MCPServerConfig,
  ProviderFeatures,
  TokenUsage,
  RetryConfig,
  ErrorConfig,
  ReasoningOptions,
}

/**
 * Re-export error classes and utilities
 */
export {
  AISDKError,
  APIError,
  RateLimitError,
  AuthenticationError,
  ValidationError,
  TimeoutError,
  retryWithBackoff,
  createFetchWithRetry,
  isRetryableError,
  getErrorMessage,
  withTimeout,
}

/**
 * Re-export utilities
 */
export {
  ToolManager,
  mcpToolsToAISDKFormat,
  mergeToolSets,
  createLanguageModel,
  createModelMap,
  getModel,
  getProviderFeatures,
  validateModelConfig,
  createMiddlewareFromConfig,
  applyMiddleware,
}

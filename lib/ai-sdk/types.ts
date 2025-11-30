/**
 * Core type definitions for the AI SDK wrapper
 * Provides comprehensive TypeScript support for all SDK features
 */

import type { CoreMessage, LanguageModel } from 'ai'
import type { z } from 'zod'

// Provider-agnostic model identifiers
export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'custom'

export interface ModelConfig {
  provider: ModelProvider
  modelId: string
  apiKey?: string
  baseURL?: string
  customFetch?: typeof fetch
}

// Tool definition with Zod schema for runtime validation
export interface AITool<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  inputSchema: z.ZodType<TInput>
  execute: (input: TInput) => Promise<TOutput>
  category?: string
  tags?: string[]
}

// Streaming response types
export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool-call'; toolName: string; toolCallId: string; args: unknown }
  | { type: 'tool-result'; toolName: string; toolCallId: string; result: unknown }
  | { type: 'error'; error: Error }
  | { type: 'finish'; usage?: TokenUsage }

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens?: number
}

// Complete generation response
export interface GenerationResponse {
  text: string
  thinking?: string
  toolCalls: Array<{
    id: string
    name: string
    args: unknown
  }>
  toolResults: Array<{
    id: string
    name: string
    result: unknown
  }>
  usage: TokenUsage
  finishReason: string
  stopReason?: 'tool-calls' | 'max-tokens' | 'stop-sequence' | 'error'
}

// Streaming generation response
export interface StreamingGenerationResponse {
  textStream: ReadableStream<string>
  thinkingStream?: ReadableStream<string>
  toolCallStream?: ReadableStream<{
    id: string
    name: string
    args: unknown
  }>
  fullResponse: Promise<GenerationResponse>
}

// Tool call result for continuing conversation
export type ToolResult = {
  toolCallId: string
  toolName: string
  result: unknown
  isError?: boolean
}

// MCP server configuration
export interface MCPServerConfig {
  name: string
  type: 'stdio' | 'sse'
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
}

// MCP tool exposed by server
export interface MCPToolDefinition {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

// Reasoning/thinking middleware options
export interface ReasoningOptions {
  enabled?: boolean
  budgetTokens?: number
  maxThinkingLength?: number
}

// Error handling and retry options
export interface RetryConfig {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffFactor?: number
  retryableStatusCodes?: number[]
}

export interface ErrorConfig {
  handleAPIErrors?: boolean
  handleRateLimits?: boolean
  handleTimeouts?: boolean
  retryConfig?: RetryConfig
}

// Complete wrapper configuration
export interface AISDKWrapperConfig {
  models: ModelConfig[]
  defaultModel?: string
  tools?: AITool[]
  mcpServers?: MCPServerConfig[]
  reasoning?: ReasoningOptions
  errors?: ErrorConfig
  middleware?: {
    onRequest?: (request: { messages: CoreMessage[] }) => void
    onResponse?: (response: GenerationResponse) => void
    onError?: (error: Error) => void
  }
}

// Method-specific options
export interface StreamOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stopSequences?: string[]
  tools?: AITool[]
  toolChoice?: 'auto' | 'required' | 'none'
  reasoning?: ReasoningOptions
}

export interface GenerateOptions extends StreamOptions {
  abortSignal?: AbortSignal
}

// Provider-specific features
export interface ProviderFeatures {
  supportsStreaming: boolean
  supportsToolCalling: boolean
  supportsReasoning: boolean
  supportsVision: boolean
  supportsFunctionCalling: boolean
  maxTokens: number
  maxToolsPerRequest: number
}

// Tool execution context
export interface ToolExecutionContext {
  toolName: string
  input: unknown
  messageHistory: CoreMessage[]
  availableTools: AITool[]
  model: LanguageModel
}

// Batch processing configuration
export interface BatchConfig {
  maxParallel?: number
  maxTokensPerBatch?: number
  retryFailedOnly?: boolean
}

export interface BatchRequest {
  messages: CoreMessage[]
  tools?: AITool[]
  options?: StreamOptions
}

export interface BatchResponse {
  responses: GenerationResponse[]
  errors: Array<{ index: number; error: Error }>
  totalTokens: TokenUsage
}

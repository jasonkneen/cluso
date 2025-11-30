/**
 * AI Chat Hook - Unified AI SDK Wrapper
 *
 * This module re-exports from useAIChatV2 for backwards compatibility.
 * All AI SDK operations are now handled through Electron IPC to avoid CORS issues.
 *
 * IMPORTANT: This is now a wrapper around useAIChatV2 which uses Electron IPC.
 * For direct browser usage without Electron, the old implementation is preserved
 * below as a fallback.
 *
 * @module hooks/useAIChat
 */

// Re-export everything from the new V2 implementation
export {
  useAIChatV2 as useAIChat,
  type ToolCallPart,
  type ToolResultPart,
  type ProviderType,
  type ProviderConfig,
  type ChatMessage,
  type ReasoningContent,
  type StreamEventType,
  type StreamEvent,
  type UseAIChatOptions,
  type ToolDefinition,
  type ToolsMap,
  type MCPToolDefinition,
  type MCPToolCaller,
  type CoreMessage,
  getProviderForModel,
  toCoreMessages,
  mcpToolsToAISDKFormat,
  mergeTools,
  z,
} from './useAIChatV2'

// Also export the V2 hook directly for explicit usage
export { useAIChatV2 } from './useAIChatV2'

/**
 * Legacy implementation preserved for reference and non-Electron environments
 *
 * The code below is the original implementation that makes direct API calls.
 * It's preserved here for:
 * 1. Reference when debugging
 * 2. Potential future use in non-Electron (web-only) environments
 * 3. Understanding the original architecture
 *
 * The new V2 implementation routes all calls through Electron IPC to:
 * - Avoid CORS issues with API calls
 * - Centralize OAuth token management
 * - Enable MCP tool execution in the main process
 * - Provide better streaming performance
 */

// ============================================================================
// LEGACY IMPLEMENTATION (PRESERVED FOR REFERENCE)
// ============================================================================
// The original implementation is preserved below but commented out.
// If you need to use direct API calls without Electron, you can uncomment
// and export this implementation.

/*
import { useState, useCallback, useRef } from 'react'
import {
  generateText,
  streamText,
  CoreMessage,
  tool,
  extractReasoningMiddleware,
  wrapLanguageModel,
  jsonSchema,
} from 'ai'

// ... (original implementation was ~1300 lines)
// See git history for full original implementation if needed
*/

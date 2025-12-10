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


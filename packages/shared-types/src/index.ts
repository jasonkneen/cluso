/**
 * @ai-cluso/shared-types
 *
 * Shared TypeScript types for ai-cluso applications.
 * Used by both the Electron desktop app and Chrome extension.
 */

// Element and DOM types
export type {
  ComponentSource,
  ElementSourceInfo,
  ReactComponentInfo,
  SelectedElement,
  ElementDisplay,
  ElementStyles,
} from './element'
export { DEFAULT_ELEMENT_STYLES } from './element'

// MCP types
export type {
  MCPTransportType,
  MCPConnectionStatus,
  MCPStdioConfig,
  MCPSSEConfig,
  MCPTransportConfig,
  MCPToolParameter,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPServerCapabilities,
  MCPServerConfig,
  MCPServerState,
  MCPToolCall,
  MCPToolResult,
} from './mcp'

// Messaging types
export type {
  StreamState,
  AudioVisualizerData,
  ToolUsage,
  Message,
  SourcePatch,
  PatchApprovalState,
  InspectorMessageType,
  InspectorMessage,
} from './messaging'

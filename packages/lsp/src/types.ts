/**
 * LSP Types
 * Core type definitions for the LSP client package
 */

import type { ChildProcess } from 'child_process'
import type { EventEmitter } from 'events'

/**
 * LSP Diagnostic severity levels
 */
export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

/**
 * Position in a text document (0-indexed)
 */
export interface Position {
  line: number
  character: number
}

/**
 * Range in a text document
 */
export interface Range {
  start: Position
  end: Position
}

/**
 * LSP Diagnostic
 */
export interface Diagnostic {
  range: Range
  severity?: DiagnosticSeverity
  code?: string | number
  source?: string
  message: string
  relatedInformation?: DiagnosticRelatedInformation[]
  tags?: number[]
}

/**
 * Related information for a diagnostic
 */
export interface DiagnosticRelatedInformation {
  location: {
    uri: string
    range: Range
  }
  message: string
}

/**
 * Hover result
 */
export interface Hover {
  contents: MarkupContent | string
  range?: Range
}

/**
 * Markup content (markdown or plaintext)
 */
export interface MarkupContent {
  kind: 'plaintext' | 'markdown'
  value: string
}

/**
 * Completion item
 */
export interface CompletionItem {
  label: string
  kind?: number
  detail?: string
  documentation?: string | MarkupContent
  insertText?: string
  insertTextFormat?: number
  textEdit?: TextEdit
  additionalTextEdits?: TextEdit[]
  sortText?: string
  filterText?: string
  preselect?: boolean
}

/**
 * Text edit
 */
export interface TextEdit {
  range: Range
  newText: string
}

/**
 * Location (file + range)
 */
export interface Location {
  uri: string
  range: Range
}

/**
 * Progress callback for installation
 */
export interface InstallProgress {
  stage: 'fetching' | 'downloading' | 'installing' | 'extracting' | 'complete'
  package: string
  size?: number
  downloaded?: number
}

export type InstallProgressCallback = (progress: InstallProgress) => void

/**
 * Server spawn options
 */
export interface SpawnOptions {
  env?: Record<string, string>
}

/**
 * Server definition
 */
export interface ServerDefinition {
  id: string
  name: string
  extensions: string[]
  rootPatterns: string[]
  excludePatterns?: string[]
  installable: boolean

  checkInstalled(): Promise<boolean>
  install(onProgress?: InstallProgressCallback): Promise<string>
  spawn(root: string, options?: SpawnOptions): Promise<ChildProcess | null>
  initialization?: Record<string, unknown>
}

/**
 * Server status for UI display
 */
export interface ServerStatus {
  id: string
  name: string
  extensions: string[]
  enabled: boolean
  installed: boolean
  installable: boolean
  running: boolean
  instances: ServerInstance[]
}

/**
 * Running server instance info
 */
export interface ServerInstance {
  root: string
  openDocuments: number
  diagnosticCount: number
}

/**
 * LSP Client options
 */
export interface LSPClientOptions {
  serverID: string
  root: string
  process: ChildProcess
  initialization?: Record<string, unknown>
}

/**
 * LSP Manager options
 */
export interface LSPManagerOptions {
  /** Application name for cache directory (default: 'lsp-client') */
  appName?: string
  /** Custom cache directory (overrides appName) */
  cacheDir?: string
  /** Path to bundled bun binary (for npm installs) */
  bunPath?: string
}

/**
 * Cache info for UI display
 */
export interface CacheInfo {
  path: string
  size: number
  version: string
  packages: string[]
}

/**
 * Diagnostics event
 */
export interface DiagnosticsEvent {
  path: string
  diagnostics: Diagnostic[]
}

/**
 * Server event types
 */
export interface LSPManagerEvents {
  diagnostics: DiagnosticsEvent
  'server-started': { serverId: string; root: string }
  'server-closed': { serverId: string; root: string }
  'server-status-changed': { serverId: string; enabled: boolean }
}

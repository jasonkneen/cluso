// @ts-nocheck
/**
 * Event broadcaster for WebSocket
 *
 * Provides typed event emission methods for broadcasting server events
 * to WebSocket subscribers.
 */

import { WebSocketManager } from './manager.js'
import type {
  LSPDiagnostic,
  SearchResult,
  FileInfo,
  ValidationResult,
} from '../types/api.js'

/**
 * File change event data
 */
export interface FileChangeEvent {
  file: string
  event: 'add' | 'change' | 'unlink' | 'unlinkDir' | 'addDir'
  timestamp: string
}

/**
 * Diagnostics update event data
 */
export interface DiagnosticsUpdateEvent {
  diagnostics: LSPDiagnostic[]
  cleared: boolean
  timestamp: string
}

/**
 * AI chunk event data (for streaming responses)
 */
export interface AIChunkEvent {
  id: string
  chunk: string
  index: number
  finished: boolean
  timestamp: string
}

/**
 * Search progress event data
 */
export interface SearchProgressEvent {
  query: string
  completed: number
  total: number | null
  results: SearchResult[]
  timestamp: string
}

/**
 * Validation result event data
 */
export interface ValidationEvent {
  validation: ValidationResult
  timestamp: string
}

/**
 * Git event data
 */
export interface GitEvent {
  type: 'status' | 'commit' | 'push' | 'pull' | 'branch'
  message: string
  timestamp: string
}

/**
 * Broadcasts typed events to WebSocket subscribers
 *
 * @example
 * ```typescript
 * const manager = new WebSocketManager()
 * const broadcaster = new EventBroadcaster(manager)
 *
 * // Broadcast file change
 * broadcaster.fileChanged('src/main.ts', 'change')
 *
 * // Broadcast diagnostics
 * broadcaster.diagnosticsUpdated([
 *   { file: 'src/main.ts', line: 1, column: 0, message: 'Error', severity: 'error', source: 'tsc' }
 * ])
 *
 * // Broadcast AI chunk
 * broadcaster.aiChunk('req-1', 'This is a response ', 0, false)
 *
 * // Broadcast search progress
 * broadcaster.searchProgress('useState', 50, 100, [])
 * ```
 */
export class EventBroadcaster {
  constructor(private manager: WebSocketManager) {}

  /**
   * Broadcast file change event
   */
  fileChanged(file: string, event: 'add' | 'change' | 'unlink' | 'unlinkDir' | 'addDir'): void {
    const data: FileChangeEvent = {
      file,
      event,
      timestamp: new Date().toISOString(),
    }
    this.manager.broadcast('files', data)
  }

  /**
   * Broadcast diagnostics update event
   */
  diagnosticsUpdated(diagnostics: LSPDiagnostic[], cleared = false): void {
    const data: DiagnosticsUpdateEvent = {
      diagnostics,
      cleared,
      timestamp: new Date().toISOString(),
    }
    this.manager.broadcast('diagnostics', data)
  }

  /**
   * Broadcast AI response chunk
   */
  aiChunk(id: string, chunk: string, index: number, finished: boolean): void {
    const data: AIChunkEvent = {
      id,
      chunk,
      index,
      finished,
      timestamp: new Date().toISOString(),
    }
    this.manager.broadcast('ai-response', data)
  }

  /**
   * Broadcast search progress
   */
  searchProgress(
    query: string,
    completed: number,
    total: number | null,
    results: SearchResult[]
  ): void {
    const data: SearchProgressEvent = {
      query,
      completed,
      total,
      results,
      timestamp: new Date().toISOString(),
    }
    this.manager.broadcast('search', data)
  }

  /**
   * Broadcast validation result
   */
  validationComplete(validation: ValidationResult): void {
    const data: ValidationEvent = {
      validation,
      timestamp: new Date().toISOString(),
    }
    this.manager.broadcast('validation', data)
  }

  /**
   * Broadcast git event
   */
  gitEvent(
    type: 'status' | 'commit' | 'push' | 'pull' | 'branch',
    message: string
  ): void {
    const data: GitEvent = {
      type,
      message,
      timestamp: new Date().toISOString(),
    }
    this.manager.broadcast('git', data)
  }

  /**
   * Broadcast custom event to arbitrary channel
   */
  emit(channel: string, data: unknown): void {
    this.manager.broadcast(channel, data)
  }
}

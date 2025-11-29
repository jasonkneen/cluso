import { useState, useEffect, useCallback, useRef } from 'react'

export interface ClaudeCodeMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolCalls?: ClaudeCodeToolCall[]
  toolResults?: ClaudeCodeToolResult[]
}

export interface ClaudeCodeToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ClaudeCodeToolResult {
  toolUseId: string
  content: string
  isError: boolean
}

export interface UseClaudeCodeOptions {
  onTextChunk?: (text: string) => void
  onToolUse?: (toolUse: ClaudeCodeToolCall) => void
  onToolResult?: (result: ClaudeCodeToolResult) => void
  onComplete?: () => void
  onError?: (error: string) => void
}

export interface UseClaudeCodeReturn {
  isAvailable: boolean
  isActive: boolean
  isStreaming: boolean
  error: string | null
  startSession: (prompt: string, options?: { model?: 'fast' | 'smart', cwd?: string }) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  stop: () => Promise<void>
  reset: () => Promise<void>
}

/**
 * Hook for interacting with Claude Code via the Claude Agent SDK
 * Uses OAuth authentication through the CLI
 */
export function useClaudeCode(options: UseClaudeCodeOptions = {}): UseClaudeCodeReturn {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Store options in ref to avoid re-registering listeners
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Check if Claude Code API is available (Electron only)
  useEffect(() => {
    const available = !!(window.electronAPI?.claudeCode)
    setIsAvailable(available)

    if (!available) {
      return
    }

    // Set up event listeners
    const claudeCode = window.electronAPI!.claudeCode

    const unsubTextChunk = claudeCode.onTextChunk((text) => {
      optionsRef.current.onTextChunk?.(text)
    })

    const unsubToolUse = claudeCode.onToolUse((toolUse) => {
      optionsRef.current.onToolUse?.(toolUse)
    })

    const unsubToolResult = claudeCode.onToolResult((result) => {
      optionsRef.current.onToolResult?.(result)
    })

    const unsubComplete = claudeCode.onComplete(() => {
      setIsStreaming(false)
      optionsRef.current.onComplete?.()
    })

    const unsubError = claudeCode.onError((err) => {
      setIsStreaming(false)
      setError(err)
      optionsRef.current.onError?.(err)
    })

    // Check initial active state
    claudeCode.isActive().then((result) => {
      setIsActive(result.active)
    })

    // Cleanup
    return () => {
      unsubTextChunk()
      unsubToolUse()
      unsubToolResult()
      unsubComplete()
      unsubError()
    }
  }, [])

  const startSession = useCallback(async (
    prompt: string,
    sessionOptions?: { model?: 'fast' | 'smart', cwd?: string }
  ) => {
    if (!window.electronAPI?.claudeCode) {
      setError('Claude Code is only available in the desktop app')
      return
    }

    setError(null)
    setIsStreaming(true)

    try {
      const result = await window.electronAPI.claudeCode.startSession({
        prompt,
        model: sessionOptions?.model,
        cwd: sessionOptions?.cwd,
      })

      if (!result.success) {
        setError(result.error || 'Failed to start session')
        setIsStreaming(false)
        return
      }

      setIsActive(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setIsStreaming(false)
    }
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!window.electronAPI?.claudeCode) {
      setError('Claude Code is only available in the desktop app')
      return
    }

    setError(null)
    setIsStreaming(true)

    try {
      const result = await window.electronAPI.claudeCode.sendMessage(text)

      if (!result.success) {
        setError(result.error || 'Failed to send message')
        setIsStreaming(false)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setIsStreaming(false)
    }
  }, [])

  const stop = useCallback(async () => {
    if (!window.electronAPI?.claudeCode) {
      return
    }

    try {
      await window.electronAPI.claudeCode.stop()
      setIsStreaming(false)
    } catch (err) {
      console.error('Failed to stop:', err)
    }
  }, [])

  const reset = useCallback(async () => {
    if (!window.electronAPI?.claudeCode) {
      return
    }

    try {
      await window.electronAPI.claudeCode.reset()
      setIsActive(false)
      setIsStreaming(false)
      setError(null)
    } catch (err) {
      console.error('Failed to reset:', err)
    }
  }, [])

  return {
    isAvailable,
    isActive,
    isStreaming,
    error,
    startSession,
    sendMessage,
    stop,
    reset,
  }
}

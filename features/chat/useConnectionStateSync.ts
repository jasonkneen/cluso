/**
 * Connection State Sync Hook
 *
 * Handles syncing connection state with AI SDK initialization.
 * Extracted from App.tsx lines 1580-1584.
 */

import { useEffect } from 'react'

type ConnectionState = 'disconnected' | 'idle' | 'connecting' | 'streaming'

interface UseConnectionStateSyncOptions {
  isAIInitialized: boolean
  connectionState: ConnectionState
  setConnectionState: (state: ConnectionState) => void
}

/**
 * Hook for syncing connection state with AI initialization
 *
 * Updates connection state to 'idle' when AI SDK initializes.
 */
export function useConnectionStateSync({
  isAIInitialized,
  connectionState,
  setConnectionState,
}: UseConnectionStateSyncOptions): void {
  useEffect(() => {
    if (isAIInitialized && connectionState === 'disconnected') {
      setConnectionState('idle')
    }
  }, [isAIInitialized, connectionState, setConnectionState])
}

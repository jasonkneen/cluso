/**
 * Screen Sharing Hook
 *
 * Manages screen sharing state and media streams.
 * Handles display media acquisition and cleanup.
 *
 * Extracted from App.tsx to centralize screen sharing logic.
 */

import { useEffect } from 'react'
import type { UseScreenSharingOptions } from './types'

/**
 * Hook for managing screen sharing
 *
 * Starts screen capture when enabled and connected.
 * Properly cleans up media tracks when disabled.
 *
 * @param options - Configuration options for screen sharing
 */
export function useScreenSharing(options: UseScreenSharingOptions): void {
  const {
    isScreenSharing,
    setIsScreenSharing,
    streamState,
    videoRef,
    startVideoStreaming,
    stopVideoStreaming,
  } = options

  useEffect(() => {
    if (streamState.isConnected && isScreenSharing) {
      navigator.mediaDevices.getDisplayMedia({ video: true }).then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          startVideoStreaming()
        }
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false)
          stopVideoStreaming()
        }
      }).catch(err => {
        console.error("Failed to get display media", err)
        setIsScreenSharing(false)
      })
    } else {
      stopVideoStreaming()
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(t => t.stop())
        videoRef.current.srcObject = null
      }
    }
  }, [isScreenSharing, streamState.isConnected, startVideoStreaming, stopVideoStreaming, setIsScreenSharing, videoRef])
}

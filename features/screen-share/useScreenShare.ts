/**
 * Screen Share Hook
 *
 * Handles screen sharing video stream setup and cleanup.
 * Extracted from App.tsx lines 3506-3529.
 */

import { useEffect } from 'react'

interface UseScreenShareOptions {
  isConnected: boolean
  isScreenSharing: boolean
  setIsScreenSharing: (sharing: boolean) => void
  videoRef: React.RefObject<HTMLVideoElement>
  startVideoStreaming: () => void
  stopVideoStreaming: () => void
}

/**
 * Hook for managing screen sharing
 *
 * Handles getting display media and cleaning up video tracks.
 */
export function useScreenShare({
  isConnected,
  isScreenSharing,
  setIsScreenSharing,
  videoRef,
  startVideoStreaming,
  stopVideoStreaming,
}: UseScreenShareOptions): void {
  useEffect(() => {
    if (isConnected && isScreenSharing) {
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
        console.error('Failed to get display media', err)
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
  }, [isScreenSharing, isConnected, startVideoStreaming, stopVideoStreaming, setIsScreenSharing, videoRef])
}

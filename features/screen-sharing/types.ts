/**
 * Screen Sharing Types
 *
 * Type definitions for screen sharing functionality.
 */

export interface UseScreenSharingOptions {
  isScreenSharing: boolean
  setIsScreenSharing: (sharing: boolean) => void
  streamState: { isConnected: boolean }
  videoRef: React.RefObject<HTMLVideoElement>
  startVideoStreaming: () => void
  stopVideoStreaming: () => void
}

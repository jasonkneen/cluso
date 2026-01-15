/**
 * Media Feature Types
 *
 * Type definitions for voice/screen sharing media state management.
 */

/**
 * Media state managed by useMediaState hook
 */
export interface MediaState {
  /** Whether voice input mode is active */
  isVoiceMode: boolean
  /** Whether currently recording audio input */
  isRecording: boolean
  /** Current voice input text (transcribed speech) */
  voiceInputText: string
  /** Whether screen sharing is active */
  isScreenSharing: boolean
  /** Whether floating toolbar is visible */
  isFloatingToolbarVisible: boolean
}

/**
 * Actions returned by useMediaState hook
 */
export interface MediaStateActions {
  setIsVoiceMode: React.Dispatch<React.SetStateAction<boolean>>
  setIsRecording: React.Dispatch<React.SetStateAction<boolean>>
  setVoiceInputText: React.Dispatch<React.SetStateAction<string>>
  setIsScreenSharing: React.Dispatch<React.SetStateAction<boolean>>
  setIsFloatingToolbarVisible: React.Dispatch<React.SetStateAction<boolean>>
  /** Start voice mode and recording */
  startVoiceInput: () => void
  /** Stop voice mode and recording */
  stopVoiceInput: () => void
  /** Toggle screen sharing */
  toggleScreenSharing: () => void
  /** Toggle floating toolbar visibility */
  toggleFloatingToolbar: () => void
  /** Clear voice input text */
  clearVoiceInput: () => void
}

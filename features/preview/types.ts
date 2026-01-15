/**
 * Preview Feature Types
 *
 * Type definitions for preview/popup state management.
 */

/**
 * Intent type for preview actions
 */
export type PreviewIntentType =
  | 'code_edit'
  | 'code_create'
  | 'code_delete'
  | 'code_explain'
  | 'code_refactor'
  | 'file_operation'
  | 'ui_inspect'
  | 'ui_modify'
  | 'ui_build'
  | 'research'
  | 'analyze'
  | 'compare'
  | 'plan'
  | 'document'
  | 'test'
  | 'debug'
  | 'review'
  | 'deploy'
  | 'configure'
  | 'question'
  | 'chat'

/**
 * Preview intent object containing type, label, and optional secondary intents
 */
export interface PreviewIntent {
  /** Primary intent type */
  type: PreviewIntentType | string
  /** Human-readable label for the intent */
  label: string
  /** Optional secondary intent types */
  secondaryTypes?: string[]
  /** Optional secondary intent labels */
  secondaryLabels?: string[]
}

/**
 * Preview state managed by usePreviewState hook
 */
export interface PreviewState {
  /** Current preview intent or null if no preview */
  previewIntent: PreviewIntent | null
  /** Text input for the popup/element chat */
  popupInput: string
  /** Whether the element chat popup is visible */
  showElementChat: boolean
}

/**
 * Actions returned by usePreviewState hook
 */
export interface PreviewStateActions {
  setPreviewIntent: React.Dispatch<React.SetStateAction<PreviewIntent | null>>
  setPopupInput: React.Dispatch<React.SetStateAction<string>>
  setShowElementChat: React.Dispatch<React.SetStateAction<boolean>>
  /** Clears all preview state */
  clearPreview: () => void
  /** Clears popup input and hides element chat */
  clearPopup: () => void
}

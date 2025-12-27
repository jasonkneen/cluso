/**
 * Application Constants
 *
 * Centralizes magic numbers and configuration values used throughout the application.
 */

// ============================================================================
// Timeout & Interval Constants (in milliseconds)
// ============================================================================

/** Default timeout for status check intervals */
export const STATUS_CHECK_INTERVAL_MS = 5000

/** Default debounce time for user input */
export const DEBOUNCE_MS = 1000

/** Delay for UI updates after state changes */
export const UI_UPDATE_DELAY_MS = 500

/** Short delay for quick UI feedback */
export const UI_FEEDBACK_DELAY_MS = 100

/** Default timeout for webview messages */
export const WEBVIEW_MESSAGE_TIMEOUT_MS = 5000

/** Timeout for async operations */
export const ASYNC_OPERATION_TIMEOUT_MS = 5000

/** Timeout for PTY port fetch */
export const PTY_PORT_FETCH_TIMEOUT_MS = 1000

/** Notification display duration */
export const NOTIFICATION_DISPLAY_MS = 5000

// ============================================================================
// Limits & Thresholds
// ============================================================================

/** Maximum console log entries to render */
export const MAX_CONSOLE_LOG_ENTRIES = 200

/** Maximum class names to collect from DOM */
export const MAX_CLASS_NAMES = 5000

/** Maximum font families to display */
export const MAX_FONT_FAMILIES = 200

/** Maximum child elements to include in tree */
export const MAX_TREE_CHILDREN = 200

/** Maximum file content to read for display (in characters) */
export const MAX_FILE_CONTENT_CHARS = 10000

/** Threshold for "near bottom" scroll detection */
export const SCROLL_NEAR_BOTTOM_THRESHOLD = 100

// ============================================================================
// Text Truncation Lengths
// ============================================================================

/** Short text preview length */
export const TEXT_PREVIEW_SHORT = 100

/** Medium text preview length */
export const TEXT_PREVIEW_MEDIUM = 200

/** Long text preview length */
export const TEXT_PREVIEW_LONG = 500

/** Search query max length */
export const SEARCH_QUERY_MAX_LENGTH = 500

// ============================================================================
// UI Dimensions (in pixels)
// ============================================================================

/** Minimum console panel height */
export const CONSOLE_HEIGHT_MIN = 100

/** Maximum console panel height */
export const CONSOLE_HEIGHT_MAX = 500

/** Minimum sidebar width */
export const SIDEBAR_WIDTH_MIN = 200

/** Maximum sidebar width */
export const SIDEBAR_WIDTH_MAX = 400

// ============================================================================
// Zoom Levels
// ============================================================================

export type ZoomLevel = 'fit' | 'actual' | '50' | '75' | '100' | '125' | '150'

export const ZOOM_LEVELS = [
  { value: '50' as const, label: '50%' },
  { value: '75' as const, label: '75%' },
  { value: '100' as const, label: '100%' },
  { value: '125' as const, label: '125%' },
  { value: '150' as const, label: '150%' },
]

// ============================================================================
// AI/Model Constants
// ============================================================================

/** Maximum tokens for quick UI updates */
export const UI_UPDATE_MAX_TOKENS = 200

/** Opacity scale factor (0-100 to 0-1 conversion) */
export const OPACITY_SCALE = 100

// ============================================================================
// Font Weights for Google Fonts
// ============================================================================

export const GOOGLE_FONT_WEIGHTS = '100;200;300;400;500;600;700;800;900'

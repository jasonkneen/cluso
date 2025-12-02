/**
 * Turn Management Utilities
 * 
 * Helpers for managing turns - user requests and agent responses that are correlated.
 */

/**
 * Generate a unique turn ID
 * Format: turn-{timestamp}-{random}
 * Example: turn-1732089125432-a3k9p
 */
export function generateTurnId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 7)
  return `turn-${timestamp}-${random}`
}

/**
 * Generate a unique message ID
 * Format: msg-{timestamp}-{random}
 */
export function generateMessageId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 7)
  return `msg-${timestamp}-${random}`
}

/**
 * Generate a unique tool call ID
 * Format: tool-{timestamp}-{random}
 */
export function generateToolCallId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 7)
  return `tool-${timestamp}-${random}`
}

/**
 * Validate a turn ID format
 */
export function isValidTurnId(id: string): boolean {
  return /^turn-\d+-[a-z0-9]{5}$/.test(id)
}

/**
 * Extract timestamp from a turn ID
 */
export function getTurnIdTimestamp(turnId: string): number | null {
  const match = turnId.match(/^turn-(\d+)-/)
  return match ? parseInt(match[1], 10) : null
}

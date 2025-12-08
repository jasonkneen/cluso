// Error pattern matching and solution caching utility
// Automatically detects common errors and provides cached solutions

interface ErrorSignature {
  pattern: RegExp
  category: ErrorCategory
  keywords: string[]
  description: string
}

interface CachedSolution {
  errorKey: string
  message: string
  solution: string
  category: ErrorCategory
  timestamp: number
  searchQuery: string
}

type ErrorCategory = 'react' | 'typescript' | 'build' | 'network' | 'runtime' | 'unknown'

// In-memory cache
const memoryCache = new Map<string, CachedSolution>()

// Error signatures with patterns and keywords
const ERROR_SIGNATURES: ErrorSignature[] = [
  {
    pattern: /Invalid hook call/i,
    category: 'react',
    keywords: ['hook', 'rules', 'component'],
    description: 'React Hook called outside of functional component',
  },
  {
    pattern: /Cannot read propert[ies]? of (undefined|null)/i,
    category: 'react',
    keywords: ['undefined', 'null reference', 'property access'],
    description: 'Attempting to access property on undefined/null value',
  },
  {
    pattern: /Maximum update depth exceeded/i,
    category: 'react',
    keywords: ['infinite loop', 'useEffect', 'dependency'],
    description: 'Infinite loop in React component updates',
  },
  {
    pattern: /Type '[^']+' is not assignable to type/i,
    category: 'typescript',
    keywords: ['type mismatch', 'typescript', 'assignment'],
    description: 'TypeScript type incompatibility',
  },
  {
    pattern: /Property '[^']+' does not exist/i,
    category: 'typescript',
    keywords: ['property', 'typescript', 'interface'],
    description: 'TypeScript property not found on type',
  },
  {
    pattern: /Module not found|Cannot find module/i,
    category: 'build',
    keywords: ['import', 'module', 'path resolution'],
    description: 'Build error - module cannot be resolved',
  },
  {
    pattern: /Failed to compile/i,
    category: 'build',
    keywords: ['compilation', 'syntax', 'import'],
    description: 'General compilation error',
  },
  {
    pattern: /CORS error|Access-Control-Allow|Cross-Origin/i,
    category: 'network',
    keywords: ['cors', 'cross-origin', 'api'],
    description: 'Cross-Origin Resource Sharing (CORS) error',
  },
  {
    pattern: /Failed to fetch|Network request failed|fetch.*error/i,
    category: 'network',
    keywords: ['network', 'api', 'connection'],
    description: 'Network request failed',
  },
  {
    pattern: /(404|500|502|503) (?:Not Found|Internal Server Error|Bad Gateway|Service Unavailable)/i,
    category: 'network',
    keywords: ['http error', 'server error'],
    description: 'HTTP error response',
  },
  {
    pattern: /ReferenceError.*is not defined/i,
    category: 'runtime',
    keywords: ['undefined variable', 'reference error'],
    description: 'Variable is not defined',
  },
  {
    pattern: /Cannot find name/i,
    category: 'typescript',
    keywords: ['typescript', 'undefined variable'],
    description: 'TypeScript: variable name not found',
  },
]

/**
 * Parse error message to extract key information
 */
export function parseError(errorMessage: string): {
  signature: ErrorSignature | null
  category: ErrorCategory
  errorKey: string
  isKnownError: boolean
} {
  const normalizedMessage = errorMessage.toLowerCase()

  // Try to match against known signatures
  for (const signature of ERROR_SIGNATURES) {
    if (signature.pattern.test(errorMessage)) {
      return {
        signature,
        category: signature.category,
        errorKey: generateErrorKey(errorMessage),
        isKnownError: true,
      }
    }
  }

  // Unknown error
  return {
    signature: null,
    category: 'unknown',
    errorKey: generateErrorKey(errorMessage),
    isKnownError: false,
  }
}

/**
 * Generate a unique key for error deduplication
 */
function generateErrorKey(errorMessage: string): string {
  // Extract first meaningful part of error (first 50 chars without dynamic values)
  const sanitized = errorMessage
    .replace(/line \d+/gi, 'LINE_N')
    .replace(/column \d+/gi, 'COL_N')
    .replace(/at .*?\.js:\d+/g, 'AT_FILE')
    .substring(0, 100)

  // Create a simple hash-like key
  return Buffer.from(sanitized).toString('base64').substring(0, 32)
}

/**
 * Cache a solution for an error
 */
export function cacheSolution(
  errorMessage: string,
  solution: string,
  searchQuery: string
): CachedSolution {
  const parsed = parseError(errorMessage)
  const cached: CachedSolution = {
    errorKey: parsed.errorKey,
    message: errorMessage,
    solution,
    category: parsed.category,
    timestamp: Date.now(),
    searchQuery,
  }

  memoryCache.set(parsed.errorKey, cached)

  // Also save to localStorage for persistence across sessions
  try {
    const storageKey = `error_solution_${parsed.errorKey}`
    localStorage.setItem(storageKey, JSON.stringify(cached))
  } catch (e) {
    // localStorage might not be available in some contexts
    console.warn('[ErrorSolutions] localStorage not available:', e)
  }

  return cached
}

/**
 * Get cached solution for an error
 */
export function getCachedSolution(errorMessage: string): CachedSolution | null {
  const parsed = parseError(errorMessage)

  // Check memory cache first
  if (memoryCache.has(parsed.errorKey)) {
    return memoryCache.get(parsed.errorKey) || null
  }

  // Try localStorage
  try {
    const storageKey = `error_solution_${parsed.errorKey}`
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const cached = JSON.parse(stored) as CachedSolution
      memoryCache.set(parsed.errorKey, cached)
      return cached
    }
  } catch (e) {
    console.warn('[ErrorSolutions] Error reading from localStorage:', e)
  }

  return null
}

/**
 * Generate search query for an error to find solutions
 */
export function generateSearchQuery(errorMessage: string): string {
  const parsed = parseError(errorMessage)

  if (!parsed.signature) {
    // For unknown errors, use first meaningful portion
    return errorMessage.split('\n')[0].substring(0, 100)
  }

  // Build a focused search query based on error category
  const keywords = parsed.signature.keywords.slice(0, 3)
  const error = parsed.signature.description

  return `${error} ${keywords.join(' ')}`
}

/**
 * Clear error solution cache (for debugging/reset)
 */
export function clearCache(): void {
  memoryCache.clear()

  // Clear localStorage entries
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('error_solution_')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch (e) {
    console.warn('[ErrorSolutions] Error clearing localStorage:', e)
  }
}

/**
 * Get all cached solutions (for debugging)
 */
export function getAllCachedSolutions(): CachedSolution[] {
  return Array.from(memoryCache.values())
}

/**
 * Identify error category for styling/icon purposes
 */
export function getErrorIcon(category: ErrorCategory): string {
  const icons: Record<ErrorCategory, string> = {
    react: '⚛️',
    typescript: '📘',
    build: '🔨',
    network: '🌐',
    runtime: '⚙️',
    unknown: '❓',
  }
  return icons[category]
}

/**
 * Check if error is critical (blocks execution)
 */
export function isCriticalError(category: ErrorCategory): boolean {
  return ['build', 'typescript'].includes(category)
}

/**
 * Debounce error processing to avoid spam
 */
export function createErrorDebouncer(delayMs: number = 500) {
  const seen = new Map<string, number>()

  return (errorMessage: string): boolean => {
    const key = generateErrorKey(errorMessage)
    const now = Date.now()
    const lastSeen = seen.get(key)

    if (lastSeen && now - lastSeen < delayMs) {
      return false // Ignore duplicate within debounce window
    }

    seen.set(key, now)
    return true // Process this error
  }
}

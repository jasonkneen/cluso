import { useEffect, useState, useCallback, useRef } from 'react'
import {
  parseError,
  getCachedSolution,
  cacheSolution,
  generateSearchQuery,
  createErrorDebouncer,
  getErrorIcon,
  isCriticalError,
} from '../utils/errorSolutions'

export interface DetectedError {
  id: string
  message: string
  level: 'error' | 'warn'
  category: 'react' | 'typescript' | 'build' | 'network' | 'runtime' | 'unknown'
  timestamp: number
  icon: string
  isCritical: boolean
  solution?: {
    text: string
    source: 'cached' | 'search'
    query: string
  }
  isSearching?: boolean
}

interface UseErrorPrefetchOptions {
  onErrorDetected?: (error: DetectedError) => void
  onSolutionFound?: (error: DetectedError) => void
  debounceMs?: number
  enableAutoSearch?: boolean
  maxCachedErrors?: number
}

/**
 * Hook to detect errors from console logs and prefetch solutions
 */
export function useErrorPrefetch(options: UseErrorPrefetchOptions = {}) {
  const {
    onErrorDetected,
    onSolutionFound,
    debounceMs = 500,
    enableAutoSearch = true,
    maxCachedErrors = 50,
  } = options

  const [errors, setErrors] = useState<DetectedError[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debouncerRef = useRef(createErrorDebouncer(debounceMs))
  const consoleInterceptRef = useRef<(() => void) | null>(null)

  // Initialize console interception
  useEffect(() => {
    const originalError = console.error
    const originalWarn = console.warn

    // Error handler
    const handleError = (message: string) => {
      if (!debouncerRef.current(message)) return

      const parsed = parseError(message)
      const errorId = `error_${Date.now()}_${Math.random()}`

      // Check for cached solution immediately
      const cached = getCachedSolution(message)
      const searchQuery = generateSearchQuery(message)

      const error: DetectedError = {
        id: errorId,
        message,
        level: 'error',
        category: parsed.category,
        timestamp: Date.now(),
        icon: getErrorIcon(parsed.category),
        isCritical: isCriticalError(parsed.category),
        solution: cached
          ? {
              text: cached.solution,
              source: 'cached',
              query: cached.searchQuery,
            }
          : undefined,
        isSearching: enableAutoSearch && !cached,
      }

      // Add to state (with limit)
      setErrors(prev => {
        const updated = [error, ...prev].slice(0, maxCachedErrors)
        return updated
      })

      // Notify callback
      if (onErrorDetected) {
        onErrorDetected(error)
      }

      // Auto-search if enabled and no cached solution
      if (enableAutoSearch && !cached && parsed.isKnownError) {
        performSearch(error, searchQuery, message)
      }
    }

    // Intercept console.error
    console.error = (...args: unknown[]) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      }).join(' ')

      // Suppress known harmless third-party library errors
      if (
        message.includes('tippyOptions') ||
        message.includes('[tiptap') ||
        message.includes('Duplicate extension')
      ) {
        return // Silently ignore these known issues
      }

      handleError(message)
      originalError.apply(console, args)
    }

    // Intercept console.warn for non-critical issues
    console.warn = (...args: unknown[]) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      }).join(' ')

      // Suppress known harmless third-party library warnings
      if (
        message.includes('[tiptap warn]') ||
        message.includes('tippyOptions') ||
        message.includes('Duplicate extension names')
      ) {
        return // Silently ignore these known issues
      }

      originalWarn.apply(console, args)
    }

    // Cleanup function
    consoleInterceptRef.current = () => {
      console.error = originalError
      console.warn = originalWarn
    }

    return () => {
      if (consoleInterceptRef.current) {
        consoleInterceptRef.current()
      }
    }
  }, [enableAutoSearch, onErrorDetected, maxCachedErrors])

  // Perform solution search
  const performSearch = useCallback(
    async (error: DetectedError, query: string, originalMessage: string) => {
      setIsSearching(true)

      try {
        // Simulate solution search (would integrate with actual search API)
        const solution = generateSolutionForError(error.category, query)

        if (solution) {
          // Cache the solution
          cacheSolution(originalMessage, solution, query)

          // Update error with solution
          setErrors(prev =>
            prev.map(e =>
              e.id === error.id
                ? {
                    ...e,
                    solution: {
                      text: solution,
                      source: 'search',
                      query,
                    },
                    isSearching: false,
                  }
                : e
            )
          )

          if (onSolutionFound) {
            onSolutionFound({
              ...error,
              solution: {
                text: solution,
                source: 'search',
                query,
              },
              isSearching: false,
            })
          }
        } else {
          // No solution found - still clear the searching state
          setErrors(prev =>
            prev.map(e =>
              e.id === error.id
                ? { ...e, isSearching: false }
                : e
            )
          )
        }
      } catch (err) {
        console.warn('[useErrorPrefetch] Search failed:', err)
        // Clear searching state on error
        setErrors(prev =>
          prev.map(e =>
            e.id === error.id
              ? { ...e, isSearching: false }
              : e
          )
        )
      } finally {
        setIsSearching(false)
      }
    },
    [onSolutionFound]
  )

  // Manual search function
  const searchForSolution = useCallback(
    async (errorId: string) => {
      const error = errors.find(e => e.id === errorId)
      if (!error) return

      const query = generateSearchQuery(error.message)
      await performSearch(error, query, error.message)
    },
    [errors, performSearch]
  )

  // Clear errors
  const clearErrors = useCallback(() => {
    setErrors([])
  }, [])

  // Remove single error
  const removeError = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(e => e.id !== errorId))
  }, [])

  return {
    errors,
    isSearching,
    clearErrors,
    removeError,
    searchForSolution,
  }
}

/**
 * Generate a helpful solution based on error category
 * In production, this would call an AI API or knowledge base
 */
function generateSolutionForError(category: string, query: string): string | null {
  const solutions: Record<string, string> = {
    react: `This is a React-related error. Common fixes:
1. Check that hooks are only called at the top level of components
2. Ensure dependencies in useEffect are correct
3. Verify component names start with uppercase
4. Check for invalid hook calls in conditionals
Search: "${query}"`,

    typescript: `This is a TypeScript error. Common fixes:
1. Verify the type matches what's expected
2. Check import statements for correct types
3. Ensure all required properties are provided
4. Use type assertions carefully (as const)
Search: "${query}"`,

    build: `This is a build error. Common fixes:
1. Check that all imports use correct file paths
2. Verify node_modules is installed (npm install / pnpm install)
3. Clear build cache (rm -rf .next/build or dist/)
4. Check for syntax errors in modified files
Search: "${query}"`,

    network: `This is a network error. Common fixes:
1. Check CORS headers on the API endpoint
2. Verify the API endpoint is accessible
3. Check network tab in DevTools for the actual error
4. Ensure request headers are correct (auth, content-type)
Search: "${query}"`,

    runtime: `This is a runtime error. Common fixes:
1. Check that variables are defined before use
2. Verify array/object access is safe
3. Add null/undefined checks
4. Check browser console for actual error
Search: "${query}"`,

    unknown: `Unable to categorize this error. General debugging steps:
1. Check the browser console for more details
2. Search the error message online
3. Check if this is a known issue in your dependencies
4. Try restarting the development server
Search: "${query}"`,
  }

  return solutions[category] || solutions['unknown']
}

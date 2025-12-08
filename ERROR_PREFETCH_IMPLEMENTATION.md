# Error Prefetch Feature Implementation

## Overview

The error-prefetch feature automatically detects errors from console logs and provides prefetched solutions using cached error patterns and AI-powered search.

## Architecture

### Core Files

#### 1. **Utils: `utils/errorSolutions.ts`**
Error pattern matching and solution caching utility.

**Key Functions:**
- `parseError(message)` - Parses error message and identifies category
- `cacheSolution(errorMessage, solution, query)` - Caches solution in memory and localStorage
- `getCachedSolution(errorMessage)` - Retrieves cached solution
- `generateSearchQuery(errorMessage)` - Generates search query for error
- `createErrorDebouncer(delayMs)` - Creates debouncer to avoid error spam
- `getErrorIcon(category)` - Returns emoji icon for error category
- `isCriticalError(category)` - Determines if error blocks execution

**Error Categories:**
- `react` - React-specific errors (hooks, refs, rendering)
- `typescript` - TypeScript compilation errors
- `build` - Build/module resolution errors
- `network` - Network/CORS/API errors
- `runtime` - JavaScript runtime errors
- `unknown` - Unclassified errors

**Error Patterns Detected:**
- Invalid hook calls
- Cannot read properties of undefined/null
- Maximum update depth exceeded
- Type mismatches
- Property does not exist
- Module not found
- Failed to compile
- CORS errors
- Network request failures
- HTTP errors (404/500/502/503)
- Reference errors

#### 2. **Hook: `hooks/useErrorPrefetch.ts`**
React hook that intercepts console.error and console.warn, detects errors, and manages solutions.

**Features:**
- Intercepts console.error and console.warn
- Debounces errors to prevent spam (default 500ms)
- Checks cache for instant solution retrieval
- Auto-searches for new errors (optional)
- Maintains error history (max 50 by default)
- Calls callbacks on error detection and solution found

**Options:**
```typescript
interface UseErrorPrefetchOptions {
  onErrorDetected?: (error: DetectedError) => void
  onSolutionFound?: (error: DetectedError) => void
  debounceMs?: number  // Default: 500
  enableAutoSearch?: boolean  // Default: true
  maxCachedErrors?: number  // Default: 50
}
```

**Returns:**
```typescript
{
  errors: DetectedError[]
  isSearching: boolean
  clearErrors: () => void
  removeError: (errorId: string) => void
  searchForSolution: (errorId: string) => void
}
```

#### 3. **Component: `components/ErrorSolutionBadge.tsx`**
Badge component for individual errors with collapsible solution details.

**Features:**
- Shows error icon and category
- Displays solution status (available, searching, none)
- Expandable to show full solution
- Action buttons for web search and dismissal
- Styled with Tailwind CSS

**Props:**
```typescript
interface ErrorSolutionBadgeProps {
  error: DetectedError
  onRemove?: (errorId: string) => void
  onSearch?: (errorId: string) => void
}
```

#### 4. **Component: `components/ErrorSolutionPanel.tsx`**
Full-screen panel showing all detected errors and their solutions.

**Features:**
- Displays error list with categorization
- Shows critical vs warning errors
- Solution count indicator
- Footer with statistics
- Slide-up animation
- Responsive design for mobile
- Clear all button
- Individual error dismissal

**Props:**
```typescript
interface ErrorSolutionPanelProps {
  errors: DetectedError[]
  isVisible: boolean
  onToggle?: () => void
  onRemoveError?: (errorId: string) => void
  onSearchForSolution?: (errorId: string) => void
  onClearAll?: () => void
}
```

#### 5. **Integration: `App.tsx` modifications**

**Imports added:**
```typescript
import { useErrorPrefetch } from './hooks/useErrorPrefetch'
import { ErrorSolutionPanel } from './components/ErrorSolutionPanel'
```

**Hook initialization:**
```typescript
const [errorPanelVisible, setErrorPanelVisible] = useState(false)
const { errors, isSearching, clearErrors, removeError, searchForSolution } = useErrorPrefetch({
  onErrorDetected: (error) => {
    // Auto-show panel on critical errors
    if (error.isCritical) {
      setErrorPanelVisible(true)
    }
  },
  enableAutoSearch: true,
  debounceMs: 1000,
})
```

**UI Components added:**
- `<ErrorSolutionPanel>` - Main error display panel
- Error badge button in top-right - Quick toggle to error panel

## Data Flow

### Error Detection Flow

```
1. User makes mistake or error occurs in app
2. console.error() is called
3. useErrorPrefetch intercepts the call
4. parseError() identifies error category
5. getCachedSolution() checks for existing solution
6. If no cache, generateSearchQuery() creates search terms
7. performSearch() calls solution generation (AI or knowledge base)
8. cacheSolution() saves solution to memory + localStorage
9. UI components display error with solution badge
10. User can expand, search web, or dismiss
```

### Caching Strategy

**Two-level caching:**
1. **Memory Cache** - Fast access during session, Map<errorKey, CachedSolution>
2. **localStorage** - Persistence across sessions, key format: `error_solution_${errorKey}`

**Error Key Generation:**
- Sanitizes error message (removes line numbers, file paths)
- Creates base64 hash of first 100 chars
- Deterministic - same error always gets same key

## Features

### Auto-Detection
- Monitors console.error and console.warn
- Debounced to prevent duplicate processing
- Categories errors automatically
- Critical errors auto-open the panel

### Solution Retrieval
- Instant retrieval from cache
- Graceful fallback with suggested solutions
- Search query generation for web lookup
- Integration with Electron's external URL opener

### User Interactions
- Expand/collapse solution details
- Web search button (opens Google with error terms)
- Individual error dismissal
- Clear all errors
- Toggle error panel visibility
- Quick access badge with error count

### Visual Feedback
- Error icons by category (⚛️ React, 📘 TypeScript, etc.)
- Critical error highlighting (red)
- Warning highlighting (amber)
- Solution indicator (✓ when solved)
- Smooth animations and transitions
- Dark mode support via isDarkMode prop

## Usage Example

```typescript
// In App component
const [errorPanelVisible, setErrorPanelVisible] = useState(false)
const { errors, clearErrors, removeError, searchForSolution } = useErrorPrefetch({
  onErrorDetected: (error) => {
    console.log('New error:', error.category)
    if (error.isCritical) setErrorPanelVisible(true)
  },
  enableAutoSearch: true,
})

// Render panel
return (
  <>
    <ErrorSolutionPanel
      errors={errors}
      isVisible={errorPanelVisible}
      onToggle={() => setErrorPanelVisible(!errorPanelVisible)}
      onRemoveError={removeError}
      onSearchForSolution={searchForSolution}
      onClearAll={clearErrors}
    />
  </>
)
```

## Customization

### Adding New Error Patterns

Edit `utils/errorSolutions.ts` - `ERROR_SIGNATURES` array:

```typescript
{
  pattern: /your error pattern/i,
  category: 'category-name',
  keywords: ['keyword1', 'keyword2'],
  description: 'Description for search'
}
```

### Customizing Solutions

Edit `generateSolutionForError()` in `hooks/useErrorPrefetch.ts`:

```typescript
const solutions: Record<string, string> = {
  'your-category': `Custom solution text for this error category`
}
```

### Adjusting Timing

```typescript
// Debounce errors more aggressively
debounceMs: 2000

// Max errors to keep in history
maxCachedErrors: 100

// Disable auto-search
enableAutoSearch: false
```

## Performance Considerations

### Debouncing
- Default 500ms debounce prevents spam
- Same error within window is ignored
- Reduces unnecessary UI updates

### Caching
- In-memory cache for instant retrieval
- localStorage for persistence (with error handling)
- No network calls unless auto-search enabled

### Memory Management
- Max 50 errors in history (configurable)
- Old errors automatically removed
- localStorage cleanup on `clearCache()`

## Browser Compatibility

- Modern browsers with localStorage support
- Electron environment with full API access
- Graceful fallback if localStorage unavailable
- Tested with React 17+ and TypeScript 5+

## Future Enhancements

### Potential Improvements
1. **AI-Powered Solutions** - Integrate with Claude API for intelligent suggestions
2. **Community Database** - Crowd-sourced solutions database
3. **Stack Overflow Integration** - Auto-link to relevant SO questions
4. **GitHub Issues** - Search project issues for similar errors
5. **Analytics** - Track common errors in projects
6. **Smart Suggestions** - ML-based error/solution pairing
7. **Multi-language Support** - Solutions in different languages
8. **Error Prevention** - Predict errors before they occur
9. **Team Sharing** - Share solutions across team
10. **Custom Rules** - Per-project error handling rules

## Testing

### Manual Testing Checklist
- [ ] Error appears in console
- [ ] Badge shows in top-right with count
- [ ] Critical error auto-opens panel
- [ ] Panel displays all errors with categories
- [ ] Solution badge shows correct status
- [ ] Click to expand shows full solution
- [ ] Web search button opens correct query
- [ ] Dismiss button removes error
- [ ] Clear all clears all errors
- [ ] Solution caches for same error
- [ ] Works in both light and dark mode

### Console Commands for Testing
```javascript
// Trigger a React error
// (This would cause an error in a component)

// Trigger a network error
fetch('http://invalid.api/endpoint')
  .catch(e => console.error('API Error:', e))

// Trigger a type error
const obj = {}
console.error(obj.nonexistent.property)

// Trigger a build error (would only work during build)
import { nonexistent } from './file'

// Clear cache
import { clearCache } from './utils/errorSolutions'
clearCache()

// View all cached solutions
import { getAllCachedSolutions } from './utils/errorSolutions'
console.log(getAllCachedSolutions())
```

## Troubleshooting

### Errors Not Appearing
- Check browser console for override issues
- Verify useErrorPrefetch hook is initialized
- Check that components are mounted

### Solutions Not Caching
- Verify localStorage is enabled
- Check browser dev tools for storage errors
- Ensure error messages are consistent

### Performance Issues
- Reduce maxCachedErrors
- Increase debounceMs
- Disable enableAutoSearch

### Type Errors
- Ensure TypeScript version is 5.0+
- Verify all imports are correct
- Check React version compatibility (17+)

## License & Attribution

This feature is part of the ai-cluso project and follows the same license.

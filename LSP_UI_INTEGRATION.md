# LSP UI Integration Guide

This document explains how to integrate the LSP UI components (hover tooltips, autocomplete, and go-to-definition) into your application.

## Components Created

### 1. `hooks/useElectronLSP.ts`
Low-level hook for LSP backend communication. Provides methods for:
- `hover()` - Get type information at a position
- `completion()` - Get autocomplete suggestions
- `definition()` - Go to definition
- `references()` - Find all references
- `getDiagnostics()` - Get errors/warnings
- `fileSaved()` / `fileChanged()` - Notify LSP of file changes
- `init()` / `shutdown()` - Manage LSP lifecycle
- `onEvent()` - Subscribe to LSP events
- `debounce()` - Utility for debouncing requests

### 2. `hooks/useLSPUI.ts`
High-level UI management hook. Coordinates:
- Hover tooltip state and debouncing
- Autocomplete popup state and filtering
- Go-to-definition navigation
- Caching of hover and completion results

### 3. `components/HoverTooltip.tsx`
Visual component for displaying hover information:
- Type information and documentation
- Syntax-highlighted code examples
- Auto-positioning with overflow handling
- Smooth fade in/out animations

### 4. `components/AutocompletePopup.tsx`
Visual component for completion suggestions:
- Keyboard navigation (↑/↓ for navigation, Enter to select, Esc to dismiss)
- Symbol type icons (function, variable, class, etc.)
- Filtering as user types
- Virtual scrolling support for long lists
- Selected item highlighting

## Basic Usage Example

```tsx
import React from 'react'
import { useLSPUI } from './hooks/useLSPUI'
import { HoverTooltip } from './components/HoverTooltip'
import { AutocompletePopup } from './components/AutocompletePopup'

export function CodeEditor() {
  const { uiState, showHover, hideHover, showAutocomplete, selectCompletion } =
    useLSPUI('/path/to/file.ts')

  // Mouse move handler for hover
  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e
    // Calculate line/character from editor coordinates
    const line = Math.floor(e.currentTarget.scrollTop / 20) // Approximate
    const character = Math.floor((clientX - 50) / 8) // Approximate

    showHover(clientX, clientY, line, character)
  }

  // Key down handler for autocomplete
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && uiState.autocomplete.isVisible) {
      const { items, filterText } = uiState.autocomplete
      // Handle selection
    }
  }

  return (
    <div onMouseMove={handleMouseMove} onMouseLeave={hideHover}>
      <textarea onKeyDown={handleKeyDown} />

      {/* Render LSP UI overlays */}
      <HoverTooltip
        data={uiState.hoverTooltip.data}
        position={uiState.hoverTooltip.position}
        isVisible={uiState.hoverTooltip.isVisible}
        onDismiss={hideHover}
      />

      <AutocompletePopup
        items={uiState.autocomplete.items}
        position={uiState.autocomplete.position}
        isVisible={uiState.autocomplete.isVisible}
        filterText={uiState.autocomplete.filterText}
        onSelect={selectCompletion}
        onDismiss={() => setUIState(prev => ({...prev, autocomplete: {...prev.autocomplete, isVisible: false}}))}
      />
    </div>
  )
}
```

## Advanced Integration in App.tsx

To integrate into the existing App.tsx:

```tsx
// 1. Import the hooks and components
import { useLSPUI } from './hooks/useLSPUI'
import { HoverTooltip } from './components/HoverTooltip'
import { AutocompletePopup } from './components/AutocompletePopup'

// 2. Inside the App component
const App = () => {
  // Get current file path from active tab/state
  const currentFilePath = activeTab?.projectPath ?
    `${activeTab.projectPath}/index.ts` : undefined

  // Initialize LSP UI for current file
  const {
    uiState,
    showHover,
    hideHover,
    showAutocomplete,
    selectCompletion,
    goToDefinition,
  } = useLSPUI(currentFilePath)

  // 3. Add mouse tracking to webview
  const handleWebviewMouseMove = useCallback((e: React.MouseEvent) => {
    // Get position from event
    showHover(e.clientX, e.clientY, 0, 0)
  }, [showHover])

  // 4. Render components in JSX
  return (
    <div>
      {/* Your existing UI */}

      {/* LSP Overlays */}
      <HoverTooltip
        data={uiState.hoverTooltip.data}
        position={uiState.hoverTooltip.position}
        isVisible={uiState.hoverTooltip.isVisible}
        onDismiss={hideHover}
      />

      <AutocompletePopup
        items={uiState.autocomplete.items}
        position={uiState.autocomplete.position}
        isVisible={uiState.autocomplete.isVisible}
        filterText={uiState.autocomplete.filterText}
        onSelect={selectCompletion}
        onDismiss={hideAutocomplete}
      />
    </div>
  )
}
```

## Keyboard Shortcuts

### Hover Tooltip
- `Escape` - Close tooltip
- Mouse leave - Auto-dismiss

### Autocomplete Popup
- `↑` / `↓` - Navigate suggestions
- `Enter` - Select highlighted item
- `Escape` - Close popup
- Any character - Filter suggestions

### Go-to-Definition
- `Cmd+Click` (Mac) or `Ctrl+Click` (Windows/Linux) - Jump to definition

## LSP Server Support

The LSP backend supports these language servers:
- TypeScript/JavaScript (tsserver)
- Python (pylsp)
- Rust (rust-analyzer)
- Go (gopls)
- And many more...

Language servers are automatically installed and managed by the LSP backend.

## Styling

### Dark Theme (Default)
Components use Tailwind CSS with dark theme colors:
- Background: `bg-gray-900`
- Border: `border-gray-700`
- Text: `text-gray-100` to `text-gray-300`
- Accent: `text-amber-400` / `text-amber-500`

### Customization

To customize styling, edit the Tailwind classes in:
- `components/HoverTooltip.tsx` - Tooltip styling
- `components/AutocompletePopup.tsx` - Popup styling

## Performance Considerations

1. **Debouncing**: Hover requests are debounced at 200ms (standard for editors)
2. **Caching**: Both hover and completion results are cached per file position
3. **Virtual Scrolling**: Autocomplete supports scrolling for long lists
4. **Lazy Loading**: Components only render when visible (isVisible prop)

## Troubleshooting

### Hover not working
- Check that LSP is initialized: `window.electronAPI?.lsp?.init(projectPath)`
- Verify file path is correct and absolute
- Check browser console for errors from `useElectronLSP`

### Autocomplete empty
- LSP server may not be installed for language
- Try using `window.electronAPI?.lsp?.installServer(serverId)`
- Check that file extension is recognized

### Go-to-definition not working
- Some languages may not support go-to-definition
- Try Cmd/Ctrl+Click on a type name
- Check browser console for definition result

## Integration with WebView

For integrating with the embedded webview (iframe):

```tsx
// In webview iframe
const handleCodeHover = (e: MouseEvent) => {
  // Get code position from iframe
  const pos = getCodePosition(e)

  // Send to parent window
  window.parent.postMessage({
    type: 'lsp:hover',
    position: pos,
    filePath: currentFilePath,
  }, '*')
}

// In parent window (App.tsx)
window.addEventListener('message', (e) => {
  if (e.data.type === 'lsp:hover') {
    showHover(
      e.data.position.x,
      e.data.position.y,
      e.data.position.line,
      e.data.position.character
    )
  }
})
```

## File Modification Tracking

Keep LSP in sync with file changes:

```tsx
const handleFileChange = useCallback(async (filePath: string, content: string) => {
  const lsp = useElectronLSP()
  await lsp.fileChanged(filePath, content)
}, [])

const handleFileSave = useCallback(async (filePath: string) => {
  const lsp = useElectronLSP()
  await lsp.fileSaved(filePath)
}, [])
```

## Future Enhancements

Possible additions to consider:
- Find all references UI with results list
- Go back/forward navigation history
- Rename refactoring
- Format document on save
- Diagnostics panel showing all errors/warnings
- Code folding indicators
- Breadcrumb navigation
- Quick fix suggestions from diagnostics

## References

- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
- [Hover Response](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_hover)
- [Completion Response](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_completion)
- [Definition Response](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_definition)

# Collaborative Cursor Sharing

Real-time cursor sharing between Cluso desktop app and Chrome extension, similar to Figma's multiplayer cursors.

## Architecture

```
┌─────────────────────┐     WebSocket      ┌─────────────────────┐
│ Chrome Extension    │◄──────────────────►│ Cluso Desktop App   │
│ (toolbar.ts)        │   ports 3002/3003  │ (extension-bridge)  │
└─────────────────────┘                    └─────────────────────┘
         │                                           │
         │ cursor-move                     extension:cursor-move
         ▼                                           ▼
┌─────────────────────┐                    ┌─────────────────────┐
│ service-worker.ts   │                    │ App.tsx             │
│ (forwards to Cluso) │                    │ (renders cursor)    │
└─────────────────────┘                    └─────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/chrome-extension/src/content/toolbar.ts` | Cursor tracking, element detection, remote cursor rendering |
| `packages/chrome-extension/src/background/service-worker.ts` | Forwards cursor data via WebSocket |
| `electron/extension-bridge.cjs` | WebSocket server, IPC handlers |
| `App.tsx` | Renders extension user's cursor in Cluso app |
| `types/electron.d.ts` | TypeScript interfaces for cursor data |

## Element-Anchored Positioning

The key innovation: instead of sending raw pixel coordinates (which break across different screen sizes), we detect which element the cursor is over and send the **relative position within that element**.

### How It Works

1. **Detect element under cursor**
   ```typescript
   const anchorElement = findAnchorElement(e.clientX, e.clientY)
   ```

2. **Calculate relative position (0-1)**
   ```typescript
   const rect = anchorElement.getBoundingClientRect()
   const relativeX = (e.clientX - rect.left) / rect.width  // 0.65 = 65% across
   const relativeY = (e.clientY - rect.top) / rect.height  // 0.50 = 50% down
   ```

3. **Generate unique selector**
   ```typescript
   const selector = getElementSelector(anchorElement)
   // Returns: "#submit-btn" or "button.primary.large" or "div > p:nth-of-type(2)"
   ```

4. **Receiver finds element and calculates position**
   ```typescript
   const element = document.querySelector(selector)
   const rect = element.getBoundingClientRect()
   const x = rect.left + (rect.width * relativeX)
   const y = rect.top + (rect.height * relativeY)
   ```

### Why This Works Across Breakpoints

If user A is on mobile (320px wide) pointing at the middle of a button, and user B is on desktop (1920px wide), the button might be in completely different positions. But both can find `#submit-btn` and calculate "65% across, 50% down" relative to that button's current position on their screen.

## Cursor Data Format

```typescript
interface CursorMessage {
  type: 'cursor-move'

  // Priority 1: Element-relative (most accurate)
  elementAnchor?: {
    selector: string      // CSS selector for the element
    relativeX: number     // 0-1 position within element
    relativeY: number
    elementText?: string  // First 50 chars for debugging
  }

  // Priority 2: Viewport percentage (breakpoint-aware fallback)
  viewportPercentX?: number  // 0-1 across viewport
  viewportPercentY?: number

  // Priority 3: Raw coordinates (last resort)
  pageX: number; pageY: number      // Document-relative
  clientX: number; clientY: number  // Viewport-relative

  // Context
  scrollX: number; scrollY: number
  viewportWidth: number; viewportHeight: number
  documentWidth: number; documentHeight: number
  pageUrl: string
  timestamp: number
}
```

## Element Selector Generation

Priority order in `getElementSelector()`:

1. **ID** - `#submit-btn` (unique, stable)
2. **Unique class combo** - `button.primary.large` (if only one match)
3. **Data attributes** - `button[data-testid="submit"]`
4. **Path-based** - `div > form > button:nth-of-type(2)` (fallback)

## Position Resolution Priority

When receiving a cursor position, try in order:

1. **Element-relative** - Find element by selector, calculate from relative coords
2. **Viewport percentage** - Map percentages to local viewport size
3. **Scaled coordinates** - Scale their coords by viewport ratio
4. **Direct coordinates** - Use as-is (least accurate)

## Visual Indicators

- **📍** - Cursor is anchored to a specific element
- **↓150px** - User is scrolled 150px below your position
- **↑50px** - User is scrolled 50px above your position

## Bidirectional Flow

### Extension → Cluso
1. `toolbar.ts` tracks mouse movement (throttled to 30fps)
2. Sends `cursor-move` message to `service-worker.ts`
3. Service worker forwards via WebSocket to `extension-bridge.cjs`
4. Bridge sends IPC `extension:cursor-move` to renderer
5. `App.tsx` renders cursor relative to webview bounds

### Cluso → Extension
1. `App.tsx` tracks mouse movement when sharing enabled
2. Sends via `window.electronAPI.extensionBridge.sendCursor()`
3. `extension-bridge.cjs` sends `remote-cursor` via WebSocket
4. `service-worker.ts` forwards to all tabs
5. `toolbar.ts` renders remote cursor

## Pending Work

### Keyframe Animation Interpolation
The foundation is in place:
- Timestamps included in messages
- `cursorKeyframes` Map stores last 5 positions per user
- TODO: Implement smooth interpolation between keyframes

```typescript
// Stored but not yet used for animation
const cursorKeyframes = new Map<string, { x: number; y: number; timestamp: number }[]>()
```

### Potential Improvements
- [ ] Animate between keyframes for smoother movement
- [ ] Handle page navigation (clear cursors on URL change)
- [ ] Add cursor timeout (hide if no updates for N seconds)
- [ ] Support multiple cursors from different extension users
- [ ] Add click/highlight effects when users interact

## Testing

1. Start Cluso desktop app
2. Load extension in Chrome
3. Navigate to same page in both
4. Click Share button in extension toolbar
5. Move cursor in extension - should appear in Cluso
6. Move cursor in Cluso - should appear in extension
7. Look for 📍 when hovering over identifiable elements

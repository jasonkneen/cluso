# Patch Approval UI - Implementation Guide

## Overview

The Patch Approval UI provides a visual interface for reviewing and approving code changes before they're applied. It includes:

- **Side-by-side diff visualization** with syntax highlighting
- **Inline diff view** with added/removed lines highlighted
- **Keyboard shortcuts** for quick approval/rejection
- **Adaptive learning** to predict user preferences over time
- **Batch patch handling** with patch counter

## Features

### 1. Visual Diff Display

The dialog shows:
- File path and change summary
- Before/after code with syntax highlighting (using Shiki)
- Patch counter when multiple patches are pending
- File size and lines changed information

### 2. Approval Actions

**Buttons:**
- **Accept** (⌘Y / Ctrl+Y) - Approve the patch and move to next
- **Reject** (⌘N / Ctrl+N) - Reject the patch and remove it
- **Edit** (⌘E / Ctrl+E) - Request manual editing of the patch
- **ESC** - Quick rejection with Escape key

### 3. Adaptive Learning

The system tracks user decisions:

```typescript
// Records a decision for pattern learning
recordApprovalDecision(
  projectPath,
  filePath,
  'accept', // or 'reject' | 'edit'
  changeType // optional: 'style', 'text', 'src', etc.
)

// Gets approval patterns for a project
const patterns = getApprovalPatterns(projectPath)
// Returns: { acceptRatio: 0.8, recentDecisions: [...], ... }

// Suggests next action based on history
const suggestion = suggestApprovalAction(projectPath, changeType)
// Returns: { action: 'accept' | 'reject' | 'manual', confidence: 0-1 }
```

## Usage Example

### In App.tsx

```typescript
// State management is already integrated:
const [pendingPatches, setPendingPatches] = useState<SourcePatch[]>([])
const [currentPatchIndex, setCurrentPatchIndex] = useState(0)
const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)

// To show approval dialog with patches:
showPatchApprovalDialog(patches)

// Handlers are already configured:
<PatchApprovalDialog
  patch={pendingPatches[currentPatchIndex] || null}
  onApprove={handleApprovePatch}
  onReject={handleRejectPatch}
  onEdit={handleEditPatch}
  projectPath={activeTab?.projectPath || 'default'}
  isOpen={isApprovalDialogOpen}
  totalPatches={pendingPatches.length}
  currentPatchIndex={currentPatchIndex}
/>
```

### Creating Sample Patches

```typescript
const samplePatches: SourcePatch[] = [
  {
    filePath: '/src/components/Button.tsx',
    originalContent: `const Button = () => {
  return <button>Click me</button>
}`,
    patchedContent: `const Button = () => {
  return <button className="bg-blue-500">Click me</button>
}`,
    lineNumber: 1,
    generatedBy: 'gemini',
    durationMs: 245
  },
  {
    filePath: '/src/styles.css',
    originalContent: `.button { color: black; }`,
    patchedContent: `.button { color: white; background: blue; }`,
    lineNumber: 1,
    generatedBy: 'fast-path',
    durationMs: 12
  }
]

showPatchApprovalDialog(samplePatches)
```

## File Structure

```
components/
├── PatchApprovalDialog.tsx          # Main approval UI component
│   ├── SideBySideDiff              # Side-by-side diff view
│   └── InlineDiff                  # Inline diff view with highlighting

utils/
├── patchApprovalUtils.ts           # Diff generation and learning utilities
│   ├── generateDiff()              # Create diff from before/after
│   ├── recordApprovalDecision()    # Track user decisions
│   ├── getApprovalPatterns()       # Get project learning data
│   └── suggestApprovalAction()     # ML-based action prediction
├── getFileLanguage.ts              # Language detection for syntax highlighting
└── generateSourcePatch.ts          # SourcePatch interface (existing)

types.ts
├── PatchApprovalState              # Dialog state
├── SourcePatch                     # Patch data structure
└── AppState                        # Includes patch approval state
```

## Keyboard Shortcuts

| Shortcut | Action | Notes |
|----------|--------|-------|
| ⌘Y / Ctrl+Y | Accept | Approve patch, move to next |
| ⌘N / Ctrl+N | Reject | Reject patch, remove it |
| ⌘E / Ctrl+E | Edit | Request manual editing |
| ESC | Reject | Quick rejection |

## Adaptive Learning Storage

Decisions are stored per project in localStorage:

```typescript
// Storage key format:
const storageKey = `patch-decisions-${projectPath}`

// Data structure:
interface PatchApprovalDecision {
  filePath: string
  timestamp: number
  decision: 'accept' | 'reject' | 'edit'
  changeType?: string
}

// Example statistics:
{
  totalDecisions: 42,
  accepted: 34,      // 80.9%
  rejected: 6,       // 14.3%
  edited: 2,         // 4.8%
  acceptRatio: 0.809,
  changeTypeStats: {
    style: { accept: 28, reject: 2, edit: 0 },
    text: { accept: 4, reject: 3, edit: 1 },
    src: { accept: 2, reject: 1, edit: 1 }
  }
}
```

## Syntax Highlighting

Supported languages include:

**Web:** JavaScript, TypeScript, React JSX/TSX, HTML, CSS, SCSS, Less, JSON, YAML
**Backend:** Python, Go, Rust, Java, C/C++, PHP, Ruby, Kotlin, Scala
**Config:** Dockerfile, Makefile, CMake, Shell, Gradle, Maven
**Data:** SQL, XML, TOML, INI, Protobuf, GraphQL

Language detection is automatic based on file extension.

## Integration Points

### With Code Generation

When your AI generation tool produces patches:

```typescript
const patches = await generateSourcePatches(element, cssChanges)
showPatchApprovalDialog(patches)
```

### With File Save

After user approves:

```typescript
for (const patch of approvedPatches) {
  await writeFile(patch.filePath, patch.patchedContent)
  recordApprovalDecision(projectPath, patch.filePath, 'accept')
}
```

### With Undo

Track approved/rejected patches for undo:

```typescript
const patchHistory = getApprovalPatterns(projectPath).decisions
const lastApproved = patchHistory
  .filter(d => d.decision === 'accept')
  .pop()
```

## Next Steps

1. **Connect to Code Generation**: Update your patch generation code to call `showPatchApprovalDialog()`
2. **Implement Edit Handler**: Add editor opening when user clicks Edit
3. **Add File Operations**: Implement writing approved patches to disk
4. **Enhance Learning**: Use `suggestApprovalAction()` to auto-approve low-risk patches
5. **Add Batch Operations**: Allow approving/rejecting multiple patches at once

## Performance Considerations

- **Diff generation**: Uses `diff-match-patch` library (O(n log n) with cleanup)
- **Syntax highlighting**: Uses Shiki (syntax highlighting from VS Code)
- **localStorage**: Keeps last 100 decisions per project
- **Dialog rendering**: Smooth animations with CSS transitions
- **Memory**: Large files (>100KB) may need virtualization

## Browser Compatibility

- Modern browsers with ES2020 support
- localStorage API required for learning features
- Web Workers for diff generation (optional optimization)

## Troubleshooting

### Dialog not appearing
- Check `isApprovalDialogOpen` state
- Verify `pendingPatches` is not empty
- Ensure `PatchApprovalDialog` component is rendered

### Keyboard shortcuts not working
- Dialog must have focus
- Check for conflicting app shortcuts
- Verify keyboard event listeners are registered

### Language not recognized
- Check `getFileLanguage()` for extension
- Falls back to 'plaintext' if not found
- Add custom extensions in `extensionMap`

### Learning not working
- Verify localStorage is enabled
- Check `projectPath` is consistent
- Use `getApprovalStats()` to debug decisions

## Examples

See test files for complete integration examples (coming soon).

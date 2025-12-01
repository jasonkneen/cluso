# Code Analysis Summary - Quick Reference

## Key Findings at a Glance

### CRITICAL ISSUES (Fix Immediately)

#### 1. God Object: App.tsx (8,139 lines)
- Controls voice streaming, file browser, chat, UI updates, git, 5+ state managers
- Impossible to test, maintain, or reuse
- **Action:** Extract into 6+ separate modules

#### 2. useCallback Dependency Bug (useLiveGemini.ts:696)
- Missing 12 handler dependencies in connect() function
- Causes stale closures - tools receive outdated callbacks
- **Action:** Add all 12 handlers to dependency array immediately

#### 3. Excessive `any` Types (15+ instances)
- useLiveGemini.ts: `Promise<any>` for session
- useCodingAgent.ts: `(window as any).electronAPI`
- voiceLogger.ts: Triple `any` casts
- **Action:** Replace with proper TypeScript interfaces

---

## Anti-Patterns Summary

```
┌─────────────────────────────────────────────────────────┐
│ ANTI-PATTERN             │ LOCATION       │ SEVERITY     │
├──────────────────────────┼────────────────┼──────────────┤
│ God Object               │ App.tsx        │ CRITICAL     │
│ Callback Hell            │ useLiveGemini  │ HIGH         │
│ Repetitive Handlers      │ toolRouter     │ HIGH (439→200)
│ Duplicate File Ops       │ useCodingAgent │ MEDIUM (27 ln dupe)
│ Magic Numbers            │ Various        │ MEDIUM (~20)  │
│ Missing Type Defs        │ toolRouter     │ MEDIUM       │
│ Inconsistent Errors      │ Various        │ MEDIUM       │
│ Tight Electron Coupling  │ Multiple       │ MEDIUM       │
│ Naming Inconsistency     │ Handlers       │ LOW          │
└─────────────────────────────────────────────────────────┘
```

---

## Code Duplication Heat Map

### toolRouter.ts (439 lines)
```
Lines 79-411: 16 tool handlers
├─ Each handler follows identical pattern (handler check + timeout + error handling)
├─ Could reduce to ~200 lines with factory pattern
└─ Reduction: 55% (240 lines saved)
```

### useCodingAgent.ts (836 lines)
```
Lines 398-732: 9 file operation tools
├─ Identical Electron API check: `if (!electronAPI?.files?.readFile)`
├─ Identical error handling pattern (12 copies)
└─ Could reduce by ~150 lines (62% reduction)
```

### App.tsx (8,139 lines)
```
Lines 90-163: UIUpdateService logic (74 lines)
Lines 176-500: SourcePatchService logic (324 lines)
Lines 500+: Multiple business logic functions in UI component
└─ Needs complete architectural refactoring
```

---

## Type Safety Issues

### Current State
```typescript
// ❌ BEFORE: 15+ any casts bypass TypeScript
const withSession = useCallback((fn: (session: any) => void) => {
  sessionPromiseRef.current?.then(fn).catch(err => {
    debugLog.liveGemini.error('Session error:', err)
  })
}, [])

const getElectronAPI = () => {
  return (window as any).electronAPI  // Entire API untyped!
}
```

### Better Approach
```typescript
// ✓ AFTER: Full type safety
interface LiveSession {
  close(): Promise<void>
  sendRealtimeInput(data: RealtimeInput): void
  sendToolResponse(response: ToolResponse): void
}

const withSession = useCallback((fn: (session: LiveSession) => void) => {
  sessionPromiseRef.current?.then(fn).catch(err => {
    debugLog.liveGemini.error('Session error:', err)
  })
}, [])

const getElectronAPI = (): ElectronAPI => {
  if (!window.electronAPI) throw new Error('Not in Electron')
  return window.electronAPI as ElectronAPI
}
```

---

## Magic Numbers Inventory

```
useLiveGemini.ts
├─ Line 408: maxReconnectAttempts = 5 ❌
├─ Line 409: baseReconnectDelay = 1000 ❌
├─ Line 478: analyserRef.current.fftSize = 256 ❌
├─ Line 702: FPS = 1 (needs explanation) ❌
├─ Line 713-714: width = 640 (video canvas) ❌
├─ Line 721: toDataURL('image/jpeg', 0.5) ❌
├─ Line 757: setInterval(..., 50) ❌
└─ App.tsx: Repeated 640 value (not DRY)

Total: ~20 magic numbers that should be constants
```

**Solution:** Create `utils/constants.ts` with:
```typescript
export const RECONNECT_CONFIG = {
  MAX_ATTEMPTS: 5,
  BASE_DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2,
}

export const VIDEO_STREAMING = {
  FPS: 1,  // for token conservation
  CANVAS_WIDTH: 640,
  JPEG_QUALITY: 0.5,
}

export const AUDIO_CONFIG = {
  FFT_SIZE: 256,
  VISUALIZER_INTERVAL_MS: 50,
  INPUT_SAMPLE_RATE: 16000,
  OUTPUT_SAMPLE_RATE: 24000,
}
```

---

## Error Handling Inconsistency Matrix

```
┌─────────────────────┬──────────────────┬──────────────────┐
│ Tool                │ Error Format     │ Consistency      │
├─────────────────────┼──────────────────┼──────────────────┤
│ get_page_elements   │ { error: msg }   │ ✓                │
│ list_files          │ { error: msg }   │ ✓                │
│ read_file           │ { error: msg }   │ ✓                │
│ execute_code        │ { result: ... }  │ ✗ (no error fmt) │
│ click_element       │ { error: msg }   │ ✓                │
│ navigate            │ { error: msg }   │ ✓                │
│ browser_back        │ try-catch (sync) │ ✗ (unnecessary)  │
│ close_browser       │ try-catch (sync) │ ✗ (unnecessary)  │
└─────────────────────┴──────────────────┴──────────────────┘

Better: Standardize on {success, data, error} format
```

---

## React Hooks Best Practices Violations

### useCallback Missing Dependencies
```typescript
// ❌ CURRENT (useLiveGemini.ts:696)
const connect = useCallback(async () => {
  // Uses 23 external values but only lists 6 in dependency array
  // stale closure = broken tool calls
}, [cleanup, onCodeUpdate, onElementSelect, onExecuteCode, onConfirmSelection, selectedElement])
// ❌ Missing: onGetPageElements, onPatchSourceFile, onListFiles, onReadFile,
//            onClickElement, onNavigate, onScroll, onOpenItem, onOpenFile,
//            onOpenFolder, onBrowserBack, onCloseBrowser, projectFolder, currentUrl

// ✓ FIX: Add all 14 missing dependencies
const connect = useCallback(async () => {
  // ... same code ...
}, [
  cleanup,
  onCodeUpdate, onElementSelect, onExecuteCode, onConfirmSelection,
  onGetPageElements, onPatchSourceFile, onListFiles, onReadFile,
  onClickElement, onNavigate, onScroll, onOpenItem, onOpenFile,
  onOpenFolder, onBrowserBack, onCloseBrowser,
  selectedElement, projectFolder, currentUrl
])
```

**Impact:** Tool handlers pass stale callbacks to Gemini Live → element selection fails

---

## Naming Convention Audit

```
✓ GOOD
├─ Components: PascalCase (App, NewTabPage, SettingsDialog)
├─ Functions: camelCase (generateUIUpdate, startVideoStreaming)
└─ Constants: CONSTANT_CASE (TIMEOUTS, INJECTION_SCRIPT)

✗ INCONSISTENT
├─ Handler callbacks: onCodeUpdate vs selectElement vs executeCode
│  (Inconsistent 'on' prefix usage)
├─ Abbreviated variables: rafId (RequestAnimationFrame?), tabStates
├─ Function naming: generateUIUpdate (implies side effects)
│  Should be: computeUIChanges (returns computed value)
└─ withSession helper (unclear pattern - should be executeWithSession)
```

---

## Architecture Violations

### Violation 1: Business Logic in Components
```
App.tsx contains:
├─ generateUIUpdate() → Service/Hook
├─ generateSourcePatch() → Service/Hook
├─ File system operations → FileService
├─ Git operations → GitService
└─ AI SDK integration → AIService

❌ Current: All mixed into 8,139-line component
✓ Better: App.tsx = 300 lines (UI only) + Services layer
```

### Violation 2: Platform Tight Coupling
```
No abstraction for Electron
├─ useCodingAgent.ts: Direct electron API calls
├─ voiceLogger.ts: No fallback for browser mode
└─ App.tsx: Assumes window.electronAPI everywhere

❌ Result: Cannot test without Electron, cannot run in browser
✓ Solution: Adapter pattern
  ├─ FileSystemAdapter (browser + electron)
  ├─ IpcAdapter (browser + electron)
  └─ StorageAdapter (localStorage/IndexedDB)
```

---

## Refactoring Priority Roadmap

### Week 1: Safety & Foundations
```
Priority 1 (2-3 hours):
├─ Fix useCallback dependencies (useLiveGemini.ts)
├─ Extract magic numbers to constants.ts
└─ Replace `any` types with proper interfaces

Quick Wins:
├─ Create TIMEOUTS constants (already done ✓)
├─ Type ElectronAPI (types/electron.d.ts)
└─ Standardize error responses
```

### Week 2: Reduce Duplication
```
Priority 2 (4-6 hours):
├─ Refactor toolRouter (factory pattern)
├─ Extract file operation patterns
└─ Create ErrorHandler utility

Result: Reduce 439 lines → 200 lines
```

### Week 3-4: Architectural Decomposition
```
Priority 3 (10+ hours):
├─ Extract services from App.tsx
├─ Create adapter layer for Electron
└─ Split App.tsx into modules

Result: 8,139 lines → 5 modules <500 lines each
```

---

## Testing Impact Assessment

```
Current State:
├─ App.tsx: Untestable (too large, tightly coupled)
├─ useLiveGemini: Hard to test (external dependencies, no mocks)
├─ toolRouter: Can test, but requires testing 16 similar functions
└─ Overall: ~40% of code is testable

After Refactoring:
├─ Services: 90%+ testable with dependency injection
├─ Hooks: 85%+ testable with proper abstraction
├─ toolRouter: 100% testable with factory pattern
└─ Overall: ~85%+ testable
```

---

## Files to Prioritize for Review

```
CRITICAL (Fix This Week):
├─ hooks/useLiveGemini.ts ← Dependency bug
├─ utils/toolRouter.ts ← Duplication (439 lines)
└─ App.tsx ← God object

HIGH (Fix Next Week):
├─ hooks/useCodingAgent.ts ← Duplication (836 lines)
├─ utils/debug.ts ← Good patterns (keep as reference)
└─ voiceLogger.ts ← Type safety issues

MEDIUM (Refactor Later):
├─ components/SettingsDialog.tsx ← 1,775 lines
├─ components/Landing.tsx ← 816 lines
└─ electron/main.cjs ← JavaScript (consider TS migration)
```

---

## Metrics Summary

```
Code Quality Scorecard
┌────────────────────────────┬────────┬──────────┐
│ Category                   │ Score  │ Status   │
├────────────────────────────┼────────┼──────────┤
│ Type Safety                │ 4/10   │ POOR     │
│ Error Handling             │ 5/10   │ FAIR     │
│ Code Organization          │ 5/10   │ FAIR     │
│ Naming Conventions         │ 7/10   │ GOOD     │
│ DRY Principle              │ 3/10   │ POOR     │
│ Architecture               │ 6/10   │ FAIR     │
│ Testing Readiness          │ 4/10   │ POOR     │
│ Documentation              │ 6/10   │ GOOD     │
├────────────────────────────┼────────┼──────────┤
│ OVERALL                    │ 5.1/10 │ FAIR     │
└────────────────────────────┴────────┴──────────┘

Potential After Refactoring: 8/10 (GOOD)
```

---

## Action Items Checklist

- [ ] **Week 1 Day 1:** Fix useCallback dependencies in useLiveGemini.ts
- [ ] **Week 1 Day 1-2:** Create utils/constants.ts with all magic numbers
- [ ] **Week 1 Day 2-3:** Replace `any` types with proper interfaces
- [ ] **Week 1 Day 3:** Standardize error response format
- [ ] **Week 2 Day 1-2:** Refactor toolRouter with factory pattern
- [ ] **Week 2 Day 3:** Extract duplicate file operation patterns
- [ ] **Week 2 Day 4:** Create error handling utilities
- [ ] **Week 3-4:** Begin App.tsx decomposition
- [ ] **Ongoing:** Add service layer abstractions

---

**Full Detailed Analysis:** See `CODE_ANALYSIS_REPORT.md`

**Generated:** 2025-12-01
**Tool:** Code Pattern Analysis Expert

---
status: pending
priority: p1
issue_id: "002"
tags: ["code-review", "bug", "react", "closure", "patch-system"]
dependencies: []
---

# prepareDomPatch Uses Stale Closure for Project Path

## Problem Statement

**What's broken:** The `prepareDomPatch` callback is missing `activeTab` from its dependency array, causing it to potentially use stale project paths when the user switches tabs during patch generation.

**Why it matters:** Patches could be applied to the wrong project, or fail silently because the path points to a non-existent location.

**User impact:** Intermittent patch failures when users switch between projects/tabs quickly.

## Findings

### Root Cause Analysis

**Location:** `App.tsx` line 3936

```typescript
const prepareDomPatch = useCallback((
  approvalId: string,
  element: SelectedElement,
  cssChanges: Record<string, string>,
  description: string,
  undoCode: string,
  applyCode: string,
  userRequest: string,
  projectPath?: string  // ← Passed in, but from CALLER's closure
) => {
  // ... patch generation logic ...
}, [providerConfigs, selectedModel.id]); // ❌ Missing activeTab dependency!
```

### The Bug

The function is called at line 3462 with:
```typescript
prepareDomPatch(
  approvalId,
  selectedElement,
  uiResult.cssChanges,
  uiResult.description,
  storedUndoCode,
  storedApplyCode,
  userMessage.content,
  activeTab?.projectPath  // ← Uses activeTab at CALL TIME
);
```

The projectPath IS passed correctly at call time, but the callback itself has stale closures for `providerConfigs` and `selectedModel` if the user changes settings during async patch generation.

### Evidence

This is a React anti-pattern that causes:
- Stale `providerConfigs` if user changes API provider during patch gen
- Stale `selectedModel` if user switches models

### Impact

- Patch generation may use wrong AI provider/model
- Silent failures with misleading error messages
- Race conditions during async operations

## Proposed Solutions

### Solution 1: Add Missing Dependencies (Quick Fix)
**Pros:** Follows React rules of hooks
**Cons:** May cause unnecessary re-renders
**Effort:** Small (5 min)
**Risk:** Low

```typescript
}, [providerConfigs, selectedModel.id, activeTab?.projectPath]);
```

### Solution 2: Use Ref for Stable Values (Recommended)
**Pros:** No re-renders, always current values
**Cons:** Slightly more complex
**Effort:** Small (10 min)
**Risk:** Low

```typescript
const providerConfigsRef = useRef(providerConfigs);
providerConfigsRef.current = providerConfigs;

const prepareDomPatch = useCallback((...) => {
  const providerConfig = {
    modelId: selectedModelRef.current.id,
    providers: providerConfigsRef.current
  };
  // ...
}, []); // No dependencies needed - refs are always current
```

### Solution 3: Pass All Values as Parameters
**Pros:** Pure function, no closure issues
**Cons:** More parameters to pass
**Effort:** Medium (20 min)
**Risk:** Low

```typescript
const prepareDomPatch = useCallback((
  approvalId: string,
  element: SelectedElement,
  cssChanges: Record<string, string>,
  description: string,
  undoCode: string,
  applyCode: string,
  userRequest: string,
  projectPath: string | undefined,
  providerConfig: { modelId: string; providers: ProviderConfig[] }  // ← Pass explicitly
) => {
  // Use passed providerConfig instead of closure
}, []);
```

## Recommended Action

**Solution 2** - Use refs for values that change over time but need to be accessed in callbacks.

## Technical Details

**Affected files:**
- `App.tsx` lines 3882-3936 (prepareDomPatch)
- `App.tsx` lines 3458-3470 (call site)

**Components affected:**
- Patch preparation workflow
- DOM approval system

## Acceptance Criteria

- [ ] Patch generation uses current provider config, not stale closure
- [ ] Patch generation uses current model selection
- [ ] No ESLint exhaustive-deps warnings

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-01 | Issue identified during code review | React useCallback with async operations needs refs or complete deps |

## Resources

- **React Hooks FAQ:** https://react.dev/reference/react/useCallback#my-callback-uses-stale-values
- **Related code:** `App.tsx:3882-3936`

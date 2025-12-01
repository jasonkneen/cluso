---
status: pending
priority: p2
issue_id: "005"
tags: ["code-review", "performance", "caching", "source-mapping"]
dependencies: []
---

# No Caching for Source Location Lookups

## Problem Statement

**What's broken:** Every element selection triggers a new source location lookup via React Fiber inspection, even for the same element.

**Why it matters:** Source location extraction is expensive (walks Fiber tree, parses stack traces). Repeated lookups slow down the UI.

**User impact:** Lag when repeatedly selecting the same element or nearby elements.

## Findings

### Location

**`utils/source-location.ts` lines 30-61:**

```typescript
export async function getElementSourceLocation(element: Element): Promise<ElementSourceInfo | null> {
  debugLog.sourcePatch.info('[SourceLocation] Getting source for element:', element);

  // No cache check - always does full lookup!
  const source = await getSourceFromHostInstance(element);
  // ...
}
```

### Missing Cache

There's no caching of:
- Element → Source location mapping
- Fiber → Component source mapping
- File path resolutions

## Proposed Solutions

### Solution 1: WeakMap Cache (Recommended)
**Pros:** Automatic garbage collection, no memory leaks
**Cons:** Cache invalidated when element changes
**Effort:** Small (20 min)
**Risk:** Low

```typescript
const sourceCache = new WeakMap<Element, ElementSourceInfo | null>();

export async function getElementSourceLocation(element: Element): Promise<ElementSourceInfo | null> {
  // Check cache first
  if (sourceCache.has(element)) {
    return sourceCache.get(element)!;
  }

  const source = await getSourceFromHostInstance(element);
  const result = source ? formatSourceInfo(source) : null;

  // Cache the result
  sourceCache.set(element, result);
  return result;
}
```

### Solution 2: LRU Cache with TTL
**Pros:** Time-based invalidation, size limits
**Cons:** More complex, needs element identity
**Effort:** Medium (45 min)
**Risk:** Low

## Recommended Action

**Solution 1** - WeakMap cache. Simple, effective, no memory leak risk.

## Technical Details

**Affected files:**
- `utils/source-location.ts`

## Acceptance Criteria

- [ ] Repeated selection of same element is instant (<1ms)
- [ ] Cache invalidates when page navigates
- [ ] No memory leaks from cached references

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-01 | Issue identified during review | WeakMap ideal for DOM element caching |

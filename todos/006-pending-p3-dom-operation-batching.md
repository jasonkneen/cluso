---
status: pending
priority: p3
issue_id: "006"
tags: ["code-review", "performance", "dom", "reflow"]
dependencies: []
---

# DOM Operations Not Batched in Inspector

## Problem Statement

**What's broken:** Multi-element selection causes multiple layout reflows because DOM reads and writes are interleaved.

**Why it matters:** Each `getBoundingClientRect()` after a style change triggers a layout recalculation.

**User impact:** Visible lag when selecting multiple elements (5+ elements).

## Findings

### Location

**`utils/iframe-injection.ts` lines 237-275:**

```typescript
multipleMatches.forEach((element, index) => {
  element.classList.add('inspector-selected-target');     // WRITE
  const badge = createNumberBadge(index + 1);
  element.style.position = element.style.position || 'relative';  // READ-WRITE
  element.appendChild(badge);                              // WRITE
  numberBadges.push(badge);

  const summary = getElementSummary(element);              // READ
  const rect = element.getBoundingClientRect();            // TRIGGERS REFLOW!
  // ...
});
```

## Proposed Solutions

### Solution 1: Batch Reads Then Writes (Recommended)
**Pros:** Minimal reflows, clean pattern
**Cons:** Two loops instead of one
**Effort:** Small (20 min)
**Risk:** Low

```typescript
// Phase 1: Collect all data (reads only)
const elementsData = multipleMatches.map((element, index) => ({
  element,
  index,
  summary: getElementSummary(element),
  rect: element.getBoundingClientRect(),
  needsPosition: element.style.position === ''
}));

// Phase 2: Apply all changes (writes only)
elementsData.forEach(({ element, index, needsPosition }) => {
  element.classList.add('inspector-selected-target');
  if (needsPosition) {
    element.style.position = 'relative';
  }
  const badge = createNumberBadge(index + 1);
  element.appendChild(badge);
  numberBadges.push(badge);
});
```

## Technical Details

**Affected files:**
- `utils/iframe-injection.ts` lines 237-275

## Acceptance Criteria

- [ ] Selecting 10 elements causes only 1-2 reflows, not 10+
- [ ] No visible lag when selecting multiple elements

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-01 | Issue identified during review | Batch DOM reads before writes to minimize reflows |

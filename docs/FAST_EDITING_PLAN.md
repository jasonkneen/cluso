# Fast Code Editing Plan (Cluso)

## Summary

Cluso already has two strong editing paths:

1. **Source-first edits (no selector):** the agent edits files directly (via `read_file`/`write_file`) with no live page preview.
2. **Selector/inspector edits:** Cluso applies an **instant DOM preview** (`applyCode` in the webview) while **generating a source patch in parallel** (`prepareDomPatch` → `generateSourcePatch`) and only writes to disk after approval.

This plan focuses on keeping the “instant preview” feeling while making the “save to source” step fast, reliable, and measurable.

## Current Pipeline (as implemented)

### A) Source-first editing (no selector)
- User asks for code changes without selecting an element.
- The agent reads/writes files directly through tool-backed file operations.
- UX is fast for simple edits but has no “did that do what I wanted?” confirmation loop until you reload/run.

### B) Selector/inspector editing (DOM preview + source patch)
- User selects an element (inspector), providing `SelectedElement` + `sourceLocation`.
- Cluso applies a DOM mutation immediately for perceived speed.
- In parallel, Cluso generates a source patch using `generateSourcePatch` and stores it on a pending approval object.
- The app writes the patched content to disk only after the user accepts; rejection reverts DOM changes.

Key implementation details:
- `utils/source-location.ts` uses React fiber source mapping (bippy) to resolve `file` + `line`.
- `utils/generateSourcePatch.ts` already has **fast paths** for common edits (e.g., text/src/style) and validation before returning a patch.

## North-Star Metrics

Track these per edit session (at minimum in dev builds, ideally always with local-only storage):

- `preview_latency_ms`: time from user action → DOM reflects change.
- `patch_ready_latency_ms`: time from user action → “ready to save” source patch.
- `save_latency_ms`: time from accept → file written + verified.
- `patch_success_rate`: patch generated and applied cleanly / patch attempts.
- `undo_success_rate`: undo reliably returns to prior UI + source state.
- `conflict_rate`: user typed / tab switched / element changed while patch generation in-flight.

## Invariants (non-negotiables)

- **No disk writes without explicit approval** (unless the user opts into an auto-apply mode).
- Every previewable edit has a **clear undo** path (DOM and source).
- **Only one “current truth”**: once a source patch is accepted, the DOM should be consistent with that committed source (reload if needed).
- Patch generation must be **cancelable** and “latest-wins” when the user makes additional edits quickly.

## Roadmap (phased)

### Phase 0 — Instrumentation + Reliability (1–2 days)

1. Add `EditSession` telemetry timestamps (preview start/end, patch start/end, accept, reject).
2. Standardize patch lifecycle state machine:
   - `preview_applied` → `patch_generating` → `patch_ready` → (`accepted` | `rejected` | `cancelled`)
3. Make cancellation explicit and ubiquitous (when selection changes, tab changes, or a new edit supersedes the previous one).

Deliverable: a small internal dashboard/log output showing p50/p95 latencies and failure modes.

### Phase 1 — Make the “save” path fast by default (2–5 days)

**Goal:** reduce the frequency of “AI rewriting big chunks” by expanding deterministic fast-path transforms.

1. Expand `generateSourcePatch` fast paths to cover the highest-frequency inspector edits:
   - `className` changes (append/remove/toggle known tokens)
   - inline `style={{...}}` updates (merge, update one property, preserve formatting)
   - common image patterns (`<img src>`, background image, `next/image`)
2. Prefer “surgical patch” operations:
   - local snippet rewrite only (bounded context)
   - avoid rewriting entire files unless forced
3. Add a “patch confidence” indicator:
   - fast-path: high confidence (deterministic)
   - AI-generated: medium confidence with stricter validation and smaller edit window

Deliverable: patch-ready p95 noticeably drops on common UI edits.

### Phase 2 — Unify DOM + source edits into one coherent model (3–7 days)

**Goal:** one system that handles both paths (selector and no selector) consistently.

1. Introduce a shared “edit session” object:
   - `domPreview`: `{ applyCode, undoCode }`
   - `sourcePatch`: `{ filePath, originalContent, patchedContent, undoContent }`
   - `status`, `timestamps`, `elementRef` (xpath/sourceLocation snapshot)
2. Reuse the same approval UI for both:
   - source-only edits can optionally show a DOM preview (when a page is running and mapping is possible)
   - DOM preview edits always show the computed source diff before saving

Deliverable: fewer special cases; clearer UX; fewer race bugs.

### Phase 3 — Concurrency + Transactions (optional, 1–2 weeks)

**Goal:** multi-file edits feel instant without sacrificing safety.

1. Patch generation queue with bounded concurrency (e.g., 1–2 in flight).
2. Apply commits as atomic transactions:
   - write all files → verify → then mark “committed”
3. Optional: branch-per-session (“edit on a branch” mode) for larger changes.

## Implementation Sketches

### 1) EditSession state machine

Add a single model that every editing path uses, e.g.:

- `EditSession { id, kind: 'source'|'dom', preview?, patch?, status, timestamps, cancel() }`

This prevents mixing `pendingChange` vs `pendingDOMApproval` semantics and makes “latest wins” easier.

### 2) Cancellation and superseding

When the user:
- changes selected element,
- triggers another UI change,
- switches tabs/projects,

then:
- mark old session as `cancelled`,
- ensure async completions check `sessionId` before mutating state.

This is especially important for the DOM-preview pipeline because `generateSourcePatch` is async and can finish out of order.

### 3) Deterministic fast paths first

Keep pushing work out of the model:

- “Change text” → exact string replace in a local window (already partially supported)
- “Update image src” → change the closest `src=` on the relevant JSX node
- “Style change” → update one property on the closest inline style object

If the deterministic transform fails, then fall back to AI patching.

### 4) Validation gates for AI patches

For AI patching:
- keep the patch window small (bounded context lines),
- validate JSX/TS syntax as best as possible locally,
- reject patches that look like prose, partial files, or destructive rewrites.

## Recommended “First 2–3 Features” to Build

1. **Telemetry + “latest-wins” cancellation everywhere** (Phase 0).
2. **Fast-path coverage expansion** for the top inspector edits (Phase 1).
3. **Unified EditSession model** for approvals and state (Phase 2).

## Open Questions

- Should Cluso adopt an AST/LSP-based patch engine for TypeScript/JSX (beyond snippet-based transforms), or keep focusing on fast-path + bounded AI edits?
- Do you want an opt-in “auto-apply when patch is ready” mode for trusted fast-path changes (e.g., toggling a class), while keeping AI patches approval-only?


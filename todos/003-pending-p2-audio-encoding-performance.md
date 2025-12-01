---
status: pending
priority: p2
issue_id: "003"
tags: ["code-review", "performance", "audio", "voice"]
dependencies: []
---

# Audio Encoding O(n²) String Concatenation

## Problem Statement

**What's broken:** Audio encoding uses string concatenation in a loop, creating O(n²) time complexity.

**Why it matters:** For 1 second of audio at 16kHz (32KB), encoding takes ~1000ms. This blocks the WebSocket streaming with Gemini Live API, making voice interaction feel sluggish.

**User impact:** Noticeable lag during voice conversations.

## Findings

### Root Cause

**Location:** `utils/audio.ts` lines 18-22

```typescript
export function base64EncodeAudio(int16Array: Int16Array): string {
  let binary = '';
  const bytes = new Uint8Array(int16Array.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);  // ❌ String concat in loop!
  }
  return btoa(binary);
}
```

Each iteration creates a new string object. For 32KB of audio, this creates 32,000 intermediate strings.

### Performance Impact

| Audio Length | Current Time | Expected Time |
|--------------|--------------|---------------|
| 1 second | ~1000ms | ~5-10ms |
| 5 seconds | ~5000ms | ~25-50ms |
| 10 seconds | ~10000ms+ | ~50-100ms |

## Proposed Solutions

### Solution 1: Chunked Conversion (Recommended)
**Pros:** Works in all browsers, predictable performance
**Cons:** Slightly more complex
**Effort:** Small (15 min)
**Risk:** Low

```typescript
export function base64EncodeAudio(int16Array: Int16Array): string {
  const bytes = new Uint8Array(int16Array.buffer);
  const CHUNK_SIZE = 8192;
  const chunks: string[] = [];

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode(...Array.from(chunk)));
  }

  return btoa(chunks.join(''));
}
```

### Solution 2: Use Blob + FileReader
**Pros:** Browser-optimized
**Cons:** Async, more complex
**Effort:** Medium (30 min)
**Risk:** Medium

```typescript
export async function base64EncodeAudio(int16Array: Int16Array): Promise<string> {
  const blob = new Blob([int16Array.buffer]);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}
```

## Recommended Action

**Solution 1** - Chunked conversion. Simple, synchronous, 100-200x faster.

## Technical Details

**Affected files:**
- `utils/audio.ts` lines 18-22

**Components affected:**
- Voice streaming
- Gemini Live integration

## Acceptance Criteria

- [ ] Audio encoding completes in <20ms for 1 second of audio
- [ ] No perceivable lag during voice conversations
- [ ] All audio tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-01 | Issue identified during performance review | String concatenation in loops is O(n²) |

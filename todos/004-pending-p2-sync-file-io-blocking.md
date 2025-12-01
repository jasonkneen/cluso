---
status: pending
priority: p2
issue_id: "004"
tags: ["code-review", "performance", "electron", "blocking"]
dependencies: []
---

# Synchronous File I/O Blocking Electron Main Thread

## Problem Statement

**What's broken:** OAuth token operations use `readFileSync` and `writeFileSync`, blocking the entire Electron main process.

**Why it matters:** UI freezes for 10-50ms during every OAuth operation (token load, refresh, save).

**User impact:** Visible lag when authenticating or during background token refresh.

## Findings

### Locations

1. **`electron/oauth.cjs` line 107:**
   ```javascript
   if (fs.existsSync(configPath)) {
     const data = fs.readFileSync(configPath, 'utf-8')  // SYNC!
     return JSON.parse(data)
   }
   ```

2. **`electron/codex-oauth.cjs` line 65:**
   ```javascript
   fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2))  // SYNC!
   ```

### Impact

- OAuth callbacks/token refresh freeze UI for 10-50ms
- Any file write blocks ALL IPC handlers
- Cumulative effect during high-frequency operations

## Proposed Solutions

### Solution 1: Convert to Async (Recommended)
**Pros:** Non-blocking, clean pattern
**Cons:** Requires async/await throughout
**Effort:** Small (30 min)
**Risk:** Low

```javascript
// oauth.cjs
async function loadConfig() {
  const configPath = getConfigPath();
  try {
    const data = await fs.promises.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function saveConfig(config) {
  const configPath = getConfigPath();
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
}
```

## Technical Details

**Affected files:**
- `electron/oauth.cjs` lines 107, 125
- `electron/codex-oauth.cjs` lines 51, 65

## Acceptance Criteria

- [ ] No `readFileSync` or `writeFileSync` in OAuth modules
- [ ] UI remains responsive during token operations
- [ ] All OAuth flows still work correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-01 | Issue identified during performance review | Sync I/O blocks entire Electron main process |

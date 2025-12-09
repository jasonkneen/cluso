/**
 * Morph Apply/Router helpers for Electron main (Node context).
 * Avoids renderer CORS and browser bundle issues.
 */

const { ipcMain } = require('electron')

// Use built-in fetch when available (Node 18+)
const doFetch = typeof fetch === 'function' ? fetch : null

async function applyFast({ apiKey, originalCode, updateSnippet, instruction }) {
  console.log('[Morph/Main] fast-apply IPC invoked', {
    hasKey: !!apiKey,
    keyLen: apiKey ? String(apiKey).length : 0,
    originalLen: originalCode ? originalCode.length : 0,
    updateLen: updateSnippet ? updateSnippet.length : 0,
    instructionLen: instruction ? instruction.length : 0,
  })
  if (!apiKey) {
    return { success: false, error: 'MORPH_API_KEY missing' }
  }
  if (!doFetch) {
    return { success: false, error: 'fetch not available in main process' }
  }

  const payload = {
    model: 'morph-v3-fast',
    messages: [
      {
        role: 'user',
        content: `<instruction>${instruction}</instruction>\n<code>${originalCode}</code>\n<update>${updateSnippet}</update>`,
      },
    ],
  }

  try {
    const resp = await doFetch('https://api.morphllm.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    console.log('[Morph/Main] fast-apply HTTP status', resp.status)
    const text = await resp.text()
    if (!resp.ok) {
      console.warn('[Morph/Main] fast-apply HTTP error body:', text.slice(0, 500))
    }
    let data = null
    try {
      data = JSON.parse(text)
    } catch (err) {
      return { success: false, error: `Invalid JSON response: ${err}` }
    }

    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}: ${text || 'Unknown error'}` }
    }

    const merged =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.message?.content?.[0]?.text ||
      null

    if (!merged || typeof merged !== 'string') {
      return { success: false, error: 'No merged content' }
    }

    return { success: true, code: merged }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

async function selectModel({ apiKey, input, provider = 'anthropic' }) {
  console.log('[Morph/Main] select-model IPC invoked', {
    hasKey: !!apiKey,
    keyLen: apiKey ? String(apiKey).length : 0,
    inputLen: input ? input.length : 0,
    provider,
  })
  if (!apiKey) {
    return { success: false, error: 'MORPH_API_KEY missing' }
  }
  try {
    const { MorphClient } = await import('@morphllm/morphsdk')
    const morph = new MorphClient({ apiKey })
    const router = morph.routers?.[provider]
    if (!router?.selectModel) {
      return { success: false, error: `Router for provider ${provider} not available` }
    }
    const result = await router.selectModel({ input })
    console.log('[Morph/Main] select-model result', result)
    if (result?.model) {
      return { success: true, model: result.model }
    }
    return { success: false, error: 'No model returned' }
  } catch (error) {
    console.warn('[Morph/Main] select-model exception', error)
    return { success: false, error: String(error) }
  }
}

function registerMorphHandlers() {
  ipcMain.handle('morph:fast-apply', async (_event, payload) => {
    return applyFast(payload || {})
  })

  ipcMain.handle('morph:select-model', async (_event, payload) => {
    return selectModel(payload || {})
  })
}

module.exports = {
  registerMorphHandlers,
  applyFast,
  selectModel,
}

/**
 * Source Patch Generator
 *
 * Generates source code patches for UI changes detected via the inspector.
 * Supports multiple strategies:
 * - Fast Path: Direct string manipulation for simple CSS/text/src changes
 * - Fast Apply: Local LLM inference (Pro feature)
 * - AI SDK: Uses configured provider (Claude/OpenAI/etc) via existing streaming connection
 */

import { SelectedElement } from '../types'
import { ProviderConfig } from '../hooks/useAIChat'

// Result of a successful patch generation
export interface SourcePatch {
  filePath: string
  originalContent: string
  patchedContent: string
  lineNumber: number
  // Metadata about how the patch was generated
  generatedBy?: 'fast-apply' | 'gemini' | 'fast-path'
  durationMs?: number
}

// Input parameters for patch generation
export interface GenerateSourcePatchParams {
  element: SelectedElement
  cssChanges: Record<string, string>
  providerConfig: { modelId: string; providers: ProviderConfig[] }
  projectPath?: string
  userRequest?: string
  textChange?: { oldText: string; newText: string }
  srcChange?: { oldSrc: string; newSrc: string }
  disableFastApply?: boolean
  morphApiKey?: string
}

/**
 * Use Morph Fast Apply (morph-v3-fast) to merge edits server-side.
 * Falls back to null on any failure so the caller can continue with other strategies.
 */
async function morphFastApplyMerge(
  originalCode: string,
  updateSnippet: string,
  instruction: string,
  apiKeyOverride?: string
): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const apiKey =
      apiKeyOverride ||
      (window as any)?.env?.MORPH_API_KEY ||
      (typeof process !== 'undefined' ? (process as any).env?.MORPH_API_KEY : undefined)

    if (!apiKey) {
      console.log('[Morph Fast Apply] No MORPH_API_KEY set - skipping')
      return { success: false, error: 'MORPH_API_KEY missing' }
    }

    console.log('[Morph Fast Apply] Using MORPH_API_KEY (len):', String(apiKey).length)
    console.log('[Morph Fast Apply] Request summary:', {
      originalLen: originalCode.length,
      updateSnippet: updateSnippet.substring(0, 200),
      instruction: instruction.substring(0, 200),
    })

    // Prefer Electron IPC to avoid CORS
    if (window.electronAPI?.morph?.fastApply) {
      console.log('[Morph Fast Apply] Delegating to main via IPC')
      const resp = await window.electronAPI.morph.fastApply({
        apiKey,
        originalCode,
        updateSnippet,
        instruction,
      })
      if (resp?.success && resp.code) {
        return { success: true, code: resp.code }
      }
      return { success: false, error: resp?.error || 'Unknown IPC error' }
    }

    console.log('[Morph Fast Apply] IPC not available, falling back to direct fetch (may be blocked by CORS)')

    const payload = {
      model: 'morph-v3-fast',
      messages: [
        {
          role: 'user',
          content: `<instruction>${instruction}</instruction>\n<code>${originalCode}</code>\n<update>${updateSnippet}</update>`,
        },
      ],
    }

    const response = await fetch('https://api.morphllm.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      console.warn('[Morph Fast Apply] HTTP error:', response.status, text)
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    console.log('[Morph Fast Apply] HTTP', response.status, 'response keys:', Object.keys(data || {}))
    const merged =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.message?.content?.[0]?.text ||
      null

    if (!merged || typeof merged !== 'string') {
      console.warn('[Morph Fast Apply] No merged content returned')
      return { success: false, error: 'No merged content' }
    }

    console.log('[Morph Fast Apply] Merge success, length:', merged.length, '| preview:', merged.substring(0, 200))
    return { success: true, code: merged }
  } catch (error) {
    console.warn('[Morph Fast Apply] Exception:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Route to the best Anthropic model using Morph, if available.
 * Falls back to null on any error so callers can use their default model.
 */
async function selectMorphModel(input: string, apiKeyOverride?: string): Promise<string | null> {
  try {
    const apiKey =
      apiKeyOverride ||
      (window as any)?.env?.MORPH_API_KEY ||
      (typeof process !== 'undefined' ? (process as any).env?.MORPH_API_KEY : undefined)
    if (!apiKey) return null
    console.log('[Source Patch] Morph router input len:', input.length)

    // Prefer Electron IPC (main process). Renderer import of morphsdk is not allowed (bundle/dirname issues).
    if (window.electronAPI?.morph?.selectModel) {
      const resp = await window.electronAPI.morph.selectModel({ apiKey, input, provider: 'anthropic' })
      if (resp?.success && resp.model) {
        console.log('[Source Patch] Morph router selected model (IPC):', resp.model)
        return resp.model
      }
      console.warn('[Source Patch] Morph router IPC failed:', resp?.error)
      return null
    }

    // Fallback for web builds: dynamic import (may fail in browser)
    console.log('[Source Patch] Morph router IPC not available; attempting local import (may fail in browser)')
    const { MorphClient } = await import('@morphllm/morphsdk')
    const morph = new MorphClient({ apiKey })
    const result = await morph.routers.anthropic.selectModel({
      input,
    })
    if (result?.model) {
      console.log('[Source Patch] Morph router selected model:', result.model)
      return result.model
    }
  } catch (error) {
    console.warn('[Source Patch] Morph routing failed, using default model:', error)
  }
  return null
}

/**
 * Resolves source map paths to filesystem paths
 */
function resolveFilePath(
  filePath: string,
  projectPath?: string
): { resolved: string | null; error?: string } {
  // Path needs resolution if it's not already an absolute filesystem path
  const isAbsoluteFilesystemPath =
    filePath.startsWith('/Users/') ||
    filePath.startsWith('/home/') ||
    filePath.startsWith('/var/') ||
    /^[A-Z]:\\/.test(filePath) // Windows paths like C:\

  // Always clean up the path
  let relativePath = filePath

  // Remove localhost URL prefix if present
  const urlMatch = relativePath.match(/localhost:\d+\/(.+)$/)
  if (urlMatch) {
    relativePath = urlMatch[1]
  }

  // Remove leading slashes to get relative path
  relativePath = relativePath.replace(/^\/+/, '')

  // Remove query strings (Vite cache busting like ?t=1234567890)
  relativePath = relativePath.split('?')[0]

  console.log('[Source Patch] Cleaned path:', relativePath)

  if (!isAbsoluteFilesystemPath) {
    if (projectPath) {
      return { resolved: `${projectPath}/${relativePath}` }
    }
    return { resolved: null, error: 'No projectPath provided for relative path' }
  }

  return { resolved: filePath }
}

/**
 * Fast path for image src attribute changes
 */
function tryFastPathSrcChange(
  originalContent: string,
  sourceLine: number,
  newSrc: string
): string | null {
  console.log('[Source Patch] FAST PATH: Image src change detected')
  console.log('[Source Patch] New src:', newSrc)

  const lines = originalContent.split('\n')
  let targetLine = sourceLine
  if (targetLine > lines.length) targetLine = lines.length

  const searchRadius = 15
  const startSearch = Math.max(0, targetLine - searchRadius - 1)
  const endSearch = Math.min(lines.length, targetLine + searchRadius)

  for (let i = startSearch; i < endSearch; i++) {
    const line = lines[i]

    if (/<img\s/i.test(line) || /src\s*=/i.test(line)) {
      console.log('[Source Patch] Found potential img at line', i + 1, ':', line.substring(0, 60))

      // Pattern 1: src="..." or src='...'
      const srcQuoteMatch = line.match(/src\s*=\s*(['"])([^'"]*)\1/)
      // Pattern 2: src={...} (JSX expression)
      const srcJsxMatch = line.match(/src\s*=\s*\{([^}]*)\}/)

      if (srcQuoteMatch) {
        const quote = srcQuoteMatch[1]
        lines[i] = line.replace(srcQuoteMatch[0], `src=${quote}${newSrc}${quote}`)
        console.log('[Source Patch] Replaced quoted src attribute')
        return lines.join('\n')
      } else if (srcJsxMatch) {
        lines[i] = line.replace(srcJsxMatch[0], `src="${newSrc}"`)
        console.log('[Source Patch] Replaced JSX src expression')
        return lines.join('\n')
      }
    }
  }

  return null
}

/**
 * Fast path for text-only changes
 */
function tryFastPathTextChange(
  originalContent: string,
  oldText: string,
  newText: string
): string | null {
  console.log('[Source Patch] FAST PATH: Simple text change detected')
  console.log('[Source Patch] Old text:', oldText.substring(0, 50))
  console.log('[Source Patch] New text:', newText.substring(0, 50))

  const escapedOld = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    // JSX text content: >OldText< or >{`OldText`}< or >{oldText}<
    new RegExp(`(>\\s*)${escapedOld}(\\s*<)`, 'g'),
    // String literals in JSX: "OldText" or 'OldText'
    new RegExp(`(['"])${escapedOld}\\1`, 'g'),
    // Template literals: `OldText`
    new RegExp(`(\`)${escapedOld}(\`)`, 'g'),
  ]

  for (const pattern of patterns) {
    if (pattern.test(originalContent)) {
      const patchedContent = originalContent.replace(pattern, (match, p1, p2) => {
        console.log('[Source Patch] Found match:', match.substring(0, 50))
        return `${p1}${newText}${p2 || p1}`
      })
      if (patchedContent !== originalContent) {
        console.log('[Source Patch] FAST PATH SUCCESS - replaced text directly')
        return patchedContent
      }
    }
  }

  return null
}

/**
 * Fast path for CSS-only changes
 */
function tryFastPathCssChange(
  originalContent: string,
  sourceLine: number,
  element: SelectedElement,
  cssChanges: Record<string, string>
): string | null {
  console.log('[Source Patch] FAST PATH: CSS-only change detected')
  console.log('[Source Patch] CSS changes:', cssChanges)

  const lines = originalContent.split('\n')
  let targetLine = sourceLine
  if (targetLine > lines.length) targetLine = lines.length

  const styleEntries = Object.entries(cssChanges)
    .map(([prop, val]) => `${prop}: '${val}'`)
    .join(', ')
  const styleObjStr = `{ ${styleEntries} }`

  const searchRadius = 30
  const startSearch = Math.max(0, targetLine - searchRadius - 1)
  const endSearch = Math.min(lines.length, targetLine + searchRadius)

  const tagName = element.tagName?.toLowerCase()
  const className = element.className?.split(' ')[0]
  const elementId = element.id

  console.log('[Source Patch] CSS Fast Path searching for:')
  console.log('[Source Patch]   tagName:', tagName)
  console.log('[Source Patch]   className:', className)
  console.log('[Source Patch]   targetLine:', targetLine)
  console.log('[Source Patch]   searchRange:', startSearch + 1, 'to', endSearch)

  // If no class/id provided, we CANNOT use fast path (too ambiguous)
  if (!className && !elementId) {
    console.log('[Source Patch] No class or id - skipping fast path (too ambiguous)')
    return null
  }

  for (let i = startSearch; i < endSearch; i++) {
    const line = lines[i]

    const tagPattern = new RegExp(`<${tagName}[\\s>]`, 'i')
    const classPattern = className ? new RegExp(`className=["'\`][^"'\`]*\\b${className}\\b`) : null
    const idPattern = elementId ? new RegExp(`id=["'\`]${elementId}["'\`]`) : null

    const hasTag = tagPattern.test(line)
    const hasClass = classPattern && classPattern.test(line)
    const hasId = idPattern && idPattern.test(line)

    const isMatch = (hasTag && hasClass) || (hasTag && hasId) || (hasId && !hasTag)

    if (isMatch) {
      console.log('[Source Patch] Found element at line', i + 1, ':', line.substring(0, 60))

      const styleExistsMatch = line.match(/style=\{(\{[^}]*\})\}/)
      const styleStringMatch = line.match(/style="([^"]*)"/)

      if (styleExistsMatch) {
        const existingStyle = styleExistsMatch[1]
        const newEntries = Object.entries(cssChanges)
          .filter(([prop]) => !existingStyle.includes(prop))
          .map(([prop, val]) => `${prop}: '${val}'`)
          .join(', ')

        if (newEntries) {
          const mergedStyle = existingStyle.replace(/\s*\}$/, '') + ', ' + newEntries + ' }'
          lines[i] = line.replace(styleExistsMatch[0], `style={${mergedStyle}}`)
          console.log('[Source Patch] Merged into existing style prop')
          return lines.join('\n')
        } else {
          console.log('[Source Patch] Style properties already exist - no change needed')
          return originalContent // No change needed
        }
      } else if (styleStringMatch) {
        const existingCss = styleStringMatch[1]
        const existingEntries = existingCss
          .split(';')
          .filter(s => s.trim())
          .map(s => {
            const [prop, val] = s.split(':').map(x => x.trim())
            const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
            return `${camelProp}: '${val}'`
          })
          .join(', ')
        const mergedStyle = existingEntries ? `{ ${existingEntries}, ${styleEntries} }` : styleObjStr
        lines[i] = line.replace(styleStringMatch[0], `style={${mergedStyle}}`)
        console.log('[Source Patch] Converted string style and merged')
        return lines.join('\n')
      } else {
        const insertMatch = line.match(new RegExp(`(<${tagName})([\\s>])`, 'i'))
        if (insertMatch) {
          lines[i] = line.replace(
            insertMatch[0],
            `${insertMatch[1]} style={${styleObjStr}}${insertMatch[2]}`
          )
          console.log('[Source Patch] Added new style prop')
          return lines.join('\n')
        }
      }
    }
  }

  return null
}

/**
 * Try Fast Apply (local LLM) for code modification
 */
async function tryFastApply(
  codeSnippet: string,
  element: SelectedElement,
  cssChanges: Record<string, string>,
  userRequest?: string,
  targetLineInSnippet?: number // 1-indexed line number within the snippet
  ): Promise<{ success: boolean; code?: string; durationMs?: number; error?: string }> {
  if (!window.electronAPI?.fastApply) {
    return { success: false, error: 'Fast Apply not available' }
  }

  try {
    console.log('[Source Patch] Checking Fast Apply availability...')
    const fastApplyStatus = await window.electronAPI.fastApply.getStatus()

    if (!fastApplyStatus.activeModel) {
      return { success: false, error: 'No model selected' }
    }

    console.log('[Source Patch] Fast Apply has active model:', fastApplyStatus.activeModel)

  const hasCssChanges = Object.keys(cssChanges).length > 0
  const isRemoveRequest = userRequest && /(?:remove|delete|hide)\s+(?:this|that|it|the|element)?/i.test(userRequest)

  let updateDescription = ''
  const lineHint = targetLineInSnippet ? ` at or near line ${targetLineInSnippet}` : ''
  const tagHint = element.tagName ? element.tagName.toLowerCase() : ''
  const classHint = element.className ? element.className.split(' ')[0] : ''
  const idHint = element.id || ''
  const textHint = element.text ? element.text.substring(0, 60) : ''
  const targetDescriptorParts = [
    tagHint ? `tag <${tagHint}>` : null,
    classHint ? `class "${classHint}"` : null,
    idHint ? `id "${idHint}"` : null,
    textHint ? `text "${textHint}"` : null,
  ].filter(Boolean)
  const targetDescriptor = targetDescriptorParts.length ? ` Target element: ${targetDescriptorParts.join(', ')}${lineHint}` : lineHint

  // Describe the change with line number hint for the model
  if (isRemoveRequest) {
    updateDescription = userRequest || `Remove the element${targetDescriptor} by wrapping with {false && ...}`
  } else if (hasCssChanges) {
    const styleDesc = Object.entries(cssChanges)
      .map(([prop, val]) => `${prop}: '${val}'`)
      .join(', ')
    updateDescription = `Add style={{ ${styleDesc} }} to the JSX element${targetDescriptor}`
  } else {
    updateDescription = `${userRequest || ''}${targetDescriptor ? `\n${targetDescriptor}` : ''}`.trim()
  }

    const fastResult = await window.electronAPI.fastApply.apply(codeSnippet, updateDescription)

    if (!fastResult.success || !fastResult.code) {
      return { success: false, error: fastResult.error || 'Unknown error' }
    }

    // Validate that Fast Apply returned actual code, not prose explanation
    const proseIndicators = [
      /^The provided/i,
      /^I cannot/i,
      /^I apologize/i,
      /^Unfortunately/i,
      /^This (code|update|change)/i,
      /^Here'?s (how|an example)/i,
      /does not make sense/i,
      /is not (a )?valid/i,
      /you (should|can|need to)/i,
    ]

  const firstLine = fastResult.code.trim().split('\n')[0]
  const isProse = proseIndicators.some(p => p.test(firstLine))

  if (isProse) {
    console.log('[Source Patch] Fast Apply returned PROSE instead of code - rejecting')
    return { success: false, error: 'Model returned prose instead of code' }
  }

  const missingTarget =
    (!!tagHint && !new RegExp(`<${tagHint}[\\s>]`, 'i').test(fastResult.code)) ||
    (!!classHint && !new RegExp(`class(Name)?=["'\`][^"'\`]*\\b${classHint}\\b`).test(fastResult.code)) ||
    (!!idHint && !new RegExp(`id=["'\`]${idHint}["'\`]`).test(fastResult.code))

  if (missingTarget) {
    console.log('[Source Patch] Fast Apply response missing target element hints - rejecting')
    return { success: false, error: 'Model output did not include the targeted element' }
  }

  return {
    success: true,
    code: fastResult.code,
    durationMs: fastResult.durationMs,
  }
  } catch (error) {
    console.log('[Source Patch] Fast Apply error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Use AI SDK for complex code modifications
 * Uses the configured provider (Claude Haiku, etc.) via the existing streaming connection
 */
async function useAIForPatch(
  codeSnippet: string,
  element: SelectedElement,
  cssChanges: Record<string, string>,
  providerConfig: { modelId: string; providers: ProviderConfig[] },
  sourceFile: string,
  targetLine: number,
  startLine: number,
  endLine: number,
  userRequest?: string,
  disableFastApply?: boolean,
  apiKeyOverride?: string
): Promise<string | null> {
  // Check if AI SDK is available
  if (!window.electronAPI?.aiSdk?.generate) {
    console.log('[Source Patch] AI SDK generate not available')
    return null
  }

  const hasCssChanges = Object.keys(cssChanges).length > 0
  const morphModel = disableFastApply ? await selectMorphModel(userRequest || codeSnippet, apiKeyOverride) : null
  const effectiveModelId = morphModel || providerConfig.modelId

  console.log('[Source Patch] AI SDK path using model:', effectiveModelId, '| morphModel:', morphModel || 'none', '| disableFastApply:', !!disableFastApply)

  const cssString = hasCssChanges
    ? Object.entries(cssChanges)
        .map(([prop, val]) => {
          const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
          return `${kebabProp}: ${val}`
        })
        .join('; ')
    : ''

  let changeDescription = ''
  if (hasCssChanges && userRequest) {
    changeDescription = `CSS changes to apply: ${cssString}\n\nUser's request: "${userRequest}"`
  } else if (hasCssChanges) {
    changeDescription = `CSS changes to apply: ${cssString}`
  } else if (userRequest) {
    changeDescription = `User's request: "${userRequest}"`
  } else {
    console.log('[Source Patch] No changes specified, skipping')
    return null
  }

  const lines = codeSnippet.split('\n')
  const lineNumberReliable = targetLine <= lines.length
  const searchByElement = !lineNumberReliable || element.text || element.className

  let instructions = ''
  if (searchByElement) {
    instructions = `1. SEARCH the snippet for a <${element.tagName}> element`
    if (element.text) {
      instructions += ` containing text "${element.text.substring(0, 50)}"`
    }
    if (element.className) {
      instructions += ` with class "${element.className.split(' ')[0]}"`
    }
  } else {
    instructions = `1. Find the JSX element near line ${targetLine} (should be near the middle of the snippet)`
  }

  if (hasCssChanges) {
    instructions += `
2. MODIFY the existing element's opening tag to add/merge a style prop - DO NOT create a duplicate element
3. If using Tailwind, convert to Tailwind classes where appropriate
4. The result should have the SAME NUMBER of elements - only the style prop changes`
  }
  if (userRequest) {
    const isTextChange =
      /^["'][^"']+["']$/.test(userRequest.trim()) ||
      /(?:change|set|update)\s+(?:text|label|content|title)/i.test(userRequest) ||
      /text\s*(?:to|:|=)/i.test(userRequest)
    const isRemoveRequest = /(?:remove|delete|hide)\s+(?:this|that|it|the)/i.test(userRequest)
    if (isRemoveRequest) {
      instructions += `
2. To remove/delete/hide the element, add style={{ display: 'none' }} to it
3. Or if the user wants it fully removed, wrap it in {false && <element>...</element>}`
    } else if (isTextChange || !hasCssChanges) {
      instructions += `
2. Update the text content of the element based on the user's request
3. If the request is quoted text like "New Text", use that as the new content`
    }
  }
  instructions += `
${hasCssChanges ? '5' : '3'}. Output ONLY the modified snippet (lines ${startLine + 1} to ${endLine}), no explanations
${hasCssChanges ? '6' : '4'}. Preserve exact indentation and formatting
${hasCssChanges ? '7' : '5'}. CRITICAL: Do NOT duplicate elements - modify in-place`

  const systemPrompt = `You are a React/TypeScript code modifier. Given a code snippet and requested changes, output ONLY the modified snippet. Do not include explanations, markdown code blocks, or any other text - just the raw code.`

  const userPrompt = `Source file: ${sourceFile}
${lineNumberReliable ? `Target line in original file: ${targetLine}` : '(Line number from source map may be inaccurate - search by element characteristics)'}
Snippet shows lines ${startLine + 1} to ${endLine}

Code snippet:
${codeSnippet}

Element being modified:
- Tag: ${element.tagName}
- Classes: ${element.className || 'none'}
- ID: ${element.id || 'none'}
- Current text content: ${element.text?.substring(0, 100) || 'none'}

${changeDescription}

Instructions:
${instructions}

Output the modified code snippet:`

  try {
    // Use the configured model (likely claude-haiku-4-5) via the existing connection
    const modelId = effectiveModelId || 'claude-haiku-4-5'
    console.log('[Source Patch] Calling AI SDK for code modification with model:', modelId)

    // Build provider configs for the generate call
    const providers: Record<string, string> = {}
    for (const p of providerConfig.providers) {
      if (p.apiKey) {
        providers[p.id] = p.apiKey
      }
    }

    const result = await window.electronAPI.aiSdk.generate({
      modelId,
      messages: [{ role: 'user', content: userPrompt }],
      providers,
      system: systemPrompt,
      maxSteps: 1, // Single step, no tools needed
    })

    if (!result.success || !result.text) {
      console.log('[Source Patch] AI SDK generate failed:', result.error || 'No text returned')
      return null
    }

    console.log('[Source Patch] AI SDK response received, length:', result.text.length)
    let patchedSnippet = result.text.trim()

    // Remove markdown code blocks if present
    const codeMatch = patchedSnippet.match(/```(?:tsx?|jsx?|typescript|javascript)?\s*([\s\S]*?)```/)
    if (codeMatch) {
      patchedSnippet = codeMatch[1].trim()
      console.log('[Source Patch] Extracted code from markdown block')
    }

    // Validate that AI returned actual code, not prose explanation
    const proseIndicators = [
      /^The provided/i,
      /^I cannot/i,
      /^I apologize/i,
      /^Unfortunately/i,
      /^This (code|update|change)/i,
      /^Here'?s (how|an example)/i,
      /does not make sense/i,
      /is not (a )?valid/i,
      /you (should|can|need to)/i,
    ]

    const firstLine = patchedSnippet.split('\n')[0]
    const isProse = proseIndicators.some(p => p.test(firstLine))

    if (isProse) {
      console.log('[Source Patch] AI returned PROSE instead of code - aborting')
      console.log('[Source Patch] First line:', firstLine.substring(0, 100))
      return null
    }

    return patchedSnippet
  } catch (error) {
    console.error('[Source Patch] EXCEPTION during AI SDK generation:', error)
    return null
  }
}

/**
 * Main function to generate source code patches for UI changes
 */
export async function generateSourcePatch(
  params: GenerateSourcePatchParams
): Promise<SourcePatch | null> {
  const {
    element,
    cssChanges,
    providerConfig,
    projectPath,
    userRequest,
    textChange,
    srcChange,
    morphApiKey,
  } = params

  console.log('='.repeat(60))
  console.log('[Source Patch] === STARTING PATCH GENERATION ===')
  console.log('[Source Patch] Input:', {
    elementTag: element.tagName,
    hasSourceLocation: !!element.sourceLocation,
    sourceFile: element.sourceLocation?.sources?.[0]?.file,
    sourceLine: element.sourceLocation?.sources?.[0]?.line,
    cssChanges: Object.keys(cssChanges).length > 0 ? cssChanges : 'none',
    projectPath: projectPath || 'NOT SET',
    userRequest: userRequest?.substring(0, 50) || 'none',
    modelId: providerConfig.modelId,
    hasSrcChange: !!srcChange,
  })
  console.log('='.repeat(60))

  // Validate source location
  if (!element.sourceLocation?.sources?.[0]) {
    console.log('[Source Patch] ABORT: No source location available in element')
    console.log('[Source Patch] element.sourceLocation =', JSON.stringify(element.sourceLocation, null, 2))
    return null
  }

  const source = element.sourceLocation.sources[0]
  let filePath = source.file
  console.log('[Source Patch] Original source file:', filePath, 'line:', source.line)

  // Resolve path
  const { resolved, error: pathError } = resolveFilePath(filePath, projectPath)

  if (!resolved) {
    // Try getCwd fallback
    if (window.electronAPI?.files?.getCwd) {
      console.log('[Source Patch] No projectPath, trying getCwd fallback...')
      const cwdResult = await window.electronAPI.files.getCwd()
      console.log('[Source Patch] getCwd result:', cwdResult)
      if (cwdResult.success && cwdResult.data) {
        let relativePath = filePath
        const urlMatch = relativePath.match(/localhost:\d+\/(.+)$/)
        if (urlMatch) relativePath = urlMatch[1]
        relativePath = relativePath.replace(/^\/+/, '').split('?')[0]
        filePath = `${cwdResult.data}/${relativePath}`
        console.log('[Source Patch] Full path with CWD fallback:', filePath)
      } else {
        console.log('[Source Patch] ABORT: getCwd failed:', cwdResult.error)
        return null
      }
    } else {
      console.log('[Source Patch] ABORT:', pathError)
      return null
    }
  } else {
    filePath = resolved
    console.log('[Source Patch] Path resolved:', filePath)
  }

  // SAFETY: Prevent patching the app's own source files
  if (filePath.includes('/ai-cluso/') && !filePath.includes('/ai-cluso/website/')) {
    console.log('[Source Patch] ABORT: BLOCKED - Cannot patch app source files:', filePath)
    return null
  }

  // Read the source file
  if (!window.electronAPI?.files?.readFile) {
    console.log('[Source Patch] ABORT: File API (readFile) not available')
    return null
  }

  console.log('[Source Patch] Reading source file:', filePath)
  const fileResult = await window.electronAPI.files.readFile(filePath)
  if (!fileResult.success || !fileResult.data) {
    console.log('[Source Patch] ABORT: Failed to read source file')
    console.log('[Source Patch] Error:', fileResult.error)
    return null
  }

  console.log('[Source Patch] File read successfully, length:', fileResult.data.length)
  const originalContent = fileResult.data

  // Determine change types
  const hasCssChanges = Object.keys(cssChanges).length > 0
  const hasTextChange = textChange && textChange.oldText && textChange.newText
  const hasSrcChange = srcChange && srcChange.newSrc

  // === FAST PATH: Try direct string manipulation first ===

  // Fast path for src changes
  if (hasSrcChange && !hasCssChanges && !hasTextChange) {
    const patchedContent = tryFastPathSrcChange(originalContent, source.line, srcChange.newSrc)
    if (patchedContent && patchedContent !== originalContent) {
      console.log('[Source Patch] FAST PATH SUCCESS - replaced img src directly')
      return {
        filePath,
        originalContent,
        patchedContent,
        lineNumber: source.line,
        generatedBy: 'fast-path',
      }
    }
    console.log('[Source Patch] Src fast path failed - falling back to AI')
  }

  // Fast path for text changes
  if (hasTextChange && !hasCssChanges) {
    const patchedContent = tryFastPathTextChange(originalContent, textChange.oldText, textChange.newText)
    if (patchedContent) {
      return {
        filePath,
        originalContent,
        patchedContent,
        lineNumber: source.line,
        generatedBy: 'fast-path',
      }
    }
    console.log('[Source Patch] Text fast path failed - falling back to AI')
  }

  // Fast path for CSS changes
  if (hasCssChanges && (!textChange || !textChange.newText)) {
    const patchedContent = tryFastPathCssChange(originalContent, source.line, element, cssChanges)
    if (patchedContent && patchedContent !== originalContent) {
      console.log('[Source Patch] FAST PATH SUCCESS - modified style directly')
      return {
        filePath,
        originalContent,
        patchedContent,
        lineNumber: source.line,
        generatedBy: 'fast-path',
      }
    }
    console.log('[Source Patch] CSS fast path failed - falling back to AI')
  }

  // === AI-BASED PATCHING ===

  // Extract code snippet around target line
  const lines = originalContent.split('\n')
  let targetLine = source.line

  if (targetLine > lines.length) {
    console.log('[Source Patch] Source map line', targetLine, 'exceeds file length', lines.length)
    console.log('[Source Patch] Clamping target to end of file')
    targetLine = lines.length
  }

  // Context for Fast Apply - need enough to capture full component structure
  const fastApplyContextLines = 50 // ~100 lines total to avoid truncating JSX components
  const fastApplyStartLine = Math.max(0, targetLine - fastApplyContextLines)
  const fastApplyEndLine = Math.min(lines.length, targetLine + fastApplyContextLines)
  const fastApplySnippet = lines.slice(fastApplyStartLine, fastApplyEndLine).join('\n')

  console.log('[Source Patch] Fast Apply snippet: lines', fastApplyStartLine + 1, 'to', fastApplyEndLine, '(', fastApplySnippet.length, 'chars)')

  if (params.disableFastApply) {
    console.log('[Source Patch] Fast Apply disabled by settings - using Morph Fast Apply if available. Morph key length:', (morphApiKey || '').length)

    // Build a concise update snippet for Morph based on CSS/text/src changes or user request
    const updateSnippet = (() => {
      if (Object.keys(cssChanges).length > 0) {
        const styleDesc = Object.entries(cssChanges)
          .map(([prop, val]) => `${prop}: '${val}'`)
          .join(', ')
        return `Add style={{ ${styleDesc} }} to the matching element`
      }
      if (textChange?.newText) {
        return `Change text to "${textChange.newText}"`
      }
      if (srcChange?.newSrc) {
        return `Update src to "${srcChange.newSrc}"`
      }
      return userRequest || 'Apply requested changes'
    })()

    const morphResult = await morphFastApplyMerge(
      fastApplySnippet,
      updateSnippet,
      userRequest || updateSnippet,
      morphApiKey
    )

    if (morphResult.success && morphResult.code) {
      const patchedLines = morphResult.code.split('\n')
      const beforeLines = lines.slice(0, fastApplyStartLine)
      const afterLines = lines.slice(fastApplyEndLine)
      const fullPatchedContent = [...beforeLines, ...patchedLines, ...afterLines].join('\n')

      if (fullPatchedContent !== originalContent) {
        console.log('[Source Patch] Morph Fast Apply produced a patch')
        return {
          filePath,
          originalContent,
          patchedContent: fullPatchedContent,
          lineNumber: source.line,
          generatedBy: 'fast-apply',
        }
      }
    }

    console.log('[Source Patch] Morph Fast Apply failed or returned no changes, falling through to AI SDK (no local Fast Apply). Error:', morphResult.error)
    // Do not return; continue to AI SDK path below. Local Fast Apply remains disabled.
  } else {

  // Calculate target line within the snippet (1-indexed)
  const targetLineInSnippet = targetLine - fastApplyStartLine

  // Try Fast Apply (local LLM) first with smaller snippet
  const fastApplyResult = await tryFastApply(fastApplySnippet, element, cssChanges, userRequest, targetLineInSnippet)
  
  if (fastApplyResult.success && fastApplyResult.code) {
    console.log('[Source Patch] Fast Apply SUCCESS! Duration:', fastApplyResult.durationMs, 'ms')

    const patchedLines = fastApplyResult.code.split('\n')
    const beforeLines = lines.slice(0, fastApplyStartLine)
    const afterLines = lines.slice(fastApplyEndLine)
    const fullPatchedContent = [...beforeLines, ...patchedLines, ...afterLines].join('\n')

    if (fullPatchedContent !== originalContent) {
      console.log('='.repeat(60))
      console.log('[Source Patch] === FAST APPLY PATCH GENERATED ===')
      console.log('[Source Patch] Output:', {
        filePath,
        originalLength: originalContent.length,
        patchedLength: fullPatchedContent.length,
        lineNumber: source.line,
        durationMs: fastApplyResult.durationMs,
      })
      console.log('='.repeat(60))
      return {
        filePath,
        originalContent,
        patchedContent: fullPatchedContent,
        lineNumber: source.line,
        generatedBy: 'fast-apply',
        durationMs: fastApplyResult.durationMs,
      }
    }
    console.log('[Source Patch] Fast Apply returned unchanged content, falling back to Gemini')
  } else {
    console.log('[Source Patch] Fast Apply not available or failed:', fastApplyResult.error)
  }
  }

  // Larger context for Gemini (cloud API is faster with large inputs)
  const contextLines = 100
  const startLine = Math.max(0, targetLine - contextLines)
  const endLine = Math.min(lines.length, targetLine + contextLines)

  if (startLine >= endLine) {
    console.log('[Source Patch] ABORT: Invalid line range:', startLine, 'to', endLine)
    return null
  }

  const codeSnippet = lines.slice(startLine, endLine).join('\n')
  console.log('[Source Patch] AI SDK snippet: lines', startLine + 1, 'to', endLine, '(', codeSnippet.length, 'chars)')

  // Fall back to AI SDK (uses configured provider - Claude Haiku, etc.)
  const patchedSnippet = await useAIForPatch(
    codeSnippet,
    element,
    cssChanges,
    providerConfig,
    source.file,
    targetLine,
    startLine,
    endLine,
    userRequest,
    params.disableFastApply,
    morphApiKey
  )

  if (!patchedSnippet) {
    console.log('[Source Patch] AI SDK returned null/empty patched snippet')
    return null
  }

  // Reconstruct the full file with the patched snippet
  const patchedLines = patchedSnippet.split('\n')
  const beforeLines = lines.slice(0, startLine)
  const afterLines = lines.slice(endLine)
  const fullPatchedContent = [...beforeLines, ...patchedLines, ...afterLines].join('\n')

  console.log('='.repeat(60))
  console.log('[Source Patch] === PATCH GENERATED SUCCESSFULLY ===')
  console.log('[Source Patch] Output:', {
    filePath,
    originalLength: originalContent.length,
    patchedLength: fullPatchedContent.length,
    lineNumber: source.line,
    changed: originalContent !== fullPatchedContent,
  })
  console.log('='.repeat(60))

  return {
    filePath,
    originalContent,
    patchedContent: fullPatchedContent,
    lineNumber: source.line,
    generatedBy: 'gemini',
  }
}

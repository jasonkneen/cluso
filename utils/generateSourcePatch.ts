/**
 * Source Patch Generator
 *
 * Generates source code patches for UI changes detected via the inspector.
 * Supports multiple strategies:
 * - Fast Path: Direct string manipulation for simple CSS/text/src changes
 * - Fast Apply: Local LLM inference (Pro feature)
 * - Gemini: Cloud-based AI for complex modifications
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { SelectedElement } from '../types'
import { getProviderForModel, ProviderConfig } from '../hooks/useAIChat'

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
  userRequest?: string
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
    const classAttr = element.className ? ` className="${element.className.split(' ')[0]}"` : ''
    const originalTag = `<${element.tagName}${classAttr}>`

    if (isRemoveRequest) {
      updateDescription = `FIND: ${originalTag}\nREPLACE WITH: {false && ${originalTag}...${element.tagName}>}`
    } else if (hasCssChanges) {
      const styleObjEntries = Object.entries(cssChanges)
        .map(([prop, val]) => `${prop}: '${val}'`)
        .join(', ')
      const newTag = `<${element.tagName} style={{ ${styleObjEntries} }}${classAttr}>`
      updateDescription = `FIND: ${originalTag}\nREPLACE WITH: ${newTag}`
    } else {
      updateDescription = userRequest || ''
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
 * Use Gemini AI for complex code modifications
 */
async function useGeminiForPatch(
  codeSnippet: string,
  element: SelectedElement,
  cssChanges: Record<string, string>,
  providerConfig: { modelId: string; providers: ProviderConfig[] },
  sourceFile: string,
  targetLine: number,
  startLine: number,
  endLine: number,
  userRequest?: string
): Promise<string | null> {
  const providerType = getProviderForModel(providerConfig.modelId)
  const provider = providerConfig.providers.find(p => p.id === providerType)

  if (!provider?.apiKey) {
    console.log('[Source Patch] No API key available for provider:', providerType)
    return null
  }

  const google = createGoogleGenerativeAI({ apiKey: provider.apiKey })
  const hasCssChanges = Object.keys(cssChanges).length > 0

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

  const prompt = `You are a React/TypeScript code modifier. Given a code snippet and requested changes, output ONLY the modified snippet.

Source file: ${sourceFile}
${lineNumberReliable ? `Target line in original file: ${targetLine}` : '(Line number from source map may be inaccurate - search by element characteristics)'}
Snippet shows lines ${startLine + 1} to ${endLine}

Code snippet:
\`\`\`
${codeSnippet}
\`\`\`

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
    console.log('[Source Patch] Calling Gemini for code modification...')
    const result = await generateText({
      model: google('gemini-2.0-flash-001'),
      prompt,
      maxTokens: 8000,
    })

    console.log('[Source Patch] Gemini response received, length:', result.text.length)
    let patchedSnippet = result.text.trim()

    // Remove markdown code blocks if present
    const codeMatch = patchedSnippet.match(/```(?:tsx?|jsx?|typescript|javascript)?\s*([\s\S]*?)```/)
    if (codeMatch) {
      patchedSnippet = codeMatch[1].trim()
      console.log('[Source Patch] Extracted code from markdown block')
    }

    // Validate that Gemini returned actual code, not prose explanation
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
      console.log('[Source Patch] Gemini returned PROSE instead of code - aborting')
      console.log('[Source Patch] First line:', firstLine.substring(0, 100))
      return null
    }

    return patchedSnippet
  } catch (error) {
    console.error('[Source Patch] EXCEPTION during Gemini generation:', error)
    return null
  }
}

/**
 * Main function to generate source code patches for UI changes
 */
export async function generateSourcePatch(
  params: GenerateSourcePatchParams
): Promise<SourcePatch | null> {
  const { element, cssChanges, providerConfig, projectPath, userRequest, textChange, srcChange } = params

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

  // Use smaller context for Fast Apply (local LLM is slower with large inputs)
  const fastApplyContextLines = 30 // ~60 lines total - faster for local LLM
  const fastApplyStartLine = Math.max(0, targetLine - fastApplyContextLines)
  const fastApplyEndLine = Math.min(lines.length, targetLine + fastApplyContextLines)
  const fastApplySnippet = lines.slice(fastApplyStartLine, fastApplyEndLine).join('\n')

  console.log('[Source Patch] Fast Apply snippet: lines', fastApplyStartLine + 1, 'to', fastApplyEndLine, '(', fastApplySnippet.length, 'chars)')

  // Try Fast Apply (local LLM) first with smaller snippet
  const fastApplyResult = await tryFastApply(fastApplySnippet, element, cssChanges, userRequest)
  
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

  // Larger context for Gemini (cloud API is faster with large inputs)
  const contextLines = 100
  const startLine = Math.max(0, targetLine - contextLines)
  const endLine = Math.min(lines.length, targetLine + contextLines)

  if (startLine >= endLine) {
    console.log('[Source Patch] ABORT: Invalid line range:', startLine, 'to', endLine)
    return null
  }

  const codeSnippet = lines.slice(startLine, endLine).join('\n')
  console.log('[Source Patch] Gemini snippet: lines', startLine + 1, 'to', endLine, '(', codeSnippet.length, 'chars)')

  // Fall back to Gemini
  const patchedSnippet = await useGeminiForPatch(
    codeSnippet,
    element,
    cssChanges,
    providerConfig,
    source.file,
    targetLine,
    startLine,
    endLine,
    userRequest
  )

  if (!patchedSnippet) {
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

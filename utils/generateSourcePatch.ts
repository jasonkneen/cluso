/**
 * Source Patch Generator
 *
 * Generates source code patches for UI changes detected via the inspector.
 * Supports multiple strategies (ordered by speed):
 * 
 * 1. Regex Fast Path: Direct string manipulation (~0ms)
 * 2. AST Fast Path: Babel-based surgical edits (~10-50ms) - NEW
 * 3. Fast Apply: Local LLM inference (~500-2000ms)
 * 4. AI SDK: Cloud provider fallback (~2-5s)
 */

import { SelectedElement } from '../types'
import { ProviderConfig } from '../hooks/useAIChat'
import { fileService } from '../services/FileService'
import { tryAstPatch, detectAstEditType } from './ast-patch'

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

const HERO_PLACEHOLDER =
  'https://images.unsplash.com/photo-1503264116251-35a269479413?auto=format&fit=crop&w=1600&q=80'

/**
 * Lint code using Electron's IPC (uses ESLint in main process)
 * Returns { valid: true } or { valid: false, errors: string[] }
 */
async function lintCodeSnippet(code: string, filePath?: string): Promise<{ valid: boolean; errors?: string[] }> {
  // Try Electron IPC first (uses ESLint in main process)
  try {
    const result = await fileService.lintCode(code, filePath)
    if (result.success) {
      return { valid: result.data?.valid ?? true, errors: result.data?.errors }
    }
    console.log('[Source Patch] Lint IPC call failed:', result.error)
  } catch (error) {
    console.log('[Source Patch] Lint exception:', error)
  }

  // Fallback: skip linting if not available
  return { valid: true }
}

/**
 * Validates JSX structure for obvious syntax errors
 * Returns { valid: true } or { valid: false, error: string }
 */
function validateJsxStructure(code: string): { valid: boolean; error?: string } {
  const lines = code.split('\n')

  // Check 1: Orphaned props after closing tags
  // Pattern: `/>` or `</...>` followed by lines with prop-like patterns `propName={...}` or `propName="..."`
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim()
    const nextLine = lines[i + 1]?.trim() || ''

    // Check if current line ends a tag
    const endsTag = /\/>$/.test(line) || /<\/\w+>$/.test(line) || /^\s*\);\s*$/.test(line) || /^\s*\}\s*$/.test(line)

    if (endsTag) {
      // Check if next non-empty line looks like an orphaned prop
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j++
      const nextNonEmpty = lines[j]?.trim() || ''

      // Orphaned prop pattern: starts with prop-like syntax without a tag
      const orphanedPropPattern = /^\w+\s*=\s*[\{'"]/
      const startsWithTag = /^<\w+/.test(nextNonEmpty)
      const isClosingBrace = /^[}\])];?$/.test(nextNonEmpty)
      const isExportReturn = /^(export|return|const|let|var|function|import)/.test(nextNonEmpty)

      if (orphanedPropPattern.test(nextNonEmpty) && !startsWithTag && !isClosingBrace && !isExportReturn) {
        return {
          valid: false,
          error: `Orphaned prop after closing tag at line ${i + 1}: "${nextNonEmpty.substring(0, 50)}"`
        }
      }
    }
  }

  // Check 2: Mismatched JSX brackets - basic count check
  let openBraces = 0
  let openParens = 0
  let openAngles = 0 // For JSX tags
  let inString = false
  let stringChar = ''

  for (const char of code) {
    // Track string state (simplified - doesn't handle template literals perfectly)
    if ((char === '"' || char === "'" || char === '`') && !inString) {
      inString = true
      stringChar = char
    } else if (char === stringChar && inString) {
      inString = false
      stringChar = ''
    }

    if (!inString) {
      if (char === '{') openBraces++
      if (char === '}') openBraces--
      if (char === '(') openParens++
      if (char === ')') openParens--
    }

    // Early exit on severe imbalance
    if (openBraces < -5 || openParens < -5) {
      return { valid: false, error: `Severely mismatched brackets: braces=${openBraces}, parens=${openParens}` }
    }
  }

  // Allow slight imbalance (snippet may not include full scope) but catch severe issues
  if (Math.abs(openBraces) > 10) {
    return { valid: false, error: `Mismatched braces: ${openBraces} unclosed` }
  }
  if (Math.abs(openParens) > 10) {
    return { valid: false, error: `Mismatched parentheses: ${openParens} unclosed` }
  }

  // Check 3: Detect obviously truncated/malformed output
  const lastLine = lines[lines.length - 1]?.trim() || ''
  const truncatedPatterns = [
    /^[a-zA-Z_$][a-zA-Z0-9_$]*=$/, // Ends with prop=
    /^\.\.\.$/, // Ends with ...
    /^\/\/.*TODO/i, // Ends with TODO comment
  ]
  if (truncatedPatterns.some(p => p.test(lastLine))) {
    return { valid: false, error: `Output appears truncated: "${lastLine}"` }
  }

  // Check 4: Template literal validation (styled-components, css``, etc.)
  // Ensures backticks are balanced and CSS isn't orphaned outside template literals
  const templateLiteralResult = validateTemplateLiterals(code)
  if (!templateLiteralResult.valid) {
    return templateLiteralResult
  }

  return { valid: true }
}

/**
 * Validates template literal balance and structure
 * Critical for styled-components, css``, emotion, etc.
 */
function validateTemplateLiterals(code: string): { valid: boolean; error?: string } {
  // Track backtick balance with proper escape handling
  let backtickCount = 0
  let inTemplateLiteral = false
  let templateDepth = 0 // For nested ${...} expressions
  let lineNum = 1
  let colNum = 0
  
  for (let i = 0; i < code.length; i++) {
    const char = code[i]
    const prevChar = i > 0 ? code[i - 1] : ''
    
    if (char === '\n') {
      lineNum++
      colNum = 0
      continue
    }
    colNum++
    
    // Skip escaped backticks
    if (char === '`' && prevChar === '\\') {
      continue
    }
    
    if (char === '`') {
      if (!inTemplateLiteral) {
        inTemplateLiteral = true
        templateDepth = 0
        backtickCount++
      } else if (templateDepth === 0) {
        // Closing backtick at root level
        inTemplateLiteral = false
        backtickCount++
      }
      // If templateDepth > 0, this is a nested template literal
    }
    
    // Track ${...} expressions within template literals
    if (inTemplateLiteral && char === '$' && code[i + 1] === '{') {
      templateDepth++
    }
    if (inTemplateLiteral && char === '}' && templateDepth > 0) {
      templateDepth--
    }
  }
  
  // Backticks should be balanced (even count)
  if (backtickCount % 2 !== 0) {
    return { 
      valid: false, 
      error: `Unbalanced template literals: ${backtickCount} backticks found (should be even)` 
    }
  }
  
  // Check if we ended inside a template literal
  if (inTemplateLiteral) {
    return { 
      valid: false, 
      error: `Unclosed template literal detected` 
    }
  }
  
  // Check for orphaned CSS properties outside template literals
  // This catches cases like: `}; color: red; font-size: 12px;` (missing opening backtick)
  const cssPropertyPattern = /^\s*([\w-]+)\s*:\s*[^;{]+;\s*$/gm
  const styledComponentPattern = /styled\.\w+`|styled\(\w+\)`|css`/
  
  if (styledComponentPattern.test(code)) {
    // File uses styled-components/emotion - do deeper validation
    const codeLines = code.split('\n')
    let insideTemplateLiteral = false
    let depth = 0
    
    for (let i = 0; i < codeLines.length; i++) {
      const line = codeLines[i]
      
      // Count backticks on this line (simplified)
      const backticks = (line.match(/(?<!\\)`/g) || []).length
      
      for (let j = 0; j < backticks; j++) {
        if (!insideTemplateLiteral) {
          insideTemplateLiteral = true
        } else if (depth === 0) {
          insideTemplateLiteral = false
        }
      }
      
      // Track ${} depth
      const openBraces = (line.match(/\$\{/g) || []).length
      const closeBraces = (line.match(/\}/g) || []).length
      depth += openBraces - closeBraces
      if (depth < 0) depth = 0
      
      // Check for orphaned CSS (CSS properties outside template literals)
      if (!insideTemplateLiteral && depth === 0) {
        // Line looks like CSS but we're not in a template literal
        const trimmed = line.trim()
        if (cssPropertyPattern.test(trimmed) && 
            !trimmed.startsWith('//') && 
            !trimmed.startsWith('*') &&
            !trimmed.startsWith('/*') &&
            !trimmed.includes('style=') &&
            !trimmed.includes('style:')) {
          return {
            valid: false,
            error: `Orphaned CSS property outside template literal at line ${i + 1}: "${trimmed.substring(0, 50)}"`
          }
        }
      }
    }
  }
  
  return { valid: true }
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
    // Avoid bundling morphsdk into the renderer build (node-only deps like child_process).
    // In web builds this will likely fail at runtime; that's fine since we fall back.
    const morphsdkModule = '@morphllm/morphsdk'
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { MorphClient } = await import(/* @vite-ignore */ morphsdkModule)
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
 * Supports searching for component files when only filename is provided
 * Search order (fast to slow): glob → findFiles
 */
async function resolveFilePath(
  filePath: string,
  projectPath?: string
): Promise<{ resolved: string | null; error?: string; searchedPaths?: string[] }> {
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
      const directPath = `${projectPath}/${relativePath}`

      // Check if it's just a filename (no directory) - need to search for it
      const isJustFilename = !relativePath.includes('/')

      if (isJustFilename) {
        console.log('[Source Patch] Path is just filename, searching for:', relativePath)

        // PERFORMANCE: Run glob and findFiles in PARALLEL for faster resolution
        const searchStartTime = performance.now()
        const hasGlob = !!window.electronAPI?.files?.glob
        const hasFindFiles = !!window.electronAPI?.files?.findFiles

        // Helper to filter and rank paths
        const filterAndRankPaths = (paths: string[]): string | undefined => {
          const validPaths = paths.filter(
            (p: string) =>
              !p.includes('node_modules') &&
              !p.includes('.git') &&
              !p.includes('/dist/') &&
              !p.includes('/build/')
          )

          // Prefer paths in src/components or src/ directories
          return validPaths.find(
            (p: string) => p.includes('/src/components/') || p.includes('/components/')
          ) || validPaths.find(
            (p: string) => p.includes('/src/')
          ) || validPaths[0]
        }

        // Create parallel search promises
        const searches: Promise<{ source: string; paths: string[] }>[] = []

        if (hasGlob) {
          searches.push(
            fileService.glob(`**/${relativePath}`, projectPath)
              .then(result => ({
                source: 'glob',
                paths: result.success && result.data
                  ? result.data.map((g: { path: string }) => g.path)
                  : []
              }))
              .catch(() => ({ source: 'glob', paths: [] }))
          )
        }

        if (hasFindFiles) {
          searches.push(
            fileService.findFiles(projectPath, relativePath)
              .then(result => ({
                source: 'findFiles',
                paths: result.success && result.data ? result.data : []
              }))
              .catch(() => ({ source: 'findFiles', paths: [] }))
          )
        }

        if (searches.length > 0) {
          // Run all searches in parallel
          const results = await Promise.all(searches)
          const searchDuration = performance.now() - searchStartTime

          // Merge all paths (deduplicated)
          const allPaths = [...new Set(results.flatMap(r => r.paths))]
          const preferred = filterAndRankPaths(allPaths)

          console.log(`[Source Patch] Parallel search completed in ${searchDuration.toFixed(0)}ms`)
          console.log(`[Source Patch] Found ${allPaths.length} candidates from:`, results.map(r => `${r.source}(${r.paths.length})`).join(', '))

          if (preferred) {
            console.log('[Source Patch] Selected best match:', preferred)
            return { resolved: preferred, searchedPaths: allPaths }
          }
        }

        console.log('[Source Patch] All file searches failed, trying direct path')
      }

      return { resolved: directPath }
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
  newSrc: string,
  oldSrc?: string
): string | null {
  console.log('[Source Patch] FAST PATH: Image src change detected')
  console.log('[Source Patch] New src:', newSrc)

  const normalizeSrc = (src: string): string => {
    const trimmed = String(src || '').trim()
    if (!trimmed) return ''
    const noQuery = trimmed.split('#')[0].split('?')[0]
    if (/^https?:\/\//i.test(noQuery)) {
      try {
        return new URL(noQuery).pathname || noQuery
      } catch {
        const m = noQuery.match(/^https?:\/\/[^/]+(\/.*)$/i)
        return m?.[1] || noQuery
      }
    }
    return noQuery
  }

  const oldCandidates = (() => {
    const set = new Set<string>()
    if (oldSrc) {
      const normalized = normalizeSrc(oldSrc)
      for (const c of [oldSrc, normalized]) {
        const v = String(c || '').trim()
        if (!v) continue
        set.add(v)
        if (v.startsWith('/')) set.add(v.slice(1))
      }
    }
    return Array.from(set)
  })()

  const lines = originalContent.split('\n')
  let targetLine = sourceLine
  if (targetLine > lines.length) targetLine = lines.length

  const searchRadius = oldCandidates.length > 0 ? 200 : 15
  const startSearch = Math.max(0, targetLine - searchRadius - 1)
  const endSearch = Math.min(lines.length, targetLine + searchRadius)

  for (let i = startSearch; i < endSearch; i++) {
    const line = lines[i]

    if (/<img\s/i.test(line) || /<Image\b/i.test(line) || /src\s*=/i.test(line)) {
      console.log('[Source Patch] Found potential img at line', i + 1, ':', line.substring(0, 60))

      // Pattern 1: src="..." or src='...'
      const srcQuoteMatch = line.match(/src\s*=\s*(['"])([^'"]*)\1/)
      // Pattern 2: src={...} (JSX expression)
      const srcJsxMatch = line.match(/src\s*=\s*\{([^}]*)\}/)
      // Pattern 3: src={"..."} / src={'...'} / src={`...`}
      const srcJsxStringMatch = line.match(/src\s*=\s*\{\s*(['"`])([^'"`]+)\1\s*\}/)

      if (srcQuoteMatch) {
        const existingValue = srcQuoteMatch[2] || ''
        if (oldCandidates.length > 0 && !oldCandidates.includes(existingValue)) {
          continue
        }
        const quote = srcQuoteMatch[1]
        lines[i] = line.replace(srcQuoteMatch[0], `src=${quote}${newSrc}${quote}`)
        console.log('[Source Patch] Replaced quoted src attribute')
        return lines.join('\n')
      } else if (srcJsxStringMatch) {
        const quote = srcJsxStringMatch[1]
        const existingValue = srcJsxStringMatch[2] || ''
        if (oldCandidates.length > 0 && !oldCandidates.includes(existingValue)) {
          continue
        }
        lines[i] = line.replace(srcJsxStringMatch[0], `src={${quote}${newSrc}${quote}}`)
        console.log('[Source Patch] Replaced JSX string literal src expression')
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
 * Fast path for className token edits (add/remove/set) based on userRequest.
 */
function tryFastPathClassNameChange(
  originalContent: string,
  sourceLine: number,
  element: SelectedElement,
  userRequest?: string
): string | null {
  if (!userRequest) return null

  const normalizeTokens = (raw: string): string[] =>
    raw
      .replace(/["']/g, '')
      .split(/[\s,]+/)
      .map(t => t.trim())
      .filter(Boolean)

  const parseRequest = () => {
    const setMatch = userRequest.match(/(?:set|change|update)\s+class(?:name)?\s+to\s+(.+)$/i)
    if (setMatch) return { kind: 'set' as const, tokens: normalizeTokens(setMatch[1]) }
    const addMatch = userRequest.match(/(?:add|append)\s+class(?:es)?\s+(.+)$/i)
    if (addMatch) return { kind: 'add' as const, tokens: normalizeTokens(addMatch[1]) }
    const removeMatch = userRequest.match(/(?:remove|delete)\s+class(?:es)?\s+(.+)$/i)
    if (removeMatch) return { kind: 'remove' as const, tokens: normalizeTokens(removeMatch[1]) }
    return null
  }

  const op = parseRequest()
  if (!op || op.tokens.length === 0) return null

  const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const tagName = element.tagName?.toLowerCase()
  const classNameHint = element.className?.split(' ')[0]
  const elementId = element.id
  if (!tagName || (!classNameHint && !elementId)) return null

  const lines = originalContent.split('\n')
  let targetLine = sourceLine
  if (targetLine > lines.length) targetLine = lines.length
  if (targetLine < 1) targetLine = 1

  const searchRadius = 60
  const startSearch = Math.max(0, targetLine - searchRadius - 1)
  const endSearch = Math.min(lines.length, targetLine + searchRadius)

  for (let i = startSearch; i < endSearch; i++) {
    const line = lines[i]
    if (!line.includes('<')) continue

    const tagStartPattern = new RegExp(`<${escapeRegExp(tagName)}(?:\\s|>|\\/)`, 'i')
    if (!tagStartPattern.test(line)) continue

    // Pull in the full opening tag (supports multi-line props).
    const maxTagLines = 12
    let j = i
    let tagText = lines[j]
    while (j + 1 < lines.length && j - i < maxTagLines) {
      if (/(\/?>)/.test(tagText)) break
      j++
      tagText += '\n' + lines[j]
      if (/(\/?>)/.test(lines[j])) break
    }

    const classPattern = classNameHint
      ? new RegExp(`className=["'\`][^"'\`]*\\b${escapeRegExp(classNameHint)}\\b`)
      : null
    const idPattern = elementId ? new RegExp(`id=["'\`]${escapeRegExp(elementId)}["'\`]`) : null
    const hasClass = classPattern ? classPattern.test(tagText) : false
    const hasId = idPattern ? idPattern.test(tagText) : false
    if (!hasClass && !hasId) continue

    const classMatch =
      tagText.match(/className\s*=\s*(['"])([^'"]*)\1/m) ||
      tagText.match(/className\s*=\s*\{\s*(['"`])([^'"`]+)\1\s*\}/m)

    const applyTokens = (existingTokens: string[]): string[] => {
      if (op.kind === 'set') return op.tokens
      if (op.kind === 'add') {
        const set = new Set(existingTokens)
        for (const t of op.tokens) set.add(t)
        return Array.from(set)
      }
      // remove
      const removeSet = new Set(op.tokens)
      return existingTokens.filter(t => !removeSet.has(t))
    }

    const replacementTokens = applyTokens(classMatch ? normalizeTokens(classMatch[2] || classMatch[3] || '') : [])
    const nextClassValue = replacementTokens.join(' ')

    let nextTagText = tagText
    if (classMatch) {
      const quote = classMatch[1]
      const fullMatch = classMatch[0]
      if (fullMatch.includes('{')) {
        nextTagText = tagText.replace(fullMatch, `className={${quote}${nextClassValue}${quote}}`)
      } else {
        nextTagText = tagText.replace(fullMatch, `className=${quote}${nextClassValue}${quote}`)
      }
    } else {
      // Insert a new className prop near the start of the opening tag.
      const insertMatch = tagText.match(new RegExp(`(<${escapeRegExp(tagName)})([\\s>/])`, 'i'))
      if (!insertMatch) continue
      nextTagText = tagText.replace(insertMatch[0], `${insertMatch[1]} className="${nextClassValue}"${insertMatch[2]}`)
    }

    if (nextTagText === tagText) continue

    const nextLines = nextTagText.split('\n')
    lines.splice(i, j - i + 1, ...nextLines)
    console.log('[Source Patch] FAST PATH SUCCESS - updated className')
    return lines.join('\n')
  }

  return null
}

/**
 * Fast path for text-only changes
 */
function tryFastPathTextChange(
  originalContent: string,
  oldText: string,
  newText: string,
  sourceLine?: number
): string | null {
  console.log('[Source Patch] FAST PATH: Simple text change detected')
  console.log('[Source Patch] Old text:', oldText.substring(0, 50))
  console.log('[Source Patch] New text:', newText.substring(0, 50))

  const escapedOld = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    // JSX text content: >OldText< or >{`OldText`}< or >{oldText}<
    new RegExp(`(>\\s*)${escapedOld}(\\s*<)`, 'g'),
    // String literals in JSX: "OldText" or 'OldText'
    // NOTE: capture the closing quote explicitly to avoid replace() callback arg confusion
    // (when there is only 1 capture group, arg2 is the numeric offset, which previously got appended)
    new RegExp(`(['"])${escapedOld}(\\1)`, 'g'),
    // Template literals: `OldText`
    new RegExp(`(\`)${escapedOld}(\`)`, 'g'),
  ]

  const replaceFirstMatchInScope = (scope: string): string | null => {
    for (const pattern of patterns) {
      const match = pattern.exec(scope)
      pattern.lastIndex = 0
      if (!match) continue

      const patchedScope = scope.replace(pattern, (m, p1, p2) => `${p1}${newText}${p2 || p1}`)
      if (patchedScope !== scope) {
        console.log('[Source Patch] FAST PATH SUCCESS - replaced text directly (scoped)')
        return patchedScope
      }
    }
    return null
  }

  if (sourceLine && Number.isFinite(sourceLine)) {
    const lines = originalContent.split('\n')
    let targetLine = sourceLine
    if (targetLine > lines.length) targetLine = lines.length
    if (targetLine < 1) targetLine = 1

    const searchRadius = 80
    const startSearch = Math.max(0, targetLine - searchRadius - 1)
    const endSearch = Math.min(lines.length, targetLine + searchRadius)

    const scoped = lines.slice(startSearch, endSearch).join('\n')
    const patchedScoped = replaceFirstMatchInScope(scoped)
    if (patchedScoped) {
      const before = lines.slice(0, startSearch)
      const after = lines.slice(endSearch)
      return [...before, ...patchedScoped.split('\n'), ...after].join('\n')
    }
  }

  // If scoped replacement failed, only replace globally when the oldText appears once.
  const occurrenceCount = (() => {
    if (!oldText) return 0
    let count = 0
    let idx = 0
    while (true) {
      const next = originalContent.indexOf(oldText, idx)
      if (next === -1) break
      count++
      idx = next + oldText.length
      if (count > 1) break
    }
    return count
  })()

  if (occurrenceCount === 1) {
    const patched = replaceFirstMatchInScope(originalContent)
    if (patched) return patched
  }

  if (occurrenceCount === 1) {
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

  const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const applyStyleObjectEdits = (
    styleInner: string,
    changes: Record<string, string>
  ): { updated: string; changed: boolean } => {
    let updated = styleInner
    let changed = false

    for (const [prop, val] of Object.entries(changes)) {
      const propPattern = new RegExp(`(^|[,{]\\s*)${escapeRegExp(prop)}\\s*:\\s*([^,}\\n]+)`, 'm')
      if (propPattern.test(updated)) {
        updated = updated.replace(propPattern, (_m, p1) => {
          changed = true
          return `${p1}${prop}: '${val}'`
        })
      } else {
        const hasNewlines = updated.includes('\n')
        if (hasNewlines) {
          const indentMatch = updated.match(/\n(\s*)\S/)
          const indent = indentMatch?.[1] ?? '  '
          const trimmed = updated.replace(/\s*$/, '')
          const needsComma = /[,{]\s*$/.test(trimmed) || trimmed.trim().length === 0 ? '' : ','
          updated = `${trimmed}${needsComma}\n${indent}${prop}: '${val}',\n`
        } else {
          const trimmed = updated.trim()
          if (!trimmed) {
            updated = `${prop}: '${val}'`
          } else {
            updated = `${trimmed}, ${prop}: '${val}'`
          }
        }
        changed = true
      }
    }

    return { updated, changed }
  }

  const mergeCssStringIntoObject = (css: string): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const part of css.split(';')) {
      const trimmed = part.trim()
      if (!trimmed) continue
      const idx = trimmed.indexOf(':')
      if (idx === -1) continue
      const rawProp = trimmed.slice(0, idx).trim()
      const rawVal = trimmed.slice(idx + 1).trim()
      if (!rawProp || !rawVal) continue
      const camelProp = rawProp.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      out[camelProp] = rawVal
    }
    return out
  }

  const lines = originalContent.split('\n')
  let targetLine = sourceLine
  if (targetLine > lines.length) targetLine = lines.length
  if (!Number.isFinite(targetLine) || targetLine < 1) targetLine = 1

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

  const pickStableAttributes = (attrs?: Record<string, string>): Array<{ name: string; value: string; weight: number }> => {
    const banned = new Set(['class', 'className', 'id', 'style', 'data-cluso-id', 'data-cluso-name', 'data-cluso-ui'])
    if (!attrs) return []
    const entries = Object.entries(attrs)
      .map(([name, value]) => ({ name: String(name || '').trim(), value: String(value || '').trim() }))
      .filter(({ name, value }) => !!name && !!value && !banned.has(name))

    const weightFor = (name: string, value: string) => {
      if (name === 'd') return 100
      if (name === 'href' || name === 'xlink:href') return 80
      if (name === 'src') return 80
      if (name === 'aria-label') return 70
      if (name === 'viewBox') return 60
      if (name === 'role' || name === 'type' || name === 'name' || name === 'alt' || name === 'title') return 50
      return Math.min(40, Math.max(10, value.length))
    }

    return entries
      .map(({ name, value }) => ({ name, value, weight: weightFor(name, value) }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
  }

  const matchesAttrInTagText = (tagText: string, name: string, value: string): boolean => {
    if (!tagText || !name || !value) return false
    if (!tagText.includes(`${name}=`)) return false
    if (tagText.includes(value)) return true
    const prefixLen = Math.min(64, Math.max(12, Math.floor(value.length / 3)))
    const prefix = value.slice(0, prefixLen)
    if (prefix && tagText.includes(prefix)) return true
    const normalized = value.replace(/\s+/g, ' ').trim()
    const normalizedPrefix = normalized.slice(0, prefixLen)
    return !!normalizedPrefix && tagText.replace(/\s+/g, ' ').includes(normalizedPrefix)
  }

  const hasStableSelector = !!className || !!elementId
  const stableAttrs = hasStableSelector ? [] : pickStableAttributes(element.attributes)
  if (!hasStableSelector && stableAttrs.length === 0) {
    console.log('[Source Patch] No class/id and no stable attributes - skipping fast path (too ambiguous)')
    return null
  }
  if (!tagName) {
    console.log('[Source Patch] No tagName - skipping fast path')
    return null
  }

  // When we don't have class/id, collect candidate matches first and require uniqueness.
  const attrCandidates: Array<{ i: number; j: number; tagText: string; score: number }> = []

  const applyPatchToTagBlock = (i: number, j: number, tagText: string): string | null => {
    const styleObjMatch = tagText.match(/style\s*=\s*\{\s*\{([\s\S]*?)\}\s*\}/m)
    const styleStringMatch = tagText.match(/style\s*=\s*"([^"]*)"/m)

    if (styleObjMatch) {
      const existingInner = styleObjMatch[1] ?? ''
      const { updated, changed } = applyStyleObjectEdits(existingInner, cssChanges)
      if (!changed) return originalContent
      const replacement = `style={{${updated}}}`
      const nextTagText = tagText.replace(styleObjMatch[0], replacement)
      const nextLines = nextTagText.split('\n')
      lines.splice(i, j - i + 1, ...nextLines)
      console.log('[Source Patch] Updated existing style={{...}} prop')
      return lines.join('\n')
    }

    if (styleStringMatch) {
      const existingCss = styleStringMatch[1] || ''
      const existingObj = mergeCssStringIntoObject(existingCss)
      const mergedChanges: Record<string, string> = { ...existingObj, ...cssChanges }
      const mergedEntries = Object.entries(mergedChanges)
        .map(([prop, val]) => `${prop}: '${val}'`)
        .join(', ')
      const nextTagText = tagText.replace(styleStringMatch[0], `style={{ ${mergedEntries} }}`)
      const nextLines = nextTagText.split('\n')
      lines.splice(i, j - i + 1, ...nextLines)
      console.log('[Source Patch] Converted style="..." to style={{...}} and merged')
      return lines.join('\n')
    }

    const insertMatch = tagText.match(new RegExp(`(<${tagName})([\\s>/])`, 'i'))
    if (insertMatch) {
      const nextTagText = tagText.replace(insertMatch[0], `${insertMatch[1]} style={${styleObjStr}}${insertMatch[2]}`)
      const nextLines = nextTagText.split('\n')
      lines.splice(i, j - i + 1, ...nextLines)
      console.log('[Source Patch] Added new style prop')
      return lines.join('\n')
    }

    return null
  }

  for (let i = startSearch; i < endSearch; i++) {
    const line = lines[i]
    if (!line.includes('<')) continue

    const tagStartPattern = new RegExp(`<${tagName}(?:\\s|>|\\/)`, 'i')
    if (!tagStartPattern.test(line)) continue

    // Pull in the full opening tag (supports multi-line props).
    const maxTagLines = 12
    let j = i
    let tagText = lines[j]
    while (j + 1 < lines.length && j - i < maxTagLines) {
      if (/(\/?>)/.test(tagText)) break
      j++
      tagText += '\n' + lines[j]
      if (/(\/?>)/.test(lines[j])) break
    }

    const classPattern = className ? new RegExp(`className=["'\`][^"'\`]*\\b${escapeRegExp(className)}\\b`) : null
    const idPattern = elementId ? new RegExp(`id=["'\`]${escapeRegExp(elementId)}["'\`]`) : null

    const hasClass = classPattern ? classPattern.test(tagText) : false
    const hasId = idPattern ? idPattern.test(tagText) : false

    if (hasStableSelector) {
      if (!hasClass && !hasId) continue
      console.log('[Source Patch] Found element tag block at line', i + 1, 'to', j + 1)
      const patched = applyPatchToTagBlock(i, j, tagText)
      if (patched) return patched
      continue
    }

    // Attribute-only matching mode: score candidates and require uniqueness.
    const matched = stableAttrs.filter(a => matchesAttrInTagText(tagText, a.name, a.value))
    const score = matched.reduce((sum, a) => sum + a.weight, 0)
    if (matched.length === 0) continue
    attrCandidates.push({ i, j, tagText, score })
  }

  if (!hasStableSelector) {
    // Require exactly one strong candidate.
    const MIN_SCORE = 50 // ensures we match a truly stable attribute like d/src/aria-label
    const strong = attrCandidates.filter(c => c.score >= MIN_SCORE)
    if (strong.length !== 1) {
      console.log('[Source Patch] Attribute-only fast path ambiguous:', {
        candidates: attrCandidates.length,
        strongCandidates: strong.length,
        minScore: MIN_SCORE,
      })
      return null
    }
    const chosen = strong[0]
    console.log('[Source Patch] Found attribute-matched element tag block at line', chosen.i + 1, 'to', chosen.j + 1)
    return applyPatchToTagBlock(chosen.i, chosen.j, chosen.tagText)
  }

  return null
}

/**
 * Fast path for common attribute changes (href, alt, title, placeholder, etc.)
 * PERFORMANCE: Avoids LLM entirely for simple attribute updates
 */
function tryFastPathAttributeChange(
  originalContent: string,
  sourceLine: number,
  element: SelectedElement,
  attrName: string,
  newValue: string,
  oldValue?: string
): string | null {
  console.log(`[Source Patch] FAST PATH: ${attrName} attribute change detected`)
  console.log(`[Source Patch] New ${attrName}:`, newValue)

  const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const lines = originalContent.split('\n')
  let targetLine = sourceLine
  if (targetLine > lines.length) targetLine = lines.length
  if (targetLine < 1) targetLine = 1

  const searchRadius = 30
  const startSearch = Math.max(0, targetLine - searchRadius - 1)
  const endSearch = Math.min(lines.length, targetLine + searchRadius)

  const tagName = element.tagName?.toLowerCase()
  const classNameHint = element.className?.split(' ')[0]
  const elementId = element.id

  for (let i = startSearch; i < endSearch; i++) {
    const line = lines[i]
    if (!line.includes('<')) continue

    // Check if this line contains the target tag
    const tagStartPattern = new RegExp(`<${escapeRegExp(tagName || '')}(?:\\s|>|\\/)`, 'i')
    if (tagName && !tagStartPattern.test(line)) continue

    // Pull in the full opening tag (supports multi-line props)
    const maxTagLines = 12
    let j = i
    let tagText = lines[j]
    while (j + 1 < lines.length && j - i < maxTagLines) {
      if (/(\/?>)/.test(tagText)) break
      j++
      tagText += '\n' + lines[j]
      if (/(\/?>)/.test(lines[j])) break
    }

    // Verify element identity
    const classPattern = classNameHint
      ? new RegExp(`className=["'\`][^"'\`]*\\b${escapeRegExp(classNameHint)}\\b`)
      : null
    const idPattern = elementId ? new RegExp(`id=["'\`]${escapeRegExp(elementId)}["'\`]`) : null
    const hasClass = classPattern ? classPattern.test(tagText) : false
    const hasId = idPattern ? idPattern.test(tagText) : false
    if (!hasClass && !hasId && (classNameHint || elementId)) continue

    // Pattern 1: attr="..." or attr='...'
    const attrQuotePattern = new RegExp(`${escapeRegExp(attrName)}\\s*=\\s*(['"])([^'"]*?)\\1`)
    const attrQuoteMatch = tagText.match(attrQuotePattern)

    // Pattern 2: attr={...} (JSX expression)
    const attrJsxPattern = new RegExp(`${escapeRegExp(attrName)}\\s*=\\s*\\{([^}]*)\\}`)
    const attrJsxMatch = tagText.match(attrJsxPattern)

    if (attrQuoteMatch) {
      const quote = attrQuoteMatch[1]
      const existingValue = attrQuoteMatch[2]
      
      // Validate old value if provided
      if (oldValue && existingValue !== oldValue) continue

      const nextTagText = tagText.replace(attrQuoteMatch[0], `${attrName}=${quote}${newValue}${quote}`)
      const nextLines = nextTagText.split('\n')
      lines.splice(i, j - i + 1, ...nextLines)
      console.log(`[Source Patch] FAST PATH SUCCESS - updated ${attrName} attribute`)
      return lines.join('\n')
    } else if (attrJsxMatch) {
      // For JSX expressions, wrap in quotes
      const nextTagText = tagText.replace(attrJsxMatch[0], `${attrName}="${newValue}"`)
      const nextLines = nextTagText.split('\n')
      lines.splice(i, j - i + 1, ...nextLines)
      console.log(`[Source Patch] FAST PATH SUCCESS - replaced ${attrName} JSX expression`)
      return lines.join('\n')
    } else {
      // Attribute doesn't exist - add it
      const insertMatch = tagText.match(new RegExp(`(<${escapeRegExp(tagName || 'div')})([\\s>/])`, 'i'))
      if (insertMatch) {
        const nextTagText = tagText.replace(insertMatch[0], `${insertMatch[1]} ${attrName}="${newValue}"${insertMatch[2]}`)
        const nextLines = nextTagText.split('\n')
        lines.splice(i, j - i + 1, ...nextLines)
        console.log(`[Source Patch] FAST PATH SUCCESS - added ${attrName} attribute`)
        return lines.join('\n')
      }
    }
  }

  return null
}

/**
 * Fast path for boolean prop changes (disabled, hidden, checked, etc.)
 * PERFORMANCE: Avoids LLM entirely for toggling boolean props
 */
function tryFastPathBooleanPropChange(
  originalContent: string,
  sourceLine: number,
  element: SelectedElement,
  propName: string,
  shouldBePresent: boolean
): string | null {
  console.log(`[Source Patch] FAST PATH: Boolean prop ${propName} = ${shouldBePresent}`)

  const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const lines = originalContent.split('\n')
  let targetLine = sourceLine
  if (targetLine > lines.length) targetLine = lines.length
  if (targetLine < 1) targetLine = 1

  const searchRadius = 30
  const startSearch = Math.max(0, targetLine - searchRadius - 1)
  const endSearch = Math.min(lines.length, targetLine + searchRadius)

  const tagName = element.tagName?.toLowerCase()
  const classNameHint = element.className?.split(' ')[0]
  const elementId = element.id

  for (let i = startSearch; i < endSearch; i++) {
    const line = lines[i]
    if (!line.includes('<')) continue

    const tagStartPattern = new RegExp(`<${escapeRegExp(tagName || '')}(?:\\s|>|\\/)`, 'i')
    if (tagName && !tagStartPattern.test(line)) continue

    const maxTagLines = 12
    let j = i
    let tagText = lines[j]
    while (j + 1 < lines.length && j - i < maxTagLines) {
      if (/(\/?>)/.test(tagText)) break
      j++
      tagText += '\n' + lines[j]
      if (/(\/?>)/.test(lines[j])) break
    }

    // Verify element identity
    const classPattern = classNameHint
      ? new RegExp(`className=["'\`][^"'\`]*\\b${escapeRegExp(classNameHint)}\\b`)
      : null
    const idPattern = elementId ? new RegExp(`id=["'\`]${escapeRegExp(elementId)}["'\`]`) : null
    const hasClass = classPattern ? classPattern.test(tagText) : false
    const hasId = idPattern ? idPattern.test(tagText) : false
    if (!hasClass && !hasId && (classNameHint || elementId)) continue

    // Check various patterns for boolean props
    // Pattern 1: propName (standalone)
    // Pattern 2: propName={true} or propName={false}
    // Pattern 3: propName="true" or propName="false"
    const standalonePattern = new RegExp(`\\s${escapeRegExp(propName)}(?=[\\s/>])`)
    const jsxBoolPattern = new RegExp(`${escapeRegExp(propName)}\\s*=\\s*\\{(true|false)\\}`)
    const stringBoolPattern = new RegExp(`${escapeRegExp(propName)}\\s*=\\s*["'](true|false)["']`)

    const hasStandalone = standalonePattern.test(tagText)
    const jsxBoolMatch = tagText.match(jsxBoolPattern)
    const stringBoolMatch = tagText.match(stringBoolPattern)
    const currentlyPresent = hasStandalone || (jsxBoolMatch?.[1] === 'true') || (stringBoolMatch?.[1] === 'true')

    let nextTagText = tagText

    if (shouldBePresent && !currentlyPresent) {
      // Add the prop
      const insertMatch = tagText.match(new RegExp(`(<${escapeRegExp(tagName || 'div')})([\\s>/])`, 'i'))
      if (insertMatch) {
        nextTagText = tagText.replace(insertMatch[0], `${insertMatch[1]} ${propName}${insertMatch[2]}`)
      }
    } else if (!shouldBePresent && currentlyPresent) {
      // Remove the prop
      if (hasStandalone) {
        nextTagText = tagText.replace(new RegExp(`\\s${escapeRegExp(propName)}(?=[\\s/>])`), '')
      } else if (jsxBoolMatch) {
        nextTagText = tagText.replace(jsxBoolMatch[0], '')
      } else if (stringBoolMatch) {
        nextTagText = tagText.replace(stringBoolMatch[0], '')
      }
    } else if (shouldBePresent && jsxBoolMatch && jsxBoolMatch[1] === 'false') {
      // Change {false} to {true}
      nextTagText = tagText.replace(jsxBoolMatch[0], `${propName}={true}`)
    } else if (!shouldBePresent && jsxBoolMatch && jsxBoolMatch[1] === 'true') {
      // Change {true} to {false} or remove
      nextTagText = tagText.replace(jsxBoolMatch[0], '')
    }

    if (nextTagText !== tagText) {
      // Clean up any double spaces created by removal
      nextTagText = nextTagText.replace(/\s{2,}/g, ' ')
      const nextLines = nextTagText.split('\n')
      lines.splice(i, j - i + 1, ...nextLines)
      console.log(`[Source Patch] FAST PATH SUCCESS - ${shouldBePresent ? 'added' : 'removed'} ${propName}`)
      return lines.join('\n')
    }
  }

  return null
}

/**
 * Fast path for Tailwind class toggling (dark:, hover:, md:, etc.)
 * PERFORMANCE: Smart regex-based class manipulation for Tailwind prefixes
 */
function tryFastPathTailwindToggle(
  originalContent: string,
  sourceLine: number,
  element: SelectedElement,
  userRequest?: string
): string | null {
  if (!userRequest) return null

  // Parse Tailwind-specific requests
  const toggleMatch = userRequest.match(/(?:toggle|add|remove)\s+(dark:|hover:|focus:|active:|md:|lg:|xl:|sm:)?(\S+)/i)
  if (!toggleMatch) return null

  const prefix = toggleMatch[1] || ''
  const className = toggleMatch[2]
  const fullClass = `${prefix}${className}`
  const isAdd = /add|toggle/i.test(userRequest)
  const isRemove = /remove/i.test(userRequest)

  console.log(`[Source Patch] FAST PATH: Tailwind ${isRemove ? 'remove' : 'add'} "${fullClass}"`)

  const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const lines = originalContent.split('\n')
  let targetLine = sourceLine
  if (targetLine > lines.length) targetLine = lines.length
  if (targetLine < 1) targetLine = 1

  const searchRadius = 60
  const startSearch = Math.max(0, targetLine - searchRadius - 1)
  const endSearch = Math.min(lines.length, targetLine + searchRadius)

  const tagName = element.tagName?.toLowerCase()
  const classNameHint = element.className?.split(' ')[0]
  const elementId = element.id

  for (let i = startSearch; i < endSearch; i++) {
    const line = lines[i]
    if (!line.includes('<')) continue

    const tagStartPattern = new RegExp(`<${escapeRegExp(tagName || '')}(?:\\s|>|\\/)`, 'i')
    if (tagName && !tagStartPattern.test(line)) continue

    const maxTagLines = 12
    let j = i
    let tagText = lines[j]
    while (j + 1 < lines.length && j - i < maxTagLines) {
      if (/(\/?>)/.test(tagText)) break
      j++
      tagText += '\n' + lines[j]
      if (/(\/?>)/.test(lines[j])) break
    }

    // Verify element identity
    const classPattern = classNameHint
      ? new RegExp(`className=["'\`][^"'\`]*\\b${escapeRegExp(classNameHint)}\\b`)
      : null
    const idPattern = elementId ? new RegExp(`id=["'\`]${escapeRegExp(elementId)}["'\`]`) : null
    const hasClass = classPattern ? classPattern.test(tagText) : false
    const hasId = idPattern ? idPattern.test(tagText) : false
    if (!hasClass && !hasId && (classNameHint || elementId)) continue

    // Find and modify className
    const classMatch =
      tagText.match(/className\s*=\s*(['"])([^'"]*)\1/m) ||
      tagText.match(/className\s*=\s*\{\s*(['"`])([^'"`]+)\1\s*\}/m)

    if (!classMatch) continue

    const quote = classMatch[1]
    const currentClasses = classMatch[2].split(/\s+/).filter(Boolean)
    const hasTargetClass = currentClasses.includes(fullClass)

    let newClasses: string[]
    if (isRemove || (hasTargetClass && !isAdd)) {
      newClasses = currentClasses.filter(c => c !== fullClass)
    } else {
      if (!hasTargetClass) {
        newClasses = [...currentClasses, fullClass]
      } else {
        newClasses = currentClasses
      }
    }

    const newClassValue = newClasses.join(' ')
    if (newClassValue === classMatch[2]) continue

    let nextTagText: string
    if (classMatch[0].includes('{')) {
      nextTagText = tagText.replace(classMatch[0], `className={${quote}${newClassValue}${quote}}`)
    } else {
      nextTagText = tagText.replace(classMatch[0], `className=${quote}${newClassValue}${quote}`)
    }

    const nextLines = nextTagText.split('\n')
    lines.splice(i, j - i + 1, ...nextLines)
    console.log(`[Source Patch] FAST PATH SUCCESS - Tailwind class ${isRemove || hasTargetClass ? 'removed' : 'added'}`)
    return lines.join('\n')
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

  // Validate JSX structure
  const jsxValidationResult = validateJsxStructure(fastResult.code)
  if (!jsxValidationResult.valid) {
    console.log('[Source Patch] Fast Apply returned BROKEN JSX - rejecting')
    console.log('[Source Patch] Validation error:', jsxValidationResult.error)
    return { success: false, error: `Broken JSX: ${jsxValidationResult.error}` }
  }

  // Lint the generated code (best effort - don't block if linting unavailable)
  const lintResult = await lintCodeSnippet(fastResult.code)
  if (!lintResult.valid && lintResult.errors && lintResult.errors.length > 0) {
    console.log('[Source Patch] Fast Apply returned code with lint errors - rejecting')
    console.log('[Source Patch] Lint errors:', lintResult.errors.slice(0, 5))
    return { success: false, error: `Lint errors: ${lintResult.errors[0]}` }
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
  // Line 0 or very low line numbers are unreliable (react-grab sometimes returns 0)
  const lineNumberReliable = targetLine > 5 && targetLine <= lines.length
  // Always search by element characteristics when line is unreliable
  const searchByElement = !lineNumberReliable || element.text || element.className || element.outerHTML

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

  const systemPrompt = `You are a React/TypeScript code modifier. Given a code snippet and requested changes, output ONLY the modified snippet.

CRITICAL RULES:
1. Output ONLY valid JSX/TSX code - no explanations, no markdown code blocks
2. NEVER output orphaned props (props that aren't inside a tag)
3. NEVER close a tag and then output props - props MUST be inside the opening tag
4. Maintain proper JSX structure: all props between < and > or />
5. If you cannot make the change, output the original code unchanged
6. The output must be syntactically valid TypeScript/JSX`

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

  const strictSuffix = `\n\nCRITICAL: Return ONLY the patched snippet/code. No explanation. No markdown fences. No prose.\n`

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

  const extractBestFencedBlock = (raw: string): string | null => {
    const text = String(raw || '')
    if (!text.includes('```')) return null

    const blocks: Array<{ lang: string; code: string }> = []
    const re = /```\s*([a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)```/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const lang = String(m[1] || '').toLowerCase()
      const code = String(m[2] || '').trim()
      if (!code) continue
      blocks.push({ lang, code })
    }

    if (blocks.length === 0) return null

    // Prefer TSX/TS/JSX/JS blocks; avoid diff unless it's the only option.
    const preferred = ['tsx', 'ts', 'jsx', 'js', 'typescript', 'javascript']
    const bestPreferred = blocks
      .filter(b => preferred.includes(b.lang))
      .sort((a, b) => b.code.length - a.code.length)[0]
    if (bestPreferred) return bestPreferred.code

    const bestNonDiff = blocks
      .filter(b => b.lang !== 'diff')
      .sort((a, b) => b.code.length - a.code.length)[0]
    if (bestNonDiff) return bestNonDiff.code

    return blocks.sort((a, b) => b.code.length - a.code.length)[0]!.code
  }

  const normalizeModelOutput = (raw: string): string => {
    let out = String(raw || '').trim()
    // If the model wrapped the entire response in one fenced block, extract it.
    const fenced = extractBestFencedBlock(out)
    if (fenced) out = fenced.trim()
    return out
  }

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
    let patchedSnippet = normalizeModelOutput(result.text)

    // Validate that AI returned actual code, not prose explanation.
    // If prose is detected, attempt to salvage via fenced code blocks, then retry once with stricter instruction.
    const firstLine = patchedSnippet.split('\n')[0]
    const isProse = proseIndicators.some(p => p.test(firstLine))
    if (isProse) {
      console.log('[Source Patch] AI returned PROSE instead of code - attempting fenced block extraction')
      console.log('[Source Patch] First line:', firstLine.substring(0, 100))

      const extracted = extractBestFencedBlock(result.text)
      if (extracted) {
        patchedSnippet = extracted.trim()
        console.log('[Source Patch] Extracted code from fenced block despite prose wrapper')
      } else {
        console.log('[Source Patch] No fenced code block found in prose output - retrying once with strict prompt')

        const retry = await window.electronAPI.aiSdk.generate({
          modelId,
          messages: [{ role: 'user', content: userPrompt + strictSuffix }],
          providers,
          system: systemPrompt,
          maxSteps: 1,
        })

        if (!retry.success || !retry.text) {
          console.log('[Source Patch] AI SDK strict retry failed:', retry.error || 'No text returned')
          return null
        }

        patchedSnippet = normalizeModelOutput(retry.text)
        const retryFirstLine = patchedSnippet.split('\n')[0]
        const retryIsProse = proseIndicators.some(p => p.test(retryFirstLine))
        if (retryIsProse) {
          console.log('[Source Patch] AI strict retry still returned prose - aborting')
          console.log('[Source Patch] Retry first line:', retryFirstLine.substring(0, 100))
          return null
        }
      }
    }

    // Validate JSX structure - check for obvious syntax errors
    const jsxValidationResult = validateJsxStructure(patchedSnippet)
    if (!jsxValidationResult.valid) {
      console.log('[Source Patch] AI returned BROKEN JSX - aborting')
      console.log('[Source Patch] Validation error:', jsxValidationResult.error)
      console.log('[Source Patch] Snippet preview:', patchedSnippet.substring(0, 300))
      return null
    }

    // Lint the generated code for additional validation
    const lintResult = await lintCodeSnippet(patchedSnippet, sourceFile)
    if (!lintResult.valid && lintResult.errors && lintResult.errors.length > 0) {
      console.log('[Source Patch] AI returned code with lint errors - aborting')
      console.log('[Source Patch] Lint errors:', lintResult.errors.slice(0, 5))
      return null
    }

    return patchedSnippet
  } catch (error) {
    console.error('[Source Patch] EXCEPTION during AI SDK generation:', error)
    return null
  }
}

function deriveEffectiveTargetLine(params: {
  lines: string[]
  sourceLine: number
  element: SelectedElement
  textChange?: { oldText: string; newText: string }
}): number {
  const { lines, sourceLine, element, textChange } = params
  let effectiveTargetLine = sourceLine

  const tagLower = String(element.tagName || '').toLowerCase()

  const pickStableAttributes = (attrs?: Record<string, string>): Array<{ name: string; value: string; weight: number }> => {
    const banned = new Set([
      'class',
      'className',
      'id',
      'style',
      'data-cluso-id',
      'data-cluso-name',
      'data-cluso-ui',
    ])
    if (!attrs) return []
    const entries = Object.entries(attrs)
      .map(([name, value]) => ({ name: String(name || '').trim(), value: String(value || '').trim() }))
      .filter(({ name, value }) => !!name && !!value && !banned.has(name))

    const weightFor = (name: string, value: string) => {
      if (name === 'd') return 100
      if (name === 'href' || name === 'xlink:href') return 80
      if (name === 'src') return 80
      if (name === 'aria-label') return 70
      if (name === 'viewBox') return 60
      if (name === 'role' || name === 'type' || name === 'name' || name === 'alt' || name === 'title') return 50
      // Prefer longer values, but cap the influence.
      return Math.min(40, Math.max(10, value.length))
    }

    return entries
      .map(({ name, value }) => ({ name, value, weight: weightFor(name, value) }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
  }

  const stableAttrs = pickStableAttributes(element.attributes)

  const buildOpeningTagBlock = (startLineIdx: number): { endLineIdx: number; tagText: string } => {
    const maxTagLines = 12
    let j = startLineIdx
    let tagText = lines[j] || ''
    while (j + 1 < lines.length && j - startLineIdx < maxTagLines) {
      if (/(\/?>)/.test(tagText)) break
      j++
      tagText += '\n' + (lines[j] || '')
      if (/(\/?>)/.test(lines[j] || '')) break
    }
    return { endLineIdx: j, tagText }
  }

  const matchesAttrInTagText = (tagText: string, name: string, value: string): boolean => {
    if (!tagText || !name || !value) return false
    if (!tagText.includes(`${name}=`)) return false
    if (tagText.includes(value)) return true
    // Long values (e.g., SVG path d) can be split/wrapped; match on a prefix.
    const prefixLen = Math.min(64, Math.max(12, Math.floor(value.length / 3)))
    const prefix = value.slice(0, prefixLen)
    if (prefix && tagText.includes(prefix)) return true
    // Also try whitespace-normalized matching for attributes like d.
    const normalized = value.replace(/\s+/g, ' ').trim()
    const normalizedPrefix = normalized.slice(0, prefixLen)
    return !!normalizedPrefix && tagText.replace(/\s+/g, ' ').includes(normalizedPrefix)
  }

  // Line 0 or very low line numbers are unreliable (react-grab sometimes returns 0).
  if (!Number.isFinite(effectiveTargetLine) || effectiveTargetLine < 5) {
    console.log('[Source Patch] Line number unreliable (', effectiveTargetLine, '), searching for element...')

    const searchStrategies: { name: string; search: () => number }[] = []

    // Strategy 1: Search by class name (most reliable for styled elements)
    if (element.className) {
      const classes = element.className.split(/\s+/).filter(c => c.length > 2)
      for (const cls of classes) {
        searchStrategies.push({
          name: `class="${cls}"`,
          search: () => {
            for (let i = 0; i < lines.length; i++) {
              if (
                lines[i].includes(`class="${cls}"`) ||
                lines[i].includes(`className="${cls}"`) ||
                lines[i].includes(`className="${cls} `) ||
                lines[i].includes(`className={\`${cls}`)
              ) {
                return i + 1
              }
            }
            return 0
          },
        })
      }
    }

    // Strategy 2: Search by unique text content from element
    if (element.text && element.text.length > 3) {
      const searchTexts = element.text.split(/\s+/).filter(t => t.length > 4).slice(0, 3)
      for (const text of searchTexts) {
        searchStrategies.push({
          name: `text="${text}"`,
          search: () => {
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(text)) {
                // Prefer lines near JSX tags to avoid matching imports/constants.
                const nearby = `${lines[i - 1] || ''}\n${lines[i]}\n${lines[i + 1] || ''}`
                if (/<\w/.test(nearby) || /<\//.test(nearby)) return i + 1
              }
            }
            return 0
          },
        })
      }
    }

    // Strategy 2b: Search by textChange.oldText (common for inline edits when element.text is empty)
    if (textChange?.oldText && textChange.oldText.trim().length > 2) {
      const oldText = textChange.oldText.trim()
      searchStrategies.push({
        name: `oldText="${oldText.substring(0, 32)}"`,
        search: () => {
          for (let i = 0; i < lines.length; i++) {
            if (!lines[i].includes(oldText)) continue
            const nearby = `${lines[i - 1] || ''}\n${lines[i]}\n${lines[i + 1] || ''}`
            if (/<\w/.test(nearby) || /<\//.test(nearby) || />/.test(nearby)) return i + 1
          }
          return 0
        },
      })
    }

    // Strategy 3: Search by tag + id
    if (element.id) {
      searchStrategies.push({
        name: `id="${element.id}"`,
        search: () => {
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`id="${element.id}"`)) {
              return i + 1
            }
          }
          return 0
        },
      })
    }

    // Strategy 4: Search by tag + stable attribute(s) (e.g. svg path d, aria-label, src, viewBox)
    if (tagLower && stableAttrs.length > 0) {
      const attrsLabel = stableAttrs.map(a => `${a.name}=`).join(',')
      searchStrategies.push({
        name: `attrs(${attrsLabel})`,
        search: () => {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] || ''
            if (!line.toLowerCase().includes(`<${tagLower}`)) continue
            const { tagText } = buildOpeningTagBlock(i)
            const matched = stableAttrs.every(a => matchesAttrInTagText(tagText, a.name, a.value))
            if (matched) return i + 1
          }
          return 0
        },
      })
    }

    // Try each strategy until one finds the element
    for (const strategy of searchStrategies) {
      const found = strategy.search()
      if (found > 0) {
        effectiveTargetLine = found
        console.log('[Source Patch] Found element via', strategy.name, 'at line:', effectiveTargetLine)
        break
      }
    }

    if (!Number.isFinite(effectiveTargetLine) || effectiveTargetLine < 5) {
      console.log('[Source Patch] WARNING: Could not locate element in file, using fallback search')
      const tagLower = String(element.tagName || '').toLowerCase()
      for (let i = 0; i < lines.length; i++) {
        if (
          lines[i].toLowerCase().includes(`<${tagLower}`) &&
          (element.className ? lines[i].includes(element.className.split(' ')[0]) : true)
        ) {
          effectiveTargetLine = i + 1
          console.log('[Source Patch] Fallback found element at line:', effectiveTargetLine)
          break
        }
      }
    }
  }

  if (!Number.isFinite(effectiveTargetLine) || effectiveTargetLine < 1) return 1
  if (effectiveTargetLine > lines.length) return lines.length
  return effectiveTargetLine
}

/**
 * Race multiple LLM strategies and return the first successful result
 * PERFORMANCE: Runs Fast Apply and Cloud AI in parallel, returns first winner
 */
interface RaceStrategy {
  name: string
  execute: () => Promise<string | null>
  priority: number // Lower = higher priority (used for tie-breaking)
}

async function raceLLMStrategies(
  strategies: RaceStrategy[],
  timeoutMs: number = 30000
): Promise<{ code: string; strategy: string; durationMs: number } | null> {
  const startTime = performance.now()
  
  console.log(`[Source Patch] Racing ${strategies.length} LLM strategies...`)
  
  // Create promises with strategy metadata
  const racePromises = strategies.map(async (strategy) => {
    try {
      const result = await strategy.execute()
      if (result) {
        return { code: result, strategy: strategy.name, priority: strategy.priority }
      }
      throw new Error(`${strategy.name} returned null`)
    } catch (err) {
      throw new Error(`${strategy.name} failed: ${err}`)
    }
  })

  // Add a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('All strategies timed out')), timeoutMs)
  })

  try {
    // Promise.any returns the first fulfilled promise
    const winner = await Promise.any([...racePromises, timeoutPromise] as Promise<{ code: string; strategy: string; priority: number }>[])
    const durationMs = performance.now() - startTime
    console.log(`[Source Patch] Race winner: ${winner.strategy} in ${durationMs.toFixed(0)}ms`)
    return { code: winner.code, strategy: winner.strategy, durationMs }
  } catch (err) {
    // All strategies failed
    if (err instanceof AggregateError) {
      console.log('[Source Patch] All LLM strategies failed:')
      err.errors.forEach((e, i) => console.log(`  [${i}] ${e.message}`))
    } else {
      console.log('[Source Patch] Race failed:', err)
    }
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

  const startTime = performance.now()
  console.log('='.repeat(60))
  console.log('[Source Patch] === STARTING PATCH GENERATION ===')
  console.log('[Source Patch] STEP 1: Validating inputs...')
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
  console.log('[Source Patch] STEP 2: Resolving file path...', filePath, 'line:', source.line)

  // Resolve path (now async to support file searching)
  console.log('[Source Patch] STEP 2a: Calling resolveFilePath...')
  const resolveStart = performance.now()
  const { resolved, error: pathError, searchedPaths } = await resolveFilePath(filePath, projectPath)
  console.log('[Source Patch] STEP 2b: resolveFilePath completed in', (performance.now() - resolveStart).toFixed(0), 'ms')
  if (searchedPaths && searchedPaths.length > 1) {
    console.log('[Source Patch] Multiple files found:', searchedPaths)
  }

  if (!resolved) {
    // Try getCwd fallback
    if (window.electronAPI?.files?.getCwd) {
      console.log('[Source Patch] STEP 3: No projectPath, trying getCwd fallback...')
      const cwdStart = performance.now()
      const cwdResult = await fileService.getCwd()
      console.log('[Source Patch] STEP 3a: getCwd completed in', (performance.now() - cwdStart).toFixed(0), 'ms, result:', cwdResult)
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

  console.log('[Source Patch] STEP 4: Reading source file:', filePath)
  const readStart = performance.now()
  const fileResult = await fileService.readFileFull(filePath)
  console.log('[Source Patch] STEP 4a: File read completed in', (performance.now() - readStart).toFixed(0), 'ms')
  if (!fileResult.success || !fileResult.data) {
    console.log('[Source Patch] ABORT: Failed to read source file')
    console.log('[Source Patch] Error:', fileResult.error)
    return null
  }

  console.log('[Source Patch] STEP 5: File read successfully, length:', fileResult.data.length)
  const originalContent = fileResult.data

  // Determine change types
  const hasCssChanges = Object.keys(cssChanges).length > 0
  const hasTextChange = textChange && textChange.oldText && textChange.newText
  const hasSrcChange = srcChange && srcChange.newSrc

  // === FAST PATH: Try direct string manipulation first ===

  // Heuristic: if user asked to replace an image/hero banner but no srcChange was provided,
  // inject a placeholder hero image so we still generate a patch.
  let effectiveSrcChange = srcChange
  const wantsHeroImage =
    element.tagName?.toLowerCase() === 'img' &&
    userRequest &&
    /(?:replace|swap).*hero\s+banner|hero\s+image|new\s+banner/i.test(userRequest)

  if (!effectiveSrcChange && wantsHeroImage) {
    console.log('[Source Patch] Applying hero placeholder image heuristic')
    effectiveSrcChange = {
      oldSrc: (element as any)?.src || '',
      newSrc: HERO_PLACEHOLDER,
    }
  }

  const hasEffectiveSrcChange = effectiveSrcChange && effectiveSrcChange.newSrc

  // Fast path for src changes
  if (hasEffectiveSrcChange && !hasCssChanges && !hasTextChange) {
    const patchedContent = tryFastPathSrcChange(
      originalContent,
      source.line,
      effectiveSrcChange!.newSrc,
      effectiveSrcChange?.oldSrc
    )
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

  // Fast path for className changes requested by the user
  if (!hasEffectiveSrcChange && !hasCssChanges && !hasTextChange && userRequest) {
    const patchedContent = tryFastPathClassNameChange(originalContent, source.line, element, userRequest)
    if (patchedContent && patchedContent !== originalContent) {
      console.log('[Source Patch] FAST PATH SUCCESS - updated className directly')
      return {
        filePath,
        originalContent,
        patchedContent,
        lineNumber: source.line,
        generatedBy: 'fast-path',
      }
    }
  }

  // Fast path for text changes
  if (hasTextChange && !hasCssChanges) {
    // When the source map line is missing/0, derive a usable target line first.
    // This makes the scoped fast-path succeed even when oldText appears multiple times in the file.
    const effectiveTargetLine = deriveEffectiveTargetLine({
      lines: originalContent.split('\n'),
      sourceLine: source.line,
      element,
      textChange,
    })
    const patchedContent = tryFastPathTextChange(
      originalContent,
      textChange.oldText,
      textChange.newText,
      effectiveTargetLine
    )
    if (patchedContent) {
      return {
        filePath,
        originalContent,
        patchedContent,
        lineNumber: effectiveTargetLine,
        generatedBy: 'fast-path',
      }
    }
    console.log('[Source Patch] Text fast path failed - falling back to AI')
  }

  // Fast path for CSS changes
  if (hasCssChanges && (!textChange || !textChange.newText)) {
    // If the source line is missing/0, derive an effective target line first.
    // This also helps attribute-only matching (e.g., SVG <path d="..."> with no class/id).
    const effectiveTargetLine = deriveEffectiveTargetLine({
      lines: originalContent.split('\n'),
      sourceLine: source.line,
      element,
      textChange: textChange || undefined,
    })
    const patchedContent = tryFastPathCssChange(originalContent, effectiveTargetLine, element, cssChanges)
    if (patchedContent && patchedContent !== originalContent) {
      console.log('[Source Patch] FAST PATH SUCCESS - modified style directly')
      return {
        filePath,
        originalContent,
        patchedContent,
        lineNumber: effectiveTargetLine,
        generatedBy: 'fast-path',
      }
    }
    console.log('[Source Patch] CSS fast path failed - falling back to AI')
  }

  // Fast path for Tailwind class toggling (dark:, hover:, etc.)
  if (userRequest && /(?:toggle|add|remove)\s+(?:dark:|hover:|focus:|active:|md:|lg:|xl:|sm:)?\S+/i.test(userRequest)) {
    const patchedContent = tryFastPathTailwindToggle(originalContent, source.line, element, userRequest)
    if (patchedContent && patchedContent !== originalContent) {
      console.log('[Source Patch] FAST PATH SUCCESS - Tailwind class toggled')
      return {
        filePath,
        originalContent,
        patchedContent,
        lineNumber: source.line,
        generatedBy: 'fast-path',
      }
    }
  }

  // Fast path for boolean props (disabled, hidden, checked, etc.)
  const boolPropMatch = userRequest?.match(/(?:add|remove|toggle|set)\s+(disabled|hidden|checked|readonly|required|autoFocus|autoPlay|muted|loop|controls)/i)
  if (boolPropMatch) {
    const propName = boolPropMatch[1]
    const shouldBePresent = !/remove/i.test(userRequest!)
    const patchedContent = tryFastPathBooleanPropChange(originalContent, source.line, element, propName, shouldBePresent)
    if (patchedContent && patchedContent !== originalContent) {
      console.log('[Source Patch] FAST PATH SUCCESS - boolean prop changed')
      return {
        filePath,
        originalContent,
        patchedContent,
        lineNumber: source.line,
        generatedBy: 'fast-path',
      }
    }
  }

  // Fast path for common attribute changes (href, alt, title, placeholder)
  const attrMatch = userRequest?.match(/(?:change|set|update)\s+(href|alt|title|placeholder|name|aria-label)\s+(?:to\s+)?["']?([^"'\n]+)["']?/i)
  if (attrMatch) {
    const attrName = attrMatch[1]
    const newValue = attrMatch[2].trim()
    const patchedContent = tryFastPathAttributeChange(originalContent, source.line, element, attrName, newValue)
    if (patchedContent && patchedContent !== originalContent) {
      console.log('[Source Patch] FAST PATH SUCCESS - attribute changed')
      return {
        filePath,
        originalContent,
        patchedContent,
        lineNumber: source.line,
        generatedBy: 'fast-path',
      }
    }
  }

  // === AST-BASED PATCHING (Babel) ===
  // Try surgical AST edits before falling back to LLM
  // This is faster (~10-50ms) and more reliable for well-defined edits

  const astEditInfo = detectAstEditType(cssChanges, userRequest)
  if (astEditInfo) {
    console.log(`[Source Patch] Trying AST patch for edit type: ${astEditInfo.type}`)
    const astResult = tryAstPatch(originalContent, astEditInfo.type, astEditInfo.change, {
      sourceLine: source.line,
      element,
    })

    if (astResult.success && astResult.code && astResult.code !== originalContent) {
      console.log(`[Source Patch] AST PATCH SUCCESS in ${astResult.durationMs.toFixed(0)}ms`)
      return {
        filePath,
        originalContent,
        patchedContent: astResult.code,
        lineNumber: source.line,
        generatedBy: 'fast-path', // Counts as fast-path for metrics
        durationMs: astResult.durationMs,
      }
    }
    console.log('[Source Patch] AST patch failed:', astResult.error || 'no changes')
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
      // Validate JSX structure before accepting
      const jsxValidationResult = validateJsxStructure(morphResult.code)
      if (!jsxValidationResult.valid) {
        console.log('[Source Patch] Morph Fast Apply returned BROKEN JSX - rejecting')
        console.log('[Source Patch] Validation error:', jsxValidationResult.error)
      } else {
        // Lint the generated code
        const lintResult = await lintCodeSnippet(morphResult.code, filePath)
        if (!lintResult.valid && lintResult.errors && lintResult.errors.length > 0) {
          console.log('[Source Patch] Morph Fast Apply returned code with lint errors - rejecting')
          console.log('[Source Patch] Lint errors:', lintResult.errors.slice(0, 5))
        } else {
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
      }
    }

    console.log('[Source Patch] Morph Fast Apply failed or returned no changes, falling through to AI SDK. Error:', morphResult.error)
    // Continue to AI SDK fallback below
  }

  // When disableFastApply is true, skip local Fast Apply and go straight to AI SDK
  if (!params.disableFastApply) {

  // Calculate target line within the snippet (1-indexed)
  const targetLineInSnippet = targetLine - fastApplyStartLine

  // Try Fast Apply (local LLM) first with smaller snippet
  console.log('[Source Patch] STEP 6: Trying Fast Apply (local LLM)...')
  const fastApplyStart = performance.now()
  const fastApplyResult = await tryFastApply(fastApplySnippet, element, cssChanges, userRequest, targetLineInSnippet)
  console.log('[Source Patch] STEP 6a: Fast Apply completed in', (performance.now() - fastApplyStart).toFixed(0), 'ms')
  
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
  const effectiveTargetLine = deriveEffectiveTargetLine({
    lines,
    sourceLine: targetLine,
    element,
    textChange: textChange || undefined,
  })
  
  const startLine = Math.max(0, effectiveTargetLine - contextLines)
  const endLine = Math.min(lines.length, effectiveTargetLine + contextLines)

  if (startLine >= endLine) {
    console.log('[Source Patch] ABORT: Invalid line range:', startLine, 'to', endLine)
    return null
  }

  const codeSnippet = lines.slice(startLine, endLine).join('\n')
  console.log('[Source Patch] STEP 7: Preparing AI SDK call, snippet:', startLine + 1, 'to', endLine, '(', codeSnippet.length, 'chars), effectiveTargetLine:', effectiveTargetLine)

  // Fall back to AI SDK (uses configured provider - Claude Haiku, etc.)
  console.log('[Source Patch] STEP 7a: Calling useAIForPatch...')
  const aiStart = performance.now()
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
  console.log('[Source Patch] STEP 7b: useAIForPatch completed in', (performance.now() - aiStart).toFixed(0), 'ms')

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

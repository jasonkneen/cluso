/**
 * Element Context Utilities
 *
 * Helper functions for formatting element context like react-grab does
 * for optimal AI understanding with exact file/line info.
 */

import type { SelectedElement } from '../types'

/**
 * Format element context like react-grab does for optimal AI understanding.
 * This provides exact file/line info so the AI doesn't need to search.
 */
export function formatElementContext(element: SelectedElement): string {
  const { outerHTML, tagName, sourceLocation } = element

  // Format HTML (clean up for display)
  const html = outerHTML || `<${tagName.toLowerCase()}>...</${tagName.toLowerCase()}>`

  // Build source chain like react-grab
  let sourceChain = ''
  if (sourceLocation?.sources) {
    sourceChain = sourceLocation.sources
      .map(src => {
        // Clean up file path: http://localhost:4000/src/LandingPage.tsx?t=123 -> /src/LandingPage.tsx
        const file = src.file
          ?.replace(/^https?:\/\/localhost:\d+/, '')
          ?.replace(/\?.*$/, '') || 'unknown'
        return `  in ${src.name} (at ${file}:${src.line || 0})`
      })
      .join('\n')
  }

  return `ELEMENT:\n${html}\n${sourceChain}`
}

/**
 * Build a focused prompt for instant UI edits.
 * Tells the AI exactly where to edit, no searching needed.
 */
export function buildInstantUIPrompt(
  element: SelectedElement,
  userRequest: string,
  fileContent?: string
): string {
  const context = formatElementContext(element)
  const src = element.sourceLocation?.sources?.[0]
  const filePath = src?.file
    ?.replace(/^https?:\/\/localhost:\d+/, '')
    ?.replace(/\?.*$/, '') || ''
  const lineNum = src?.line || 0

  let prompt = `${context}

INSTRUCTION: ${userRequest}

IMPORTANT:
- The element is in ${filePath} around line ${lineNum}
- DO NOT search or grep - the file location is provided above
- Make ONLY the requested change
- Return the updated code snippet`

  if (fileContent) {
    // Add relevant lines from the file for context
    const lines = fileContent.split('\n')
    const startLine = Math.max(0, lineNum - 10)
    const endLine = Math.min(lines.length, lineNum + 20)
    const relevantLines = lines.slice(startLine, endLine).join('\n')
    prompt += `\n\nFILE CONTENT (lines ${startLine + 1}-${endLine}):\n\`\`\`tsx\n${relevantLines}\n\`\`\``
  }

  return prompt
}

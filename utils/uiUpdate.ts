/**
 * UI Update Utilities
 *
 * Instant UI Update - uses Gemini Flash for fast DOM modifications.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import type { SelectedElement } from '../types'
import type { ProviderConfig } from '../hooks/useAIChat'

export interface UIUpdateResult {
  cssChanges: Record<string, string>
  textChange?: string  // For changing element text content
  description: string
  success: boolean
}

export async function generateUIUpdate(
  element: SelectedElement,
  userRequest: string,
  apiKey: string,
  modelId: string = 'gemini-2.5-flash-lite',  // Default fallback, but should be passed explicitly
  providers?: ProviderConfig[]
): Promise<UIUpdateResult> {
  const isGeminiModel = modelId.startsWith('gemini-')
  const google = isGeminiModel ? createGoogleGenerativeAI({ apiKey }) : null

  const prompt = `You are a UI modification assistant. Given an HTML element and a user request, output ONLY a JSON object with changes.

Element:
- Tag: ${element.tagName}
- Classes: ${element.className || 'none'}
- ID: ${element.id || 'none'}
- Current text: ${element.text?.substring(0, 100) || 'none'}
- Current styles: ${JSON.stringify(element.computedStyle || {})}
- HTML: ${element.outerHTML?.substring(0, 500) || 'N/A'}

User request: "${userRequest}"

Respond with ONLY valid JSON. Use "textChange" for text modifications, "cssChanges" for style changes:
{
  "cssChanges": { "property": "value", ... },
  "textChange": "new text content if changing text",
  "description": "Brief description of changes"
}

IMPORTANT:
- For TEXT changes (changing what the element says): use "textChange" with the new text
- For STYLE changes (colors, sizes, spacing): use "cssChanges" with CSS properties
- Do NOT use cssChanges.content for text - that only works for ::before/::after pseudo-elements

Examples:
- "make it red" → {"cssChanges": {"color": "red"}, "description": "Changed text color to red"}
- "change to Download" → {"textChange": "Download", "description": "Changed text to Download"}
- "Download Now" → {"textChange": "Download Now", "description": "Changed text to Download Now"}
- "bigger font" → {"cssChanges": {"fontSize": "1.5em"}, "description": "Increased font size"}
- "make it say Hello" → {"textChange": "Hello", "description": "Changed text to Hello"}
- "red and say Click Me" → {"cssChanges": {"color": "red"}, "textChange": "Click Me", "description": "Changed color to red and text to Click Me"}`

  try {
    console.log(`[UI Update] Calling ${modelId} for UI changes...`)
    let text = ''

    if (isGeminiModel && google) {
      console.log('[UI Update] Using Google direct generateText')
      const result = await generateText({
        model: google(modelId),
        prompt,
        maxTokens: 200,
      })
      text = result.text.trim()
    } else if (window.electronAPI?.aiSdk?.generate) {
      console.log('[UI Update] Using Electron AI SDK generate')
      const providersMap: Record<string, string> = {}
      for (const p of providers || []) {
        if (p.apiKey) providersMap[p.id] = p.apiKey
      }
      const sdkResult = await window.electronAPI.aiSdk.generate({
        modelId,
        messages: [{ role: 'user', content: prompt }],
        providers: providersMap,
        system: 'You are a UI modification assistant. Output ONLY valid JSON.',
        maxSteps: 1,
      })
      if (!sdkResult.success || !sdkResult.text) {
        throw new Error(sdkResult.error || 'AI SDK generate failed')
      }
      text = sdkResult.text.trim()
    } else {
      throw new Error('No available provider for UI update')
    }

    // Parse the JSON response
    console.log('[UI Update] Gemini response:', text)

    // Handle markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]
    const jsonStr = jsonMatch[1] || text
    console.log('[UI Update] Parsing JSON:', jsonStr)
    const parsed = JSON.parse(jsonStr)

    console.log('[UI Update] Parsed result:', parsed)
    return {
      cssChanges: parsed.cssChanges || {},
      textChange: parsed.textChange,
      description: parsed.description || 'UI updated',
      success: true,
    }
  } catch (error) {
    console.error('[UI Update] Failed to generate:', error)
    return {
      cssChanges: {},
      description: 'Failed to generate UI changes',
      success: false,
    }
  }
}

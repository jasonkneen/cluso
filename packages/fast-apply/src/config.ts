import type { ModelVariant, ModelDefinition } from './types'

/**
 * Available model variants and their specifications
 */
export const MODELS: Record<ModelVariant, ModelDefinition> = {
  'Q4_K_M': {
    file: 'unsloth.Q4_K_M.gguf',
    size: 986,
    quality: 'Good',
    memory: 1500,
    description: 'Smallest & fastest. Recommended for most users.'
  },
  'Q5_K_M': {
    file: 'unsloth.Q5_K_M.gguf',
    size: 1130,
    quality: 'Better',
    memory: 1700,
    description: 'Slightly better quality, moderate size.'
  },
  'Q8_0': {
    file: 'unsloth.Q8_0.gguf',
    size: 1650,
    quality: 'High',
    memory: 2200,
    description: 'High quality for complex patches.'
  },
  'F16': {
    file: 'unsloth.F16.gguf',
    size: 3090,
    quality: 'Maximum',
    memory: 4000,
    description: 'Maximum quality. Requires more RAM.'
  },
}

/**
 * Default model to use (smallest, fastest download)
 */
export const DEFAULT_MODEL: ModelVariant = 'Q4_K_M'

/**
 * HuggingFace repository containing the models
 */
export const MODEL_REPO = 'Kortix/FastApply-1.5B-v1.0_GGUF'

/**
 * Default storage directory for models (relative to home)
 */
export const DEFAULT_STORAGE_DIR = '.cluso/models/fast-apply'

/**
 * Inference timeout in milliseconds
 */
export const INFERENCE_TIMEOUT = 30000

/**
 * Temperature for inference (0 = deterministic)
 */
export const TEMPERATURE = 0

/**
 * Maximum tokens to generate
 */
export const MAX_TOKENS = 4096

/**
 * System prompt for the FastApply model
 */
export const SYSTEM_PROMPT = `You are a coding assistant that helps merge code updates, ensuring every modification is fully integrated.`

/**
 * User prompt template for the FastApply model
 * Uses {original_code} and {update_snippet} placeholders
 */
export const USER_PROMPT_TEMPLATE = `Merge all changes from the <update> snippet into the <code> below.
- Preserve the code's structure, order, comments, and indentation exactly.
- Output only the updated code, enclosed within <updated-code> and </updated-code> tags.
- Do not include any additional text, explanations, placeholders, ellipses, or code fences.

<code>{original_code}</code>

<update>{update_snippet}</update>

Provide the complete updated code.`

/**
 * Build the full chat prompt for inference
 */
export function buildPrompt(originalCode: string, updateSnippet: string): string {
  const userPrompt = USER_PROMPT_TEMPLATE
    .replace('{original_code}', originalCode)
    .replace('{update_snippet}', updateSnippet)

  // Use ChatML format for Qwen models
  return `<|im_start|>system
${SYSTEM_PROMPT}<|im_end|>
<|im_start|>user
${userPrompt}<|im_end|>
<|im_start|>assistant
`
}

/**
 * Parse the model output to extract the updated code
 */
export function parseOutput(output: string): string | null {
  if (!output || typeof output !== 'string') {
    console.log('[FastApply Parse] Invalid output type:', typeof output)
    return null
  }

  console.log('[FastApply Parse] Raw output length:', output.length)
  console.log('[FastApply Parse] First 500 chars:', output.substring(0, 500))

  // Look for <updated-code>...</updated-code> tags
  const match = output.match(/<updated-code>([\s\S]*?)<\/updated-code>/)
  if (match) {
    console.log('[FastApply Parse] Found <updated-code> tags')
    return match[1].trim()
  }

  // Also try with self-closing or slight variations
  const altMatch = output.match(/<updated[-_]?code>([\s\S]*?)<\/updated[-_]?code>/i)
  if (altMatch) {
    console.log('[FastApply Parse] Found alternate <updated-code> tags')
    return altMatch[1].trim()
  }

  // Fallback: try to find code between common markers
  const codeBlockMatch = output.match(/```[\w]*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    console.log('[FastApply Parse] Found code block')
    return codeBlockMatch[1].trim()
  }

  // Check if output starts with code-like content (JSX, HTML, etc.)
  const trimmed = output.trim()

  // Remove any ChatML end tokens that might be present
  const cleanedOutput = trimmed
    .replace(/<\|im_end\|>/g, '')
    .replace(/<\|im_start\|>[\s\S]*$/g, '')
    .trim()

  // If it looks like code (starts with <, import, export, const, function, etc.)
  const codePatterns = /^(<[\w]|import\s|export\s|const\s|let\s|var\s|function\s|class\s|\{)/
  if (cleanedOutput.length > 0 && codePatterns.test(cleanedOutput)) {
    console.log('[FastApply Parse] Output looks like code, using as-is')
    return cleanedOutput
  }

  // Last resort: if it's not prose, return it
  if (cleanedOutput.length > 0 && !cleanedOutput.startsWith('I ') && !cleanedOutput.startsWith('The ') && !cleanedOutput.startsWith('Here')) {
    console.log('[FastApply Parse] Using fallback - output does not look like prose')
    return cleanedOutput
  }

  console.log('[FastApply Parse] Could not parse output')
  return null
}

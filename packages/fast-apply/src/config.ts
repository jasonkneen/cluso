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
 * Inference timeout in milliseconds (30s - reduced from 60s for better UX)
 */
export const INFERENCE_TIMEOUT = 30000

/**
 * Temperature for inference
 * Note: 0 causes instability in fine-tuned models, use small positive value
 */
export const TEMPERATURE = 0.1

/**
 * Maximum tokens to generate (8192 for complete file outputs)
 */
export const MAX_TOKENS = 8192

/**
 * System prompt for the FastApply model
 * Note: Must be specific about the model's task - vague prompts cause prose fallback
 */
export const SYSTEM_PROMPT = `You are a coding assistant that applies code updates by REPLACING matching elements in-place. When given an update snippet, find the matching element in the original code and REPLACE it - do NOT insert a duplicate. Preserve all other code exactly. Return only the complete updated code.`

/**
 * User prompt template for the FastApply model
 * Uses {original_code} and {update_snippet} placeholders
 * Note: Model outputs code directly, not wrapped in tags - it wasn't trained for that
 */
export const USER_PROMPT_TEMPLATE = `Apply the update to the code. If the update shows "FIND: X" and "REPLACE WITH: Y", find X in the code and replace it with Y. Do NOT insert duplicates - replace in-place.

<code>
{original_code}
</code>

<update>
{update_snippet}
</update>

Return the complete updated code with the change applied.`

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
 * Note: FastApply model outputs code directly without wrapper tags
 */
export function parseOutput(output: string): string | null {
  if (!output || typeof output !== 'string') {
    console.log('[FastApply Parse] Invalid output type:', typeof output)
    return null
  }

  console.log('[FastApply Parse] Raw output length:', output.length)
  console.log('[FastApply Parse] First 500 chars:', output.substring(0, 500))

  const trimmed = output.trim()

  // Remove ChatML end tokens that might be present
  let cleanedOutput = trimmed
    .replace(/<\|im_end\|>/g, '')
    .replace(/<\|im_start\|>[\s\S]*$/g, '')
    .trim()

  // CRITICAL: Check for prose FIRST before anything else
  // Model sometimes outputs explanations before/instead of code
  const proseIndicators = [
    /^I\s/i,               // "I "
    /^I['']/i,             // "I'll", "I've", "I'd" (contractions)
    /^The\s/i,             // "The "
    /^Here/i,              // "Here", "Here's", "Here is"
    /^This\s/i,            // "This "
    /^To\s/i,              // "To "
    /^You\s/i,             // "You "
    /^Let\s?me/i,          // "Let me", "Let's"
    /^Sure/i,              // "Sure", "Sure!"
    /^Certainly/i,         // "Certainly"
    /^Of course/i,         // "Of course"
    /^Okay/i,              // "Okay", "Ok"
    /^First/i,             // "First,"
    /^Now\s/i,             // "Now let's" (but not "Now()" code)
    /^Below/i,             // "Below is"
    /^Great/i,             // "Great!"
    /^Happy/i,             // "Happy to help"
    /^In\s/i,              // "In this", "In order to"
    /^Note/i,              // "Note:", "Note that"
  ]

  for (const pattern of proseIndicators) {
    if (pattern.test(cleanedOutput)) {
      console.log('[FastApply Parse] ❌ Output STARTS with prose - rejecting entirely')
      console.log('[FastApply Parse] First 100 chars:', cleanedOutput.substring(0, 100))
      return null
    }
  }

  // Primary path: FastApply outputs code directly, check if it looks like code at START
  // NO multiline flag - must start with code pattern
  const codePatterns = /^(<[\w!]|import\s|export\s|const\s|let\s|var\s|function\s|class\s|interface\s|type\s|enum\s|\/\/|\/\*|\{|#|package\s|using\s|public\s|private\s|protected\s|def\s|async\s|await\s|\s)/

  if (cleanedOutput.length > 0 && codePatterns.test(cleanedOutput)) {
    console.log('[FastApply Parse] ✅ Output recognized as code')
    return cleanedOutput
  }

  // Secondary: Check for markdown code fences (model might still use them)
  // But ONLY if output doesn't start with prose
  const codeBlockMatch = cleanedOutput.match(/```[\w]*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    console.log('[FastApply Parse] ✅ Found code in markdown fences')
    return codeBlockMatch[1].trim()
  }

  // Tertiary: Check for legacy <updated-code> tags (backwards compat)
  const legacyMatch = cleanedOutput.match(/<updated[-_]?code>([\s\S]*?)<\/updated[-_]?code>/i)
  if (legacyMatch) {
    console.log('[FastApply Parse] ✅ Found legacy <updated-code> tags')
    return legacyMatch[1].trim()
  }

  // If output is substantial and doesn't look like prose, use it
  if (cleanedOutput.length > 50) {
    console.log('[FastApply Parse] ⚠️ Using output as-is (>50 chars, not prose)')
    return cleanedOutput
  }

  console.log('[FastApply Parse] ❌ Could not parse output - too short or unrecognized')
  return null
}

/**
 * OpenAIEmbedder - Generate embeddings using OpenAI's API
 *
 * Features:
 * - Uses text-embedding-3-small (1536 dims) or text-embedding-3-large (3072 dims)
 * - Parallel API calls for high throughput
 * - Configurable concurrency and batch size
 * - Rate limiting support
 */

import type {
  EmbedderOptions,
  ModelDownloadProgress,
  ModelInfo,
  Embedder as IEmbedder,
} from './types.js'

// OpenAI embedding models
export type OpenAIEmbeddingModel = 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002'

// Model dimensions
const MODEL_DIMENSIONS: Record<OpenAIEmbeddingModel, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
}

// Max tokens per model (for truncation)
const MAX_TOKENS = 8191  // All OpenAI embedding models support 8191 tokens

/**
 * Options for OpenAI embedder
 */
export interface OpenAIEmbedderOptions extends EmbedderOptions {
  apiKey?: string  // Defaults to OPENAI_API_KEY env var
  model?: OpenAIEmbeddingModel  // Default: text-embedding-3-small
  baseUrl?: string  // For proxies or Azure
  batchSize?: number  // Max inputs per API call (default: 100)
  concurrency?: number  // Parallel API calls (default: 4)
  retries?: number  // Retry attempts on failure (default: 3)
  dimensions?: number  // Optional dimension reduction for text-embedding-3-* models
}

interface OpenAIEmbeddingResponse {
  object: string
  data: Array<{
    object: string
    embedding: number[]
    index: number
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

export class OpenAIEmbedder implements IEmbedder {
  private apiKey: string
  private model: OpenAIEmbeddingModel
  private baseUrl: string
  private batchSize: number
  private concurrency: number
  private retries: number
  private dimensions?: number
  private verbose: boolean
  private onProgress?: (progress: ModelDownloadProgress) => void

  private initialized = false
  private totalTokensUsed = 0

  constructor(options: OpenAIEmbedderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API key required. Set OPENAI_API_KEY env var or pass apiKey option.')
    }

    this.apiKey = apiKey
    this.model = options.model ?? 'text-embedding-3-small'
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1'
    this.batchSize = options.batchSize ?? 100  // OpenAI supports up to 2048, but 100 is safer
    this.concurrency = options.concurrency ?? 4  // Parallel API calls
    this.retries = options.retries ?? 3
    this.dimensions = options.dimensions
    this.verbose = options.verbose ?? false
    this.onProgress = options.onProgress

    // Validate dimensions for models that support it
    if (this.dimensions && this.model === 'text-embedding-ada-002') {
      this.log('Warning: text-embedding-ada-002 does not support dimension reduction')
      this.dimensions = undefined
    }
  }

  /**
   * Initialize (no-op for OpenAI, but maintains interface compatibility)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    this.log(`Initializing OpenAI embedder with model: ${this.model}`)

    this.onProgress?.({
      status: 'loading',
      progress: 0,
    })

    // Test the API with a simple request
    try {
      await this.embed('test')
      this.initialized = true

      this.onProgress?.({
        status: 'ready',
        progress: 100,
      })

      this.log('OpenAI embedder ready')
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to initialize OpenAI embedder: ${msg}`)
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    const truncated = this.truncateText(text)
    const response = await this.callApi([truncated])
    return response.data[0].embedding
  }

  /**
   * Generate embeddings for multiple texts with parallel batching
   *
   * This is the high-performance path. It:
   * 1. Splits texts into batches of `batchSize`
   * 2. Runs up to `concurrency` batches in parallel
   * 3. Merges results preserving order
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    // Truncate all texts
    const truncatedTexts = texts.map(t => this.truncateText(t))

    // Split into batches
    const batches: string[][] = []
    for (let i = 0; i < truncatedTexts.length; i += this.batchSize) {
      batches.push(truncatedTexts.slice(i, i + this.batchSize))
    }

    this.log(`Processing ${texts.length} texts in ${batches.length} batches (concurrency: ${this.concurrency})`)

    // Process batches with concurrency limit
    const results: number[][][] = []

    for (let i = 0; i < batches.length; i += this.concurrency) {
      const concurrentBatches = batches.slice(i, i + this.concurrency)

      const batchResults = await Promise.all(
        concurrentBatches.map(async (batch, batchIndex) => {
          const response = await this.callApiWithRetry(batch)

          // Sort by index to ensure order
          const sorted = response.data.sort((a, b) => a.index - b.index)
          return sorted.map(d => d.embedding)
        })
      )

      results.push(...batchResults)

      // Report progress
      const processed = Math.min((i + this.concurrency) * this.batchSize, texts.length)
      this.log(`Processed ${processed}/${texts.length} texts`)
    }

    // Flatten results
    return results.flat()
  }

  /**
   * Get model information
   */
  getModelInfo(): ModelInfo {
    const dims = this.dimensions ?? MODEL_DIMENSIONS[this.model]
    return {
      name: `openai/${this.model}`,
      dimensions: dims,
      maxTokens: MAX_TOKENS,
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): { totalTokens: number } {
    return { totalTokens: this.totalTokensUsed }
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.initialized = false
    this.log(`OpenAI embedder disposed. Total tokens used: ${this.totalTokensUsed}`)
  }

  // ==========================================================================
  // Private methods
  // ==========================================================================

  /**
   * Call OpenAI API with retry logic
   */
  private async callApiWithRetry(texts: string[]): Promise<OpenAIEmbeddingResponse> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        return await this.callApi(texts)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry on auth errors
        if (lastError.message.includes('401') || lastError.message.includes('invalid_api_key')) {
          throw lastError
        }

        // Exponential backoff for rate limits
        if (lastError.message.includes('429') || lastError.message.includes('rate_limit')) {
          const delay = Math.pow(2, attempt) * 1000
          this.log(`Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${this.retries}`)
          await this.sleep(delay)
          continue
        }

        // Linear backoff for other errors
        const delay = 1000 * (attempt + 1)
        this.log(`Error, waiting ${delay}ms before retry ${attempt + 1}/${this.retries}: ${lastError.message}`)
        await this.sleep(delay)
      }
    }

    throw lastError ?? new Error('API call failed after retries')
  }

  /**
   * Call OpenAI embeddings API
   */
  private async callApi(texts: string[]): Promise<OpenAIEmbeddingResponse> {
    const url = `${this.baseUrl}/embeddings`

    const body: Record<string, unknown> = {
      model: this.model,
      input: texts,
    }

    // Add dimensions if specified (only for text-embedding-3-* models)
    if (this.dimensions && this.model.startsWith('text-embedding-3')) {
      body.dimensions = this.dimensions
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`)
    }

    const data = await response.json() as OpenAIEmbeddingResponse

    // Track token usage
    if (data.usage) {
      this.totalTokensUsed += data.usage.total_tokens
    }

    return data
  }

  /**
   * Truncate text to fit within token limit
   * Uses rough estimate of 4 characters per token
   */
  private truncateText(text: string): string {
    const maxChars = MAX_TOKENS * 4
    if (text.length <= maxChars) return text
    return text.substring(0, maxChars)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private log(...args: unknown[]): void {
    if (this.verbose) {
      console.log('[OpenAIEmbedder]', ...args)
    }
  }
}

/**
 * Check if OpenAI API key is available
 */
export function checkOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY
}

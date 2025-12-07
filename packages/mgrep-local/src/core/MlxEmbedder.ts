/**
 * MlxEmbedder - GPU-accelerated embeddings using MLX on Apple Silicon
 *
 * Connects to qwen3-embeddings-mlx REST server for fast embedding generation.
 * Supports Qwen3-Embedding models (0.6B, 4B, 8B variants)
 *
 * Performance comparison:
 * - CPU (all-MiniLM-L6-v2): ~1K tokens/sec
 * - MLX (Qwen3-0.6B): ~44K tokens/sec on M2 Max
 *
 * Usage:
 *   # Clone and install the MLX server first:
 *   git clone https://github.com/jakedahn/qwen3-embeddings-mlx.git
 *   cd qwen3-embeddings-mlx
 *   pip install -r requirements.txt
 *   python server.py
 *
 *   # Then use this embedder:
 *   const embedder = new MlxEmbedder({ serverUrl: 'http://localhost:8000' })
 */

import type {
  EmbedderOptions,
  ModelDownloadProgress,
  ModelInfo,
  Embedder as IEmbedder,
} from './types.js'

// MLX model configurations
const MLX_MODELS = {
  '0.6B': { dimensions: 1024, maxTokens: 8192 },
  '4B': { dimensions: 2560, maxTokens: 8192 },
  '8B': { dimensions: 3584, maxTokens: 8192 },
} as const

type MlxModelSize = keyof typeof MLX_MODELS

export interface MlxEmbedderOptions extends EmbedderOptions {
  serverUrl?: string  // default: http://localhost:8000
  modelSize?: MlxModelSize  // default: '0.6B'
  timeout?: number  // request timeout in ms (default: 30000)
}

export class MlxEmbedder implements IEmbedder {
  private serverUrl: string
  private modelSize: MlxModelSize
  private timeout: number
  private verbose: boolean
  private onProgress?: (progress: ModelDownloadProgress) => void

  private initialized = false
  private serverAvailable = false

  constructor(options: MlxEmbedderOptions = {}) {
    this.serverUrl = options.serverUrl ?? 'http://localhost:8000'
    this.modelSize = options.modelSize ?? '0.6B'
    this.timeout = options.timeout ?? 30000
    this.verbose = options.verbose ?? false
    this.onProgress = options.onProgress
  }

  /**
   * Initialize by checking if MLX server is available
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.onProgress?.({
      status: 'loading',
      progress: 0,
    })

    this.log('Checking MLX server at:', this.serverUrl)

    try {
      // Check server health
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        this.serverAvailable = true
        this.initialized = true
        this.onProgress?.({
          status: 'ready',
          progress: 100,
        })
        this.log('MLX server connected successfully')
      } else {
        throw new Error(`Server returned ${response.status}`)
      }
    } catch (error) {
      // Try a simple embed request as fallback health check
      try {
        await this.embed('test')
        this.serverAvailable = true
        this.initialized = true
        this.onProgress?.({
          status: 'ready',
          progress: 100,
        })
        this.log('MLX server connected (via embed test)')
      } catch {
        this.log('MLX server not available:', error)
        throw new Error(
          `MLX server not available at ${this.serverUrl}. ` +
          'Start it with: pip install qwen3-embeddings-mlx && qwen3-embeddings serve --model 0.6B'
        )
      }
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.serverUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`MLX server error: ${response.status} - ${errorText}`)
      }

      const result = await response.json() as { embedding: number[] }
      return result.embedding
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(`MLX embedding request timed out after ${this.timeout}ms`)
      }
      throw error
    }
  }

  /**
   * Generate embeddings for multiple texts efficiently
   * Uses /embed_batch endpoint for native batch processing
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return []
    }

    try {
      const response = await fetch(`${this.serverUrl}/embed_batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texts }),
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`MLX server error: ${response.status} - ${errorText}`)
      }

      const result = await response.json() as { embeddings: number[][] }
      return result.embeddings
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(`MLX embedding request timed out after ${this.timeout}ms`)
      }
      throw error
    }
  }

  /**
   * Get model information
   */
  getModelInfo(): ModelInfo {
    const config = MLX_MODELS[this.modelSize]
    return {
      name: `Qwen3-Embedding-${this.modelSize}-4bit-DWQ`,
      dimensions: config.dimensions,
      maxTokens: config.maxTokens,
    }
  }

  /**
   * Check if server is available
   */
  isAvailable(): boolean {
    return this.serverAvailable
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.initialized = false
    this.serverAvailable = false
    this.log('MlxEmbedder disposed')
  }

  private log(...args: unknown[]): void {
    if (this.verbose) {
      console.log('[MlxEmbedder]', ...args)
    }
  }
}

/**
 * Check if MLX server is running
 */
export async function checkMlxServer(serverUrl = 'http://localhost:8000'): Promise<boolean> {
  try {
    const response = await fetch(`${serverUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    // Try embed endpoint as fallback
    try {
      const response = await fetch(`${serverUrl}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: ['test'] }),
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }
}

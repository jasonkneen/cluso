/**
 * LlamaCppEmbedder - GPU-accelerated embeddings using node-llama-cpp
 *
 * Uses Metal GPU on Apple Silicon for fast embedding generation.
 * Pure TypeScript - no Python or external servers required.
 *
 * Supported models:
 * - bge-small-en-v1.5 (384 dims, ~130MB) - Fast, good quality
 * - bge-base-en-v1.5 (768 dims, ~420MB) - Balanced
 * - bge-large-en-v1.5 (1024 dims, ~1.3GB) - Best quality
 * - nomic-embed-text-v1.5 (768 dims, ~270MB) - Great for code
 *
 * Usage:
 *   const embedder = new LlamaCppEmbedder({ modelPath: 'path/to/model.gguf' })
 *   await embedder.initialize()
 *   const embedding = await embedder.embed('hello world')
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

import type {
  EmbedderOptions,
  ModelDownloadProgress,
  ModelInfo,
  Embedder as IEmbedder,
} from './types.js'

// Lazy-load node-llama-cpp to avoid ESM issues
type LlamaModule = typeof import('node-llama-cpp')
let llamaModule: LlamaModule | null = null

async function loadLlamaModule(): Promise<LlamaModule> {
  if (!llamaModule) {
    llamaModule = await import('node-llama-cpp')
  }
  return llamaModule
}

// Available embedding models (GGUF format from HuggingFace)
export const EMBEDDING_MODELS = {
  'bge-small-en-v1.5': {
    url: 'https://huggingface.co/CompendiumLabs/bge-small-en-v1.5-gguf/resolve/main/bge-small-en-v1.5-q8_0.gguf',
    filename: 'bge-small-en-v1.5-q8_0.gguf',
    dimensions: 384,
    size: '130MB',
  },
  'bge-base-en-v1.5': {
    url: 'https://huggingface.co/CompendiumLabs/bge-base-en-v1.5-gguf/resolve/main/bge-base-en-v1.5-q8_0.gguf',
    filename: 'bge-base-en-v1.5-q8_0.gguf',
    dimensions: 768,
    size: '420MB',
  },
  'nomic-embed-text-v1.5': {
    url: 'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q8_0.gguf',
    filename: 'nomic-embed-text-v1.5.Q8_0.gguf',
    dimensions: 768,
    size: '270MB',
  },
} as const

export type EmbeddingModelName = keyof typeof EMBEDDING_MODELS

export interface LlamaCppEmbedderOptions extends EmbedderOptions {
  modelPath?: string  // Direct path to GGUF file
  modelName?: EmbeddingModelName  // Model to auto-download
  cacheDir?: string  // Where to store downloaded models
  gpuLayers?: number  // Number of layers to offload to GPU (default: all)
}

const DEFAULT_MODEL = 'bge-small-en-v1.5'
const DEFAULT_CACHE_DIR = join(homedir(), '.cache', 'mgrep-local', 'llama-models')

export class LlamaCppEmbedder implements IEmbedder {
  private modelPath?: string
  private modelName: EmbeddingModelName
  private cacheDir: string
  private gpuLayers?: number
  private verbose: boolean
  private onProgress?: (progress: ModelDownloadProgress) => void

  // Use any types since we're using dynamic imports
  private llama?: any
  private model?: any
  private context?: any
  private initialized = false

  constructor(options: LlamaCppEmbedderOptions = {}) {
    this.modelPath = options.modelPath
    this.modelName = (options.modelName as EmbeddingModelName) ?? DEFAULT_MODEL
    this.cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR
    this.gpuLayers = options.gpuLayers
    this.verbose = options.verbose ?? false
    this.onProgress = options.onProgress
  }

  /**
   * Initialize the embedder - loads model into GPU memory
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.onProgress?.({ status: 'loading', progress: 0 })
    this.log('Initializing LlamaCpp embedder...')

    // Get or download model
    const modelPath = await this.getModelPath()
    this.log('Using model:', modelPath)

    // Initialize llama.cpp (dynamically imported)
    const { getLlama } = await loadLlamaModule()
    this.llama = await getLlama()
    this.log('Llama.cpp initialized with GPU:', this.llama.gpu ? 'enabled' : 'disabled')

    // Load model
    this.onProgress?.({ status: 'loading', progress: 30 })
    this.model = await this.llama.loadModel({
      modelPath,
      gpuLayers: this.gpuLayers,
    })
    this.log('Model loaded')

    // Create embedding context
    this.onProgress?.({ status: 'loading', progress: 80 })
    this.context = await this.model.createEmbeddingContext()
    this.log('Embedding context created')

    this.initialized = true
    this.onProgress?.({ status: 'ready', progress: 100 })
    this.log('LlamaCpp embedder ready')
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    if (!this.context) {
      throw new Error('Embedder not initialized. Call initialize() first.')
    }

    const embedding = await this.context.getEmbeddingFor(text)
    return Array.from(embedding.vector)
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.context) {
      throw new Error('Embedder not initialized. Call initialize() first.')
    }

    const embeddings: number[][] = []
    for (const text of texts) {
      const embedding = await this.context.getEmbeddingFor(text)
      embeddings.push(Array.from(embedding.vector))
    }
    return embeddings
  }

  /**
   * Get model information
   */
  getModelInfo(): ModelInfo {
    const modelConfig = EMBEDDING_MODELS[this.modelName]
    return {
      name: this.modelName,
      dimensions: modelConfig?.dimensions ?? 384,
      maxTokens: 512,  // Most embedding models have 512 token limit
    }
  }

  /**
   * Check if embedder is ready
   */
  isAvailable(): boolean {
    return this.initialized
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    if (this.context) {
      await this.context.dispose()
      this.context = undefined
    }
    if (this.model) {
      await this.model.dispose()
      this.model = undefined
    }
    this.initialized = false
    this.log('LlamaCpp embedder disposed')
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private async getModelPath(): Promise<string> {
    // If explicit path provided, use it
    if (this.modelPath) {
      if (!existsSync(this.modelPath)) {
        throw new Error(`Model file not found: ${this.modelPath}`)
      }
      return this.modelPath
    }

    // Check if model is cached
    const modelConfig = EMBEDDING_MODELS[this.modelName]
    if (!modelConfig) {
      throw new Error(`Unknown model: ${this.modelName}. Available: ${Object.keys(EMBEDDING_MODELS).join(', ')}`)
    }

    const cachedPath = join(this.cacheDir, modelConfig.filename)
    if (existsSync(cachedPath)) {
      this.log('Using cached model:', cachedPath)
      return cachedPath
    }

    // Download model
    this.log(`Downloading ${this.modelName} (${modelConfig.size})...`)
    await this.downloadModel(modelConfig.url, cachedPath)

    return cachedPath
  }

  private async downloadModel(url: string, destPath: string): Promise<void> {
    const { mkdir } = await import('fs/promises')
    const { dirname } = await import('path')

    // Ensure cache directory exists
    await mkdir(dirname(destPath), { recursive: true })

    this.onProgress?.({ status: 'downloading', progress: 0 })

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download model: ${response.statusText}`)
    }

    const contentLength = parseInt(response.headers.get('content-length') ?? '0')
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response body reader')
    }

    const chunks: Uint8Array[] = []
    let receivedLength = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      receivedLength += value.length

      if (contentLength > 0) {
        const progress = Math.round((receivedLength / contentLength) * 100)
        this.onProgress?.({ status: 'downloading', progress })
        if (this.verbose && progress % 10 === 0) {
          this.log(`Download progress: ${progress}%`)
        }
      }
    }

    // Write to file
    const { writeFile } = await import('fs/promises')
    const buffer = Buffer.concat(chunks)
    await writeFile(destPath, buffer)

    this.log('Model downloaded to:', destPath)
  }

  private log(...args: unknown[]): void {
    if (this.verbose) {
      console.log('[LlamaCppEmbedder]', ...args)
    }
  }
}

/**
 * Check if GPU is available for llama.cpp
 */
export async function checkGpuAvailable(): Promise<{ available: boolean; type: string }> {
  try {
    const { getLlama } = await loadLlamaModule()
    const llama = await getLlama()
    const gpuType = llama.gpu
    return {
      available: !!gpuType,
      type: typeof gpuType === 'string' ? gpuType : (gpuType ? 'gpu' : 'none'),
    }
  } catch (error) {
    // ESM module errors are expected in CommonJS builds - don't log
    // The factory will handle fallback silently
    return { available: false, type: 'none' }
  }
}

/**
 * List available embedding models
 */
export function listEmbeddingModels(): Array<{
  name: string
  dimensions: number
  size: string
}> {
  return Object.entries(EMBEDDING_MODELS).map(([name, config]) => ({
    name,
    dimensions: config.dimensions,
    size: config.size,
  }))
}

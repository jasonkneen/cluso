/**
 * Embedder Factory - Auto-selects the best available embedding backend
 *
 * Priority order:
 * 1. OpenAI (if API key available and preferred)
 * 2. LlamaCpp GPU (pure TypeScript, Metal on Apple Silicon)
 * 3. MLX GPU (requires Python server)
 * 4. Xenova/transformers CPU (fallback)
 *
 * Usage:
 *   const embedder = await createEmbedder({ verbose: true })
 *   // Automatically uses best available backend
 */

import { Embedder } from './Embedder.js'
import { MlxEmbedder, checkMlxServer } from './MlxEmbedder.js'
import { LlamaCppEmbedder, checkGpuAvailable, type EmbeddingModelName } from './LlamaCppEmbedder.js'
import { OpenAIEmbedder, checkOpenAIAvailable, type OpenAIEmbeddingModel } from './OpenAIEmbedder.js'
import type { EmbedderFactoryOptions, Embedder as IEmbedder } from './types.js'

export type EmbedderBackend = 'auto' | 'llamacpp' | 'mlx' | 'cpu' | 'openai'

/**
 * Extended factory options with GPU backend selection
 */
export interface GpuEmbedderOptions extends EmbedderFactoryOptions {
  backend?: EmbedderBackend  // Which backend to use
  llamaModel?: EmbeddingModelName  // LlamaCpp model name
  gpuLayers?: number  // GPU layers for LlamaCpp
  // OpenAI options
  openaiApiKey?: string  // OpenAI API key (defaults to OPENAI_API_KEY env)
  openaiModel?: OpenAIEmbeddingModel  // OpenAI model (default: text-embedding-3-small)
  openaiConcurrency?: number  // Parallel API calls for OpenAI (default: 4)
  openaiDimensions?: number  // Optional dimension reduction for text-embedding-3-*
}

/**
 * Create the best available embedder
 *
 * @param options - Configuration options
 * @returns Initialized embedder (OpenAI > LlamaCpp GPU > MLX GPU > CPU)
 */
export async function createEmbedder(
  options: GpuEmbedderOptions = {}
): Promise<IEmbedder> {
  const backend = options.backend ?? 'auto'
  const verbose = options.verbose ?? false

  const log = (msg: string) => {
    if (verbose) console.log('[EmbedderFactory]', msg)
  }

  // Explicit backend selection
  if (backend === 'openai') {
    return createOpenAIEmbedder(options, log)
  }

  if (backend === 'llamacpp') {
    return createLlamaCppEmbedder(options, log)
  }

  if (backend === 'mlx') {
    return createMlxEmbedder(options, log)
  }

  if (backend === 'cpu') {
    return createCpuEmbedder(options, log)
  }

  // Auto mode: try backends in priority order
  log('Auto-detecting best available backend...')

  // 1. Try LlamaCpp GPU (pure TypeScript, no external dependencies)
  try {
    const gpu = await checkGpuAvailable()
    if (gpu.available) {
      log(`GPU available (${gpu.type}), trying LlamaCpp...`)
      const embedder = await createLlamaCppEmbedder(options, log)
      log('Using LlamaCpp GPU embedder')
      return embedder
    } else {
      log('No GPU available for LlamaCpp')
    }
  } catch (error) {
    // LlamaCpp requires ESM - not available in CommonJS builds
    // Just silently fall back to other backends
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('ERR_REQUIRE_ASYNC_MODULE')) {
      log('LlamaCpp unavailable (ESM module, requires full ESM build)')
    } else {
      log(`LlamaCpp not available: ${msg.split('\n')[0]}`)
    }
  }

  // 2. Try MLX (requires Python server)
  const preferMlx = options.preferMlx ?? false  // MLX requires server, so not preferred by default
  if (preferMlx) {
    const mlxServerUrl = options.mlxServerUrl ?? 'http://localhost:8000'
    const mlxAvailable = await checkMlxServer(mlxServerUrl)

    if (mlxAvailable) {
      log('MLX server found, using MLX GPU acceleration')
      return createMlxEmbedder(options, log)
    } else {
      log('MLX server not available')
    }
  }

  // 3. Fallback to CPU
  log('Using CPU embedder (Xenova/transformers)')
  return createCpuEmbedder(options, log)
}

async function createLlamaCppEmbedder(
  options: GpuEmbedderOptions,
  log: (msg: string) => void
): Promise<IEmbedder> {
  log('Creating LlamaCpp GPU embedder...')

  const embedder = new LlamaCppEmbedder({
    modelName: options.llamaModel,
    cacheDir: options.cacheDir,
    gpuLayers: options.gpuLayers,
    verbose: options.verbose,
    onProgress: options.onProgress,
  })

  await embedder.initialize()
  return embedder
}

async function createMlxEmbedder(
  options: GpuEmbedderOptions,
  log: (msg: string) => void
): Promise<IEmbedder> {
  const mlxServerUrl = options.mlxServerUrl ?? 'http://localhost:8000'
  log(`Creating MLX embedder (server: ${mlxServerUrl})...`)

  const embedder = new MlxEmbedder({
    serverUrl: mlxServerUrl,
    modelSize: options.mlxModelSize ?? '0.6B',
    verbose: options.verbose,
    onProgress: options.onProgress,
  })

  await embedder.initialize()
  return embedder
}

async function createCpuEmbedder(
  options: GpuEmbedderOptions,
  log: (msg: string) => void
): Promise<IEmbedder> {
  log('Creating CPU embedder (Xenova/transformers)...')

  const embedder = new Embedder({
    modelName: options.modelName,
    cacheDir: options.cacheDir,
    verbose: options.verbose,
    onProgress: options.onProgress,
  })

  await embedder.initialize()
  return embedder
}

async function createOpenAIEmbedder(
  options: GpuEmbedderOptions,
  log: (msg: string) => void
): Promise<IEmbedder> {
  const model = options.openaiModel ?? 'text-embedding-3-small'
  log(`Creating OpenAI embedder (model: ${model})...`)

  const embedder = new OpenAIEmbedder({
    apiKey: options.openaiApiKey,
    model,
    concurrency: options.openaiConcurrency ?? 4,
    dimensions: options.openaiDimensions,
    verbose: options.verbose,
    onProgress: options.onProgress,
  })

  await embedder.initialize()
  return embedder
}

/**
 * Create embedder with explicit backend choice (legacy API)
 */
export async function createEmbedderWithBackend(
  backend: 'llamacpp' | 'mlx' | 'cpu' | 'openai',
  options: GpuEmbedderOptions = {}
): Promise<IEmbedder> {
  return createEmbedder({ ...options, backend })
}

export type { EmbedderFactoryOptions }

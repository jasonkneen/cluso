/**
 * Embedder Factory - Auto-selects the best available embedding backend
 *
 * Priority order:
 * 1. MLX GPU (if server available and preferMlx=true)
 * 2. Xenova/transformers CPU (fallback)
 *
 * Usage:
 *   const embedder = await createEmbedder({ verbose: true })
 *   // Automatically uses MLX if available, falls back to CPU
 */

import { Embedder } from './Embedder'
import { MlxEmbedder, checkMlxServer } from './MlxEmbedder'
import type { EmbedderFactoryOptions, Embedder as IEmbedder } from './types'

/**
 * Create the best available embedder
 *
 * @param options - Configuration options
 * @returns Initialized embedder (MLX if available, otherwise CPU)
 */
export async function createEmbedder(
  options: EmbedderFactoryOptions = {}
): Promise<IEmbedder> {
  const preferMlx = options.preferMlx ?? true
  const mlxServerUrl = options.mlxServerUrl ?? 'http://localhost:8000'
  const verbose = options.verbose ?? false

  if (preferMlx) {
    if (verbose) {
      console.log('[EmbedderFactory] Checking for MLX server...')
    }

    const mlxAvailable = await checkMlxServer(mlxServerUrl)

    if (mlxAvailable) {
      if (verbose) {
        console.log('[EmbedderFactory] MLX server found, using GPU acceleration')
      }

      const mlxEmbedder = new MlxEmbedder({
        serverUrl: mlxServerUrl,
        modelSize: options.mlxModelSize ?? '0.6B',
        verbose: options.verbose,
        onProgress: options.onProgress,
      })

      await mlxEmbedder.initialize()
      return mlxEmbedder
    } else {
      if (verbose) {
        console.log('[EmbedderFactory] MLX server not available, falling back to CPU')
        console.log('[EmbedderFactory] To enable GPU: pip install qwen3-embeddings-mlx && qwen3-embeddings serve')
      }
    }
  }

  // Fallback to CPU embedder
  if (verbose) {
    console.log('[EmbedderFactory] Using CPU embedder (Xenova/transformers)')
  }

  const cpuEmbedder = new Embedder({
    modelName: options.modelName,
    cacheDir: options.cacheDir,
    verbose: options.verbose,
    onProgress: options.onProgress,
  })

  await cpuEmbedder.initialize()
  return cpuEmbedder
}

/**
 * Create embedder with explicit backend choice
 */
export async function createEmbedderWithBackend(
  backend: 'mlx' | 'cpu',
  options: EmbedderFactoryOptions = {}
): Promise<IEmbedder> {
  if (backend === 'mlx') {
    const mlxEmbedder = new MlxEmbedder({
      serverUrl: options.mlxServerUrl ?? 'http://localhost:8000',
      modelSize: options.mlxModelSize ?? '0.6B',
      verbose: options.verbose,
      onProgress: options.onProgress,
    })

    await mlxEmbedder.initialize()
    return mlxEmbedder
  }

  const cpuEmbedder = new Embedder({
    modelName: options.modelName,
    cacheDir: options.cacheDir,
    verbose: options.verbose,
    onProgress: options.onProgress,
  })

  await cpuEmbedder.initialize()
  return cpuEmbedder
}

export type { EmbedderFactoryOptions }

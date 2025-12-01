/**
 * Available model quantization variants
 */
export type ModelVariant = 'Q4_K_M' | 'Q5_K_M' | 'Q8_0' | 'F16'

/**
 * Information about a specific model variant
 */
export interface ModelInfo {
  variant: ModelVariant
  file: string
  size: number        // MB
  quality: string
  memory: number      // MB required when loaded
  description: string
  downloaded: boolean
  path?: string
}

/**
 * Configuration options for FastApply
 */
export interface FastApplyOptions {
  /** Directory to store downloaded models (default: ~/.cluso/models/fast-apply) */
  storageDir?: string
  /** Which model variant to use by default (default: Q4_K_M) */
  defaultModel?: ModelVariant
  /** Auto-download the default model if not present (default: false) */
  autoDownload?: boolean
}

/**
 * Result from applying code changes
 */
export interface ApplyResult {
  success: boolean
  /** The merged code with changes applied */
  code?: string
  /** Error message if success is false */
  error?: string
  /** Number of tokens generated */
  tokensUsed?: number
  /** Time taken for inference in milliseconds */
  durationMs?: number
}

/**
 * Progress information during model download
 */
export interface DownloadProgress {
  variant: ModelVariant
  /** Bytes downloaded so far */
  downloaded: number
  /** Total bytes to download */
  total: number
  /** Percentage complete (0-100) */
  percent: number
  /** Current download speed in bytes/sec */
  speed: number
  /** Estimated time remaining in seconds */
  eta: number
}

/**
 * Current status of FastApply
 */
export interface FastApplyStatus {
  /** Whether FastApply is ready for inference */
  ready: boolean
  /** Currently active model variant, or null if none */
  activeModel: ModelVariant | null
  /** Whether a model is currently loaded in memory */
  modelLoaded: boolean
  /** List of downloaded model variants */
  downloadedModels: ModelVariant[]
  /** Directory where models are stored */
  storageDir: string
}

/**
 * Internal model definition from config
 */
export interface ModelDefinition {
  file: string
  size: number
  quality: string
  memory: number
  description: string
}

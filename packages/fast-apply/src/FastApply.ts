import { EventEmitter } from 'events'
import type {
  FastApplyOptions,
  ModelVariant,
  ModelInfo,
  ApplyResult,
  DownloadProgress,
  FastApplyStatus,
} from './types'
import { DEFAULT_MODEL } from './config'
import { ModelManager } from './ModelManager'

export interface FastApplyEvents {
  'download:progress': (progress: DownloadProgress) => void
  'download:complete': (path: string) => void
  'download:error': (error: Error) => void
  'model:loaded': () => void
  'model:unloaded': () => void
}

/**
 * FastApply - Local AI model for instant code merging
 *
 * @example
 * ```typescript
 * const fastApply = new FastApply({
 *   storageDir: '~/.cluso/models',
 *   autoDownload: true,
 * })
 *
 * // Listen for download progress
 * fastApply.on('download:progress', (progress) => {
 *   console.log(`Downloading: ${progress.percent}%`)
 * })
 *
 * // Apply a code change
 * const result = await fastApply.apply(originalCode, 'Change button color to blue')
 * if (result.success) {
 *   console.log('Merged code:', result.code)
 * }
 * ```
 */
export class FastApply extends EventEmitter {
  private manager: ModelManager
  private options: FastApplyOptions

  constructor(options?: FastApplyOptions) {
    super()

    this.options = {
      defaultModel: DEFAULT_MODEL,
      autoDownload: false,
      ...options,
    }

    this.manager = new ModelManager(options?.storageDir)

    // Forward events from downloader
    const downloader = this.manager.getDownloader()
    downloader.on('progress', (progress) => {
      this.emit('download:progress', progress)
    })
    downloader.on('complete', (path) => {
      this.emit('download:complete', path)
    })
    downloader.on('error', (error) => {
      this.emit('download:error', error)
    })

    // Forward events from engine
    const engine = this.manager.getEngine()
    engine.on('loaded', () => {
      this.emit('model:loaded')
    })
    engine.on('unloaded', () => {
      this.emit('model:unloaded')
    })
  }

  // ============================================
  // Model Management
  // ============================================

  /**
   * Get information about all available models
   */
  async listModels(): Promise<ModelInfo[]> {
    return this.manager.listModels()
  }

  /**
   * Get the currently active model variant
   */
  getActiveModel(): ModelVariant | null {
    return this.manager.getActiveModel()
  }

  /**
   * Set the active model variant
   * Downloads the model if not present and autoDownload is true
   */
  async setActiveModel(variant: ModelVariant): Promise<void> {
    await this.manager.setActiveModel(variant, this.options.autoDownload)
  }

  /**
   * Get whether fast apply should auto-load on startup
   */
  isEnabled(): boolean {
    return this.manager.isEnabled()
  }

  /**
   * Set whether fast apply should auto-load on startup
   */
  setEnabled(enabled: boolean): void {
    this.manager.setEnabled(enabled)
  }

  // ============================================
  // Download
  // ============================================

  /**
   * Download a model variant
   * @param variant The model variant to download (default: Q4_K_M)
   * @returns Path to the downloaded model
   */
  async download(variant?: ModelVariant): Promise<string> {
    return this.manager.download(variant || this.options.defaultModel)
  }

  /**
   * Cancel an ongoing download
   */
  cancelDownload(): void {
    this.manager.cancelDownload()
  }

  /**
   * Delete a downloaded model to free disk space
   */
  async deleteModel(variant: ModelVariant): Promise<void> {
    await this.manager.deleteModel(variant)
  }

  // ============================================
  // Inference
  // ============================================

  /**
   * Apply code changes using the Fast Apply model
   *
   * @param originalCode The original source code
   * @param updateSnippet Description of changes to apply, or a code snippet with updates
   * @returns Result containing the merged code or an error
   *
   * @example
   * ```typescript
   * // Using natural language
   * const result = await fastApply.apply(code, 'Change the button color to blue')
   *
   * // Using code snippet
   * const result = await fastApply.apply(code, `
   *   // Update button styles
   *   backgroundColor: 'blue',
   *   color: 'white'
   * `)
   * ```
   */
  async apply(originalCode: string, updateSnippet: string): Promise<ApplyResult> {
    try {
      // Ensure model is loaded
      await this.manager.ensureLoaded()

      // Run inference
      const engine = this.manager.getEngine()
      return await engine.apply(originalCode, updateSnippet)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Get current status of FastApply
   */
  async getStatus(): Promise<FastApplyStatus> {
    return this.manager.getStatus()
  }

  /**
   * Load the active model into memory
   * Call this to pre-warm the model for faster first inference
   */
  async load(): Promise<void> {
    await this.manager.ensureLoaded()
  }

  /**
   * Unload the model to free memory
   * The model will be automatically reloaded on next apply() call
   */
  async unload(): Promise<void> {
    await this.manager.unload()
  }

  /**
   * Dispose all resources
   * Call this when you're done using FastApply
   */
  async dispose(): Promise<void> {
    await this.manager.dispose()
  }
}

// Type-safe event emitter
export declare interface FastApply {
  on<K extends keyof FastApplyEvents>(event: K, listener: FastApplyEvents[K]): this
  once<K extends keyof FastApplyEvents>(event: K, listener: FastApplyEvents[K]): this
  emit<K extends keyof FastApplyEvents>(event: K, ...args: Parameters<FastApplyEvents[K]>): boolean
  off<K extends keyof FastApplyEvents>(event: K, listener: FastApplyEvents[K]): this
}

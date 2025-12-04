import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { ModelVariant, ModelInfo, FastApplyStatus } from './types'
import { MODELS, DEFAULT_MODEL, DEFAULT_STORAGE_DIR } from './config'
import { Downloader } from './Downloader'
import { InferenceEngine } from './InferenceEngine'

/**
 * Manages model selection, storage, and lifecycle
 */
export class ModelManager {
  private storageDir: string
  private activeModel: ModelVariant | null = null
  private enabled: boolean = false  // Whether fast apply should auto-load on startup
  private downloader: Downloader
  private engine: InferenceEngine
  private configPath: string

  constructor(storageDir?: string) {
    // Resolve storage directory
    if (storageDir) {
      this.storageDir = storageDir.startsWith('~')
        ? path.join(os.homedir(), storageDir.slice(1))
        : storageDir
    } else {
      this.storageDir = path.join(os.homedir(), DEFAULT_STORAGE_DIR)
    }

    this.configPath = path.join(this.storageDir, 'config.json')
    this.downloader = new Downloader(this.storageDir)
    this.engine = new InferenceEngine()

    // Load saved configuration
    this.loadConfig()
  }

  /**
   * Get the downloader instance (for event forwarding)
   */
  getDownloader(): Downloader {
    return this.downloader
  }

  /**
   * Get the inference engine instance (for event forwarding)
   */
  getEngine(): InferenceEngine {
    return this.engine
  }

  /**
   * Get the storage directory path
   */
  getStorageDir(): string {
    return this.storageDir
  }

  /**
   * Get information about all available models
   */
  async listModels(): Promise<ModelInfo[]> {
    const downloadedModels = await this.downloader.getDownloadedModels()

    return (Object.keys(MODELS) as ModelVariant[]).map(variant => {
      const def = MODELS[variant]
      const downloaded = downloadedModels.includes(variant)

      return {
        variant,
        file: def.file,
        size: def.size,
        quality: def.quality,
        memory: def.memory,
        description: def.description,
        downloaded,
        path: downloaded ? this.downloader.getModelPath(variant) : undefined,
      }
    })
  }

  /**
   * Get the currently active model variant
   */
  getActiveModel(): ModelVariant | null {
    return this.activeModel
  }

  /**
   * Set the active model variant (downloads if needed)
   */
  async setActiveModel(variant: ModelVariant, autoDownload: boolean = true): Promise<void> {
    // Validate variant
    if (!MODELS[variant]) {
      throw new Error(`Unknown model variant: ${variant}`)
    }

    // Check if model is downloaded
    const isDownloaded = await this.downloader.isDownloaded(variant)

    if (!isDownloaded) {
      if (autoDownload) {
        await this.downloader.download(variant)
      } else {
        throw new Error(`Model ${variant} is not downloaded`)
      }
    }

    // If a different model is loaded, unload it
    if (this.engine.isLoaded()) {
      const currentPath = this.engine.getLoadedModelPath()
      const newPath = this.downloader.getModelPath(variant)
      if (currentPath !== newPath) {
        await this.engine.unload()
      }
    }

    this.activeModel = variant
    this.saveConfig()
  }

  /**
   * Ensure a model is loaded and ready for inference
   */
  async ensureLoaded(): Promise<void> {
    if (!this.activeModel) {
      // Try to use default model
      const isDownloaded = await this.downloader.isDownloaded(DEFAULT_MODEL)
      if (isDownloaded) {
        this.activeModel = DEFAULT_MODEL
      } else {
        throw new Error('No model available. Please download a model first.')
      }
    }

    if (!this.engine.isLoaded()) {
      const modelPath = this.downloader.getModelPath(this.activeModel)
      await this.engine.load(modelPath)
    }
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<FastApplyStatus> {
    const downloadedModels = await this.downloader.getDownloadedModels()

    return {
      ready: this.engine.isLoaded(),
      activeModel: this.activeModel,
      modelLoaded: this.engine.isLoaded(),
      downloadedModels,
      storageDir: this.storageDir,
    }
  }

  /**
   * Download a model
   */
  async download(variant: ModelVariant = DEFAULT_MODEL): Promise<string> {
    return this.downloader.download(variant)
  }

  /**
   * Cancel ongoing download
   */
  cancelDownload(): void {
    this.downloader.cancel()
  }

  /**
   * Delete a model
   */
  async deleteModel(variant: ModelVariant): Promise<void> {
    // Unload if this is the active model
    if (this.activeModel === variant && this.engine.isLoaded()) {
      await this.engine.unload()
    }

    // If this was the active model, clear it
    if (this.activeModel === variant) {
      this.activeModel = null
      this.saveConfig()
    }

    await this.downloader.delete(variant)
  }

  /**
   * Unload the current model to free memory
   */
  async unload(): Promise<void> {
    await this.engine.unload()
  }

  /**
   * Dispose all resources
   */
  async dispose(): Promise<void> {
    await this.engine.dispose()
  }

  /**
   * Load configuration from disk
   */
  private loadConfig(): void {
    try {
      const data = fs.readFileSync(this.configPath, 'utf-8')
      const config = JSON.parse(data)
      if (config.activeModel && MODELS[config.activeModel as ModelVariant]) {
        this.activeModel = config.activeModel
      }
      if (typeof config.enabled === 'boolean') {
        this.enabled = config.enabled
      }
    } catch {
      // Config doesn't exist yet, use defaults
    }
  }

  /**
   * Save configuration to disk
   */
  private saveConfig(): void {
    try {
      fs.mkdirSync(this.storageDir, { recursive: true })
      const config = {
        activeModel: this.activeModel,
        enabled: this.enabled,
        lastUpdated: new Date().toISOString(),
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2))
    } catch (error) {
      console.warn('[FastApply] Failed to save config:', error)
    }
  }

  /**
   * Get whether fast apply should auto-load on startup
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Set whether fast apply should auto-load on startup
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.saveConfig()
  }
}

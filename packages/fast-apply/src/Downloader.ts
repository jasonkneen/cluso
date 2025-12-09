import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as https from 'https'
import * as http from 'http'
import type { ModelVariant, DownloadProgress, ModelDefinition } from './types'
import { MODELS, MODEL_REPO } from './config'

export interface DownloaderEvents {
  'progress': (progress: DownloadProgress) => void
  'complete': (modelPath: string) => void
  'error': (error: Error) => void
}

export class Downloader extends EventEmitter {
  private storageDir: string
  private currentDownload: {
    variant: ModelVariant
    controller: AbortController
  } | null = null

  constructor(storageDir: string) {
    super()
    this.storageDir = storageDir
  }

  /**
   * Get the full path where a model would be stored
   */
  getModelPath(variant: ModelVariant): string {
    const modelDef = MODELS[variant]
    return path.join(this.storageDir, modelDef.file)
  }

  /**
   * Check if a model is already downloaded
   */
  async isDownloaded(variant: ModelVariant): Promise<boolean> {
    const modelPath = this.getModelPath(variant)
    try {
      await fs.promises.access(modelPath, fs.constants.R_OK)
      // Verify file size matches expected
      const stats = await fs.promises.stat(modelPath)
      const expectedSize = MODELS[variant].size * 1024 * 1024 // Convert MB to bytes
      // Allow 5% tolerance for file size
      return stats.size >= expectedSize * 0.95
    } catch {
      return false
    }
  }

  /**
   * Get list of all downloaded models
   */
  async getDownloadedModels(): Promise<ModelVariant[]> {
    const downloaded: ModelVariant[] = []
    for (const variant of Object.keys(MODELS) as ModelVariant[]) {
      if (await this.isDownloaded(variant)) {
        downloaded.push(variant)
      }
    }
    return downloaded
  }

  /**
   * Download a model from HuggingFace
   */
  async download(variant: ModelVariant): Promise<string> {
    console.log('[Downloader] Download called for variant:', variant)

    if (this.currentDownload) {
      console.log('[Downloader] Already downloading:', this.currentDownload.variant)
      throw new Error(`Already downloading ${this.currentDownload.variant}`)
    }

    const modelDef = MODELS[variant]
    if (!modelDef) {
      console.error('[Downloader] Unknown model variant:', variant)
      throw new Error(`Unknown model variant: ${variant}`)
    }

    const modelPath = this.getModelPath(variant)
    const tempPath = modelPath + '.tmp'
    console.log('[Downloader] Model path:', modelPath)
    console.log('[Downloader] Temp path:', tempPath)

    // Ensure storage directory exists
    console.log('[Downloader] Creating storage dir:', this.storageDir)
    await fs.promises.mkdir(this.storageDir, { recursive: true })

    // Check disk space (rough estimate)
    const requiredSpace = modelDef.size * 1024 * 1024 * 1.1 // 10% buffer
    await this.checkDiskSpace(requiredSpace)

    // Build HuggingFace download URL
    const url = `https://huggingface.co/${MODEL_REPO}/resolve/main/${modelDef.file}`
    console.log('[Downloader] Download URL:', url)

    // Set up abort controller for cancellation
    const controller = new AbortController()
    this.currentDownload = { variant, controller }

    try {
      console.log('[Downloader] Starting download...')
      await this.downloadFile(url, tempPath, variant, controller.signal)

      console.log('[Downloader] Download complete, renaming temp file...')
      // Rename temp file to final path
      await fs.promises.rename(tempPath, modelPath)

      await this.validateDownloadedFile(modelPath, modelDef)

      console.log('[Downloader] Model saved to:', modelPath)
      this.emit('complete', modelPath)
      return modelPath
    } catch (error) {
      console.error('[Downloader] Download error:', error)
      // Clean up temp file on error (but keep for resume on cancel)
      if (error instanceof Error && error.name !== 'AbortError') {
        try {
          await fs.promises.unlink(tempPath)
        } catch {
          // Ignore cleanup errors
        }
      }
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      this.currentDownload = null
    }
  }

  /**
   * Cancel ongoing download
   */
  cancel(): void {
    if (this.currentDownload) {
      this.currentDownload.controller.abort()
    }
  }

  /**
   * Delete a downloaded model
   */
  async delete(variant: ModelVariant): Promise<void> {
    const modelPath = this.getModelPath(variant)
    try {
      await fs.promises.unlink(modelPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  /**
   * Download file with progress tracking
   */
  private async downloadFile(
    url: string,
    destPath: string,
    variant: ModelVariant,
    signal: AbortSignal
  ): Promise<void> {
    console.log('[Downloader] downloadFile called:', { url, destPath, variant })

    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http
      console.log('[Downloader] Using protocol:', url.startsWith('https') ? 'https' : 'http')

      const request = protocol.get(url, (response) => {
        console.log('[Downloader] Response received:', {
          statusCode: response.statusCode,
          headers: {
            'content-length': response.headers['content-length'],
            'content-type': response.headers['content-type'],
            'location': response.headers.location,
          }
        })

        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          console.log('[Downloader] Redirecting to:', redirectUrl)
          if (redirectUrl) {
            this.downloadFile(redirectUrl, destPath, variant, signal)
              .then(resolve)
              .catch(reject)
            return
          }
        }

        if (response.statusCode !== 200) {
          console.error('[Downloader] Bad status code:', response.statusCode)
          reject(new Error(`Download failed with status ${response.statusCode}`))
          return
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedSize = 0
        let lastProgressTime = Date.now()
        let lastDownloadedSize = 0

        const fileStream = fs.createWriteStream(destPath)

        // Handle abort
        signal.addEventListener('abort', () => {
          request.destroy()
          fileStream.close()
          reject(new Error('Download cancelled'))
        })

        response.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length
          fileStream.write(chunk)

          // Calculate speed (update every 500ms)
          const now = Date.now()
          const timeDelta = now - lastProgressTime
          if (timeDelta >= 500) {
            const byteDelta = downloadedSize - lastDownloadedSize
            const speed = (byteDelta / timeDelta) * 1000 // bytes per second
            const remaining = totalSize - downloadedSize
            const eta = speed > 0 ? remaining / speed : 0

            const progress: DownloadProgress = {
              variant,
              downloaded: downloadedSize,
              total: totalSize,
              percent: totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0,
              speed,
              eta,
            }

            this.emit('progress', progress)

            lastProgressTime = now
            lastDownloadedSize = downloadedSize
          }
        })

        response.on('end', () => {
          fileStream.end(() => {
            // Emit final progress
            const progress: DownloadProgress = {
              variant,
              downloaded: downloadedSize,
              total: totalSize,
              percent: 100,
              speed: 0,
              eta: 0,
            }
            this.emit('progress', progress)
            resolve()
          })
        })

        response.on('error', (error) => {
          fileStream.close()
          reject(error)
        })

        fileStream.on('error', (error) => {
          reject(error)
        })
      })

      request.on('error', (error) => {
        reject(error)
      })
    })
  }

  /**
   * Check if there's enough disk space
   */
  private async checkDiskSpace(requiredBytes: number): Promise<void> {
    const statfs = (fs.promises as any).statfs
    try {
      if (typeof statfs === 'function') {
        const stats = await statfs(this.storageDir)
        const freeBytes = Number(stats.bavail) * Number(stats.bsize)
        if (freeBytes < requiredBytes) {
          throw new Error(
            `Not enough disk space. Required: ${Math.round(requiredBytes / (1024 * 1024))} MB, available: ${Math.round(
              freeBytes / (1024 * 1024)
            )} MB`
          )
        }
        return
      }
    } catch (error) {
      console.warn('[Downloader] statfs check failed, falling back to freemem():', error)
    }

    const freeBytes = os.freemem()
    if (freeBytes < requiredBytes) {
      throw new Error(
        `Not enough memory-reported free space. Required: ${Math.round(requiredBytes / (1024 * 1024))} MB, available: ${Math.round(
          freeBytes / (1024 * 1024)
        )} MB`
      )
    }
  }

  /**
   * Validate downloaded file size and delete if it is incomplete.
   */
  private async validateDownloadedFile(modelPath: string, modelDef: ModelDefinition): Promise<void> {
    const expectedBytes = modelDef.size * 1024 * 1024
    const stats = await fs.promises.stat(modelPath)
    const withinTolerance = stats.size >= expectedBytes * 0.99 && stats.size <= expectedBytes * 1.01
    if (!withinTolerance) {
      try {
        await fs.promises.unlink(modelPath)
      } catch {
        // ignore cleanup errors
      }
      throw new Error(
        `Downloaded file size mismatch for ${modelDef.file}. Expected ~${modelDef.size} MB, got ${Math.round(
          stats.size / (1024 * 1024)
        )} MB`
      )
    }
  }
}

// Type-safe event emitter
export declare interface Downloader {
  on<K extends keyof DownloaderEvents>(event: K, listener: DownloaderEvents[K]): this
  emit<K extends keyof DownloaderEvents>(event: K, ...args: Parameters<DownloaderEvents[K]>): boolean
}

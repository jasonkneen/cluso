import { EventEmitter } from 'events'
import type { ApplyResult } from './types'
import {
  buildPrompt,
  parseOutput,
  TEMPERATURE,
  MAX_TOKENS,
  INFERENCE_TIMEOUT,
} from './config'

// Helper to force true dynamic import (bypasses TypeScript's transformation to require())
// This is necessary because node-llama-cpp is ESM-only with top-level await
const dynamicImport = new Function('specifier', 'return import(specifier)') as <T>(specifier: string) => Promise<T>

// node-llama-cpp types (dynamic import)
type LlamaModule = typeof import('node-llama-cpp')
type Llama = Awaited<ReturnType<LlamaModule['getLlama']>>
type LlamaModel = Awaited<ReturnType<Llama['loadModel']>>
type LlamaContext = Awaited<ReturnType<LlamaModel['createContext']>>

export interface InferenceEngineEvents {
  'loaded': () => void
  'unloaded': () => void
  'error': (error: Error) => void
}

export class InferenceEngine extends EventEmitter {
  private llama: Llama | null = null
  private model: LlamaModel | null = null
  private context: LlamaContext | null = null
  private modelPath: string | null = null
  private loading: boolean = false
  // Serialize apply calls to avoid sequence exhaustion and interleaved context use
  private applyMutex: Promise<void> = Promise.resolve()

  /**
   * Check if a model is currently loaded
   */
  isLoaded(): boolean {
    return this.model !== null && this.context !== null
  }

  /**
   * Get the path of the currently loaded model
   */
  getLoadedModelPath(): string | null {
    return this.modelPath
  }

  /**
   * Load a model from disk
   */
  async load(modelPath: string): Promise<void> {
    if (this.loading) {
      throw new Error('Already loading a model')
    }

    // If same model is already loaded, skip
    if (this.modelPath === modelPath && this.isLoaded()) {
      return
    }

    // Unload existing model first
    if (this.isLoaded()) {
      await this.unload()
    }

    this.loading = true

    try {
      // Dynamic import of node-llama-cpp (using dynamicImport to avoid TypeScript conversion to require)
      const { getLlama } = await dynamicImport<LlamaModule>('node-llama-cpp')

      // Initialize llama if needed
      if (!this.llama) {
        this.llama = await getLlama()
      }

      // Load the model
      console.log(`[FastApply] Loading model from ${modelPath}`)
      this.model = await this.llama.loadModel({
        modelPath,
      })

      // Create context with larger size for complete file outputs
      this.context = await this.model.createContext({
        contextSize: 8192,
      })

      this.modelPath = modelPath
      this.emit('loaded')
      console.log('[FastApply] Model loaded successfully')
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      this.loading = false
    }
  }

  /**
   * Unload the current model to free memory
   */
  async unload(): Promise<void> {
    if (this.context) {
      await this.context.dispose()
      this.context = null
    }

    if (this.model) {
      await this.model.dispose()
      this.model = null
    }

    this.modelPath = null
    this.emit('unloaded')
    console.log('[FastApply] Model unloaded')
  }

  /**
   * Run inference to apply code changes
   */
  async apply(originalCode: string, updateSnippet: string): Promise<ApplyResult> {
    return this.withApplyLock(async () => {
      if (!this.isLoaded() || !this.context || !this.model) {
        return {
          success: false,
          error: 'Model not loaded',
        }
      }

      const startTime = Date.now()
      let session: any = null
      let sequence: any = null

      try {
        // Build the prompt
        const prompt = buildPrompt(originalCode, updateSnippet)
        console.log('[FastApply] Prompt built')
        console.log('[FastApply] Original code length:', originalCode.length)
        console.log('[FastApply] Update snippet length:', updateSnippet.length)
        console.log('[FastApply] Total prompt length:', prompt.length)
        
        // Warn if input is very large (likely to be slow)
        if (originalCode.length > 10000) {
          console.warn('[FastApply] ⚠️ Large input detected - inference may be slow')
        }
        
        console.log('[FastApply] Getting sequence...')

        // Get a sequence from context
        const { LlamaChatSession } = await dynamicImport<LlamaModule>('node-llama-cpp')

        // Get a fresh sequence for this inference
        sequence = this.context.getSequence()
        console.log('[FastApply] Sequence acquired, creating session...')

        // Create a chat session with the sequence
        session = new LlamaChatSession({
          contextSequence: sequence,
        })

        // Run inference with timeout that is cleared on completion
        console.log('[FastApply] Running inference...')
        const responsePromise = session.prompt(prompt, {
          maxTokens: MAX_TOKENS,
          temperature: TEMPERATURE,
        })

        const output = await this.runWithTimeout(responsePromise)
        const durationMs = Date.now() - startTime
        console.log(`[FastApply] Inference completed in ${durationMs}ms`)

        // Parse the output to extract the code
        const code = parseOutput(output)
        console.log('[FastApply] Output parsed:', code ? 'success' : 'failed')

        if (code) {
          return {
            success: true,
            code,
            durationMs,
          }
        } else {
          console.log('[FastApply] Raw output:', output?.substring(0, 200))
          return {
            success: false,
            error: 'Failed to parse model output',
            durationMs,
          }
        }
      } catch (error) {
        const durationMs = Date.now() - startTime
        console.error('[FastApply] Inference error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs,
        }
      } finally {
        // CRITICAL: Dispose the session and release the sequence after each inference
        // This prevents "No sequences left" error on subsequent calls
        if (session) {
          try {
            await session.dispose?.()
            console.log('[FastApply] Session disposed')
          } catch (e) {
            console.warn('[FastApply] Session dispose error:', e)
          }
        }
        if (sequence) {
          try {
            await sequence.dispose?.()
            console.log('[FastApply] Sequence disposed')
          } catch (e) {
            console.warn('[FastApply] Sequence dispose error:', e)
          }
        }
      }
    })
  }

  /**
   * Serialize apply calls to avoid exhausting sequences/context.
   */
  private async withApplyLock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void
    const previous = this.applyMutex
    this.applyMutex = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous
    try {
      return await fn()
    } finally {
      release!()
    }
  }

  /**
   * Wrap a promise with a cancellable timeout so late rejections don't fire.
   */
  private async runWithTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | null = null
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Inference timeout')), INFERENCE_TIMEOUT)
      })
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }

  /**
   * Dispose all resources
   */
  async dispose(): Promise<void> {
    await this.unload()

    if (this.llama) {
      // Note: llama instance doesn't need explicit disposal
      this.llama = null
    }
  }
}

// Type-safe event emitter
export declare interface InferenceEngine {
  on<K extends keyof InferenceEngineEvents>(event: K, listener: InferenceEngineEvents[K]): this
  emit<K extends keyof InferenceEngineEvents>(event: K, ...args: Parameters<InferenceEngineEvents[K]>): boolean
}

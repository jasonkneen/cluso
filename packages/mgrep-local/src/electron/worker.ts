/**
 * Embedding Worker Thread
 *
 * Runs CPU-intensive embedding operations in a separate thread
 * to avoid blocking the main Electron process.
 *
 * Communication protocol:
 * - Main → Worker: WorkerTask (via postMessage)
 * - Worker → Main: WorkerResult (via postMessage)
 */

import { parentPort, workerData } from 'worker_threads'

import { Embedder } from '../core/Embedder.js'
import type {
  WorkerTask,
  WorkerResult,
  WorkerInitializeResult,
  WorkerEmbedResult,
  WorkerEmbedBatchResult,
  WorkerDisposeResult,
} from './types.js'

// Ensure we're running as a worker thread
if (!parentPort) {
  throw new Error('This script must be run as a worker thread')
}

// Global embedder instance (reused across tasks)
let embedder: Embedder | null = null

/**
 * Handle incoming tasks from the main thread
 */
parentPort.on('message', async (task: WorkerTask) => {
  try {
    const result = await handleTask(task)
    parentPort!.postMessage(result)
  } catch (error) {
    parentPort!.postMessage({
      id: task.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

/**
 * Route task to appropriate handler
 */
async function handleTask(task: WorkerTask): Promise<WorkerResult> {
  switch (task.type) {
    case 'initialize':
      return handleInitialize(task)
    case 'embed':
      return handleEmbed(task)
    case 'embed-batch':
      return handleEmbedBatch(task)
    case 'dispose':
      return handleDispose(task)
    default:
      throw new Error(`Unknown task type: ${(task as WorkerTask).type}`)
  }
}

/**
 * Initialize the embedder
 */
async function handleInitialize(task: WorkerTask & { type: 'initialize' }): Promise<WorkerInitializeResult> {
  if (embedder) {
    await embedder.dispose()
  }

  embedder = new Embedder({
    modelName: task.modelName,
    cacheDir: task.cacheDir,
  })

  await embedder.initialize()
  const modelInfo = embedder.getModelInfo()

  return {
    id: task.id,
    success: true,
    modelInfo,
  }
}

/**
 * Embed a single text
 */
async function handleEmbed(task: WorkerTask & { type: 'embed' }): Promise<WorkerEmbedResult> {
  if (!embedder) {
    throw new Error('Embedder not initialized. Call initialize first.')
  }

  const embedding = await embedder.embed(task.text)

  return {
    id: task.id,
    success: true,
    embedding,
  }
}

/**
 * Embed multiple texts
 */
async function handleEmbedBatch(task: WorkerTask & { type: 'embed-batch' }): Promise<WorkerEmbedBatchResult> {
  if (!embedder) {
    throw new Error('Embedder not initialized. Call initialize first.')
  }

  const embeddings = await embedder.embedBatch(task.texts)

  return {
    id: task.id,
    success: true,
    embeddings,
  }
}

/**
 * Dispose resources
 */
async function handleDispose(task: WorkerTask & { type: 'dispose' }): Promise<WorkerDisposeResult> {
  if (embedder) {
    await embedder.dispose()
    embedder = null
  }

  return {
    id: task.id,
    success: true,
  }
}

// Log worker startup
console.log('[mgrep-worker] Worker thread started')

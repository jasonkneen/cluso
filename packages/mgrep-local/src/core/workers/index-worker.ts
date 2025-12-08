#!/usr/bin/env node
/**
 * Index Worker - Parallel indexing worker thread
 *
 * Each worker handles indexing for a subset of shards.
 * Workers have their own embedder instance to avoid contention.
 */

import { parentPort, workerData } from 'worker_threads'
import { createHash } from 'crypto'
import { Chunker } from '../Chunker.js'
import { createEmbedder } from '../embedder-factory.js'
import { VectorStore } from '../VectorStore.js'
import type { Embedder as IEmbedder } from '../types.js'

interface WorkerData {
  shardDbPaths: Map<number, string>  // shardId -> db path
  files: Array<{ shardId: number; filePath: string; content: string }>
  embedderOptions: {
    backend?: 'auto' | 'llamacpp' | 'mlx' | 'cpu' | 'openai'
    modelName?: string
    cacheDir?: string
    verbose?: boolean
    // OpenAI-specific options
    openaiModel?: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002'
    openaiConcurrency?: number
  }
  workerId: number
}

interface WorkerResult {
  workerId: number
  shardResults: Map<number, { filesIndexed: number; chunksCreated: number; errors: number }>
  totalChunks: number
  totalFiles: number
  durationMs: number
}

async function runWorker() {
  const data = workerData as WorkerData
  const startTime = Date.now()

  // Initialize embedder for this worker
  const embedder = await createEmbedder({
    backend: data.embedderOptions.backend,
    modelName: data.embedderOptions.modelName,
    cacheDir: data.embedderOptions.cacheDir,
    verbose: false, // Don't spam logs from workers
    // OpenAI-specific options
    openaiModel: data.embedderOptions.openaiModel,
    openaiConcurrency: data.embedderOptions.openaiConcurrency,
  })

  const chunker = new Chunker()

  // Initialize vector stores for each shard this worker handles
  const stores = new Map<number, VectorStore>()
  for (const [shardId, dbPath] of Object.entries(data.shardDbPaths)) {
    const store = new VectorStore({
      dbPath: dbPath as string,
    })
    await store.initialize()
    stores.set(parseInt(shardId), store)
  }

  const shardResults = new Map<number, { filesIndexed: number; chunksCreated: number; errors: number }>()
  let totalChunks = 0
  let totalFiles = 0

  // Process files
  for (const file of data.files) {
    const store = stores.get(file.shardId)
    if (!store) continue

    // Initialize shard result if needed
    if (!shardResults.has(file.shardId)) {
      shardResults.set(file.shardId, { filesIndexed: 0, chunksCreated: 0, errors: 0 })
    }
    const result = shardResults.get(file.shardId)!

    try {
      // Check if file needs re-indexing
      const contentHash = createHash('sha256').update(file.content).digest('hex').substring(0, 16)
      const existingHash = await store.getFileHash(file.filePath)

      if (existingHash === contentHash) {
        continue // File unchanged
      }

      // Delete existing vectors
      await store.deleteVectorsForFile(file.filePath)

      // Chunk the content
      const chunks = chunker.chunk(file.content, file.filePath)
      if (chunks.length === 0) continue

      // Generate embeddings
      const embeddings = await embedder.embedBatch(chunks.map(c => c.content))

      // Insert vectors
      for (let i = 0; i < chunks.length; i++) {
        await store.insert({
          filePath: file.filePath,
          chunkIndex: i,
          content: chunks[i].content,
          embedding: embeddings[i],
          metadata: chunks[i].metadata,
        })
      }

      // Track the file
      await store.trackFile(
        file.filePath,
        contentHash,
        chunks[0]?.metadata.language ?? 'unknown',
        chunks.length
      )

      result.filesIndexed++
      result.chunksCreated += chunks.length
      totalChunks += chunks.length
      totalFiles++

      // Report progress to main thread
      parentPort?.postMessage({
        type: 'progress',
        workerId: data.workerId,
        file: file.filePath,
        shardId: file.shardId,
        chunks: chunks.length,
      })

    } catch (error) {
      result.errors++
      parentPort?.postMessage({
        type: 'error',
        workerId: data.workerId,
        file: file.filePath,
        error: String(error),
      })
    }
  }

  // Cleanup
  await embedder.dispose?.()
  for (const store of stores.values()) {
    await store.dispose()
  }

  // Send final result
  const finalResult: WorkerResult = {
    workerId: data.workerId,
    shardResults: Object.fromEntries(shardResults) as any,
    totalChunks,
    totalFiles,
    durationMs: Date.now() - startTime,
  }

  parentPort?.postMessage({ type: 'done', result: finalResult })
}

// Run if we're in a worker thread
if (parentPort) {
  runWorker().catch(error => {
    parentPort?.postMessage({ type: 'error', error: String(error) })
  })
}

/**
 * VectorStore - SQLite-based vector storage with similarity search
 *
 * Uses better-sqlite3 for SQLite operations and sqlite-vec extension
 * for efficient vector similarity search.
 */

import Database, { Database as DatabaseType } from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync, existsSync, statSync } from 'fs'
import { randomUUID } from 'crypto'

import type {
  VectorStoreOptions,
  VectorInsertOptions,
  Vector,
  SearchResult,
  IndexStats,
  VectorStore as IVectorStore,
} from './types'

// Default configuration
const DEFAULT_DB_PATH = join(homedir(), '.cache', 'mgrep-local', 'index.db')
const EMBEDDING_DIMENSIONS = 384

export class VectorStore implements IVectorStore {
  private dbPath: string
  private readonly: boolean
  private db: DatabaseType | null = null
  private initialized = false

  constructor(options: VectorStoreOptions = {}) {
    this.dbPath = options.dbPath ?? DEFAULT_DB_PATH
    this.readonly = options.readonly ?? false

    // Ensure directory exists
    const dir = join(this.dbPath, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.db = new Database(this.dbPath, {
      readonly: this.readonly,
    })

    // Load sqlite-vec extension
    sqliteVec.load(this.db)

    // Enable WAL mode for better concurrent performance
    this.db.pragma('journal_mode = WAL')

    // Create tables
    this.createTables()

    this.initialized = true
  }

  private createTables(): void {
    if (!this.db) return

    // Main vectors table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        language TEXT,
        function_name TEXT,
        class_scope TEXT,
        is_docstring INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `)

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_vectors_file_path ON vectors(file_path)`)

    // Vector similarity index using sqlite-vec
    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_index USING vec0(
        id TEXT PRIMARY KEY,
        embedding float[${EMBEDDING_DIMENSIONS}]
      )
    `)

    // Tracked files table for incremental indexing
    this.db.run(`
      CREATE TABLE IF NOT EXISTS indexed_files (
        file_path TEXT PRIMARY KEY,
        file_hash TEXT NOT NULL,
        language TEXT,
        chunks_count INTEGER,
        indexed_at TEXT DEFAULT (datetime('now'))
      )
    `)
  }

  /**
   * Insert a single vector
   */
  async insert(options: VectorInsertOptions): Promise<string> {
    this.ensureInitialized()

    const id = randomUUID()
    const embeddingBlob = this.embeddingToBlob(options.embedding)

    // Insert into vectors table
    const insertVector = this.db!.prepare(`
      INSERT INTO vectors (
        id, file_path, chunk_index, content, embedding,
        start_line, end_line, language, function_name, class_scope, is_docstring
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertVector.run(
      id,
      options.filePath,
      options.chunkIndex,
      options.content,
      embeddingBlob,
      options.metadata.startLine,
      options.metadata.endLine,
      options.metadata.language,
      options.metadata.functionName ?? null,
      options.metadata.classScope ?? null,
      options.metadata.isDocstring ? 1 : 0
    )

    // Insert into vector index
    const insertVec = this.db!.prepare(`
      INSERT INTO vec_index (id, embedding) VALUES (?, ?)
    `)
    insertVec.run(id, embeddingBlob)

    return id
  }

  /**
   * Insert multiple vectors in a transaction
   */
  async insertBatch(options: VectorInsertOptions[]): Promise<string[]> {
    this.ensureInitialized()

    const ids: string[] = []

    const insertVector = this.db!.prepare(`
      INSERT INTO vectors (
        id, file_path, chunk_index, content, embedding,
        start_line, end_line, language, function_name, class_scope, is_docstring
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertVec = this.db!.prepare(`
      INSERT INTO vec_index (id, embedding) VALUES (?, ?)
    `)

    const transaction = this.db!.transaction(() => {
      for (const opt of options) {
        const id = randomUUID()
        const embeddingBlob = this.embeddingToBlob(opt.embedding)

        insertVector.run(
          id,
          opt.filePath,
          opt.chunkIndex,
          opt.content,
          embeddingBlob,
          opt.metadata.startLine,
          opt.metadata.endLine,
          opt.metadata.language,
          opt.metadata.functionName ?? null,
          opt.metadata.classScope ?? null,
          opt.metadata.isDocstring ? 1 : 0
        )

        insertVec.run(id, embeddingBlob)
        ids.push(id)
      }
    })

    transaction()
    return ids
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async search(
    embedding: number[],
    limit: number = 10,
    threshold: number = 0.3
  ): Promise<SearchResult[]> {
    this.ensureInitialized()

    const embeddingBlob = this.embeddingToBlob(embedding)

    // Query the vector index for similar vectors
    // sqlite-vec returns distance (0 = identical), we convert to similarity
    const query = this.db!.prepare(`
      SELECT
        v.id,
        v.file_path,
        v.chunk_index,
        v.content,
        v.start_line,
        v.end_line,
        v.language,
        v.function_name,
        v.class_scope,
        v.is_docstring,
        vec.distance
      FROM vec_index vec
      JOIN vectors v ON v.id = vec.id
      WHERE vec.embedding MATCH ?
        AND k = ?
      ORDER BY vec.distance ASC
    `)

    const rows = query.all(embeddingBlob, limit * 2) as Array<{
      id: string
      file_path: string
      chunk_index: number
      content: string
      start_line: number | null
      end_line: number | null
      language: string | null
      function_name: string | null
      class_scope: string | null
      is_docstring: number
      distance: number
    }>

    // Convert distance to similarity and filter by threshold
    const results: SearchResult[] = []

    for (const row of rows) {
      // Cosine distance to similarity: similarity = 1 - distance
      const similarity = Math.max(0, 1 - row.distance)

      if (similarity >= threshold) {
        results.push({
          filePath: row.file_path,
          chunkIndex: row.chunk_index,
          content: row.content,
          similarity,
          metadata: {
            startLine: row.start_line ?? 0,
            endLine: row.end_line ?? 0,
            language: row.language ?? 'unknown',
            functionName: row.function_name ?? undefined,
            classScope: row.class_scope ?? undefined,
            isDocstring: row.is_docstring === 1,
          },
        })
      }

      if (results.length >= limit) {
        break
      }
    }

    return results
  }

  /**
   * Get all vectors for a specific file
   */
  async getVectorsForFile(filePath: string): Promise<Vector[]> {
    this.ensureInitialized()

    const query = this.db!.prepare(`
      SELECT * FROM vectors WHERE file_path = ? ORDER BY chunk_index ASC
    `)

    const rows = query.all(filePath) as Array<{
      id: string
      file_path: string
      chunk_index: number
      content: string
      embedding: Buffer
      start_line: number | null
      end_line: number | null
      language: string | null
      function_name: string | null
      class_scope: string | null
      is_docstring: number
    }>

    return rows.map((row) => ({
      id: row.id,
      filePath: row.file_path,
      chunkIndex: row.chunk_index,
      content: row.content,
      embedding: this.blobToEmbedding(row.embedding),
      metadata: {
        startLine: row.start_line ?? 0,
        endLine: row.end_line ?? 0,
        language: row.language ?? 'unknown',
        functionName: row.function_name ?? undefined,
        classScope: row.class_scope ?? undefined,
        isDocstring: row.is_docstring === 1,
      },
    }))
  }

  /**
   * Delete all vectors for a specific file
   */
  async deleteVectorsForFile(filePath: string): Promise<number> {
    this.ensureInitialized()

    // Get IDs to delete from vec_index
    const getIds = this.db!.prepare(`
      SELECT id FROM vectors WHERE file_path = ?
    `)
    const ids = getIds.all(filePath) as Array<{ id: string }>

    // Delete from both tables in a transaction
    const deleteVectors = this.db!.prepare(`
      DELETE FROM vectors WHERE file_path = ?
    `)
    const deleteVec = this.db!.prepare(`
      DELETE FROM vec_index WHERE id = ?
    `)
    const deleteFile = this.db!.prepare(`
      DELETE FROM indexed_files WHERE file_path = ?
    `)

    const transaction = this.db!.transaction(() => {
      for (const { id } of ids) {
        deleteVec.run(id)
      }
      const result = deleteVectors.run(filePath)
      deleteFile.run(filePath)
      return result.changes
    })

    return transaction()
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<IndexStats> {
    this.ensureInitialized()

    const statsQuery = this.db!.prepare(`
      SELECT
        COUNT(DISTINCT file_path) as total_files,
        COUNT(*) as total_chunks,
        MAX(updated_at) as last_indexed_at
      FROM vectors
    `)

    const stats = statsQuery.get() as {
      total_files: number
      total_chunks: number
      last_indexed_at: string | null
    }

    // Get database file size
    let databaseSize = 0
    try {
      const stat = statSync(this.dbPath)
      databaseSize = stat.size
    } catch {
      // File might not exist yet
    }

    return {
      totalFiles: stats.total_files,
      totalChunks: stats.total_chunks,
      totalEmbeddings: stats.total_chunks,
      databaseSize,
      lastIndexedAt: stats.last_indexed_at ? new Date(stats.last_indexed_at) : null,
    }
  }

  /**
   * Clear the entire index
   */
  async clear(): Promise<void> {
    this.ensureInitialized()

    this.db!.run(`DELETE FROM vectors`)
    this.db!.run(`DELETE FROM vec_index`)
    this.db!.run(`DELETE FROM indexed_files`)
  }

  /**
   * Close the database connection
   */
  async dispose(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initialized = false
    }
  }

  /**
   * Track an indexed file
   */
  async trackFile(filePath: string, hash: string, language: string, chunksCount: number): Promise<void> {
    this.ensureInitialized()

    const upsert = this.db!.prepare(`
      INSERT OR REPLACE INTO indexed_files (file_path, file_hash, language, chunks_count, indexed_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `)

    upsert.run(filePath, hash, language, chunksCount)
  }

  /**
   * Check if a file needs re-indexing
   */
  async getFileHash(filePath: string): Promise<string | null> {
    this.ensureInitialized()

    const query = this.db!.prepare(`
      SELECT file_hash FROM indexed_files WHERE file_path = ?
    `)

    const result = query.get(filePath) as { file_hash: string } | undefined
    return result?.file_hash ?? null
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('VectorStore not initialized. Call initialize() first.')
    }
  }

  private embeddingToBlob(embedding: number[]): Buffer {
    const float32 = new Float32Array(embedding)
    return Buffer.from(float32.buffer)
  }

  private blobToEmbedding(blob: Buffer): number[] {
    const float32 = new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4)
    return Array.from(float32)
  }
}

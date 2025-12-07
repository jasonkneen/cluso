/**
 * VectorStore - LanceDB-based vector storage with similarity search
 *
 * Uses LanceDB for efficient vector similarity search.
 * Pure JS/WASM - no native module compilation issues.
 */

import * as lancedb from '@lancedb/lancedb'
import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync, existsSync, statSync, readdirSync } from 'fs'
import { randomUUID } from 'crypto'

import type {
  VectorStoreOptions,
  VectorInsertOptions,
  Vector,
  SearchResult,
  IndexStats,
  VectorStore as IVectorStore,
} from './types.js'

// Default configuration - LanceDB uses a directory, not a file
const DEFAULT_DB_PATH = join(homedir(), '.cache', 'mgrep-local', 'vectors')
const VECTORS_TABLE = 'vectors'
const FILES_TABLE = 'indexed_files'

// Vector record schema - use index signature for LanceDB compatibility
// Note: LanceDB can't infer types from null, so we use empty strings instead
interface VectorRecord {
  [key: string]: unknown
  id: string
  file_path: string
  chunk_index: number
  content: string
  vector: number[]
  start_line: number
  end_line: number
  language: string
  function_name: string  // Empty string instead of null
  class_scope: string    // Empty string instead of null
  is_docstring: boolean
  created_at: string
}

// File tracking schema
interface FileRecord {
  [key: string]: unknown
  file_path: string
  file_hash: string
  language: string
  chunks_count: number
  indexed_at: string
}

export class VectorStore implements IVectorStore {
  private dbPath: string
  private readonly: boolean
  private db: lancedb.Connection | null = null
  private vectorsTable: lancedb.Table | null = null
  private filesTable: lancedb.Table | null = null
  private initialized = false

  constructor(options: VectorStoreOptions = {}) {
    this.dbPath = options.dbPath ?? DEFAULT_DB_PATH
    this.readonly = options.readonly ?? false

    // Ensure directory exists
    if (!existsSync(this.dbPath)) {
      mkdirSync(this.dbPath, { recursive: true })
    }
  }

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    // Connect to LanceDB
    this.db = await lancedb.connect(this.dbPath)

    // Check if tables exist and open/create them
    const tableNames = await this.db.tableNames()

    if (tableNames.includes(VECTORS_TABLE)) {
      this.vectorsTable = await this.db.openTable(VECTORS_TABLE)
    }

    if (tableNames.includes(FILES_TABLE)) {
      this.filesTable = await this.db.openTable(FILES_TABLE)
    }

    this.initialized = true
  }

  /**
   * Insert a single vector
   */
  async insert(options: VectorInsertOptions): Promise<string> {
    this.ensureInitialized()

    const id = randomUUID()
    const record: VectorRecord = {
      id,
      file_path: options.filePath,
      chunk_index: options.chunkIndex,
      content: options.content,
      vector: options.embedding,
      start_line: options.metadata.startLine,
      end_line: options.metadata.endLine,
      language: options.metadata.language,
      function_name: options.metadata.functionName ?? '',  // Empty string instead of null
      class_scope: options.metadata.classScope ?? '',      // Empty string instead of null
      is_docstring: options.metadata.isDocstring ?? false,
      created_at: new Date().toISOString(),
    }

    if (!this.vectorsTable) {
      // Create table with first record
      this.vectorsTable = await this.db!.createTable(VECTORS_TABLE, [record])
    } else {
      await this.vectorsTable.add([record])
    }

    return id
  }

  /**
   * Insert multiple vectors in a batch
   */
  async insertBatch(options: VectorInsertOptions[]): Promise<string[]> {
    this.ensureInitialized()

    if (options.length === 0) {
      return []
    }

    const records: VectorRecord[] = options.map(opt => ({
      id: randomUUID(),
      file_path: opt.filePath,
      chunk_index: opt.chunkIndex,
      content: opt.content,
      vector: opt.embedding,
      start_line: opt.metadata.startLine,
      end_line: opt.metadata.endLine,
      language: opt.metadata.language,
      function_name: opt.metadata.functionName ?? '',  // Empty string instead of null
      class_scope: opt.metadata.classScope ?? '',      // Empty string instead of null
      is_docstring: opt.metadata.isDocstring ?? false,
      created_at: new Date().toISOString(),
    }))

    if (!this.vectorsTable) {
      // Create table with first batch
      this.vectorsTable = await this.db!.createTable(VECTORS_TABLE, records)
    } else {
      await this.vectorsTable.add(records)
    }

    return records.map(r => r.id)
  }

  /**
   * Search for similar vectors using vector similarity
   */
  async search(
    embedding: number[],
    limit: number = 10,
    threshold: number = 0.0
  ): Promise<SearchResult[]> {
    this.ensureInitialized()

    if (!this.vectorsTable) {
      return []
    }

    // LanceDB vector search
    const results = await this.vectorsTable
      .vectorSearch(embedding)
      .limit(limit * 2) // Get more results to filter by threshold
      .toArray()

    // Convert to SearchResult format
    const searchResults: SearchResult[] = []

    for (const row of results) {
      // LanceDB returns _distance (L2 distance by default)
      // Convert to similarity score (0-1 range)
      const distance = row._distance ?? 0
      // For L2 distance, similarity = 1 / (1 + distance)
      const similarity = 1 / (1 + distance)

      if (similarity >= threshold) {
        searchResults.push({
          filePath: row.file_path as string,
          chunkIndex: row.chunk_index as number,
          content: row.content as string,
          similarity,
          metadata: {
            startLine: row.start_line as number,
            endLine: row.end_line as number,
            language: row.language as string,
            functionName: row.function_name as string | undefined,
            classScope: row.class_scope as string | undefined,
            isDocstring: row.is_docstring as boolean,
          },
        })
      }

      if (searchResults.length >= limit) {
        break
      }
    }

    return searchResults
  }

  /**
   * Get all vectors for a specific file
   */
  async getVectorsForFile(filePath: string): Promise<Vector[]> {
    this.ensureInitialized()

    if (!this.vectorsTable) {
      return []
    }

    const results = await this.vectorsTable
      .query()
      .where(`file_path = '${filePath.replace(/'/g, "''")}'`)
      .toArray()

    return results.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      filePath: row.file_path as string,
      chunkIndex: row.chunk_index as number,
      content: row.content as string,
      embedding: row.vector as number[],
      metadata: {
        startLine: row.start_line as number,
        endLine: row.end_line as number,
        language: row.language as string,
        functionName: row.function_name as string | undefined,
        classScope: row.class_scope as string | undefined,
        isDocstring: row.is_docstring as boolean,
      },
    }))
  }

  /**
   * Delete all vectors for a specific file
   */
  async deleteVectorsForFile(filePath: string): Promise<number> {
    this.ensureInitialized()

    if (!this.vectorsTable) {
      return 0
    }

    // Get count before deletion
    const existing = await this.vectorsTable
      .query()
      .where(`file_path = '${filePath.replace(/'/g, "''")}'`)
      .toArray()

    const count = existing.length

    if (count > 0) {
      await this.vectorsTable.delete(`file_path = '${filePath.replace(/'/g, "''")}'`)
    }

    // Also remove from files table
    if (this.filesTable) {
      try {
        await this.filesTable.delete(`file_path = '${filePath.replace(/'/g, "''")}'`)
      } catch {
        // Ignore if not found
      }
    }

    return count
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<IndexStats> {
    this.ensureInitialized()

    let totalFiles = 0
    let totalChunks = 0
    let lastIndexedAt: Date | null = null

    if (this.vectorsTable) {
      const allRecords = await this.vectorsTable.query().toArray()
      totalChunks = allRecords.length

      const filePaths = new Set(allRecords.map((r: Record<string, unknown>) => r.file_path))
      totalFiles = filePaths.size

      // Find most recent created_at
      if (allRecords.length > 0) {
        const dates = allRecords
          .map((r: Record<string, unknown>) => r.created_at as string)
          .filter(Boolean)
          .sort()
          .reverse()

        if (dates.length > 0) {
          lastIndexedAt = new Date(dates[0])
        }
      }
    }

    // Get database directory size
    let databaseSize = 0
    try {
      databaseSize = this.getDirectorySize(this.dbPath)
    } catch {
      // Directory might not exist yet
    }

    return {
      totalFiles,
      totalChunks,
      totalEmbeddings: totalChunks,
      databaseSize,
      lastIndexedAt,
    }
  }

  /**
   * Clear the entire index
   */
  async clear(): Promise<void> {
    this.ensureInitialized()

    if (this.vectorsTable) {
      await this.db!.dropTable(VECTORS_TABLE)
      this.vectorsTable = null
    }

    if (this.filesTable) {
      await this.db!.dropTable(FILES_TABLE)
      this.filesTable = null
    }
  }

  /**
   * Close the database connection
   */
  async dispose(): Promise<void> {
    // LanceDB doesn't require explicit close
    this.db = null
    this.vectorsTable = null
    this.filesTable = null
    this.initialized = false
  }

  /**
   * Track an indexed file
   */
  async trackFile(filePath: string, hash: string, language: string, chunksCount: number): Promise<void> {
    this.ensureInitialized()

    const record: FileRecord = {
      file_path: filePath,
      file_hash: hash,
      language,
      chunks_count: chunksCount,
      indexed_at: new Date().toISOString(),
    }

    if (!this.filesTable) {
      this.filesTable = await this.db!.createTable(FILES_TABLE, [record])
    } else {
      // Delete existing record if any, then add new one
      try {
        await this.filesTable.delete(`file_path = '${filePath.replace(/'/g, "''")}'`)
      } catch {
        // Ignore if not found
      }
      await this.filesTable.add([record])
    }
  }

  /**
   * Check if a file needs re-indexing
   */
  async getFileHash(filePath: string): Promise<string | null> {
    this.ensureInitialized()

    if (!this.filesTable) {
      return null
    }

    try {
      const results = await this.filesTable
        .query()
        .where(`file_path = '${filePath.replace(/'/g, "''")}'`)
        .toArray()

      if (results.length > 0) {
        return (results[0] as Record<string, unknown>).file_hash as string
      }
    } catch {
      // Table might not exist or be empty
    }

    return null
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('VectorStore not initialized. Call initialize() first.')
    }
  }

  private getDirectorySize(dirPath: string): number {
    let size = 0

    if (!existsSync(dirPath)) {
      return 0
    }

    const files = readdirSync(dirPath)
    for (const file of files) {
      const filePath = join(dirPath, file)
      const stat = statSync(filePath)

      if (stat.isDirectory()) {
        size += this.getDirectorySize(filePath)
      } else {
        size += stat.size
      }
    }

    return size
  }
}

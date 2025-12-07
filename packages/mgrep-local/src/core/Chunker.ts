/**
 * Chunker - Code-aware text splitting for semantic search
 *
 * Splits code into meaningful chunks while preserving:
 * - Function/class boundaries
 * - Line number information
 * - Language context
 */

import { extname } from 'path'

import type {
  ChunkerOptions,
  Chunk,
  Chunker as IChunker,
} from './types.js'

// Default configuration
const DEFAULT_MAX_CHUNK_SIZE = 500
const DEFAULT_OVERLAP_SIZE = 50

// Language detection by file extension
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.xml': 'xml',
}

// Patterns for detecting code boundaries
const BOUNDARY_PATTERNS: Record<string, RegExp> = {
  typescript: /^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+\w+/gm,
  javascript: /^(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+\w+/gm,
  python: /^(?:async\s+)?(?:def|class)\s+\w+/gm,
  ruby: /^(?:def|class|module)\s+\w+/gm,
  go: /^(?:func|type)\s+\w+/gm,
  rust: /^(?:pub\s+)?(?:fn|struct|enum|impl|trait|mod)\s+\w+/gm,
  java: /^(?:public|private|protected)?\s*(?:static\s+)?(?:class|interface|enum|void|int|String)\s+\w+/gm,
  kotlin: /^(?:fun|class|interface|object|data class)\s+\w+/gm,
  swift: /^(?:func|class|struct|enum|protocol)\s+\w+/gm,
  c: /^(?:static\s+)?(?:void|int|char|float|double|struct)\s+\w+\s*\(/gm,
  cpp: /^(?:class|struct|void|int|auto)\s+\w+/gm,
  csharp: /^(?:public|private|protected|internal)?\s*(?:static\s+)?(?:class|interface|struct|enum|void)\s+\w+/gm,
  php: /^(?:function|class|interface|trait)\s+\w+/gm,
}

// Pattern for extracting function names
const FUNCTION_NAME_PATTERNS: Record<string, RegExp> = {
  typescript: /(?:function|class|interface|type|enum)\s+(\w+)/,
  javascript: /(?:function|class)\s+(\w+)/,
  python: /(?:def|class)\s+(\w+)/,
  ruby: /(?:def|class|module)\s+(\w+)/,
  go: /(?:func|type)\s+(\w+)/,
  rust: /(?:fn|struct|enum|impl|trait|mod)\s+(\w+)/,
  java: /(?:class|interface|enum)\s+(\w+)|(\w+)\s*\(/,
  kotlin: /(?:fun|class|interface|object)\s+(\w+)/,
  swift: /(?:func|class|struct|enum|protocol)\s+(\w+)/,
  c: /(\w+)\s*\(/,
  cpp: /(?:class|struct)\s+(\w+)|(\w+)\s*\(/,
  csharp: /(?:class|interface|struct|enum)\s+(\w+)|(\w+)\s*\(/,
  php: /(?:function|class|interface|trait)\s+(\w+)/,
}

export class Chunker implements IChunker {
  private maxChunkSize: number
  private overlapSize: number
  private respectBoundaries: boolean

  constructor(options: ChunkerOptions = {}) {
    this.maxChunkSize = options.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE
    this.overlapSize = options.overlapSize ?? DEFAULT_OVERLAP_SIZE
    this.respectBoundaries = options.respectBoundaries ?? true
  }

  /**
   * Chunk code into semantic units
   */
  chunk(code: string, filePath?: string): Chunk[] {
    if (!code || code.trim().length === 0) {
      return []
    }

    const language = filePath ? this.detectLanguage(filePath, code) : 'unknown'
    const lines = code.split('\n')

    // Try code-aware chunking first
    if (this.respectBoundaries && BOUNDARY_PATTERNS[language]) {
      const structuralChunks = this.chunkByStructure(code, language)
      if (structuralChunks.length > 0) {
        return structuralChunks
      }
    }

    // Fallback to sliding window
    return this.chunkBySlidingWindow(code, language)
  }

  /**
   * Detect language from file path and content
   */
  detectLanguage(filePath: string, content?: string): string {
    // Try extension first
    const ext = extname(filePath).toLowerCase()
    if (EXTENSION_TO_LANGUAGE[ext]) {
      return EXTENSION_TO_LANGUAGE[ext]
    }

    // Fallback to content heuristics
    if (content) {
      if (content.includes('#!/usr/bin/env python') || content.includes('#!/usr/bin/python')) {
        return 'python'
      }
      if (content.includes('#!/bin/bash') || content.includes('#!/bin/sh')) {
        return 'shell'
      }
      if (content.includes('package main') && content.includes('func ')) {
        return 'go'
      }
      if (content.includes('fn main()') || content.includes('use std::')) {
        return 'rust'
      }
    }

    return 'unknown'
  }

  /**
   * Chunk by code structure (functions, classes, etc.)
   */
  private chunkByStructure(code: string, language: string): Chunk[] {
    const pattern = BOUNDARY_PATTERNS[language]
    if (!pattern) {
      return []
    }

    const chunks: Chunk[] = []
    const matches: Array<{ index: number; match: string }> = []

    // Find all boundary matches
    let match: RegExpExecArray | null
    const patternCopy = new RegExp(pattern.source, pattern.flags)
    while ((match = patternCopy.exec(code)) !== null) {
      matches.push({ index: match.index, match: match[0] })
    }

    if (matches.length === 0) {
      return []
    }

    // Split code at boundaries
    for (let i = 0; i < matches.length; i++) {
      const startIndex = matches[i].index
      const endIndex = i + 1 < matches.length ? matches[i + 1].index : code.length

      const chunkContent = code.substring(startIndex, endIndex).trim()

      if (chunkContent.length === 0) {
        continue
      }

      // Calculate line numbers
      const startLine = this.indexToLineNumber(code, startIndex)
      const endLine = this.indexToLineNumber(code, endIndex - 1)

      // Extract function/class name
      const functionName = this.extractFunctionName(chunkContent, language)

      // Check if this is a docstring/comment block
      const isDocstring = this.isDocstring(chunkContent, language)

      // If chunk is too large, split it further
      if (chunkContent.length > this.maxChunkSize) {
        const subChunks = this.splitLargeChunk(chunkContent, language, startLine, functionName)
        chunks.push(...subChunks)
      } else {
        chunks.push({
          content: chunkContent,
          metadata: {
            startLine,
            endLine,
            language,
            functionName,
            isDocstring,
          },
        })
      }
    }

    return chunks
  }

  /**
   * Chunk by sliding window with overlap
   */
  private chunkBySlidingWindow(code: string, language: string): Chunk[] {
    const chunks: Chunk[] = []
    const lines = code.split('\n')
    let currentChunk = ''
    let chunkStartLine = 1
    let currentLine = 1

    for (const line of lines) {
      const potentialChunk = currentChunk + (currentChunk ? '\n' : '') + line

      if (potentialChunk.length > this.maxChunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            startLine: chunkStartLine,
            endLine: currentLine - 1,
            language,
          },
        })

        // Start new chunk with overlap
        const overlapLines = this.getOverlapLines(currentChunk, this.overlapSize)
        currentChunk = overlapLines + '\n' + line
        chunkStartLine = Math.max(1, currentLine - overlapLines.split('\n').length)
      } else {
        currentChunk = potentialChunk
      }

      currentLine++
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          startLine: chunkStartLine,
          endLine: currentLine - 1,
          language,
        },
      })
    }

    return chunks
  }

  /**
   * Split a large chunk into smaller pieces
   */
  private splitLargeChunk(
    content: string,
    language: string,
    baseStartLine: number,
    functionName?: string
  ): Chunk[] {
    const chunks: Chunk[] = []
    const lines = content.split('\n')
    let currentChunk = ''
    let chunkStartLine = baseStartLine
    let currentLine = baseStartLine

    for (const line of lines) {
      const potentialChunk = currentChunk + (currentChunk ? '\n' : '') + line

      if (potentialChunk.length > this.maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            startLine: chunkStartLine,
            endLine: currentLine - 1,
            language,
            functionName,
          },
        })

        currentChunk = line
        chunkStartLine = currentLine
      } else {
        currentChunk = potentialChunk
      }

      currentLine++
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          startLine: chunkStartLine,
          endLine: currentLine - 1,
          language,
          functionName,
        },
      })
    }

    return chunks
  }

  /**
   * Extract function/class name from code
   */
  private extractFunctionName(code: string, language: string): string | undefined {
    const pattern = FUNCTION_NAME_PATTERNS[language]
    if (!pattern) {
      return undefined
    }

    const match = pattern.exec(code)
    if (match) {
      return match[1] || match[2]
    }

    return undefined
  }

  /**
   * Check if content is primarily a docstring/comment
   */
  private isDocstring(content: string, language: string): boolean {
    const trimmed = content.trim()

    if (language === 'python') {
      return trimmed.startsWith('"""') || trimmed.startsWith("'''")
    }

    if (['typescript', 'javascript'].includes(language)) {
      return trimmed.startsWith('/**')
    }

    return trimmed.startsWith('/*') && !trimmed.includes('\n')
  }

  /**
   * Get overlap text from end of chunk
   */
  private getOverlapLines(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content
    }

    const endPortion = content.substring(content.length - maxLength)
    const lineStart = endPortion.indexOf('\n')
    if (lineStart > 0 && lineStart < maxLength / 2) {
      return endPortion.substring(lineStart + 1)
    }

    return endPortion
  }

  /**
   * Convert character index to line number
   */
  private indexToLineNumber(code: string, index: number): number {
    const upToIndex = code.substring(0, index)
    return upToIndex.split('\n').length
  }
}

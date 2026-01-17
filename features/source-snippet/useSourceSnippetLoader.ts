/**
 * Source Snippet Loader Hook
 *
 * Handles loading source code snippets for selected elements.
 * Extracted from App.tsx lines 905-951.
 */

import { useEffect, useCallback } from 'react'
import { fileService } from '../../services/FileService'

interface SourceLocation {
  sources?: Array<{ file?: string; line?: number }>
  summary?: string
}

interface SelectedElement {
  sourceLocation?: SourceLocation
}

interface SourceSnippet {
  filePath: string
  displayPath: string
  startLine: number
  focusLine: number
  language: string
  code: string
}

interface UseSourceSnippetLoaderOptions {
  selectedElement: SelectedElement | null
  projectPath: string | undefined
  isElectron: boolean
  setSelectedElementSourceSnippet: (snippet: SourceSnippet | null) => void
}

/**
 * Hook for loading source code snippets
 *
 * Loads source code context around the selected element's source location.
 */
export function useSourceSnippetLoader({
  selectedElement,
  projectPath,
  isElectron,
  setSelectedElementSourceSnippet,
}: UseSourceSnippetLoaderOptions): void {
  const resolveSourceFilePath = useCallback((projPath: string, raw: string) => {
    let file = String(raw || '').trim()
    if (!file) return { absPath: '', displayPath: '' }

    let fromHttpUrl = false
    let fromFileUrl = false
    try {
      if (file.startsWith('http://') || file.startsWith('https://')) {
        const u = new URL(file)
        file = u.pathname
        fromHttpUrl = true
      } else if (file.startsWith('file://')) {
        const u = new URL(file)
        file = u.pathname
        fromFileUrl = true
      }
    } catch {
      // ignore
    }

    // Drop any query/hash noise from sourcemap-style URLs.
    file = file.split('?')[0].split('#')[0]
    file = file.replace(/^webpack-internal:\/\//, '')
    file = file.replace(/^webpack:\/{3}/, '') // webpack:///src/App.tsx
    file = file.replace(/^webpack:\/\//, '') // webpack://src/App.tsx
    // Fallback if URL parsing failed (keeps old behavior for file:// URLs)
    file = file.replace(/^file:\/\//, '')
    // Vite dev URLs can show file system paths as /@fs/Users/...; normalize back.
    file = file.replace(/^\/@fs\//, '/')

    const displayPath = fromHttpUrl ? file.replace(/^\/+/, '') : file

    const isWindowsAbs = /^[A-Z]:\\/.test(file)
    const isPosixAbs = file.startsWith('/')

    // IMPORTANT: If a file path came from an http(s) URL, its pathname is *project-relative*.
    // Also treat /src/... as project-relative, since this is a common URL pathname shape.
    const treatPosixAbsAsProjectRelative =
      !!projPath &&
      isPosixAbs &&
      !fromFileUrl &&
      (fromHttpUrl || file.startsWith('/src/'))

    const absPath =
      isWindowsAbs || (isPosixAbs && !treatPosixAbsAsProjectRelative)
        ? file
        : `${projPath}/${file.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/')
    return { absPath, displayPath }
  }, [])

  const getCodeLanguageFromPath = useCallback((path: string) => {
    const ext = (path.split('.').pop() || '').toLowerCase()
    if (ext === 'tsx') return 'tsx'
    if (ext === 'ts') return 'typescript'
    if (ext === 'jsx') return 'jsx'
    if (ext === 'js') return 'javascript'
    if (ext === 'html' || ext === 'htm') return 'html'
    if (ext === 'css') return 'css'
    if (ext === 'json') return 'json'
    if (ext === 'md' || ext === 'markdown') return 'markdown'
    return 'tsx'
  }, [])

  useEffect(() => {
    let cancelled = false
    const src0 = selectedElement?.sourceLocation?.sources?.[0] as { file?: string; line?: number } | undefined
    const rawFile = src0?.file
    const rawLine = src0?.line

    if (!isElectron || !projectPath || !rawFile || !rawLine) {
      setSelectedElementSourceSnippet(null)
      return
    }

    const { absPath, displayPath } = resolveSourceFilePath(projectPath, rawFile)
    if (!absPath) {
      setSelectedElementSourceSnippet(null)
      return
    }

    fileService.readFileFull(absPath).then((result: { success: boolean; data?: string; error?: string }) => {
      if (cancelled) return
      if (!result.success || typeof result.data !== 'string') {
        setSelectedElementSourceSnippet(null)
        return
      }

      const allLines = result.data.split('\n')
      const focusLine = Math.max(1, Math.min(allLines.length, Number(rawLine) || 1))
      const startLine = Math.max(1, focusLine - 12)
      const endLine = Math.min(allLines.length, focusLine + 28)
      const code = allLines.slice(startLine - 1, endLine).join('\n')

      setSelectedElementSourceSnippet({
        filePath: absPath,
        displayPath,
        startLine,
        focusLine,
        language: getCodeLanguageFromPath(displayPath),
        code,
      })
    }).catch(() => {
      if (!cancelled) setSelectedElementSourceSnippet(null)
    })

    return () => {
      cancelled = true
    }
  }, [
    selectedElement?.sourceLocation?.sources,
    projectPath,
    isElectron,
    setSelectedElementSourceSnippet,
    resolveSourceFilePath,
    getCodeLanguageFromPath,
  ])
}

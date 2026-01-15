/**
 * Attachment State Management Hook
 *
 * Centralizes attachment-related state management extracted from App.tsx.
 * Handles logs, images, file selections, and drag-and-drop state.
 */

import { useState, useCallback } from 'react'
import type { SelectedFile, AttachmentState, AttachmentStateActions } from './types'

export interface UseAttachmentStateReturn extends AttachmentState, AttachmentStateActions {}

/**
 * Hook for managing attachment state
 *
 * Extracts and centralizes attachment state management from App.tsx.
 * Provides state and actions for logs, images, file selections, and drag-and-drop.
 */
export function useAttachmentState(): UseAttachmentStateReturn {
  // Log state
  const [logs, setLogs] = useState<string[]>([])
  const [attachLogs, setAttachLogs] = useState(false)

  // Image attachment state
  const [attachedImages, setAttachedImages] = useState<string[]>([])

  // Drag-and-drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // File selection state (@ commands)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])

  // Action: Add a log entry
  const addLog = useCallback((log: string) => {
    setLogs(prev => [...prev, log])
  }, [])

  // Action: Clear all logs
  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  // Action: Add an image attachment
  const addImage = useCallback((base64Image: string) => {
    setAttachedImages(prev => [...prev, base64Image])
  }, [])

  // Action: Remove an image by index
  const removeImage = useCallback((index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Action: Clear all attached images
  const clearImages = useCallback(() => {
    setAttachedImages([])
  }, [])

  // Action: Add a selected file
  const addSelectedFile = useCallback((file: SelectedFile) => {
    setSelectedFiles(prev => {
      // Avoid duplicates by path
      if (prev.some(f => f.path === file.path)) {
        return prev
      }
      return [...prev, file]
    })
  }, [])

  // Action: Remove a selected file by path
  const removeSelectedFile = useCallback((path: string) => {
    setSelectedFiles(prev => prev.filter(f => f.path !== path))
  }, [])

  // Action: Clear all selected files
  const clearSelectedFiles = useCallback(() => {
    setSelectedFiles([])
  }, [])

  // Action: Clear all attachments
  const clearAllAttachments = useCallback(() => {
    setLogs([])
    setAttachLogs(false)
    setAttachedImages([])
    setSelectedFiles([])
  }, [])

  return {
    // State
    logs,
    attachLogs,
    attachedImages,
    isDraggingOver,
    selectedFiles,
    // Setters
    setLogs,
    setAttachLogs,
    setAttachedImages,
    setIsDraggingOver,
    setSelectedFiles,
    // Actions
    addLog,
    clearLogs,
    addImage,
    removeImage,
    clearImages,
    addSelectedFile,
    removeSelectedFile,
    clearSelectedFiles,
    clearAllAttachments,
  }
}

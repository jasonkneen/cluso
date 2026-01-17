/**
 * Steering Questions Sync Hook
 *
 * Handles updating steering questions based on context changes.
 * Extracted from App.tsx lines 744-750.
 */

import { useEffect } from 'react'
import type { ChatMessage } from '../chat/types'

interface SelectedElement {
  tagName?: string
  xpath?: string
}

interface SteeringContext {
  messages: ChatMessage[]
  selectedElement: SelectedElement | null
  currentTab: string
}

interface UseSteeringQuestionsSyncOptions {
  messages: ChatMessage[]
  selectedElement: SelectedElement | null
  refreshQuestions: (context: SteeringContext) => void
}

/**
 * Hook for syncing steering questions with context
 *
 * Refreshes steering questions when messages or selected element change.
 */
export function useSteeringQuestionsSync({
  messages,
  selectedElement,
  refreshQuestions,
}: UseSteeringQuestionsSyncOptions): void {
  useEffect(() => {
    refreshQuestions({
      messages,
      selectedElement,
      currentTab: 'chat', // Could expand this to support other tab types
    })
  }, [messages, selectedElement, refreshQuestions])
}

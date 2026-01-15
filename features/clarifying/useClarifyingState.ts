/**
 * Clarifying Question State Hook
 *
 * Manages state and handlers for AI clarifying questions.
 * Uses a ref to store the promise resolver for async question/answer flow.
 */

import { useState, useCallback, useRef } from 'react'

import type {
  ClarifyingQuestionData,
  ClarifyingQuestionState,
  ClarifyingQuestionActions,
} from './types'

export interface UseClarifyingStateReturn extends ClarifyingQuestionState, ClarifyingQuestionActions {}

export function useClarifyingState(): UseClarifyingStateReturn {
  const [pendingQuestion, setPendingQuestion] = useState<ClarifyingQuestionData | null>(null)
  const clarifyingQuestionResolverRef = useRef<((response: string | string[]) => void) | null>(null)

  // Handler for clarifying questions from AI - returns a Promise that resolves when user responds
  const handleAskClarifyingQuestion = useCallback((question: ClarifyingQuestionData): Promise<string | string[]> => {
    return new Promise((resolve) => {
      clarifyingQuestionResolverRef.current = resolve
      setPendingQuestion(question)
    })
  }, [])

  // Handle clarifying question submission
  const handleClarifyingQuestionSubmit = useCallback((_questionId: string, response: string | string[]) => {
    if (clarifyingQuestionResolverRef.current) {
      clarifyingQuestionResolverRef.current(response)
      clarifyingQuestionResolverRef.current = null
    }
    setPendingQuestion(null)
  }, [])

  // Handle clarifying question skip
  const handleClarifyingQuestionSkip = useCallback((_questionId: string) => {
    if (clarifyingQuestionResolverRef.current) {
      clarifyingQuestionResolverRef.current('skipped')
      clarifyingQuestionResolverRef.current = null
    }
    setPendingQuestion(null)
  }, [])

  return {
    // State
    pendingQuestion,
    // Actions
    setPendingQuestion,
    handleAskClarifyingQuestion,
    handleClarifyingQuestionSubmit,
    handleClarifyingQuestionSkip,
  }
}

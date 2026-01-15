/**
 * Clarifying Question Types
 *
 * Type definitions for AI clarifying question functionality.
 */

/**
 * Option for single-select or multi-select questions
 */
export interface QuestionOption {
  id: string
  label: string
  description?: string
}

/**
 * Data structure for a clarifying question from AI
 */
export interface ClarifyingQuestionData {
  id: string
  question: string
  type: 'single-select' | 'multi-select' | 'text' | 'confirm'
  options?: QuestionOption[]
  placeholder?: string
  required?: boolean
}

/**
 * State for pending clarifying question
 */
export interface ClarifyingQuestionState {
  pendingQuestion: ClarifyingQuestionData | null
}

/**
 * Actions for clarifying question management
 */
export interface ClarifyingQuestionActions {
  setPendingQuestion: React.Dispatch<React.SetStateAction<ClarifyingQuestionData | null>>
  handleAskClarifyingQuestion: (question: ClarifyingQuestionData) => Promise<string | string[]>
  handleClarifyingQuestionSubmit: (questionId: string, response: string | string[]) => void
  handleClarifyingQuestionSkip: (questionId: string) => void
}

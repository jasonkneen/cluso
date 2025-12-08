import { useState, useCallback, useMemo } from 'react'
import { Message } from '../types'

export interface SteeringQuestion {
  id: string
  text: string
  category: 'getting-started' | 'debugging' | 'ui-changes' | 'code-review'
  relevance: number // 0-1, higher = more relevant to current context
}

export interface UseSteeringQuestionsReturn {
  questions: SteeringQuestion[]
  dismissedQuestions: Set<string>
  dismissQuestion: (questionId: string) => void
  selectQuestion: (questionId: string) => string
  refreshQuestions: (context: QuestionContext) => void
}

export interface QuestionContext {
  messages: Message[]
  selectedElement: any | null
  currentTab: 'chat' | 'code' | 'inspector'
  projectType?: string // e.g., 'react', 'web', 'general'
}

// Question templates organized by category
const QUESTION_TEMPLATES: Record<string, SteeringQuestion[]> = {
  'getting-started': [
    {
      id: 'gs-1',
      text: 'What would you like to build today?',
      category: 'getting-started',
      relevance: 1,
    },
    {
      id: 'gs-2',
      text: 'Show me the project structure',
      category: 'getting-started',
      relevance: 0.9,
    },
    {
      id: 'gs-3',
      text: 'Help me understand this codebase',
      category: 'getting-started',
      relevance: 0.85,
    },
    {
      id: 'gs-4',
      text: 'What are the main features?',
      category: 'getting-started',
      relevance: 0.8,
    },
    {
      id: 'gs-5',
      text: 'How do I set up the development environment?',
      category: 'getting-started',
      relevance: 0.75,
    },
  ],
  'debugging': [
    {
      id: 'dbg-1',
      text: 'What error are you seeing?',
      category: 'debugging',
      relevance: 0.95,
    },
    {
      id: 'dbg-2',
      text: 'When did this start happening?',
      category: 'debugging',
      relevance: 0.9,
    },
    {
      id: 'dbg-3',
      text: 'Can you help me debug this?',
      category: 'debugging',
      relevance: 0.85,
    },
    {
      id: 'dbg-4',
      text: 'Why is this component not rendering?',
      category: 'debugging',
      relevance: 0.8,
    },
    {
      id: 'dbg-5',
      text: 'Check the console for errors',
      category: 'debugging',
      relevance: 0.75,
    },
  ],
  'ui-changes': [
    {
      id: 'ui-1',
      text: 'Which element should I modify?',
      category: 'ui-changes',
      relevance: 0.95,
    },
    {
      id: 'ui-2',
      text: 'What style changes do you want?',
      category: 'ui-changes',
      relevance: 0.9,
    },
    {
      id: 'ui-3',
      text: 'Change the color scheme',
      category: 'ui-changes',
      relevance: 0.85,
    },
    {
      id: 'ui-4',
      text: 'Make this button more prominent',
      category: 'ui-changes',
      relevance: 0.8,
    },
    {
      id: 'ui-5',
      text: 'Improve the spacing and layout',
      category: 'ui-changes',
      relevance: 0.75,
    },
  ],
  'code-review': [
    {
      id: 'cr-1',
      text: 'What should I look for?',
      category: 'code-review',
      relevance: 0.9,
    },
    {
      id: 'cr-2',
      text: 'Any specific concerns?',
      category: 'code-review',
      relevance: 0.85,
    },
    {
      id: 'cr-3',
      text: 'Review this code for best practices',
      category: 'code-review',
      relevance: 0.8,
    },
    {
      id: 'cr-4',
      text: 'Is this implementation correct?',
      category: 'code-review',
      relevance: 0.75,
    },
    {
      id: 'cr-5',
      text: 'Suggest performance improvements',
      category: 'code-review',
      relevance: 0.7,
    },
  ],
}

/**
 * Determines which question categories are most relevant based on context
 */
function getRelevantCategories(context: QuestionContext): Array<{category: string; weight: number}> {
  const categories: Array<{category: string; weight: number}> = []

  // If no messages, suggest getting-started questions
  if (context.messages.length === 0) {
    categories.push({ category: 'getting-started', weight: 1 })
    categories.push({ category: 'ui-changes', weight: 0.6 })
    return categories
  }

  // Check last few messages for context clues
  const recentMessages = context.messages.slice(-5)
  const messageText = recentMessages.map(m => m.content.toLowerCase()).join(' ')

  // Detect debugging context
  if (
    messageText.includes('error') ||
    messageText.includes('bug') ||
    messageText.includes('broken') ||
    messageText.includes('debug') ||
    messageText.includes('fix')
  ) {
    categories.push({ category: 'debugging', weight: 1 })
    categories.push({ category: 'code-review', weight: 0.7 })
  }

  // Detect UI changes context
  if (
    context.selectedElement ||
    messageText.includes('style') ||
    messageText.includes('color') ||
    messageText.includes('button') ||
    messageText.includes('layout') ||
    messageText.includes('spacing')
  ) {
    categories.push({ category: 'ui-changes', weight: 1 })
    if (context.selectedElement) {
      // If element is selected, UI questions are very relevant
      categories.push({ category: 'ui-changes', weight: 1.2 })
    }
  }

  // Detect code review context
  if (
    messageText.includes('review') ||
    messageText.includes('refactor') ||
    messageText.includes('improve') ||
    messageText.includes('optimize')
  ) {
    categories.push({ category: 'code-review', weight: 1 })
  }

  // Default to having some getting-started questions available
  if (categories.length === 0) {
    categories.push({ category: 'getting-started', weight: 0.5 })
    categories.push({ category: 'ui-changes', weight: 0.6 })
  }

  return categories
}

/**
 * Calculates question relevance score based on category weights and context
 */
function calculateRelevance(
  question: SteeringQuestion,
  categoryWeights: Map<string, number>,
  dismissedQuestions: Set<string>
): number {
  if (dismissedQuestions.has(question.id)) {
    return 0
  }

  const categoryWeight = categoryWeights.get(question.category) || 0
  return question.relevance * categoryWeight
}

/**
 * Hook for managing steering questions - suggests contextual questions to guide users
 */
export function useSteeringQuestions(): UseSteeringQuestionsReturn {
  const [dismissedQuestions, setDismissedQuestions] = useState<Set<string>>(new Set())
  const [currentContext, setCurrentContext] = useState<QuestionContext | null>(null)

  const questions = useMemo(() => {
    if (!currentContext) return []

    // Get relevant categories based on context
    const relevantCategories = getRelevantCategories(currentContext)
    const categoryWeights = new Map(relevantCategories.map(r => [r.category, r.weight]))

    // Collect all questions and score them
    const allQuestions = Object.values(QUESTION_TEMPLATES).flat()
    const scoredQuestions = allQuestions
      .map(q => ({
        ...q,
        score: calculateRelevance(q, categoryWeights, dismissedQuestions),
      }))
      .filter(q => q.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) // Show top 3 most relevant questions
      .map(({ score, ...q }) => q)

    return scoredQuestions
  }, [currentContext, dismissedQuestions])

  const dismissQuestion = useCallback((questionId: string) => {
    setDismissedQuestions(prev => new Set([...prev, questionId]))
  }, [])

  const selectQuestion = useCallback((questionId: string): string => {
    const question = questions.find(q => q.id === questionId)
    if (question) {
      dismissQuestion(questionId)
      return question.text
    }
    return ''
  }, [questions, dismissQuestion])

  const refreshQuestions = useCallback((context: QuestionContext) => {
    setCurrentContext(context)
  }, [])

  return {
    questions,
    dismissedQuestions,
    dismissQuestion,
    selectQuestion,
    refreshQuestions,
  }
}

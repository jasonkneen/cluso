import React, { useEffect, useState } from 'react'
import { X, Lightbulb } from 'lucide-react'
import { SteeringQuestion } from '../hooks/useSteeringQuestions'

interface SteeringQuestionsProps {
  questions: SteeringQuestion[]
  onSelectQuestion: (text: string) => void
  onDismissQuestion: (questionId: string) => void
  isDarkMode?: boolean
  isVisible?: boolean
}

export const SteeringQuestions: React.FC<SteeringQuestionsProps> = ({
  questions,
  onSelectQuestion,
  onDismissQuestion,
  isDarkMode = true,
  isVisible = true,
}) => {
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set())
  const [displayedQuestions, setDisplayedQuestions] = useState<SteeringQuestion[]>([])

  // Update displayed questions when new ones arrive
  useEffect(() => {
    setDisplayedQuestions(questions)
  }, [questions])

  if (!isVisible || displayedQuestions.length === 0) {
    return null
  }

  const handleDismiss = (questionId: string) => {
    setAnimatingOut(prev => new Set([...prev, questionId]))
    setTimeout(() => {
      onDismissQuestion(questionId)
    }, 200)
  }

  const handleSelect = (question: SteeringQuestion) => {
    setAnimatingOut(prev => new Set([...prev, question.id]))
    setTimeout(() => {
      onSelectQuestion(question.text)
    }, 200)
  }

  return (
    <div
      className={`px-3 py-2 border-t transition-all duration-200 ${
        isDarkMode
          ? 'border-neutral-600 bg-neutral-800/50'
          : 'border-stone-200 bg-stone-50/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb
          size={14}
          className={isDarkMode ? 'text-amber-400' : 'text-amber-600'}
        />
        <span
          className={`text-xs font-medium ${
            isDarkMode ? 'text-neutral-400' : 'text-stone-500'
          }`}
        >
          Suggested questions
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {displayedQuestions.map(question => (
          <div
            key={question.id}
            className={`transition-all duration-200 overflow-hidden ${
              animatingOut.has(question.id)
                ? 'opacity-0 scale-95 w-0'
                : 'opacity-100 scale-100'
            }`}
          >
            <button
              onClick={() => handleSelect(question)}
              className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                isDarkMode
                  ? 'bg-neutral-700 text-neutral-200 border border-neutral-600 hover:bg-neutral-600 hover:border-neutral-500'
                  : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-200 hover:border-stone-300'
              }`}
              title={question.text}
            >
              <span className="truncate max-w-[180px]">{question.text}</span>

              {/* Dismiss button (appears on hover) */}
              <button
                onClick={e => {
                  e.stopPropagation()
                  handleDismiss(question.id)
                }}
                className={`ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-0.5 rounded hover:bg-red-500/20 ${
                  isDarkMode ? 'text-neutral-400 hover:text-red-400' : 'text-stone-400 hover:text-red-600'
                }`}
                title="Dismiss this question"
              >
                <X size={12} />
              </button>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SteeringQuestions

import React, { useEffect, useState } from 'react'
import { Lightbulb, ChevronDown } from 'lucide-react'
import { SteeringQuestion } from '../hooks/useSteeringQuestions'

interface SteeringQuestionsProps {
  questions: SteeringQuestion[]
  onSelectQuestion: (text: string) => void
  onDismissQuestion: (questionId: string) => void
  isDarkMode?: boolean
  isVisible?: boolean
  isEmptyChat?: boolean
}

export const SteeringQuestions: React.FC<SteeringQuestionsProps> = ({
  questions,
  onSelectQuestion,
  onDismissQuestion,
  isDarkMode = true,
  isVisible = true,
  isEmptyChat = false,
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
    onSelectQuestion(question.text)
  }

  const handleDismissAll = () => {
    // Just hide - no annoying collapsed badge
    setDisplayedQuestions([])
  }

  return (
    <div
      className={`p-3 rounded-xl shadow-lg transition-all duration-300 ${
        isDarkMode
          ? 'bg-neutral-800/95 border border-neutral-700 backdrop-blur-sm'
          : 'bg-white/95 border border-stone-200 backdrop-blur-sm'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className={isDarkMode ? 'text-amber-400' : 'text-amber-600'} />
          <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
            Suggestions
          </span>
        </div>
        <button
          onClick={handleDismissAll}
          className={`p-1 rounded-md transition-colors ${
            isDarkMode ? 'hover:bg-neutral-700 text-neutral-500' : 'hover:bg-stone-100 text-stone-400'
          }`}
          title="Collapse"
        >
          <ChevronDown size={14} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {displayedQuestions.map(question => (
          <button
            key={question.id}
            onClick={() => handleSelect(question)}
            className={`px-2.5 py-1 rounded-md text-xs transition-all duration-200 ${
              animatingOut.has(question.id) ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            } ${
              isDarkMode
                ? 'bg-neutral-700/80 text-neutral-300 hover:bg-neutral-600 hover:text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-800'
            }`}
          >
            {question.text}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SteeringQuestions

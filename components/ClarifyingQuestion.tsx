import React, { useState } from 'react'
import { HelpCircle, Check, X } from 'lucide-react'

export interface QuestionOption {
  id: string
  label: string
  description?: string
}

export interface ClarifyingQuestionData {
  id: string
  question: string
  type: 'single-select' | 'multi-select' | 'text' | 'confirm'
  options?: QuestionOption[]
  placeholder?: string
  required?: boolean
}

interface ClarifyingQuestionProps {
  data: ClarifyingQuestionData
  onSubmit: (questionId: string, response: string | string[]) => void
  onSkip?: (questionId: string) => void
  isDarkMode?: boolean
}

export const ClarifyingQuestion: React.FC<ClarifyingQuestionProps> = ({
  data,
  onSubmit,
  onSkip,
  isDarkMode = true,
}) => {
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set())
  const [textValue, setTextValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOptionToggle = (optionId: string) => {
    if (data.type === 'single-select') {
      setSelectedOptions(new Set([optionId]))
    } else {
      const newSet = new Set(selectedOptions)
      if (newSet.has(optionId)) {
        newSet.delete(optionId)
      } else {
        newSet.add(optionId)
      }
      setSelectedOptions(newSet)
    }
  }

  const handleSubmit = () => {
    setIsSubmitting(true)

    if (data.type === 'text') {
      onSubmit(data.id, textValue)
    } else if (data.type === 'confirm') {
      onSubmit(data.id, 'confirmed')
    } else {
      const selected = Array.from(selectedOptions)
      onSubmit(data.id, data.type === 'single-select' ? selected[0] : selected)
    }
  }

  const handleSkip = () => {
    if (onSkip) {
      onSkip(data.id)
    }
  }

  const canSubmit = () => {
    if (data.type === 'text') {
      return !data.required || textValue.trim().length > 0
    }
    if (data.type === 'confirm') {
      return true
    }
    return !data.required || selectedOptions.size > 0
  }

  return (
    <div
      className={`rounded-xl p-4 my-3 border transition-all duration-200 ${
        isDarkMode
          ? 'bg-amber-900/20 border-amber-700/50'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`p-2 rounded-lg ${
            isDarkMode ? 'bg-amber-800/50' : 'bg-amber-100'
          }`}
        >
          <HelpCircle
            size={18}
            className={isDarkMode ? 'text-amber-400' : 'text-amber-600'}
          />
        </div>
        <div className="flex-1">
          <p
            className={`text-sm font-medium ${
              isDarkMode ? 'text-amber-200' : 'text-amber-900'
            }`}
          >
            {data.question}
          </p>
          {data.type === 'multi-select' && (
            <p
              className={`text-xs mt-1 ${
                isDarkMode ? 'text-amber-400/70' : 'text-amber-700/70'
              }`}
            >
              Select all that apply
            </p>
          )}
        </div>
      </div>

      {/* Options for single/multi select */}
      {(data.type === 'single-select' || data.type === 'multi-select') &&
        data.options && (
          <div className="space-y-2 mb-4">
            {data.options.map(option => (
              <button
                key={option.id}
                onClick={() => handleOptionToggle(option.id)}
                disabled={isSubmitting}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 flex items-center gap-3 ${
                  selectedOptions.has(option.id)
                    ? isDarkMode
                      ? 'bg-amber-700/50 text-amber-100 ring-1 ring-amber-500'
                      : 'bg-amber-200 text-amber-900 ring-1 ring-amber-400'
                    : isDarkMode
                    ? 'bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/50'
                    : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200'
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {/* Checkbox/Radio indicator */}
                <div
                  className={`w-4 h-4 rounded-${
                    data.type === 'single-select' ? 'full' : 'sm'
                  } border-2 flex items-center justify-center transition-colors ${
                    selectedOptions.has(option.id)
                      ? isDarkMode
                        ? 'bg-amber-500 border-amber-500'
                        : 'bg-amber-500 border-amber-500'
                      : isDarkMode
                      ? 'border-neutral-500'
                      : 'border-stone-300'
                  }`}
                >
                  {selectedOptions.has(option.id) && (
                    <Check size={10} className="text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{option.label}</span>
                  {option.description && (
                    <p
                      className={`text-xs mt-0.5 ${
                        isDarkMode ? 'text-neutral-400' : 'text-stone-500'
                      }`}
                    >
                      {option.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

      {/* Text input */}
      {data.type === 'text' && (
        <div className="mb-4">
          <textarea
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            placeholder={data.placeholder || 'Type your answer...'}
            disabled={isSubmitting}
            className={`w-full px-3 py-2 rounded-lg text-sm resize-none transition-colors ${
              isDarkMode
                ? 'bg-neutral-800 text-neutral-200 placeholder-neutral-500 border border-neutral-700 focus:border-amber-500'
                : 'bg-white text-stone-800 placeholder-stone-400 border border-stone-200 focus:border-amber-400'
            } focus:outline-none focus:ring-1 focus:ring-amber-500/50 ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            rows={3}
          />
        </div>
      )}

      {/* Confirm type */}
      {data.type === 'confirm' && (
        <div className="mb-4">
          <p
            className={`text-sm ${
              isDarkMode ? 'text-neutral-400' : 'text-stone-600'
            }`}
          >
            Click confirm to proceed, or skip to provide more context.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {onSkip && !data.required && (
          <button
            onClick={handleSkip}
            disabled={isSubmitting}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isDarkMode
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Skip
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit() || isSubmitting}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            canSubmit() && !isSubmitting
              ? isDarkMode
                ? 'bg-amber-600 text-white hover:bg-amber-500'
                : 'bg-amber-500 text-white hover:bg-amber-600'
              : isDarkMode
              ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Check size={14} />
              {data.type === 'confirm' ? 'Confirm' : 'Submit'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default ClarifyingQuestion

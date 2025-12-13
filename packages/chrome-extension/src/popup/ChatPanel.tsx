/**
 * Chat Panel Component
 *
 * Compact chat interface at the bottom of the popup.
 * Allows users to send messages to the AI.
 */

import { useState, useCallback } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSend = useCallback(() => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsExpanded(true)

    // TODO: Send to AI (via Cluso or direct API)
    // For now, just echo back
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I received: "${userMessage.content}". Voice and AI responses coming soon!`,
      }
      setMessages((prev) => [...prev, assistantMessage])
    }, 500)
  }, [input])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="border-t border-white/10 bg-black/30">
      {/* Messages area (expandable) */}
      {isExpanded && messages.length > 0 && (
        <div className="max-h-48 overflow-auto px-3 py-2 space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`text-xs p-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-500/20 text-blue-100 ml-8'
                  : 'bg-white/5 text-white/80 mr-8'
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-1.5 rounded-lg transition-colors ${
            isExpanded
              ? 'bg-white/10 text-white/80'
              : 'text-white/40 hover:text-white/60 hover:bg-white/5'
          }`}
          title={isExpanded ? 'Collapse chat' : 'Expand chat'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this element..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
        />

        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="p-2 rounded-lg bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

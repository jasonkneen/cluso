/**
 * useClusoAgent - React hook for Cluso Agent integration
 *
 * Connects the local LLM agent to the UI control system.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { ClusoAgent, createClusoAgent, ClusoAgentCallbacks } from '../services/clusoAgent'
import { useAppControl } from './useAppControl'

export interface UseClusoAgentResult {
  isReady: boolean
  isProcessing: boolean
  lastResponse: string
  error: string | null
  chat: (message: string) => Promise<string>
  reset: () => void
  runDemo: (demoName: string) => Promise<void>
}

// Pre-defined demos
const DEMOS = {
  'inspector': 'Show me how to use the element inspector to select an element on the page.',
  'voice': 'Demonstrate how to start voice chat with the AI.',
  'full-tour': 'Give me a full tour of all the main features of Cluso.',
  'edit-workflow': 'Show me the workflow for making a UI change to a webpage.'
}

export function useClusoAgent(): UseClusoAgentResult {
  const [isReady, setIsReady] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastResponse, setLastResponse] = useState('')
  const [error, setError] = useState<string | null>(null)

  const agentRef = useRef<ClusoAgent | null>(null)
  const appControl = useAppControl()

  // Initialize agent with callbacks
  useEffect(() => {
    const callbacks: ClusoAgentCallbacks = {
      onHighlight: (element, options) => {
        console.log('[ClusoAgent] Highlight:', element, options)
        appControl.highlightElement(element, options)
      },
      onClick: (element) => {
        console.log('[ClusoAgent] Click:', element)
        appControl.clickElement(element)
      },
      onTooltip: (element, message, position) => {
        console.log('[ClusoAgent] Tooltip:', element, message)
        appControl.showTooltip(element, {
          message,
          position: position as 'top' | 'bottom' | 'left' | 'right'
        })
      },
      onType: async (element, text) => {
        console.log('[ClusoAgent] Type:', element, text)
        await appControl.typeText(element, text)
      },
      onSpeak: (message) => {
        console.log('[ClusoAgent] Speak:', message)
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(message)
          utterance.rate = 1.1
          speechSynthesis.speak(utterance)
        }
      },
      onWait: (duration) => {
        console.log('[ClusoAgent] Wait:', duration)
        return appControl.wait(duration)
      }
    }

    agentRef.current = createClusoAgent(callbacks)
    setIsReady(true)

    return () => {
      agentRef.current = null
    }
  }, [appControl])

  const chat = useCallback(async (message: string): Promise<string> => {
    if (!agentRef.current) {
      setError('Agent not initialized')
      return 'Error: Agent not initialized'
    }

    setIsProcessing(true)
    setError(null)

    try {
      const response = await agentRef.current.chat(message)
      setLastResponse(response)
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return `Error: ${errorMessage}`
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const reset = useCallback(() => {
    if (agentRef.current) {
      agentRef.current.reset()
      setLastResponse('')
      setError(null)
    }
  }, [])

  const runDemo = useCallback(async (demoName: string) => {
    const prompt = DEMOS[demoName as keyof typeof DEMOS]
    if (!prompt) {
      setError(`Unknown demo: ${demoName}`)
      return
    }
    await chat(prompt)
  }, [chat])

  return {
    isReady,
    isProcessing,
    lastResponse,
    error,
    chat,
    reset,
    runDemo
  }
}

// Export demo names for UI
export const AVAILABLE_DEMOS = Object.keys(DEMOS)

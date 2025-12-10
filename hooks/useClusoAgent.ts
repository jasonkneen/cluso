/**
 * useClusoAgent - React hook for Cluso Agent integration
 *
 * Connects the local LLM agent to the UI control system.
 * Uses Gemini's native voice for TTS instead of browser speechSynthesis.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { ClusoAgent, createClusoAgent, ClusoAgentCallbacks } from '../services/clusoAgent'
import { useAppControl } from './useAppControl'
import { initGeminiTTS, speakWithGemini } from '../services/geminiTTS'
import { runDemo as runDemoScript, DemoScriptName, DEMO_SCRIPTS } from '../services/demoScript'

export interface UseClusoAgentResult {
  isReady: boolean
  isProcessing: boolean
  lastResponse: string
  error: string | null
  chat: (message: string) => Promise<string>
  reset: () => void
  runDemo: (demoName: string) => Promise<void>
  runScriptedDemo: (scriptName: DemoScriptName) => Promise<void>
  availableScripts: readonly DemoScriptName[]
}

// Pre-defined demos
const DEMOS = {
  'inspector': 'Show me how to use the element inspector to select an element on the page.',
  'voice': 'Demonstrate how to start voice chat with the AI.',
  'full-tour': 'Give me a full tour of all the main features of Cluso.',
  'edit-workflow': 'Show me the workflow for making a UI change to a webpage.'
}

export interface UseClusoAgentParams {
  googleApiKey?: string
}

export function useClusoAgent(params: UseClusoAgentParams = {}): UseClusoAgentResult {
  const { googleApiKey } = params
  const [isReady, setIsReady] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastResponse, setLastResponse] = useState('')
  const [error, setError] = useState<string | null>(null)

  const agentRef = useRef<ClusoAgent | null>(null)
  const appControl = useAppControl()

  // Initialize agent with callbacks
  useEffect(() => {
    // Initialize Gemini TTS with API key from props or environment (silent, only once)
    const apiKey = googleApiKey || (import.meta as any).env?.VITE_GOOGLE_API_KEY || (window as any).process?.env?.API_KEY
    if (apiKey) {
      initGeminiTTS(apiKey)
    }

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
        console.log('[ClusoAgent] Speak (Gemini voice):', message)
        // Use Gemini's native voice instead of browser TTS
        speakWithGemini(message)
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
  }, [appControl, googleApiKey])

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

  // Run a scripted two-voice demo
  const runScriptedDemo = useCallback(async (scriptName: DemoScriptName) => {
    setIsProcessing(true)
    setError(null)
    setLastResponse(`Running ${scriptName} demo...`)

    try {
      await runDemoScript(scriptName, {
        highlightElement: appControl.highlightElement,
        clickElement: appControl.clickElement,
        typeText: appControl.typeText,
        wait: appControl.wait,
      })
      setLastResponse(`${scriptName} demo complete!`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Demo failed'
      setError(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }, [appControl])

  return {
    isReady,
    isProcessing,
    lastResponse,
    error,
    chat,
    reset,
    runDemo,
    runScriptedDemo,
    availableScripts: DEMO_SCRIPTS,
  }
}

// Export demo names for UI
export const AVAILABLE_DEMOS = Object.keys(DEMOS)
export { DEMO_SCRIPTS } from '../services/demoScript'
export type { DemoScriptName } from '../services/demoScript'

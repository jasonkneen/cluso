/**
 * useAppControl - AI Control Layer for Cluso's Own UI
 *
 * This hook provides tools for an AI to control, highlight, and interact
 * with Cluso's interface elements - like a player piano for the app.
 */

import { useCallback, useRef, useState } from 'react'

// Element registry - maps semantic names to actual selectors
const ELEMENT_REGISTRY: Record<string, { selector: string; description: string; action?: string }> = {
  // Main controls (ControlTray)
  'connect-button': {
    selector: '[data-control-id="connect-button"]',
    description: 'Start voice streaming with AI',
    action: 'click'
  },
  'disconnect-button': {
    selector: '[data-control-id="disconnect-button"]',
    description: 'Stop voice streaming',
    action: 'click'
  },
  'video-button': {
    selector: '[data-control-id="video-button"]',
    description: 'Toggle video/camera feed',
    action: 'click'
  },
  'screen-button': {
    selector: '[data-control-id="screen-button"]',
    description: 'Toggle screen sharing',
    action: 'click'
  },

  // Inspector tools (App toolbar)
  'inspector-button': {
    selector: '[data-control-id="inspector-button"]',
    description: 'Toggle element inspector mode - select elements on page',
    action: 'click'
  },
  'move-button': {
    selector: '[data-control-id="move-button"]',
    description: 'Toggle move/resize mode for elements',
    action: 'click'
  },
  'devtools-button': {
    selector: '[data-control-id="devtools-button"]',
    description: 'Open browser DevTools for the webview',
    action: 'click'
  },
  'agent-button': {
    selector: '[data-control-id="agent-button"]',
    description: 'Toggle the Cluso Agent demo panel',
    action: 'click'
  },
  'voice-button': {
    selector: '[data-control-id="voice-button"]',
    description: 'Start/stop voice session with Gemini - small mic icon in chat area',
    action: 'click'
  },

  // Chat area
  'chat-input': {
    selector: '[data-control-id="chat-input"]',
    description: 'Main chat input field - type messages here',
    action: 'focus'
  },
  'send-button': {
    selector: '[data-control-id="send-button"]',
    description: 'Send chat message to AI',
    action: 'click'
  },

  // URL bar
  'url-bar': {
    selector: '[data-control-id="url-bar"]',
    description: 'URL input for navigation',
    action: 'focus'
  },
  'go-button': {
    selector: '[data-action="navigate"]',
    description: 'Navigate to URL',
    action: 'click'
  },

  // Approval UI
  'approve-button': {
    selector: '[data-action="approve"]',
    description: 'Approve pending change',
    action: 'click'
  },
  'reject-button': {
    selector: '[data-action="reject"]',
    description: 'Reject pending change',
    action: 'click'
  },
}

// App capabilities knowledge base
export const APP_KNOWLEDGE = `
# Cluso - AI-Powered Development Assistant

## Core Capabilities

### Voice Control (Connect Button)
- Real-time voice interaction with AI
- Speak naturally to request UI changes
- AI responds with voice and actions
- Press connect button to start/stop

### Element Inspector (Inspector Button)
- Click inspector button to enter selection mode
- Hover over any element on the page
- Click to select an element
- Selected element info sent to AI for context
- AI can make changes to selected elements

### Screenshot Tool (Screenshot Button)
- Click screenshot button to enter capture mode
- Draw rectangle to capture area
- Screenshot sent to AI for analysis
- AI can describe or edit what it sees

### Live Preview (Browser Tab)
- View your app/website in real-time
- Enter URL in the URL bar
- Changes reflect instantly
- Inspector works on this view

### Code Editing
- AI can edit source files directly
- Changes go through approval workflow
- Approve or reject each change
- Undo capability available

### Model Selection
- Choose between different AI models
- Gemini models for voice/live
- Claude/GPT for text chat
- Each has different strengths

## Workflows

### Making a UI Change via Voice:
1. Click Connect to start voice
2. Click Inspector to select element
3. Click element you want to change
4. Speak your change request
5. AI makes instant preview
6. Approve or reject the change

### Making a UI Change via Chat:
1. Click Inspector to select element
2. Click element you want to change
3. Type your request in chat
4. AI makes instant preview
5. Approve or reject the change

### Demo Mode:
- AI can control the entire interface
- Highlight buttons before clicking
- Show tooltips explaining actions
- Perform guided walkthroughs
`

export interface HighlightOptions {
  color?: string
  duration?: number
  pulse?: boolean
  label?: string
}

export interface TooltipOptions {
  message: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  duration?: number
}

export interface AppControlState {
  highlightedElements: string[]
  activeTooltip: { element: string; message: string } | null
  isDemoMode: boolean
  demoStep: number
}

export function useAppControl() {
  const [state, setState] = useState<AppControlState>({
    highlightedElements: [],
    activeTooltip: null,
    isDemoMode: false,
    demoStep: 0,
  })

  const highlightTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const tooltipTimeout = useRef<NodeJS.Timeout | null>(null)

  // Get element by semantic name or direct selector
  const getElement = useCallback((nameOrSelector: string): HTMLElement | null => {
    const registered = ELEMENT_REGISTRY[nameOrSelector]
    const selector = registered?.selector || nameOrSelector
    return document.querySelector(selector) as HTMLElement | null
  }, [])

  // Convert named colors to hex for proper alpha channel support
  const colorToHex = (color: string): string => {
    const namedColors: Record<string, string> = {
      blue: '#3b82f6',
      green: '#22c55e',
      red: '#ef4444',
      orange: '#f97316',
      purple: '#a855f7',
      yellow: '#eab308',
      pink: '#ec4899',
      cyan: '#06b6d4',
    }
    return namedColors[color.toLowerCase()] || (color.startsWith('#') ? color : '#3b82f6')
  }

  // Highlight an element with visual feedback
  const highlightElement = useCallback((nameOrSelector: string, options: HighlightOptions = {}) => {
    const { color: rawColor = '#3b82f6', duration = 3000, pulse = true, label } = options
    const color = colorToHex(rawColor)
    const element = getElement(nameOrSelector)

    if (!element) {
      console.warn(`[AppControl] Element not found: ${nameOrSelector}`)
      return false
    }

    // Store original styles
    const originalOutline = element.style.outline
    const originalBoxShadow = element.style.boxShadow
    const originalPosition = element.style.position
    const originalZIndex = element.style.zIndex

    // Apply highlight styles
    element.style.outline = `3px solid ${color}`
    element.style.boxShadow = pulse
      ? `0 0 0 0 ${color}40, 0 0 20px ${color}60`
      : `0 0 20px ${color}60`
    element.style.position = 'relative'
    element.style.zIndex = '10000'

    // Add pulse animation if requested
    if (pulse) {
      element.animate([
        { boxShadow: `0 0 0 0 ${color}40, 0 0 20px ${color}60` },
        { boxShadow: `0 0 0 15px ${color}00, 0 0 20px ${color}60` },
      ], {
        duration: 1000,
        iterations: Math.ceil(duration / 1000),
      })
    }

    // Add label if provided
    let labelElement: HTMLElement | null = null
    if (label) {
      labelElement = document.createElement('div')
      labelElement.textContent = label
      labelElement.style.cssText = `
        position: absolute;
        top: -30px;
        left: 50%;
        transform: translateX(-50%);
        background: ${color};
        color: white;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        z-index: 10001;
        pointer-events: none;
      `
      element.appendChild(labelElement)
    }

    // Track highlighted state
    setState(prev => ({
      ...prev,
      highlightedElements: [...prev.highlightedElements, nameOrSelector]
    }))

    // Clear any existing timeout for this element
    const existingTimeout = highlightTimeouts.current.get(nameOrSelector)
    if (existingTimeout) clearTimeout(existingTimeout)

    // Set timeout to remove highlight
    const timeout = setTimeout(() => {
      element.style.outline = originalOutline
      element.style.boxShadow = originalBoxShadow
      element.style.position = originalPosition
      element.style.zIndex = originalZIndex
      if (labelElement) labelElement.remove()

      setState(prev => ({
        ...prev,
        highlightedElements: prev.highlightedElements.filter(e => e !== nameOrSelector)
      }))
      highlightTimeouts.current.delete(nameOrSelector)
    }, duration)

    highlightTimeouts.current.set(nameOrSelector, timeout)
    return true
  }, [getElement])

  // Show tooltip near an element
  const showTooltip = useCallback((nameOrSelector: string, options: TooltipOptions) => {
    const { message, position = 'top', duration = 4000 } = options
    const element = getElement(nameOrSelector)

    if (!element) {
      console.warn(`[AppControl] Element not found for tooltip: ${nameOrSelector}`)
      return false
    }

    // Remove existing tooltip
    const existingTooltip = document.getElementById('app-control-tooltip')
    if (existingTooltip) existingTooltip.remove()
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current)

    // Create tooltip element
    const tooltip = document.createElement('div')
    tooltip.id = 'app-control-tooltip'
    tooltip.textContent = message

    const rect = element.getBoundingClientRect()
    let top = 0, left = 0

    switch (position) {
      case 'top':
        top = rect.top - 40
        left = rect.left + rect.width / 2
        break
      case 'bottom':
        top = rect.bottom + 10
        left = rect.left + rect.width / 2
        break
      case 'left':
        top = rect.top + rect.height / 2
        left = rect.left - 10
        break
      case 'right':
        top = rect.top + rect.height / 2
        left = rect.right + 10
        break
    }

    tooltip.style.cssText = `
      position: fixed;
      top: ${top}px;
      left: ${left}px;
      transform: ${position === 'top' || position === 'bottom' ? 'translateX(-50%)' : 'translateY(-50%)'};
      background: #1f2937;
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      max-width: 300px;
      z-index: 100002;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      animation: fadeIn 0.2s ease-out;
      pointer-events: none;
    `

    document.body.appendChild(tooltip)

    setState(prev => ({
      ...prev,
      activeTooltip: { element: nameOrSelector, message }
    }))

    tooltipTimeout.current = setTimeout(() => {
      tooltip.remove()
      setState(prev => ({ ...prev, activeTooltip: null }))
    }, duration)

    return true
  }, [getElement])

  // Click an element
  const clickElement = useCallback((nameOrSelector: string) => {
    const element = getElement(nameOrSelector)

    if (!element) {
      console.warn(`[AppControl] Element not found for click: ${nameOrSelector}`)
      return false
    }

    element.click()
    return true
  }, [getElement])

  // Focus an element
  const focusElement = useCallback((nameOrSelector: string) => {
    const element = getElement(nameOrSelector)

    if (!element) {
      console.warn(`[AppControl] Element not found for focus: ${nameOrSelector}`)
      return false
    }

    element.focus()
    return true
  }, [getElement])

  // Type text into an element
  const typeText = useCallback((nameOrSelector: string, text: string, delay = 50) => {
    const element = getElement(nameOrSelector) as HTMLInputElement | HTMLTextAreaElement

    if (!element) {
      console.warn(`[AppControl] Element not found for typing: ${nameOrSelector}`)
      return Promise.resolve(false)
    }

    element.focus()

    return new Promise<boolean>((resolve) => {
      let index = 0
      const interval = setInterval(() => {
        if (index < text.length) {
          element.value += text[index]
          element.dispatchEvent(new Event('input', { bubbles: true }))
          index++
        } else {
          clearInterval(interval)
          resolve(true)
        }
      }, delay)
    })
  }, [getElement])

  // Wait for a duration
  const wait = useCallback((ms: number) => {
    return new Promise<void>(resolve => setTimeout(resolve, ms))
  }, [])

  // Execute a sequence of actions (for demos)
  const executeSequence = useCallback(async (actions: Array<{
    type: 'highlight' | 'tooltip' | 'click' | 'focus' | 'type' | 'wait' | 'speak'
    target?: string
    options?: any
    text?: string
    duration?: number
  }>) => {
    setState(prev => ({ ...prev, isDemoMode: true, demoStep: 0 }))

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      setState(prev => ({ ...prev, demoStep: i + 1 }))

      switch (action.type) {
        case 'highlight':
          if (action.target) highlightElement(action.target, action.options)
          break
        case 'tooltip':
          if (action.target) showTooltip(action.target, { message: action.text || '', ...action.options })
          break
        case 'click':
          if (action.target) clickElement(action.target)
          break
        case 'focus':
          if (action.target) focusElement(action.target)
          break
        case 'type':
          if (action.target && action.text) await typeText(action.target, action.text)
          break
        case 'wait':
          await wait(action.duration || 1000)
          break
        case 'speak':
          // Use Gemini TTS instead of browser speechSynthesis
          if (action.text) {
            try {
              const { speakWithGemini } = await import('../services/geminiTTS')
              await speakWithGemini(action.text)
            } catch (err) {
              console.error('[AppControl] Gemini TTS failed:', err)
              // Fallback to browser TTS if Gemini fails
              if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(action.text)
                await new Promise<void>(resolve => {
                  utterance.onend = () => resolve()
                  speechSynthesis.speak(utterance)
                })
              }
            }
          }
          break
      }

      // Small delay between actions for visibility
      if (action.type !== 'wait') {
        await wait(300)
      }
    }

    setState(prev => ({ ...prev, isDemoMode: false, demoStep: 0 }))
  }, [highlightElement, showTooltip, clickElement, focusElement, typeText, wait])

  // Get all available elements and their descriptions
  const getAvailableElements = useCallback(() => {
    return Object.entries(ELEMENT_REGISTRY).map(([name, info]) => ({
      name,
      ...info,
      exists: !!getElement(name)
    }))
  }, [getElement])

  // Tool definitions for AI model
  const tools = {
    highlight_element: {
      name: 'highlight_element',
      description: 'Highlight a UI element in Cluso to draw attention to it',
      parameters: {
        type: 'object',
        properties: {
          element: { type: 'string', description: 'Element name or selector to highlight' },
          color: { type: 'string', description: 'Highlight color (default: blue)' },
          duration: { type: 'number', description: 'Duration in ms (default: 3000)' },
          label: { type: 'string', description: 'Optional label to show above element' },
        },
        required: ['element']
      },
      execute: (args: { element: string; color?: string; duration?: number; label?: string }) => {
        return highlightElement(args.element, {
          color: args.color,
          duration: args.duration,
          label: args.label,
          pulse: true
        })
      }
    },
    show_tooltip: {
      name: 'show_tooltip',
      description: 'Show a tooltip message near a UI element',
      parameters: {
        type: 'object',
        properties: {
          element: { type: 'string', description: 'Element name or selector' },
          message: { type: 'string', description: 'Tooltip message to display' },
          position: { type: 'string', enum: ['top', 'bottom', 'left', 'right'] },
        },
        required: ['element', 'message']
      },
      execute: (args: { element: string; message: string; position?: 'top' | 'bottom' | 'left' | 'right' }) => {
        return showTooltip(args.element, { message: args.message, position: args.position })
      }
    },
    click_ui_element: {
      name: 'click_ui_element',
      description: 'Click a button or interactive element in Cluso',
      parameters: {
        type: 'object',
        properties: {
          element: { type: 'string', description: 'Element name or selector to click' },
        },
        required: ['element']
      },
      execute: (args: { element: string }) => {
        return clickElement(args.element)
      }
    },
    type_in_field: {
      name: 'type_in_field',
      description: 'Type text into an input field with typewriter effect',
      parameters: {
        type: 'object',
        properties: {
          element: { type: 'string', description: 'Input element name or selector' },
          text: { type: 'string', description: 'Text to type' },
        },
        required: ['element', 'text']
      },
      execute: async (args: { element: string; text: string }) => {
        return await typeText(args.element, args.text)
      }
    },
    speak: {
      name: 'speak',
      description: 'Speak a message using Gemini TTS (AI voice)',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to speak' },
        },
        required: ['message']
      },
      execute: async (args: { message: string }) => {
        try {
          const { speakWithGemini } = await import('../services/geminiTTS')
          await speakWithGemini(args.message)
          return true
        } catch (err) {
          console.error('[AppControl] speak tool - Gemini TTS failed:', err)
          // Fallback to browser TTS
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(args.message)
            speechSynthesis.speak(utterance)
            return true
          }
          return false
        }
      }
    },
    get_ui_elements: {
      name: 'get_ui_elements',
      description: 'Get list of all controllable UI elements in Cluso',
      parameters: { type: 'object', properties: {} },
      execute: () => {
        return getAvailableElements()
      }
    },
    run_demo_sequence: {
      name: 'run_demo_sequence',
      description: 'Run a sequence of UI actions for a demo',
      parameters: {
        type: 'object',
        properties: {
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['highlight', 'tooltip', 'click', 'focus', 'type', 'wait', 'speak'] },
                target: { type: 'string' },
                text: { type: 'string' },
                duration: { type: 'number' },
              }
            }
          }
        },
        required: ['actions']
      },
      execute: async (args: { actions: any[] }) => {
        await executeSequence(args.actions)
        return true
      }
    }
  }

  return {
    state,
    highlightElement,
    showTooltip,
    clickElement,
    focusElement,
    typeText,
    wait,
    executeSequence,
    getAvailableElements,
    tools,
    knowledge: APP_KNOWLEDGE,
    elementRegistry: ELEMENT_REGISTRY,
  }
}

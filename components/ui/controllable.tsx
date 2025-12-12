/**
 * Controllable UI Primitives
 *
 * Wrapper components that register with the Cluso Agent system,
 * allowing AI to control buttons, inputs, checkboxes, etc.
 *
 * Usage:
 *   <ControllableButton id="connect" label="Connect Button">
 *     Connect
 *   </ControllableButton>
 *
 * The AI can then:
 *   - highlight_element("connect")
 *   - click_element("connect")
 *   - get_element_state("connect")
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useState,
  ReactNode,
  HTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
} from 'react'

// ============================================================================
// Control Registry Context
// ============================================================================

export interface ControllableElement {
  id: string
  ref: React.RefObject<HTMLElement>
  type: 'button' | 'input' | 'checkbox' | 'select' | 'toggle' | 'tab' | 'generic'
  label: string
  description?: string
  group?: string
  state?: Record<string, unknown>
  actions?: string[]
}

interface ControlRegistryContextType {
  elements: Map<string, ControllableElement>
  register: (element: ControllableElement) => void
  unregister: (id: string) => void
  getElement: (id: string) => ControllableElement | undefined
  getAllElements: () => ControllableElement[]
  highlight: (id: string, options?: HighlightOptions) => void
  clearHighlight: (id: string) => void
  clearAllHighlights: () => void
  triggerAction: (id: string, action?: string) => boolean
  setElementState: (id: string, state: Record<string, unknown>) => void
}

interface HighlightOptions {
  color?: string
  duration?: number
  pulse?: boolean
  label?: string
  glow?: boolean
}

const ControlRegistryContext = createContext<ControlRegistryContextType | null>(null)

// ============================================================================
// Control Registry Provider
// ============================================================================

export function ControlRegistryProvider({ children }: { children: ReactNode }) {
  const elementsRef = useRef<Map<string, ControllableElement>>(new Map())
  const highlightTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const [, forceUpdate] = useState({})

  const register = useCallback((element: ControllableElement) => {
    elementsRef.current.set(element.id, element)
    forceUpdate({})
  }, [])

  const unregister = useCallback((id: string) => {
    elementsRef.current.delete(id)
    forceUpdate({})
  }, [])

  const getElement = useCallback((id: string) => {
    return elementsRef.current.get(id)
  }, [])

  const getAllElements = useCallback(() => {
    return Array.from(elementsRef.current.values())
  }, [])

  const highlight = useCallback((id: string, options: HighlightOptions = {}) => {
    const element = elementsRef.current.get(id)
    if (!element?.ref.current) return

    const el = element.ref.current
    const { color = '#3b82f6', duration = 3000, pulse = true, label, glow = true } = options

    // Store original styles
    const original = {
      outline: el.style.outline,
      boxShadow: el.style.boxShadow,
      position: el.style.position,
      zIndex: el.style.zIndex,
      transform: el.style.transform,
    }

    // Apply highlight
    el.style.outline = `2px solid ${color}`
    el.style.boxShadow = glow ? `0 0 20px ${color}80, 0 0 40px ${color}40` : 'none'
    el.style.position = 'relative'
    el.style.zIndex = '10000'

    // Pulse animation
    if (pulse) {
      el.animate([
        { transform: 'scale(1)', boxShadow: `0 0 20px ${color}80` },
        { transform: 'scale(1.02)', boxShadow: `0 0 30px ${color}` },
        { transform: 'scale(1)', boxShadow: `0 0 20px ${color}80` },
      ], {
        duration: 600,
        iterations: Math.ceil(duration / 600),
        easing: 'ease-in-out',
      })
    }

    // Add label overlay
    let labelEl: HTMLElement | null = null
    if (label) {
      labelEl = document.createElement('div')
      labelEl.className = 'cluso-control-label'
      labelEl.textContent = label
      labelEl.style.cssText = `
        position: absolute;
        top: -28px;
        left: 50%;
        transform: translateX(-50%);
        background: ${color};
        color: white;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        z-index: 10001;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `
      el.style.position = 'relative'
      el.appendChild(labelEl)
    }

    // Clear existing timeout
    const existing = highlightTimeouts.current.get(id)
    if (existing) clearTimeout(existing)

    // Set removal timeout
    const timeout = setTimeout(() => {
      el.style.outline = original.outline
      el.style.boxShadow = original.boxShadow
      el.style.position = original.position
      el.style.zIndex = original.zIndex
      el.style.transform = original.transform
      if (labelEl) labelEl.remove()
      highlightTimeouts.current.delete(id)
    }, duration)

    highlightTimeouts.current.set(id, timeout)
  }, [])

  const clearHighlight = useCallback((id: string) => {
    const timeout = highlightTimeouts.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      highlightTimeouts.current.delete(id)
    }

    const element = elementsRef.current.get(id)
    if (element?.ref.current) {
      const el = element.ref.current
      el.style.outline = ''
      el.style.boxShadow = ''
      el.style.zIndex = ''
      const label = el.querySelector('.cluso-control-label')
      if (label) label.remove()
    }
  }, [])

  const clearAllHighlights = useCallback(() => {
    highlightTimeouts.current.forEach((timeout, id) => {
      clearTimeout(timeout)
      clearHighlight(id)
    })
    highlightTimeouts.current.clear()
  }, [clearHighlight])

  const triggerAction = useCallback((id: string, action?: string) => {
    const element = elementsRef.current.get(id)
    if (!element?.ref.current) return false

    const el = element.ref.current
    const targetAction = action || element.actions?.[0] || 'click'

    switch (targetAction) {
      case 'click':
        el.click()
        break
      case 'focus':
        el.focus()
        break
      case 'blur':
        el.blur()
        break
      default:
        // Custom action - dispatch event
        el.dispatchEvent(new CustomEvent(`cluso:${targetAction}`, { bubbles: true }))
    }

    return true
  }, [])

  const setElementState = useCallback((id: string, state: Record<string, unknown>) => {
    const element = elementsRef.current.get(id)
    if (element) {
      element.state = { ...element.state, ...state }
      forceUpdate({})
    }
  }, [])

  return (
    <ControlRegistryContext.Provider value={{
      elements: elementsRef.current,
      register,
      unregister,
      getElement,
      getAllElements,
      highlight,
      clearHighlight,
      clearAllHighlights,
      triggerAction,
      setElementState,
    }}>
      {children}
    </ControlRegistryContext.Provider>
  )
}

export function useControlRegistry() {
  const context = useContext(ControlRegistryContext)
  if (!context) {
    throw new Error('useControlRegistry must be used within ControlRegistryProvider')
  }
  return context
}

// ============================================================================
// Controllable Button
// ============================================================================

interface ControllableButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  controlId: string
  controlLabel: string
  controlDescription?: string
  controlGroup?: string
}

export const ControllableButton = forwardRef<HTMLButtonElement, ControllableButtonProps>(
  ({ controlId, controlLabel, controlDescription, controlGroup, children, ...props }, forwardedRef) => {
    const internalRef = useRef<HTMLButtonElement>(null)
    const ref = (forwardedRef as React.RefObject<HTMLButtonElement>) || internalRef
    const registry = useContext(ControlRegistryContext)

    useEffect(() => {
      if (registry && ref.current) {
        registry.register({
          id: controlId,
          ref: ref as React.RefObject<HTMLElement>,
          type: 'button',
          label: controlLabel,
          description: controlDescription,
          group: controlGroup,
          actions: ['click', 'focus'],
        })

        return () => registry.unregister(controlId)
      }
    }, [registry, controlId, controlLabel, controlDescription, controlGroup, ref])

    return (
      <button
        ref={ref}
        data-control-id={controlId}
        data-control-type="button"
        {...props}
      >
        {children}
      </button>
    )
  }
)
ControllableButton.displayName = 'ControllableButton'

// ============================================================================
// Controllable Input
// ============================================================================

interface ControllableInputProps extends InputHTMLAttributes<HTMLInputElement> {
  controlId: string
  controlLabel: string
  controlDescription?: string
  controlGroup?: string
}

export const ControllableInput = forwardRef<HTMLInputElement, ControllableInputProps>(
  ({ controlId, controlLabel, controlDescription, controlGroup, ...props }, forwardedRef) => {
    const internalRef = useRef<HTMLInputElement>(null)
    const ref = (forwardedRef as React.RefObject<HTMLInputElement>) || internalRef
    const registry = useContext(ControlRegistryContext)

    useEffect(() => {
      if (registry && ref.current) {
        registry.register({
          id: controlId,
          ref: ref as React.RefObject<HTMLElement>,
          type: 'input',
          label: controlLabel,
          description: controlDescription,
          group: controlGroup,
          actions: ['focus', 'clear', 'type'],
          state: { value: ref.current.value },
        })

        return () => registry.unregister(controlId)
      }
    }, [registry, controlId, controlLabel, controlDescription, controlGroup, ref])

    return (
      <input
        ref={ref}
        data-control-id={controlId}
        data-control-type="input"
        {...props}
      />
    )
  }
)
ControllableInput.displayName = 'ControllableInput'

// ============================================================================
// Controllable Checkbox / Toggle
// ============================================================================

interface ControllableCheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  controlId: string
  controlLabel: string
  controlDescription?: string
  controlGroup?: string
}

export const ControllableCheckbox = forwardRef<HTMLInputElement, ControllableCheckboxProps>(
  ({ controlId, controlLabel, controlDescription, controlGroup, ...props }, forwardedRef) => {
    const internalRef = useRef<HTMLInputElement>(null)
    const ref = (forwardedRef as React.RefObject<HTMLInputElement>) || internalRef
    const registry = useContext(ControlRegistryContext)

    useEffect(() => {
      if (registry && ref.current) {
        registry.register({
          id: controlId,
          ref: ref as React.RefObject<HTMLElement>,
          type: 'checkbox',
          label: controlLabel,
          description: controlDescription,
          group: controlGroup,
          actions: ['toggle', 'check', 'uncheck'],
          state: { checked: ref.current.checked },
        })

        return () => registry.unregister(controlId)
      }
    }, [registry, controlId, controlLabel, controlDescription, controlGroup, ref])

    return (
      <input
        ref={ref}
        type="checkbox"
        data-control-id={controlId}
        data-control-type="checkbox"
        {...props}
      />
    )
  }
)
ControllableCheckbox.displayName = 'ControllableCheckbox'

// ============================================================================
// Controllable Generic Wrapper
// ============================================================================

interface ControllableProps extends HTMLAttributes<HTMLDivElement> {
  controlId: string
  controlLabel: string
  controlDescription?: string
  controlGroup?: string
  controlType?: ControllableElement['type']
  controlActions?: string[]
  as?: keyof JSX.IntrinsicElements
}

export const Controllable = forwardRef<HTMLElement, ControllableProps>(
  ({
    controlId,
    controlLabel,
    controlDescription,
    controlGroup,
    controlType = 'generic',
    controlActions = ['click', 'focus'],
    as: Component = 'div',
    children,
    ...props
  }, forwardedRef) => {
    const internalRef = useRef<HTMLElement>(null)
    const ref = (forwardedRef as React.RefObject<HTMLElement>) || internalRef
    const registry = useContext(ControlRegistryContext)

    useEffect(() => {
      if (registry && ref.current) {
        registry.register({
          id: controlId,
          ref,
          type: controlType,
          label: controlLabel,
          description: controlDescription,
          group: controlGroup,
          actions: controlActions,
        })

        return () => registry.unregister(controlId)
      }
    }, [registry, controlId, controlLabel, controlDescription, controlGroup, controlType, controlActions, ref])

    const ElementComponent = Component as any

    return (
      <ElementComponent
        ref={ref}
        data-control-id={controlId}
        data-control-type={controlType}
        {...props}
      >
        {children}
      </ElementComponent>
    )
  }
)
Controllable.displayName = 'Controllable'

// ============================================================================
// AI Tool Definitions
// ============================================================================

export function createControlTools(registry: ControlRegistryContextType) {
  return {
    list_ui_controls: {
      name: 'list_ui_controls',
      description: 'Get all controllable UI elements in Cluso with their IDs, types, and descriptions',
      parameters: {
        type: 'object',
        properties: {
          group: { type: 'string', description: 'Filter by control group (optional)' },
          type: { type: 'string', description: 'Filter by control type (optional)' },
        },
      },
      execute: (args: { group?: string; type?: string }) => {
        let elements = registry.getAllElements()
        if (args.group) {
          elements = elements.filter(e => e.group === args.group)
        }
        if (args.type) {
          elements = elements.filter(e => e.type === args.type)
        }
        return elements.map(e => ({
          id: e.id,
          type: e.type,
          label: e.label,
          description: e.description,
          group: e.group,
          actions: e.actions,
        }))
      }
    },

    highlight_control: {
      name: 'highlight_control',
      description: 'Highlight a UI control to draw user attention',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Control ID to highlight' },
          color: { type: 'string', description: 'Highlight color (default: blue)' },
          duration: { type: 'number', description: 'Duration in ms (default: 3000)' },
          label: { type: 'string', description: 'Label to show above element' },
          pulse: { type: 'boolean', description: 'Pulse animation (default: true)' },
        },
        required: ['id'],
      },
      execute: (args: { id: string; color?: string; duration?: number; label?: string; pulse?: boolean }) => {
        const element = registry.getElement(args.id)
        if (!element) return { success: false, error: `Control '${args.id}' not found` }
        registry.highlight(args.id, args)
        return { success: true, element: element.label }
      }
    },

    click_control: {
      name: 'click_control',
      description: 'Click a UI control (button, checkbox, etc.)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Control ID to click' },
        },
        required: ['id'],
      },
      execute: (args: { id: string }) => {
        const success = registry.triggerAction(args.id, 'click')
        return { success }
      }
    },

    focus_control: {
      name: 'focus_control',
      description: 'Focus a UI control (input, textarea, etc.)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Control ID to focus' },
        },
        required: ['id'],
      },
      execute: (args: { id: string }) => {
        const success = registry.triggerAction(args.id, 'focus')
        return { success }
      }
    },

    type_in_control: {
      name: 'type_in_control',
      description: 'Type text into an input control with typewriter effect',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Input control ID' },
          text: { type: 'string', description: 'Text to type' },
          delay: { type: 'number', description: 'Delay between characters in ms (default: 50)' },
        },
        required: ['id', 'text'],
      },
      execute: async (args: { id: string; text: string; delay?: number }) => {
        const element = registry.getElement(args.id)
        if (!element?.ref.current) return { success: false, error: `Control '${args.id}' not found` }

        const input = element.ref.current as HTMLInputElement
        input.focus()

        const delay = args.delay || 50
        for (const char of args.text) {
          input.value += char
          input.dispatchEvent(new Event('input', { bubbles: true }))
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        return { success: true }
      }
    },

    clear_highlights: {
      name: 'clear_highlights',
      description: 'Clear all active highlights',
      parameters: { type: 'object', properties: {} },
      execute: () => {
        registry.clearAllHighlights()
        return { success: true }
      }
    },

    demo_sequence: {
      name: 'demo_sequence',
      description: 'Execute a sequence of UI actions for demonstration',
      parameters: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['highlight', 'click', 'focus', 'type', 'wait', 'speak'] },
                id: { type: 'string', description: 'Control ID (for highlight, click, focus, type)' },
                text: { type: 'string', description: 'Text (for type or speak)' },
                label: { type: 'string', description: 'Label (for highlight)' },
                duration: { type: 'number', description: 'Duration in ms (for highlight or wait)' },
              },
              required: ['action'],
            },
          },
        },
        required: ['steps'],
      },
      execute: async (args: { steps: Array<{ action: string; id?: string; text?: string; label?: string; duration?: number }> }) => {
        for (const step of args.steps) {
          switch (step.action) {
            case 'highlight':
              if (step.id) registry.highlight(step.id, { label: step.label, duration: step.duration })
              break
            case 'click':
              if (step.id) registry.triggerAction(step.id, 'click')
              break
            case 'focus':
              if (step.id) registry.triggerAction(step.id, 'focus')
              break
            case 'type':
              if (step.id && step.text) {
                const el = registry.getElement(step.id)?.ref.current as HTMLInputElement
                if (el) {
                  el.focus()
                  for (const char of step.text) {
                    el.value += char
                    el.dispatchEvent(new Event('input', { bubbles: true }))
                    await new Promise(r => setTimeout(r, 50))
                  }
                }
              }
              break
            case 'wait':
              await new Promise(r => setTimeout(r, step.duration || 1000))
              break
            case 'speak':
              if (step.text) {
                try {
                  const { speakWithGemini } = await import('../../services/geminiTTS')
                  await speakWithGemini(step.text)
                } catch (err) {
                  console.error('[Controllable] Gemini TTS failed, using browser fallback:', err)
                  // Fallback to browser TTS
                  if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(step.text)
                    await new Promise<void>(r => { utterance.onend = () => r(); speechSynthesis.speak(utterance) })
                  }
                }
              }
              break
          }
          // Small pause between steps
          await new Promise(r => setTimeout(r, 200))
        }
        return { success: true, stepsExecuted: args.steps.length }
      }
    },
  }
}

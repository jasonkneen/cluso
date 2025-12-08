/**
 * Demo Script Service
 *
 * Scripted demos with two Gemini voices (user/app) and UI actions.
 * Can be reset and replayed multiple times.
 */

import { speakAsUser, speakAsApp, DemoLine, runDemoConversation } from './geminiTTS'

// Demo state for rollback
let demoState: {
  createdFiles: string[]
  originalContent: Map<string, string>
} = {
  createdFiles: [],
  originalContent: new Map()
}

// Reset demo state
export function resetDemoState() {
  demoState = {
    createdFiles: [],
    originalContent: new Map()
  }
  console.log('[DemoScript] State reset')
}

// UI Control interface (passed in from app)
export interface DemoUIControls {
  highlightElement: (name: string, options?: { color?: string; label?: string; duration?: number }) => void
  clickElement: (name: string) => void
  typeText: (element: string, text: string) => Promise<void>
  wait: (ms: number) => Promise<void>
}

// Create the "Support Page" demo script
export function createSupportPageDemo(ui: DemoUIControls): DemoLine[] {
  return [
    // User asks for a new page
    {
      role: 'user',
      text: "Hey, I need to add a Support page to the website.",
    },
    // App acknowledges
    {
      role: 'app',
      text: "Sure! I'll create a Support page for you. Let me highlight the tools we'll use.",
      action: async () => {
        ui.highlightElement('inspector-button', { color: 'blue', label: 'Inspector', duration: 2000 })
      }
    },
    // User watches
    {
      role: 'user',
      text: "Great, what do you need from me?",
    },
    // App explains
    {
      role: 'app',
      text: "I'll show you how to navigate to where we need to make changes. First, let me highlight the URL bar.",
      action: async () => {
        ui.highlightElement('url-bar', { color: 'green', label: 'Navigate here', duration: 3000 })
      }
    },
    // User confirms
    {
      role: 'user',
      text: "I see it. What's next?",
    },
    // App creates the page
    {
      role: 'app',
      text: "Now I'll create the Support page component. Watch the chat area where I'll type the request.",
      action: async () => {
        ui.highlightElement('chat-input', { color: 'purple', label: 'Type here', duration: 2000 })
        await ui.wait(1000)
        await ui.typeText('chat-input', 'Create a new Support page with FAQ section')
      }
    },
    // User impressed
    {
      role: 'user',
      text: "Wow, that was easy! Can you show me how it looks?",
    },
    // App responds
    {
      role: 'app',
      text: "The Support page is ready! It includes a header, FAQ accordion, and contact form. You can preview it in the browser.",
    },
    // User thanks
    {
      role: 'user',
      text: "Perfect, thanks for the help!",
    },
    // App signs off
    {
      role: 'app',
      text: "You're welcome! Let me know if you need any other pages or changes.",
    }
  ]
}

// Quick intro demo
export function createIntroDemo(ui: DemoUIControls): DemoLine[] {
  return [
    {
      role: 'app',
      text: "Welcome to Cluso! I'm your AI development assistant. Let me show you around.",
      action: async () => {
        await ui.wait(500)
      }
    },
    {
      role: 'app',
      text: "This is the element inspector. Click it to select any element on the page.",
      action: async () => {
        ui.highlightElement('inspector-button', { color: 'blue', label: 'Inspector', duration: 3000 })
      }
    },
    {
      role: 'app',
      text: "And this is where you can chat with me to make changes to your UI.",
      action: async () => {
        ui.highlightElement('chat-input', { color: 'purple', label: 'Chat with AI', duration: 3000 })
      }
    },
    {
      role: 'user',
      text: "That looks great! How do I start voice chat?",
    },
    {
      role: 'app',
      text: "Just click this microphone button to start a voice session with me.",
      action: async () => {
        ui.highlightElement('voice-button', { color: 'green', label: 'Voice Chat', duration: 3000 })
      }
    },
  ]
}

// Run a demo by name
export async function runDemo(
  demoName: 'support-page' | 'intro' | 'custom',
  ui: DemoUIControls,
  customLines?: DemoLine[]
): Promise<void> {
  let lines: DemoLine[]

  switch (demoName) {
    case 'support-page':
      lines = createSupportPageDemo(ui)
      break
    case 'intro':
      lines = createIntroDemo(ui)
      break
    case 'custom':
      lines = customLines || []
      break
    default:
      console.warn('[DemoScript] Unknown demo:', demoName)
      return
  }

  console.log(`[DemoScript] Running demo: ${demoName}`)
  await runDemoConversation(lines)
  console.log(`[DemoScript] Demo complete: ${demoName}`)
}

// Export demo names
export const DEMO_SCRIPTS = ['support-page', 'intro'] as const
export type DemoScriptName = typeof DEMO_SCRIPTS[number]

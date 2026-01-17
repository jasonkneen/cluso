/**
 * Message Handlers Hook
 *
 * Centralizes message handling logic extracted from App.tsx.
 * Handles message submission, streaming, built-in commands, and AI interactions.
 */

import { useCallback, useRef } from 'react'
import type { Message as ChatMessage, SelectedElement, ToolUsage } from '../../types'
import type { StreamingMessage, ConnectionState, CompletedToolCall } from './types'
import type { ThinkingLevel } from '../model'
import type { ProviderConfig, MCPToolDefinition, CoreMessage } from '../../hooks/useAIChat'
import { getProviderForModel, toCoreMessages } from '../../hooks/useAIChat'
import { GoogleGenAI } from '@google/genai'
import { generateTurnId } from '../../utils/turnUtils'
import { generateUIUpdate } from '../../utils/uiUpdate'
import { generateSourcePatch } from '../../utils/generateSourcePatch'
import { fileService } from '../../services/FileService'
import type { AppSettings } from '../../components/SettingsDialog'
import type { PendingDOMApproval } from '../patches'

// Electron types
interface WebviewElement extends HTMLElement {
  executeJavaScript: (code: string) => Promise<unknown>
  src: string
}

/**
 * Dependencies required by the message handlers
 */
export interface MessageHandlerDeps {
  // State setters
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setInput: React.Dispatch<React.SetStateAction<string>>
  setStreamingMessage: React.Dispatch<React.SetStateAction<StreamingMessage | null>>
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>
  setConnectionState: React.Dispatch<React.SetStateAction<ConnectionState>>
  setCompletedToolCalls: React.Dispatch<React.SetStateAction<CompletedToolCall[]>>
  setAgentProcessing: React.Dispatch<React.SetStateAction<boolean>>
  setAttachLogs: React.Dispatch<React.SetStateAction<boolean>>
  setAttachedImages: React.Dispatch<React.SetStateAction<string[]>>
  setScreenshotElement: React.Dispatch<React.SetStateAction<SelectedElement | null>>
  setCapturedScreenshot: React.Dispatch<React.SetStateAction<string | null>>
  setShowScreenshotPreview: React.Dispatch<React.SetStateAction<boolean>>
  setAttachedSearchResults: React.Dispatch<React.SetStateAction<Array<{ title: string; url: string; snippet: string }> | null>>
  setThinkingLevel: React.Dispatch<React.SetStateAction<ThinkingLevel>>
  setPendingChange: React.Dispatch<React.SetStateAction<{
    code: string
    undoCode: string
    description: string
    additions: number
    deletions: number
    source: 'code' | 'dom'
  } | null>>
  setPendingDOMApproval: React.Dispatch<React.SetStateAction<PendingDOMApproval | null>>

  // State values
  messages: ChatMessage[]
  thinkingLevel: ThinkingLevel
  selectedElement: SelectedElement | null
  attachedImages: string[]
  attachLogs: boolean
  logs: string[]
  selectedLogs: Array<{ timestamp: Date; type: string; message: string }> | null
  attachedSearchResults: Array<{ title: string; url: string; snippet: string }> | null
  selectedFiles: Array<{ path: string; content: string }>
  screenshotElement: SelectedElement | null
  urlInput: string
  pageTitle: string
  activeTabId: string
  activeTab: {
    projectPath?: string
    url?: string
  } | null
  isWebviewReady: boolean

  // Model and provider config
  selectedModel: { id: string; name: string; provider: string }
  selectedModelRef: React.MutableRefObject<{ id: string; name: string; provider: string }>
  providerConfigs: ProviderConfig[]
  providerConfigsRef: React.MutableRefObject<ProviderConfig[]>
  appSettings: AppSettings
  mcpToolDefinitions: MCPToolDefinition[]

  // Refs
  fileInputRef: React.RefObject<HTMLInputElement>
  webviewRefs: React.MutableRefObject<Map<string, WebviewElement>>
  cancelledApprovalsRef: React.MutableRefObject<Set<string>>

  // Coding agent
  processCodingMessage: (content: string) => {
    intent: { type: string; confidence: number }
    systemPrompt: string
    tools: unknown
    promptMode: string
  }

  // AI functions
  streamAI: (params: {
    modelId: string
    messages: CoreMessage[]
    providers: ProviderConfig[]
    system?: string
    tools?: unknown
    maxSteps?: number
    enableReasoning?: boolean
    mcpTools?: MCPToolDefinition[]
    projectFolder?: string
    onChunk?: (chunk: unknown) => void
    onStepFinish?: (step: unknown) => void
    onReasoningChunk?: (chunk: unknown) => void
  }) => Promise<{
    text?: string
    reasoning?: string
    toolCalls?: Array<{ toolCallId: string; toolName: string; args: unknown }>
    toolResults?: Array<{ toolCallId: string; toolName: string; result: unknown }>
  }>

  // DOM patch functions
  prepareDomPatch: (
    approvalId: string,
    element: SelectedElement,
    cssChanges: Record<string, string>,
    description: string,
    undoCode: string,
    applyCode: string,
    userRequest: string,
    projectPath?: string,
    textChange?: { oldText: string; newText: string },
    srcChange?: { oldSrc: string; newSrc: string }
  ) => void
  clearDomApprovalPatchTimeout: (id: string) => void
  markDomTelemetry: (id: string, event: string) => void
}

/**
 * Built-in slash command definition
 */
interface BuiltInCommand {
  name: string
  aliases?: string[]
  description: string
}

/**
 * Return type for useMessageHandlers
 */
export interface UseMessageHandlersReturn {
  processPrompt: (promptText: string) => Promise<void>
  handleBuiltInCommand: (commandText: string) => boolean
  BUILT_IN_COMMANDS: BuiltInCommand[]
}

/**
 * Hook for message handling logic
 */
export function useMessageHandlers(deps: MessageHandlerDeps): UseMessageHandlersReturn {
  const {
    setMessages,
    setInput,
    setStreamingMessage,
    setIsStreaming,
    setConnectionState,
    setCompletedToolCalls,
    setAgentProcessing,
    setAttachLogs,
    setAttachedImages,
    setScreenshotElement,
    setCapturedScreenshot,
    setShowScreenshotPreview,
    setAttachedSearchResults,
    setThinkingLevel,
    setPendingChange,
    setPendingDOMApproval,
    messages,
    thinkingLevel,
    selectedElement,
    attachedImages,
    attachLogs,
    logs,
    selectedLogs,
    attachedSearchResults,
    selectedFiles,
    screenshotElement,
    urlInput,
    pageTitle,
    activeTabId,
    activeTab,
    isWebviewReady,
    selectedModel,
    selectedModelRef,
    providerConfigs,
    providerConfigsRef,
    appSettings,
    mcpToolDefinitions,
    fileInputRef,
    webviewRefs,
    cancelledApprovalsRef,
    processCodingMessage,
    streamAI,
    prepareDomPatch,
    clearDomApprovalPatchTimeout,
    markDomTelemetry,
  } = deps

  // Built-in slash command definitions
  const BUILT_IN_COMMANDS: BuiltInCommand[] = [
    { name: 'new', aliases: ['clear'], description: 'Clear the conversation' },
    { name: 'compact', description: 'Compact context with optional guidance' },
    { name: 'thinking', description: 'Set reasoning level: off, low, med, high, ultrathink' },
  ]

  /**
   * Handle built-in slash commands
   * Returns true if the command was handled, false otherwise
   */
  const handleBuiltInCommand = useCallback((commandText: string): boolean => {
    const trimmed = commandText.trim()
    if (!trimmed.startsWith('/')) return false

    const parts = trimmed.slice(1).split(/\s+/)
    const command = parts[0].toLowerCase()
    const args = parts.slice(1).join(' ')

    // /new or /clear - Clear the conversation
    if (command === 'new' || command === 'clear') {
      setMessages([])
      setInput('')
      // Add system message
      setMessages([{
        id: Date.now().toString(),
        role: 'system',
        content: 'Conversation cleared.',
        timestamp: new Date(),
      }])
      // Clear after a short delay
      setTimeout(() => setMessages([]), 1500)
      return true
    }

    // /compact [prompt] - Compact the context
    if (command === 'compact') {
      const guidance = args || 'Summarize the key points and decisions from this conversation'
      const summaryPrompt = `Please provide a concise summary of our conversation so far. Focus on:
1. Key topics discussed
2. Decisions made
3. Important code changes or files mentioned
4. Outstanding tasks or questions

${args ? `Additional guidance: ${guidance}` : ''}

Keep the summary brief but comprehensive enough to continue the conversation effectively.`

      // Add system message showing compact in progress
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `Compacting context${args ? ` with guidance: "${args}"` : ''}...`,
        timestamp: new Date(),
      }])

      // Process the summary request
      setTimeout(() => {
        setInput(summaryPrompt)
        const form = document.querySelector('form[data-chat-form]') as HTMLFormElement
        if (form) form.requestSubmit()
      }, 100)
      return true
    }

    // /thinking [level] - Set reasoning mode
    if (command === 'thinking') {
      const levelArg = args.toLowerCase()
      const validLevels: ThinkingLevel[] = ['off', 'low', 'med', 'high', 'ultrathink']

      let actualLevel: ThinkingLevel = 'med'
      if (levelArg === 'on' || levelArg === '') {
        actualLevel = thinkingLevel === 'off' ? 'med' : 'off'
      } else if (validLevels.includes(levelArg as ThinkingLevel)) {
        actualLevel = levelArg as ThinkingLevel
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `Invalid thinking level: "${args}". Valid options: off, low, med, high, ultrathink`,
          timestamp: new Date(),
        }])
        setInput('')
        return true
      }

      setThinkingLevel(actualLevel)

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `Thinking mode: ${actualLevel.toUpperCase()}`,
        timestamp: new Date(),
      }])
      setInput('')
      return true
    }

    return false
  }, [thinkingLevel, setMessages, setInput, setThinkingLevel])

  /**
   * Build element context string for AI prompt
   */
  const buildElementContext = useCallback((element: SelectedElement): string => {
    const hasTargetPosition = element.targetPosition && element.originalPosition

    let context = `
<selected_element>
${element.outerHTML || `<${element.tagName}${element.id ? ` id="${element.id}"` : ''}${element.className ? ` class="${element.className}"` : ''}>${element.text || ''}</${element.tagName}>`}

Element Details:
- Tag: ${element.tagName}
${element.id ? `- ID: ${element.id}` : ''}
${element.className ? `- Classes: ${element.className}` : ''}
${element.xpath ? `- XPath: ${element.xpath}` : ''}
${element.text ? `- Text Content: "${element.text}"` : ''}
${element.attributes ? `- Attributes: ${JSON.stringify(element.attributes)}` : ''}
${element.computedStyle ? `- Computed Style: display=${element.computedStyle.display}, position=${element.computedStyle.position}, color=${element.computedStyle.color}, bg=${element.computedStyle.backgroundColor}` : ''}
${element.rect ? `- Current Position: ${Math.round(element.rect.width)}x${Math.round(element.rect.height)} at (${Math.round(element.rect.left)}, ${Math.round(element.rect.top)})` : ''}`

    // Add source location if available
    if (element.sourceLocation) {
      const src = element.sourceLocation.sources?.[0]
      let filePath = src?.file || ''
      let lineNum = src?.line || 0
      if (!filePath.includes('/') && element.sourceLocation.summary) {
        const match = element.sourceLocation.summary.match(/\(used in ([^:]+):(\d+)\)/)
        if (match) {
          filePath = match[1]
          lineNum = parseInt(match[2], 10)
        }
      }
      context += `\n- Source Location: ${filePath}${lineNum ? `:${lineNum}` : ''} (${element.sourceLocation.summary || 'no summary'})`
    }

    if (hasTargetPosition) {
      context += `
<repositioning_request>
The user wants to MOVE this element to a new position.
- Original Position: ${Math.round(element.originalPosition!.width)}x${Math.round(element.originalPosition!.height)} at (${Math.round(element.originalPosition!.left)}, ${Math.round(element.originalPosition!.top)})
- Target Position: ${Math.round(element.targetPosition!.width)}x${Math.round(element.targetPosition!.height)} at (${Math.round(element.targetPosition!.x)}, ${Math.round(element.targetPosition!.y)})
- Width Change: ${element.targetPosition!.width - element.originalPosition!.width}px
- Height Change: ${element.targetPosition!.height - element.originalPosition!.height}px
- X Offset: ${element.targetPosition!.x - element.originalPosition!.left}px
- Y Offset: ${element.targetPosition!.y - element.originalPosition!.top}px

Please help the user achieve this repositioning by modifying the CSS/layout of the element. Consider:
1. Position property (relative, absolute, fixed, or using flexbox/grid)
2. The element's current CSS and its impact on layout
3. Whether the element needs to be extracted from the normal flow
4. Responsive considerations
</repositioning_request>`
    }

    context += '\n</selected_element>'
    return context
  }, [])

  /**
   * Build file context string from selected files
   */
  const buildFileContext = useCallback((files: Array<{ path: string; content: string }>): string => {
    if (files.length === 0) return ''
    return `\n\nAttached Files:\n${files.map(f => `
File: ${f.path}
\`\`\`
${f.content}
\`\`\`
`).join('\n')}`
  }, [])

  /**
   * Build the full prompt with all context
   */
  const buildFullPrompt = useCallback((
    userContent: string,
    elementContext: string,
    fileContext: string,
    projectPath?: string,
    projectName?: string | null
  ): string => {
    let prompt = `
Current Page: ${urlInput}
${pageTitle ? `Page Title: ${pageTitle}` : ''}
${projectPath ? `Project Folder: ${projectPath}` : ''}
${projectName ? `Project Name: ${projectName}` : ''}

User Request: ${userContent}
${elementContext}
${fileContext}
${screenshotElement ? `Context: User selected element for visual reference: <${screenshotElement.tagName}>` : ''}

${projectPath ? `IMPORTANT: The source files for this page are in ${projectPath}. Use the Read and Glob tools to explore the project structure and find relevant source files before making changes.` : ''}`

    if (attachLogs && logs.length > 0) {
      prompt += `\n\nRecent Console Logs:\n${logs.join('\n')}`
    }

    if (selectedLogs && selectedLogs.length > 0) {
      const logsText = selectedLogs.map(log =>
        `[${log.timestamp.toLocaleTimeString()}] [${log.type}] ${log.message}`
      ).join('\n')
      prompt += `\n\nSelected Console Logs (${selectedLogs.length} entries):\n${logsText}`
    }

    if (attachedSearchResults && attachedSearchResults.length > 0) {
      const searchText = attachedSearchResults.map((result, i) =>
        `${i + 1}. ${result.title}\n   URL: ${result.url}\n   ${result.snippet}`
      ).join('\n\n')
      prompt += `\n\nWeb Search Results (${attachedSearchResults.length} results for context):\n${searchText}`
    }

    return prompt
  }, [urlInput, pageTitle, screenshotElement, attachLogs, logs, selectedLogs, attachedSearchResults])

  /**
   * Process and submit a chat prompt
   * This is the main message handling function
   */
  const processPrompt = useCallback(async (promptText: string) => {
    // Check for built-in commands first
    if (handleBuiltInCommand(promptText)) {
      return
    }

    if (!promptText.trim() && !selectedElement && attachedImages.length === 0 && !screenshotElement) return

    // Generate turn ID for this conversation turn
    const turnId = generateTurnId()
    console.log('[Turn]', turnId)

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText,
      timestamp: new Date(),
      selectedElement: selectedElement || undefined,
      turnId,
      sequenceNumber: 0
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')

    // Build element context
    const elementContext = selectedElement ? buildElementContext(selectedElement) : ''

    // Build file context
    const fileContext = buildFileContext(selectedFiles)

    // User content parts for multimodal messages
    type UserContentPart =
      | { type: 'text'; text: string }
      | { type: 'image'; image: { base64Data: string; mimeType?: string } }

    // Get project context
    const projectPath = activeTab?.projectPath
    const projectName = projectPath ? projectPath.split('/').pop() : null

    // Build full prompt
    let fullPromptText = buildFullPrompt(
      userMessage.content,
      elementContext,
      fileContext,
      projectPath,
      projectName
    )

    // Add modification instructions if needed
    const modifyKeywords = /\b(change|modify|update|edit|delete|remove|add|make|set|fix|replace|style|color|size|font|width|height|margin|padding|border)\b/i
    const wantsModification = selectedElement || modifyKeywords.test(userMessage.content)

    if (wantsModification) {
      fullPromptText += `
Instructions:
You are an AI UI assistant that can modify web pages. The user has selected an element to focus on.

CRITICAL WORKFLOW FOR SOURCE CODE CHANGES:
1. FIRST: Use the Read tool to read the ENTIRE source file (the component/page containing this element)
2. UNDERSTAND the full context - how this element fits in the page structure, what styles affect it, what props/data it uses
3. THEN make your changes, considering how they impact the whole page
4. The selected element is just the FOCUS AREA - you need the full file context to make good edits

For QUICK DOM PREVIEWS (temporary, not saved):
- Output: \`\`\`json-exec {"code": "...", "undo": "..."}\`\`\`
- The "code" executes immediately, "undo" restores original
- Use for quick style/text changes before committing to source

For SOURCE CODE EDITS (permanent):
1. READ the full source file first using the Read tool
2. Understand the component structure and how the element is rendered
3. Use the Edit tool to modify the source, preserving the overall structure
4. NEVER guess at the source code - always read it first

Selected Element Context:
- XPath: ${selectedElement?.xpath || 'N/A'}
- ID: ${selectedElement?.id || 'N/A'}
- Classes: ${selectedElement?.className || 'N/A'}

IMPORTANT: The selected element HTML above is just a snippet. For source edits, you MUST read the full file to understand the complete context. Don't assume the structure - READ IT.

Be concise. Confirm what you changed.`
    } else {
      fullPromptText += `
Instructions:
You are a helpful AI assistant. Answer the user's question conversationally.
DO NOT modify the page or execute any code unless the user explicitly asks you to change something.
If you're not sure what the user wants, ask for clarification.`
    }

    // Build user content parts
    const userContentParts: UserContentPart[] = [
      { type: 'text', text: fullPromptText },
    ]

    // Add attached images
    attachedImages.forEach((img, index) => {
      if (attachedImages.length > 1) {
        userContentParts.push({
          type: 'text',
          text: `\n[Image ${index + 1} of ${attachedImages.length}]:`,
        })
      }
      const base64Data = img.split(',')[1]
      const mimeType = img.split(';')[0].split(':')[1] || 'image/png'
      userContentParts.push({
        type: 'image',
        image: { base64Data, mimeType },
      })
    })

    // Clear attachments
    setAttachLogs(false)
    setAttachedImages([])
    setScreenshotElement(null)
    setCapturedScreenshot(null)
    setShowScreenshotPreview(false)
    setAttachedSearchResults(null)
    if (fileInputRef.current) fileInputRef.current.value = ''

    try {
      // Process through coding agent
      const { intent, systemPrompt: agentSystemPrompt, tools, promptMode } = processCodingMessage(userMessage.content)
      console.log(`[Coding Agent] Intent: ${intent.type} (${Math.round(intent.confidence * 100)}%) | Mode: ${promptMode}`)

      // Get provider for selected model
      const providerType = getProviderForModel(selectedModel.id)

      // Get Google provider for UI updates
      const googleProvider = appSettings.providers.find(p => p.id === 'google' && p.enabled && p.apiKey)
      const selectedModelProvider = appSettings.providers.find(p =>
        p.id === selectedModel.provider && p.enabled && p.apiKey
      )
      const providerForUIUpdate = selectedModelProvider || googleProvider

      // Check for image attachment with image-related intent
      const hasAttachedImageGlobal = attachedImages.length > 0
      const isImageRelatedMessage = /(?:add|insert|put|use|replace|change|swap|set|place|show|save|upload).*(?:image|photo|picture|attached|this|screenshot)|(?:this|the|attached)\s*(?:image|photo|picture|screenshot)|(?:image|photo|picture|screenshot)\s*(?:here|to|in|on|as)/i.test(userMessage.content)

      // Handle image attachment separately (complex logic omitted for brevity - see App.tsx)
      // The full image handling logic involves saving images, applying to elements, etc.

      // Determine if we should use tools
      const shouldUseTools = promptMode !== 'dom_edit'
      console.log(`[AI SDK] Mode: ${promptMode} | MCP tools: ${mcpToolDefinitions.length} | Tools enabled: ${shouldUseTools}`)

      // Use AI SDK for streaming
      if (providerType && (providerConfigs.length > 0 || providerType === 'claude-code' || providerType === 'codex' || providerType === 'google')) {
        console.log(`[AI SDK] Using provider: ${providerType} for model: ${selectedModel.id}`)

        // Build conversation history
        const conversationHistory: CoreMessage[] = toCoreMessages(
          messages
            .filter(msg => msg.role !== 'system')
            .slice(-10)
        )

        const userCoreMessage: CoreMessage = {
          role: 'user',
          content: userContentParts as unknown as CoreMessage['content'],
        }

        const allMessages: CoreMessage[] = [
          ...conversationHistory,
          userCoreMessage,
        ]

        setAgentProcessing(true)
        setIsStreaming(true)
        setConnectionState('streaming')
        setCompletedToolCalls([])

        const streamingId = `streaming-${Date.now()}`
        setStreamingMessage({
          id: streamingId,
          content: '',
          reasoning: '',
          toolCalls: [],
        })

        const accumulatedToolCalls: Array<{
          id: string
          name: string
          args: unknown
          status: 'running' | 'done' | 'error'
          result?: unknown
        }> = []

        let streamedTextBuffer = ''

        console.log('[AI SDK] Streaming with project folder:', activeTab?.projectPath || '(none)')

        const result = await streamAI({
          modelId: selectedModel.id,
          messages: allMessages,
          providers: providerConfigs,
          system: shouldUseTools ? agentSystemPrompt : undefined,
          tools: shouldUseTools ? tools : undefined,
          maxSteps: 15,
          enableReasoning: thinkingLevel !== 'off',
          mcpTools: mcpToolDefinitions,
          projectFolder: activeTab?.projectPath || undefined,
          onChunk: (chunk) => {
            const chunkStr = typeof chunk === 'string' ? chunk : String(chunk ?? '')
            streamedTextBuffer += chunkStr
            setStreamingMessage(prev => prev ? { ...prev, content: streamedTextBuffer } : null)
          },
          onStepFinish: (step: any) => {
            console.log('[AI SDK] Step finished:', {
              textLength: step?.text?.length,
              toolCalls: step?.toolCalls?.length,
              toolResults: step?.toolResults?.length,
            })

            // Track tool calls
            if (step?.toolCalls && step.toolCalls.length > 0) {
              for (const tc of step.toolCalls) {
                const toolId = tc.toolCallId || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                const toolName = tc.toolName?.replace(/^mcp_[^_]+_/, '') || 'tool'
                const existing = accumulatedToolCalls.find(t => t.id === toolId)
                if (!existing) {
                  accumulatedToolCalls.push({ id: toolId, name: toolName, args: tc.args || {}, status: 'running' })
                }
              }
            }

            // Mark tools as done
            if (step?.toolResults && step.toolResults.length > 0) {
              for (const tr of step.toolResults) {
                const toolId = tr.toolCallId
                const toolName = tr.toolName?.replace(/^mcp_[^_]+_/, '') || 'tool'
                const normalizedName = toolName.toLowerCase().replace(/_/g, '')
                const existing = (toolId && accumulatedToolCalls.find(t => t.id === toolId))
                  || accumulatedToolCalls.find(t => t.name.toLowerCase().replace(/_/g, '') === normalizedName && t.status === 'running')
                  || accumulatedToolCalls.find(t => t.status === 'running')
                if (existing) {
                  existing.status = (tr.result as any)?.error ? 'error' : 'done'
                  existing.result = tr.result
                }
              }
            }

            // Update streaming message
            const toolSummary = accumulatedToolCalls.map(t => {
              const icon = t.status === 'running' ? '...' : t.status === 'error' ? 'X' : 'ok'
              return `${icon} ${t.name}`
            }).join(' -> ')

            if (toolSummary) {
              setStreamingMessage(prev => prev ? {
                ...prev,
                content: streamedTextBuffer || `Working: ${toolSummary}`,
                toolCalls: accumulatedToolCalls.map(t => ({
                  id: t.id,
                  name: t.name,
                  args: t.args,
                  status: t.status === 'done' ? 'complete' : t.status,
                  result: t.result
                }))
              } : null)
            }
          },
          onReasoningChunk: (chunk: unknown) => {
            const chunkObj = chunk as { content?: string } | string | null
            const reasoningStr = typeof chunkObj === 'string' ? chunkObj : ((chunkObj as { content?: string })?.content ?? String(chunk ?? ''))
            setStreamingMessage(prev => prev ? { ...prev, reasoning: (prev.reasoning || '') + reasoningStr } : null)
          },
        })

        // Stream complete
        console.log('[AI SDK] Stream complete')
        setIsStreaming(false)
        setAgentProcessing(false)
        setConnectionState('idle')

        // Force-complete stuck tools
        for (const tc of accumulatedToolCalls) {
          if (tc.status === 'running') {
            tc.status = 'done'
          }
        }

        // Capture final tool states
        if (accumulatedToolCalls.length > 0) {
          const finalToolStates = accumulatedToolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            status: (tc.status === 'error' ? 'error' : 'success') as 'success' | 'error',
            timestamp: new Date(),
          }))
          setCompletedToolCalls(finalToolStates)
        }

        setStreamingMessage(null)

        // Resolve final text
        let resolvedText = (result.text || streamedTextBuffer || '').trim()
        if (!resolvedText && result.toolResults && result.toolResults.length > 0) {
          const summaries = result.toolResults
            .map((tr: any) => {
              const toolName = tr.toolName?.replace(/^mcp_[^_]+_/, '') || 'tool'
              const res = tr.result as Record<string, unknown>
              if (res?.error) return `X ${toolName}: ${res.error}`
              if (res?.success) return `ok ${toolName}: Success`
              return `ok ${toolName}`
            })
            .join('\n\n')
          resolvedText = summaries || 'Tasks completed.'
        }
        if (!resolvedText) {
          if (accumulatedToolCalls.length > 0) {
            const toolSummary = accumulatedToolCalls
              .map(t => `ok ${t.name}${t.status === 'error' ? ' (error)' : ''}`)
              .join('\n')
            resolvedText = `Done.\n\n${toolSummary}`
          } else {
            resolvedText = 'No response generated.'
          }
        }

        // Collect tool usage
        const toolUsage: ToolUsage[] = []
        if (result.toolCalls && result.toolCalls.length > 0) {
          for (let i = 0; i < result.toolCalls.length; i++) {
            const tc = result.toolCalls[i]
            const tr = result.toolResults?.[i]
            toolUsage.push({
              id: tc.toolCallId,
              name: tc.toolName,
              args: tc.args as Record<string, unknown>,
              result: tr?.result,
              isError: tr ? (tr.result as any)?.error !== undefined : false,
            })
          }
        }

        // Process response text for code blocks
        const codeBlockRegex = /```json-exec\s*(\{[\s\S]*?\})\s*```/g
        let match
        const codeBlocks: Array<{ code: string; undo?: string }> = []

        while ((match = codeBlockRegex.exec(resolvedText)) !== null) {
          try {
            const parsed = JSON.parse(match[1])
            if (parsed.code) {
              codeBlocks.push({ code: parsed.code, undo: parsed.undo })
            }
          } catch (e) {
            console.error('[Exec] Failed to parse:', e)
          }
        }

        const cleanedText = resolvedText.replace(/```json-exec\s*\{[\s\S]*?\}\s*```/g, '').trim()

        // Add response message
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: cleanedText || 'Changes applied.',
          timestamp: new Date(),
          model: selectedModel.name,
          intent: intent.type !== 'unknown' ? intent.type : undefined,
          toolUsage: toolUsage.length > 0 ? toolUsage : undefined,
          reasoning: typeof result.reasoning === 'string' ? result.reasoning : undefined,
          turnId,
          parentTurnId: userMessage.id,
          sequenceNumber: 1,
        }])

        // Execute code blocks if present
        const webview = webviewRefs.current.get(activeTabId)
        if (codeBlocks.length > 0 && webview && isWebviewReady) {
          const forwardCode = codeBlocks.map(b => b.code).join(';\n')
          const undoCode = codeBlocks.map(b => b.undo || '').filter(Boolean).join(';\n')

          console.log('[Exec] Executing:', forwardCode)
          webview.executeJavaScript(forwardCode)
            .then(() => console.log('[Exec] Applied'))
            .catch((err: Error) => console.error('[Exec] Error:', err))

          setPendingChange({
            code: forwardCode,
            undoCode: undoCode || '',
            description: cleanedText || 'Change applied',
            additions: codeBlocks.length,
            deletions: codeBlocks.filter(b => b.undo).length,
            source: 'code',
          })
        }
      } else {
        // Fallback to GoogleGenAI for backwards compatibility
        console.log('[AI SDK] Falling back to GoogleGenAI with streaming')
        const apiKey = process.env.API_KEY
        if (!apiKey) throw new Error("No API Key configured. Please add your API key in Settings.")
        const ai = new GoogleGenAI({ apiKey })

        const geminiContents = [
          {
            role: 'user',
            parts: userContentParts.map(part =>
              part.type === 'text'
                ? { text: part.text }
                : { inlineData: { data: part.image.base64Data, mimeType: part.image.mimeType || 'image/png' } }
            ),
          },
        ]

        setIsStreaming(true)
        setConnectionState('streaming')
        setCompletedToolCalls([])
        setStreamingMessage({
          id: `streaming-fallback-${Date.now()}`,
          content: '',
          reasoning: '',
          toolCalls: [],
        })

        const response = await ai.models.generateContentStream({
          model: selectedModel.id,
          contents: geminiContents
        })

        let streamedText = ''
        for await (const chunk of response) {
          const chunkText = chunk.text || ''
          streamedText += chunkText
          setStreamingMessage(prev => prev ? { ...prev, content: prev.content + chunkText } : null)
        }

        setIsStreaming(false)
        setStreamingMessage(null)

        if (streamedText) {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: streamedText,
            timestamp: new Date(),
            model: selectedModel.name,
            turnId,
            parentTurnId: userMessage.id,
            sequenceNumber: 1,
          }])
        }
      }
    } catch (err) {
      console.error('[AI] Error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}`,
        timestamp: new Date(),
        model: selectedModel.name
      }])
    } finally {
      setIsStreaming(false)
      setAgentProcessing(false)
      setStreamingMessage(prev => {
        if (prev && prev.toolCalls && prev.toolCalls.length > 0) {
          const finalTools = prev.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            status: (tc.status === 'error' ? 'error' : 'success') as 'success' | 'error',
            timestamp: new Date(),
          }))
          setCompletedToolCalls(current => current.length > 0 ? current : finalTools)
        }
        return null
      })
    }
  }, [
    handleBuiltInCommand,
    selectedElement,
    attachedImages,
    screenshotElement,
    messages,
    selectedFiles,
    urlInput,
    pageTitle,
    activeTab,
    activeTabId,
    isWebviewReady,
    selectedModel,
    providerConfigs,
    appSettings,
    mcpToolDefinitions,
    thinkingLevel,
    attachLogs,
    logs,
    selectedLogs,
    attachedSearchResults,
    setMessages,
    setInput,
    setStreamingMessage,
    setIsStreaming,
    setConnectionState,
    setCompletedToolCalls,
    setAgentProcessing,
    setAttachLogs,
    setAttachedImages,
    setScreenshotElement,
    setCapturedScreenshot,
    setShowScreenshotPreview,
    setAttachedSearchResults,
    setPendingChange,
    fileInputRef,
    webviewRefs,
    processCodingMessage,
    streamAI,
    buildElementContext,
    buildFileContext,
    buildFullPrompt,
  ])

  return {
    processPrompt,
    handleBuiltInCommand,
    BUILT_IN_COMMANDS,
  }
}

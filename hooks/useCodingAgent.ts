import { useCallback, useRef, useState } from 'react'
import { z } from 'zod'
import { ToolsMap, ToolDefinition } from './useAIChat'
import { SelectedElement, Message } from '../types'

// Intent classification types
export type IntentType =
  | 'code_edit'      // Edit/modify existing code
  | 'code_create'    // Create new files/code
  | 'code_delete'    // Delete files/code
  | 'code_explain'   // Explain code
  | 'code_refactor'  // Refactor/improve code
  | 'file_operation' // File system operations (list, rename, etc)
  | 'question'       // General question about code/context
  | 'ui_inspect'     // Inspect/analyze UI element
  | 'ui_modify'      // Modify UI element
  | 'debug'          // Debug/fix issues
  | 'unknown'        // Couldn't classify

export interface ClassifiedIntent {
  type: IntentType
  confidence: number
  targets: string[]        // Files/elements being targeted
  action: string           // What to do (edit, create, delete, etc)
  description: string      // Human-readable description
}

// Context for the coding agent
export interface CodingContext {
  selectedElement: SelectedElement | null
  selectedFiles: Array<{ path: string; content: string }>
  selectedLogs: Array<{ type: string; message: string }>
  projectPath: string | null
  currentFile?: string
  recentMessages: Message[]
}

// Tool execution result
export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

// Intent classification patterns
const INTENT_PATTERNS: Array<{
  type: IntentType
  patterns: RegExp[]
  keywords: string[]
}> = [
  {
    type: 'code_edit',
    patterns: [
      /(?:edit|change|modify|update|fix)\s+(?:the\s+)?(?:code|function|method|class|component)/i,
      /(?:make|set)\s+(?:it|this|the)\s+/i,
      /(?:replace|swap)\s+/i,
    ],
    keywords: ['edit', 'change', 'modify', 'update', 'fix', 'replace', 'swap', 'alter'],
  },
  {
    type: 'code_create',
    patterns: [
      /(?:create|add|new|generate|make)\s+(?:a\s+)?(?:new\s+)?(?:file|function|method|class|component)/i,
      /(?:write|implement)\s+(?:a\s+)?/i,
    ],
    keywords: ['create', 'add', 'new', 'generate', 'write', 'implement'],
  },
  {
    type: 'code_delete',
    patterns: [
      /(?:delete|remove|drop)\s+(?:the\s+)?(?:file|function|method|class|component)/i,
    ],
    keywords: ['delete', 'remove', 'drop'],
  },
  {
    type: 'code_explain',
    patterns: [
      /(?:explain|what\s+does|how\s+does|describe)\s+(?:this|the)/i,
      /(?:what\s+is|what's)\s+(?:this|the)/i,
    ],
    keywords: ['explain', 'describe', 'what does', 'how does', 'what is'],
  },
  {
    type: 'code_refactor',
    patterns: [
      /(?:refactor|clean\s+up|improve|optimize)/i,
      /(?:make\s+(?:it|this)\s+)?(?:better|cleaner|faster|more\s+efficient)/i,
    ],
    keywords: ['refactor', 'clean up', 'improve', 'optimize', 'better', 'cleaner'],
  },
  {
    type: 'file_operation',
    patterns: [
      /(?:list|show|find)\s+(?:files|folders|directories)/i,
      /(?:rename|move|copy)\s+(?:the\s+)?(?:file|folder)/i,
    ],
    keywords: ['list files', 'show files', 'rename', 'move file', 'copy file'],
  },
  {
    type: 'ui_inspect',
    patterns: [
      /(?:what\s+is|describe|analyze)\s+(?:this\s+)?(?:element|button|component)/i,
      /(?:look\s+at|check)\s+(?:this|the)/i,
    ],
    keywords: ['inspect', 'analyze element', 'what is this element'],
  },
  {
    type: 'ui_modify',
    patterns: [
      /(?:change|modify|update)\s+(?:this\s+)?(?:element|button|style|color)/i,
      /(?:make\s+(?:it|this)\s+)?(?:bigger|smaller|red|blue|green)/i,
    ],
    keywords: ['change element', 'modify style', 'update color'],
  },
  {
    type: 'debug',
    patterns: [
      /(?:debug|fix|solve)\s+(?:this|the)\s+(?:issue|bug|error|problem)/i,
      /(?:why\s+is|what's\s+causing)\s+/i,
    ],
    keywords: ['debug', 'fix bug', 'solve error', 'why is', 'not working'],
  },
  {
    type: 'question',
    patterns: [
      /^(?:how|what|why|when|where|can|could|should|would|is|are|do|does)/i,
      /\?$/,
    ],
    keywords: ['how', 'what', 'why', 'question'],
  },
]

// Classify user intent from message
function classifyIntent(message: string, context: CodingContext): ClassifiedIntent {
  const lowerMessage = message.toLowerCase()
  let bestMatch: { type: IntentType; score: number } = { type: 'unknown', score: 0 }

  for (const pattern of INTENT_PATTERNS) {
    let score = 0

    // Check regex patterns
    for (const regex of pattern.patterns) {
      if (regex.test(message)) {
        score += 3
      }
    }

    // Check keywords
    for (const keyword of pattern.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        score += 1
      }
    }

    // Boost score based on context
    if (context.selectedElement && (pattern.type === 'ui_inspect' || pattern.type === 'ui_modify')) {
      score += 2
    }
    if (context.selectedFiles.length > 0 && pattern.type.startsWith('code_')) {
      score += 1
    }
    if (context.selectedLogs.length > 0 && pattern.type === 'debug') {
      score += 2
    }

    if (score > bestMatch.score) {
      bestMatch = { type: pattern.type, score }
    }
  }

  // Extract targets from message
  const targets: string[] = []
  if (context.selectedFiles.length > 0) {
    targets.push(...context.selectedFiles.map(f => f.path))
  }
  if (context.selectedElement) {
    targets.push(`element:${context.selectedElement.tagName}${context.selectedElement.id ? '#' + context.selectedElement.id : ''}`)
  }

  // Determine action based on intent type
  const actionMap: Record<IntentType, string> = {
    code_edit: 'edit',
    code_create: 'create',
    code_delete: 'delete',
    code_explain: 'explain',
    code_refactor: 'refactor',
    file_operation: 'file_op',
    question: 'answer',
    ui_inspect: 'inspect',
    ui_modify: 'modify',
    debug: 'debug',
    unknown: 'process',
  }

  return {
    type: bestMatch.type,
    confidence: Math.min(bestMatch.score / 10, 1),
    targets,
    action: actionMap[bestMatch.type],
    description: `${actionMap[bestMatch.type]} ${targets.join(', ') || 'context'}`,
  }
}

// Build system prompt for coding agent
function buildSystemPrompt(context: CodingContext, intent: ClassifiedIntent): string {
  const parts: string[] = []

  parts.push(`You are a coding assistant integrated into a development environment.
You have access to tools that can read and write files, inspect UI elements, and more.

Current intent: ${intent.type} (${intent.description})
Confidence: ${Math.round(intent.confidence * 100)}%`)

  if (context.projectPath) {
    parts.push(`\nProject root: ${context.projectPath}`)
  }

  if (context.selectedElement) {
    parts.push(`\n## Selected UI Element
Tag: ${context.selectedElement.tagName}
${context.selectedElement.id ? `ID: ${context.selectedElement.id}` : ''}
${context.selectedElement.className ? `Classes: ${context.selectedElement.className}` : ''}
${context.selectedElement.text ? `Text: ${context.selectedElement.text.substring(0, 100)}` : ''}
${context.selectedElement.xpath ? `XPath: ${context.selectedElement.xpath}` : ''}
${context.selectedElement.sourceLocation?.summary ? `Source: ${context.selectedElement.sourceLocation.summary}` : ''}`)

    if (context.selectedElement.outerHTML) {
      parts.push(`\nHTML:\n\`\`\`html\n${context.selectedElement.outerHTML.substring(0, 500)}\n\`\`\``)
    }
  }

  if (context.selectedFiles.length > 0) {
    parts.push(`\n## Selected Files`)
    for (const file of context.selectedFiles) {
      parts.push(`\n### ${file.path}\n\`\`\`\n${file.content.substring(0, 2000)}${file.content.length > 2000 ? '\n... (truncated)' : ''}\n\`\`\``)
    }
  }

  if (context.selectedLogs.length > 0) {
    parts.push(`\n## Console Logs`)
    for (const log of context.selectedLogs.slice(-10)) {
      parts.push(`[${log.type}] ${log.message}`)
    }
  }

  // Add intent-specific instructions
  switch (intent.type) {
    case 'code_edit':
    case 'code_create':
    case 'code_refactor':
      parts.push(`\n## Instructions
When modifying code:
1. Use the write_file tool to save changes
2. Show the diff of what you changed
3. Explain why you made the changes
4. If creating new files, ensure they follow existing project conventions`)
      break

    case 'code_explain':
    case 'question':
      parts.push(`\n## Instructions
Provide clear, concise explanations.
Reference specific line numbers when discussing code.
If the question requires looking at additional files, use the read_file tool.`)
      break

    case 'ui_inspect':
    case 'ui_modify':
      parts.push(`\n## Instructions
For UI work:
1. Analyze the element's structure and styling
2. If modifying, identify the source file and component
3. Suggest specific CSS or React changes
4. Consider accessibility and responsive design`)
      break

    case 'debug':
      parts.push(`\n## Instructions
For debugging:
1. Analyze the error messages and stack traces
2. Identify the root cause
3. Suggest a fix with code changes
4. Explain how to prevent similar issues`)
      break
  }

  return parts.join('\n')
}

// Define tools for the coding agent
export function createCodingAgentTools(): ToolsMap {
  return {
    // File operations
    read_file: {
      description: 'Read the contents of a file',
      parameters: z.object({
        path: z.string().describe('Absolute path to the file'),
      }),
      execute: async (args: unknown) => {
        const { path } = args as { path: string }
        if (!window.electronAPI?.files?.readFile) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await window.electronAPI.files.readFile(path)
        if (result.success) {
          return { content: result.data, path }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    write_file: {
      description: 'Write content to a file (creates or overwrites)',
      parameters: z.object({
        path: z.string().describe('Absolute path to the file'),
        content: z.string().describe('Content to write'),
      }),
      execute: async (args: unknown) => {
        const { path, content } = args as { path: string; content: string }
        if (!window.electronAPI?.files?.writeFile) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await window.electronAPI.files.writeFile(path, content)
        if (result.success) {
          return { success: true, path, bytesWritten: content.length }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    create_file: {
      description: 'Create a new file (fails if file exists)',
      parameters: z.object({
        path: z.string().describe('Absolute path for the new file'),
        content: z.string().optional().describe('Initial content'),
      }),
      execute: async (args: unknown) => {
        const { path, content } = args as { path: string; content?: string }
        if (!window.electronAPI?.files?.createFile) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await window.electronAPI.files.createFile(path, content || '')
        if (result.success) {
          return { success: true, path }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    delete_file: {
      description: 'Delete a file',
      parameters: z.object({
        path: z.string().describe('Absolute path to the file to delete'),
      }),
      execute: async (args: unknown) => {
        const { path } = args as { path: string }
        if (!window.electronAPI?.files?.deleteFile) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await window.electronAPI.files.deleteFile(path)
        if (result.success) {
          return { success: true, path }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    rename_file: {
      description: 'Rename or move a file',
      parameters: z.object({
        oldPath: z.string().describe('Current path'),
        newPath: z.string().describe('New path'),
      }),
      execute: async (args: unknown) => {
        const { oldPath, newPath } = args as { oldPath: string; newPath: string }
        if (!window.electronAPI?.files?.renameFile) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await window.electronAPI.files.renameFile(oldPath, newPath)
        if (result.success) {
          return { success: true, oldPath, newPath }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    list_directory: {
      description: 'List files and folders in a directory',
      parameters: z.object({
        path: z.string().optional().describe('Directory path (defaults to project root)'),
      }),
      execute: async (args: unknown) => {
        const { path } = args as { path?: string }
        if (!window.electronAPI?.files?.listDirectory) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await window.electronAPI.files.listDirectory(path)
        if (result.success) {
          return { entries: result.data, path: path || 'project root' }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    create_directory: {
      description: 'Create a new directory',
      parameters: z.object({
        path: z.string().describe('Path for the new directory'),
      }),
      execute: async (args: unknown) => {
        const { path } = args as { path: string }
        if (!window.electronAPI?.files?.createDirectory) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await window.electronAPI.files.createDirectory(path)
        if (result.success) {
          return { success: true, path }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    file_exists: {
      description: 'Check if a file or directory exists',
      parameters: z.object({
        path: z.string().describe('Path to check'),
      }),
      execute: async (args: unknown) => {
        const { path } = args as { path: string }
        if (!window.electronAPI?.files?.exists) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await window.electronAPI.files.exists(path)
        return { exists: result.exists, path }
      },
    } as ToolDefinition,

    file_stat: {
      description: 'Get file/directory information (size, modified time, etc)',
      parameters: z.object({
        path: z.string().describe('Path to check'),
      }),
      execute: async (args: unknown) => {
        const { path } = args as { path: string }
        if (!window.electronAPI?.files?.stat) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await window.electronAPI.files.stat(path)
        if (result.success) {
          return { ...result.data, path }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    // Git operations
    git_status: {
      description: 'Get current git status (modified files, etc)',
      parameters: z.object({
        includeUntracked: z.boolean().optional().describe('Include untracked files (default: true)'),
      }),
      execute: async () => {
        if (!window.electronAPI?.git?.getStatus) {
          return { error: 'Git operations not available (not in Electron)' }
        }
        const result = await window.electronAPI.git.getStatus()
        if (result.success) {
          return result.data
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    git_commit: {
      description: 'Commit staged changes with a message',
      parameters: z.object({
        message: z.string().describe('Commit message'),
      }),
      execute: async (args: unknown) => {
        const { message } = args as { message: string }
        if (!window.electronAPI?.git?.commit) {
          return { error: 'Git operations not available (not in Electron)' }
        }
        const result = await window.electronAPI.git.commit(message)
        if (result.success) {
          return { success: true, message }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    // Search in files (simulated - would need grep-like IPC)
    search_in_files: {
      description: 'Search for text pattern in files',
      parameters: z.object({
        pattern: z.string().describe('Text or regex pattern to search'),
        directory: z.string().optional().describe('Directory to search in'),
        filePattern: z.string().optional().describe('File glob pattern (e.g., "*.ts")'),
      }),
      execute: async (args: unknown) => {
        // This would need a proper grep-like implementation in Electron
        // For now, return a placeholder
        const { pattern } = args as { pattern: string; directory?: string; filePattern?: string }
        return {
          message: `Search for "${pattern}" not yet implemented - use list_directory + read_file to search manually`,
          pattern,
        }
      },
    } as ToolDefinition,
  }
}

// Hook state
interface CodingAgentState {
  context: CodingContext
  lastIntent: ClassifiedIntent | null
  isProcessing: boolean
}

export function useCodingAgent() {
  const [state, setState] = useState<CodingAgentState>({
    context: {
      selectedElement: null,
      selectedFiles: [],
      selectedLogs: [],
      projectPath: null,
      recentMessages: [],
    },
    lastIntent: null,
    isProcessing: false,
  })

  const toolsRef = useRef<ToolsMap>(createCodingAgentTools())

  // Update context
  const updateContext = useCallback((updates: Partial<CodingContext>) => {
    setState(prev => ({
      ...prev,
      context: { ...prev.context, ...updates },
    }))
  }, [])

  // Process a user message and return prepared data for AI call
  const processMessage = useCallback((message: string): {
    intent: ClassifiedIntent
    systemPrompt: string
    tools: ToolsMap
  } => {
    const intent = classifyIntent(message, state.context)

    setState(prev => ({
      ...prev,
      lastIntent: intent,
    }))

    return {
      intent,
      systemPrompt: buildSystemPrompt(state.context, intent),
      tools: toolsRef.current,
    }
  }, [state.context])

  // Set processing state
  const setProcessing = useCallback((isProcessing: boolean) => {
    setState(prev => ({ ...prev, isProcessing }))
  }, [])

  return {
    context: state.context,
    lastIntent: state.lastIntent,
    isProcessing: state.isProcessing,
    updateContext,
    processMessage,
    setProcessing,
    tools: toolsRef.current,
  }
}

// Export types and utilities
export { classifyIntent, buildSystemPrompt }

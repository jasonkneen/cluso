import { useCallback, useRef, useState, useMemo } from 'react'
import { z } from 'zod'
import { ToolsMap, ToolDefinition, mcpToolsToAISDKFormat, MCPToolDefinition, MCPToolCaller, mergeTools } from './useAIChat'
import { SelectedElement, Message } from '../types'
import { getSystemPrompt, getPromptModeForIntent, type PromptMode } from '../utils/systemPrompts'
import { getElectronAPI } from './useElectronAPI'

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
      /(?:list|show|find|what)\s+(?:files|folders|directories)/i,
      /(?:rename|move|copy)\s+(?:the\s+)?(?:file|folder)/i,
      /(?:what(?:'s| is)?\s+in)\s+(?:the\s+)?(?:folder|directory|\.)/i,
      /(?:ls|dir)\b/i,
      /(?:read|open|view|cat)\s+(?:the\s+)?(?:file|content)/i,
      /(?:write|save|create|edit|modify|update|change)\s+(?:the\s+)?(?:file|code)/i,
      /(?:delete|remove)\s+(?:the\s+)?(?:file|folder)/i,
      /(?:show|what's|whats|what is)\s+(?:in\s+)?(?:the\s+)?(?:project|folder|directory|codebase|repo)/i,
    ],
    keywords: ['list files', 'show files', 'rename', 'move file', 'copy file', 'what files', 'whats in', 'folder contents', 'directory', 'ls', 'read file', 'write file', 'create file', 'edit file', 'save file', 'delete file', 'project files', 'codebase', 'show me'],
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
      /(?:change|modify|update)\s+(?:this\s+)?(?:element|button|style|color|text|font|background)?/i,
      /(?:make\s+(?:it|this|that)\s*)/i,
      /(?:set|change)\s+(?:the\s+)?(?:color|background|font|size|width|height|padding|margin)?/i,
      /(?:add|remove)\s+(?:a\s+)?(?:border|shadow|padding|margin)/i,
      /\b(?:red|blue|green|black|white|bigger|smaller|larger|bold|italic)\b/i,
      // Match quoted text - likely asking to change element text to this value
      /^["'][^"']+["']$/i,
      // Match "change to X" or "set to X" patterns
      /(?:change|set|update)\s+(?:it\s+)?to\s+/i,
      // Match text change patterns
      /(?:text|label|title|content)\s*(?:to|:|\=)\s*/i,
      // Match element removal/deletion - "remove this", "delete this", "hide this"
      /(?:remove|delete|hide)\s+(?:this|that|it|the\s+element)/i,
      // Match image replacement patterns - "use this image", "replace with attached", etc.
      /(?:use|replace\s+with|change\s+to|swap\s+with)\s+(?:this\s+)?(?:image|photo|picture|attached)/i,
      /(?:replace|change|update|swap)\s+(?:this\s+)?(?:image|photo|picture|img)/i,
      /(?:set|use)\s+(?:the\s+)?attached\s+(?:image|photo|picture|file)?/i,
    ],
    keywords: ['change', 'make it', 'make this', 'set', 'red', 'blue', 'green', 'black', 'white', 'bigger', 'smaller', 'larger', 'bold', 'italic', 'background', 'color', 'font', 'size', 'padding', 'margin', 'border', 'style', 'update', 'modify', 'change to', 'set to', 'remove this', 'delete this', 'hide this', 'remove', 'delete', 'hide', 'use this image', 'replace image', 'change image', 'swap image', 'use attached', 'replace with attached'],
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
  const scoreBreakdown: Record<string, { pattern: number; keyword: number; context: number; total: number }> = {}

  for (const pattern of INTENT_PATTERNS) {
    let score = 0
    let patternScore = 0
    let keywordScore = 0
    let contextScore = 0

    // Check regex patterns
    for (const regex of pattern.patterns) {
      if (regex.test(message)) {
        patternScore += 3
      }
    }
    score += patternScore

    // Check keywords
    for (const keyword of pattern.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        keywordScore += 1
      }
    }
    score += keywordScore

    // Boost score based on context
    if (context.selectedElement && (pattern.type === 'ui_inspect' || pattern.type === 'ui_modify')) {
      contextScore += 2
    }
    if (context.selectedFiles.length > 0 && pattern.type.startsWith('code_')) {
      contextScore += 1
    }
    if (context.selectedLogs.length > 0 && pattern.type === 'debug') {
      contextScore += 2
    }
    score += contextScore

    scoreBreakdown[pattern.type] = { pattern: patternScore, keyword: keywordScore, context: contextScore, total: score }

    if (score > bestMatch.score) {
      bestMatch = { type: pattern.type, score }
    }
  }

  // Log intent classification for debugging
  console.log('[Intent] Classification for:', message.substring(0, 50))
  console.log('[Intent] Scores:', scoreBreakdown)
  console.log('[Intent] Winner:', bestMatch.type, 'with score', bestMatch.score)

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
function buildSystemPrompt(context: CodingContext, intent: ClassifiedIntent, mcpTools?: MCPToolDefinition[]): string {
  const parts: string[] = []

  parts.push(`You are a coding assistant running in Electron with DIRECT ACCESS to the local file system.

CRITICAL RULES - READ CAREFULLY:
1. You are NOT a web app. You ARE running in Electron with full file system access.
2. You have function-calling tools that EXECUTE DIRECTLY on the user's machine.
3. When the user asks to read, write, list, or modify files - CALL THE TOOL IMMEDIATELY.
4. NEVER output code snippets showing how to set up IPC or file operations.
5. NEVER say "I can't access files" or "as a web app" - you CAN and MUST use the tools.
6. NEVER suggest terminal commands. USE THE TOOLS.

Your tools (call these directly):

FILE READING:
- list_directory: Lists files/folders - USE THIS for "show me files", "what's in this folder"
- read_file: Reads file content - USE THIS for "show me", "read", "what's in this file"
- read_multiple_files: Reads multiple files at once - efficient for reading several files
- get_file_tree: Gets recursive directory tree - USE THIS for "project structure", "what files exist"

FILE WRITING:
- write_file: Writes to file - USE THIS for "edit", "update", "change", "save"
- create_file: Creates new file - USE THIS for "create", "new file", "add file"
- delete_file: Deletes file - USE THIS for "delete", "remove"
- rename_file: Renames/moves - USE THIS for "rename", "move"
- copy_file: Copies file - USE THIS for "copy", "duplicate"
- create_directory: Creates folder - USE THIS for "new folder", "mkdir"

SEARCH:
- search_in_files: Grep-like search - USE THIS for "find", "search for", "where is"
- find_files: Glob pattern match - USE THIS for "find all *.ts files", "list tsx files"

UTILITIES:
- file_exists: Checks if path exists
- file_stat: Gets file info (size, dates)
- git_status: Shows git status
- git_commit: Commits changes

EXECUTE THE TOOLS. Do not explain how to set them up. They are already set up and working.

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
3. Apply the changes to the source code using the write_file tool
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

  // Add MCP tools section if any are available
  if (mcpTools && mcpTools.length > 0) {
    // Group tools by server
    const toolsByServer = mcpTools.reduce((acc, tool) => {
      if (!acc[tool.serverId]) {
        acc[tool.serverId] = []
      }
      acc[tool.serverId].push(tool)
      return acc
    }, {} as Record<string, MCPToolDefinition[]>)

    parts.push(`\n## MCP Tools (External Capabilities)
You have access to additional tools from connected MCP (Model Context Protocol) servers.
These extend your capabilities beyond local file operations.

To call an MCP tool, use the format: mcp_<serverId>_<toolName>`)

    for (const [serverId, tools] of Object.entries(toolsByServer)) {
      parts.push(`\n### Server: ${serverId}`)
      for (const tool of tools) {
        const paramNames = tool.inputSchema.properties
          ? Object.keys(tool.inputSchema.properties).join(', ')
          : 'none'
        parts.push(`- **mcp_${serverId}_${tool.name}**: ${tool.description || 'No description'} (params: ${paramNames})`)
      }
    }
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
        path: z.string().describe('Absolute path to the file').optional(),
        filePath: z.string().describe('Legacy alias for path').optional(),
      }),
      execute: async (args: unknown) => {
        const { path, filePath } = args as { path?: string; filePath?: string }
        const resolvedPath = path ?? filePath
        if (!resolvedPath) {
          return { error: 'read_file requires a "path" argument' }
        }
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.readFile) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await electronAPI.files.readFile(resolvedPath)
        if (result.success) {
          return { content: result.data, path: resolvedPath }
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
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.writeFile) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await electronAPI.files.writeFile(path, content)
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
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.createFile) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await electronAPI.files.createFile(path, content || '')
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
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.deleteFile) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await electronAPI.files.deleteFile(path)
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
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.renameFile) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await electronAPI.files.renameFile(oldPath, newPath)
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
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.listDirectory) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await electronAPI.files.listDirectory(path)
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
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.createDirectory) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await electronAPI.files.createDirectory(path)
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
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.exists) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await electronAPI.files.exists(path)
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
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.stat) {
          return { error: 'File operations not available (not in Electron)' }
        }
        const result = await electronAPI.files.stat(path)
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
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.git?.getStatus) {
          return { error: 'Git operations not available (not in Electron)' }
        }
        const result = await electronAPI.git.getStatus()
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
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.git?.commit) {
          return { error: 'Git operations not available (not in Electron)' }
        }
        const result = await electronAPI.git.commit(message)
        if (result.success) {
          return { success: true, message }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    // Search in files (grep-like)
    search_in_files: {
      description: 'Search for text pattern in files (like grep). Returns matching lines with file paths and line numbers.',
      parameters: z.object({
        pattern: z.string().describe('Text or regex pattern to search'),
        directory: z.string().optional().describe('Directory to search in (defaults to project root)'),
        filePattern: z.string().optional().describe('File pattern filter (e.g., "*.ts", "*.tsx,*.js")'),
        caseSensitive: z.boolean().optional().describe('Case sensitive search (default: false)'),
        maxResults: z.number().optional().describe('Maximum results to return (default: 100)'),
      }),
      execute: async (args: unknown) => {
        const { pattern, directory, filePattern, caseSensitive, maxResults } = args as {
          pattern: string
          directory?: string
          filePattern?: string
          caseSensitive?: boolean
          maxResults?: number
        }
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.searchInFiles) {
          return { error: 'Search not available (not in Electron)' }
        }
        const result = await electronAPI.files.searchInFiles(pattern, directory, {
          filePattern,
          caseSensitive,
          maxResults,
        })
        if (result.success) {
          return { matches: result.data, count: result.data.length }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    // Glob pattern file finder
    find_files: {
      description: 'Find files matching a glob pattern (e.g., "**/*.ts", "src/**/*.tsx")',
      parameters: z.object({
        pattern: z.string().describe('Glob pattern (supports *, **, ?)'),
        directory: z.string().optional().describe('Directory to search in'),
      }),
      execute: async (args: unknown) => {
        const { pattern, directory } = args as { pattern: string; directory?: string }
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.glob) {
          return { error: 'Glob not available (not in Electron)' }
        }
        const result = await electronAPI.files.glob(pattern, directory)
        if (result.success) {
          return { files: result.data, count: result.data.length }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    // Copy file
    copy_file: {
      description: 'Copy a file to a new location',
      parameters: z.object({
        sourcePath: z.string().describe('Source file path'),
        destPath: z.string().describe('Destination file path'),
      }),
      execute: async (args: unknown) => {
        const { sourcePath, destPath } = args as { sourcePath: string; destPath: string }
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.copyFile) {
          return { error: 'Copy not available (not in Electron)' }
        }
        const result = await electronAPI.files.copyFile(sourcePath, destPath)
        if (result.success) {
          return { success: true, sourcePath, destPath }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    // Read multiple files at once
    read_multiple_files: {
      description: 'Read multiple files at once - more efficient than calling read_file multiple times',
      parameters: z.object({
        paths: z.array(z.string()).describe('Array of file paths to read'),
      }),
      execute: async (args: unknown) => {
        const { paths } = args as { paths: string[] }
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.readMultiple) {
          return { error: 'Read multiple not available (not in Electron)' }
        }
        const result = await electronAPI.files.readMultiple(paths)
        if (result.success) {
          return { files: result.data }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    // Get file tree
    get_file_tree: {
      description: 'Get a recursive file tree of a directory - useful for understanding project structure',
      parameters: z.object({
        directory: z.string().optional().describe('Directory path (defaults to project root)'),
        maxDepth: z.number().optional().describe('Maximum depth to traverse (default: 5)'),
        includeHidden: z.boolean().optional().describe('Include hidden files (default: false)'),
      }),
      execute: async (args: unknown) => {
        const { directory, maxDepth, includeHidden } = args as {
          directory?: string
          maxDepth?: number
          includeHidden?: boolean
        }
        const { api: electronAPI } = getElectronAPI()
        if (!electronAPI?.files?.getTree) {
          return { error: 'Get tree not available (not in Electron)' }
        }
        const result = await electronAPI.files.getTree(directory, { maxDepth, includeHidden })
        if (result.success) {
          return { tree: result.data }
        }
        return { error: result.error }
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

// Hook options
interface UseCodingAgentOptions {
  mcpTools?: MCPToolDefinition[]
  callMCPTool?: MCPToolCaller
}

export function useCodingAgent(options: UseCodingAgentOptions = {}) {
  const { mcpTools = [], callMCPTool } = options

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

  // Memoize combined tools (coding agent + MCP)
  const combinedTools = useMemo(() => {
    // DISABLED: MCP tools merging to fix schema issues
    // We now pass MCP tools separately to the AI SDK wrapper
    return toolsRef.current
  }, [mcpTools, callMCPTool])

  // Update context
  const updateContext = useCallback((updates: Partial<CodingContext>) => {
    setState(prev => ({
      ...prev,
      context: { ...prev.context, ...updates },
    }))
  }, [])

  // Process a user message and return prepared data for AI call
  const processMessage = useCallback((message: string, options?: { forceMode?: PromptMode }): {
    intent: ClassifiedIntent
    systemPrompt: string
    tools: ToolsMap
    promptMode: PromptMode
  } => {
    const intent = classifyIntent(message, state.context)

    setState(prev => ({
      ...prev,
      lastIntent: intent,
    }))

    // Determine prompt mode based on intent and context
    const promptMode = options?.forceMode ?? getPromptModeForIntent(intent.type, !!state.context.selectedElement)

    // For DOM edits, use minimal prompt without tools
    // For file ops and chat, use full prompt with all tools and MCP
    let systemPrompt: string
    if (promptMode === 'dom_edit') {
      systemPrompt = getSystemPrompt('dom_edit', {
        selectedElement: state.context.selectedElement,
        projectPath: state.context.projectPath,
      })
    } else {
      // Use full buildSystemPrompt for file ops and chat (includes MCP tools)
      systemPrompt = buildSystemPrompt(state.context, intent, mcpTools.length > 0 ? mcpTools : undefined)
    }

    return {
      intent,
      systemPrompt,
      tools: promptMode === 'dom_edit' ? {} : combinedTools, // No tools for DOM edit
      promptMode,
    }
  }, [state.context, mcpTools, combinedTools])

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
    tools: combinedTools,
  }
}

// Export types and utilities
export { classifyIntent, buildSystemPrompt }

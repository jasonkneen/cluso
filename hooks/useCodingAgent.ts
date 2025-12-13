import { useCallback, useRef, useState, useMemo } from 'react'
import { z } from 'zod'
import { ToolsMap, ToolDefinition, mcpToolsToAISDKFormat, MCPToolDefinition, MCPToolCaller, mergeTools } from './useAIChat'
import { SelectedElement, Message } from '../types'
import { getSystemPrompt, getPromptModeForIntent, type PromptMode } from '../utils/systemPrompts'
import { getElectronAPI } from './useElectronAPI'
import { fileService } from '../services/FileService'

// Intent classification types - designed to be combinable (e.g., ui_modify + research)
export type IntentType =
  // Code operations
  | 'code_edit'      // Edit/modify existing code
  | 'code_create'    // Create new files/code
  | 'code_delete'    // Delete files/code
  | 'code_explain'   // Explain code
  | 'code_refactor'  // Refactor/improve code
  | 'file_operation' // File system operations (list, rename, etc)
  // UI operations
  | 'ui_inspect'     // Inspect/analyze UI element
  | 'ui_modify'      // Modify UI element
  | 'ui_build'       // Build new UI component/feature
  // Research & Analysis
  | 'research'       // Research, investigate, find information
  | 'analyze'        // Analyze code, data, or patterns
  | 'compare'        // Compare options, approaches, or implementations
  // Planning & Architecture
  | 'plan'           // Plan implementation, design architecture
  | 'document'       // Write documentation, comments, README
  // Testing & Quality
  | 'test'           // Write tests, run tests, test functionality
  | 'debug'          // Debug/fix issues
  | 'review'         // Code review, security review
  // DevOps & Deployment
  | 'deploy'         // Deploy, publish, release
  | 'configure'      // Configure settings, environment, tools
  // Communication
  | 'question'       // General question about code/context
  | 'chat'           // General conversation, not task-specific
  // Meta
  | 'unknown'        // Couldn't classify

export interface ClassifiedIntent {
  type: IntentType           // Primary intent
  secondaryTypes: IntentType[] // Additional intents (for combinations like "research + ui_modify")
  confidence: number
  targets: string[]          // Files/elements being targeted
  action: string             // What to do (edit, create, delete, etc)
  description: string        // Human-readable description
}

// LSP Diagnostic for agent context
export interface FileDiagnostic {
  line: number
  character: number
  severity: 'error' | 'warning' | 'info' | 'hint'
  message: string
  source?: string
}

// Context for the coding agent
export interface CodingContext {
  selectedElement: SelectedElement | null
  selectedFiles: Array<{ path: string; content: string; diagnostics?: FileDiagnostic[] }>
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
  // New intent types for comprehensive coverage
  {
    type: 'ui_build',
    patterns: [
      /(?:build|create|make)\s+(?:a\s+)?(?:new\s+)?(?:page|screen|view|layout|form|modal|dialog|menu|nav|sidebar|header|footer|component|widget)/i,
      /(?:add|implement)\s+(?:a\s+)?(?:new\s+)?(?:feature|section|area)/i,
    ],
    keywords: ['build', 'create page', 'new page', 'new screen', 'add section', 'new component', 'create form', 'add modal'],
  },
  {
    type: 'research',
    patterns: [
      /(?:research|investigate|look\s+into|find\s+out|explore|discover)/i,
      /(?:what\s+are\s+the\s+best|best\s+practices|how\s+do\s+others|industry\s+standard)/i,
      /(?:search\s+for|look\s+up|google|find\s+examples)/i,
    ],
    keywords: ['research', 'investigate', 'explore', 'best practices', 'find out', 'look into', 'examples of'],
  },
  {
    type: 'analyze',
    patterns: [
      /(?:analyze|analysis|audit|assess|evaluate|examine|study)/i,
      /(?:what's\s+wrong|find\s+issues|identify\s+problems|check\s+for)/i,
    ],
    keywords: ['analyze', 'analysis', 'audit', 'assess', 'evaluate', 'examine', 'study', 'find issues'],
  },
  {
    type: 'compare',
    patterns: [
      /(?:compare|versus|vs\.?|which\s+is\s+better|pros\s+and\s+cons|trade-?offs)/i,
      /(?:difference\s+between|similarities|options)/i,
    ],
    keywords: ['compare', 'versus', 'vs', 'better', 'pros cons', 'trade-offs', 'difference between', 'options'],
  },
  {
    type: 'plan',
    patterns: [
      /(?:plan|design|architect|outline|strategy|roadmap|approach)/i,
      /(?:how\s+should\s+we|what's\s+the\s+best\s+way\s+to|steps\s+to)/i,
    ],
    keywords: ['plan', 'design', 'architect', 'outline', 'strategy', 'roadmap', 'approach', 'steps'],
  },
  {
    type: 'document',
    patterns: [
      /(?:document|write\s+docs|readme|jsdoc|comment|annotate)/i,
      /(?:add\s+documentation|explain\s+in\s+code|write\s+comments)/i,
    ],
    keywords: ['document', 'documentation', 'readme', 'jsdoc', 'comments', 'annotate'],
  },
  {
    type: 'test',
    patterns: [
      /(?:test|write\s+tests|unit\s+test|integration\s+test|e2e|spec)/i,
      /(?:verify|validate|check\s+if\s+works|make\s+sure)/i,
    ],
    keywords: ['test', 'tests', 'unit test', 'integration test', 'e2e', 'spec', 'verify', 'validate'],
  },
  {
    type: 'review',
    patterns: [
      /(?:review|code\s+review|security\s+review|check\s+code|audit\s+code)/i,
      /(?:is\s+this\s+code\s+(?:good|safe|secure)|any\s+issues|improvements)/i,
    ],
    keywords: ['review', 'code review', 'security review', 'audit', 'check code', 'improvements'],
  },
  {
    type: 'deploy',
    patterns: [
      /(?:deploy|publish|release|ship|push\s+to\s+prod|go\s+live)/i,
      /(?:build\s+for\s+production|production\s+build|package)/i,
    ],
    keywords: ['deploy', 'publish', 'release', 'ship', 'production', 'go live'],
  },
  {
    type: 'configure',
    patterns: [
      /(?:configure|config|setup|set\s+up|settings|environment|env)/i,
      /(?:install|add\s+package|npm\s+install|add\s+dependency)/i,
    ],
    keywords: ['configure', 'config', 'setup', 'settings', 'environment', 'env', 'install', 'package'],
  },
  {
    type: 'chat',
    patterns: [
      /^(?:hi|hello|hey|thanks|thank\s+you|ok|okay|sure|cool|nice|great)\s*[!.]?$/i,
    ],
    keywords: ['hi', 'hello', 'hey', 'thanks', 'ok'],
  },
]

// Classify user intent from message - returns primary + secondary intents
function classifyIntent(message: string, context: CodingContext): ClassifiedIntent {
  const lowerMessage = message.toLowerCase()
  const scoreBreakdown: Record<string, { pattern: number; keyword: number; context: number; total: number }> = {}
  const allScores: Array<{ type: IntentType; score: number }> = []

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
    if (context.selectedElement && (pattern.type === 'ui_inspect' || pattern.type === 'ui_modify' || pattern.type === 'ui_build')) {
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

    if (score > 0) {
      allScores.push({ type: pattern.type, score })
    }
  }

  // Sort by score descending
  allScores.sort((a, b) => b.score - a.score)

  // Get primary intent (highest scoring)
  const primaryIntent = allScores[0] || { type: 'unknown' as IntentType, score: 0 }

  // Get secondary intents (other high-scoring intents above threshold)
  // Threshold: at least 50% of primary score and score >= 2
  const secondaryThreshold = Math.max(primaryIntent.score * 0.5, 2)
  const secondaryTypes: IntentType[] = allScores
    .slice(1) // Skip primary
    .filter(s => s.score >= secondaryThreshold)
    .slice(0, 2) // Max 2 secondary intents
    .map(s => s.type)

  // Log intent classification for debugging
  console.log('[Intent] Classification for:', message.substring(0, 50))
  console.log('[Intent] Top scores:', allScores.slice(0, 5))
  console.log('[Intent] Primary:', primaryIntent.type, '| Secondary:', secondaryTypes)

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
    ui_inspect: 'inspect',
    ui_modify: 'modify',
    ui_build: 'build',
    research: 'research',
    analyze: 'analyze',
    compare: 'compare',
    plan: 'plan',
    document: 'document',
    test: 'test',
    debug: 'debug',
    review: 'review',
    deploy: 'deploy',
    configure: 'configure',
    question: 'answer',
    chat: 'chat',
    unknown: 'process',
  }

  return {
    type: primaryIntent.type,
    secondaryTypes,
    confidence: Math.min(primaryIntent.score / 10, 1),
    targets,
    action: actionMap[primaryIntent.type] || 'process',
    description: `${actionMap[primaryIntent.type] || 'process'} ${targets.join(', ') || 'context'}`,
  }
}

// Build system prompt for coding agent
function buildSystemPrompt(context: CodingContext, intent: ClassifiedIntent, mcpTools?: MCPToolDefinition[]): string {
  const parts: string[] = []

  parts.push(`You are a coding assistant with DIRECT file system access.

## OUTPUT RULES (CRITICAL)
- Be CONCISE. One sentence explanations max.
- NO verbose summaries. NO "I will now..." or "Let me..."
- After tool calls, give BRIEF status: "Done" / "Created X" / "Fixed Y"
- Don't repeat tool results back to user - they see them already.
- Don't explain what you're about to do - JUST DO IT.

## EXECUTION RULES
1. USE tools directly. Never ask user to provide files or run commands.
2. CREATE: Use write_file IMMEDIATELY. Don't read first.
3. EDIT: Read ONCE, then write changes.
4. If read fails (not found) and creating: EXPECTED - just create it.

## ANTI-LOOP RULES (CRITICAL - PREVENTS INFINITE LOOPS)
- TRACK what you've done. Don't repeat tool calls with same arguments.
- list_directory: MAX ONCE per request
- read_file: NEVER read same file twice
- semantic_search / search_in_files: NEVER search for same query twice
- If a tool returns an error, ADAPT - don't retry the same call.
- If you've made 3+ tool calls without user-visible progress, STOP and summarize.
- After completing the task, STOP. Don't keep searching for more to do.

Your tools:

WRITING (use these for CREATE/EDIT):
- write_file: Creates or overwrites file - USE THIS FIRST for create/edit tasks
- create_file: Creates new file (fails if exists)
- delete_file: Deletes file
- rename_file: Renames/moves file
- create_directory: Creates folder

READING (use sparingly):
- read_file: Read file content
- list_directory: List directory contents
- get_file_tree: Get project structure
- read_multiple_files: Read several files at once

SEARCH - CRITICAL INSTRUCTIONS:
- semantic_search: **YOUR PRIMARY SEARCH TOOL** - Finds code by meaning and context
  → USE FOR: "Quick start", "auth code", "error handling", "API endpoint", ANY code search
  → This understands INTENT, not just keywords
- search_in_files: Grep (ONLY for exact regex patterns like "TODO:|FIXME:")
- find_files: Glob (ONLY for filenames like "*.test.ts")

🚨 IMPORTANT: ALWAYS use semantic_search for finding code. It's faster and smarter than grep.
Only fall back to search_in_files if semantic_search returns "Index is empty".

Current intent: ${intent.type} (${intent.description})
Confidence: ${Math.round(intent.confidence * 100)}%`)

  if (context.projectPath) {
    parts.push(`\n## Project Context
Project root: ${context.projectPath}

IMPORTANT: This is where the source files live. When the user asks about the page or wants changes:
1. Use Glob to find relevant source files (e.g., *.tsx, *.jsx, *.html)
2. Use Read to examine the full file before making changes
3. Common patterns: src/, components/, pages/, app/`)
  }

  if (context.selectedElement) {
    parts.push(`\n## Selected UI Element (FOCUS AREA - but read the FULL file for context)
Tag: ${context.selectedElement.tagName}
${context.selectedElement.id ? `ID: ${context.selectedElement.id}` : ''}
${context.selectedElement.className ? `Classes: ${context.selectedElement.className}` : ''}
${context.selectedElement.text ? `Text: ${context.selectedElement.text.substring(0, 100)}` : ''}
${context.selectedElement.xpath ? `XPath: ${context.selectedElement.xpath}` : ''}
${context.selectedElement.sourceLocation?.summary ? `Source: ${context.selectedElement.sourceLocation.summary}` : ''}

⚠️ CRITICAL FOR UI EDITS:
1. This HTML snippet is just the SELECTED element - the user wants to focus on this area
2. You MUST read the ENTIRE source file to understand the full context before editing
3. The element exists within a larger component/page - understand that structure first
4. Don't assume what's around it - READ THE FILE to see the full picture`)

    if (context.selectedElement.outerHTML) {
      parts.push(`\nHTML Snippet (selected element only):\n\`\`\`html\n${context.selectedElement.outerHTML.substring(0, 500)}\n\`\`\``)
    }
  }

  if (context.selectedFiles.length > 0) {
    parts.push(`\n## Selected Files`)
    for (const file of context.selectedFiles) {
      parts.push(`\n### ${file.path}\n\`\`\`\n${file.content.substring(0, 2000)}${file.content.length > 2000 ? '\n... (truncated)' : ''}\n\`\`\``)

      // Include LSP diagnostics if available
      if (file.diagnostics && file.diagnostics.length > 0) {
        const errors = file.diagnostics.filter(d => d.severity === 'error')
        const warnings = file.diagnostics.filter(d => d.severity === 'warning')
        const hints = file.diagnostics.filter(d => d.severity === 'info' || d.severity === 'hint')

        parts.push(`\n**Diagnostics:**`)
        if (errors.length > 0) {
          parts.push(`\n🔴 **Errors (${errors.length}):**`)
          for (const err of errors.slice(0, 10)) {
            parts.push(`- Line ${err.line}:${err.character}: ${err.message}${err.source ? ` [${err.source}]` : ''}`)
          }
          if (errors.length > 10) parts.push(`  ... and ${errors.length - 10} more errors`)
        }
        if (warnings.length > 0) {
          parts.push(`\n🟡 **Warnings (${warnings.length}):**`)
          for (const warn of warnings.slice(0, 5)) {
            parts.push(`- Line ${warn.line}:${warn.character}: ${warn.message}${warn.source ? ` [${warn.source}]` : ''}`)
          }
          if (warnings.length > 5) parts.push(`  ... and ${warnings.length - 5} more warnings`)
        }
        if (hints.length > 0 && errors.length === 0 && warnings.length === 0) {
          // Only show hints if no errors/warnings to keep context focused
          parts.push(`\n💡 **Hints (${hints.length}):**`)
          for (const hint of hints.slice(0, 3)) {
            parts.push(`- Line ${hint.line}:${hint.character}: ${hint.message}`)
          }
        }
      }
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
    case 'code_create':
      parts.push(`\n## CREATE INSTRUCTIONS - DO THIS NOW:
1. Call write_file with the FULL content immediately
2. Do NOT read files first - you're CREATING, not editing
3. Do NOT search for where to put the file - the user told you
4. If you need to see project structure, ONE list_directory call max
5. WRITE THE FILE. That is your primary task.`)
      break

    case 'code_edit':
    case 'code_refactor':
      parts.push(`\n## EDIT INSTRUCTIONS:
1. Read the target file ONCE with read_file
2. Make your changes and call write_file with the new content
3. Do NOT read other files unless absolutely necessary
4. If read_file returns "not found" error, use write_file to create it`)
      break

    case 'code_explain':
    case 'question':
      parts.push(`\n## EXPLAIN INSTRUCTIONS:
Read the relevant files and provide clear explanations.
Reference specific line numbers when discussing code.`)
      break

    case 'ui_inspect':
    case 'ui_modify':
      parts.push(`\n## UI INSTRUCTIONS:
1. The element info is above - USE IT
2. If modifying, call write_file to update the source
3. Do NOT over-analyze - make the change`)
      break

    case 'debug':
      parts.push(`\n## DEBUG INSTRUCTIONS:
1. Read the error info provided
2. Call read_file on the suspected file
3. Call write_file with the fix
4. Do NOT endlessly search - make your best fix attempt`)
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

// Clarifying question option type (mirrors ClarifyingQuestion component)
export interface ClarifyingQuestionOption {
  id: string
  label: string
  description?: string
}

// Clarifying question data type
export interface ClarifyingQuestionData {
  id: string
  question: string
  type: 'single-select' | 'multi-select' | 'text' | 'confirm'
  options?: ClarifyingQuestionOption[]
  placeholder?: string
  required?: boolean
}

// Options for creating coding agent tools
interface CreateCodingAgentToolsOptions {
  onFileModified?: (event: FileModificationEvent) => void
  onAskClarifyingQuestion?: (question: ClarifyingQuestionData) => Promise<string | string[]>
}

// Define tools for the coding agent
export function createCodingAgentTools(options: CreateCodingAgentToolsOptions = {}): ToolsMap {
  const { onFileModified, onAskClarifyingQuestion } = options

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
        const result = await fileService.readFileFull(resolvedPath)
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
        // Read original content for undo capability
        let originalContent: string | undefined
        const readResult = await fileService.readFileFull(path)
        if (readResult.success) {
          originalContent = readResult.data
        }
        const result = await fileService.writeFile(path, content)
        if (result.success) {
          // Notify about file modification for edited files drawer
          onFileModified?.({
            type: 'write',
            path,
            originalContent,
            newContent: content,
          })
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
        const result = await fileService.createFile(path, content || '')
        if (result.success) {
          // Notify about file creation for edited files drawer
          onFileModified?.({
            type: 'create',
            path,
            newContent: content || '',
          })
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
        // Read original content for undo capability before deleting
        let originalContent: string | undefined
        const readResult = await fileService.readFileFull(path)
        if (readResult.success) {
          originalContent = readResult.data
        }
        const result = await fileService.deleteFile(path)
        if (result.success) {
          // Notify about file deletion for edited files drawer
          onFileModified?.({
            type: 'delete',
            path,
            originalContent,
          })
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
        const result = await fileService.renameFile(oldPath, newPath)
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
        const result = await fileService.listDirectory(path)
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
        const result = await fileService.createDirectory(path)
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
        const result = await fileService.exists(path)
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
        const result = await fileService.stat(path)
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
        const result = await fileService.searchInFiles(pattern, directory, {
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

    // Semantic code search (AI-powered, understands meaning)
    semantic_search: {
      description: 'PRIMARY SEARCH TOOL: Search codebase by meaning, intent, and context using AI. Finds code even when exact keywords don\'t match. Use this for ALL code searches: features, concepts, components, functions, patterns, documentation - everything. 3-10x faster than grep and finds more relevant results. Only falls back to grep if index is empty.',
      parameters: z.object({
        query: z.string().describe('Natural language description of what to find (e.g., "authentication handler", "error handling for API calls")'),
        limit: z.number().optional().describe('Maximum results to return (default: 10)'),
        threshold: z.number().optional().describe('Minimum similarity score 0-1 (default: 0.3)'),
      }),
      execute: async (args: unknown) => {
        const { query, limit, threshold } = args as {
          query: string
          limit?: number
          threshold?: number
        }
        const { api: electronAPI } = getElectronAPI()

        // Check if mgrep is available
        if (electronAPI?.mgrep?.search) {
          const result = await electronAPI.mgrep.search(query, { limit, threshold })
          if (result.success && result.results) {
            return {
              matches: result.results.map((r: { filePath: string; content: string; score: number; metadata?: { startLine?: number; endLine?: number; language?: string; functionName?: string } }) => ({
                file: r.filePath,
                content: r.content,
                score: r.score,
                startLine: r.metadata?.startLine,
                endLine: r.metadata?.endLine,
                language: r.metadata?.language,
                functionName: r.metadata?.functionName,
              })),
              count: result.results.length,
              semantic: true,
            }
          }
          // Fall through to grep if mgrep failed
          console.log('[semantic_search] mgrep failed, falling back to grep:', result.error)
        }

        // Fallback to grep-based search
        const grepResult = await fileService.searchInFiles(query, undefined, { maxResults: limit || 10 })
        if (grepResult.success) {
          return {
            matches: grepResult.data,
            count: grepResult.data.length,
            semantic: false,
            warning: '⚠️ Fell back to keyword search (slower, less accurate). Code Index not initialized - go to Settings → Code Index to enable AI-powered semantic search for better results.',
          }
        }
        if (grepResult.error) return { error: grepResult.error }

        return { error: 'Search not available. Enable Code Index in Settings for semantic search.' }
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
        const result = await fileService.glob(pattern, directory)
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
        const result = await fileService.copyFile(sourcePath, destPath)
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
        const result = await fileService.readMultiple(paths)
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
        const result = await fileService.getTree(directory, { maxDepth, includeHidden })
        if (result.success) {
          return { tree: result.data }
        }
        return { error: result.error }
      },
    } as ToolDefinition,

    // Ask clarifying question - allows AI to ask user for input
    ask_clarifying_question: {
      description: 'Ask the user a clarifying question to better understand their needs. Use this when you need more information before proceeding. Supports single-select, multi-select, text input, or simple confirmation.',
      parameters: z.object({
        question: z.string().describe('The question to ask the user'),
        type: z.enum(['single-select', 'multi-select', 'text', 'confirm']).describe('Type of input: single-select (one choice), multi-select (multiple choices), text (free text), confirm (yes/no)'),
        options: z.array(z.object({
          id: z.string().describe('Unique ID for this option'),
          label: z.string().describe('Display text for the option'),
          description: z.string().optional().describe('Additional context for this option'),
        })).optional().describe('Options for single-select or multi-select types'),
        placeholder: z.string().optional().describe('Placeholder text for text input type'),
        required: z.boolean().optional().describe('Whether the user must answer (default: false)'),
      }),
      execute: async (args: unknown) => {
        const { question, type, options, placeholder, required } = args as {
          question: string
          type: 'single-select' | 'multi-select' | 'text' | 'confirm'
          options?: Array<{ id: string; label: string; description?: string }>
          placeholder?: string
          required?: boolean
        }

        if (!onAskClarifyingQuestion) {
          return { error: 'Clarifying questions not available in this context' }
        }

        // Validate that options are provided for select types
        if ((type === 'single-select' || type === 'multi-select') && (!options || options.length === 0)) {
          return { error: 'Options are required for single-select and multi-select question types' }
        }

        const questionData: ClarifyingQuestionData = {
          id: `q_${Date.now()}`,
          question,
          type,
          options,
          placeholder,
          required,
        }

        try {
          const response = await onAskClarifyingQuestion(questionData)
          return {
            success: true,
            question: question,
            response: response,
            type: type,
          }
        } catch (error) {
          return { error: `Failed to get user response: ${error}` }
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

// File modification event for tracking edited files
export interface FileModificationEvent {
  type: 'write' | 'create' | 'delete'
  path: string
  originalContent?: string  // For undo capability
  newContent?: string
}

// Hook options
interface UseCodingAgentOptions {
  mcpTools?: MCPToolDefinition[]
  callMCPTool?: MCPToolCaller
  onFileModified?: (event: FileModificationEvent) => void  // Callback when files are modified
  onAskClarifyingQuestion?: (question: ClarifyingQuestionData) => Promise<string | string[]>  // Callback for clarifying questions
}

export function useCodingAgent(options: UseCodingAgentOptions = {}) {
  const { mcpTools = [], callMCPTool, onFileModified, onAskClarifyingQuestion } = options

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

  // Create tools with callbacks
  // Memoize to avoid recreating on every render
  const codingTools = useMemo(
    () => createCodingAgentTools({ onFileModified, onAskClarifyingQuestion }),
    [onFileModified, onAskClarifyingQuestion]
  )

  // Memoize combined tools (coding agent + MCP)
  const combinedTools = useMemo(() => {
    // DISABLED: MCP tools merging to fix schema issues
    // We now pass MCP tools separately to the AI SDK wrapper
    return codingTools
  }, [codingTools, mcpTools, callMCPTool])

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

    // ALWAYS include tools - at minimum read tools should be available
    // This ensures the AI can read files, search, etc. in ANY mode
    return {
      intent,
      systemPrompt,
      tools: combinedTools, // Always provide tools
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

/**
 * Modular System Prompts
 *
 * Different prompts for different task types:
 * - DOM editing: Minimal, fast, focused on CSS/text changes
 * - File operations: Full tool access for file system
 * - Chat: Comprehensive for general conversation
 * - Voice: Concise for voice interaction
 */

import type { SelectedElement } from '../types'

export type PromptMode = 'dom_edit' | 'file_ops' | 'chat' | 'voice'

interface PromptContext {
  selectedElement?: SelectedElement | null
  projectPath?: string | null
  mcpToolCount?: number
}

/**
 * DOM Edit Prompt - Minimal for fast point-and-click changes
 * No file tools, no MCP, just CSS and text manipulation
 */
export function getDomEditPrompt(element: SelectedElement): string {
  return `You are a UI editor. Given an element and a request, output a JSON object with the changes.

Element:
- Tag: ${element.tagName}
- Classes: ${element.className || 'none'}
- ID: ${element.id || 'none'}
- Text: ${element.text?.substring(0, 100) || 'none'}
- Styles: ${JSON.stringify(element.computedStyle || {}).substring(0, 300)}

Output ONLY valid JSON:
{
  "cssChanges": { "property": "value" },
  "textChange": "new text if changing",
  "description": "Brief description"
}

Rules:
- "textChange" for text content changes
- "cssChanges" for style changes (use camelCase: backgroundColor, fontSize)
- Keep descriptions under 20 words`
}

/**
 * File Operations Prompt - Full file system access
 * Used when intent is code_edit, file_operation, etc.
 */
export function getFileOpsPrompt(context: PromptContext): string {
  return `You are a coding assistant with DIRECT file system access.

CRITICAL: USE TOOLS IMMEDIATELY - NEVER ASK THE USER TO:
- Provide file contents (use read_file)
- Run commands (use your tools)
- Share output (read it yourself)
- Paste anything (you have direct access)

Your tools:
- list_directory(path): List files in a directory
- read_file(path): Read file contents
- write_file(path, content): Write to file
- create_file(path, content): Create new file
- delete_file(path): Delete file
- search_in_files(pattern, path): Search for text
- find_files(pattern, path): Find files by glob

${context.projectPath ? `Project: ${context.projectPath}` : ''}

START WORKING IMMEDIATELY. Read files, make changes, execute.`
}

/**
 * Chat Prompt - Full capabilities for general conversation
 * Includes MCP tools, context, detailed instructions
 */
export function getChatPrompt(context: PromptContext): string {
  const parts: string[] = []

  parts.push(`You are an AI assistant with DIRECT access to the user's development environment.

CRITICAL BEHAVIOR:
- NEVER ask the user to provide files, run commands, or share output
- NEVER say "could you share" or "please paste" - USE YOUR TOOLS
- When you need to see files: READ THEM with read_file or list_directory
- When you need to search: USE search_in_files or find_files
- BE PROACTIVE - just do the work, don't ask for permission

Your tools:
- list_directory(path): List files in a directory
- read_file(path): Read file contents
- write_file(path, content): Write to file
- search_in_files(pattern, path): Search for text
- find_files(pattern, path): Find files by glob

${context.projectPath ? `Project: ${context.projectPath}` : ''}
${context.mcpToolCount ? `MCP tools available: ${context.mcpToolCount}` : ''}`)

  if (context.selectedElement) {
    parts.push(`
Selected Element:
- ${context.selectedElement.tagName}${context.selectedElement.id ? '#' + context.selectedElement.id : ''}
- Classes: ${context.selectedElement.className || 'none'}
- Text: ${context.selectedElement.text?.substring(0, 50) || 'none'}`)
  }

  return parts.join('\n')
}

/**
 * Voice Prompt - Concise for voice interaction
 * Short responses, action-oriented
 */
export function getVoicePrompt(context: PromptContext): string {
  return `You are a voice assistant for development. Keep responses SHORT (1-2 sentences).

${context.projectPath ? `Working in: ${context.projectPath}` : ''}

Respond conversationally. For actions, confirm briefly then execute.
Don't read code aloud - summarize what you found.`
}

/**
 * Get the appropriate system prompt based on mode
 */
export function getSystemPrompt(mode: PromptMode, context: PromptContext): string {
  switch (mode) {
    case 'dom_edit':
      if (!context.selectedElement) {
        return getFileOpsPrompt(context)
      }
      return getDomEditPrompt(context.selectedElement)
    case 'file_ops':
      return getFileOpsPrompt(context)
    case 'chat':
      return getChatPrompt(context)
    case 'voice':
      return getVoicePrompt(context)
    default:
      return getChatPrompt(context)
  }
}

/**
 * Determine the appropriate prompt mode based on intent
 */
export function getPromptModeForIntent(intentType: string, hasSelectedElement: boolean): PromptMode {
  // DOM edits with selected element = fast path
  if (intentType === 'ui_modify' && hasSelectedElement) {
    return 'dom_edit'
  }

  // File operations
  if (['code_edit', 'code_create', 'code_delete', 'file_operation', 'code_refactor'].includes(intentType)) {
    return 'file_ops'
  }

  // Everything else gets full chat
  return 'chat'
}

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

## OUTPUT RULES (CRITICAL)
- Be CONCISE. Max 1-2 sentences between tool calls.
- NO "I will now..." / "Let me..." / "I'm going to..."
- NO repeating tool results. User sees them already.
- After completing, give brief summary: "Done. Created X." or "Fixed the import."

## ANTI-LOOP RULES
- NEVER repeat a tool call with same arguments.
- list_directory: MAX ONCE per request.
- read_file: NEVER same file twice.
- If tool errors, ADAPT - don't retry same call.
- After 3 tool calls without progress, STOP.

## TOOLS
- read_file, write_file, create_file, delete_file
- list_directory (use sparingly)
- semantic_search (PRIMARY for code search)
- search_in_files (ONLY for exact regex)
- find_files (ONLY for glob patterns)

${context.projectPath ? `Project: ${context.projectPath}` : ''}

USE semantic_search FIRST for any code search. Execute immediately.`
}

/**
 * Chat Prompt - Full capabilities for general conversation
 * Includes MCP tools, context, detailed instructions
 */
export function getChatPrompt(context: PromptContext): string {
  const parts: string[] = []

  parts.push(`You are an AI assistant with DIRECT access to the user's development environment.

## OUTPUT RULES (CRITICAL)
- Be CONCISE. Short paragraphs, not essays.
- NO verbose preambles. NO "I will now..." or "Let me..."
- Don't repeat tool results - user sees them.
- After tools complete, brief summary only.

## ANTI-LOOP RULES
- TRACK what you've done. Don't repeat same tool calls.
- list_directory: MAX ONCE per request.
- read_file: NEVER same file twice.
- search: NEVER same query twice.
- After 3 tool calls without progress, STOP.

## BEHAVIOR
- USE tools directly. Never ask user to provide files.
- Use semantic_search FIRST for any code search.
- Be proactive - do the work, don't ask permission.

${context.projectPath ? `Project: ${context.projectPath}` : ''}
${context.mcpToolCount ? `MCP tools available: ${context.mcpToolCount}` : ''}

## CLARIFYING QUESTIONS
Use ask_clarifying_question for:
- Ambiguous requests (which auth method?)
- Multiple valid options (React Query vs SWR?)
- Destructive confirmations (delete 15 files?)`)

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
  if ((intentType === 'ui_modify' || intentType === 'ui_build') && hasSelectedElement) {
    return 'dom_edit'
  }

  // File operations - includes new coding-related intents
  if ([
    'code_edit', 'code_create', 'code_delete', 'file_operation', 'code_refactor',
    'test', 'document', 'deploy', 'configure'
  ].includes(intentType)) {
    return 'file_ops'
  }

  // Everything else gets full chat (research, analyze, compare, plan, review, question, chat, etc.)
  return 'chat'
}

/**
 * Tool Grouping Utilities
 *
 * Groups consecutive same-type tool calls for compact display.
 * e.g., [grep x3] instead of [grep] [grep] [grep]
 */

export interface ToolCallItem {
  id: string
  name: string
  args?: unknown
  status: 'pending' | 'running' | 'complete' | 'done' | 'error' | 'success'
  result?: unknown
}

export interface GroupedTool {
  name: string
  count: number
  tools: ToolCallItem[]
  hasRunning: boolean
  hasError: boolean
  allComplete: boolean
}

/**
 * Group consecutive tools with the same name together.
 * Returns an array of groups with counts and status flags.
 */
export function groupConsecutiveTools(tools: ToolCallItem[]): GroupedTool[] {
  const groups: GroupedTool[] = []
  let currentGroup: GroupedTool | null = null

  for (const tool of tools) {
    if (currentGroup && currentGroup.name === tool.name) {
      currentGroup.count++
      currentGroup.tools.push(tool)
      if (tool.status === 'running') currentGroup.hasRunning = true
      if (tool.status === 'error') currentGroup.hasError = true
      if (tool.status !== 'complete' && tool.status !== 'done' && tool.status !== 'success') {
        currentGroup.allComplete = false
      }
    } else {
      if (currentGroup) groups.push(currentGroup)
      currentGroup = {
        name: tool.name,
        count: 1,
        tools: [tool],
        hasRunning: tool.status === 'running',
        hasError: tool.status === 'error',
        allComplete: tool.status === 'complete' || tool.status === 'done' || tool.status === 'success',
      }
    }
  }
  if (currentGroup) groups.push(currentGroup)
  return groups
}

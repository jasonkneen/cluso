/**
 * Tool Manager - Manages tool definitions, validation, and execution
 * Supports both native tools and MCP tools in a unified interface
 */

import { tool as createTool, ToolExecutionOptions } from 'ai'
import { z } from 'zod'
import type { AITool, MCPToolDefinition, ToolExecutionContext } from './types'

/**
 * Tool manager for organizing and executing tools
 */
export class ToolManager {
  private tools: Map<string, AITool> = new Map()
  private toolsByCategory: Map<string, AITool[]> = new Map()
  private executionHistory: Array<{ toolName: string; timestamp: number; duration: number }> = []

  /**
   * Register a single tool
   */
  registerTool(tool: AITool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool "${tool.name}" already registered, overwriting`)
    }

    this.tools.set(tool.name, tool)

    // Add to category index
    if (tool.category) {
      if (!this.toolsByCategory.has(tool.category)) {
        this.toolsByCategory.set(tool.category, [])
      }
      this.toolsByCategory.get(tool.category)!.push(tool)
    }
  }

  /**
   * Register multiple tools at once
   */
  registerTools(tools: AITool[]): void {
    for (const tool of tools) {
      this.registerTool(tool)
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): AITool | undefined {
    return this.tools.get(name)
  }

  /**
   * Get all registered tools
   */
  getAllTools(): AITool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): AITool[] {
    return this.toolsByCategory.get(category) || []
  }

  /**
   * Convert tools to AI SDK format (tool definitions)
   * This creates the format expected by streamText and generateText
   */
  toSDKFormat(): Record<string, ReturnType<typeof createTool>> {
    const sdkTools: Record<string, ReturnType<typeof createTool>> = {}

    for (const [name, tool] of this.tools) {
      sdkTools[name] = createTool({
        description: tool.description,
        parameters: zodToToolSchema(tool.inputSchema),
        execute: async (params: unknown) => {
          const startTime = performance.now()

          try {
            // Validate input against schema
            const validatedInput = tool.inputSchema.parse(params)

            // Execute the tool
            const result = await tool.execute(validatedInput)

            // Record execution
            const duration = performance.now() - startTime
            this.executionHistory.push({
              toolName: name,
              timestamp: Date.now(),
              duration,
            })

            return result
          } catch (error) {
            const duration = performance.now() - startTime
            this.executionHistory.push({
              toolName: name,
              timestamp: Date.now(),
              duration,
            })

            if (error instanceof z.ZodError) {
              throw new Error(`Invalid input for tool "${name}": ${error.message}`)
            }

            throw error
          }
        },
      })
    }

    return sdkTools
  }

  /**
   * Get tools filtered for a specific request
   * Useful for limiting tools based on context or reducing token usage
   */
  getToolsForRequest(
    filter?: (tool: AITool) => boolean,
    maxTokens?: number
  ): AITool[] {
    let filtered = Array.from(this.tools.values())

    if (filter) {
      filtered = filtered.filter(filter)
    }

    if (maxTokens) {
      // Simple heuristic: each tool description ~50 tokens
      const maxTools = Math.floor(maxTokens / 50)
      filtered = filtered.slice(0, maxTools)
    }

    return filtered
  }

  /**
   * Validate that a tool call matches the registered tool
   */
  validateToolCall(toolName: string, args: unknown): { valid: boolean; error?: string } {
    const tool = this.tools.get(toolName)
    if (!tool) {
      return { valid: false, error: `Tool "${toolName}" not found` }
    }

    try {
      tool.inputSchema.parse(args)
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      }
    }
  }

  /**
   * Execute a tool directly (useful for processing tool calls)
   */
  async executeTool(toolName: string, args: unknown): Promise<unknown> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found`)
    }

    const validation = this.validateToolCall(toolName, args)
    if (!validation.valid) {
      throw new Error(`Invalid tool input: ${validation.error}`)
    }

    return tool.execute(args)
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalExecutions: number
    toolStats: Array<{
      name: string
      count: number
      averageDuration: number
    }>
  } {
    const stats = new Map<string, { count: number; totalDuration: number }>()

    for (const execution of this.executionHistory) {
      const current = stats.get(execution.toolName) || { count: 0, totalDuration: 0 }
      current.count++
      current.totalDuration += execution.duration
      stats.set(execution.toolName, current)
    }

    return {
      totalExecutions: this.executionHistory.length,
      toolStats: Array.from(stats.entries()).map(([name, stat]) => ({
        name,
        count: stat.count,
        averageDuration: stat.totalDuration / stat.count,
      })),
    }
  }

  /**
   * Clear execution history
   */
  clearExecutionHistory(): void {
    this.executionHistory = []
  }
}

/**
 * Convert Zod schema to AI SDK tool schema format
 */
function zodToToolSchema(schema: z.ZodType): Record<string, unknown> {
  // Get the JSON schema representation from Zod
  const jsonSchema = schema instanceof z.ZodObject ? schema.shape : undefined

  if (!jsonSchema) {
    return {
      type: 'object',
      properties: {},
    }
  }

  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [key, value] of Object.entries(jsonSchema)) {
    const zodType = value as z.ZodType

    // Build property schema
    properties[key] = getZodTypeSchema(zodType)

    // Check if required
    if (!(zodType instanceof z.ZodOptional)) {
      required.push(key)
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  }
}

/**
 * Convert a single Zod type to schema
 */
function getZodTypeSchema(zodType: z.ZodType): Record<string, unknown> {
  // String types
  if (zodType instanceof z.ZodString) {
    return { type: 'string' }
  }

  // Number types
  if (zodType instanceof z.ZodNumber) {
    return { type: 'number' }
  }

  // Boolean types
  if (zodType instanceof z.ZodBoolean) {
    return { type: 'boolean' }
  }

  // Array types
  if (zodType instanceof z.ZodArray) {
    return {
      type: 'array',
      items: getZodTypeSchema((zodType as any)._def.type),
    }
  }

  // Object types
  if (zodType instanceof z.ZodObject) {
    const properties: Record<string, unknown> = {}
    const shape = (zodType as any)._def.shape()

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = getZodTypeSchema(value as z.ZodType)
    }

    return {
      type: 'object',
      properties,
    }
  }

  // Optional types
  if (zodType instanceof z.ZodOptional) {
    return getZodTypeSchema((zodType as any)._def.schema)
  }

  // Default fallback
  return { type: 'string' }
}

/**
 * Convert MCP tool definitions to AI SDK format
 */
export function mcpToolsToAISDKFormat(
  mcpTools: MCPToolDefinition[]
): Record<string, ReturnType<typeof createTool>> {
  const sdkTools: Record<string, ReturnType<typeof createTool>> = {}

  for (const mcpTool of mcpTools) {
    sdkTools[mcpTool.name] = createTool({
      description: mcpTool.description || '',
      parameters: mcpTool.inputSchema as Record<string, unknown>,
      execute: async (params: unknown) => {
        // MCP tools execution is handled separately through the MCP server
        return {
          status: 'pending',
          params,
          note: 'Execute through MCP server',
        }
      },
    })
  }

  return sdkTools
}

/**
 * Merge multiple tool sets
 */
export function mergeToolSets(
  ...toolSets: Array<Record<string, ReturnType<typeof createTool>>>
): Record<string, ReturnType<typeof createTool>> {
  const merged: Record<string, ReturnType<typeof createTool>> = {}

  for (const toolSet of toolSets) {
    Object.assign(merged, toolSet)
  }

  return merged
}

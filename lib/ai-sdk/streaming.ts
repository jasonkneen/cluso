/**
 * Streaming Utilities - Handles streaming responses from AI models
 * Supports text streaming, tool call streaming, and thinking blocks
 */

import { streamText, generateText, CoreMessage, LanguageModel } from 'ai'
import { z } from 'zod'
import type { StreamOptions, GenerationResponse, StreamEvent, AITool } from './types'
import { ToolManager } from './tool-manager'

/**
 * Stream text from a model with tool support
 * Returns readable streams for different content types
 */
export async function* streamModelResponse(
  model: LanguageModel,
  messages: CoreMessage[],
  tools: AITool[],
  options?: StreamOptions
): AsyncGenerator<StreamEvent> {
  const toolManager = new ToolManager()
  toolManager.registerTools(tools)

  const streamResult = streamText({
    model,
    messages,
    tools: toolManager.toSDKFormat(),
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    topP: options?.topP,
    topK: options?.topK,
    frequencyPenalty: options?.frequencyPenalty,
    presencePenalty: options?.presencePenalty,
    stopSequences: options?.stopSequences,
    toolChoice: (options?.toolChoice as any) || 'auto',
  })

  // Yield text chunks
  for await (const chunk of streamResult.textStream) {
    yield {
      type: 'text',
      content: chunk,
    }
  }

  // Yield thinking blocks if available
  if (streamResult.experimental_thinking) {
    for await (const thinkingChunk of streamResult.experimental_thinking) {
      yield {
        type: 'thinking',
        content: thinkingChunk,
      }
    }
  }

  // Yield tool calls with streaming
  if (streamResult.experimental_toolCallStreaming) {
    for await (const toolCall of streamResult.experimental_toolCallStreaming) {
      yield {
        type: 'tool-call',
        toolName: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        args: toolCall.args,
      }
    }
  }

  // Wait for full response to get usage and finish reason
  const finalResult = await streamResult.finalMessage

  yield {
    type: 'finish',
    usage: {
      inputTokens: finalResult.usage.inputTokens,
      outputTokens: finalResult.usage.outputTokens,
      totalTokens: finalResult.usage.inputTokens + finalResult.usage.outputTokens,
    },
  }
}

/**
 * Generate complete response (non-streaming)
 */
export async function generateModelResponse(
  model: LanguageModel,
  messages: CoreMessage[],
  tools: AITool[],
  options?: StreamOptions
): Promise<GenerationResponse> {
  const toolManager = new ToolManager()
  toolManager.registerTools(tools)

  const result = await generateText({
    model,
    messages,
    tools: toolManager.toSDKFormat(),
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    topP: options?.topP,
    topK: options?.topK,
    frequencyPenalty: options?.frequencyPenalty,
    presencePenalty: options?.presencePenalty,
    stopSequences: options?.stopSequences,
    toolChoice: (options?.toolChoice as any) || 'auto',
  })

  // Extract thinking if present
  let thinking: string | undefined

  // Process tool calls
  const toolCalls = result.toolCalls.map((tc) => ({
    id: tc.toolCallId,
    name: tc.toolName,
    args: tc.args,
  }))

  const toolResults = result.toolResults?.map((tr) => ({
    id: tr.toolCallId,
    name: tr.toolName,
    result: tr.result,
  })) || []

  return {
    text: result.text,
    thinking,
    toolCalls,
    toolResults,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
    },
    finishReason: result.finishReason,
  }
}

/**
 * Convert stream of events into a readable stream
 */
export async function streamEventsToReadable(
  generator: AsyncGenerator<StreamEvent>,
  eventFilter?: (event: StreamEvent) => boolean
): Promise<ReadableStream<string>> {
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generator) {
          if (eventFilter && !eventFilter(event)) {
            continue
          }

          const line = JSON.stringify(event) + '\n'
          controller.enqueue(line)
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}

/**
 * Parse streaming events from a readable stream
 */
export async function* parseStreamingEvents(
  stream: ReadableStream<string>
): AsyncGenerator<StreamEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        if (buffer.trim()) {
          yield JSON.parse(buffer)
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.trim()) {
          yield JSON.parse(line)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Aggregate streaming events into a complete response
 * Useful for collecting all events before processing
 */
export async function aggregateStreamingEvents(
  events: AsyncIterable<StreamEvent>
): Promise<GenerationResponse> {
  let text = ''
  let thinking = ''
  const toolCalls: GenerationResponse['toolCalls'] = []
  const toolResults: GenerationResponse['toolResults'] = []
  let usage = { inputTokens: 0, outputTokens: 0 }
  let finishReason = 'stop'

  for await (const event of events) {
    switch (event.type) {
      case 'text':
        text += event.content
        break
      case 'thinking':
        thinking += event.content
        break
      case 'tool-call':
        toolCalls.push({
          id: event.toolCallId,
          name: event.toolName,
          args: event.args,
        })
        break
      case 'tool-result':
        toolResults.push({
          id: event.toolCallId,
          name: event.toolName,
          result: event.result,
        })
        break
      case 'finish':
        if (event.usage) {
          usage = event.usage
        }
        break
      case 'error':
        finishReason = 'error'
        break
    }
  }

  return {
    text,
    thinking: thinking || undefined,
    toolCalls,
    toolResults,
    usage,
    finishReason,
  }
}

/**
 * Create a function to handle tool execution and continuation
 */
export function createToolCallHandler(
  toolManager: ToolManager,
  model: LanguageModel
) {
  return async (
    toolCalls: Array<{ id: string; name: string; args: unknown }>,
    messages: CoreMessage[]
  ): Promise<CoreMessage[]> => {
    const toolResults = []

    for (const toolCall of toolCalls) {
      try {
        const result = await toolManager.executeTool(toolCall.name, toolCall.args)
        toolResults.push({
          type: 'tool-result' as const,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          result,
        })
      } catch (error) {
        toolResults.push({
          type: 'tool-result' as const,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          result: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          isError: true,
        })
      }
    }

    // Add tool results to message history
    return [
      ...messages,
      {
        role: 'assistant' as const,
        content: toolCalls.map((tc) => ({
          type: 'tool-call' as const,
          toolCallId: tc.id,
          toolName: tc.name,
          args: tc.args,
        })),
      },
      {
        role: 'user' as const,
        content: toolResults.map((tr) => ({
          type: 'tool-result' as const,
          toolCallId: tr.toolCallId,
          toolName: tr.toolName,
          result: tr.result,
          isError: tr.isError,
        })),
      },
    ]
  }
}

/**
 * Handle streaming response with automatic tool execution
 */
export async function streamWithToolExecution(
  model: LanguageModel,
  messages: CoreMessage[],
  tools: AITool[],
  options?: StreamOptions & {
    onToolCall?: (toolName: string, args: unknown) => void
    autoExecuteTools?: boolean
  }
): Promise<GenerationResponse> {
  const toolManager = new ToolManager()
  toolManager.registerTools(tools)

  let currentMessages = messages
  const allToolCalls: GenerationResponse['toolCalls'] = []
  const allToolResults: GenerationResponse['toolResults'] = []

  // Keep executing tools until no more tool calls
  while (true) {
    const response = await generateModelResponse(
      model,
      currentMessages,
      tools,
      options
    )

    allToolCalls.push(...response.toolCalls)
    allToolResults.push(...response.toolResults)

    // If no tool calls, we're done
    if (response.toolCalls.length === 0) {
      return {
        ...response,
        toolCalls: allToolCalls,
        toolResults: allToolResults,
      }
    }

    // Execute tools if requested
    if (options?.autoExecuteTools !== false) {
      const toolHandler = createToolCallHandler(toolManager, model)
      currentMessages = await toolHandler(response.toolCalls, currentMessages)
    } else {
      // Return after first batch of tool calls
      return {
        ...response,
        toolCalls: allToolCalls,
        toolResults: allToolResults,
      }
    }
  }
}

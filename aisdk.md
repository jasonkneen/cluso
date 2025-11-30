This comprehensive guide demonstrates how to build a modern AI chat interface using the **Vercel AI SDK**. It covers **streaming chat**, **streaming tool usage** (Generative UI), and the new **reasoning/thinking** capabilities (like DeepSeek R1 or custom middleware).

This solution implements:

1.  **Backend**: An API route using `streamText` with specific tools and reasoning support.
2.  **Frontend**: A chat interface using `useChat` that renders text, specific tool UIs, and collapsible reasoning blocks.

### 1\. Backend: API Route (`app/api/chat/route.ts`)

This route handles the AI request. We enable `experimental_toolCallStreaming` to show tool updates in real-time and use middleware to capture "thinking" blocks from models that support it.

```typescript
import { openai } from '@ai-sdk/openai';
import { streamText, tool, wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { z } from 'zod';

// 1. Wrap model to extract reasoning (useful for DeepSeek R1 or similar models)
// If using a model with native reasoning support (like O1), this might differ slightly.
const model = wrapLanguageModel({
  model: openai('gpt-4o'), // Replace with 'deepseek-r1' or compatible model
  middleware: extractReasoningMiddleware({ tagName: 'think' }),
});

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model,
    messages,
    // 2. Enable streaming for tool calls (shows partial args as they type)
    experimental_toolCallStreaming: true, 
    tools: {
      // Example Tool: Get Crypto Price
      getCryptoPrice: tool({
        description: 'Get the current price of a cryptocurrency',
        parameters: z.object({
          symbol: z.string().describe('The symbol of the crypto, e.g., BTC, ETH'),
          currency: z.string().default('USD'),
        }),
        execute: async ({ symbol, currency }) => {
          // Simulate API latency
          await new Promise(resolve => setTimeout(resolve, 1500));
          return { 
            symbol: symbol.toUpperCase(), 
            price: 65432.10, 
            currency, 
            timestamp: new Date().toISOString() 
          };
        },
      }),
    },
  });

  // 3. Forward reasoning tokens to the client
  return result.toDataStreamResponse({
    sendReasoning: true, 
  });
}
```

### 2\. Frontend: Custom Tool Components

Create simpler, reusable components to render your tools.

**`components/tools/crypto-card.tsx`**

```tsx
'use client';

export function CryptoPriceCard({ result, args, state }: any) {
  // Loading state (tool is being called)
  if (state !== 'result') {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 animate-pulse">
        Checking price for {args?.symbol || '...'}...
      </div>
    );
  }

  // Final Result State
  return (
    <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
      <div className="font-bold text-lg">{result.symbol} Price</div>
      <div className="text-2xl text-green-700 font-mono">
        ${result.price.toLocaleString()} {result.currency}
      </div>
      <div className="text-xs text-gray-500 mt-2">
        Updated: {new Date(result.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
```

### 3\. Frontend: Chat Interface (`app/page.tsx`)

This component handles the rendering logic. It iterates through message `parts` to decide whether to render text, a tool, or a reasoning block.

```tsx
'use client';

import { useChat } from 'ai/react';
import { CryptoPriceCard } from '@/components/tools/crypto-card';
import { useState } from 'react';

export default function Page() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto py-24 px-4 h-screen">
      <div className="flex-1 space-y-6 overflow-y-auto mb-4">
        {messages.map((message) => (
          <div key={message.id} className="flex flex-col gap-2">
            <div className="font-bold text-sm text-gray-500 uppercase">
              {message.role}
            </div>

            {/* Render distinct parts of the message */}
            <div className="space-y-4">
              {message.parts?.map((part, index) => {
                switch (part.type) {
                  // A. Render Reasoning (Think Blocks)
                  case 'reasoning':
                    return (
                      <ReasoningBlock key={index} content={part.text} />
                    );

                  // B. Render Text
                  case 'text':
                    return (
                      <div key={index} className="whitespace-pre-wrap">
                        {part.text}
                      </div>
                    );

                  // C. Render Tools (Generative UI)
                  case 'tool-invocation':
                    const toolCallId = part.toolInvocation.toolCallId;
                    
                    // Handle specific tools
                    if (part.toolInvocation.toolName === 'getCryptoPrice') {
                      return (
                        <CryptoPriceCard
                          key={toolCallId}
                          state={part.toolInvocation.state} // 'partial-call', 'call', 'result'
                          args={part.toolInvocation.args}
                          result={'result' in part.toolInvocation ? part.toolInvocation.result : null}
                        />
                      );
                    }
                    return <div key={toolCallId}>Tool: {part.toolInvocation.toolName}</div>;
                }
              })}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="flex-1 p-3 border rounded-lg bg-gray-100 dark:bg-zinc-800"
          value={input}
          placeholder="Ask about crypto prices..."
          onChange={handleInputChange}
        />
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">
          Send
        </button>
      </form>
    </div>
  );
}

// Helper component for collapsible reasoning
function ReasoningBlock({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!content) return null; // Don't render empty thinking

  return (
    <div className="border-l-2 border-gray-300 pl-4 my-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-gray-500 hover:underline mb-1 flex items-center gap-1"
      >
        {isOpen ? '▼' : '▶'} Thought Process
      </button>
      
      {isOpen && (
        <div className="text-sm text-gray-500 italic bg-gray-50 p-2 rounded">
          {content}
        </div>
      )}
    </div>
  );
}
```

### Key Concepts Explained

  * **Streaming Tool Calls (`experimental_toolCallStreaming`)**:
    In standard tool usage, the UI waits for the entire tool argument JSON to generate before showing anything. With streaming enabled, `part.toolInvocation.args` updates in real-time. This is why we check `state !== 'result'` in the `CryptoPriceCard` to show a live "Thinking..." or "Checking price for BT..." state.

  * **Reasoning Middleware (`extractReasoningMiddleware`)**:
    Many new models (like DeepSeek R1) output a `<think>` block before their final answer. The SDK middleware detects these tags, strips them from the main `text` part, and creates a separate `reasoning` part. This allows you to render the thought process cleanly (e.g., in a collapsible detail view) without cluttering the main response.

  * **Message Parts**:
    Instead of just rendering `message.content`, we iterate over `message.parts`. This is the unified way to handle multi-modal responses where a single message might contain:

    1.  A reasoning block.
    2.  A text block ("Sure, here is that price...").
    3.  A tool invocation (The actual Crypto Card).
    4.  Another text block ("Hope that helps\!").
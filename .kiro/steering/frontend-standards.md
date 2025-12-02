---
inclusion: fileMatch
fileMatchPattern: '*.tsx|*.jsx|components/**/*|hooks/**/*'
---

# Frontend Development Standards

## React 19 Patterns

This project uses React 19. Leverage its features appropriately:

### Automatic Batching
React 19 automatically batches state updates. Trust it:
```typescript
// These are automatically batched in React 19
setCount(count + 1);
setName('new name');
setIsLoading(false);
// Only one re-render occurs
```

### Hooks Best Practices

#### useState
```typescript
// Prefer specific state types
const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);

// Use functional updates for state depending on previous value
setMessages(prev => [...prev, newMessage]);
```

#### useCallback
```typescript
// Memoize handlers passed to children or used in effects
const handleElementSelect = useCallback((selector: string, reasoning?: string) => {
  // Handler logic
}, [/* dependencies */]);
```

#### useMemo
```typescript
// Memoize expensive computations
const filteredMessages = useMemo(() => {
  return messages.filter(m => m.role !== 'system');
}, [messages]);
```

#### useRef
```typescript
// DOM references
const webviewRef = useRef<HTMLWebViewElement>(null);

// Mutable values that don't trigger re-renders
const audioContextRef = useRef<AudioContext | null>(null);
```

#### useEffect
```typescript
// Always cleanup resources
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe();
}, [subscribe]);

// Avoid missing dependencies - ESLint will warn
useEffect(() => {
  doSomething(value);
}, [value]); // Include all dependencies
```

## Component Patterns

### Component File Structure
```typescript
// 1. Imports
import React, { useState, useCallback } from 'react';
import { SomeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 2. Types/Interfaces
interface MyComponentProps {
  title: string;
  onAction?: (id: string) => void;
}

// 3. Helper functions (if small and component-specific)
const formatValue = (value: number): string => value.toFixed(2);

// 4. Component
export function MyComponent({ title, onAction }: MyComponentProps) {
  // Hooks
  // Derived state
  // Handlers
  // Effects
  // Return JSX
}

// 5. Default export (if needed)
export default MyComponent;
```

### Conditional Rendering
```typescript
// Prefer ternary for simple conditions
{isLoading ? <Loader /> : <Content />}

// Use && for showing/hiding
{hasError && <ErrorMessage error={error} />}

// Use early returns for complex conditions
if (!data) return <Loading />;
if (error) return <Error error={error} />;
return <DataDisplay data={data} />;
```

### Event Handlers
```typescript
// Name handlers with 'handle' prefix
const handleClick = () => {};
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  // ...
};

// Pass handlers as props with 'on' prefix
<Button onClick={handleClick} onHover={handleHover} />
```

## TypeScript Integration

### Type Definitions
```typescript
// Export interfaces for reuse
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// Use discriminated unions for variants
type ToolPart =
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown };
```

### Props Typing
```typescript
// Use interface for props
interface ButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
}

// Extend HTML element props when wrapping
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
}
```

### Event Types
```typescript
// Common event types
onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
```

## Styling Guidelines

### Tailwind CSS
This project uses Tailwind CSS for styling:

```typescript
// Use cn() utility for conditional classes
import { cn } from '@/lib/utils';

<div className={cn(
  'base-classes',
  isActive && 'active-classes',
  variant === 'primary' && 'primary-classes'
)} />
```

### Component Variants
Use class-variance-authority for component variants:
```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        outline: 'border border-input bg-background',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);
```

### Z-Index Management
Follow this z-index hierarchy:
```
Widget grid:       z-index: 1
Inactive widgets:  z-index: 40
Active widgets:    z-index: 50
Modals/Dialogs:    z-index: 100
HAL lens:          z-index: 100000
Camera overlay:    z-index: 100001
```

**Key Lesson:** Z-index on children is meaningless if parent doesn't have z-index. Always check the full parent chain for stacking context issues.

## UI Components (shadcn/ui)

### Available Components
Located in `components/ui/`:
- `button.tsx` - Button with variants
- `badge.tsx` - Status badges
- `tooltip.tsx` - Hover tooltips
- `collapsible.tsx` - Expandable sections
- `separator.tsx` - Visual dividers
- `carousel.tsx` - Image/content carousel
- `hover-card.tsx` - Hover preview cards
- `alert.tsx` - Alert messages
- `button-group.tsx` - Grouped buttons

### AI-Specific Components
Located in `components/ai-elements/`:
- `message.tsx` - Chat message display
- `tool.tsx` - Tool call visualization
- `reasoning.tsx` - AI thinking display
- `code-block.tsx` - Syntax highlighted code
- `checkpoint.tsx` - Progress checkpoints
- `confirmation.tsx` - User confirmations
- `shimmer.tsx` - Loading shimmer effect

### Usage Pattern
```typescript
import { Button } from '@/components/ui/button';
import { Tool, ToolContent, ToolHeader, ToolOutput } from '@/components/ai-elements/tool';

// UI components
<Button variant="outline" size="sm" onClick={handleClick}>
  <Icon className="w-4 h-4 mr-2" />
  Button Text
</Button>

// AI components
<Tool status="complete">
  <ToolHeader name="read_file" status="complete" />
  <ToolContent>{/* tool args */}</ToolContent>
  <ToolOutput>{/* result */}</ToolOutput>
</Tool>
```

## Icons

Use lucide-react for icons:
```typescript
import { ChevronLeft, Send, Settings, Folder } from 'lucide-react';

// Standard sizing
<Send className="w-4 h-4" />    // Small
<Send className="w-5 h-5" />    // Medium
<Send className="w-6 h-6" />    // Large

// With button
<Button variant="ghost" size="sm">
  <Settings className="w-4 h-4" />
</Button>
```

## Performance Considerations

### Avoid Unnecessary Re-renders
```typescript
// Bad: Inline object creates new reference every render
<Child style={{ color: 'red' }} />

// Good: Memoize or define outside
const style = useMemo(() => ({ color: 'red' }), []);
<Child style={style} />
```

### List Rendering
```typescript
// Always use stable, unique keys
{messages.map(message => (
  <MessageItem key={message.id} message={message} />
))}

// Never use index as key for dynamic lists
// {items.map((item, index) => <Item key={index} />)} // BAD
```

### Media Cleanup
```typescript
// Always cleanup audio/video resources
useEffect(() => {
  const audioContext = new AudioContext();
  audioContextRef.current = audioContext;

  return () => {
    audioContext.close();
    audioContextRef.current = null;
  };
}, []);
```

#[[file:types.ts]]

---
inclusion: fileMatch
fileMatchPattern: 'tests/**/*|*.test.ts|*.spec.ts|vitest.config.ts'
---

# Testing Standards

## Testing Framework

This project uses **Vitest** with:
- **Test Environment**: jsdom (for DOM simulation)
- **Assertion Library**: Vitest built-in + `@testing-library/jest-dom`
- **Component Testing**: `@testing-library/react`
- **Coverage**: v8 provider

## Test File Structure

```
tests/
├── setup.ts                    # Global test setup
├── ai-sdk-wrapper.test.ts      # AI SDK wrapper tests
├── useAIChatV2.test.ts         # Chat hook tests
└── [component].test.ts         # Component tests
```

### Naming Conventions
- Test files: `[module].test.ts` or `[module].spec.ts`
- Test suites: `describe('[Module Name]', ...)`
- Test cases: `it('should [expected behavior]', ...)`

## Test Setup

### Global Setup (`tests/setup.ts`)
```typescript
import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

// Mock crypto for Node.js
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {
    randomUUID: () => Math.random().toString(36).substring(2, 15),
  } as Crypto;
}

// Mock fetch
globalThis.fetch = vi.fn();

// Mock Electron API
const mockElectronAPI = {
  aiSdk: {
    initialize: vi.fn().mockResolvedValue({ success: true }),
    stream: vi.fn().mockResolvedValue({ success: true, requestId: 'test-id' }),
    // ... more mocks
  },
  isElectron: true,
};

// Inject into window
window.electronAPI = mockElectronAPI;

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

export { mockElectronAPI };
```

## Writing Tests

### Basic Test Structure
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ModuleName', () => {
  beforeEach(() => {
    // Setup for each test
  });

  describe('functionName', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      expect(() => functionName(null)).toThrow('Error message');
    });
  });
});
```

### Async Tests
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toEqual({ success: true });
});

it('should handle async errors', async () => {
  await expect(failingAsyncFunction()).rejects.toThrow('Error');
});
```

### Mocking

#### Function Mocks
```typescript
import { vi } from 'vitest';

// Create mock function
const mockFn = vi.fn();
mockFn.mockReturnValue('value');
mockFn.mockResolvedValue('async value');
mockFn.mockRejectedValue(new Error('error'));

// Spy on existing function
const spy = vi.spyOn(object, 'method');
spy.mockImplementation(() => 'mocked');
```

#### Module Mocks
```typescript
// Mock entire module
vi.mock('./utils/audio', () => ({
  pcmToBase64: vi.fn().mockReturnValue('base64'),
  base64ToPCM: vi.fn().mockReturnValue(new Int16Array()),
}));

// Mock with partial implementation
vi.mock('./hooks/useElectronAPI', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getElectronAPI: vi.fn().mockReturnValue(mockElectronAPI),
  };
});
```

### Testing React Hooks
```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAIChatV2 } from '../hooks/useAIChatV2';

describe('useAIChatV2', () => {
  it('should initialize with empty messages', () => {
    const { result } = renderHook(() => useAIChatV2({}));

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should send message and update state', async () => {
    const { result } = renderHook(() => useAIChatV2({}));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });
  });
});
```

### Testing React Components
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDisabled();
  });
});
```

## Test Categories

### Unit Tests
Test individual functions and modules in isolation:
```typescript
describe('utils/audio', () => {
  it('should convert Float32 to Int16', () => {
    const float32 = new Float32Array([0.5, -0.5]);
    const int16 = float32ToInt16(float32);

    expect(int16[0]).toBe(16383);  // 0.5 * 32767
    expect(int16[1]).toBe(-16383);
  });
});
```

### Integration Tests
Test interactions between modules:
```typescript
describe('AI SDK Integration', () => {
  it('should stream response through IPC', async () => {
    // Setup mock IPC
    mockElectronAPI.aiSdk.stream.mockImplementation(() => {
      // Simulate streaming events
      setTimeout(() => emitTextChunk('Hello'), 10);
      setTimeout(() => emitFinish(), 20);
      return { success: true, requestId: 'test' };
    });

    const { result } = renderHook(() => useAIChatV2({}));

    await act(async () => {
      await result.current.sendMessage('Hi');
    });

    await waitFor(() => {
      expect(result.current.messages[1].content).toContain('Hello');
    });
  });
});
```

### E2E Tests (Future)
Consider Playwright for end-to-end testing:
```typescript
// Not currently implemented
// See: https://playwright.dev/docs/test-electron
```

## Coverage Requirements

### Current Configuration
```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: [
    'electron/ai-sdk-wrapper.cjs',
    'hooks/useAIChatV2.ts'
  ],
}
```

### Running Coverage
```bash
npm run test:coverage
```

Coverage reports output to:
- Terminal: Summary text
- `coverage/`: HTML report

### Target Coverage
- **Lines**: 80%+ for critical paths
- **Branches**: 70%+ for conditionals
- **Functions**: 80%+ for public APIs

## Best Practices

### Do
- Write tests alongside code changes
- Test both happy path and error cases
- Mock external dependencies (APIs, filesystem)
- Use descriptive test names that explain the scenario
- Keep tests focused and independent

### Don't
- Test implementation details (test behavior, not internals)
- Share state between tests
- Make tests dependent on test execution order
- Over-mock (test real integrations where practical)

### Test Organization
```typescript
describe('ComponentName', () => {
  // 1. Setup shared between tests
  let mockProps;

  beforeEach(() => {
    mockProps = { /* default props */ };
  });

  // 2. Group related tests
  describe('rendering', () => {
    it('should render correctly with default props', () => {});
    it('should render loading state', () => {});
  });

  describe('interactions', () => {
    it('should handle click events', () => {});
    it('should handle keyboard navigation', () => {});
  });

  describe('error handling', () => {
    it('should display error message', () => {});
    it('should retry on error', () => {});
  });
});
```

## Running Tests

### Commands
```bash
# Run all tests once
npm run test

# Watch mode (re-run on changes)
npm run test:watch

# With coverage
npm run test:coverage

# Run specific test file
npx vitest run tests/ai-sdk-wrapper.test.ts

# Run tests matching pattern
npx vitest run --grep "should stream"
```

### CI Integration
Tests should pass before merge:
```yaml
# Example GitHub Actions
- name: Run tests
  run: npm run test

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

#[[file:vitest.config.ts]]
#[[file:tests/setup.ts]]

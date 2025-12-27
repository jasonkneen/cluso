# Contributing to Cluso

Thank you for your interest in contributing to Cluso! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Areas Needing Help](#areas-needing-help)

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## Getting Started

### Prerequisites

- **Node.js** 18+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- **npm** for package management
- **Electron** (installed automatically via npm)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/jasonkneen/cluso.git
   cd flows/cluso/ai-cluso
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**

   **Electron (desktop):**
   ```bash
   npm run electron:dev
   ```

   **Web (browser):**
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

4. **Run tests**
   ```bash
   npm run test
   ```

## Project Structure

```
ai-cluso/
├── src/           # React frontend
├── electron/      # Electron backend
├── packages/      # Workspace packages
│   ├── fast-apply/        # Fast code editing
│   ├── mgrep-local/       # Local code search
│   ├── shared-audio/      # Audio utilities
│   ├── shared-inspector/  # Element inspector
│   ├── shared-tools/      # Shared utilities
│   └── shared-types/      # TypeScript types
├── bin/           # CLI executables
└── public/        # Static assets
```

## Making Changes

### Branch Naming

- `feature/` - New features (e.g., `feature/code-inspector`)
- `fix/` - Bug fixes (e.g., `fix/selector-overlay`)
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add element move mode
fix: resolve overlay cleanup issue
docs: update installation guide
refactor: extract inspector logic
test: add selector tests
```

## Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** with clear, focused commits
3. **Run tests** - `npm run test`
4. **Build the app** - `npm run build`
5. **Update documentation** if needed
6. **Submit PR** with clear description

### PR Requirements

- [ ] Tests pass (`npm run test`)
- [ ] TypeScript compiles (`npm run build`)
- [ ] Electron app runs (`npm run electron:dev`)
- [ ] Documentation updated (if applicable)
- [ ] PR description explains changes

## Coding Standards

### TypeScript

- Use explicit return types on functions
- Avoid `any` - use proper types or `unknown`
- Use interfaces for object shapes
- Document complex logic with comments

### React

- Functional components with hooks
- Keep components under 500 lines
- Extract reusable logic to custom hooks
- Use React Context for shared state

### Styling

- Tailwind CSS for styling
- Use existing design tokens
- Follow existing component patterns

### File Organization

```typescript
// 1. External imports
import React, { useState, useEffect } from 'react'

// 2. Internal imports
import { useAgent } from '@/contexts/AgentContext'

// 3. Type definitions
interface Props {
  // ...
}

// 4. Component
export function MyComponent({ ...props }: Props) {
  // ...
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npx vitest run tests/file-name.test.ts
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from './myModule'

describe('myFunction', () => {
  it('returns expected result', () => {
    expect(myFunction('input')).toBe('expected')
  })
})
```

## Areas Needing Help

### High Priority

- **Testing** - Improve test coverage
- **Documentation** - Improve inline docs and guides
- **Accessibility** - WCAG compliance improvements
- **Performance** - Optimize rendering and memory usage

### Good First Issues

Look for issues labeled `good-first-issue` in the GitHub issue tracker. These are specifically selected for new contributors.

## Questions?

- **GitHub Issues** - For bugs and feature requests
- **Discussions** - For questions and ideas

## License

By contributing, you agree that your contributions will be licensed under the project's [AGPL-3.0 + Commons Clause](../LICENSE) license.

---

Thank you for contributing to Cluso!

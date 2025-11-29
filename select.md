Directory structure:
└── aidenybai-react-grab/
    ├── README.md
    ├── AGENTS.md
    ├── LICENSE
    ├── package.json
    ├── pnpm-workspace.yaml
    ├── vercel.json
    ├── .cursorignore
    ├── .prettierrc
    ├── packages/
    │   ├── benchmarks/
    │   │   ├── README.md
    │   │   ├── claude-code.ts
    │   │   ├── index.html
    │   │   ├── index.ts
    │   │   ├── package.json
    │   │   ├── results.json
    │   │   ├── test-cases.json
    │   │   ├── test-cases.ts
    │   │   ├── vite.config.ts
    │   │   ├── public/
    │   │   │   ├── results.json
    │   │   │   └── test-cases.json
    │   │   └── shadcn-dashboard/
    │   │       ├── README.md
    │   │       ├── components.json
    │   │       ├── eslint.config.mjs
    │   │       ├── instrumentation-client.ts
    │   │       ├── next.config.ts
    │   │       ├── package.json
    │   │       ├── postcss.config.mjs
    │   │       ├── tsconfig.json
    │   │       ├── app/
    │   │       │   ├── globals.css
    │   │       │   ├── layout.tsx
    │   │       │   ├── page.tsx
    │   │       │   ├── dashboard/
    │   │       │   │   ├── data.json
    │   │       │   │   └── page.tsx
    │   │       │   ├── login/
    │   │       │   │   └── page.tsx
    │   │       │   ├── otp/
    │   │       │   │   └── page.tsx
    │   │       │   └── signup/
    │   │       │       └── page.tsx
    │   │       ├── components/
    │   │       │   ├── app-sidebar.tsx
    │   │       │   ├── calendar-01.tsx
    │   │       │   ├── chart-area-interactive.tsx
    │   │       │   ├── data-table.tsx
    │   │       │   ├── login-form.tsx
    │   │       │   ├── nav-documents.tsx
    │   │       │   ├── nav-main.tsx
    │   │       │   ├── nav-projects.tsx
    │   │       │   ├── nav-secondary.tsx
    │   │       │   ├── nav-user.tsx
    │   │       │   ├── otp-form.tsx
    │   │       │   ├── section-cards.tsx
    │   │       │   ├── signup-form.tsx
    │   │       │   ├── site-header.tsx
    │   │       │   ├── team-switcher.tsx
    │   │       │   └── ui/
    │   │       │       ├── avatar.tsx
    │   │       │       ├── badge.tsx
    │   │       │       ├── breadcrumb.tsx
    │   │       │       ├── button.tsx
    │   │       │       ├── calendar.tsx
    │   │       │       ├── card.tsx
    │   │       │       ├── chart.tsx
    │   │       │       ├── checkbox.tsx
    │   │       │       ├── collapsible.tsx
    │   │       │       ├── drawer.tsx
    │   │       │       ├── dropdown-menu.tsx
    │   │       │       ├── field.tsx
    │   │       │       ├── input-otp.tsx
    │   │       │       ├── input.tsx
    │   │       │       ├── label.tsx
    │   │       │       ├── select.tsx
    │   │       │       ├── separator.tsx
    │   │       │       ├── sheet.tsx
    │   │       │       ├── sidebar.tsx
    │   │       │       ├── skeleton.tsx
    │   │       │       ├── sonner.tsx
    │   │       │       ├── table.tsx
    │   │       │       ├── tabs.tsx
    │   │       │       ├── toggle-group.tsx
    │   │       │       ├── toggle.tsx
    │   │       │       └── tooltip.tsx
    │   │       ├── hooks/
    │   │       │   └── use-mobile.ts
    │   │       └── lib/
    │   │           └── utils.ts
    │   ├── next-playground/
    │   │   ├── instrumentation-client.ts
    │   │   ├── next.config.ts
    │   │   ├── package.json
    │   │   ├── postcss.config.mjs
    │   │   ├── tsconfig.json
    │   │   ├── app/
    │   │   │   ├── globals.css
    │   │   │   ├── layout.tsx
    │   │   │   └── page.tsx
    │   │   └── components/
    │   │       ├── cn.tsx
    │   │       ├── todo-item.tsx
    │   │       └── todo-list.tsx
    │   ├── react-grab/
    │   │   ├── README.md
    │   │   ├── CHANGELOG.md
    │   │   ├── eslint.config.js
    │   │   ├── package.json
    │   │   ├── tsconfig.json
    │   │   ├── tsup.config.ts
    │   │   └── src/
    │   │       ├── constants.ts
    │   │       ├── index.ts
    │   │       ├── instrumentation.ts
    │   │       ├── styles.css
    │   │       ├── theme.ts
    │   │       ├── types.ts
    │   │       ├── components/
    │   │       │   ├── crosshair.tsx
    │   │       │   ├── icon-copy.tsx
    │   │       │   ├── icon-open.tsx
    │   │       │   ├── icon-toggle.tsx
    │   │       │   ├── input-overlay.tsx
    │   │       │   ├── label.tsx
    │   │       │   ├── renderer.tsx
    │   │       │   ├── selection-box.tsx
    │   │       │   └── spinner.tsx
    │   │       ├── hooks/
    │   │       │   ├── use-animated-lerp.ts
    │   │       │   └── use-fade-in-out.ts
    │   │       └── utils/
    │   │           ├── build-open-file-url.ts
    │   │           ├── cn.ts
    │   │           ├── copy-content.ts
    │   │           ├── create-element-bounds.ts
    │   │           ├── get-clamped-element-position.ts
    │   │           ├── get-cursor-quadrants.ts
    │   │           ├── get-element-at-position.ts
    │   │           ├── get-elements-in-drag.ts
    │   │           ├── hotkey.ts
    │   │           ├── is-c-like-key.ts
    │   │           ├── is-capitalized.ts
    │   │           ├── is-element-visible.ts
    │   │           ├── is-event-from-overlay.ts
    │   │           ├── is-keyboard-event-triggered-by-input.ts
    │   │           ├── is-valid-grabbable-element.ts
    │   │           ├── lerp.ts
    │   │           ├── mount-root.ts
    │   │           ├── normalize-key-to-c.ts
    │   │           ├── strip-translate-from-transform.ts
    │   │           └── strip-turbopack-project-prefix.ts
    │   ├── vite-playground/
    │   │   ├── index.html
    │   │   ├── package.json
    │   │   ├── tsconfig.json
    │   │   ├── tsconfig.node.json
    │   │   ├── vite.config.ts
    │   │   └── src/
    │   │       ├── App.tsx
    │   │       ├── index.css
    │   │       └── main.tsx
    │   ├── web-extension/
    │   │   ├── package.json
    │   │   ├── tsconfig.json
    │   │   ├── vite.config.ts
    │   │   ├── scripts/
    │   │   │   └── package.sh
    │   │   └── src/
    │   │       ├── manifest.json
    │   │       ├── background/
    │   │       │   └── service-worker.ts
    │   │       └── content/
    │   │           └── react-grab.ts
    │   └── website/
    │       ├── eslint.config.mjs
    │       ├── instrumentation-client.ts
    │       ├── next.config.ts
    │       ├── package.json
    │       ├── postcss.config.mjs
    │       ├── tsconfig.json
    │       ├── app/
    │       │   ├── globals.css
    │       │   ├── layout.tsx
    │       │   ├── page.tsx
    │       │   ├── api/
    │       │   │   ├── og/
    │       │   │   │   └── route.tsx
    │       │   │   └── version/
    │       │   │       └── route.ts
    │       │   ├── blog/
    │       │   │   ├── layout.tsx
    │       │   │   ├── page.tsx
    │       │   │   ├── bets/
    │       │   │   │   ├── layout.tsx
    │       │   │   │   └── page.tsx
    │       │   │   └── intro/
    │       │   │       ├── layout.tsx
    │       │   │       └── page.tsx
    │       │   ├── open-file/
    │       │   │   ├── layout.tsx
    │       │   │   └── page.tsx
    │       │   └── privacy/
    │       │       └── page.tsx
    │       ├── components/
    │       │   ├── benchmark-tooltip.tsx
    │       │   ├── code.tsx
    │       │   ├── collapsible.tsx
    │       │   ├── cursor-install-button.tsx
    │       │   ├── demo-footer.tsx
    │       │   ├── github-button.tsx
    │       │   ├── grab-element-button.tsx
    │       │   ├── hotkey-context.tsx
    │       │   ├── icon-claude.tsx
    │       │   ├── icon-copilot.tsx
    │       │   ├── icon-cursor.tsx
    │       │   ├── icon-github.tsx
    │       │   ├── install-tabs.tsx
    │       │   ├── react-grab-logo.tsx
    │       │   ├── scrollable.tsx
    │       │   ├── stream-demo.tsx
    │       │   ├── timer.tsx
    │       │   ├── user-message.tsx
    │       │   ├── benchmarks/
    │       │   │   ├── benchmark-charts.tsx
    │       │   │   ├── benchmark-detailed-table.tsx
    │       │   │   ├── types.ts
    │       │   │   └── utils.ts
    │       │   ├── blocks/
    │       │   │   ├── code-block.tsx
    │       │   │   ├── grep-tool-call-block.tsx
    │       │   │   ├── message-block.tsx
    │       │   │   ├── read-tool-call-block.tsx
    │       │   │   ├── streaming-text.tsx
    │       │   │   ├── thought-block.tsx
    │       │   │   └── tool-calls-block.tsx
    │       │   └── icons/
    │       │       ├── icon-vscode.tsx
    │       │       ├── icon-webstorm.tsx
    │       │       ├── icon-zed.tsx
    │       │       └── index.ts
    │       ├── hooks/
    │       │   └── use-stream.ts
    │       ├── lib/
    │       │   └── shiki.ts
    │       ├── public/
    │       │   ├── llms.txt
    │       │   ├── results-old.json
    │       │   ├── results.json
    │       │   └── test-cases.json
    │       └── utils/
    │           ├── classnames.ts
    │           ├── detect-mobile.ts
    │           └── get-key-from-code.ts
    └── .changeset/
        ├── README.md
        └── config.json


Files Content:

(Files content cropped to 300k characters, download full ingest to see more)
================================================
FILE: README.md
================================================
# <img src="https://github.com/aidenybai/react-grab/blob/main/.github/public/logo.png?raw=true" width="60" align="center" /> React Grab

[![size](https://img.shields.io/bundlephobia/minzip/react-grab?label=gzip&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/package/react-grab)
[![version](https://img.shields.io/npm/v/react-grab?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/react-grab)
[![downloads](https://img.shields.io/npm/dt/react-grab.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/react-grab)

React Grab allows you to select an element and copy its context (like HTML, React component, and file source)

It makes tools like Cursor, Claude Code, Copilot run up to [**55% faster**](https://react-grab.com/blog/intro)

### [Try out a demo! →](https://react-grab.com)

![Demo](https://react-grab.com/demo.gif)

## Install

> [**Install using Cursor**](https://cursor.com/link/prompt?text=1.+Run+curl+-s+https%3A%2F%2Freact-grab.com%2Fllms.txt+%0A2.+Understand+the+content+and+follow+the+instructions+to+install+React+Grab.%0A3.+Tell+the+user+to+refresh+their+local+app+and+explain+how+to+use+React+Grab)

Get started in 1 minute by adding this script tag to your app:

```html
<script
  src="//www.react-grab.com/script.js"
  crossorigin="anonymous"
></script>
```

If you're using a React framework or build tool, view instructions below:

#### Next.js (App router)

Add this inside of your `app/layout.tsx`:

```jsx
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {/* put this in the <head> */}
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        {/* rest of your scripts go under */}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

#### Next.js (Pages router)

Add this into your `pages/_document.tsx`:

```jsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* put this in the <Head> */}
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        {/* rest of your scripts go under */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

#### Vite

Your `index.html` could look like this:

```html
<!doctype html>
<html lang="en">
  <head>
    <script type="module">
      // first npm i react-grab
      // then in head:
      if (import.meta.env.DEV) {
        import("react-grab");
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### Webpack

First, install React Grab:

```bash
npm install react-grab
```

Then add this at the top of your main entry file (e.g., `src/index.tsx` or `src/main.tsx`):

```tsx
if (process.env.NODE_ENV === "development") {
  import("react-grab");
}
```

## Extending React Grab

React Grab provides an public customization API. Check out the [type definitions](https://github.com/aidenybai/react-grab/blob/main/packages/react-grab/src/types.ts) to see all available options for extending React Grab.

```typescript
import { init } from "react-grab/core";

const api = init({
  theme: {
    enabled: true, // disable all UI by setting to false
    hue: 180, // shift colors by 180 degrees (pink → cyan/turquoise)
    crosshair: {
      enabled: false, // disable crosshair
    },
    elementLabel: {
      // when hovering over an element
      backgroundColor: "#000000",
      textColor: "#ffffff",
    },
  },

  onElementSelect: (element) => {
    console.log("Selected:", element);
  },
  onCopySuccess: (elements, content) => {
    console.log("Copied to clipboard:", content);
  },
  onStateChange: (state) => {
    console.log("Active:", state.isActive);
  },
});

api.activate();
api.copyElement(document.querySelector(".my-element"));
console.log(api.getState());
```

## Resources & Contributing Back

Want to try it out? Check the [our demo](https://react-grab.com).

Looking to contribute back? Check the [Contributing Guide](https://github.com/aidenybai/react-grab/blob/main/CONTRIBUTING.md) out.

Want to talk to the community? Hop in our [Discord](https://discord.com/invite/G7zxfUzkm7) and share your ideas and what you've build with React Grab.

Find a bug? Head over to our [issue tracker](https://github.com/aidenybai/react-grab/issues) and we'll do our best to help. We love pull requests, too!

We expect all contributors to abide by the terms of our [Code of Conduct](https://github.com/aidenybai/react-grab/blob/main/.github/CODE_OF_CONDUCT.md).

[**→ Start contributing on GitHub**](https://github.com/aidenybai/react-grab/blob/main/CONTRIBUTING.md)

### License

React Grab is MIT-licensed open-source software.



================================================
FILE: AGENTS.md
================================================
- MUST: We use @antfu/ni. Use `ni` to install, `nr SCRIPT_NAME` to run script, `nun` to uninstall package
- MUST: Use TypeScript interfaces over types
- MUST: Use arrow functions over function declarations
- NEVER comment unless absolutely necessary.
  - If it is a hack, such as a setTimeout or potentially confusing code, it should be prefixed with // HACK: reason for hack
- MUST: Use kebab-case for files
- MUST: Use descriptive names for variables (avoid shorthands, or 1-2 character names).
  - Example: for .map(), you can use `innerX` instead of `x`
  - Example: instead of `moved` use `didPositionChange`
- MUST: Do not type cast ("as") unless absolutely necessary
- MUST: Keep interfaces or types on the global scope.
- MUST: Remove unused code and don't repeat yourself.



================================================
FILE: LICENSE
================================================
MIT License

Copyright (c) 2025 Aiden Bai

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.



================================================
FILE: package.json
================================================
{
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm --filter react-grab build",
    "dev": "pnpm --filter react-grab dev",
    "lint": "pnpm --filter react-grab lint",
    "lint:fix": "pnpm --filter react-grab lint:fix",
    "format": "prettier --write .",
    "check": "pnpm --filter react-grab check",
    "changeset": "changeset",
    "version": "changeset version",
    "prebump": "cp README.md packages/react-grab/README.md",
    "bump": "changeset && changeset version",
    "release": "pnpm build && changeset publish",
    "extension:dev": "pnpm --filter web-extension dev",
    "extension:build": "pnpm --filter web-extension build"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.10",
    "prettier": "^3.4.2"
  },
  "engines": {
    "node": ">=18",
    "pnpm": ">=8"
  }
}



================================================
FILE: pnpm-workspace.yaml
================================================
packages:
  - "packages/*"
  - "packages/benchmarks/next-app"



================================================
FILE: vercel.json
================================================
{
  "buildCommand": "pnpm --filter react-grab build && pnpm --filter react-grab exec cp dist/index.global.js ../website/public/script.js && pnpm --filter @react-grab/website build",
  "installCommand": "pnpm install",
  "headers": [
    {
      "source": "/api/version",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET,OPTIONS,PATCH,DELETE,POST,PUT"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
        }
      ]
    }
  ]
}



================================================
FILE: .cursorignore
================================================
packages/benchmarks/next-app



================================================
FILE: .prettierrc
================================================
{
  "tabWidth": 2,
  "singleQuote": false,
  "printWidth": 80
}



================================================
FILE: packages/benchmarks/README.md
================================================
# React Grab Benchmarks

This directory contains the benchmark suite used to measure React Grab's impact on coding agent performance. The benchmark compares control (without React Grab) vs treatment (with React Grab) groups across 20 test cases.

## Overview

The benchmark uses the [shadcn/ui dashboard](https://github.com/shadcn-ui/ui) as the test codebase - a Next.js application with auth, data tables, charts, and form components. Each test case represents a real-world task that developers commonly perform when working with coding agents.

Each test runs twice:
- **Control**: Without React Grab output (agent must search the codebase)
- **Treatment**: With React Grab output (agent receives exact component stack)

The benchmark measures:
- Time to completion (`durationMs`)
- Number of tool calls (`toolCalls`)
- Token usage (`inputTokens`, `outputTokens`, `totalTokens`)
- Cost (`costUsd`)
- Success rate (whether the agent found the correct file)

## Prerequisites

- Node.js >= 18
- pnpm >= 8
- An Anthropic API key with access to Claude Code

## Setup

1. Install dependencies from the repository root:

```bash
pnpm install
```

2. Set up your Anthropic API key:

The benchmark uses the `ANTHROPIC_API_KEY` environment variable. Set it before running:

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

Or create a `.env` file in this directory:

```
ANTHROPIC_API_KEY=your-api-key-here
```

## Running the Benchmark

From the repository root, navigate to the benchmarks directory:

```bash
cd packages/benchmarks
```

Run the benchmark using bun (bun can run TypeScript files directly):

```bash
bun index.ts
```

The benchmark will:
1. Generate `test-cases.json` from the test cases
2. Run all 40 tests (20 control + 20 treatment) in batches of 5
3. Save results incrementally to `results.json`
4. Display progress in the terminal

## Output

Results are written to `results.json` in the benchmarks directory. Each result includes:

```json
{
  "testName": "Forgot Password Link",
  "type": "control",
  "inputTokens": 12345,
  "outputTokens": 234,
  "totalTokens": 12579,
  "costUsd": 0.012,
  "durationMs": 13600,
  "toolCalls": 5,
  "success": true
}
```

## Test Cases

The benchmark includes 20 test cases covering various UI element retrieval scenarios:

- Form elements (inputs, buttons, links)
- Navigation components
- Data table elements
- Chart components
- Layout components
- Authentication flows

See [`test-cases.json`](./test-cases.json) for the full list of test cases and their prompts.

## Cost Considerations

Running the full benchmark suite (40 tests) will incur API costs. Each test uses:
- Claude Code Sonnet for the main task
- Claude Haiku 4.5 for result grading

Estimated cost per full run: ~$0.50-1.00 USD (varies based on codebase size and API pricing).

## Customization

You can modify the benchmark by:

1. **Adding test cases**: Edit `test-cases.ts` to add new test scenarios
2. **Changing batch size**: Modify `BATCH_SIZE` in `index.ts` (default: 5)
3. **Using a different codebase**: Update `TARGET_ENVIRONMENT_DIR` in `index.ts`
4. **Changing the model**: Modify the model in `claude-code.ts` (currently uses `claudeCode("sonnet")`)

## Troubleshooting

**Error: Provider metadata not found**
- Ensure you have a valid Anthropic API key set
- Check that you have access to Claude Code API

**Tests failing**
- Verify the `shadcn-dashboard` directory exists and is properly set up
- Check that the expected files in test cases match the actual codebase structure

**Out of memory errors**
- Reduce `BATCH_SIZE` in `index.ts` to run fewer tests concurrently

## Caveats & Future Improvements

There are several improvements that can be made to this benchmark:

- **Different codebases**: This benchmark uses the shadcn dashboard. It would be valuable to test with different frameworks, codebase sizes, and architectural patterns to see how React Grab performs across various scenarios.

- **Different agents/model providers**: Currently the benchmark only tests Claude Code. Testing with other coding agents (e.g., GitHub Copilot, Cursor, etc.) would provide a more comprehensive view of React Grab's impact.

- **Multiple trials and sampling**: Since agents are non-deterministic, running multiple trials per test case and averaging results would decrease variance and provide more reliable metrics.

- **Additional metrics**: Consider tracking more granular metrics like time to first tool call, search accuracy, or user satisfaction scores.

Pull requests are welcome! If you'd like to contribute improvements to the benchmark suite, please open an issue or submit a PR on [GitHub](https://github.com/aidenybai/react-grab).

## Results

The latest benchmark results are published on the [React Grab website](https://react-grab.com/blog/intro). The benchmark shows that React Grab makes coding agents approximately **55% faster** on average.



================================================
FILE: packages/benchmarks/claude-code.ts
================================================
import { generateText, streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { claudeCode } from "ai-sdk-provider-claude-code";

interface ProviderMetadata {
  "claude-code": {
    sessionId: string;
    costUsd: number;
    durationMs: number;
    rawUsage: {
      input_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
      output_tokens: number;
      server_tool_use: Record<string, unknown>;
      service_tier: string;
      cache_creation: Record<string, unknown>;
    };
  };
}

interface Usage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface ClaudeCodeTestResult {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  toolCalls: number;
  success: boolean;
}

interface Options {
  prompt: string;
  expectedFile: string;
  cwd: string;
}

export const runClaudeCodeTest = async (
  options: Options,
): Promise<ClaudeCodeTestResult> => {
  return new Promise(async (resolve, reject) => {
    const result = streamText({
      model: claudeCode("sonnet", {
        cwd: options.cwd,
      }),
      prompt: options.prompt,
      onChunk: async (chunk) => {},
      onFinish: async (args) => {
        if (!args.providerMetadata) {
          reject(new Error("Provider metadata not found"));
        }
        const providerMetadata =
          args.providerMetadata as unknown as ProviderMetadata;
        if (!args.usage) {
          reject(new Error("Usage not found"));
        }

        const { inputTokens, outputTokens } = args.usage as Usage;
        const { costUsd, durationMs } = providerMetadata["claude-code"];

        const graderResult = await generateText({
          model: anthropic("claude-haiku-4-5"),
          maxOutputTokens: 1,
          prompt: `Did the model find the file ${options.expectedFile} in the output?

IMPORTANT: ONLY RESPOND WITH "1" (for yes) or "0" (for no), NOTHING ELSE.

Output:

${args.text}`,
        });

        console.log(args.text);

        const usageResult: ClaudeCodeTestResult = {
          inputTokens,
          outputTokens,
          costUsd: costUsd,
          durationMs: durationMs,
          toolCalls: args.toolCalls.length,
          success:
            graderResult.text.includes("1") || !graderResult.text.includes("0"),
        };

        resolve(usageResult);
      },
    });
    // need to wait for the result to be resolved
    await result.text;
  });
};



================================================
FILE: packages/benchmarks/index.html
================================================
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Benchmark Results</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-neutral-950 text-neutral-100 antialiased">
    <div class="max-w-7xl mx-auto px-6 py-6">
      <div class="flex items-center gap-3 mb-2">
        <img src="/logo.svg" alt="React Grab" class="w-8 h-8" />
        <h1 class="text-2xl font-medium text-white">React Grab Benchmark</h1>
      </div>

      <div class="mb-6 p-4 bg-neutral-900 rounded-lg border border-neutral-800">
        <h2 class="text-sm font-medium text-neutral-200 mb-2">Methodology</h2>
        <p class="text-sm text-neutral-400 leading-relaxed">
          This benchmark evaluates React Grab's performance using the <a href="https://github.com/shadcn-ui/ui" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">shadcn/ui dashboard example</a>, a production-grade Next.js application with real-world complexity including multiple routes, form handling, data tables, charts, and authentication flows. We compare two scenarios: Control (without React Grab instrumentation) vs Treatment (with React Grab). This is a fair comparison because both scenarios use the same codebase, same prompts, and same AI model (Claude), with the only difference being whether React Grab's semantic element labeling is available. The benchmark measures success rate, token usage, cost, duration, and tool calls to quantify React Grab's impact on AI coding assistance efficiency.
        </p>
      </div>

      <div class="grid grid-cols-4 gap-4 mb-6" id="summary">
        <div>
          <h3
            class="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1"
          >
            Total Tests
          </h3>
          <p class="text-2xl font-semibold text-white" id="total-tests">-</p>
        </div>
        <div>
          <h3
            class="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1"
          >
            Success Rate
          </h3>
          <p class="text-2xl font-semibold text-white" id="success-rate">-</p>
        </div>
        <div>
          <h3
            class="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1"
          >
            Total Cost
          </h3>
          <p class="text-2xl font-semibold text-white" id="total-cost">-</p>
        </div>
        <div>
          <h3
            class="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1"
          >
            Total Duration
          </h3>
          <p class="text-2xl font-semibold text-white" id="total-duration">-</p>
        </div>
      </div>

      <div id="comparison" class="mb-6"></div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-neutral-800">
              <th
                rowspan="2"
                class="text-left py-2 px-3 text-xs font-medium text-neutral-300"
              >
                Test Name
              </th>
              <th
                colspan="2"
                class="text-left py-2 px-3 text-xs font-medium text-neutral-300"
              >
                Success
              </th>
              <th
                colspan="2"
                class="text-left py-2 px-3 text-xs font-medium text-neutral-300"
              >
                Input Tokens
              </th>
              <th
                colspan="2"
                class="text-left py-2 px-3 text-xs font-medium text-neutral-300"
              >
                Output Tokens
              </th>
              <th
                colspan="2"
                class="text-left py-2 px-3 text-xs font-medium text-neutral-300"
              >
                Cost
              </th>
              <th
                colspan="2"
                class="text-left py-2 px-3 text-xs font-medium text-neutral-300"
              >
                Duration
              </th>
              <th
                colspan="2"
                class="text-left py-2 px-3 text-xs font-medium text-neutral-300"
              >
                Tool Calls
              </th>
            </tr>
            <tr class="border-b border-neutral-800 bg-neutral-900">
              <th
                class="text-left py-1.5 px-3 text-xs font-normal text-neutral-400"
              >
                Control
              </th>
              <th
                class="text-left py-1.5 px-3 text-xs font-normal text-neutral-400 bg-neutral-800"
              >
                Treatment
              </th>
              <th
                class="text-left py-1.5 px-3 text-xs font-normal text-neutral-400"
              >
                Control
              </th>
              <th
                class="text-left py-1.5 px-3 text-xs font-normal text-neutral-400 bg-neutral-800"
              >
                Treatment
              </th>
              <th
                class="text-left py-1.5 px-3 text-xs font-normal text-neutral-400"
              >
                Control
              </th>
              <th
                class="text-left py-1.5 px-3 text-xs font-normal text-neutral-400 bg-neutral-800"
              >
                Treatment
              </th>
              <th
                class="text-left py-1.5 px-3 text-xs font-normal text-neutral-400"
              >
                Control
              </th>
              <th
                class="text-left py-1.5 px-3 text-xs font-normal text-neutral-400 bg-neutral-800"
              >
                Treatment
              </th>
              <th
                class="text-left py-1.5 px-3 text-xs font-normal text-neutral-400"
              >
                Control
              </th>
              <th
                class="text-left py-1.5 px-3 text-xs font-normal text-neutral-400 bg-neutral-800"
              >
                Treatment
              </th>
              <th
                class="text-left py-1.5 px-3 text-xs font-normal text-neutral-400"
              >
                Control
              </th>
              <th
                class="text-left py-1.5 px-3 text-xs font-normal text-neutral-400 bg-neutral-800"
              >
                Treatment
              </th>
            </tr>
          </thead>
          <tbody id="results-table"></tbody>
        </table>
      </div>
    </div>

    <script type="module">
      import prettyMs from "https://esm.sh/pretty-ms@9";

      let testCaseMap = {};

      async function loadResults() {
        try {
          const [resultsData, testCasesData] = await Promise.all([
            fetch("/results.json").then((r) => r.json()),
            fetch("/test-cases.json").then((r) => r.json()),
          ]);

          testCasesData.forEach((testCase) => {
            testCaseMap[testCase.name] = testCase.prompt;
          });

          displayResults(resultsData);
          displaySummary(resultsData);
          displayComparison(resultsData);
        } catch (error) {
          console.error("Error loading results:", error);
          document.getElementById("results-table").innerHTML =
            '<tr><td colspan="13" class="text-center py-8 text-red-400">Error loading results. Please check console.</td></tr>';
        }
      }

      function displayResults(data) {
        const tbody = document.getElementById("results-table");

        const groupedByTest = {};
        data.forEach((result) => {
          if (!groupedByTest[result.testName]) {
            groupedByTest[result.testName] = {};
          }
          groupedByTest[result.testName][result.type] = result;
        });

        tbody.innerHTML = Object.entries(groupedByTest)
          .map(([testName, results]) => {
            const control = results.control || {};
            const treatment = results.treatment || {};

            const calculateChange = (controlVal, treatmentVal) => {
              if (!controlVal || !treatmentVal)
                return { change: "", bgColor: "bg-neutral-900" };
              const change = ((treatmentVal - controlVal) / controlVal) * 100;
              const isImprovement = change < 0;
              const color = isImprovement ? "text-green-400" : "text-red-400";
              const bgColor = isImprovement ? "bg-green-950" : "bg-red-950";
              return {
                change: `<span class="ml-1 text-xs ${color}">${isImprovement ? "↓" : "↑"}${Math.abs(change).toFixed(0)}%</span>`,
                bgColor,
              };
            };

            const inputChange = calculateChange(
              control.inputTokens,
              treatment.inputTokens,
            );
            const outputChange = calculateChange(
              control.outputTokens,
              treatment.outputTokens,
            );
            const costChange = calculateChange(
              control.costUsd,
              treatment.costUsd,
            );
            const durationChange = calculateChange(
              control.durationMs,
              treatment.durationMs,
            );
            const toolCallsChange = calculateChange(
              control.toolCalls,
              treatment.toolCalls,
            );

            const prompt = testCaseMap[testName] || "";

            return `
                    <tr class="border-b border-neutral-800 hover:bg-neutral-900">
                        <td class="py-2 px-3 font-medium text-neutral-200 cursor-help" title="${prompt}">${testName}</td>
                        <td class="py-2 px-3 ${control.success ? "text-green-400" : "text-red-400"}">${control.success !== undefined ? (control.success ? "✓" : "✗") : "-"}</td>
                        <td class="py-2 px-3 bg-neutral-800 ${treatment.success ? "text-green-400" : "text-red-400"}">${treatment.success !== undefined ? (treatment.success ? "✓" : "✗") : "-"}</td>
                        <td class="py-2 px-3 text-neutral-300 tabular-nums">${control.inputTokens ? control.inputTokens.toLocaleString() : "-"}</td>
                        <td class="py-2 px-3 text-neutral-300 tabular-nums ${inputChange.bgColor}">${treatment.inputTokens ? treatment.inputTokens.toLocaleString() : "-"}${inputChange.change}</td>
                        <td class="py-2 px-3 text-neutral-300 tabular-nums">${control.outputTokens ? control.outputTokens.toLocaleString() : "-"}</td>
                        <td class="py-2 px-3 text-neutral-300 tabular-nums ${outputChange.bgColor}">${treatment.outputTokens ? treatment.outputTokens.toLocaleString() : "-"}${outputChange.change}</td>
                        <td class="py-2 px-3 text-neutral-300 tabular-nums">${control.costUsd !== undefined ? "$" + control.costUsd.toFixed(2) : "-"}</td>
                        <td class="py-2 px-3 text-neutral-300 tabular-nums ${costChange.bgColor}">${treatment.costUsd !== undefined ? "$" + treatment.costUsd.toFixed(2) : "-"}${costChange.change}</td>
                        <td class="py-2 px-3 text-neutral-300 tabular-nums">${control.durationMs ? prettyMs(control.durationMs) : "-"}</td>
                        <td class="py-2 px-3 text-neutral-300 tabular-nums ${durationChange.bgColor}">${treatment.durationMs ? prettyMs(treatment.durationMs) : "-"}${durationChange.change}</td>
                        <td class="py-2 px-3 text-neutral-300 tabular-nums">${control.toolCalls !== undefined ? control.toolCalls : "-"}</td>
                        <td class="py-2 px-3 text-neutral-300 tabular-nums ${toolCallsChange.bgColor}">${treatment.toolCalls !== undefined ? treatment.toolCalls : "-"}${toolCallsChange.change}</td>
                </tr>
                `;
          })
          .join("");
      }

      function displaySummary(data) {
        const totalTests = data.length;
        const successCount = data.filter((r) => r.success).length;
        const successRate = ((successCount / totalTests) * 100).toFixed(1);
        const totalCost = data.reduce((sum, r) => sum + r.costUsd, 0);
        const totalDuration = data.reduce((sum, r) => sum + r.durationMs, 0);

        document.getElementById("total-tests").textContent = totalTests;
        document.getElementById("success-rate").textContent = `${successRate}%`;
        document.getElementById("total-cost").textContent =
          `$${totalCost.toFixed(2)}`;
        document.getElementById("total-duration").textContent =
          prettyMs(totalDuration);
      }

      function displayComparison(data) {
        const controlResults = data.filter((r) => r.type === "control");
        const treatmentResults = data.filter((r) => r.type === "treatment");

        if (controlResults.length === 0 || treatmentResults.length === 0) {
          return;
        }

        const controlStats = calculateStats(controlResults);
        const treatmentStats = calculateStats(treatmentResults);

        const metrics = [
          {
            name: "Success Rate",
            control: `${controlStats.successRate}%`,
            treatment: `${treatmentStats.successRate}%`,
            isImprovement:
              treatmentStats.successRate >= controlStats.successRate,
            change: `${Math.abs(treatmentStats.successRate - controlStats.successRate).toFixed(1)}%`,
          },
          {
            name: "Avg Cost",
            control: `$${controlStats.avgCost.toFixed(2)}`,
            treatment: `$${treatmentStats.avgCost.toFixed(2)}`,
            isImprovement: treatmentStats.avgCost <= controlStats.avgCost,
            change: `${Math.abs(((treatmentStats.avgCost - controlStats.avgCost) / controlStats.avgCost) * 100).toFixed(1)}%`,
          },
          {
            name: "Avg Duration",
            control: prettyMs(controlStats.avgDuration),
            treatment: prettyMs(treatmentStats.avgDuration),
            isImprovement:
              treatmentStats.avgDuration <= controlStats.avgDuration,
            change: `${Math.abs(((treatmentStats.avgDuration - controlStats.avgDuration) / controlStats.avgDuration) * 100).toFixed(1)}%`,
          },
          {
            name: "Avg Tool Calls",
            control: controlStats.avgToolCalls.toFixed(1),
            treatment: treatmentStats.avgToolCalls.toFixed(1),
            isImprovement:
              treatmentStats.avgToolCalls <= controlStats.avgToolCalls,
            change: `${Math.abs(((treatmentStats.avgToolCalls - controlStats.avgToolCalls) / controlStats.avgToolCalls) * 100).toFixed(1)}%`,
          },
        ];

        const comparisonHTML = `
                <h2 class="text-xl font-medium mb-4 text-white">Control vs Treatment</h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-neutral-800">
                                <th class="text-left py-2 px-3 text-xs font-medium text-neutral-300">Metric</th>
                                <th class="text-left py-2 px-3 text-xs font-medium text-neutral-300">Control</th>
                                <th class="text-left py-2 px-3 text-xs font-medium text-neutral-300 bg-neutral-800">Treatment</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${metrics
                              .map(
                                (metric) => `
                                <tr class="border-b border-neutral-800 hover:bg-neutral-900">
                                    <td class="py-2 px-3 font-medium text-neutral-200">${metric.name}</td>
                                    <td class="py-2 px-3 text-neutral-300 tabular-nums">${metric.control}</td>
                                    <td class="py-2 px-3 text-neutral-300 tabular-nums bg-neutral-800">
                                        ${metric.treatment}
                                        <span class="ml-2 text-xs font-medium ${metric.isImprovement ? "text-green-400" : "text-red-400"}">
                                            ${metric.isImprovement ? "↓" : "↑"} ${metric.change}
                                        </span>
                                    </td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;

        document.getElementById("comparison").innerHTML = comparisonHTML;
      }

      function calculateStats(results) {
        const successCount = results.filter((r) => r.success).length;
        return {
          successRate: ((successCount / results.length) * 100).toFixed(1),
          avgCost:
            results.reduce((sum, r) => sum + r.costUsd, 0) / results.length,
          avgDuration:
            results.reduce((sum, r) => sum + r.durationMs, 0) / results.length,
          avgToolCalls:
            results.reduce((sum, r) => sum + r.toolCalls, 0) / results.length,
          avgInputTokens:
            results.reduce((sum, r) => sum + r.inputTokens, 0) / results.length,
          avgOutputTokens:
            results.reduce((sum, r) => sum + r.outputTokens, 0) /
            results.length,
        };
      }

      loadResults();
    </script>
  </body>
</html>



================================================
FILE: packages/benchmarks/index.ts
================================================
import path from "path";
import fs from "fs/promises";
import { runClaudeCodeTest } from "./claude-code";
import createSpinner from "yocto-spinner";
import { TEST_CASES } from "./test-cases";

const TARGET_ENVIRONMENT_DIR = path.join(__dirname, "shadcn-dashboard");

const run = async () => {
  const spinner = createSpinner({ text: "Running…" }).start();

  const testCasesJson = TEST_CASES.map(({ name, prompt }) => ({
    name,
    prompt,
  }));
  const testCasesPath = path.join(__dirname, "test-cases.json");
  await fs.writeFile(testCasesPath, JSON.stringify(testCasesJson, null, 2));

  const allTests = TEST_CASES.flatMap((testCase) => {
    const { name, prompt, expectedFile, reactGrabOutput } = testCase;

    return [
      {
        testName: name,
        type: "control" as const,
        run: () =>
          runClaudeCodeTest({
            prompt: `ONLY RETURN THE FILE NAME, NO OTHER TEXT. ${prompt}`,
            expectedFile,
            cwd: TARGET_ENVIRONMENT_DIR,
          }),
      },
      {
        testName: name,
        type: "treatment" as const,
        run: () =>
          runClaudeCodeTest({
            prompt: `ONLY RETURN THE FILE NAME, NO OTHER TEXT. ${prompt}

${reactGrabOutput}`,
            expectedFile,
            cwd: TARGET_ENVIRONMENT_DIR,
          }),
      },
    ];
  });

  const outputPath = path.join(__dirname, "results.json");
  const results: Array<{
    testName: string;
    type: "control" | "treatment";
    [key: string]: unknown;
  }> = [];

  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));

  const BATCH_SIZE = 5;

  for (let i = 0; i < allTests.length; i += BATCH_SIZE) {
    const batch = allTests.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async ({ testName, type, run }) => {
        const result = await run();
        const testResult = {
          testName,
          type,
          ...result,
        };

        results.push(testResult);
        await fs.writeFile(outputPath, JSON.stringify(results, null, 2));

        spinner.text = `Completed ${results.length}/${allTests.length} tests`;
      }),
    );
  }

  spinner.stop();

  console.log(`Results written to ${outputPath}`);
  console.log(`Total tests run: ${results.length}`);

  process.exit(0);
};

run();



================================================
FILE: packages/benchmarks/package.json
================================================
{
  "name": "@react-grab/benchmarks",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "serve": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@ai-sdk/anthropic": "^2.0.45",
    "ai": "^5.0.95",
    "ai-sdk-provider-claude-code": "^2.1.0",
    "yocto-spinner": "^1.0.0"
  },
  "devDependencies": {
    "vite": "^6.0.7"
  }
}



================================================
FILE: packages/benchmarks/results.json
================================================
[
  {
    "testName": "Revenue Card Badge",
    "type": "treatment",
    "inputTokens": 13611,
    "outputTokens": 10,
    "costUsd": 0.00773385,
    "durationMs": 6025,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Forgot Password Link",
    "type": "treatment",
    "inputTokens": 28026,
    "outputTokens": 69,
    "costUsd": 0.02098415,
    "durationMs": 6917,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Projects More Button",
    "type": "treatment",
    "inputTokens": 13604,
    "outputTokens": 10,
    "costUsd": 0.007577599999999999,
    "durationMs": 5674,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Dropdown Actions",
    "type": "treatment",
    "inputTokens": 13608,
    "outputTokens": 10,
    "costUsd": 0.007612600000000001,
    "durationMs": 5889,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Drag Handle",
    "type": "treatment",
    "inputTokens": 13544,
    "outputTokens": 10,
    "costUsd": 0.0120366,
    "durationMs": 7287,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Keyboard Shortcut Badge",
    "type": "treatment",
    "inputTokens": 13561,
    "outputTokens": 11,
    "costUsd": 0.012025349999999997,
    "durationMs": 6143,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Team Switcher Dropdown",
    "type": "treatment",
    "inputTokens": 13607,
    "outputTokens": 11,
    "costUsd": 0.007673849999999999,
    "durationMs": 6297,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "GitHub Link Button",
    "type": "treatment",
    "inputTokens": 13536,
    "outputTokens": 10,
    "costUsd": 0.0124716,
    "durationMs": 6368,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Full Name Input Field",
    "type": "treatment",
    "inputTokens": 13562,
    "outputTokens": 10,
    "costUsd": 0.0074401,
    "durationMs": 6475,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Full Name Input Field",
    "type": "control",
    "inputTokens": 26910,
    "outputTokens": 87,
    "costUsd": 0.0176384,
    "durationMs": 7641,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Sign Up With Google Button",
    "type": "treatment",
    "inputTokens": 13576,
    "outputTokens": 10,
    "costUsd": 0.0119766,
    "durationMs": 6783,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Field Description Text",
    "type": "treatment",
    "inputTokens": 13592,
    "outputTokens": 10,
    "costUsd": 0.007652599999999999,
    "durationMs": 5897,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Sidebar Trigger Toggle",
    "type": "treatment",
    "inputTokens": 13533,
    "outputTokens": 10,
    "costUsd": 0.01141035,
    "durationMs": 7446,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Calendar Date Cell",
    "type": "treatment",
    "inputTokens": 27366,
    "outputTokens": 88,
    "costUsd": 0.018399949999999998,
    "durationMs": 8543,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Tabs with Badges",
    "type": "control",
    "inputTokens": 26968,
    "outputTokens": 82,
    "costUsd": 0.017174349999999998,
    "durationMs": 8858,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Editable Target Input",
    "type": "treatment",
    "inputTokens": 37228,
    "outputTokens": 69,
    "costUsd": 0.050556000000000004,
    "durationMs": 9102,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Drag Handle",
    "type": "control",
    "inputTokens": 40546,
    "outputTokens": 195,
    "costUsd": 0.0231144,
    "durationMs": 10332,
    "toolCalls": 2,
    "success": true
  },
  {
    "testName": "Grayscale Avatar",
    "type": "treatment",
    "inputTokens": 27153,
    "outputTokens": 106,
    "costUsd": 0.0177593,
    "durationMs": 9812,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Quick Create Button",
    "type": "treatment",
    "inputTokens": 28079,
    "outputTokens": 69,
    "costUsd": 0.020346249999999996,
    "durationMs": 9285,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Tabs with Badges",
    "type": "treatment",
    "inputTokens": 37326,
    "outputTokens": 69,
    "costUsd": 0.05574345,
    "durationMs": 10123,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Status Badge",
    "type": "treatment",
    "inputTokens": 37212,
    "outputTokens": 94,
    "costUsd": 0.05572900000000001,
    "durationMs": 9523,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "OTP Input",
    "type": "treatment",
    "inputTokens": 28413,
    "outputTokens": 96,
    "costUsd": 0.0177021,
    "durationMs": 9681,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Time Range Toggle",
    "type": "treatment",
    "inputTokens": 32055,
    "outputTokens": 108,
    "costUsd": 0.0374124,
    "durationMs": 10161,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Time Range Toggle",
    "type": "control",
    "inputTokens": 26980,
    "outputTokens": 139,
    "costUsd": 0.01785485,
    "durationMs": 11293,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Quick Create Button",
    "type": "control",
    "inputTokens": 55035,
    "outputTokens": 220,
    "costUsd": 0.0308567,
    "durationMs": 12698,
    "toolCalls": 3,
    "success": true
  },
  {
    "testName": "Sign Up With Google Button",
    "type": "control",
    "inputTokens": 41447,
    "outputTokens": 166,
    "costUsd": 0.026986749999999997,
    "durationMs": 11646,
    "toolCalls": 2,
    "success": true
  },
  {
    "testName": "Grayscale Avatar",
    "type": "control",
    "inputTokens": 42217,
    "outputTokens": 256,
    "costUsd": 0.0298791,
    "durationMs": 13101,
    "toolCalls": 3,
    "success": true
  },
  {
    "testName": "Team Switcher Dropdown",
    "type": "control",
    "inputTokens": 26938,
    "outputTokens": 117,
    "costUsd": 0.01764185,
    "durationMs": 13002,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Calendar Date Cell",
    "type": "control",
    "inputTokens": 44021,
    "outputTokens": 241,
    "costUsd": 0.03664195,
    "durationMs": 13116,
    "toolCalls": 3,
    "success": true
  },
  {
    "testName": "Forgot Password Link",
    "type": "control",
    "inputTokens": 41795,
    "outputTokens": 261,
    "costUsd": 0.02795375,
    "durationMs": 13577,
    "toolCalls": 5,
    "success": true
  },
  {
    "testName": "Field Description Text",
    "type": "control",
    "inputTokens": 40510,
    "outputTokens": 173,
    "costUsd": 0.0226765,
    "durationMs": 13487,
    "toolCalls": 2,
    "success": true
  },
  {
    "testName": "OTP Input",
    "type": "control",
    "inputTokens": 43227,
    "outputTokens": 250,
    "costUsd": 0.046129399999999994,
    "durationMs": 16369,
    "toolCalls": 4,
    "success": true
  },
  {
    "testName": "Revenue Card Badge",
    "type": "control",
    "inputTokens": 42814,
    "outputTokens": 363,
    "costUsd": 0.03311575,
    "durationMs": 16306,
    "toolCalls": 6,
    "success": true
  },
  {
    "testName": "Dropdown Actions",
    "type": "control",
    "inputTokens": 42979,
    "outputTokens": 419,
    "costUsd": 0.0323276,
    "durationMs": 15739,
    "toolCalls": 5,
    "success": true
  },
  {
    "testName": "Sidebar Trigger Toggle",
    "type": "control",
    "inputTokens": 64484,
    "outputTokens": 363,
    "costUsd": 0.0662389,
    "durationMs": 19431,
    "toolCalls": 6,
    "success": true
  },
  {
    "testName": "Projects More Button",
    "type": "control",
    "inputTokens": 61707,
    "outputTokens": 249,
    "costUsd": 0.04138409999999999,
    "durationMs": 19178,
    "toolCalls": 3,
    "success": true
  },
  {
    "testName": "GitHub Link Button",
    "type": "control",
    "inputTokens": 58942,
    "outputTokens": 435,
    "costUsd": 0.04621545,
    "durationMs": 19863,
    "toolCalls": 8,
    "success": true
  },
  {
    "testName": "Editable Target Input",
    "type": "control",
    "inputTokens": 55562,
    "outputTokens": 658,
    "costUsd": 0.06713915000000001,
    "durationMs": 32442,
    "toolCalls": 13,
    "success": true
  },
  {
    "testName": "Keyboard Shortcut Badge",
    "type": "control",
    "inputTokens": 68294,
    "outputTokens": 522,
    "costUsd": 0.0455424,
    "durationMs": 34410,
    "toolCalls": 10,
    "success": true
  },
  {
    "testName": "Status Badge",
    "type": "control",
    "inputTokens": 154625,
    "outputTokens": 742,
    "costUsd": 0.1065227,
    "durationMs": 45811,
    "toolCalls": 9,
    "success": true
  }
]


================================================
FILE: packages/benchmarks/test-cases.json
================================================
[
  {
    "name": "Grayscale Avatar",
    "prompt": "Find the grayscale avatar in the user menu"
  },
  {
    "name": "Forgot Password Link",
    "prompt": "Find the forgot password link in the login form"
  },
  {
    "name": "Time Range Toggle",
    "prompt": "Find the time range toggle group showing Last 3 months, Last 30 days, Last 7 days"
  },
  {
    "name": "Drag Handle",
    "prompt": "Find the drag handle with grip vertical icon in the table rows"
  },
  {
    "name": "Editable Target Input",
    "prompt": "Find the inline editable target input field with transparent background in the data table"
  },
  {
    "name": "OTP Input",
    "prompt": "Find the OTP input with separator showing 6-digit verification code split into two groups"
  },
  {
    "name": "Quick Create Button",
    "prompt": "Find the Quick Create button with primary background color in the sidebar"
  },
  {
    "name": "Dropdown Actions",
    "prompt": "Find the show-on-hover dropdown menu button with three dots in the documents section"
  },
  {
    "name": "Status Badge",
    "prompt": "Find the status badge with green checkmark icon showing Done status"
  },
  {
    "name": "Tabs with Badges",
    "prompt": "Find the tab button showing Past Performance with a badge counter showing 3"
  },
  {
    "name": "Team Switcher Dropdown",
    "prompt": "Find the team switcher dropdown button with chevron icon in the sidebar"
  },
  {
    "name": "Keyboard Shortcut Badge",
    "prompt": "Find the keyboard shortcut indicator showing ⌘1 in the team dropdown menu"
  },
  {
    "name": "GitHub Link Button",
    "prompt": "Find the GitHub link button in the header toolbar"
  },
  {
    "name": "Sidebar Trigger Toggle",
    "prompt": "Find the sidebar toggle trigger button at the top of the header"
  },
  {
    "name": "Full Name Input Field",
    "prompt": "Find the full name input field with placeholder John Doe in the signup form"
  },
  {
    "name": "Field Description Text",
    "prompt": "Find the helper text saying We'll use this to contact you below the email input"
  },
  {
    "name": "Sign Up With Google Button",
    "prompt": "Find the Sign up with Google button with outline variant in the signup form"
  },
  {
    "name": "Revenue Card Badge",
    "prompt": "Find the trending up badge showing +12.5% in the Total Revenue card"
  },
  {
    "name": "Calendar Date Cell",
    "prompt": "Find the selected date cell in the calendar component showing June 12"
  },
  {
    "name": "Projects More Button",
    "prompt": "Find the More button with horizontal dots icon at the bottom of the projects list"
  }
]



















================================================
FILE: packages/benchmarks/test-cases.ts
================================================
interface TestCase {
  name: string;
  prompt: string;
  expectedFile: string;
  reactGrabOutput: string;
}

export const TEST_CASES: TestCase[] = [
  {
    name: "Grayscale Avatar",
    prompt: "Find the grayscale avatar in the user menu",
    expectedFile: "components/nav-user.tsx",
    reactGrabOutput: `<selected_element>

<span class="relative flex shrink-0 ove...">
  (2 elements)
</span>

  at span in components/nav-user.tsx:57:17
  at button in components/ui/sidebar.tsx:515:5
  at SidebarMenuButton in components/ui/sidebar.tsx:498:10
  at NavUser in components/nav-user.tsx:32:10

</selected_element>`,
  },
  {
    name: "Forgot Password Link",
    prompt: "Find the forgot password link in the login form",
    expectedFile: "components/login-form.tsx",
    reactGrabOutput: `<selected_element>

<a class="ml-auto inline-block text-..." href="#">
  Forgot your password?
</a>

  at a in components/login-form.tsx:46:19
  at div in components/login-form.tsx:44:17
  at Field in components/ui/field.tsx:87:5
  at FieldGroup in components/ui/field.tsx:46:5
  at form in components/login-form.tsx:32:11
  at div in components/ui/card.tsx:66:5
  at CardContent in components/ui/card.tsx:64:10
  at LoginForm in components/login-form.tsx:18:10

</selected_element>`,
  },
  {
    name: "Time Range Toggle",
    prompt:
      "Find the time range toggle group showing Last 3 months, Last 30 days, Last 7 days",
    expectedFile: "components/chart-area-interactive.tsx",
    reactGrabOutput: `<selected_element>

<div role="group" dir="ltr" class="flex items-center justify-c..." tabindex="0" style="outline: none;">
  (3 elements)
</div>

  at div in components/chart-area-interactive.tsx:178:11
  at CardAction in components/ui/card.tsx:52:5
  at div in components/ui/card.tsx:20:5
  at CardHeader in components/ui/card.tsx:18:10
  at ChartAreaInteractive in components/chart-area-interactive.tsx:143:10

</selected_element>`,
  },
  {
    name: "Drag Handle",
    prompt: "Find the drag handle with grip vertical icon in the table rows",
    expectedFile: "components/data-table.tsx",
    reactGrabOutput: `<selected_element>

<button class="inline-flex items-center ju..." aria-describedby="DndDe..." aria-disabled="false" role="button" tabindex="0">
  (2 elements)
</button>

  at button in components/data-table.tsx:126:5
  at DragHandle in components/data-table.tsx:120:10
  at td in components/data-table.tsx:331:9
  at tr in components/data-table.tsx:320:5
  at DraggableRow in components/data-table.tsx:314:10

</selected_element>`,
  },
  {
    name: "Editable Target Input",
    prompt:
      "Find the inline editable target input field with transparent background in the data table",
    expectedFile: "components/data-table.tsx",
    reactGrabOutput: `<selected_element>

<input class="flex rounded-md border border-..." id="1-target" value="2,500" />

  at input in components/data-table.tsx:221:9
  at form in components/data-table.tsx:208:7
  at td in components/data-table.tsx:331:9
  at tr in components/data-table.tsx:320:5
  at DraggableRow in components/data-table.tsx:314:10

</selected_element>`,
  },
  {
    name: "OTP Input",
    prompt:
      "Find the OTP input with separator showing 6-digit verification code split into two groups",
    expectedFile: "components/otp-form.tsx",
    reactGrabOutput: `<selected_element>

<div class="flex items-center gap-4 dis..." data-input-otp-co... style="position: relative; cursor: text; user-select: none; pointer-events: none;">
  (3 elements)
</div>

  at div in components/otp-form.tsx:42:13
  at Field in components/ui/field.tsx:87:5
  at FieldGroup in components/ui/field.tsx:46:5
  at form in components/otp-form.tsx:21:7
  at OTPForm in components/otp-form.tsx:18:10

</selected_element>`,
  },
  {
    name: "Quick Create Button",
    prompt:
      "Find the Quick Create button with primary background color in the sidebar",
    expectedFile: "components/nav-main.tsx",
    reactGrabOutput: `<selected_element>

<button data-sidebar="menu-button" data-size="default" data-active="false" class="peer/menu-button flex w-full ..." data-tooltip="Quick Create">
  (2 elements)
</button>

  at button in components/ui/sidebar.tsx:515:5
  at SidebarMenuButton in components/ui/sidebar.tsx:498:10
  at li in components/nav-main.tsx:27:11
  at ul in components/nav-main.tsx:26:9
  at SidebarMenu in components/ui/sidebar.tsx:456:5
  at div in components/nav-main.tsx:25:7
  at SidebarGroupContent in components/ui/sidebar.tsx:445:5
  at SidebarGroup in components/ui/sidebar.tsx:387:5
  at NavMain in components/nav-main.tsx:14:10

</selected_element>`,
  },
  {
    name: "Dropdown Actions",
    prompt:
      "Find the show-on-hover dropdown menu button with three dots in the documents section",
    expectedFile: "components/nav-documents.tsx",
    reactGrabOutput: `<selected_element>

<button data-sidebar="menu-action" class="absolute right-1 top-1.5 fl..." id="radix-:R2dcmcq:" aria-haspopup="menu" aria-expanded="false" data-state="closed">
  (2 elements)
</button>

  at button in components/ui/sidebar.tsx:560:5
  at SidebarMenuAction in components/ui/sidebar.tsx:548:10
  at li in components/nav-documents.tsx:44:11
  at ul in components/nav-documents.tsx:42:7
  at SidebarMenu in components/ui/sidebar.tsx:456:5
  at SidebarGroup in components/ui/sidebar.tsx:387:5
  at NavDocuments in components/nav-documents.tsx:28:10

</selected_element>`,
  },
  {
    name: "Status Badge",
    prompt:
      "Find the status badge with green checkmark icon showing Done status",
    expectedFile: "components/data-table.tsx",
    reactGrabOutput: `<selected_element>

<div class="inline-flex items-centers ro...">
  (1 element)
</div>

  at div in components/data-table.tsx:194:7
  at td in components/data-table.tsx:331:9
  at tr in components/data-table.tsx:320:5
  at DraggableRow in components/data-table.tsx:314:10

</selected_element>`,
  },
  {
    name: "Tabs with Badges",
    prompt:
      "Find the tab button showing Past Performance with a badge counter showing 3",
    expectedFile: "components/data-table.tsx",
    reactGrabOutput: `<selected_element>

<button type="button" role="tab" aria-selected="true" aria-controls="radix-:R1ld9..." data-state="active" id="radix-:R1ld9..." class="inline-flex items-center ju..." tabindex="0" data-orientation="horizontal" data-radix-collectio...>
  (1 element)
  Past Performance
</button>

  at button in components/data-table.tsx:430:11
  at div in components/data-table.tsx:428:9
  at Tabs in components/data-table.tsx:405:5
  at DataTable in components/data-table.tsx:339:10

</selected_element>`,
  },
  {
    name: "Team Switcher Dropdown",
    prompt:
      "Find the team switcher dropdown button with chevron icon in the sidebar",
    expectedFile: "components/team-switcher.tsx",
    reactGrabOutput: `<selected_element>

<button data-sidebar="menu-button" data-size="lg" class="peer/menu-button flex w-full ..." data-state="closed" aria-haspopup="menu" aria-expanded="false">
  (3 elements)
</button>

  at button in components/ui/sidebar.tsx:515:5
  at SidebarMenuButton in components/ui/sidebar.tsx:498:10
  at DropdownMenuTrigger in components/ui/dropdown-menu.tsx:27:5
  at li in components/team-switcher.tsx:40:9
  at SidebarMenuItem in components/ui/sidebar.tsx:467:5
  at SidebarMenu in components/ui/sidebar.tsx:456:5
  at TeamSwitcher in components/team-switcher.tsx:22:10

</selected_element>`,
  },
  {
    name: "Keyboard Shortcut Badge",
    prompt:
      "Find the keyboard shortcut indicator showing ⌘1 in the team dropdown menu",
    expectedFile: "components/team-switcher.tsx",
    reactGrabOutput: `<selected_element>

<span class="ml-auto text-xs tracking-w...">
  ⌘1
</span>

  at span in components/ui/dropdown-menu.tsx:184:7
  at DropdownMenuShortcut in components/ui/dropdown-menu.tsx:179:10
  at div in components/team-switcher.tsx:67:13
  at DropdownMenuItem in components/ui/dropdown-menu.tsx:72:5
  at div in components/ui/dropdown-menu.tsx:41:7
  at DropdownMenuContent in components/ui/dropdown-menu.tsx:34:10

</selected_element>`,
  },
  {
    name: "GitHub Link Button",
    prompt: "Find the GitHub link button in the header toolbar",
    expectedFile: "components/site-header.tsx",
    reactGrabOutput: `<selected_element>

<button class="inline-flex items-centers ju..." asChild size="sm">
  (1 element)
  GitHub
</button>

  at button in components/ui/button.tsx:52:5
  at Button in components/ui/button.tsx:39:10
  at div in components/site-header.tsx:15:9
  at div in components/site-header.tsx:8:7
  at header in components/site-header.tsx:7:5
  at SiteHeader in components/site-header.tsx:5:10

</selected_element>`,
  },
  {
    name: "Sidebar Trigger Toggle",
    prompt: "Find the sidebar toggle trigger button at the top of the header",
    expectedFile: "components/site-header.tsx",
    reactGrabOutput: `<selected_element>

<button data-sidebar="trigger" class="inline-flex items-centers ju..." aria-label="Toggle Sidebar">
  (1 element)
</button>

  at button in components/ui/button.tsx:52:5
  at SidebarTrigger in components/ui/sidebar.tsx:256:10
  at div in components/site-header.tsx:8:7
  at header in components/site-header.tsx:7:5
  at SiteHeader in components/site-header.tsx:5:10

</selected_element>`,
  },
  {
    name: "Full Name Input Field",
    prompt:
      "Find the full name input field with placeholder John Doe in the signup form",
    expectedFile: "components/signup-form.tsx",
    reactGrabOutput: `<selected_element>

<input id="name" type="text" placeholder="John Doe" required class="flex h-9 w-full rounded-md ..." />

  at input in components/signup-form.tsx:31:15
  at Field in components/ui/field.tsx:87:5
  at FieldGroup in components/ui/field.tsx:46:5
  at form in components/signup-form.tsx:27:11
  at div in components/ui/card.tsx:66:5
  at CardContent in components/ui/card.tsx:64:10
  at SignupForm in components/signup-form.tsx:17:10

</selected_element>`,
  },
  {
    name: "Field Description Text",
    prompt:
      "Find the helper text saying We'll use this to contact you below the email input",
    expectedFile: "components/signup-form.tsx",
    reactGrabOutput: `<selected_element>

<p class="text-[0.8rem] text-muted-fo...">
  We'll use this to contact you. We will not share your email with anyone else.
</p>

  at p in components/ui/field.tsx:143:5
  at FieldDescription in components/ui/field.tsx:141:10
  at Field in components/ui/field.tsx:87:5
  at FieldGroup in components/ui/field.tsx:46:5
  at form in components/signup-form.tsx:27:11
  at div in components/ui/card.tsx:66:5
  at CardContent in components/ui/card.tsx:64:10
  at SignupForm in components/signup-form.tsx:17:10

</selected_element>`,
  },
  {
    name: "Sign Up With Google Button",
    prompt:
      "Find the Sign up with Google button with outline variant in the signup form",
    expectedFile: "components/signup-form.tsx",
    reactGrabOutput: `<selected_element>

<button class="inline-flex items-center ju..." variant="outline" type="button">
  Sign up with Google
</button>

  at button in components/signup-form.tsx:63:17
  at Field in components/ui/field.tsx:87:5
  at FieldGroup in components/ui/field.tsx:46:5
  at FieldGroup in components/ui/field.tsx:46:5
  at form in components/signup-form.tsx:27:11
  at div in components/ui/card.tsx:66:5
  at CardContent in components/ui/card.tsx:64:10
  at SignupForm in components/signup-form.tsx:17:10

</selected_element>`,
  },
  {
    name: "Revenue Card Badge",
    prompt:
      "Find the trending up badge showing +12.5% in the Total Revenue card",
    expectedFile: "components/section-cards.tsx",
    reactGrabOutput: `<selected_element>

<div class="inline-flex items-centers ro..." variant="outline">
  (1 element)
  +12.5%
</div>

  at div in components/ui/badge.tsx:38:5
  at Badge in components/ui/badge.tsx:28:10
  at div in components/section-cards.tsx:23:13
  at CardAction in components/ui/card.tsx:52:5
  at div in components/ui/card.tsx:20:5
  at CardHeader in components/ui/card.tsx:18:10
  at div in components/ui/card.tsx:7:5
  at Card in components/ui/card.tsx:5:10
  at div in components/section-cards.tsx:15:7
  at SectionCards in components/section-cards.tsx:13:10

</selected_element>`,
  },
  {
    name: "Calendar Date Cell",
    prompt:
      "Find the selected date cell in the calendar component showing June 12",
    expectedFile: "components/calendar-01.tsx",
    reactGrabOutput: `<selected_element>

<button name="day" class="inline-flex items-centers ju..." role="gridcell" tabindex="0" aria-selected="true">
  12
</button>

  at button in components/ui/calendar.tsx:29:7
  at Calendar in components/ui/calendar.tsx:14:10
  at Calendar01 in components/calendar-01.tsx:7:19

</selected_element>`,
  },
  {
    name: "Projects More Button",
    prompt:
      "Find the More button with horizontal dots icon at the bottom of the projects list",
    expectedFile: "components/nav-projects.tsx",
    reactGrabOutput: `<selected_element>

<button data-sidebar="menu-button" class="peer/menu-button flex w-full ..." data-size="default" data-active="false">
  (1 element)
  More
</button>

  at button in components/ui/sidebar.tsx:515:5
  at SidebarMenuButton in components/ui/sidebar.tsx:498:10
  at li in components/nav-projects.tsx:80:9
  at SidebarMenuItem in components/ui/sidebar.tsx:467:5
  at ul in components/nav-projects.tsx:42:7
  at SidebarMenu in components/ui/sidebar.tsx:456:5
  at SidebarGroup in components/ui/sidebar.tsx:387:5
  at NavProjects in components/nav-projects.tsx:28:10

</selected_element>`,
  },
];



================================================
FILE: packages/benchmarks/vite.config.ts
================================================
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: "public",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
  },
});



================================================
FILE: packages/benchmarks/public/results.json
================================================
[
  {
    "testName": "Editable Target Input",
    "type": "treatment",
    "inputTokens": 13521,
    "outputTokens": 10,
    "costUsd": 0.00779835,
    "durationMs": 5666,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Calendar Date Cell",
    "type": "treatment",
    "inputTokens": 13500,
    "outputTokens": 10,
    "costUsd": 0.005760599999999999,
    "durationMs": 5271,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Full Name Input Field",
    "type": "treatment",
    "inputTokens": 13562,
    "outputTokens": 10,
    "costUsd": 0.007717099999999999,
    "durationMs": 5174,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Drag Handle",
    "type": "treatment",
    "inputTokens": 13544,
    "outputTokens": 10,
    "costUsd": 0.0076895999999999996,
    "durationMs": 5946,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Projects More Button",
    "type": "treatment",
    "inputTokens": 13604,
    "outputTokens": 10,
    "costUsd": 0.007929599999999998,
    "durationMs": 5331,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "GitHub Link Button",
    "type": "treatment",
    "inputTokens": 13536,
    "outputTokens": 10,
    "costUsd": 0.005895599999999999,
    "durationMs": 5499,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Keyboard Shortcut Badge",
    "type": "treatment",
    "inputTokens": 13561,
    "outputTokens": 11,
    "costUsd": 0.007753349999999998,
    "durationMs": 5856,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Field Description Text",
    "type": "treatment",
    "inputTokens": 13592,
    "outputTokens": 10,
    "costUsd": 0.007739599999999999,
    "durationMs": 5282,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Team Switcher Dropdown",
    "type": "treatment",
    "inputTokens": 13607,
    "outputTokens": 11,
    "costUsd": 0.007790849999999999,
    "durationMs": 7409,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Sidebar Trigger Toggle",
    "type": "treatment",
    "inputTokens": 13533,
    "outputTokens": 10,
    "costUsd": 0.00744335,
    "durationMs": 7317,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Time Range Toggle",
    "type": "control",
    "inputTokens": 26980,
    "outputTokens": 139,
    "costUsd": 0.019286849999999998,
    "durationMs": 9231,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Forgot Password Link",
    "type": "treatment",
    "inputTokens": 28026,
    "outputTokens": 69,
    "costUsd": 0.022056149999999997,
    "durationMs": 9007,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Grayscale Avatar",
    "type": "treatment",
    "inputTokens": 28492,
    "outputTokens": 69,
    "costUsd": 0.023527549999999998,
    "durationMs": 9723,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Quick Create Button",
    "type": "treatment",
    "inputTokens": 28079,
    "outputTokens": 69,
    "costUsd": 0.016209249999999998,
    "durationMs": 9510,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Tabs with Badges",
    "type": "control",
    "inputTokens": 26916,
    "outputTokens": 95,
    "costUsd": 0.01913135,
    "durationMs": 10001,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Dropdown Actions",
    "type": "treatment",
    "inputTokens": 13608,
    "outputTokens": 10,
    "costUsd": 0.0139936,
    "durationMs": 10296,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Full Name Input Field",
    "type": "control",
    "inputTokens": 26910,
    "outputTokens": 87,
    "costUsd": 0.0182804,
    "durationMs": 10422,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Drag Handle",
    "type": "control",
    "inputTokens": 26927,
    "outputTokens": 110,
    "costUsd": 0.015809099999999996,
    "durationMs": 11451,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Time Range Toggle",
    "type": "treatment",
    "inputTokens": 32056,
    "outputTokens": 109,
    "costUsd": 0.03821815,
    "durationMs": 11579,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Tabs with Badges",
    "type": "treatment",
    "inputTokens": 27850,
    "outputTokens": 125,
    "costUsd": 0.01812005,
    "durationMs": 12359,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Team Switcher Dropdown",
    "type": "control",
    "inputTokens": 26943,
    "outputTokens": 122,
    "costUsd": 0.0191476,
    "durationMs": 13285,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Status Badge",
    "type": "treatment",
    "inputTokens": 37218,
    "outputTokens": 100,
    "costUsd": 0.0539481,
    "durationMs": 12173,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Revenue Card Badge",
    "type": "control",
    "inputTokens": 42662,
    "outputTokens": 322,
    "costUsd": 0.03291495,
    "durationMs": 14523,
    "toolCalls": 5,
    "success": true
  },
  {
    "testName": "Grayscale Avatar",
    "type": "control",
    "inputTokens": 42241,
    "outputTokens": 269,
    "costUsd": 0.0324918,
    "durationMs": 14965,
    "toolCalls": 3,
    "success": true
  },
  {
    "testName": "Sign Up With Google Button",
    "type": "treatment",
    "inputTokens": 13576,
    "outputTokens": 10,
    "costUsd": 0.013643599999999999,
    "durationMs": 14968,
    "toolCalls": 0,
    "success": true
  },
  {
    "testName": "Forgot Password Link",
    "type": "control",
    "inputTokens": 41795,
    "outputTokens": 261,
    "costUsd": 0.02932575,
    "durationMs": 15433,
    "toolCalls": 5,
    "success": true
  },
  {
    "testName": "OTP Input",
    "type": "treatment",
    "inputTokens": 28413,
    "outputTokens": 96,
    "costUsd": 0.023783099999999998,
    "durationMs": 14273,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Quick Create Button",
    "type": "control",
    "inputTokens": 41302,
    "outputTokens": 141,
    "costUsd": 0.027811199999999998,
    "durationMs": 14927,
    "toolCalls": 2,
    "success": true
  },
  {
    "testName": "GitHub Link Button",
    "type": "control",
    "inputTokens": 41511,
    "outputTokens": 262,
    "costUsd": 0.031107299999999997,
    "durationMs": 15360,
    "toolCalls": 5,
    "success": true
  },
  {
    "testName": "Projects More Button",
    "type": "control",
    "inputTokens": 42251,
    "outputTokens": 381,
    "costUsd": 0.029370999999999998,
    "durationMs": 15731,
    "toolCalls": 4,
    "success": true
  },
  {
    "testName": "OTP Input",
    "type": "control",
    "inputTokens": 43219,
    "outputTokens": 246,
    "costUsd": 0.0360602,
    "durationMs": 16641,
    "toolCalls": 4,
    "success": true
  },
  {
    "testName": "Revenue Card Badge",
    "type": "treatment",
    "inputTokens": 28860,
    "outputTokens": 114,
    "costUsd": 0.022516099999999997,
    "durationMs": 16845,
    "toolCalls": 1,
    "success": true
  },
  {
    "testName": "Sidebar Trigger Toggle",
    "type": "control",
    "inputTokens": 41324,
    "outputTokens": 185,
    "costUsd": 0.026903449999999995,
    "durationMs": 17608,
    "toolCalls": 3,
    "success": true
  },
  {
    "testName": "Editable Target Input",
    "type": "control",
    "inputTokens": 51185,
    "outputTokens": 343,
    "costUsd": 0.06662345,
    "durationMs": 18255,
    "toolCalls": 4,
    "success": true
  },
  {
    "testName": "Calendar Date Cell",
    "type": "control",
    "inputTokens": 44219,
    "outputTokens": 273,
    "costUsd": 0.039314249999999995,
    "durationMs": 18895,
    "toolCalls": 4,
    "success": true
  },
  {
    "testName": "Dropdown Actions",
    "type": "control",
    "inputTokens": 57234,
    "outputTokens": 549,
    "costUsd": 0.04281249999999999,
    "durationMs": 20096,
    "toolCalls": 6,
    "success": true
  },
  {
    "testName": "Keyboard Shortcut Badge",
    "type": "control",
    "inputTokens": 55550,
    "outputTokens": 269,
    "costUsd": 0.0356668,
    "durationMs": 19789,
    "toolCalls": 3,
    "success": true
  },
  {
    "testName": "Field Description Text",
    "type": "control",
    "inputTokens": 54198,
    "outputTokens": 252,
    "costUsd": 0.030540399999999995,
    "durationMs": 25541,
    "toolCalls": 3,
    "success": true
  },
  {
    "testName": "Sign Up With Google Button",
    "type": "control",
    "inputTokens": 41643,
    "outputTokens": 152,
    "costUsd": 0.027177349999999996,
    "durationMs": 34030,
    "toolCalls": 3,
    "success": true
  },
  {
    "testName": "Status Badge",
    "type": "control",
    "inputTokens": 123594,
    "outputTokens": 738,
    "costUsd": 0.10045275,
    "durationMs": 38352,
    "toolCalls": 9,
    "success": true
  }
]


================================================
FILE: packages/benchmarks/public/test-cases.json
================================================
[
  {
    "name": "Grayscale Avatar",
    "prompt": "Find the grayscale avatar in the user menu"
  },
  {
    "name": "Forgot Password Link",
    "prompt": "Find the forgot password link in the login form"
  },
  {
    "name": "Time Range Toggle",
    "prompt": "Find the time range toggle group showing Last 3 months, Last 30 days, Last 7 days"
  },
  {
    "name": "Drag Handle",
    "prompt": "Find the drag handle with grip vertical icon in the table rows"
  },
  {
    "name": "Editable Target Input",
    "prompt": "Find the inline editable target input field with transparent background in the data table"
  },
  {
    "name": "OTP Input",
    "prompt": "Find the OTP input with separator showing 6-digit verification code split into two groups"
  },
  {
    "name": "Quick Create Button",
    "prompt": "Find the Quick Create button with primary background color in the sidebar"
  },
  {
    "name": "Dropdown Actions",
    "prompt": "Find the show-on-hover dropdown menu button with three dots in the documents section"
  },
  {
    "name": "Status Badge",
    "prompt": "Find the status badge with green checkmark icon showing Done status"
  },
  {
    "name": "Tabs with Badges",
    "prompt": "Find the tab button showing Past Performance with a badge counter showing 3"
  },
  {
    "name": "Team Switcher Dropdown",
    "prompt": "Find the team switcher dropdown button with chevron icon in the sidebar"
  },
  {
    "name": "Keyboard Shortcut Badge",
    "prompt": "Find the keyboard shortcut indicator showing ⌘1 in the team dropdown menu"
  },
  {
    "name": "GitHub Link Button",
    "prompt": "Find the GitHub link button in the header toolbar"
  },
  {
    "name": "Sidebar Trigger Toggle",
    "prompt": "Find the sidebar toggle trigger button at the top of the header"
  },
  {
    "name": "Full Name Input Field",
    "prompt": "Find the full name input field with placeholder John Doe in the signup form"
  },
  {
    "name": "Field Description Text",
    "prompt": "Find the helper text saying We'll use this to contact you below the email input"
  },
  {
    "name": "Sign Up With Google Button",
    "prompt": "Find the Sign up with Google button with outline variant in the signup form"
  },
  {
    "name": "Revenue Card Badge",
    "prompt": "Find the trending up badge showing +12.5% in the Total Revenue card"
  },
  {
    "name": "Calendar Date Cell",
    "prompt": "Find the selected date cell in the calendar component showing June 12"
  },
  {
    "name": "Projects More Button",
    "prompt": "Find the More button with horizontal dots icon at the bottom of the projects list"
  }
]


================================================
FILE: packages/benchmarks/shadcn-dashboard/README.md
================================================
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.



================================================
FILE: packages/benchmarks/shadcn-dashboard/components.json
================================================
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {}
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/eslint.config.mjs
================================================
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;



================================================
FILE: packages/benchmarks/shadcn-dashboard/instrumentation-client.ts
================================================
[Empty file]


================================================
FILE: packages/benchmarks/shadcn-dashboard/next.config.ts
================================================
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;



================================================
FILE: packages/benchmarks/shadcn-dashboard/package.json
================================================
{
  "name": "next-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.45",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/modifiers": "^9.0.0",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@radix-ui/react-avatar": "^1.1.11",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-collapsible": "^1.1.12",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toggle": "^1.1.10",
    "@radix-ui/react-toggle-group": "^1.1.11",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@tabler/icons-react": "^3.35.0",
    "@tanstack/react-table": "^8.21.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "input-otp": "^1.4.2",
    "lucide-react": "^0.553.0",
    "next": "16.0.3",
    "next-themes": "^0.4.6",
    "react": "19.2.0",
    "react-day-picker": "^9.11.1",
    "react-dom": "19.2.0",
    "react-grab": "workspace:*",
    "recharts": "2.15.4",
    "sonner": "^2.0.7",
    "tailwind-merge": "^2.6.0",
    "vaul": "^1.1.2",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.0.3",
    "tailwindcss": "^4",
    "tw-animate-css": "^1.4.0",
    "typescript": "^5"
  }
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/postcss.config.mjs
================================================
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;



================================================
FILE: packages/benchmarks/shadcn-dashboard/tsconfig.json
================================================
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/app/globals.css
================================================
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: hsl(0 0% 98%);
  --sidebar-foreground: hsl(240 5.3% 26.1%);
  --sidebar-primary: hsl(240 5.9% 10%);
  --sidebar-primary-foreground: hsl(0 0% 98%);
  --sidebar-accent: hsl(240 4.8% 95.9%);
  --sidebar-accent-foreground: hsl(240 5.9% 10%);
  --sidebar-border: hsl(220 13% 91%);
  --sidebar-ring: hsl(217.2 91.2% 59.8%);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: hsl(240 5.9% 10%);
  --sidebar-foreground: hsl(240 4.8% 95.9%);
  --sidebar-primary: hsl(224.3 76.3% 48%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(240 3.7% 15.9%);
  --sidebar-accent-foreground: hsl(240 4.8% 95.9%);
  --sidebar-border: hsl(240 3.7% 15.9%);
  --sidebar-ring: hsl(217.2 91.2% 59.8%);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/app/layout.tsx
================================================
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/app/page.tsx
================================================
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.tsx file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/app/dashboard/data.json
================================================
[
  {
    "id": 1,
    "header": "Cover page",
    "type": "Cover page",
    "status": "In Process",
    "target": "18",
    "limit": "5",
    "reviewer": "Eddie Lake"
  },
  {
    "id": 2,
    "header": "Table of contents",
    "type": "Table of contents",
    "status": "Done",
    "target": "29",
    "limit": "24",
    "reviewer": "Eddie Lake"
  },
  {
    "id": 3,
    "header": "Executive summary",
    "type": "Narrative",
    "status": "Done",
    "target": "10",
    "limit": "13",
    "reviewer": "Eddie Lake"
  },
  {
    "id": 4,
    "header": "Technical approach",
    "type": "Narrative",
    "status": "Done",
    "target": "27",
    "limit": "23",
    "reviewer": "Jamik Tashpulatov"
  },
  {
    "id": 5,
    "header": "Design",
    "type": "Narrative",
    "status": "In Process",
    "target": "2",
    "limit": "16",
    "reviewer": "Jamik Tashpulatov"
  },
  {
    "id": 6,
    "header": "Capabilities",
    "type": "Narrative",
    "status": "In Process",
    "target": "20",
    "limit": "8",
    "reviewer": "Jamik Tashpulatov"
  },
  {
    "id": 7,
    "header": "Integration with existing systems",
    "type": "Narrative",
    "status": "In Process",
    "target": "19",
    "limit": "21",
    "reviewer": "Jamik Tashpulatov"
  },
  {
    "id": 8,
    "header": "Innovation and Advantages",
    "type": "Narrative",
    "status": "Done",
    "target": "25",
    "limit": "26",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 9,
    "header": "Overview of EMR's Innovative Solutions",
    "type": "Technical content",
    "status": "Done",
    "target": "7",
    "limit": "23",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 10,
    "header": "Advanced Algorithms and Machine Learning",
    "type": "Narrative",
    "status": "Done",
    "target": "30",
    "limit": "28",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 11,
    "header": "Adaptive Communication Protocols",
    "type": "Narrative",
    "status": "Done",
    "target": "9",
    "limit": "31",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 12,
    "header": "Advantages Over Current Technologies",
    "type": "Narrative",
    "status": "Done",
    "target": "12",
    "limit": "0",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 13,
    "header": "Past Performance",
    "type": "Narrative",
    "status": "Done",
    "target": "22",
    "limit": "33",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 14,
    "header": "Customer Feedback and Satisfaction Levels",
    "type": "Narrative",
    "status": "Done",
    "target": "15",
    "limit": "34",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 15,
    "header": "Implementation Challenges and Solutions",
    "type": "Narrative",
    "status": "Done",
    "target": "3",
    "limit": "35",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 16,
    "header": "Security Measures and Data Protection Policies",
    "type": "Narrative",
    "status": "In Process",
    "target": "6",
    "limit": "36",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 17,
    "header": "Scalability and Future Proofing",
    "type": "Narrative",
    "status": "Done",
    "target": "4",
    "limit": "37",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 18,
    "header": "Cost-Benefit Analysis",
    "type": "Plain language",
    "status": "Done",
    "target": "14",
    "limit": "38",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 19,
    "header": "User Training and Onboarding Experience",
    "type": "Narrative",
    "status": "Done",
    "target": "17",
    "limit": "39",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 20,
    "header": "Future Development Roadmap",
    "type": "Narrative",
    "status": "Done",
    "target": "11",
    "limit": "40",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 21,
    "header": "System Architecture Overview",
    "type": "Technical content",
    "status": "In Process",
    "target": "24",
    "limit": "18",
    "reviewer": "Maya Johnson"
  },
  {
    "id": 22,
    "header": "Risk Management Plan",
    "type": "Narrative",
    "status": "Done",
    "target": "15",
    "limit": "22",
    "reviewer": "Carlos Rodriguez"
  },
  {
    "id": 23,
    "header": "Compliance Documentation",
    "type": "Legal",
    "status": "In Process",
    "target": "31",
    "limit": "27",
    "reviewer": "Sarah Chen"
  },
  {
    "id": 24,
    "header": "API Documentation",
    "type": "Technical content",
    "status": "Done",
    "target": "8",
    "limit": "12",
    "reviewer": "Raj Patel"
  },
  {
    "id": 25,
    "header": "User Interface Mockups",
    "type": "Visual",
    "status": "In Process",
    "target": "19",
    "limit": "25",
    "reviewer": "Leila Ahmadi"
  },
  {
    "id": 26,
    "header": "Database Schema",
    "type": "Technical content",
    "status": "Done",
    "target": "22",
    "limit": "20",
    "reviewer": "Thomas Wilson"
  },
  {
    "id": 27,
    "header": "Testing Methodology",
    "type": "Technical content",
    "status": "In Process",
    "target": "17",
    "limit": "14",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 28,
    "header": "Deployment Strategy",
    "type": "Narrative",
    "status": "Done",
    "target": "26",
    "limit": "30",
    "reviewer": "Eddie Lake"
  },
  {
    "id": 29,
    "header": "Budget Breakdown",
    "type": "Financial",
    "status": "In Process",
    "target": "13",
    "limit": "16",
    "reviewer": "Jamik Tashpulatov"
  },
  {
    "id": 30,
    "header": "Market Analysis",
    "type": "Research",
    "status": "Done",
    "target": "29",
    "limit": "32",
    "reviewer": "Sophia Martinez"
  },
  {
    "id": 31,
    "header": "Competitor Comparison",
    "type": "Research",
    "status": "In Process",
    "target": "21",
    "limit": "19",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 32,
    "header": "Maintenance Plan",
    "type": "Technical content",
    "status": "Done",
    "target": "16",
    "limit": "23",
    "reviewer": "Alex Thompson"
  },
  {
    "id": 33,
    "header": "User Personas",
    "type": "Research",
    "status": "In Process",
    "target": "27",
    "limit": "24",
    "reviewer": "Nina Patel"
  },
  {
    "id": 34,
    "header": "Accessibility Compliance",
    "type": "Legal",
    "status": "Done",
    "target": "18",
    "limit": "21",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 35,
    "header": "Performance Metrics",
    "type": "Technical content",
    "status": "In Process",
    "target": "23",
    "limit": "26",
    "reviewer": "David Kim"
  },
  {
    "id": 36,
    "header": "Disaster Recovery Plan",
    "type": "Technical content",
    "status": "Done",
    "target": "14",
    "limit": "17",
    "reviewer": "Jamik Tashpulatov"
  },
  {
    "id": 37,
    "header": "Third-party Integrations",
    "type": "Technical content",
    "status": "In Process",
    "target": "25",
    "limit": "28",
    "reviewer": "Eddie Lake"
  },
  {
    "id": 38,
    "header": "User Feedback Summary",
    "type": "Research",
    "status": "Done",
    "target": "20",
    "limit": "15",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 39,
    "header": "Localization Strategy",
    "type": "Narrative",
    "status": "In Process",
    "target": "12",
    "limit": "19",
    "reviewer": "Maria Garcia"
  },
  {
    "id": 40,
    "header": "Mobile Compatibility",
    "type": "Technical content",
    "status": "Done",
    "target": "28",
    "limit": "31",
    "reviewer": "James Wilson"
  },
  {
    "id": 41,
    "header": "Data Migration Plan",
    "type": "Technical content",
    "status": "In Process",
    "target": "19",
    "limit": "22",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 42,
    "header": "Quality Assurance Protocols",
    "type": "Technical content",
    "status": "Done",
    "target": "30",
    "limit": "33",
    "reviewer": "Priya Singh"
  },
  {
    "id": 43,
    "header": "Stakeholder Analysis",
    "type": "Research",
    "status": "In Process",
    "target": "11",
    "limit": "14",
    "reviewer": "Eddie Lake"
  },
  {
    "id": 44,
    "header": "Environmental Impact Assessment",
    "type": "Research",
    "status": "Done",
    "target": "24",
    "limit": "27",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 45,
    "header": "Intellectual Property Rights",
    "type": "Legal",
    "status": "In Process",
    "target": "17",
    "limit": "20",
    "reviewer": "Sarah Johnson"
  },
  {
    "id": 46,
    "header": "Customer Support Framework",
    "type": "Narrative",
    "status": "Done",
    "target": "22",
    "limit": "25",
    "reviewer": "Jamik Tashpulatov"
  },
  {
    "id": 47,
    "header": "Version Control Strategy",
    "type": "Technical content",
    "status": "In Process",
    "target": "15",
    "limit": "18",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 48,
    "header": "Continuous Integration Pipeline",
    "type": "Technical content",
    "status": "Done",
    "target": "26",
    "limit": "29",
    "reviewer": "Michael Chen"
  },
  {
    "id": 49,
    "header": "Regulatory Compliance",
    "type": "Legal",
    "status": "In Process",
    "target": "13",
    "limit": "16",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 50,
    "header": "User Authentication System",
    "type": "Technical content",
    "status": "Done",
    "target": "28",
    "limit": "31",
    "reviewer": "Eddie Lake"
  },
  {
    "id": 51,
    "header": "Data Analytics Framework",
    "type": "Technical content",
    "status": "In Process",
    "target": "21",
    "limit": "24",
    "reviewer": "Jamik Tashpulatov"
  },
  {
    "id": 52,
    "header": "Cloud Infrastructure",
    "type": "Technical content",
    "status": "Done",
    "target": "16",
    "limit": "19",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 53,
    "header": "Network Security Measures",
    "type": "Technical content",
    "status": "In Process",
    "target": "29",
    "limit": "32",
    "reviewer": "Lisa Wong"
  },
  {
    "id": 54,
    "header": "Project Timeline",
    "type": "Planning",
    "status": "Done",
    "target": "14",
    "limit": "17",
    "reviewer": "Eddie Lake"
  },
  {
    "id": 55,
    "header": "Resource Allocation",
    "type": "Planning",
    "status": "In Process",
    "target": "27",
    "limit": "30",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 56,
    "header": "Team Structure and Roles",
    "type": "Planning",
    "status": "Done",
    "target": "20",
    "limit": "23",
    "reviewer": "Jamik Tashpulatov"
  },
  {
    "id": 57,
    "header": "Communication Protocols",
    "type": "Planning",
    "status": "In Process",
    "target": "15",
    "limit": "18",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 58,
    "header": "Success Metrics",
    "type": "Planning",
    "status": "Done",
    "target": "30",
    "limit": "33",
    "reviewer": "Eddie Lake"
  },
  {
    "id": 59,
    "header": "Internationalization Support",
    "type": "Technical content",
    "status": "In Process",
    "target": "23",
    "limit": "26",
    "reviewer": "Jamik Tashpulatov"
  },
  {
    "id": 60,
    "header": "Backup and Recovery Procedures",
    "type": "Technical content",
    "status": "Done",
    "target": "18",
    "limit": "21",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 61,
    "header": "Monitoring and Alerting System",
    "type": "Technical content",
    "status": "In Process",
    "target": "25",
    "limit": "28",
    "reviewer": "Daniel Park"
  },
  {
    "id": 62,
    "header": "Code Review Guidelines",
    "type": "Technical content",
    "status": "Done",
    "target": "12",
    "limit": "15",
    "reviewer": "Eddie Lake"
  },
  {
    "id": 63,
    "header": "Documentation Standards",
    "type": "Technical content",
    "status": "In Process",
    "target": "27",
    "limit": "30",
    "reviewer": "Jamik Tashpulatov"
  },
  {
    "id": 64,
    "header": "Release Management Process",
    "type": "Planning",
    "status": "Done",
    "target": "22",
    "limit": "25",
    "reviewer": "Assign reviewer"
  },
  {
    "id": 65,
    "header": "Feature Prioritization Matrix",
    "type": "Planning",
    "status": "In Process",
    "target": "19",
    "limit": "22",
    "reviewer": "Emma Davis"
  },
  {
    "id": 66,
    "header": "Technical Debt Assessment",
    "type": "Technical content",
    "status": "Done",
    "target": "24",
    "limit": "27",
    "reviewer": "Eddie Lake"
  },
  {
    "id": 67,
    "header": "Capacity Planning",
    "type": "Planning",
    "status": "In Process",
    "target": "21",
    "limit": "24",
    "reviewer": "Jamik Tashpulatov"
  },
  {
    "id": 68,
    "header": "Service Level Agreements",
    "type": "Legal",
    "status": "Done",
    "target": "26",
    "limit": "29",
    "reviewer": "Assign reviewer"
  }
]



================================================
FILE: packages/benchmarks/shadcn-dashboard/app/dashboard/page.tsx
================================================
import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

import data from "./data.json"

export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>
              <DataTable data={data} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/app/login/page.tsx
================================================
import { LoginForm } from "@/components/login-form"

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/app/otp/page.tsx
================================================
import { OTPForm } from "@/components/otp-form"

export default function OTPPage() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <OTPForm />
      </div>
    </div>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/app/signup/page.tsx
================================================
import { SignupForm } from "@/components/signup-form"

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/app-sidebar.tsx
================================================
"use client"

import * as React from "react"
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: IconDashboard,
    },
    {
      title: "Lifecycle",
      url: "#",
      icon: IconListDetails,
    },
    {
      title: "Analytics",
      url: "#",
      icon: IconChartBar,
    },
    {
      title: "Projects",
      url: "#",
      icon: IconFolder,
    },
    {
      title: "Team",
      url: "#",
      icon: IconUsers,
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: IconCamera,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: IconFileDescription,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: IconFileAi,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "Search",
      url: "#",
      icon: IconSearch,
    },
  ],
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: IconDatabase,
    },
    {
      name: "Reports",
      url: "#",
      icon: IconReport,
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: IconFileWord,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Acme Inc.</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/calendar-01.tsx
================================================
"use client"

import * as React from "react"

import { Calendar } from "@/components/ui/calendar"

export default function Calendar01() {
  const [date, setDate] = React.useState<Date | undefined>(
    new Date(2025, 5, 12)
  )

  return (
    <Calendar
      mode="single"
      defaultMonth={date}
      selected={date}
      onSelect={setDate}
      className="rounded-lg border shadow-sm"
    />
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/chart-area-interactive.tsx
================================================
"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "An interactive area chart"

const chartData = [
  { date: "2024-04-01", desktop: 222, mobile: 150 },
  { date: "2024-04-02", desktop: 97, mobile: 180 },
  { date: "2024-04-03", desktop: 167, mobile: 120 },
  { date: "2024-04-04", desktop: 242, mobile: 260 },
  { date: "2024-04-05", desktop: 373, mobile: 290 },
  { date: "2024-04-06", desktop: 301, mobile: 340 },
  { date: "2024-04-07", desktop: 245, mobile: 180 },
  { date: "2024-04-08", desktop: 409, mobile: 320 },
  { date: "2024-04-09", desktop: 59, mobile: 110 },
  { date: "2024-04-10", desktop: 261, mobile: 190 },
  { date: "2024-04-11", desktop: 327, mobile: 350 },
  { date: "2024-04-12", desktop: 292, mobile: 210 },
  { date: "2024-04-13", desktop: 342, mobile: 380 },
  { date: "2024-04-14", desktop: 137, mobile: 220 },
  { date: "2024-04-15", desktop: 120, mobile: 170 },
  { date: "2024-04-16", desktop: 138, mobile: 190 },
  { date: "2024-04-17", desktop: 446, mobile: 360 },
  { date: "2024-04-18", desktop: 364, mobile: 410 },
  { date: "2024-04-19", desktop: 243, mobile: 180 },
  { date: "2024-04-20", desktop: 89, mobile: 150 },
  { date: "2024-04-21", desktop: 137, mobile: 200 },
  { date: "2024-04-22", desktop: 224, mobile: 170 },
  { date: "2024-04-23", desktop: 138, mobile: 230 },
  { date: "2024-04-24", desktop: 387, mobile: 290 },
  { date: "2024-04-25", desktop: 215, mobile: 250 },
  { date: "2024-04-26", desktop: 75, mobile: 130 },
  { date: "2024-04-27", desktop: 383, mobile: 420 },
  { date: "2024-04-28", desktop: 122, mobile: 180 },
  { date: "2024-04-29", desktop: 315, mobile: 240 },
  { date: "2024-04-30", desktop: 454, mobile: 380 },
  { date: "2024-05-01", desktop: 165, mobile: 220 },
  { date: "2024-05-02", desktop: 293, mobile: 310 },
  { date: "2024-05-03", desktop: 247, mobile: 190 },
  { date: "2024-05-04", desktop: 385, mobile: 420 },
  { date: "2024-05-05", desktop: 481, mobile: 390 },
  { date: "2024-05-06", desktop: 498, mobile: 520 },
  { date: "2024-05-07", desktop: 388, mobile: 300 },
  { date: "2024-05-08", desktop: 149, mobile: 210 },
  { date: "2024-05-09", desktop: 227, mobile: 180 },
  { date: "2024-05-10", desktop: 293, mobile: 330 },
  { date: "2024-05-11", desktop: 335, mobile: 270 },
  { date: "2024-05-12", desktop: 197, mobile: 240 },
  { date: "2024-05-13", desktop: 197, mobile: 160 },
  { date: "2024-05-14", desktop: 448, mobile: 490 },
  { date: "2024-05-15", desktop: 473, mobile: 380 },
  { date: "2024-05-16", desktop: 338, mobile: 400 },
  { date: "2024-05-17", desktop: 499, mobile: 420 },
  { date: "2024-05-18", desktop: 315, mobile: 350 },
  { date: "2024-05-19", desktop: 235, mobile: 180 },
  { date: "2024-05-20", desktop: 177, mobile: 230 },
  { date: "2024-05-21", desktop: 82, mobile: 140 },
  { date: "2024-05-22", desktop: 81, mobile: 120 },
  { date: "2024-05-23", desktop: 252, mobile: 290 },
  { date: "2024-05-24", desktop: 294, mobile: 220 },
  { date: "2024-05-25", desktop: 201, mobile: 250 },
  { date: "2024-05-26", desktop: 213, mobile: 170 },
  { date: "2024-05-27", desktop: 420, mobile: 460 },
  { date: "2024-05-28", desktop: 233, mobile: 190 },
  { date: "2024-05-29", desktop: 78, mobile: 130 },
  { date: "2024-05-30", desktop: 340, mobile: 280 },
  { date: "2024-05-31", desktop: 178, mobile: 230 },
  { date: "2024-06-01", desktop: 178, mobile: 200 },
  { date: "2024-06-02", desktop: 470, mobile: 410 },
  { date: "2024-06-03", desktop: 103, mobile: 160 },
  { date: "2024-06-04", desktop: 439, mobile: 380 },
  { date: "2024-06-05", desktop: 88, mobile: 140 },
  { date: "2024-06-06", desktop: 294, mobile: 250 },
  { date: "2024-06-07", desktop: 323, mobile: 370 },
  { date: "2024-06-08", desktop: 385, mobile: 320 },
  { date: "2024-06-09", desktop: 438, mobile: 480 },
  { date: "2024-06-10", desktop: 155, mobile: 200 },
  { date: "2024-06-11", desktop: 92, mobile: 150 },
  { date: "2024-06-12", desktop: 492, mobile: 420 },
  { date: "2024-06-13", desktop: 81, mobile: 130 },
  { date: "2024-06-14", desktop: 426, mobile: 380 },
  { date: "2024-06-15", desktop: 307, mobile: 350 },
  { date: "2024-06-16", desktop: 371, mobile: 310 },
  { date: "2024-06-17", desktop: 475, mobile: 520 },
  { date: "2024-06-18", desktop: 107, mobile: 170 },
  { date: "2024-06-19", desktop: 341, mobile: 290 },
  { date: "2024-06-20", desktop: 408, mobile: 450 },
  { date: "2024-06-21", desktop: 169, mobile: 210 },
  { date: "2024-06-22", desktop: 317, mobile: 270 },
  { date: "2024-06-23", desktop: 480, mobile: 530 },
  { date: "2024-06-24", desktop: 132, mobile: 180 },
  { date: "2024-06-25", desktop: 141, mobile: 190 },
  { date: "2024-06-26", desktop: 434, mobile: 380 },
  { date: "2024-06-27", desktop: 448, mobile: 490 },
  { date: "2024-06-28", desktop: 149, mobile: 200 },
  { date: "2024-06-29", desktop: 103, mobile: 160 },
  { date: "2024-06-30", desktop: 446, mobile: 400 },
]

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  desktop: {
    label: "Desktop",
    color: "var(--primary)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date("2024-06-30")
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Total Visitors</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Total for the last 3 months
          </span>
          <span className="@[540px]/card:hidden">Last 3 months</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-desktop)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-desktop)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-mobile)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-mobile)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="mobile"
              type="natural"
              fill="url(#fillMobile)"
              stroke="var(--color-mobile)"
              stackId="a"
            />
            <Area
              dataKey="desktop"
              type="natural"
              fill="url(#fillDesktop)"
              stroke="var(--color-desktop)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/data-table.tsx
================================================
"use client"

import * as React from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleCheckFilled,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconLoader,
  IconPlus,
  IconTrendingUp,
} from "@tabler/icons-react"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { toast } from "sonner"
import { z } from "zod"

import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export const schema = z.object({
  id: z.number(),
  header: z.string(),
  type: z.string(),
  status: z.string(),
  target: z.string(),
  limit: z.string(),
  reviewer: z.string(),
})

// Create a separate component for the drag handle
function DragHandle({ id }: { id: number }) {
  const { attributes, listeners } = useSortable({
    id,
  })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <IconGripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "header",
    header: "Header",
    cell: ({ row }) => {
      return <TableCellViewer item={row.original} />
    },
    enableHiding: false,
  },
  {
    accessorKey: "type",
    header: "Section Type",
    cell: ({ row }) => (
      <div className="w-32">
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          {row.original.type}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-muted-foreground px-1.5">
        {row.original.status === "Done" ? (
          <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
        ) : (
          <IconLoader />
        )}
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "target",
    header: () => <div className="w-full text-right">Target</div>,
    cell: ({ row }) => (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
            loading: `Saving ${row.original.header}`,
            success: "Done",
            error: "Error",
          })
        }}
      >
        <Label htmlFor={`${row.original.id}-target`} className="sr-only">
          Target
        </Label>
        <Input
          className="hover:bg-input/30 focus-visible:bg-background dark:hover:bg-input/30 dark:focus-visible:bg-input/30 h-8 w-16 border-transparent bg-transparent text-right shadow-none focus-visible:border dark:bg-transparent"
          defaultValue={row.original.target}
          id={`${row.original.id}-target`}
        />
      </form>
    ),
  },
  {
    accessorKey: "limit",
    header: () => <div className="w-full text-right">Limit</div>,
    cell: ({ row }) => (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
            loading: `Saving ${row.original.header}`,
            success: "Done",
            error: "Error",
          })
        }}
      >
        <Label htmlFor={`${row.original.id}-limit`} className="sr-only">
          Limit
        </Label>
        <Input
          className="hover:bg-input/30 focus-visible:bg-background dark:hover:bg-input/30 dark:focus-visible:bg-input/30 h-8 w-16 border-transparent bg-transparent text-right shadow-none focus-visible:border dark:bg-transparent"
          defaultValue={row.original.limit}
          id={`${row.original.id}-limit`}
        />
      </form>
    ),
  },
  {
    accessorKey: "reviewer",
    header: "Reviewer",
    cell: ({ row }) => {
      const isAssigned = row.original.reviewer !== "Assign reviewer"

      if (isAssigned) {
        return row.original.reviewer
      }

      return (
        <>
          <Label htmlFor={`${row.original.id}-reviewer`} className="sr-only">
            Reviewer
          </Label>
          <Select>
            <SelectTrigger
              className="w-38 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
              size="sm"
              id={`${row.original.id}-reviewer`}
            >
              <SelectValue placeholder="Assign reviewer" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="Eddie Lake">Eddie Lake</SelectItem>
              <SelectItem value="Jamik Tashpulatov">
                Jamik Tashpulatov
              </SelectItem>
            </SelectContent>
          </Select>
        </>
      )
    },
  },
  {
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
            size="icon"
          >
            <IconDotsVertical />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Make a copy</DropdownMenuItem>
          <DropdownMenuItem>Favorite</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function DataTable({
  data: initialData,
}: {
  data: z.infer<typeof schema>[]
}) {
  const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  return (
    <Tabs
      defaultValue="outline"
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="outline">
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outline">Outline</SelectItem>
            <SelectItem value="past-performance">Past Performance</SelectItem>
            <SelectItem value="key-personnel">Key Personnel</SelectItem>
            <SelectItem value="focus-documents">Focus Documents</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="outline">Outline</TabsTrigger>
          <TabsTrigger value="past-performance">
            Past Performance <Badge variant="secondary">3</Badge>
          </TabsTrigger>
          <TabsTrigger value="key-personnel">
            Key Personnel <Badge variant="secondary">2</Badge>
          </TabsTrigger>
          <TabsTrigger value="focus-documents">Focus Documents</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <IconPlus />
            <span className="hidden lg:inline">Add Section</span>
          </Button>
        </div>
      </div>
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent
        value="past-performance"
        className="flex flex-col px-4 lg:px-6"
      >
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent value="key-personnel" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent
        value="focus-documents"
        className="flex flex-col px-4 lg:px-6"
      >
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
    </Tabs>
  )
}

const chartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
]

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--primary)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--primary)",
  },
} satisfies ChartConfig

function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
  const isMobile = useIsMobile()

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="text-foreground w-fit px-0 text-left">
          {item.header}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{item.header}</DrawerTitle>
          <DrawerDescription>
            Showing total visitors for the last 6 months
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          {!isMobile && (
            <>
              <ChartContainer config={chartConfig}>
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 0,
                    right: 10,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.slice(0, 3)}
                    hide
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Area
                    dataKey="mobile"
                    type="natural"
                    fill="var(--color-mobile)"
                    fillOpacity={0.6}
                    stroke="var(--color-mobile)"
                    stackId="a"
                  />
                  <Area
                    dataKey="desktop"
                    type="natural"
                    fill="var(--color-desktop)"
                    fillOpacity={0.4}
                    stroke="var(--color-desktop)"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>
              <Separator />
              <div className="grid gap-2">
                <div className="flex gap-2 leading-none font-medium">
                  Trending up by 5.2% this month{" "}
                  <IconTrendingUp className="size-4" />
                </div>
                <div className="text-muted-foreground">
                  Showing total visitors for the last 6 months. This is just
                  some random text to test the layout. It spans multiple lines
                  and should wrap around.
                </div>
              </div>
              <Separator />
            </>
          )}
          <form className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="header">Header</Label>
              <Input id="header" defaultValue={item.header} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="type">Type</Label>
                <Select defaultValue={item.type}>
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Table of Contents">
                      Table of Contents
                    </SelectItem>
                    <SelectItem value="Executive Summary">
                      Executive Summary
                    </SelectItem>
                    <SelectItem value="Technical Approach">
                      Technical Approach
                    </SelectItem>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Capabilities">Capabilities</SelectItem>
                    <SelectItem value="Focus Documents">
                      Focus Documents
                    </SelectItem>
                    <SelectItem value="Narrative">Narrative</SelectItem>
                    <SelectItem value="Cover Page">Cover Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="status">Status</Label>
                <Select defaultValue={item.status}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Done">Done</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Not Started">Not Started</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="target">Target</Label>
                <Input id="target" defaultValue={item.target} />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="limit">Limit</Label>
                <Input id="limit" defaultValue={item.limit} />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="reviewer">Reviewer</Label>
              <Select defaultValue={item.reviewer}>
                <SelectTrigger id="reviewer" className="w-full">
                  <SelectValue placeholder="Select a reviewer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Eddie Lake">Eddie Lake</SelectItem>
                  <SelectItem value="Jamik Tashpulatov">
                    Jamik Tashpulatov
                  </SelectItem>
                  <SelectItem value="Emily Whalen">Emily Whalen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </div>
        <DrawerFooter>
          <Button>Submit</Button>
          <DrawerClose asChild>
            <Button variant="outline">Done</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/login-form.tsx
================================================
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input id="password" type="password" required />
              </Field>
              <Field>
                <Button type="submit">Login</Button>
                <Button variant="outline" type="button">
                  Login with Google
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account? <a href="#">Sign up</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/nav-documents.tsx
================================================
"use client"

import {
  IconDots,
  IconFolder,
  IconShare3,
  IconTrash,
  type Icon,
} from "@tabler/icons-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavDocuments({
  items,
}: {
  items: {
    name: string
    url: string
    icon: Icon
  }[]
}) {
  const { isMobile } = useSidebar()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Documents</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild>
              <a href={item.url}>
                <item.icon />
                <span>{item.name}</span>
              </a>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction
                  showOnHover
                  className="data-[state=open]:bg-accent rounded-sm"
                >
                  <IconDots />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-24 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem>
                  <IconFolder />
                  <span>Open</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <IconShare3 />
                  <span>Share</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <IconTrash />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton className="text-sidebar-foreground/70">
            <IconDots className="text-sidebar-foreground/70" />
            <span>More</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/nav-main.tsx
================================================
"use client"

import { IconCirclePlusFilled, IconMail, type Icon } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
}) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Quick Create"
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
            >
              <IconCirclePlusFilled />
              <span>Quick Create</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <IconMail />
              <span className="sr-only">Inbox</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/nav-projects.tsx
================================================
"use client"

import {
  Folder,
  Forward,
  MoreHorizontal,
  Trash2,
  type LucideIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavProjects({
  projects,
}: {
  projects: {
    name: string
    url: string
    icon: LucideIcon
  }[]
}) {
  const { isMobile } = useSidebar()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild>
              <a href={item.url}>
                <item.icon />
                <span>{item.name}</span>
              </a>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem>
                  <Folder className="text-muted-foreground" />
                  <span>View Project</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Forward className="text-muted-foreground" />
                  <span>Share Project</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Trash2 className="text-muted-foreground" />
                  <span>Delete Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton className="text-sidebar-foreground/70">
            <MoreHorizontal className="text-sidebar-foreground/70" />
            <span>More</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/nav-secondary.tsx
================================================
"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <a href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/nav-user.tsx
================================================
"use client"

import {
  IconCreditCard,
  IconDotsVertical,
  IconLogout,
  IconNotification,
  IconUserCircle,
} from "@tabler/icons-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <IconUserCircle />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconCreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconNotification />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/otp-form.tsx
================================================
import { GalleryVerticalEnd } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"

export function OTPForm({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-6" />
              </div>
              <span className="sr-only">Acme Inc.</span>
            </a>
            <h1 className="text-xl font-bold">Enter verification code</h1>
            <FieldDescription>
              We sent a 6-digit code to your email address
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="otp" className="sr-only">
              Verification code
            </FieldLabel>
            <InputOTP
              maxLength={6}
              id="otp"
              required
              containerClassName="gap-4"
            >
              <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:h-16 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:text-xl">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:h-16 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:text-xl">
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <FieldDescription className="text-center">
              Didn&apos;t receive the code? <a href="#">Resend</a>
            </FieldDescription>
          </Field>
          <Field>
            <Button type="submit">Verify</Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/section-cards.tsx
================================================
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SectionCards() {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Revenue</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            $1,250.00
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Trending up this month <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Visitors for the last 6 months
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>New Customers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            1,234
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingDown />
              -20%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Down 20% this period <IconTrendingDown className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Acquisition needs attention
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Accounts</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            45,678
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Strong user retention <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Engagement exceed targets</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Growth Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            4.5%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +4.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Steady performance increase <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Meets growth projections</div>
        </CardFooter>
      </Card>
    </div>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/signup-form.tsx
================================================
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Full Name</FieldLabel>
              <Input id="name" type="text" placeholder="John Doe" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
              />
              <FieldDescription>
                We&apos;ll use this to contact you. We will not share your email
                with anyone else.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input id="password" type="password" required />
              <FieldDescription>
                Must be at least 8 characters long.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirm Password
              </FieldLabel>
              <Input id="confirm-password" type="password" required />
              <FieldDescription>Please confirm your password.</FieldDescription>
            </Field>
            <FieldGroup>
              <Field>
                <Button type="submit">Create Account</Button>
                <Button variant="outline" type="button">
                  Sign up with Google
                </Button>
                <FieldDescription className="px-6 text-center">
                  Already have an account? <a href="#">Sign in</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/site-header.tsx
================================================
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">Documents</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild size="sm" className="hidden sm:flex">
            <a
              href="https://github.com/shadcn-ui/ui/tree/main/apps/v4/app/(examples)/dashboard"
              rel="noopener noreferrer"
              target="_blank"
              className="dark:text-foreground"
            >
              GitHub
            </a>
          </Button>
        </div>
      </div>
    </header>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/team-switcher.tsx
================================================
"use client"

import * as React from "react"
import { ChevronsUpDown, Plus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}) {
  const { isMobile } = useSidebar()
  const [activeTeam, setActiveTeam] = React.useState(teams[0])

  if (!activeTeam) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <activeTeam.logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeTeam.name}</span>
                <span className="truncate text-xs">{activeTeam.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Teams
            </DropdownMenuLabel>
            {teams.map((team, index) => (
              <DropdownMenuItem
                key={team.name}
                onClick={() => setActiveTeam(team)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <team.logo className="size-3.5 shrink-0" />
                </div>
                {team.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">Add team</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/avatar.tsx
================================================
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/badge.tsx
================================================
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/breadcrumb.tsx
================================================
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

function Breadcrumb({ ...props }: React.ComponentProps<"nav">) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5",
        className
      )}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  )
}

function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn("hover:text-foreground transition-colors", className)}
      {...props}
    />
  )
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("text-foreground font-normal", className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  )
}

function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/button.tsx
================================================
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/calendar.tsx
================================================
"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:--spacing(8)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "flex gap-4 flex-col md:flex-row relative",
          defaultClassNames.months
        ),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) aria-disabled:opacity-50 p-0 select-none",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) aria-disabled:opacity-50 p-0 select-none",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex items-center justify-center h-(--cell-size) w-full px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-(--cell-size) gap-1.5",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative has-focus:border-ring border border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] rounded-md",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute bg-popover inset-0 opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-muted-foreground [&>svg]:size-3.5",
          defaultClassNames.caption_label
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] select-none",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        week_number_header: cn(
          "select-none w-(--cell-size)",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-[0.8rem] select-none text-muted-foreground",
          defaultClassNames.week_number
        ),
        day: cn(
          "relative w-full h-full p-0 text-center [&:last-child[data-selected=true]_button]:rounded-r-md group/day aspect-square select-none",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-md"
            : "[&:first-child[data-selected=true]_button]:rounded-l-md",
          defaultClassNames.day
        ),
        range_start: cn(
          "rounded-l-md bg-accent",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-accent", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/card.tsx
================================================
import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/chart.tsx
================================================
"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"]
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme || config.color
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: "line" | "dot" | "dashed"
    nameKey?: string
    labelKey?: string
  }) {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null
    }

    const [item] = payload
    const key = `${labelKey || item?.dataKey || item?.name || "value"}`
    const itemConfig = getPayloadConfigFromPayload(config, item, key)
    const value =
      !labelKey && typeof label === "string"
        ? config[label as keyof typeof config]?.label || label
        : itemConfig?.label

    if (labelFormatter) {
      return (
        <div className={cn("font-medium", labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      )
    }

    if (!value) {
      return null
    }

    return <div className={cn("font-medium", labelClassName)}>{value}</div>
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ])

  if (!active || !payload?.length) {
    return null
  }

  const nestLabel = payload.length === 1 && indicator !== "dot"

  return (
    <div
      className={cn(
        "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload
          .filter((item) => item.type !== "none")
          .map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor = color || item.payload.fill || item.color

            return (
              <div
                key={item.dataKey}
                className={cn(
                  "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
                  indicator === "dot" && "items-center"
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn(
                            "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
                            {
                              "h-2.5 w-2.5": indicator === "dot",
                              "w-1": indicator === "line",
                              "w-0 border-[1.5px] border-dashed bg-transparent":
                                indicator === "dashed",
                              "my-0.5": nestLabel && indicator === "dashed",
                            }
                          )}
                          style={
                            {
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center"
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label || item.name}
                        </span>
                      </div>
                      {item.value && (
                        <span className="text-foreground font-mono font-medium tabular-nums">
                          {item.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: React.ComponentProps<"div"> &
  Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
    hideIcon?: boolean
    nameKey?: string
  }) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload
        .filter((item) => item.type !== "none")
        .map((item) => {
          const key = `${nameKey || item.dataKey || "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)

          return (
            <div
              key={item.value}
              className={cn(
                "[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
    </div>
  )
}

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/checkbox.tsx
================================================
"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/collapsible.tsx
================================================
"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/drawer.tsx
================================================
"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content bg-background fixed z-50 flex h-auto flex-col",
          "data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b",
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t",
          "data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm",
          "data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        <div className="bg-muted mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5 md:text-left",
        className
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/dropdown-menu.tsx
================================================
"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/field.tsx
================================================
"use client"

import { useMemo } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-6",
        "has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-3 font-medium",
        "data-[variant=legend]:text-base",
        "data-[variant=label]:text-sm",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4",
        className
      )}
      {...props}
    />
  )
}

const fieldVariants = cva(
  "group/field flex w-full gap-3 data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: ["flex-col [&>*]:w-full [&>.sr-only]:w-auto"],
        horizontal: [
          "flex-row items-center",
          "[&>[data-slot=field-label]]:flex-auto",
          "has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
        responsive: [
          "flex-col [&>*]:w-full [&>.sr-only]:w-auto @md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto",
          "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
          "@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
)

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "group/field-content flex flex-1 flex-col gap-1.5 leading-snug",
        className
      )}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-4",
        "has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-primary/10",
        className
      )}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-2 text-sm leading-snug font-medium group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-muted-foreground text-sm leading-normal font-normal group-has-[[data-orientation=horizontal]]/field:text-balance",
        "last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5",
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
        className
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="bg-background text-muted-foreground relative mx-auto block w-fit px-2"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors?.length) {
      return null
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ]

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    )
  }, [children, errors])

  if (!content) {
    return null
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-destructive text-sm font-normal", className)}
      {...props}
    >
      {content}
    </div>
  )
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/input-otp.tsx
================================================
"use client"

import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-disabled:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center", className)}
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number
}) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:ring-destructive/20 dark:data-[active=true]:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive dark:bg-input/30 border-input relative flex h-9 w-9 items-center justify-center border-y border-r text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:ring-[3px]",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <MinusIcon />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/input.tsx
================================================
import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/label.tsx
================================================
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/select.tsx
================================================
"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "popper",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/separator.tsx
================================================
"use client"

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/sheet.tsx
================================================
"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/sidebar.tsx
================================================
"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { PanelLeftIcon } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open]
  )

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn("size-7", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "bg-background relative flex w-full flex-1 flex-col",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("bg-background h-8 w-full shadow-none", className)}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("bg-sidebar-border mx-2 w-auto", className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        "text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot : "button"
  const { isMobile, state } = useSidebar()

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  )

  if (!tooltip) {
    return button
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltip}
      />
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  showOnHover?: boolean
}) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean
}) {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative", className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  asChild = false,
  size = "md",
  isActive = false,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean
  size?: "sm" | "md"
  isActive?: boolean
}) {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/skeleton.tsx
================================================
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/sonner.tsx
================================================
"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/table.tsx
================================================
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/tabs.tsx
================================================
"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/toggle-group.tsx
================================================
"use client"

import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
  }
>({
  size: "default",
  variant: "default",
  spacing: 0,
})

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 0,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    spacing?: number
  }) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10",
        "data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l",
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

export { ToggleGroup, ToggleGroupItem }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/toggle.tsx
================================================
"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }



================================================
FILE: packages/benchmarks/shadcn-dashboard/components/ui/tooltip.tsx
================================================
"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }



================================================
FILE: packages/benchmarks/shadcn-dashboard/hooks/use-mobile.ts
================================================
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}



================================================
FILE: packages/benchmarks/shadcn-dashboard/lib/utils.ts
================================================
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}



================================================
FILE: packages/next-playground/instrumentation-client.ts
================================================
import "react-grab";



================================================
FILE: packages/next-playground/next.config.ts
================================================
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;



================================================
FILE: packages/next-playground/package.json
================================================
{
  "name": "@react-grab/next-playground",
  "version": "0.1.0",
  "private": true,
  "exports": {
    "./components/*": "./components/*.tsx"
  },
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "react-grab": "workspace:*",
    "bippy": "^0.5.11",
    "clsx": "^2.1.1",
    "next": "15.3.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "15.3.2",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}



================================================
FILE: packages/next-playground/postcss.config.mjs
================================================
const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;



================================================
FILE: packages/next-playground/tsconfig.json
================================================
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}



================================================
FILE: packages/next-playground/app/globals.css
================================================
@import 'tailwindcss';

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}



================================================
FILE: packages/next-playground/app/layout.tsx
================================================
import type { Metadata } from 'next';

import { Geist, Geist_Mono } from 'next/font/google';

import './globals.css';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  description: '',
  title: 'playground',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}



================================================
FILE: packages/next-playground/app/page.tsx
================================================
import { TodoList } from "../components/todo-list";

export default function Home() {
  return (
    <div className="p-12 flex flex-col gap-4">
      <TodoList />
    </div>
  );
}



================================================
FILE: packages/next-playground/components/cn.tsx
================================================
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}



================================================
FILE: packages/next-playground/components/todo-item.tsx
================================================
"use client";

interface Todo {
  id: number;
  title: string;
}

export function TodoItem({ todo }: { todo: Todo }) {
  return (
    <li>
      <span>{todo.title}</span>
    </li>
  );
}



================================================
FILE: packages/next-playground/components/todo-list.tsx
================================================
"use client";

import { TodoItem } from "./todo-item";

const todos = [
  { id: 1, title: "Buy groceries" },
  { id: 2, title: "Write a blog post" },
  { id: 3, title: "Build a new feature" },
  { id: 4, title: "Fix a bug" },
  { id: 5, title: "Refactor code" },
  { id: 6, title: "Write tests" },
  { id: 7, title: "Write documentation" },
  { id: 8, title: "Build a new website" },
  { id: 9, title: "Build a new mobile app" },
  { id: 10, title: "Build a new desktop app" },
];

export const TodoList = () => {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1>Todo List</h1>
      </div>
      <ul className="list-disc list-inside">
        {todos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
      </ul>
    </div>
  );
};



================================================
FILE: packages/react-grab/README.md
================================================
# <img src="https://github.com/aidenybai/react-grab/blob/main/.github/public/logo.png?raw=true" width="60" align="center" /> React Grab

[![size](https://img.shields.io/bundlephobia/minzip/react-grab?label=gzip&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/package/react-grab)
[![version](https://img.shields.io/npm/v/react-grab?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/react-grab)
[![downloads](https://img.shields.io/npm/dt/react-grab.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/react-grab)

React Grab allows you to select an element and copy its context (like HTML, React component, and file source)

It makes tools like Cursor, Claude Code, Copilot run up to [**55% faster**](https://react-grab.com/blog/intro)

### [Try out a demo! →](https://react-grab.com)

![Demo](https://react-grab.com/demo.gif)

## Install

> [**Install using Cursor**](https://cursor.com/link/prompt?text=1.+Run+curl+-s+https%3A%2F%2Freact-grab.com%2Fllms.txt+%0A2.+Understand+the+content+and+follow+the+instructions+to+install+React+Grab.%0A3.+Tell+the+user+to+refresh+their+local+app+and+explain+how+to+use+React+Grab)

Get started in 1 minute by adding this script tag to your app:

```html
<script
  src="//www.react-grab.com/script.js"
  crossorigin="anonymous"
></script>
```

If you're using a React framework or build tool, view instructions below:

#### Next.js (App router)

Add this inside of your `app/layout.tsx`:

```jsx
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {/* put this in the <head> */}
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        {/* rest of your scripts go under */}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

#### Next.js (Pages router)

Add this into your `pages/_document.tsx`:

```jsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* put this in the <Head> */}
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        {/* rest of your scripts go under */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

#### Vite

Your `index.html` could look like this:

```html
<!doctype html>
<html lang="en">
  <head>
    <script type="module">
      // first npm i react-grab
      // then in head:
      if (import.meta.env.DEV) {
        import("react-grab");
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### Webpack

First, install React Grab:

```bash
npm install react-grab
```

Then add this at the top of your main entry file (e.g., `src/index.tsx` or `src/main.tsx`):

```tsx
if (process.env.NODE_ENV === "development") {
  import("react-grab");
}
```

## Extending React Grab

React Grab provides an public customization API. Check out the [type definitions](https://github.com/aidenybai/react-grab/blob/main/packages/react-grab/src/types.ts) to see all available options for extending React Grab.

```typescript
import { init } from "react-grab/core";

const api = init({
  theme: {
    enabled: true, // disable all UI by setting to false
    hue: 180, // shift colors by 180 degrees (pink → cyan/turquoise)
    crosshair: {
      enabled: false, // disable crosshair
    },
    elementLabel: {
      // when hovering over an element
      backgroundColor: "#000000",
      textColor: "#ffffff",
    },
  },

  onElementSelect: (element) => {
    console.log("Selected:", element);
  },
  onCopySuccess: (elements, content) => {
    console.log("Copied to clipboard:", content);
  },
  onStateChange: (state) => {
    console.log("Active:", state.isActive);
  },
});

api.activate();
api.copyElement(document.querySelector(".my-element"));
console.log(api.getState());
```

## Resources & Contributing Back

Want to try it out? Check the [our demo](https://react-grab.com).

Looking to contribute back? Check the [Contributing Guide](https://github.com/aidenybai/react-grab/blob/main/CONTRIBUTING.md) out.

Want to talk to the community? Hop in our [Discord](https://discord.com/invite/G7zxfUzkm7) and share your ideas and what you've build with React Grab.

Find a bug? Head over to our [issue tracker](https://github.com/aidenybai/react-grab/issues) and we'll do our best to help. We love pull requests, too!

We expect all contributors to abide by the terms of our [Code of Conduct](https://github.com/aidenybai/react-grab/blob/main/.github/CODE_OF_CONDUCT.md).

[**→ Start contributing on GitHub**](https://github.com/aidenybai/react-grab/blob/main/CONTRIBUTING.md)

### License

React Grab is MIT-licensed open-source software.



================================================
FILE: packages/react-grab/CHANGELOG.md
================================================
# react-grab

## 0.0.54

### Patch Changes

- log: false

## 0.0.53

### Patch Changes

- fix: focus states

## 0.0.52

### Patch Changes

- fix: copy states

## 0.0.51

### Patch Changes

- fix: jsdocs on theme prop values

## 0.0.50

### Patch Changes

- feat: extend API

## 0.0.49

### Patch Changes

- fix: reactivation bug

## 0.0.48

### Patch Changes

- fix: version fetching

## 0.0.47

### Patch Changes

- fix: use event code instead of event key

## 0.0.46

### Patch Changes

- fix: non-react projects

## 0.0.45

### Patch Changes

- feat: input

## 0.0.44

### Patch Changes

- fix: new log

## 0.0.43

### Patch Changes

- fix: new hooks

## 0.0.42

### Patch Changes

- fix: improve cursor

## 0.0.41

### Patch Changes

- fix: improved copy version

## 0.0.40

### Patch Changes

- fix: selection opacity

## 0.0.39

### Patch Changes

- fix: sourcemaps in prod

## 0.0.38

### Patch Changes

- fix: multi select

## 0.0.37

### Patch Changes

- fix: in Component

## 0.0.36

### Patch Changes

- fix: progress indicator

## 0.0.35

### Patch Changes

- fix: allow copying inside input

## 0.0.34

### Patch Changes

- fix: click thru

## 0.0.33

### Patch Changes

- fix: bug with optimisitc label

## 0.0.32

### Patch Changes

- fix: keybind issues

## 0.0.31

### Patch Changes

- fix: screenshotrs

## 0.0.30

### Patch Changes

- improvements to instrumentaiton

## 0.0.29

### Patch Changes

- fix: crosshair length

## 0.0.28

### Patch Changes

- fix: computed styles

## 0.0.27

### Patch Changes

- fix: sources

## 0.0.26

### Patch Changes

- performance

## 0.0.25

### Patch Changes

- new crosshair

## 0.0.24

### Patch Changes

- fix: issues

## 0.0.23

### Patch Changes

- fix: things

## 0.0.21

### Patch Changes

- fix: refactor code

## 0.0.20

### Patch Changes

- fix: circular references issue

## 0.0.19

### Patch Changes

- fix: react devtools and windows/linux compat

## 0.0.18

### Patch Changes

- fix: owner stack

## 0.0.17

### Patch Changes

- fix: sourcemaps

## 0.0.16

### Patch Changes

- fix: docs

## 0.0.15

### Patch Changes

- fix: ux fixes

## 0.0.14

### Patch Changes

- fix: key



================================================
FILE: packages/react-grab/eslint.config.js
================================================
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "eslint.config.mjs",
      "bundled_*.mjs",
      "*.mjs",
      "*.cjs",
      "*.js",
      "*.json",
      "*.md",
    ],
  },
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "import/order": "off",
    },
  },
);



================================================
FILE: packages/react-grab/package.json
================================================
{
  "name": "react-grab",
  "version": "0.0.54",
  "description": "Grab any element in your app and give it to Cursor, Claude Code, or other AI coding agents.",
  "keywords": [
    "react",
    "grab",
    "react",
    "agent",
    "context"
  ],
  "homepage": "https://react-grab.com",
  "bugs": {
    "url": "https://github.com/aidenybai/react-grab/issues"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/aidenybai/react-grab.git"
  },
  "license": "MIT",
  "author": {
    "name": "Aiden Bai",
    "email": "aiden@million.dev"
  },
  "type": "module",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./core": {
      "import": {
        "types": "./dist/core.d.ts",
        "default": "./dist/core.js"
      },
      "require": {
        "types": "./dist/core.d.cts",
        "default": "./dist/core.cjs"
      }
    },
    "./dist/*": "./dist/*.js",
    "./dist/*.js": "./dist/*.js",
    "./dist/*.cjs": "./dist/*.cjs",
    "./dist/*.mjs": "./dist/*.mjs"
  },
  "main": "dist/index.js",
  "module": "dist/index.js",
  "browser": "dist/index.global.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "bin",
    "package.json",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "css:build": "tailwindcss -i ./src/styles.css -o ./dist/styles.css -m",
    "css:watch": "tailwindcss -i ./src/styles.css -o ./dist/styles.css -w",
    "prebuild": "mkdir -p dist && tailwindcss -i ./src/styles.css -o ./dist/styles.css -m",
    "build": "NODE_ENV=production tsup",
    "dev": "concurrently \"pnpm:css:watch\" \"tsup --watch --ignore-watch dist\"",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write .",
    "check": "eslint src/**/*.ts && prettier --check .",
    "publint": "publint",
    "prepublishOnly": "pnpm build"
  },
  "devDependencies": {
    "@babel/core": "^7.28.5",
    "@babel/preset-typescript": "^7.28.5",
    "@tailwindcss/cli": "^4.1.17",
    "@types/node": "^20.19.23",
    "babel-preset-solid": "^1.9.10",
    "clsx": "^2.1.1",
    "concurrently": "^9.1.2",
    "esbuild-plugin-babel": "^0.2.3",
    "eslint": "^9.37.0",
    "publint": "^0.2.12",
    "tailwind-merge": "^2.5.5",
    "tailwindcss": "^4.1.0",
    "terser": "^5.36.0",
    "tsup": "^8.2.4",
    "typescript-eslint": "^8.46.1"
  },
  "publishConfig": {
    "access": "public"
  },
  "dependencies": {
    "bippy": "^0.5.16",
    "solid-js": "^1.9.10"
  }
}



================================================
FILE: packages/react-grab/tsconfig.json
================================================
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "module": "NodeNext",
    "esModuleInterop": true,
    "strictNullChecks": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "lib": ["esnext", "dom"]
  },
  "include": ["src", "tsup.config.ts", "esbuild-plugin-babel.d.ts"],
  "exclude": ["**/node_modules/**", "dist"]
}



================================================
FILE: packages/react-grab/tsup.config.ts
================================================
import fs from "node:fs";
import { defineConfig, type Options } from "tsup";
// @ts-expect-error -- esbuild-plugin-babel is not typed
import babel from "esbuild-plugin-babel";

const banner = `/**
 * @license MIT
 *
 * Copyright (c) 2025 Aiden Bai
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */`;

const DEFAULT_OPTIONS: Options = {
  banner: {
    js: banner,
  },
  clean: ["**/*", "!styles.css"],
  dts: true,
  entry: [],
  env: {
    NODE_ENV: process.env.NODE_ENV ?? "development",
    VERSION:
      process.env.VERSION ??
      (JSON.parse(fs.readFileSync("package.json", "utf8")) as { version: string })
        .version,
  },
  external: [],
  format: [],
  loader: {
    ".css": "text",
  },
  minify: false,
  noExternal: ["clsx", "tailwind-merge", "solid-js", "bippy"],
  onSuccess: process.env.COPY ? "pbcopy < ./dist/index.global.js" : undefined,
  outDir: "./dist",
  platform: "browser",
  sourcemap: false,
  splitting: false,
  target: "esnext",
  treeshake: true,
};

export default defineConfig([
  {
    ...DEFAULT_OPTIONS,
    entry: ["./src/index.ts"],
    format: ["iife"],
    globalName: "ReactGrab",
    loader: {
      ".css": "text",
    },
    minify: process.env.NODE_ENV === "production",
    outDir: "./dist",
    esbuildPlugins: [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- babel is not typed
      babel({
        filter: /\.(tsx|jsx)$/,
        config: {
          presets: [
            ["@babel/preset-typescript", { onlyRemoveTypeImports: true }],
            "babel-preset-solid",
          ],
        },
      }),
    ],
  },
  {
    ...DEFAULT_OPTIONS,
    clean: false,
    entry: ["./src/index.ts", "./src/core.tsx"],
    format: ["cjs", "esm"],
    loader: {
      ".css": "text",
    },
    outDir: "./dist",
    splitting: true,
    esbuildPlugins: [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- babel is not typed
      babel({
        filter: /\.(tsx|jsx)$/,
        config: {
          presets: [
            ["@babel/preset-typescript", { onlyRemoveTypeImports: true }],
            "babel-preset-solid",
          ],
        },
      }),
    ],
  },
]);



================================================
FILE: packages/react-grab/src/constants.ts
================================================
export const VIEWPORT_MARGIN_PX = 8;
export const INDICATOR_CLAMP_PADDING_PX = 4;
export const CURSOR_OFFSET_PX = 14;
export const OFFSCREEN_POSITION = -1000;

export const SELECTION_LERP_FACTOR = 0.95;

export const SUCCESS_LABEL_DURATION_MS = 1700;
export const PROGRESS_INDICATOR_DELAY_MS = 150;

export const DRAG_THRESHOLD_PX = 2;

export const AUTO_SCROLL_EDGE_THRESHOLD_PX = 25;
export const AUTO_SCROLL_SPEED_PX = 10;

export const Z_INDEX_CROSSHAIR = 2147483645;
export const Z_INDEX_SELECTION = 2147483646;
export const Z_INDEX_LABEL = 2147483647;

export const BRAND_COLOR_RGB = "210, 57, 192";
export const BRAND_COLOR_HEX = "#b21c8e";



================================================
FILE: packages/react-grab/src/index.ts
================================================
export { init } from "./core.js";
export {
  getStack,
  formatStack,
  getHTMLPreview,
  getNearestComponentName,
  isInstrumentationActive,
  DEFAULT_THEME,
} from "./core.js";
export type {
  Options,
  ReactGrabAPI,
  Theme,
  ReactGrabState,
  RenderType,
  RenderData,
  OverlayBounds,
  GrabbedBox,
  DragRect,
  Rect,
  Position,
  DeepPartial,
  SuccessLabelType,
  ElementLabelVariant,
  InputModeContext,
  SuccessLabelContext,
  CrosshairContext,
  ElementLabelContext,
} from "./types.js";

import { init } from "./core.js";
import type { ReactGrabAPI } from "./types.js";

declare global {
  interface Window {
    __REACT_GRAB__?: ReactGrabAPI;
  }
}

let globalApi: ReactGrabAPI | null = null;

export const getGlobalApi = (): ReactGrabAPI | null => {
  return window.__REACT_GRAB__ ?? globalApi ?? null;
};

export const setGlobalApi = (api: ReactGrabAPI | null): void => {
  globalApi = api;
  if (typeof window !== "undefined") {
    if (api) {
      window.__REACT_GRAB__ = api;
    } else {
      delete window.__REACT_GRAB__;
    }
  }
};

if (typeof window !== "undefined") {
  if (window.__REACT_GRAB__) {
    globalApi = window.__REACT_GRAB__;
  } else {
    globalApi = init();
    window.__REACT_GRAB__ = globalApi;
    window.dispatchEvent(
      new CustomEvent("react-grab:init", { detail: globalApi }),
    );
  }
}



================================================
FILE: packages/react-grab/src/instrumentation.ts
================================================
import {
  getDisplayName,
  getFiberFromHostInstance,
  getLatestFiber,
  isCompositeFiber,
  isFiber,
  isHostFiber,
  traverseFiber,
  isInstrumentationActive,
} from "bippy";

import {
  FiberSource,
  getSource,
  isSourceFile,
  normalizeFileName,
} from "bippy/source";
import { isCapitalized } from "./utils/is-capitalized.js";

const NEXT_INTERNAL_COMPONENT_NAMES = [
  "InnerLayoutRouter",
  "RedirectErrorBoundary",
  "RedirectBoundary",
  "HTTPAccessFallbackErrorBoundary",
  "HTTPAccessFallbackBoundary",
  "LoadingBoundary",
  "ErrorBoundary",
  "InnerScrollAndFocusHandler",
  "ScrollAndFocusHandler",
  "RenderFromTemplateContext",
  "OuterLayoutRouter",
  "body",
  "html",
  "RedirectErrorBoundary",
  "RedirectBoundary",
  "HTTPAccessFallbackErrorBoundary",
  "HTTPAccessFallbackBoundary",
  "DevRootHTTPAccessFallbackBoundary",
  "AppDevOverlayErrorBoundary",
  "AppDevOverlay",
  "HotReload",
  "
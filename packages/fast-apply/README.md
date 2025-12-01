# @ai-cluso/fast-apply

Local AI model for instant code merging using [Kortix Fast Apply](https://github.com/kortix-ai/fast-apply).

## Features

- **Fast**: ~500ms per code merge (after model load)
- **Offline**: Works without internet once model is downloaded
- **Free**: No API costs after initial download
- **Private**: All inference happens locally

## Installation

```bash
npm install @ai-cluso/fast-apply
```

## Quick Start

```typescript
import { FastApply } from '@ai-cluso/fast-apply'

const fastApply = new FastApply({
  storageDir: '~/.myapp/models',
  autoDownload: true,
})

// Listen for download progress
fastApply.on('download:progress', (progress) => {
  console.log(`Downloading: ${progress.percent}%`)
})

// Apply a code change
const result = await fastApply.apply(
  originalCode,
  'Change the button color to blue'
)

if (result.success) {
  console.log('Merged code:', result.code)
}
```

## Available Models

| Variant | Size | Quality | Memory Required |
|---------|------|---------|-----------------|
| Q4_K_M | 986 MB | Good | ~1.5 GB |
| Q5_K_M | 1.13 GB | Better | ~1.7 GB |
| Q8_0 | 1.65 GB | High | ~2.2 GB |
| F16 | 3.09 GB | Maximum | ~4 GB |

## API

### Constructor

```typescript
new FastApply(options?: FastApplyOptions)
```

Options:
- `storageDir`: Directory for downloaded models (default: `~/.cluso/models/fast-apply`)
- `defaultModel`: Model variant to use (default: `Q4_K_M`)
- `autoDownload`: Auto-download if model not present (default: `false`)

### Methods

#### Model Management

```typescript
// List all available models
const models = await fastApply.listModels()

// Get currently active model
const active = fastApply.getActiveModel() // 'Q4_K_M' | null

// Set active model (downloads if needed)
await fastApply.setActiveModel('Q8_0')
```

#### Download

```typescript
// Download a model
const path = await fastApply.download('Q4_K_M')

// Cancel download
fastApply.cancelDownload()

// Delete a model
await fastApply.deleteModel('Q4_K_M')
```

#### Inference

```typescript
// Apply code changes
const result = await fastApply.apply(originalCode, updateDescription)

// Result shape
{
  success: boolean
  code?: string       // Merged code
  error?: string      // Error if failed
  durationMs?: number // Time taken
}
```

#### Lifecycle

```typescript
// Get status
const status = await fastApply.getStatus()

// Unload to free memory
await fastApply.unload()

// Dispose when done
await fastApply.dispose()
```

### Events

```typescript
fastApply.on('download:progress', (progress) => {
  console.log(`${progress.percent}% - ${progress.speed} bytes/s`)
})

fastApply.on('download:complete', (path) => {
  console.log(`Downloaded to ${path}`)
})

fastApply.on('download:error', (error) => {
  console.error('Download failed:', error)
})

fastApply.on('model:loaded', () => {
  console.log('Model ready for inference')
})

fastApply.on('model:unloaded', () => {
  console.log('Model unloaded')
})
```

## How It Works

Fast Apply uses a fine-tuned 1.5B parameter model specifically trained for code merging:

1. Takes original code and a description/snippet of changes
2. Produces the complete merged code preserving structure and style
3. Uses the ChatML prompt format with `<updated-code>` tags for output

The model is based on Qwen2.5-Coder and runs locally via [node-llama-cpp](https://github.com/withcatai/node-llama-cpp).

## License

MIT

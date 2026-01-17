#!/usr/bin/env node
/**
 * Test script for Agent SDK debugging
 * Run with: node test-agent-sdk.js
 */

const { query } = require('@anthropic-ai/claude-agent-sdk')
const path = require('path')
const os = require('os')
const { existsSync } = require('fs')

// Find Claude CLI
function findClaudeCli() {
  const paths = [
    path.join(os.homedir(), '.nvm/versions/node/v22.13.1/bin/claude'),
    path.join(os.homedir(), '.nvm/versions/node/v20.18.1/bin/claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    path.join(os.homedir(), '.local/bin/claude'),
  ]

  for (const p of paths) {
    if (existsSync(p)) {
      console.log('Found Claude CLI at:', p)
      return p
    }
  }

  console.log('Claude CLI not found, using SDK bundled CLI')
  return undefined
}

async function main() {
  console.log('=== Agent SDK Test ===')
  console.log('Time:', new Date().toISOString())
  console.log('Node version:', process.version)
  console.log('CWD:', process.cwd())

  const cliPath = findClaudeCli()

  console.log('\nStarting query session...')
  const startTime = Date.now()

  try {
    // Simple message generator
    async function* messageGenerator() {
      yield {
        role: 'user',
        content: [{ type: 'text', text: 'Say "Hello test!" and nothing else.' }]
      }
    }

    const session = query({
      prompt: messageGenerator(),
      options: {
        model: 'claude-haiku-4-5-20251001',
        maxThinkingTokens: 0,
        settingSources: ['project'],
        permissionMode: 'acceptEdits',
        allowedTools: [],
        pathToClaudeCodeExecutable: cliPath,
        cwd: process.cwd(),
        includePartialMessages: true,
      },
    })

    console.log('Query session created in', Date.now() - startTime, 'ms')
    console.log('Waiting for stream events...\n')

    // Add timeout
    const timeout = setTimeout(() => {
      console.error('\n=== TIMEOUT: No response after 30 seconds ===')
      process.exit(1)
    }, 30000)

    let fullText = ''
    let eventCount = 0

    for await (const event of session) {
      eventCount++
      console.log(`[Event ${eventCount}] Type:`, event.type)

      if (event.type === 'stream_event') {
        const e = event.event
        console.log('  Stream event:', e.type)

        if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
          fullText += e.delta.text
          process.stdout.write(e.delta.text)
        }
      } else if (event.type === 'result') {
        console.log('  Result received')
      } else if (event.type === 'error') {
        console.error('  Error:', event.error)
      }
    }

    clearTimeout(timeout)

    console.log('\n\n=== Complete ===')
    console.log('Total events:', eventCount)
    console.log('Full text:', fullText)
    console.log('Total time:', Date.now() - startTime, 'ms')

  } catch (error) {
    console.error('\n=== Error ===')
    console.error('Message:', error.message)
    console.error('Stack:', error.stack)
    if (error.exitCode) console.error('Exit code:', error.exitCode)
    process.exit(1)
  }
}

main()

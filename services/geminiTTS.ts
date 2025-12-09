/**
 * Gemini TTS Service
 *
 * Uses Gemini's native voice to speak text instead of browser speechSynthesis.
 * Supports multiple voices for demos (user voice vs app voice).
 */

// Buffer polyfill for browser (needed by @google/genai Live API)
import { Buffer } from 'buffer'
if (typeof window !== 'undefined' && !window.Buffer) {
  (window as any).Buffer = Buffer
}

import { GoogleGenAI, Modality } from '@google/genai'
import { pcmToAudioBuffer } from '../utils/audio'

let client: GoogleGenAI | null = null
let audioContext: AudioContext | null = null
let currentSources: Set<AudioBufferSourceNode> = new Set()
let nextStartTime = 0

// Available Gemini voices
export type GeminiVoice = 'Zephyr' | 'Puck' | 'Kore' | 'Charon' | 'Fenrir' | 'Aoede'

// Default voices for demo roles
export const DEMO_VOICES = {
  user: 'Puck' as GeminiVoice,    // Friendly, casual voice for "user"
  app: 'Zephyr' as GeminiVoice,   // Professional voice for "app/AI"
}

// Initialize with API key
export function initGeminiTTS(apiKey: string) {
  console.log('[GeminiTTS] Initializing with API key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'MISSING')
  client = new GoogleGenAI({ apiKey })
  console.log('[GeminiTTS] Client created successfully')
  return true
}

// Speak text using specified Gemini voice (uses Live API like useLiveGemini)
export async function speakWithGemini(text: string, voice: GeminiVoice = 'Zephyr'): Promise<void> {
  if (!client) {
    console.warn('[GeminiTTS] Not initialized, falling back to browser TTS')
    fallbackSpeak(text)
    return
  }

  try {
    // Create audio context if needed
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioContext({ sampleRate: 24000 })
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    // Stop any currently playing audio
    stopGeminiTTS()
    nextStartTime = audioContext.currentTime

    console.log(`[GeminiTTS] Speaking with voice "${voice}": ${text.substring(0, 50)}...`)

    // Use live.connect exactly like useLiveGemini does
    const modelName = 'gemini-2.5-flash-native-audio-preview-09-2025'
    console.log(`[GeminiTTS] Connecting to ${modelName}...`)

    const session = await client.live.connect({
      model: modelName,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
        systemInstruction: 'You are a voice assistant. Speak the text exactly as provided, nothing more.',
      },
    })

    console.log('[GeminiTTS] Session connected')

    // Collect all audio chunks
    let audioComplete = false

    session.on('audio', async (data: { data: string }) => {
      if (data.data && audioContext) {
        console.log('[GeminiTTS] Received audio chunk')
        const rawData = Uint8Array.from(atob(data.data), c => c.charCodeAt(0))
        const buffer = await pcmToAudioBuffer(rawData, audioContext, 24000)

        const source = audioContext.createBufferSource()
        source.buffer = buffer
        source.connect(audioContext.destination)

        const startAt = Math.max(audioContext.currentTime, nextStartTime)
        source.start(startAt)
        nextStartTime = startAt + buffer.duration

        source.onended = () => currentSources.delete(source)
        currentSources.add(source)
      }
    })

    session.on('close', () => {
      console.log('[GeminiTTS] Session closed')
      audioComplete = true
    })

    // Send the text to speak
    console.log('[GeminiTTS] Sending text to speak...')
    await session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text: `Say exactly: "${text}"` }] }],
      turnComplete: true,
    })

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 2000 + text.length * 50))
    session.close()

    // Wait for audio to finish playing
    const remainingTime = nextStartTime - (audioContext?.currentTime || 0)
    if (remainingTime > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingTime * 1000 + 300))
    }

  } catch (error) {
    console.error('[GeminiTTS] FAILED - Error details:', error)
    console.error('[GeminiTTS] Error name:', (error as Error)?.name)
    console.error('[GeminiTTS] Error message:', (error as Error)?.message)
    console.error('[GeminiTTS] Falling back to browser TTS')
    fallbackSpeak(text)
  }
}

// Speak as "user" voice
export async function speakAsUser(text: string): Promise<void> {
  return speakWithGemini(text, DEMO_VOICES.user)
}

// Speak as "app" voice
export async function speakAsApp(text: string): Promise<void> {
  return speakWithGemini(text, DEMO_VOICES.app)
}

// Run a demo conversation between user and app voices
export interface DemoLine {
  role: 'user' | 'app'
  text: string
  action?: () => void | Promise<void>  // Optional UI action to run with this line
}

export async function runDemoConversation(lines: DemoLine[], delayBetween = 500): Promise<void> {
  console.log('[GeminiTTS] Starting demo conversation with', lines.length, 'lines')

  for (const line of lines) {
    // Run any associated action first
    if (line.action) {
      await line.action()
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    // Speak the line
    if (line.role === 'user') {
      await speakAsUser(line.text)
    } else {
      await speakAsApp(line.text)
    }

    // Delay between lines
    await new Promise(resolve => setTimeout(resolve, delayBetween))
  }

  console.log('[GeminiTTS] Demo conversation complete')
}

// Browser TTS fallback
function fallbackSpeak(text: string) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.1
    speechSynthesis.speak(utterance)
  }
}

// Stop any playing audio
export function stopGeminiTTS() {
  currentSources.forEach(src => {
    try { src.stop() } catch {}
  })
  currentSources.clear()
}

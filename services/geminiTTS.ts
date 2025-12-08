/**
 * Gemini TTS Service
 *
 * Uses Gemini's native voice to speak text instead of browser speechSynthesis.
 * Supports multiple voices for demos (user voice vs app voice).
 */

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
  client = new GoogleGenAI({ apiKey })
  return true
}

// Speak text using specified Gemini voice
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

    // Connect to Gemini Live for TTS
    const session = await client.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    })

    // Promise to track completion
    let resolveComplete: () => void
    const completePromise = new Promise<void>(resolve => { resolveComplete = resolve })

    session.on('audio', async (data: { data: string }) => {
      if (data.data && audioContext) {
        const rawData = Uint8Array.from(atob(data.data), c => c.charCodeAt(0))
        const audioBuffer = await pcmToAudioBuffer(rawData, audioContext, 24000)

        const source = audioContext.createBufferSource()
        source.buffer = audioBuffer
        source.connect(audioContext.destination)

        const startAt = Math.max(audioContext.currentTime, nextStartTime)
        source.start(startAt)
        nextStartTime = startAt + audioBuffer.duration

        source.onended = () => currentSources.delete(source)
        currentSources.add(source)
      }
    })

    session.on('close', () => resolveComplete!())

    // Send the text to speak
    await session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text: `Say exactly this: "${text}"` }] }],
      turnComplete: true,
    })

    // Wait for audio to be received then close
    await new Promise(resolve => setTimeout(resolve, 1500 + text.length * 40))
    session.close()

    // Wait for all audio to finish playing
    const audioEndTime = nextStartTime - (audioContext?.currentTime || 0)
    if (audioEndTime > 0) {
      await new Promise(resolve => setTimeout(resolve, audioEndTime * 1000 + 200))
    }

  } catch (error) {
    console.error('[GeminiTTS] Error:', error)
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

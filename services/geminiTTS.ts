/**
 * Gemini TTS Service
 *
 * Uses Gemini's native voice to speak text instead of browser speechSynthesis.
 * Connects to Gemini Live API with audio output only.
 */

import { GoogleGenAI, Modality } from '@google/genai'
import { pcmToAudioBuffer } from '../utils/audio'

let client: GoogleGenAI | null = null
let audioContext: AudioContext | null = null
let currentSources: Set<AudioBufferSourceNode> = new Set()
let nextStartTime = 0

// Initialize with API key
export function initGeminiTTS(apiKey: string) {
  client = new GoogleGenAI({ apiKey })
  return true
}

// Speak text using Gemini's native voice
export async function speakWithGemini(text: string): Promise<void> {
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
    currentSources.forEach(src => {
      try { src.stop() } catch {}
    })
    currentSources.clear()
    nextStartTime = audioContext.currentTime

    // Connect to Gemini Live for TTS
    const session = await client.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
      },
    })

    // Collect audio chunks
    const audioChunks: ArrayBuffer[] = []

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

    // Send the text to speak
    await session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text: `Say exactly this: "${text}"` }] }],
      turnComplete: true,
    })

    // Wait for response to complete then close
    await new Promise(resolve => setTimeout(resolve, 2000 + text.length * 50))
    session.close()

  } catch (error) {
    console.error('[GeminiTTS] Error:', error)
    fallbackSpeak(text)
  }
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

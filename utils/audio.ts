import { Blob } from '@google/genai';

// Converts Float32Array (from AudioContext) to Int16Array (for Gemini API)
export function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const buffer = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return buffer;
}

// Encodes Int16Array to base64 string
export function base64EncodeAudio(int16Array: Int16Array): string {
  let binary = '';
  const bytes = new Uint8Array(int16Array.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to create the Blob structure expected by the SDK
export function createAudioBlob(inputData: Float32Array): Blob {
  const int16 = floatTo16BitPCM(inputData);
  const base64Data = base64EncodeAudio(int16);
  return {
    data: base64Data,
    mimeType: 'audio/pcm;rate=16000',
  };
}

// Decodes base64 string to Uint8Array
export function base64ToArrayBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Converts raw PCM data (from Gemini) to an AudioBuffer for playback
export async function pcmToAudioBuffer(
  pcmData: Uint8Array,
  audioContext: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(pcmData.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalize Int16 to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

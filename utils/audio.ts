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

// Play a simple tone for audio feedback (approval/rejection/undo sounds)
export async function playTone(
  frequency: number = 440,
  duration: number = 100,
  volume: number = 0.3,
  type: 'sine' | 'square' | 'triangle' = 'sine'
): Promise<void> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);

    await new Promise(resolve => setTimeout(resolve, duration));
  } catch (err) {
    console.error('[Audio] Failed to play tone:', err);
  }
}

// Play a confirmation beep (ascending two-tone)
export async function playApprovalSound(): Promise<void> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;

    // First tone: 600 Hz for 100ms
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.frequency.value = 600;
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    // Second tone: 800 Hz for 100ms, delayed
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.frequency.value = 800;
    gain2.gain.setValueAtTime(0.25, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.15);

    await new Promise(resolve => setTimeout(resolve, 150));
  } catch (err) {
    console.error('[Audio] Failed to play approval sound:', err);
  }
}

// Play a rejection beep (descending two-tone)
export async function playRejectionSound(): Promise<void> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;

    // First tone: 800 Hz for 100ms
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.frequency.value = 800;
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    // Second tone: 500 Hz for 100ms, delayed
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.frequency.value = 500;
    gain2.gain.setValueAtTime(0.25, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.15);

    await new Promise(resolve => setTimeout(resolve, 150));
  } catch (err) {
    console.error('[Audio] Failed to play rejection sound:', err);
  }
}

// Play an undo beep (swirling three-tone)
export async function playUndoSound(): Promise<void> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;

    // Three descending tones
    const frequencies = [700, 600, 500];
    const startTimes = [0, 0.05, 0.1];

    frequencies.forEach((freq, idx) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, now + startTimes[idx]);
      gain.gain.exponentialRampToValueAtTime(0.01, now + startTimes[idx] + 0.08);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(now + startTimes[idx]);
      osc.stop(now + startTimes[idx] + 0.08);
    });

    await new Promise(resolve => setTimeout(resolve, 180));
  } catch (err) {
    console.error('[Audio] Failed to play undo sound:', err);
  }
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { createAudioBlob, base64ToArrayBuffer, pcmToAudioBuffer } from '../utils/audio';
import { StreamState } from '../types';

interface UseLiveGeminiParams {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onCodeUpdate?: (code: string) => void;
}

const updateUiTool: FunctionDeclaration = {
  name: 'update_ui',
  description: 'Update the user interface code (HTML/CSS/JS) based on the users request. Return the FULL updated HTML file content.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      html: {
        type: Type.STRING,
        description: 'The full HTML code for the page, including styles and scripts.',
      },
    },
    required: ['html'],
  },
};

export function useLiveGemini({ videoRef, canvasRef, onCodeUpdate }: UseLiveGeminiParams) {
  const [streamState, setStreamState] = useState<StreamState>({
    isConnected: false,
    isStreaming: false,
    error: null,
  });
  
  const [volume, setVolume] = useState(0);

  // Using any for session promise type as LiveSession is not exported
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const cleanup = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();

    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    if (sessionPromiseRef.current) {
       sessionPromiseRef.current.then(session => session.close());
       sessionPromiseRef.current = null;
    }

    setStreamState(prev => ({ ...prev, isConnected: false, isStreaming: false }));
    setVolume(0);
  }, []);

  const connect = useCallback(async () => {
    try {
      setStreamState({ isConnected: false, isStreaming: true, error: null });

      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API_KEY not found in environment");
      aiRef.current = new GoogleGenAI({ apiKey });

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      analyserRef.current = outputAudioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const sessionPromise = aiRef.current.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          tools: [{ functionDeclarations: [updateUiTool] }],
          systemInstruction: `You are a specialized AI UI Engineer. 
          You can see the user's screen or video feed if enabled.
          You can hear the user.
          Your primary job is to update the UI code based on the user's verbal or visual instructions.
          When the user asks to change the code, you MUST use the 'update_ui' tool to send the new HTML.
          Be concise in your spoken responses.`,
        },
        callbacks: {
          onopen: () => {
            console.log("Connection Opened");
            setStreamState(prev => ({ ...prev, isConnected: true }));
            
            if (!inputAudioContextRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
               const inputData = e.inputBuffer.getChannelData(0);
               const blob = createAudioBlob(inputData);
               
               sessionPromiseRef.current?.then(session => {
                 session.sendRealtimeInput({ media: blob });
               });
            };
            
            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
            scriptProcessorRef.current = processor;
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Tool Calls (Code Updates)
            if (message.toolCall) {
                console.log("Tool call received", message.toolCall);
                const functionCalls = message.toolCall.functionCalls;
                if (functionCalls && functionCalls.length > 0) {
                    const call = functionCalls[0];
                    if (call.name === 'update_ui') {
                        const newHtml = (call.args as any).html;
                        console.log("Updating UI with new code");
                        if (onCodeUpdate && newHtml) {
                            onCodeUpdate(newHtml);
                        }
                        
                        // Respond to the tool call
                        sessionPromiseRef.current?.then(session => {
                            session.sendToolResponse({
                                functionResponses: {
                                    id: call.id,
                                    name: call.name,
                                    response: { result: "UI Updated Successfully" }
                                }
                            });
                        });
                    }
                }
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
               const ctx = outputAudioContextRef.current;
               const rawData = base64ToArrayBuffer(base64Audio);
               const audioBuffer = await pcmToAudioBuffer(rawData, ctx, 24000);
               
               const now = ctx.currentTime;
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
               
               const source = ctx.createBufferSource();
               source.buffer = audioBuffer;
               
               if (analyserRef.current) {
                 source.connect(analyserRef.current);
                 analyserRef.current.connect(ctx.destination);
               } else {
                 source.connect(ctx.destination);
               }

               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += audioBuffer.duration;
               
               source.onended = () => {
                 audioSourcesRef.current.delete(source);
               };
               audioSourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              audioSourcesRef.current.forEach(src => src.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log("Connection Closed");
            cleanup();
          },
          onerror: (err) => {
            console.error("Connection Error", err);
            setStreamState(prev => ({ ...prev, error: "Connection error occurred." }));
            cleanup();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (error: any) {
      console.error(error);
      setStreamState(prev => ({ ...prev, error: error.message || "Failed to connect" }));
      cleanup();
    }
  }, [cleanup, onCodeUpdate]);

  const startVideoStreaming = useCallback(() => {
    if (frameIntervalRef.current) return;
    
    // Low FPS for token conservation
    const FPS = 1;
    
    frameIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || !sessionPromiseRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx || video.readyState < 2) return;
      
      const scale = 640 / video.videoWidth;
      const width = 640;
      const height = video.videoHeight * scale;
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);
      
      const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
      
      sessionPromiseRef.current.then(session => {
        session.sendRealtimeInput({
          media: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        });
      });

    }, 1000 / FPS);
  }, [videoRef, canvasRef]);

  const stopVideoStreaming = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!streamState.isConnected) return;
    
    const interval = setInterval(() => {
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setVolume(avg);
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [streamState.isConnected]);

  // Expose a method to send text manually if needed (for text chat integration with Live model if desired)
  // For now, we rely on the chat pane using standard generateContent for text, and this hook for voice.
  
  return {
    streamState,
    connect,
    disconnect: cleanup,
    startVideoStreaming,
    stopVideoStreaming,
    volume,
  };
}
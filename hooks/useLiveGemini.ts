import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { createAudioBlob, base64ToArrayBuffer, pcmToAudioBuffer } from '../utils/audio';
import { StreamState, SelectedElement } from '../types';

interface UseLiveGeminiParams {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onCodeUpdate?: (code: string) => void;
  onElementSelect?: (selector: string, reasoning?: string) => void;
  onExecuteCode?: (code: string, description: string) => void;
  onConfirmSelection?: (confirmed: boolean) => void;
  selectedElement?: SelectedElement | null;
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

const selectElementTool: FunctionDeclaration = {
  name: 'select_element',
  description: 'Select an element on the page based on the user\'s description. Use a CSS selector to identify the element. After selection, ask the user to confirm before making changes.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      selector: {
        type: Type.STRING,
        description: 'A CSS selector to identify the element (e.g., "#myButton", ".header", "button.submit", "div[data-id=\'123\']")',
      },
      reasoning: {
        type: Type.STRING,
        description: 'Brief explanation of why you chose this selector based on the user\'s description',
      },
    },
    required: ['selector', 'reasoning'],
  },
};

const executeCodeTool: FunctionDeclaration = {
  name: 'execute_code',
  description: 'Execute JavaScript code on the page to modify elements. Use this to make changes to the UI after the user confirms the selected element.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      code: {
        type: Type.STRING,
        description: 'JavaScript code to execute. Can use document.querySelector() to select elements and modify them.',
      },
      description: {
        type: Type.STRING,
        description: 'Brief description of what this code will do',
      },
    },
    required: ['code', 'description'],
  },
};

const confirmSelectionTool: FunctionDeclaration = {
  name: 'confirm_selection',
  description: 'Confirm or reject a pending element selection. Use this when the user says "yes"/"no" or specifies which numbered element they want (e.g., "the second one", "number 3").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      confirmed: {
        type: Type.BOOLEAN,
        description: 'true if user confirmed (yes/correct/that\'s it), false if rejected (no/wrong/not that one)',
      },
      elementNumber: {
        type: Type.NUMBER,
        description: 'Optional: If multiple elements were found, specify which one (1-indexed). Use when user says "the second one" (2), "number 3" (3), etc.',
      },
    },
    required: ['confirmed'],
  },
};

export function useLiveGemini({ videoRef, canvasRef, onCodeUpdate, onElementSelect, onExecuteCode, onConfirmSelection, selectedElement }: UseLiveGeminiParams) {
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
          tools: [{ functionDeclarations: [updateUiTool, selectElementTool, executeCodeTool, confirmSelectionTool] }],
          systemInstruction: `You are a specialized AI UI Engineer with voice and element selection capabilities.

          You can see the user's screen or video feed if enabled.
          You can hear the user's voice commands.

          WORKFLOW FOR MAKING CHANGES:
          1. When the user describes an element they want to modify (e.g., "change the red button" or "update the header text"), use 'select_element' to highlight it.
          2. The selector might match MULTIPLE elements. They will ALL be highlighted with numbered badges (💬1, 💬2, 💬3, etc.).
          3. If multiple elements are found, the user will see them all and can either:
             - Click on a specific numbered element to select it
             - Say "the second one" or "number 3" via voice to clarify which one they meant
             - Use confirm_selection with the specific element number
          4. Wait for user confirmation before making changes.
          5. Once confirmed, you have THREE options for making changes:
             a) execute_code: Make quick runtime changes (change colors, text, styles, hide/show elements)
             b) update_ui: Update the underlying HTML/CSS/JS source code (permanent changes)
             c) Both: Use execute_code for immediate preview, then update_ui to save changes

          ${selectedElement ? `CURRENTLY SELECTED ELEMENT (CONFIRMED):
          - Tag: ${selectedElement.tagName}
          - ID: ${selectedElement.id || 'none'}
          - Classes: ${selectedElement.className || 'none'}
          - Text: "${selectedElement.text || ''}"
          - Selector examples: ${selectedElement.id ? `#${selectedElement.id}` : selectedElement.className ? `.${selectedElement.className.split(' ')[0]}` : selectedElement.tagName}

          The user has confirmed this element. You can now modify it with execute_code or update_ui.` : ''}

          VOICE CONFIRMATIONS:
          - If the user says "yes", "yeah", "yep", "correct", "that's it" → They're confirming your selection
          - If the user says "no", "nope", "wrong", "not that one" → They're rejecting your selection
          - When you hear a confirmation word, acknowledge it naturally (e.g., "Great, I'll change that now")

          AVAILABLE TOOLS:
          - select_element: Find and highlight an element by CSS selector
          - execute_code: Run JavaScript to make runtime changes (quick, temporary)
          - update_ui: Update the source HTML file (permanent, saved to disk)

          EXAMPLES:
          User: "Make that button blue"
          You: execute_code with "document.querySelector('#myBtn').style.backgroundColor = 'blue'"

          User: "Change the heading text to 'Welcome'"
          You: execute_code with "document.querySelector('h1').textContent = 'Welcome'"

          User: "Save those changes to the file"
          You: update_ui with the modified HTML

          Be concise in your spoken responses. Describe what you're doing.`,
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
                    else if (call.name === 'select_element') {
                        const selector = (call.args as any).selector;
                        const reasoning = (call.args as any).reasoning;
                        console.log("AI requesting element selection:", selector, reasoning);

                        if (onElementSelect && selector) {
                            onElementSelect(selector, reasoning);
                        }

                        // Respond to the tool call
                        sessionPromiseRef.current?.then(session => {
                            session.sendToolResponse({
                                functionResponses: {
                                    id: call.id,
                                    name: call.name,
                                    response: {
                                      result: "Element selection requested",
                                      selector: selector,
                                      reasoning: reasoning
                                    }
                                }
                            });
                        });
                    }
                    else if (call.name === 'execute_code') {
                        const code = (call.args as any).code;
                        const description = (call.args as any).description;
                        console.log("AI requesting code execution:", description, code);

                        if (onExecuteCode && code) {
                            onExecuteCode(code, description);
                        }

                        // Respond to the tool call
                        sessionPromiseRef.current?.then(session => {
                            session.sendToolResponse({
                                functionResponses: {
                                    id: call.id,
                                    name: call.name,
                                    response: {
                                      result: "Code executed successfully",
                                      description: description
                                    }
                                }
                            });
                        });
                    }
                    else if (call.name === 'confirm_selection') {
                        const confirmed = (call.args as any).confirmed;
                        const elementNumber = (call.args as any).elementNumber;
                        console.log("AI confirming selection:", confirmed, "element number:", elementNumber);

                        if (onConfirmSelection) {
                            onConfirmSelection(confirmed, elementNumber);
                        }

                        // Respond to the tool call
                        sessionPromiseRef.current?.then(session => {
                            session.sendToolResponse({
                                functionResponses: {
                                    id: call.id,
                                    name: call.name,
                                    response: {
                                      result: confirmed ? (elementNumber ? `Element ${elementNumber} confirmed` : "Selection confirmed") : "Selection rejected"
                                    }
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
  }, [cleanup, onCodeUpdate, onElementSelect, onExecuteCode, onConfirmSelection, selectedElement]);

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
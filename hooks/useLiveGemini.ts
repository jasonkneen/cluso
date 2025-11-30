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
  onGetPageElements?: (category?: string) => Promise<string>;
  onPatchSourceFile?: (filePath: string, searchCode: string, replaceCode: string, description: string) => Promise<{ success: boolean; error?: string }>;
  onListFiles?: (path?: string) => Promise<string>;
  onReadFile?: (filePath: string) => Promise<string>;
  onClickElement?: (selector: string) => Promise<{ success: boolean; error?: string }>;
  onNavigate?: (action: string, url?: string) => Promise<{ success: boolean; error?: string }>;
  onScroll?: (target: string) => Promise<{ success: boolean; error?: string }>;
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
  description: `Select elements on the page using a CSS selector.

⚠️ FORBIDDEN - THESE WILL CRASH:
- :contains() - NEVER USE THIS
- :has(text) - NEVER USE THIS
- Any jQuery pseudo-selectors

✅ VALID CSS SELECTORS:
- Tag: 'button', 'a', 'div', 'img', 'h1', 'h2', 'section'
- Class: '.btn', '.card', '.hero-section'
- ID: '#submit-btn', '#hero'
- Attribute contains: '[href*="download"]', '[src*="screenshot"]', '[alt*="app"]'
- Attribute exact: '[data-testid="login"]'
- Combined: 'button, [role="button"]', 'img, [role="img"]'

🔍 TO FIND ELEMENTS BY TEXT/CONTENT:
1. FIRST call get_page_elements to see what's on the page
2. Use attribute selectors: '[aria-label*="Download"]', '[title*="Windows"]'
3. Use class names: '.download-btn', '.hero-image'
4. Use structural selectors: 'section img', '.hero img', 'main img'

EXAMPLES:
- "screenshot image" → 'img[alt*="screenshot"], img[src*="screenshot"], .screenshot img, section img'
- "download button" → 'a[href*="download"], button[aria-label*="download"], .download'
- "all buttons" → 'button, [role="button"], input[type="button"]'`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      selector: {
        type: Type.STRING,
        description: 'CSS selector WITHOUT :contains() or jQuery syntax. Use [attr*="text"] for text matching.',
      },
      reasoning: {
        type: Type.STRING,
        description: 'Brief explanation of selector choice',
      },
    },
    required: ['selector', 'reasoning'],
  },
};

const getPageElementsTool: FunctionDeclaration = {
  name: 'get_page_elements',
  description: 'Get a summary of interactive elements on the current page. Use this BEFORE selecting elements to understand what\'s available. Returns counts and examples of buttons, links, inputs, and other interactive elements.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: 'Optional: Filter to specific category - "buttons", "links", "inputs", "images", "headings", or "all" (default)',
      },
    },
    required: [],
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
  description: 'Confirm or reject a pending element selection. Use this when the user says "yes"/"no"/"approve"/"reject" or specifies which numbered element they want.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      confirmed: {
        type: Type.BOOLEAN,
        description: 'true if user approved (yes/approve/do it/go ahead), false if rejected (no/reject/cancel/wrong)',
      },
      elementNumber: {
        type: Type.NUMBER,
        description: 'Optional: If multiple elements were found, specify which one (1-indexed). Use when user says "the second one" (2), "number 3" (3), etc.',
      },
    },
    required: ['confirmed'],
  },
};

const patchSourceFileTool: FunctionDeclaration = {
  name: 'patch_source_file',
  description: `SAVE changes to the actual source code file. Use this AFTER execute_code to make changes permanent.

REQUIRES: The selected element must have sourceLocation info (file path and line number).
Use this to write the modified code to disk so it persists after page reload.

IMPORTANT: Provide the FULL updated content for the portion of the file being changed.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: 'The source file path to modify (from selectedElement.sourceLocation)',
      },
      searchCode: {
        type: Type.STRING,
        description: 'The original code to find and replace in the file',
      },
      replaceCode: {
        type: Type.STRING,
        description: 'The new code to replace it with',
      },
      description: {
        type: Type.STRING,
        description: 'Brief description of the change being made',
      },
    },
    required: ['filePath', 'searchCode', 'replaceCode', 'description'],
  },
};

// File system tools
const listFilesTool: FunctionDeclaration = {
  name: 'list_files',
  description: 'List files and folders in a directory. Use this to explore the project structure.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: 'Directory path to list. Use "." for current directory, or relative/absolute path.',
      },
    },
    required: [],
  },
};

const readFileTool: FunctionDeclaration = {
  name: 'read_file',
  description: 'Read the contents of a file. Use this to see the current code before making changes.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: 'Path to the file to read',
      },
    },
    required: ['filePath'],
  },
};

// Navigation tools
const clickElementTool: FunctionDeclaration = {
  name: 'click_element',
  description: 'Click on an element (link, button, etc.) to navigate or trigger an action.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      selector: {
        type: Type.STRING,
        description: 'CSS selector for the element to click. Use valid CSS only (no :contains).',
      },
    },
    required: ['selector'],
  },
};

const navigateTool: FunctionDeclaration = {
  name: 'navigate',
  description: 'Navigate the browser - go back, forward, reload, or to a specific URL.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: 'Action to take: "back", "forward", "reload", or "goto"',
      },
      url: {
        type: Type.STRING,
        description: 'URL to navigate to (only needed if action is "goto")',
      },
    },
    required: ['action'],
  },
};

const scrollTool: FunctionDeclaration = {
  name: 'scroll',
  description: 'Scroll the page - to top, bottom, or to a specific element.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      target: {
        type: Type.STRING,
        description: '"top", "bottom", or a CSS selector to scroll to',
      },
    },
    required: ['target'],
  },
};

export function useLiveGemini({ videoRef, canvasRef, onCodeUpdate, onElementSelect, onExecuteCode, onConfirmSelection, onGetPageElements, onPatchSourceFile, onListFiles, onReadFile, onClickElement, onNavigate, onScroll, selectedElement }: UseLiveGeminiParams) {
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
          tools: [{ functionDeclarations: [updateUiTool, selectElementTool, executeCodeTool, confirmSelectionTool, getPageElementsTool, patchSourceFileTool, listFilesTool, readFileTool, clickElementTool, navigateTool, scrollTool] }],
          systemInstruction: `You are a specialized AI UI Engineer with voice control, element selection, file editing, and browser navigation capabilities.

          You can see the user's screen or video feed if enabled.
          You can hear the user's voice commands.

          CAPABILITIES:
          📁 FILE SYSTEM: List files, read files, edit/patch source code
          🔍 PAGE INSPECTION: Get page elements, select elements, execute code
          🧭 NAVIGATION: Click links, go back/forward, scroll, navigate to URLs
          ✏️ EDITING: Preview changes with execute_code, save with patch_source_file

          CRITICAL - MODERN UI FRAMEWORKS:
          Modern frameworks (shadcn, Radix, MUI, Tailwind) often don't use native HTML elements:
          - "buttons" → 'button, [role="button"], [data-slot="button"]'
          - "links" → 'a[href], [role="link"]'
          - "inputs" → 'input, textarea, [role="textbox"]'

          ALWAYS use compound selectors when user asks for common elements!

          ${selectedElement ? `CURRENTLY SELECTED ELEMENT:
          - Tag: ${selectedElement.tagName}
          - ID: ${selectedElement.id || 'none'}
          - Classes: ${selectedElement.className || 'none'}
          - Text: "${selectedElement.text || ''}"
          ${selectedElement.sourceLocation ? `- SOURCE FILE: ${selectedElement.sourceLocation.summary}` : ''}` : ''}

          VOICE COMMANDS:
          - "approve"/"yes"/"do it" → confirm_selection(true)
          - "reject"/"no"/"cancel" → confirm_selection(false)
          - "go back" → navigate("back")
          - "scroll down/up/to top" → scroll("bottom"/"top")
          - "click that link" → click_element(selector)
          - "show me the files" → list_files()
          - "read that file" → read_file(path)
          - "save the changes" → patch_source_file()

          AVAILABLE TOOLS:
          📁 FILE TOOLS:
          - list_files: List files/folders in a directory
          - read_file: Read a file's contents
          - patch_source_file: Save changes to source file

          🔍 PAGE TOOLS:
          - get_page_elements: See what elements exist on the page
          - select_element: Highlight elements by CSS selector
          - execute_code: Run JavaScript to modify the page (preview)

          🧭 NAVIGATION TOOLS:
          - click_element: Click a link/button
          - navigate: Go back, forward, reload, or to URL
          - scroll: Scroll to top, bottom, or element

          ✅ CONFIRMATION:
          - confirm_selection: Process user's yes/no

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
                    else if (call.name === 'get_page_elements') {
                        const category = (call.args as any).category || 'all';
                        console.log("AI requesting page elements:", category);

                        if (onGetPageElements) {
                            onGetPageElements(category).then(result => {
                                sessionPromiseRef.current?.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: call.id,
                                            name: call.name,
                                            response: {
                                              result: result
                                            }
                                        }
                                    });
                                });
                            }).catch(err => {
                                sessionPromiseRef.current?.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: call.id,
                                            name: call.name,
                                            response: {
                                              error: err.message || 'Failed to get page elements'
                                            }
                                        }
                                    });
                                });
                            });
                        } else {
                            sessionPromiseRef.current?.then(session => {
                                session.sendToolResponse({
                                    functionResponses: {
                                        id: call.id,
                                        name: call.name,
                                        response: {
                                          error: 'get_page_elements handler not available'
                                        }
                                    }
                                });
                            });
                        }
                    }
                    else if (call.name === 'patch_source_file') {
                        const filePath = (call.args as any).filePath;
                        const searchCode = (call.args as any).searchCode;
                        const replaceCode = (call.args as any).replaceCode;
                        const description = (call.args as any).description;
                        console.log("AI requesting source file patch:", filePath, description);

                        if (onPatchSourceFile) {
                            onPatchSourceFile(filePath, searchCode, replaceCode, description).then(result => {
                                sessionPromiseRef.current?.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: call.id,
                                            name: call.name,
                                            response: result.success
                                              ? { result: `Successfully patched ${filePath}: ${description}` }
                                              : { error: result.error || 'Failed to patch file' }
                                        }
                                    });
                                });
                            }).catch(err => {
                                sessionPromiseRef.current?.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: call.id,
                                            name: call.name,
                                            response: {
                                              error: err.message || 'Failed to patch source file'
                                            }
                                        }
                                    });
                                });
                            });
                        } else {
                            sessionPromiseRef.current?.then(session => {
                                session.sendToolResponse({
                                    functionResponses: {
                                        id: call.id,
                                        name: call.name,
                                        response: {
                                          error: 'patch_source_file handler not available - file editing not supported'
                                        }
                                    }
                                });
                            });
                        }
                    }
                    else if (call.name === 'list_files') {
                        const path = (call.args as any).path || '.';
                        console.log("AI listing files:", path);

                        if (onListFiles) {
                            onListFiles(path).then(result => {
                                sessionPromiseRef.current?.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: call.id,
                                            name: call.name,
                                            response: { result }
                                        }
                                    });
                                });
                            }).catch(err => {
                                sessionPromiseRef.current?.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: call.id,
                                            name: call.name,
                                            response: { error: err.message || 'Failed to list files' }
                                        }
                                    });
                                });
                            });
                        } else {
                            sessionPromiseRef.current?.then(session => {
                                session.sendToolResponse({
                                    functionResponses: {
                                        id: call.id,
                                        name: call.name,
                                        response: { error: 'list_files not available' }
                                    }
                                });
                            });
                        }
                    }
                    else if (call.name === 'read_file') {
                        const filePath = (call.args as any).filePath;
                        console.log("AI reading file:", filePath);

                        if (onReadFile) {
                            onReadFile(filePath).then(result => {
                                sessionPromiseRef.current?.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: call.id,
                                            name: call.name,
                                            response: { result }
                                        }
                                    });
                                });
                            }).catch(err => {
                                sessionPromiseRef.current?.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: call.id,
                                            name: call.name,
                                            response: { error: err.message || 'Failed to read file' }
                                        }
                                    });
                                });
                            });
                        } else {
                            sessionPromiseRef.current?.then(session => {
                                session.sendToolResponse({
                                    functionResponses: {
                                        id: call.id,
                                        name: call.name,
                                        response: { error: 'read_file not available' }
                                    }
                                });
                            });
                        }
                    }
                    else if (call.name === 'click_element') {
                        const selector = (call.args as any).selector;
                        console.log("AI clicking element:", selector);

                        if (onClickElement) {
                            onClickElement(selector).then(result => {
                                sessionPromiseRef.current?.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: call.id,
                                            name: call.name,
                                            response: result.success
                                              ? { result: `Clicked element: ${selector}` }
                                              : { error: result.error || 'Failed to click element' }
                                        }
                                    });
                                });
                            });
                        } else {
                            sessionPromiseRef.current?.then(session => {
                                session.sendToolResponse({
                                    functionResponses: {
                                        id: call.id,
                                        name: call.name,
                                        response: { error: 'click_element not available' }
                                    }
                                });
                            });
                        }
                    }
                    else if (call.name === 'navigate') {
                        const action = (call.args as any).action;
                        const url = (call.args as any).url;
                        console.log("AI navigating:", action, url);

                        if (onNavigate) {
                            onNavigate(action, url).then(result => {
                                sessionPromiseRef.current?.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: call.id,
                                            name: call.name,
                                            response: result.success
                                              ? { result: `Navigation: ${action}${url ? ' to ' + url : ''}` }
                                              : { error: result.error || 'Navigation failed' }
                                        }
                                    });
                                });
                            });
                        } else {
                            sessionPromiseRef.current?.then(session => {
                                session.sendToolResponse({
                                    functionResponses: {
                                        id: call.id,
                                        name: call.name,
                                        response: { error: 'navigate not available' }
                                    }
                                });
                            });
                        }
                    }
                    else if (call.name === 'scroll') {
                        const target = (call.args as any).target;
                        console.log("AI scrolling to:", target);

                        if (onScroll) {
                            onScroll(target).then(result => {
                                sessionPromiseRef.current?.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: call.id,
                                            name: call.name,
                                            response: result.success
                                              ? { result: `Scrolled to: ${target}` }
                                              : { error: result.error || 'Scroll failed' }
                                        }
                                    });
                                });
                            });
                        } else {
                            sessionPromiseRef.current?.then(session => {
                                session.sendToolResponse({
                                    functionResponses: {
                                        id: call.id,
                                        name: call.name,
                                        response: { error: 'scroll not available' }
                                    }
                                });
                            });
                        }
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
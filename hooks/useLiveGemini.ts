import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { createAudioBlob, base64ToArrayBuffer, pcmToAudioBuffer } from '../utils/audio';
import { StreamState, SelectedElement } from '../types';
import { voiceLogger } from '../utils/voiceLogger';

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
  onOpenItem?: (itemNumber: number) => Promise<string>;
  onOpenFile?: (name?: string, path?: string) => Promise<string>;
  onOpenFolder?: (name?: string, itemNumber?: number) => Promise<string>;
  onBrowserBack?: () => string;
  onCloseBrowser?: () => string;
  selectedElement?: SelectedElement | null;
  // Context for logging
  projectFolder?: string;
  currentUrl?: string;
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

⚠️ PREREQUISITE: You MUST call get_page_elements() FIRST before using this tool!
Never guess selectors - always check what elements actually exist on the page.

⚠️ FORBIDDEN SYNTAX (WILL CRASH):
- :contains() - NEVER USE
- :has(text) - NEVER USE
- jQuery pseudo-selectors

✅ VALID CSS SELECTORS:
- Tag: 'button', 'a', 'div', 'img', 'h1', 'h2', 'section'
- Class: '.btn', '.card', '.hero-section'
- ID: '#submit-btn', '#hero'
- Attribute contains: '[href*="download"]', '[src*="screenshot"]', '[alt*="app"]'
- Attribute exact: '[data-testid="login"]'
- Combined: 'button, [role="button"]', 'img, [role="img"]'

WORKFLOW:
1. Call get_page_elements() to see what exists
2. If element count is 0 → tell user it doesn't exist
3. If elements exist → use selectors from the returned data

EXAMPLES (only after confirming elements exist):
- "screenshot image" → 'img[alt*="screenshot"], img[src*="screenshot"]'
- "download button" → 'a[href*="download"], button[aria-label*="download"]'
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
  description: `🔍 DISCOVERY TOOL - Call this FIRST before any select_element call!

Returns counts and details of elements on the page. Use the results to:
- Know if an element type exists (count > 0)
- Get class names and attributes for accurate selectors
- Tell the user "no [X] found" if count is 0

Categories: "buttons", "links", "inputs", "images", "headings", "all"

REQUIRED WORKFLOW:
User: "select the image" → YOU: get_page_elements("images")
  - If images.count = 0 → "I don't see any images on this page"
  - If images.count > 0 → Use returned selectors in select_element()`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: 'Filter to specific category - "buttons", "links", "inputs", "images", "headings", or "all" (default)',
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
      path: {
        type: Type.STRING,
        description: 'Absolute or relative path to the file to read',
      },
      filePath: {
        type: Type.STRING,
        description: '(Deprecated) Legacy alias for path; prefer using "path"',
      },
    },
    required: [],
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

// File Browser Overlay Tools
const openFileBrowserItemTool: FunctionDeclaration = {
  name: 'open_item',
  description: 'Open an item from the file browser overlay by its number. Use after list_files shows the file browser.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      itemNumber: {
        type: Type.NUMBER,
        description: 'The number of the item to open (1-indexed)',
      },
    },
    required: ['itemNumber'],
  },
};

const fileBrowserBackTool: FunctionDeclaration = {
  name: 'browser_back',
  description: 'Go back to the previous panel in the file browser, or close it if at the root.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

const closeFileBrowserTool: FunctionDeclaration = {
  name: 'close_browser',
  description: 'Close the file browser overlay completely. Use when user says "close that", "clear", "enough", "dismiss", etc.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

const openFileTool: FunctionDeclaration = {
  name: 'open_file',
  description: `Open a file in the file browser by name or path.

USE THIS WHEN:
- User says "open LandingPage.tsx" → open_file({ name: "LandingPage.tsx" })
- User says "show me the App component" → open_file({ name: "App.tsx" })
- User says "open package.json" → open_file({ name: "package.json" })
- User says "open that file" (after mentioning a file) → open_file({ name: "filename.tsx" })

You can provide either:
- name: Just the filename - will search in the current file browser directory
- path: Full or relative path to the file

The file will open in the file browser overlay for viewing.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: 'The filename to open (e.g., "LandingPage.tsx", "package.json")',
      },
      path: {
        type: Type.STRING,
        description: 'Optional: Full path to the file if known',
      },
    },
    required: [],
  },
};

const openFolderTool: FunctionDeclaration = {
  name: 'open_folder',
  description: `Open a folder in the file browser by name or number.

USE THIS WHEN:
- User says "open the public folder" → open_folder({ name: "public" })
- User says "open number 3" or "open 3" → open_folder({ itemNumber: 3 })
- User says "go into src" → open_folder({ name: "src" })
- User says "check the hooks folder" → open_folder({ name: "hooks" })

You can use EITHER name OR itemNumber, not both. The itemNumber refers to the numbered items shown in the file browser overlay.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: 'The folder name to open (e.g., "public", "src", "hooks")',
      },
      itemNumber: {
        type: Type.NUMBER,
        description: 'The number of the folder in the file browser (1-indexed)',
      },
    },
    required: [],
  },
};

export function useLiveGemini({ videoRef, canvasRef, onCodeUpdate, onElementSelect, onExecuteCode, onConfirmSelection, onGetPageElements, onPatchSourceFile, onListFiles, onReadFile, onClickElement, onNavigate, onScroll, onOpenItem, onOpenFile, onOpenFolder, onBrowserBack, onCloseBrowser, selectedElement, projectFolder, currentUrl }: UseLiveGeminiParams) {
  const [streamState, setStreamState] = useState<StreamState>({
    isConnected: false,
    isStreaming: false,
    error: null,
  });
  
  const [volume, setVolume] = useState(0);

  // Using any for session promise type as LiveSession is not exported
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  // Helper to safely interact with session (handles errors silently)
  const withSession = useCallback((fn: (session: any) => void) => {
    sessionPromiseRef.current?.then(fn).catch(err => {
      console.error('[useLiveGemini] Session error:', err);
    });
  }, []);
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  // Reconnection with exponential backoff
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second
  const analyserRef = useRef<AnalyserNode | null>(null);

  const cleanup = useCallback((skipReconnect = false) => {
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (skipReconnect) {
      reconnectAttemptRef.current = maxReconnectAttempts; // Prevent further reconnects
    }

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
       sessionPromiseRef.current.then(session => session.close()).catch(err => {
         console.error('[useLiveGemini] Error closing session:', err);
       });
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
          tools: [{ functionDeclarations: [updateUiTool, selectElementTool, executeCodeTool, confirmSelectionTool, getPageElementsTool, patchSourceFileTool, listFilesTool, readFileTool, clickElementTool, navigateTool, scrollTool, openFileBrowserItemTool, openFileTool, openFolderTool, fileBrowserBackTool, closeFileBrowserTool] }],
          systemInstruction: `You are a specialized AI UI Engineer with voice control, file browsing, element selection, and browser navigation.

          You can see the user's screen or video feed if enabled.
          You can hear the user's voice commands.

          CAPABILITIES:
          📁 FILE BROWSER: Browse files with numbered overlay, navigate folders, view files/images
          🔍 PAGE INSPECTION: Get page elements, select elements, execute code
          🧭 NAVIGATION: Click links, go back/forward, scroll, navigate to URLs
          ✏️ EDITING: Preview changes with execute_code, save with patch_source_file

          ⚠️ MANDATORY ELEMENT SELECTION WORKFLOW:
          NEVER guess selectors! ALWAYS follow this sequence:
          1. FIRST: Call get_page_elements() to see what's actually on the page
          2. THEN: Review the returned elements - check their counts, classes, and attributes
          3. FINALLY: Use select_element() with selectors based on what you found

          Example: User says "select the image"
          ❌ WRONG: Immediately call select_element('img') - might not exist!
          ✅ RIGHT: Call get_page_elements('images') first, see results, then select

          If get_page_elements returns 0 for a category, tell the user "I don't see any [X] on this page."

          FILE BROWSER OVERLAY:
          When user asks to see files ("show files", "list files", "check the public folder"), use list_files.
          This shows a numbered overlay. User can then say "open 3" to navigate.

          FILE BROWSER COMMANDS:
          - "show me the files" / "list files" → list_files()
          - "check the public folder" → list_files("public")
          - "open 3" / "open three" / "number 3" → open_item(3) OR open_folder({ itemNumber: 3 })
          - "open the src folder" / "go into hooks" → open_folder({ name: "src" })
          - "open LandingPage.tsx" / "show me App.tsx" → open_file({ name: "LandingPage.tsx" })
          - "go back" (in file browser) → browser_back()
          - "close that" / "clear" / "enough" / "dismiss" → close_browser()

          FILE TOOLS:
          - open_file: Open a specific file by name - searches in current directory
          - open_folder: For folders specifically - can use name OR number
          - open_item: For any item by number (files or folders)

          CLOSING CONTEXT:
          When user says "close that", "clear that", "enough of that", "dismiss":
          - If file browser is showing → close_browser()
          - If element is selected → confirm_selection(false)
          - Otherwise → acknowledge and do nothing

          CRITICAL - CSS SELECTORS:
          Modern frameworks use: 'button, [role="button"]' not just 'button'
          NO :contains() - it will crash!

          ${selectedElement ? `SELECTED ELEMENT: ${selectedElement.tagName} "${selectedElement.text || ''}"` : ''}

          VOICE COMMANDS SUMMARY:
          FILE BROWSER: "show files", "open 3", "go back", "close that"
          PAGE: "highlight buttons", "click that", "scroll down"
          CONFIRM: "yes"/"approve", "no"/"reject"

          Be concise. Describe what you're doing.`,
        },
        callbacks: {
          onopen: () => {
            console.log("Connection Opened");
            reconnectAttemptRef.current = 0; // Reset reconnect counter on successful connection
            setStreamState(prev => ({ ...prev, isConnected: true }));

            if (!inputAudioContextRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
               const inputData = e.inputBuffer.getChannelData(0);
               const blob = createAudioBlob(inputData);

               withSession(session => {
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

                        const sendListFilesResponse = (responseData: { result?: string; error?: string }) => {
                            withSession(session => {
                                session.sendToolResponse({
                                    functionResponses: {
                                        id: call.id,
                                        name: call.name,
                                        response: responseData
                                    }
                                });
                            });
                        };

                        if (onListFiles) {
                            onListFiles(path).then(result => {
                                if (result === undefined || result === null) {
                                    sendListFilesResponse({ error: 'Directory listing returned no content' });
                                } else {
                                    sendListFilesResponse({ result: String(result) });
                                }
                            }).catch(err => {
                                console.error('[useLiveGemini] list_files error:', err);
                                sendListFilesResponse({ error: err.message || 'Failed to list files' });
                            });
                        } else {
                            sendListFilesResponse({ error: 'list_files not available' });
                        }
                    }
                    else if (call.name === 'read_file') {
                        const filePath = (call.args as any).path ?? (call.args as any).filePath;
                        console.log("AI reading file:", filePath);

                        const sendReadFileResponse = (responseData: { result?: string; error?: string }) => {
                            withSession(session => {
                                session.sendToolResponse({
                                    functionResponses: {
                                        id: call.id,
                                        name: call.name,
                                        response: responseData
                                    }
                                });
                            });
                        };

                        if (!filePath) {
                            sendReadFileResponse({ error: 'read_file requires a "path" argument' });
                            return;
                        }

                        if (onReadFile) {
                            onReadFile(filePath).then(result => {
                                // Check for undefined/null result
                                if (result === undefined || result === null) {
                                    console.error('[useLiveGemini] read_file returned undefined for:', filePath);
                                    sendReadFileResponse({ error: 'File read returned no content' });
                                } else {
                                    sendReadFileResponse({ result: String(result) });
                                }
                            }).catch(err => {
                                console.error('[useLiveGemini] read_file error:', err);
                                sendReadFileResponse({ error: err.message || 'Failed to read file' });
                            });
                        } else {
                            sendReadFileResponse({ error: 'read_file not available' });
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
                    else if (call.name === 'open_item') {
                        const itemNumber = (call.args as any).itemNumber;
                        console.log("AI opening item:", itemNumber);

                        const sendOpenItemResponse = (responseData: { result?: string; error?: string }) => {
                            withSession(session => {
                                session.sendToolResponse({
                                    functionResponses: { id: call.id, name: call.name, response: responseData }
                                });
                            });
                        };

                        if (onOpenItem) {
                            onOpenItem(itemNumber).then(result => {
                                sendOpenItemResponse({ result: result ?? 'Item opened' });
                            }).catch(err => {
                                sendOpenItemResponse({ error: err.message || 'Failed to open item' });
                            });
                        } else {
                            sendOpenItemResponse({ error: 'open_item not available' });
                        }
                    }
                    else if (call.name === 'open_file') {
                        const name = (call.args as any).name;
                        const path = (call.args as any).path;
                        console.log("AI opening file:", name || path);

                        const sendOpenFileResponse = (responseData: { result?: string; error?: string }) => {
                            withSession(session => {
                                session.sendToolResponse({
                                    functionResponses: { id: call.id, name: call.name, response: responseData }
                                });
                            });
                        };

                        if (onOpenFile) {
                            onOpenFile(name, path).then(result => {
                                sendOpenFileResponse({ result: result ?? 'File opened' });
                            }).catch(err => {
                                sendOpenFileResponse({ error: err.message || 'Failed to open file' });
                            });
                        } else {
                            sendOpenFileResponse({ error: 'open_file not available' });
                        }
                    }
                    else if (call.name === 'open_folder') {
                        const name = (call.args as any).name;
                        const itemNumber = (call.args as any).itemNumber;
                        console.log("AI opening folder:", name || `item #${itemNumber}`);

                        const sendOpenFolderResponse = (responseData: { result?: string; error?: string }) => {
                            withSession(session => {
                                session.sendToolResponse({
                                    functionResponses: { id: call.id, name: call.name, response: responseData }
                                });
                            });
                        };

                        if (onOpenFolder) {
                            onOpenFolder(name, itemNumber).then(result => {
                                sendOpenFolderResponse({ result: result ?? 'Folder opened' });
                            }).catch(err => {
                                sendOpenFolderResponse({ error: err.message || 'Failed to open folder' });
                            });
                        } else {
                            sendOpenFolderResponse({ error: 'open_folder not available' });
                        }
                    }
                    else if (call.name === 'browser_back') {
                        console.log("AI going back in file browser");

                        const sendBrowserBackResponse = (responseData: { result?: string; error?: string }) => {
                            withSession(session => {
                                session.sendToolResponse({
                                    functionResponses: { id: call.id, name: call.name, response: responseData }
                                });
                            });
                        };

                        if (onBrowserBack) {
                            try {
                                const result = onBrowserBack();
                                sendBrowserBackResponse({ result: result ?? 'Navigated back' });
                            } catch (err: any) {
                                sendBrowserBackResponse({ error: err.message || 'Failed to go back' });
                            }
                        } else {
                            sendBrowserBackResponse({ error: 'browser_back not available' });
                        }
                    }
                    else if (call.name === 'close_browser') {
                        console.log("AI closing file browser");

                        const sendCloseBrowserResponse = (responseData: { result?: string; error?: string }) => {
                            withSession(session => {
                                session.sendToolResponse({
                                    functionResponses: { id: call.id, name: call.name, response: responseData }
                                });
                            });
                        };

                        if (onCloseBrowser) {
                            try {
                                const result = onCloseBrowser();
                                sendCloseBrowserResponse({ result: result ?? 'Browser closed' });
                            } catch (err: any) {
                                sendCloseBrowserResponse({ error: err.message || 'Failed to close browser' });
                            }
                        } else {
                            sendCloseBrowserResponse({ error: 'close_browser not available' });
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
            // Attempt reconnection with exponential backoff
            if (reconnectAttemptRef.current < maxReconnectAttempts) {
              const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptRef.current);
              console.log(`[useLiveGemini] Scheduling reconnect attempt ${reconnectAttemptRef.current + 1}/${maxReconnectAttempts} in ${delay}ms`);
              reconnectAttemptRef.current++;
              reconnectTimeoutRef.current = window.setTimeout(() => {
                console.log('[useLiveGemini] Attempting reconnection...');
                cleanup(); // Clean up before reconnecting
                // The user will need to manually reconnect by clicking connect again
                // We just log the attempt here - full auto-reconnect would require more state management
              }, delay);
            } else {
              console.log('[useLiveGemini] Max reconnect attempts reached');
              cleanup();
            }
          },
          onerror: (err) => {
            console.error("Connection Error", err);
            setStreamState(prev => ({ ...prev, error: "Connection error occurred. Will attempt reconnection." }));
            // Attempt reconnection on error as well
            if (reconnectAttemptRef.current < maxReconnectAttempts) {
              const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptRef.current);
              console.log(`[useLiveGemini] Scheduling reconnect after error, attempt ${reconnectAttemptRef.current + 1}/${maxReconnectAttempts} in ${delay}ms`);
              reconnectAttemptRef.current++;
              reconnectTimeoutRef.current = window.setTimeout(() => {
                cleanup();
              }, delay);
            } else {
              console.log('[useLiveGemini] Max reconnect attempts reached after error');
              cleanup();
            }
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

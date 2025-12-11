import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { createAudioBlob, base64ToArrayBuffer, pcmToAudioBuffer } from '../utils/audio';
import { StreamState, SelectedElement } from '../types';
import { voiceLogger } from '../utils/voiceLogger';
import { debugLog, debug } from '../utils/debug';
import { executeToolCalls, ToolCall, ToolHandlers, ToolResponse } from '../utils/toolRouter';

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
  onApproveChange?: (reason?: string) => void;
  onRejectChange?: (reason?: string) => void;
  onUndoChange?: (reason?: string) => void;
  onHighlightByNumber?: (elementNumber: number) => Promise<{ success: boolean; element?: any; error?: string }>;
  onClearFocus?: () => Promise<{ success: boolean }>;
  onSetViewport?: (mode: 'mobile' | 'tablet' | 'desktop') => Promise<{ success: boolean }>;
  onSwitchTab?: (type: 'browser' | 'kanban' | 'todos' | 'notes') => Promise<{ success: boolean }>;
  selectedElement?: SelectedElement | null;
  // Context for logging
  projectFolder?: string;
  currentUrl?: string;
  // API key from settings (falls back to env if not provided)
  googleApiKey?: string;
  // Selected model for Gemini Live
  selectedModelId?: string;
}

// ToolArgs is now imported from utils/toolRouter

// Extended window type for webkit audio
interface WindowWithWebkit extends Window {
  webkitAudioContext?: typeof AudioContext;
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

// Voice Approval Tools
const approveCchangeTool: FunctionDeclaration = {
  name: 'approve_change',
  description: `Approve a pending change when the user gives voice approval.

Use this when the user says "yes", "accept", "approve", "do it", "go ahead", or similar approval commands.
This confirms that the user wants to apply the proposed change.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: 'Brief explanation of what was approved (for confirmation message)',
      },
    },
    required: [],
  },
};

const rejectChangeTool: FunctionDeclaration = {
  name: 'reject_change',
  description: `Reject a pending change when the user gives voice rejection.

Use this when the user says "no", "reject", "cancel", "undo", "wrong", or similar rejection commands.
This confirms that the user does not want to apply the proposed change.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: 'Brief explanation of why the change was rejected',
      },
    },
    required: [],
  },
};

const undoChangeTool: FunctionDeclaration = {
  name: 'undo_change',
  description: `Undo the last applied change when the user requests it via voice.

Use this when the user says "undo that", "undo the last change", "revert", "go back", or similar undo commands.
This reverts the application to the state before the last change was applied.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: 'Reason for undoing (for confirmation message)',
      },
    },
    required: [],
  },
};

// Highlight element by number tool - uses existing numbered badges
// Also sets focus for hierarchical navigation
const highlightByNumberTool: FunctionDeclaration = {
  name: 'highlight_element_by_number',
  description: `Highlight an element AND SET IT AS FOCUS for hierarchical navigation.

Elements on the page are numbered with visible badges (1, 2, 3, etc).
This is the PREFERRED way to highlight elements - no CSS selector errors!

🎯 HIERARCHICAL FOCUSING:
When you highlight an element, it becomes the FOCUS. Subsequent get_page_elements
calls will ONLY show elements WITHIN the focused element. This lets users
drill down: "middle section" → "left side" → "that button"

WORKFLOW:
1. get_page_elements() - shows all page elements numbered
2. User: "the middle section" → highlight_element_by_number(N) for that section
3. get_page_elements() - now ONLY shows elements INSIDE the section
4. User: "the button on the left" → highlight_element_by_number(M)
5. User: "clear focus" → call clear_focus() to see all elements again

WHEN TO USE:
- "highlight 3" or "number 3" → highlight_element_by_number(3)
- "that section" / "the header" → highlight it to set focus
- User points to a region → set it as focus for drilling down`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      elementNumber: {
        type: Type.NUMBER,
        description: 'The 1-indexed element number to highlight (from the numbered badges on the page)',
      },
      description: {
        type: Type.STRING,
        description: 'Brief description of what element you are highlighting (for user confirmation)',
      },
    },
    required: ['elementNumber'],
  },
};

// Clear focus tool - resets hierarchical navigation to show all elements
const clearFocusTool: FunctionDeclaration = {
  name: 'clear_focus',
  description: `Clear the current focus scope and show ALL page elements again.

Use this when the user wants to "zoom out" or see the full page elements again after
drilling down into a specific section.

TRIGGERS:
- "clear focus" / "zoom out" / "show all" / "reset" / "go back to all"
- "start over" / "full page" / "everything"

After clearing focus, call get_page_elements() to re-number all elements on the page.`,
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

// Set viewport mode - switch between mobile, tablet, desktop views
const setViewportTool: FunctionDeclaration = {
  name: 'set_viewport',
  description: `Switch the viewport/device preview mode in Cluso.

MODES:
- 'mobile' - Phone view (375px wide)
- 'tablet' - Tablet view (768px wide)
- 'desktop' - Full width desktop view

TRIGGERS:
- "switch to mobile" / "show mobile view" / "phone view"
- "switch to tablet" / "tablet view" / "iPad view"
- "switch to desktop" / "desktop view" / "full width"
- "how does it look on mobile?"`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      mode: {
        type: Type.STRING,
        description: 'Viewport mode: mobile, tablet, or desktop',
      },
    },
    required: ['mode'],
  },
};

// Switch tab - open kanban, todos, notes, or browser tabs
const switchTabTool: FunctionDeclaration = {
  name: 'switch_tab',
  description: `Switch to or create a different tab type in Cluso.

TAB TYPES:
- 'browser' - Web browser tab for viewing/editing websites
- 'kanban' - Kanban board for project management
- 'todos' - Todo list for task tracking
- 'notes' - Notes tab for documentation

TRIGGERS:
- "open kanban" / "show kanban board" / "project board"
- "open todos" / "show my tasks" / "task list"
- "open notes" / "show notes"
- "go to browser" / "back to website"`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      type: {
        type: Type.STRING,
        description: 'Tab type: browser, kanban, todos, or notes',
      },
    },
    required: ['type'],
  },
};

export function useLiveGemini({ videoRef, canvasRef, onCodeUpdate, onElementSelect, onExecuteCode, onConfirmSelection, onGetPageElements, onPatchSourceFile, onListFiles, onReadFile, onClickElement, onNavigate, onScroll, onOpenItem, onOpenFile, onOpenFolder, onBrowserBack, onCloseBrowser, onApproveChange, onRejectChange, onUndoChange, onHighlightByNumber, onClearFocus, onSetViewport, onSwitchTab, selectedElement, projectFolder, currentUrl, googleApiKey, selectedModelId }: UseLiveGeminiParams) {
  const [streamState, setStreamState] = useState<StreamState>({
    isConnected: false,
    isStreaming: false,
    error: null,
  });

  const [volume, setVolume] = useState(0);

  // Using any for session promise type as LiveSession is not exported
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  // Track connection state to prevent race conditions
  const isConnectingRef = useRef(false);

  // Helper to safely interact with session (handles errors silently)
  const withSession = useCallback((fn: (session: any) => void) => {
    sessionPromiseRef.current?.then(fn).catch(err => {
      debugLog.liveGemini.error('Session error:', err);
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

    // Copy Set before iterating to prevent race condition if new sources are added during cleanup
    const sourcesToStop = Array.from(audioSourcesRef.current);
    audioSourcesRef.current.clear();
    sourcesToStop.forEach(source => {
      try { source.stop(); } catch { /* ignore already stopped sources */ }
    });

    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // Store session reference before nulling to avoid race condition
    const sessionToClose = sessionPromiseRef.current;
    sessionPromiseRef.current = null;
    if (sessionToClose) {
       sessionToClose.then(session => session.close()).catch(err => {
         console.error('[useLiveGemini] Error closing session:', err);
       });
    }

    setStreamState(prev => ({ ...prev, isConnected: false, isStreaming: false }));
    setVolume(0);
    // Reset connecting flag on cleanup
    if (isConnectingRef.current) {
      isConnectingRef.current = false;
    }
  }, []);

  const connect = useCallback(async () => {
    // Prevent concurrent connection attempts
    if (isConnectingRef.current || sessionPromiseRef.current) {
      console.log('[useLiveGemini] Connection already in progress, ignoring duplicate connect call');
      return;
    }
    isConnectingRef.current = true;

    try {
      setStreamState({ isConnected: false, isStreaming: true, error: null });

      // Use passed API key first, then fall back to environment variable
      const apiKey = googleApiKey || process.env.API_KEY;
      if (!apiKey) throw new Error("API_KEY not found - add it in Settings > Providers or .env.local");
      aiRef.current = new GoogleGenAI({ apiKey });

      const AudioContextClass = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext;
      if (!AudioContextClass) throw new Error('AudioContext not supported');
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      analyserRef.current = outputAudioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Build model name with native audio support
      // Only use Gemini models for Live API - fall back to Flash if non-Gemini selected
      const baseModel = selectedModelId && selectedModelId.startsWith('gemini-')
        ? selectedModelId
        : 'gemini-2.5-flash';
      const modelName = `${baseModel}-native-audio-preview-09-2025`;

      const sessionPromise = aiRef.current.live.connect({
        model: modelName,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          tools: [{ functionDeclarations: [updateUiTool, selectElementTool, executeCodeTool, confirmSelectionTool, getPageElementsTool, patchSourceFileTool, listFilesTool, readFileTool, clickElementTool, navigateTool, scrollTool, openFileBrowserItemTool, openFileTool, openFolderTool, fileBrowserBackTool, closeFileBrowserTool, approveCchangeTool, rejectChangeTool, undoChangeTool, highlightByNumberTool, clearFocusTool, setViewportTool, switchTabTool] }],
          systemInstruction: `You are a specialized AI UI Engineer with voice control, file browsing, element selection, and browser navigation.

          You can see the user's screen or video feed if enabled.
          You can hear the user's voice commands.

          CAPABILITIES:
          📁 FILE BROWSER: Browse files with numbered overlay, navigate folders, view files/images
          🔍 PAGE INSPECTION: Get page elements, highlight by number, execute code
          🧭 NAVIGATION: Click links, go back/forward, scroll, navigate to URLs
          ✏️ EDITING: Preview changes with execute_code, save with patch_source_file

          🎯 ELEMENT HIGHLIGHTING - USE NUMBERS, NOT CSS SELECTORS!
          Elements on the page are numbered (1, 2, 3...). Use highlight_element_by_number() to highlight them.
          This is MORE RELIABLE than CSS selectors and never causes errors.

          🔍 HIERARCHICAL FOCUSING - DRILL DOWN INTO SECTIONS:
          When you highlight an element, it becomes the FOCUS. Subsequent get_page_elements
          calls will ONLY show elements WITHIN the focused element. This lets users drill down:

          Example conversation:
          User: "show me the page" → get_page_elements()
          You: "I see 20 elements. The header is #1, main section #5, footer #12"
          User: "that middle section" → highlight_element_by_number(5) - SETS FOCUS
          You: "Now focused on the main section"
          User: "what's in there?" → get_page_elements() - now shows ONLY elements inside #5
          You: "Within the main section: 3 buttons (#1, #2, #3)"
          User: "the left one" → highlight_element_by_number(1)
          User: "zoom out" → clear_focus() then get_page_elements() - shows all again

          WORKFLOW:
          1. get_page_elements() - shows all page elements numbered
          2. User picks a section → highlight_element_by_number(N) - sets focus to that section
          3. get_page_elements() - now ONLY shows children of focused section
          4. User: "clear focus" / "zoom out" → clear_focus() to see full page again

          NUMBER-BASED COMMANDS:
          - "highlight 3" / "number 3" → highlight_element_by_number(3)
          - "that section" / "the header" → highlight to set focus
          - "clear focus" / "zoom out" / "show all" → clear_focus()
          - "show me the buttons" → get_page_elements('buttons')

          ⚠️ IMPORTANT: highlight_element_by_number sets FOCUS for drilling down.
          Use execute_code or update_ui for actual code changes.

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

          ${selectedElement ? `SELECTED ELEMENT: ${selectedElement.tagName} "${selectedElement.text || ''}"` : ''}

          VOICE APPROVAL COMMANDS:
          When user says these voice commands, use the approval tools:
          - "yes", "accept", "approve", "do it", "go ahead" → approve_change()
          - "no", "reject", "cancel", "nope", "wrong" → reject_change()
          - "undo that", "undo the last change", "revert", "go back" → undo_change()

          VOICE COMMANDS SUMMARY:
          HIGHLIGHTING: "highlight 3", "show me the buttons", "number 2"
          FILE BROWSER: "show files", "open 3", "go back", "close that"
          PAGE: "click that", "scroll down"
          APPROVAL: "yes"/"approve", "no"/"reject", "undo that"

          🚀 INSTANT DOM EDITS - CRITICAL:
          When user requests UI changes ("flip it back", "change the color", "move that button", etc):
          - IMMEDIATELY call update_ui with the modified HTML
          - Do NOT read source files first - you can infer changes from the current DOM
          - Do NOT explain or describe what you're doing
          - Do NOT use tools like read_file, get_page_elements, or list_files
          - Apply the change silently and instantly
          - Only respond AFTER the DOM update is complete

          Be silent on instant edits. Concise on other tasks.`,
        },
        callbacks: {
          onopen: () => {
            debug("Connection Opened");
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
            // Handle Tool Calls via router with proper async orchestration
            if (message.toolCall) {
                debugLog.liveGemini.log("Tool call received", message.toolCall);
                const functionCalls = message.toolCall.functionCalls;
                if (functionCalls && functionCalls.length > 0) {
                    // Build handlers object from callback props
                    const handlers: ToolHandlers = {
                      onCodeUpdate,
                      onElementSelect,
                      onExecuteCode,
                      onConfirmSelection,
                      onGetPageElements,
                      onPatchSourceFile,
                      onListFiles,
                      onReadFile,
                      onClickElement,
                      onNavigate,
                      onScroll,
                      onOpenItem,
                      onOpenFile,
                      onOpenFolder,
                      onBrowserBack,
                      onCloseBrowser,
                      onApproveChange,
                      onRejectChange,
                      onUndoChange,
                      onHighlightByNumber,
                    };

                    // Convert to typed tool calls
                    const toolCalls: ToolCall[] = functionCalls.map(call => ({
                      id: call.id,
                      name: call.name,
                      args: call.args || {},
                    })) as ToolCall[];

                    try {
                      // Execute all tool calls and AWAIT results (proper orchestration)
                      // This enables multi-step reasoning - model waits for tool results
                      debugLog.liveGemini.log(`Executing ${toolCalls.length} tool call(s) in parallel...`);
                      const results = await executeToolCalls(toolCalls, handlers, { parallel: true });
                      debugLog.liveGemini.log('Tool execution complete:', results.map(r => `${r.name}: ${r.response.error || 'success'}`));

                      // Send all results back to Gemini in a single batch
                      withSession(session => {
                        session.sendToolResponse({
                          functionResponses: results.map(r => ({
                            id: r.id,
                            name: r.name,
                            response: r.response,
                          })),
                        });
                      });
                    } catch (err) {
                      debugLog.liveGemini.error('Tool execution batch failed:', err);
                      // Send error responses for all tools
                      withSession(session => {
                        session.sendToolResponse({
                          functionResponses: toolCalls.map(call => ({
                            id: call.id,
                            name: call.name,
                            response: { error: err instanceof Error ? err.message : 'Unknown error' },
                          })),
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
            debug("Connection Closed - Auto-reconnecting");
            // Keep stream open for instant DOM edits and follow-ups
            // Auto-reconnect immediately to maintain persistent connection
            debugLog.liveGemini.log('Stream closed, auto-reconnecting to maintain persistent connection...');

            // Reconnect immediately without delay to keep stream open
            reconnectAttemptRef.current = 0; // Reset counter on close since we auto-reconnect
            connect().catch(err => {
              debugLog.liveGemini.error('Auto-reconnect failed:', err);
              setStreamState(prev => ({ ...prev, error: 'Auto-reconnect failed. Click connect to try again.' }));
            });
          },
          onerror: (err) => {
            debugLog.liveGemini.error("Connection Error", err);
            // Use exponential backoff for errors (but immediate reconnect for normal close)
            if (reconnectAttemptRef.current < maxReconnectAttempts) {
              const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptRef.current);
              debugLog.liveGemini.log(`Error reconnect attempt ${reconnectAttemptRef.current + 1}/${maxReconnectAttempts} in ${delay}ms`);
              reconnectAttemptRef.current++;
              reconnectTimeoutRef.current = window.setTimeout(() => {
                debugLog.liveGemini.log('Attempting reconnect after error...');
                connect().catch(err => {
                  debugLog.liveGemini.error('Error reconnect failed:', err);
                });
              }, delay);
            } else {
              debugLog.liveGemini.log('Max reconnect attempts reached after error');
              setStreamState(prev => ({ ...prev, error: 'Connection failed. Please try again.' }));
              cleanup();
            }
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

      // Connection attempt complete (session created), reset connecting flag
      // Note: isConnected is set to true in the onopen callback
      isConnectingRef.current = false;

    } catch (error: unknown) {
      debugLog.liveGemini.error(error);
      setStreamState(prev => ({ ...prev, error: error instanceof Error ? error.message : "Failed to connect" }));
      isConnectingRef.current = false; // Reset flag on error
      cleanup();
    }
  }, [cleanup, onCodeUpdate, onElementSelect, onExecuteCode, onConfirmSelection, onApproveChange, onRejectChange, onUndoChange, selectedElement, googleApiKey, selectedModelId]);

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

  // Stop speaking - interrupts current audio playback without disconnecting
  const stopSpeaking = useCallback(() => {
    debugLog.liveGemini.log('Stopping speech - clearing audio queue');
    const sourcesToStop = Array.from(audioSourcesRef.current);
    audioSourcesRef.current.clear();
    sourcesToStop.forEach(source => {
      try { source.stop(); } catch { /* ignore already stopped sources */ }
    });
    nextStartTimeRef.current = 0;
  }, []);

  // Intentional disconnect - prevents auto-reconnect
  const disconnect = useCallback(() => {
    debugLog.liveGemini.log('User initiated disconnect - preventing auto-reconnect');
    cleanup(true); // Pass skipReconnect=true to prevent auto-reconnect
  }, [cleanup]);

  return {
    streamState,
    connect,
    disconnect,
    startVideoStreaming,
    stopVideoStreaming,
    stopSpeaking,
    volume,
  };
}

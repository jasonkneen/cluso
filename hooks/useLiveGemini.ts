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
  onFindElementByText?: (searchText: string, elementType?: string) => Promise<{ success: boolean; matches?: Array<{ elementNumber: number; text: string; tagName: string }>; error?: string }>;
  // DOM Navigation
  onSelectParent?: (levels?: number) => Promise<{ success: boolean; element?: any; error?: string }>;
  onSelectChildren?: (selector?: string) => Promise<{ success: boolean; children?: any[]; error?: string }>;
  onSelectSiblings?: (direction: 'next' | 'prev' | 'all') => Promise<{ success: boolean; siblings?: any[]; error?: string }>;
  onSelectAllMatching?: (matchBy: 'tag' | 'class' | 'both') => Promise<{ success: boolean; matches?: any[]; error?: string }>;
  // Drill-Down Selection
  onStartDrillSelection?: () => Promise<{ success: boolean; sections?: any[]; level?: number; error?: string }>;
  onDrillInto?: (elementNumber: number) => Promise<{ success: boolean; isFinalSelection?: boolean; element?: any; children?: any[]; description?: string; level?: number; canGoBack?: boolean; canGoForward?: boolean; error?: string }>;
  onDrillBack?: () => Promise<{ success: boolean; children?: any[]; level?: number; canGoBack?: boolean; canGoForward?: boolean; error?: string }>;
  onDrillForward?: () => Promise<{ success: boolean; children?: any[]; level?: number; canGoBack?: boolean; canGoForward?: boolean; error?: string }>;
  onExitDrillMode?: () => Promise<{ success: boolean }>;
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

const findElementByTextTool: FunctionDeclaration = {
  name: 'find_element_by_text',
  description: `🔎 TEXT SEARCH - Find elements by their visible text content.

USE THIS WHEN user says things like:
- "find the Book a Demo button" → find_element_by_text("Book a Demo")
- "click the Sign Up link" → find_element_by_text("Sign Up")
- "select the Learn More button" → find_element_by_text("Learn More")

This searches ALL visible text on the page and returns matching elements with their numbers.
The search is case-insensitive and matches partial text.

After finding matches, use highlight_element_by_number() to highlight the result.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      searchText: {
        type: Type.STRING,
        description: 'The text to search for (case-insensitive, partial match)',
      },
      elementType: {
        type: Type.STRING,
        description: 'Optional: limit search to specific element types - "button", "link", "heading", "any" (default)',
      },
    },
    required: ['searchText'],
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
  description: `Clear focus and show ALL page elements again.
Use when user says: "zoom out", "show all", "go back", "everything"`,
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

// DOM Navigation Tools - move around the DOM tree
const selectParentTool: FunctionDeclaration = {
  name: 'select_parent',
  description: `Select the PARENT element of current selection.
Use when: "select parent", "go up", "container", "wrapper", "the thing containing this"`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      levels: {
        type: Type.NUMBER,
        description: 'How many levels up (default 1). "grandparent" = 2',
      },
    },
    required: [],
  },
};

const selectChildrenTool: FunctionDeclaration = {
  name: 'select_children',
  description: `Select CHILDREN of current element. Shows them numbered for picking.
Use when: "show children", "what's inside", "select the children", "items inside"`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      selector: {
        type: Type.STRING,
        description: 'Optional filter: "button", "div", "img" etc. Empty = all direct children',
      },
    },
    required: [],
  },
};

const selectSiblingsTool: FunctionDeclaration = {
  name: 'select_siblings',
  description: `Select SIBLINGS of current element (same level in DOM).
Use when: "next one", "previous", "the one after", "siblings", "others like this"`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      direction: {
        type: Type.STRING,
        description: '"next" = next sibling, "prev" = previous, "all" = all siblings',
      },
    },
    required: [],
  },
};

const selectAllMatchingTool: FunctionDeclaration = {
  name: 'select_all_matching',
  description: `Select ALL elements matching current element's type/class.
Use when: "all buttons like this", "every card", "all of these", "select all similar"`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      matchBy: {
        type: Type.STRING,
        description: '"tag" = same tag, "class" = same classes, "both" = exact match',
      },
    },
    required: [],
  },
};

// --- Hierarchical Drill-Down Selection Tools ---
// These enable step-by-step navigation through the page structure

const startDrillSelectionTool: FunctionDeclaration = {
  name: 'start_drill_selection',
  description: `🎯 START FOCUSED SELECTION MODE - Shows top-level page sections with numbers.

USE WHEN user is looking for something specific or confused about which element:
- "help me find the form"
- "where is the contact section?"
- "show me the main areas"
- "I can't find it"
- "which section has..."

This shows numbered sections like: [1] Header [2] Hero [3] Features [4] Footer
User says a number → drill_into() to focus there and see children.`,
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

const drillIntoTool: FunctionDeclaration = {
  name: 'drill_into',
  description: `📍 DRILL INTO a numbered element - Focus on it and show its children with new numbers.

USE WHEN user says a number during drill selection:
- "1" / "number 1" / "the first one"
- "4" / "number 4" / "that one"
- "the header" (if header is [1])

If the element has children → shows them numbered for further drilling.
If no children → selects it as final selection.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      elementNumber: {
        type: Type.NUMBER,
        description: 'The number of the element to drill into (1-based)',
      },
    },
    required: ['elementNumber'],
  },
};

const drillBackTool: FunctionDeclaration = {
  name: 'drill_back',
  description: `⬆️ GO BACK one level in drill selection - Return to parent level.

USE WHEN:
- "go back" / "back" / "up"  
- "go up" / "parent level"
- "wrong one" / "not that section"`,
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

const drillForwardTool: FunctionDeclaration = {
  name: 'drill_forward',
  description: `⬇️ GO FORWARD in drill selection - Redo last drill action.

USE WHEN:
- "go forward" / "forward"
- "back to where I was"
- "redo" / "return"`,
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

const exitDrillModeTool: FunctionDeclaration = {
  name: 'exit_drill_mode',
  description: `🚪 EXIT drill selection mode - Clear all numbered badges and highlights.

USE WHEN:
- "done" / "finished" / "exit"
- "clear" / "cancel"
- User selected final element
- Moving on to different task`,
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

export function useLiveGemini({ videoRef, canvasRef, onCodeUpdate, onElementSelect, onExecuteCode, onConfirmSelection, onGetPageElements, onFindElementByText, onPatchSourceFile, onListFiles, onReadFile, onClickElement, onNavigate, onScroll, onOpenItem, onOpenFile, onOpenFolder, onBrowserBack, onCloseBrowser, onApproveChange, onRejectChange, onUndoChange, onHighlightByNumber, onClearFocus, onSetViewport, onSwitchTab, onSelectParent, onSelectChildren, onSelectSiblings, onSelectAllMatching, onStartDrillSelection, onDrillInto, onDrillBack, onDrillForward, onExitDrillMode, selectedElement, projectFolder, currentUrl, googleApiKey, selectedModelId }: UseLiveGeminiParams) {
  const [streamState, setStreamState] = useState<StreamState>({
    isConnected: false,
    isStreaming: false,
    error: null,
  });

  const [volume, setVolume] = useState(0);

  // User corrections - when user manually selects elements to teach the voice agent
  interface UserCorrection {
    userDescription: string;       // What user said (e.g., "the form", "the container")
    element: SelectedElement;      // The element they manually selected
    timestamp: Date;
  }
  const userCorrectionsRef = useRef<UserCorrection[]>([]);

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

      // Resume audio contexts (required by browsers after user interaction)
      if (inputAudioContextRef.current.state === 'suspended') {
        await inputAudioContextRef.current.resume();
        debugLog.liveGemini.log('Input AudioContext resumed');
      }
      if (outputAudioContextRef.current.state === 'suspended') {
        await outputAudioContextRef.current.resume();
        debugLog.liveGemini.log('Output AudioContext resumed');
      }
      analyserRef.current = outputAudioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Gemini Live API only supports specific models
      // Force use of gemini-2.0-flash-exp which is known to work with Live API
      const liveCompatibleModels = [
        'gemini-2.0-flash-exp',
        'gemini-2.0-flash-live-001',
        'gemini-2.0-flash',
      ];

      // Check if selected model is Live API compatible, otherwise use default
      let modelName = 'gemini-2.0-flash-exp'; // Default to known working model
      if (selectedModelId && liveCompatibleModels.some(m => selectedModelId.includes(m))) {
        modelName = selectedModelId;
      }

      debugLog.liveGemini.log('Connecting to Gemini Live with model:', modelName);
      debugLog.liveGemini.log('Selected model was:', selectedModelId, '(Live API requires 2.0 models)');
      debugLog.liveGemini.log('API key present:', !!apiKey, 'length:', apiKey?.length);

      const sessionPromise = aiRef.current.live.connect({
        model: modelName,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          tools: [{ functionDeclarations: [updateUiTool, selectElementTool, executeCodeTool, confirmSelectionTool, getPageElementsTool, findElementByTextTool, patchSourceFileTool, listFilesTool, readFileTool, clickElementTool, navigateTool, scrollTool, openFileBrowserItemTool, openFileTool, openFolderTool, fileBrowserBackTool, closeFileBrowserTool, approveCchangeTool, rejectChangeTool, undoChangeTool, highlightByNumberTool, clearFocusTool, setViewportTool, switchTabTool, selectParentTool, selectChildrenTool, selectSiblingsTool, selectAllMatchingTool, startDrillSelectionTool, drillIntoTool, drillBackTool, drillForwardTool, exitDrillModeTool] }],
          systemInstruction: `You are a fast, silent UI engineer. ACT FIRST, talk minimally.

CORE RULES:
1. NEVER ASK PERMISSION - just do it. User said it, so do it.
2. SELECT IMMEDIATELY when user refers to something - even if wrong, they'll correct you
3. BE SILENT during actions - no "I'll now..." or "Let me..."
4. RESPOND BRIEFLY after actions - "Done" or "Selected the header"

INSTANT SELECTION - When user mentions ANY element:
- "that button" → find_element_by_text + highlight immediately
- "the header" → highlight_element_by_number(likely #1) immediately  
- "number 3" → highlight_element_by_number(3)
- "the image" → get_page_elements("images") + highlight first one
Don't ask "which one?" - SELECT THE MOST LIKELY ONE. User will say "no, the other one"

🎯 DRILL-DOWN SELECTION - For finding specific elements step by step:
When user says "help me find", "where is", "show me sections", "I can't find":
1. start_drill_selection() → Shows numbered top-level sections from the ACTUAL page
2. User says a number → drill_into(N) → Focus there, show its children numbered
3. Keep drilling until user finds what they want
4. "go back" / "back" → drill_back() → Return to parent level
5. "forward" → drill_forward() → Redo (if went back)
6. "done" / "exit" → exit_drill_mode() → Clear and finish

The tool returns the ACTUAL sections/elements found on the page. Read them back to the user.
Example flow (actual content will vary by page):
- start_drill_selection() returns sections → Tell user what you found
- User picks a number → drill_into(N) → Tell user what children you found
- Repeat until final selection or user says "go back" / "done"

DOM NAVIGATION - Move around the tree:
- "parent" / "container" / "go up" → select_parent()
- "children" / "what's inside" → select_children()
- "next" / "previous" / "sibling" → select_siblings()
- "all like this" / "every button" → select_all_matching()

HIERARCHY:
- highlight_element_by_number() SETS FOCUS - subsequent get_page_elements() shows only children
- "zoom out" / "clear" → clear_focus()

EDITS - Use execute_code(), NEVER update_ui():
- "make it red" → execute_code() immediately
- "delete it" → execute_code() to remove
- "change text to X" → execute_code() to set innerText

${selectedElement ? `SELECTED: <${selectedElement.tagName}> "${selectedElement.text?.slice(0,30) || ''}" - target THIS with execute_code()` : ''}

FILE BROWSER:
- "show files" → list_files()
- "open 3" → open_item(3)
- "close" → close_browser()

APPROVAL: "yes" → approve_change(), "no" → reject_change(), "undo" → undo_change()

BE INSTANT. BE SILENT. ACT FIRST.`,
        },
        callbacks: {
          onopen: () => {
            debug("Connection Opened");
            debugLog.liveGemini.log('Gemini Live connection opened successfully');
            debugLog.liveGemini.log('Input AudioContext state:', inputAudioContextRef.current?.state);
            debugLog.liveGemini.log('Media stream tracks:', mediaStreamRef.current?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, muted: t.muted })));
            reconnectAttemptRef.current = 0; // Reset reconnect counter on successful connection
            setStreamState(prev => ({ ...prev, isConnected: true }));

            if (!inputAudioContextRef.current) {
              debugLog.liveGemini.error('Input AudioContext is null!');
              return;
            }

            // Ensure AudioContext is running (may have been suspended during connection delay)
            if (inputAudioContextRef.current.state === 'suspended') {
              inputAudioContextRef.current.resume().then(() => {
                debugLog.liveGemini.log('Input AudioContext resumed in onopen');
              });
            }

            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            let audioChunkCount = 0;
            processor.onaudioprocess = (e) => {
               // Skip if session is closed or closing
               if (!sessionPromiseRef.current) return;

               const inputData = e.inputBuffer.getChannelData(0);

               // Check if there's actual audio data (not silence)
               let maxAmplitude = 0;
               for (let i = 0; i < inputData.length; i++) {
                 const absVal = Math.abs(inputData[i]);
                 if (absVal > maxAmplitude) maxAmplitude = absVal;
               }

               const blob = createAudioBlob(inputData);

               // Only send if session still exists
               sessionPromiseRef.current?.then(session => {
                 if (session && sessionPromiseRef.current) {
                   try {
                     session.sendRealtimeInput({ media: blob });
                   } catch (err) {
                     // Silently ignore send errors when connection is closing
                   }
                 }
               }).catch(() => {
                 // Session closed, ignore
               });

               // Log every 50th chunk to avoid spam
               audioChunkCount++;
               if (audioChunkCount % 50 === 0) {
                 debugLog.liveGemini.log(`Audio chunk ${audioChunkCount}, max amplitude: ${maxAmplitude.toFixed(4)}`);
               }
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
                      onFindElementByText,
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
                      onClearFocus,
                      onSetViewport,
                      onSwitchTab,
                      onSelectParent,
                      onSelectChildren,
                      onSelectSiblings,
                      onSelectAllMatching,
                      onStartDrillSelection,
                      onDrillInto,
                      onDrillBack,
                      onDrillForward,
                      onExitDrillMode,
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
            debug("Connection Closed");
            debugLog.liveGemini.log('Stream closed');

            // Clean up audio processing to stop "WebSocket closed" errors
            if (scriptProcessorRef.current) {
              scriptProcessorRef.current.disconnect();
              scriptProcessorRef.current = null;
            }

            // Only auto-reconnect if we still have a session reference (not manually disconnected)
            if (sessionPromiseRef.current && reconnectAttemptRef.current < maxReconnectAttempts) {
              reconnectAttemptRef.current++;
              const delay = 1000; // 1 second delay before reconnect
              debugLog.liveGemini.log(`Auto-reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${maxReconnectAttempts})...`);

              reconnectTimeoutRef.current = window.setTimeout(() => {
                // Double-check we should still reconnect
                if (sessionPromiseRef.current === null) {
                  debugLog.liveGemini.log('Reconnect cancelled - session was manually closed');
                  return;
                }
                sessionPromiseRef.current = null; // Clear before reconnecting
                connect().catch(err => {
                  debugLog.liveGemini.error('Auto-reconnect failed:', err);
                  setStreamState(prev => ({ ...prev, error: 'Auto-reconnect failed. Click connect to try again.' }));
                });
              }, delay);
            } else if (reconnectAttemptRef.current >= maxReconnectAttempts) {
              debugLog.liveGemini.log('Max reconnect attempts reached');
              setStreamState(prev => ({ ...prev, isConnected: false, error: 'Connection lost. Click to reconnect.' }));
              cleanup(true);
            }
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

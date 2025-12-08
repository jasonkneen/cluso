
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveGemini } from './hooks/useLiveGemini';
import { useGit } from './hooks/useGit';
import { useTheme } from './hooks/useTheme';
import { INJECTION_SCRIPT } from './utils/iframe-injection';
import { SelectedElement, Message as ChatMessage, ToolUsage } from './types';
import { TabState, createNewTab } from './types/tab';
import { TabBar, Tab, TabType } from './components/TabBar';
import { KanbanTab, TodosTab, NotesTab } from './components/tabs';
import { NewTabPage, addToRecentProjects, getRecentProject } from './components/NewTabPage';
import { KanbanColumn, TodoItem } from './types/tab';
import { ProjectSetupFlow } from './components/ProjectSetupFlow';
import { SettingsDialog, AppSettings, DEFAULT_SETTINGS, getFontSizeValue } from './components/SettingsDialog';
import { MgrepOnboardingDemo } from './components/MgrepOnboarding';
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block';
import { Tool, ToolContent, ToolHeader, ToolOutput } from '@/components/ai-elements/tool';
import { MessageResponse } from '@/components/ai-elements/message';
import { useAIChat, getProviderForModel, ProviderConfig, MCPToolDefinition, toCoreMessages } from './hooks/useAIChat';
import type { CoreMessage } from './hooks/useAIChat';
import { useCodingAgent, CodingContext, FileModificationEvent, ClarifyingQuestionData } from './hooks/useCodingAgent';
import { ClarifyingQuestion } from './components/ClarifyingQuestion';

import { useLSPUI } from './hooks/useLSPUI';
import { HoverTooltip } from './components/HoverTooltip';
import { AutocompletePopup } from './components/AutocompletePopup';
import { useMCP } from './hooks/useMCP';
import { useSelectorAgent } from './hooks/useSelectorAgent';
import { useToolTracker } from './hooks/useToolTracker';
import { useSteeringQuestions } from './hooks/useSteeringQuestions';
import { SteeringQuestions } from './components/SteeringQuestions';
import { generateTurnId } from './utils/turnUtils';
import { createToolError, formatErrorForDisplay } from './utils/toolErrorHandler';
import { PatchApprovalDialog } from './components/PatchApprovalDialog';

import { getElectronAPI } from './hooks/useElectronAPI';
import type { MCPServerConfig } from './types/mcp';
import { GoogleGenAI } from '@google/genai'; // Keep for voice streaming
import { playApprovalSound, playRejectionSound, playUndoSound } from './utils/audio';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  MousePointer2,
  Code2,
  Moon,
  Sun,
  GitBranch,
  Plus,
  Archive,
  ArrowDown,
  ArrowUp,
  PanelRight,
  PanelLeft,
  X,
  Monitor,
  Mic,
  Camera,
  Terminal,
  Send,
  ChevronDown,
  Box,
  Check,
  Save,
  Zap,
  Sparkles,
  Rocket,
  MessageCircle,
  Folder,
  File,
  Smartphone,
  Tablet,
  Settings,
  Brain,
  Flame,
  Lightbulb,
  Eye,
  EyeOff,
  Pencil,
  FilePlus,
  Trash2,
  HelpCircle,
  Search,
  Palette,
  Bug,
  FileText,
  FileCode,
  Globe,
  Image,
  FolderOpen,
  Square,
  Move,
  Copy,
  // Intent icons
  BookOpen,
  BarChart2,
  GitCompare,
  Map as MapIcon,
  FileEdit,
  TestTube,
  ShieldCheck,
  Upload,
  Wrench,
  MessageSquare,
  Hammer,
} from 'lucide-react';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { generateSourcePatch, SourcePatch } from './utils/generateSourcePatch';
import { useErrorPrefetch } from './hooks/useErrorPrefetch';
import { ErrorSolutionPanel } from './components/ErrorSolutionPanel';

// --- Helper Functions ---

// Helper function to get luminance of a hex color (0-1 scale)
function getLuminance(hex: string): number {
  hex = hex.replace(/^#/, '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Helper function to adjust hex color brightness for theme variations
function adjustBrightness(hex: string, percent: number): string {
  hex = hex.replace(/^#/, '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  r = Math.min(255, Math.max(0, Math.round(r + (r * percent / 100))));
  g = Math.min(255, Math.max(0, Math.round(g + (g * percent / 100))));
  b = Math.min(255, Math.max(0, Math.round(b + (b * percent / 100))));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Instant UI Update - uses Gemini Flash for fast DOM modifications
interface UIUpdateResult {
  cssChanges: Record<string, string>;
  textChange?: string;  // For changing element text content
  description: string;
  success: boolean;
}

async function generateUIUpdate(
  element: SelectedElement,
  userRequest: string,
  apiKey: string,
  modelId: string = 'gemini-2.5-flash'  // Default fallback, but should be passed explicitly
): Promise<UIUpdateResult> {
  const google = createGoogleGenerativeAI({ apiKey });

  const prompt = `You are a UI modification assistant. Given an HTML element and a user request, output ONLY a JSON object with changes.

Element:
- Tag: ${element.tagName}
- Classes: ${element.className || 'none'}
- ID: ${element.id || 'none'}
- Current text: ${element.text?.substring(0, 100) || 'none'}
- Current styles: ${JSON.stringify(element.computedStyle || {})}
- HTML: ${element.outerHTML?.substring(0, 500) || 'N/A'}

User request: "${userRequest}"

Respond with ONLY valid JSON. Use "textChange" for text modifications, "cssChanges" for style changes:
{
  "cssChanges": { "property": "value", ... },
  "textChange": "new text content if changing text",
  "description": "Brief description of changes"
}

IMPORTANT:
- For TEXT changes (changing what the element says): use "textChange" with the new text
- For STYLE changes (colors, sizes, spacing): use "cssChanges" with CSS properties
- Do NOT use cssChanges.content for text - that only works for ::before/::after pseudo-elements

Examples:
- "make it red" → {"cssChanges": {"color": "red"}, "description": "Changed text color to red"}
- "change to Download" → {"textChange": "Download", "description": "Changed text to Download"}
- "Download Now" → {"textChange": "Download Now", "description": "Changed text to Download Now"}
- "bigger font" → {"cssChanges": {"fontSize": "1.5em"}, "description": "Increased font size"}
- "make it say Hello" → {"textChange": "Hello", "description": "Changed text to Hello"}
- "red and say Click Me" → {"cssChanges": {"color": "red"}, "textChange": "Click Me", "description": "Changed color to red and text to Click Me"}`;

  try {
    console.log(`[UI Update] Calling ${modelId} for UI changes...`);
    console.log('[UI Update] API Key present:', !!apiKey, 'length:', apiKey?.length);
    const result = await generateText({
      model: google(modelId),
      prompt,
      maxTokens: 200,
    });

    // Parse the JSON response
    const text = result.text.trim();
    console.log('[UI Update] Gemini response:', text);

    // Handle markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const jsonStr = jsonMatch[1] || text;
    console.log('[UI Update] Parsing JSON:', jsonStr);
    const parsed = JSON.parse(jsonStr);

    console.log('[UI Update] Parsed result:', parsed);
    return {
      cssChanges: parsed.cssChanges || {},
      textChange: parsed.textChange,
      description: parsed.description || 'UI updated',
      success: true,
    };
  } catch (error) {
    console.error('[UI Update] Failed to generate:', error);
    return {
      cssChanges: {},
      description: 'Failed to generate UI changes',
      success: false,
    };
  }
}

// generateSourcePatch moved to utils/generateSourcePatch.ts

// Format relative time (e.g., "2m ago", "1h ago", "just now")
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

// --- Constants ---

// Custom AI Provider Icons
const ClaudeIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fillRule="nonzero"/>
  </svg>
);

const AnthropicIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M16.765 5h-3.308l5.923 15h3.23zM7.226 5L1.38 20h3.308l1.307-3.154h6.154l1.23 3.077h3.309L10.688 5zm-.308 9.077l2-5.308l2.077 5.308z"/>
  </svg>
);

const OpenAIIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M20.562 10.188c.25-.688.313-1.376.25-2.063c-.062-.687-.312-1.375-.625-2c-.562-.937-1.375-1.687-2.312-2.125c-1-.437-2.063-.562-3.125-.312c-.5-.5-1.063-.938-1.688-1.25S11.687 2 11 2a5.17 5.17 0 0 0-3 .938c-.875.624-1.5 1.5-1.813 2.5c-.75.187-1.375.5-2 .875c-.562.437-1 1-1.375 1.562c-.562.938-.75 2-.625 3.063a5.44 5.44 0 0 0 1.25 2.874a4.7 4.7 0 0 0-.25 2.063c.063.688.313 1.375.625 2c.563.938 1.375 1.688 2.313 2.125c1 .438 2.062.563 3.125.313c.5.5 1.062.937 1.687 1.25S12.312 22 13 22a5.17 5.17 0 0 0 3-.937c.875-.625 1.5-1.5 1.812-2.5a4.54 4.54 0 0 0 1.938-.875c.562-.438 1.062-.938 1.375-1.563c.562-.937.75-2 .625-3.062c-.125-1.063-.5-2.063-1.188-2.876m-7.5 10.5c-1 0-1.75-.313-2.437-.875c0 0 .062-.063.125-.063l4-2.312a.5.5 0 0 0 .25-.25a.57.57 0 0 0 .062-.313V11.25l1.688 1v4.625a3.685 3.685 0 0 1-3.688 3.813M5 17.25c-.438-.75-.625-1.625-.438-2.5c0 0 .063.063.125.063l4 2.312a.56.56 0 0 0 .313.063c.125 0 .25 0 .312-.063l4.875-2.812v1.937l-4.062 2.375A3.7 3.7 0 0 1 7.312 19c-1-.25-1.812-.875-2.312-1.75M3.937 8.563a3.8 3.8 0 0 1 1.938-1.626v4.751c0 .124 0 .25.062.312a.5.5 0 0 0 .25.25l4.875 2.813l-1.687 1l-4-2.313a3.7 3.7 0 0 1-1.75-2.25c-.25-.937-.188-2.062.312-2.937M17.75 11.75l-4.875-2.812l1.687-1l4 2.312c.625.375 1.125.875 1.438 1.5s.5 1.313.437 2.063a3.7 3.7 0 0 1-.75 1.937c-.437.563-1 1-1.687 1.25v-4.75c0-.125 0-.25-.063-.312c0 0-.062-.126-.187-.188m1.687-2.5s-.062-.062-.125-.062l-4-2.313c-.125-.062-.187-.062-.312-.062s-.25 0-.313.062L9.812 9.688V7.75l4.063-2.375c.625-.375 1.312-.5 2.062-.5c.688 0 1.375.25 2 .688c.563.437 1.063 1 1.313 1.625s.312 1.375.187 2.062m-10.5 3.5l-1.687-1V7.063c0-.688.187-1.438.562-2C8.187 4.438 8.75 4 9.375 3.688a3.37 3.37 0 0 1 2.062-.313c.688.063 1.375.375 1.938.813c0 0-.063.062-.125.062l-4 2.313a.5.5 0 0 0-.25.25c-.063.125-.063.187-.063.312zm.875-2L12 9.5l2.187 1.25v2.5L12 14.5l-2.188-1.25z"/>
  </svg>
);

const GeminiIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M24 12.024c-6.437.388-11.59 5.539-11.977 11.976h-.047C11.588 17.563 6.436 12.412 0 12.024v-.047C6.437 11.588 11.588 6.437 11.976 0h.047c.388 6.437 5.54 11.588 11.977 11.977z"/>
  </svg>
);

// Type for icon components
type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

// Icon mapping for models based on provider or specific model
const MODEL_ICONS: Record<string, IconComponent> = {
  'claude-code': ClaudeIcon,
};

// Provider icons fallback
const PROVIDER_ICONS: Record<string, IconComponent> = {
  'google': GeminiIcon,
  'openai': OpenAIIcon,
  'codex': OpenAIIcon,  // Codex OAuth uses OpenAI icon
  'anthropic': AnthropicIcon,
  'claude-code': ClaudeIcon,
};

// Helper to get icon for a model
const getModelIcon = (modelId: string, providerId: string): IconComponent => {
  return MODEL_ICONS[modelId] || PROVIDER_ICONS[providerId] || Sparkles;
};

// Helper to get short model name (removes provider prefix for compact display)
const getShortModelName = (name: string): string => {
  // Remove "Claude " prefix for Anthropic models
  if (name.startsWith('Claude ')) return name.slice(7)
  // Remove "Gemini " prefix for Google models
  if (name.startsWith('Gemini ')) return name.slice(7)
  // Keep others as-is (GPT-4o, etc are already short)
  return name
};

// Default model - Claude Haiku 4.5 for fast, efficient responses
const DEFAULT_MODEL = { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', Icon: ClaudeIcon, provider: 'claude-code' };

// Legacy MODELS constant for backwards compatibility
const MODELS = [
  DEFAULT_MODEL,
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro', Icon: Sparkles },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', Icon: Rocket },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', Icon: Zap },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', Icon: Zap },
];

const DEFAULT_URL = ''; // Empty string shows project selection (NewTabPage)

// Type for webview element (Electron)
interface WebviewElement extends HTMLElement {
  src: string;
  loadURL: (url: string) => void;
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  getURL: () => string;
  send: (channel: string, ...args: unknown[]) => void;
  openDevTools: () => void;
  executeJavaScript: (code: string) => Promise<unknown>;
  addEventListener: (event: string, callback: (event: unknown) => void) => void;
  removeEventListener: (event: string, callback: (event: unknown) => void) => void;
}

export default function App() {
  // Window state - for multi-window project locking
  const [windowId, setWindowId] = useState<number | null>(null);
  const [lockedProjectPath, setLockedProjectPath] = useState<string | null>(null);
  const [lockedProjectName, setLockedProjectName] = useState<string | null>(null);

  // Tab State - manages multiple browser tabs
  // First tab starts with the default URL so browser loads immediately
  const [tabs, setTabs] = useState<TabState[]>(() => [{
    ...createNewTab('tab-1', 'browser'),
    url: DEFAULT_URL,
    title: 'New Tab'
  }]);
  const [activeTabId, setActiveTabId] = useState('tab-1');

  // Get current active tab
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Error prefetch - monitors console for errors and provides solutions
  const [errorPanelVisible, setErrorPanelVisible] = useState(false);
  const { errors, isSearching, clearErrors, removeError, searchForSolution } = useErrorPrefetch({
    onErrorDetected: (error) => {
      console.log('[App] Error detected:', error.category, '-', error.message.substring(0, 100));
      // Auto-show panel on critical errors
      if (error.isCritical) {
        setErrorPanelVisible(true);
      }
    },
    onSolutionFound: (error) => {
      console.log('[App] Solution found for:', error.category);
    },
    enableAutoSearch: true,
    debounceMs: 1000,
  });

  // Tab management functions
  const handleNewTab = useCallback((type: 'browser' | 'kanban' | 'todos' | 'notes' = 'browser') => {
    const newTab = createNewTab(undefined, type);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const handleCloseTab = useCallback((tabId: string) => {
    // Find the tab to check if it's a project tab
    const tabToClose = tabs.find(t => t.id === tabId);

    // If it's a project tab, show confirmation
    if (tabToClose?.projectPath) {
      const confirmed = window.confirm(
        `Close project "${tabToClose.title || 'Untitled'}"?\n\nThis will close the project and clear its chat history.`
      );
      if (!confirmed) return;
    }

    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (filtered.length === 0) {
        // Don't allow closing last tab
        return prev;
      }
      // If closing active tab, switch to adjacent one
      if (tabId === activeTabId) {
        const closedIndex = prev.findIndex(t => t.id === tabId);
        const newActiveIndex = Math.min(closedIndex, filtered.length - 1);
        setActiveTabId(filtered[newActiveIndex].id);
      }
      return filtered;
    });

    // Clear chat history for the closed tab (especially for project tabs)
    if (tabToClose?.projectPath) {
      setMessages([]);
      setSelectedFiles([]);
      setSelectedElement(null);
    }
  }, [activeTabId, tabs]);

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const handleReorderTabs = useCallback((reorderedTabs: Tab[]) => {
    // Map the reordered Tab[] back to TabState[] preserving all properties
    setTabs(prev => {
      const tabMap = new Map(prev.map(t => [t.id, t]));
      return reorderedTabs.map(t => tabMap.get(t.id)!).filter(Boolean);
    });
  }, []);

  // Sync URL input when switching tabs
  useEffect(() => {
    setUrlInput(activeTab.url || '');
  }, [activeTabId, activeTab.url]);

  // Load existing tab data from disk on startup
  useEffect(() => {
    async function loadTabData() {
      // Guard against double-loading in React StrictMode
      if (tabDataLoadedRef.current) return;
      tabDataLoadedRef.current = true;

      if (!window.electronAPI?.tabdata) return;

      try {
        // Load kanban, todos, and notes data from disk
        const [kanbanResult, todosResult, notesResult] = await Promise.all([
          window.electronAPI.tabdata.loadKanban(undefined),
          window.electronAPI.tabdata.loadTodos(undefined),
          window.electronAPI.tabdata.loadNotes(undefined)
        ]);

        // If any data exists, create tabs for them
        const tabsToAdd: TabState[] = [];

        // Load all kanban boards (data is now an array)
        if (kanbanResult.success && Array.isArray(kanbanResult.data) && kanbanResult.data.length > 0) {
          for (const board of kanbanResult.data) {
            console.log('[TabData] Loaded kanban board:', board.boardId, board.boardTitle);
            tabsToAdd.push({
              ...createNewTab(undefined, 'kanban'),
              title: board.boardTitle || 'Kanban',
              kanbanData: {
                boardId: board.boardId,
                boardTitle: board.boardTitle || 'Kanban',
                columns: board.columns || []
              }
            });
          }
        }

        if (todosResult.success && todosResult.data) {
          console.log('[TabData] Loaded todos data');
          tabsToAdd.push({
            ...createNewTab(undefined, 'todos'),
            todosData: { items: todosResult.data.items }
          });
        }

        if (notesResult.success && notesResult.data) {
          console.log('[TabData] Loaded notes data');
          tabsToAdd.push({
            ...createNewTab(undefined, 'notes'),
            notesData: { content: notesResult.data.content }
          });
        }

        // Add loaded tabs to the existing tabs
        if (tabsToAdd.length > 0) {
          setTabs(prev => [...prev, ...tabsToAdd]);
        }
      } catch (error) {
        console.error('[TabData] Error loading tab data:', error);
      }
    }

    loadTabData();
  }, []);

  // Update current tab state helper
  const updateCurrentTab = useCallback((updates: Partial<TabState>) => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId ? { ...tab, ...updates } : tab
    ));
  }, [activeTabId]);

  // Update any tab by ID (for webview event handlers)
  const updateTab = useCallback((tabId: string, updates: Partial<TabState>) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, ...updates } : tab
    ));
  }, []);

  // Tab-specific data update handlers with persistence
  const saveKanbanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveTodosTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveNotesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use refs to avoid stale closures in debounced callbacks
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const tabDataLoadedRef = useRef(false); // Prevent double-loading in StrictMode
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);

  // Initialize window info on mount (for multi-window project locking)
  useEffect(() => {
    async function initWindowInfo() {
      if (!window.electronAPI?.window) return;

      try {
        const info = await window.electronAPI.window.getInfo();
        if (info.windowId) {
          setWindowId(info.windowId);
        }
        if (info.projectPath) {
          setLockedProjectPath(info.projectPath);
          setLockedProjectName(info.projectName);
          console.log(`[Window] Window ${info.windowId} locked to project: ${info.projectPath}`);
        }
      } catch (e) {
        console.warn('[Window] Failed to get window info:', e);
      }
    }

    initWindowInfo();

    // Also listen for window info sent on ready-to-show
    const unsubscribe = window.electronAPI?.window?.onInfo?.((info) => {
      if (info.windowId) setWindowId(info.windowId);
      if (info.projectPath) {
        setLockedProjectPath(info.projectPath);
        setLockedProjectName(info.projectName);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  // Track which projects have mgrep initialized (persistent across tab switches)
  const mgrepInitializedProjects = useRef<Set<string>>(new Set())

  // Auto-initialize mgrep when project loads - BUT ONLY ONCE PER PROJECT
  useEffect(() => {
    const projectPath = activeTab?.projectPath
    if (!projectPath || !window.electronAPI?.mgrep) return

    // Check if already handled for this project
    if (mgrepInitializedProjects.current.has(projectPath)) {
      console.log('[mgrep] Already handled for:', projectPath)
      return
    }

    let isCancelled = false

    // Check if this project needs initialization
    const checkStatus = async () => {
      try {
        const result = await Promise.race([
          window.electronAPI.mgrep.getStatus(projectPath),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]) as any

        if (isCancelled) return

        if (result.success && result.status && !result.status.ready) {
          // Not initialized yet - check if user wants to enable indexing
          const hasSeenPrompt = localStorage.getItem('mgrep-onboarding-seen')
          if (!hasSeenPrompt) {
            // First time - show onboarding with demo (but only once per app session)
            const onboardingShown = mgrepInitializedProjects.current.has('__onboarding_shown__')
            if (!onboardingShown) {
              setTimeout(() => {
                if (!isCancelled) setShowMgrepOnboarding(true)
              }, 1500)
              mgrepInitializedProjects.current.add('__onboarding_shown__')
            }
            return
          }

          // Auto-init if user previously opted in
          const autoInit = localStorage.getItem('mgrep-auto-init')
          if (autoInit === 'true') {
            console.log('[mgrep] Initializing for:', projectPath)
            window.electronAPI.mgrep.initialize(projectPath).then(() => {
              // Mark as initialized - won't init again even if we switch back to this tab
              mgrepInitializedProjects.current.add(projectPath)
              console.log('[mgrep] ✓ Initialized for:', projectPath)
            }).catch(err => {
              console.error('[mgrep] Auto-init failed:', err)
            })
          } else {
            // User opted out - mark as "handled" so we don't keep checking
            mgrepInitializedProjects.current.add(projectPath)
          }
        } else if (result.success && result.status && result.status.ready) {
          // Already initialized - mark it so we don't check again
          mgrepInitializedProjects.current.add(projectPath)
          console.log('[mgrep] Already ready for:', projectPath)
        }
      } catch (err) {
        console.error('[mgrep] Status check failed:', err)
      }
    }

    checkStatus()

    // NO CLEANUP - let initialization persist across tab switches
    return () => {
      isCancelled = true
    }
  }, [activeTab?.projectPath])

  const handleUpdateKanbanColumns = useCallback((columns: KanbanColumn[]) => {
    console.log('[TabData] handleUpdateKanbanColumns called, columns:', columns.length);
    const currentActiveTab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
    if (!currentActiveTab?.kanbanData) return;

    updateCurrentTab({
      kanbanData: {
        ...currentActiveTab.kanbanData,
        columns
      }
    });

    // Debounced save to disk
    if (saveKanbanTimeoutRef.current) {
      clearTimeout(saveKanbanTimeoutRef.current);
    }
    saveKanbanTimeoutRef.current = setTimeout(async () => {
      const tab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
      console.log('[TabData] Debounce fired, activeTab:', tab?.id, 'type:', tab?.type, 'hasTabdata:', !!window.electronAPI?.tabdata);
      if (window.electronAPI?.tabdata && tab?.kanbanData) {
        try {
          const result = await window.electronAPI.tabdata.saveKanban(tab.projectPath, {
            boardId: tab.kanbanData.boardId,
            boardTitle: tab.kanbanData.boardTitle,
            columns,
            updatedAt: new Date().toISOString()
          });
          console.log('[TabData] Kanban save result:', result);
        } catch (e) {
          console.error('[TabData] Failed to save kanban:', e);
        }
      } else {
        console.warn('[TabData] Cannot save - tabdata API:', !!window.electronAPI?.tabdata, 'activeTab:', !!tab);
      }
    }, 500);
  }, [updateCurrentTab]);

  const handleUpdateTodoItems = useCallback((items: TodoItem[]) => {
    updateCurrentTab({ todosData: { items } });

    // Debounced save to disk
    if (saveTodosTimeoutRef.current) {
      clearTimeout(saveTodosTimeoutRef.current);
    }
    saveTodosTimeoutRef.current = setTimeout(async () => {
      const currentActiveTab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
      if (window.electronAPI?.tabdata && currentActiveTab) {
        try {
          await window.electronAPI.tabdata.saveTodos(currentActiveTab.projectPath, {
            items,
            updatedAt: new Date().toISOString()
          });
          console.log('[TabData] Todos saved');
        } catch (e) {
          console.error('[TabData] Failed to save todos:', e);
        }
      }
    }, 500);
  }, [updateCurrentTab]);

  const handleUpdateNotesContent = useCallback((content: string) => {
    updateCurrentTab({ notesData: { content } });

    // Debounced save to disk
    if (saveNotesTimeoutRef.current) {
      clearTimeout(saveNotesTimeoutRef.current);
    }
    saveNotesTimeoutRef.current = setTimeout(async () => {
      const currentActiveTab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
      if (window.electronAPI?.tabdata && currentActiveTab) {
        try {
          await window.electronAPI.tabdata.saveNotes(currentActiveTab.projectPath, {
            content,
            updatedAt: new Date().toISOString()
          });
          console.log('[TabData] Notes saved');
        } catch (e) {
          console.error('[TabData] Failed to save notes:', e);
        }
      }
    }, 500);
  }, [updateCurrentTab]);

  // Handle kanban board title update
  const handleUpdateKanbanTitle = useCallback((title: string) => {
    const currentActiveTab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
    if (!currentActiveTab?.kanbanData) return;

    // Update both tab title and kanban boardTitle
    updateCurrentTab({
      title,
      kanbanData: {
        ...currentActiveTab.kanbanData,
        boardTitle: title
      }
    });

    // Trigger save with the updated title
    if (saveKanbanTimeoutRef.current) {
      clearTimeout(saveKanbanTimeoutRef.current);
    }
    saveKanbanTimeoutRef.current = setTimeout(async () => {
      const tab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
      if (window.electronAPI?.tabdata && tab?.kanbanData) {
        try {
          const result = await window.electronAPI.tabdata.saveKanban(tab.projectPath, {
            boardId: tab.kanbanData.boardId,
            boardTitle: title,
            columns: tab.kanbanData.columns,
            updatedAt: new Date().toISOString()
          });
          console.log('[TabData] Kanban title saved:', result);
        } catch (e) {
          console.error('[TabData] Failed to save kanban title:', e);
        }
      }
    }, 500);
  }, [updateCurrentTab]);

  // Convert TabState to Tab for TabBar
  const tabBarTabs: Tab[] = tabs.map(t => ({
    id: t.id,
    title: t.title || 'Cluso',
    url: t.url,
    favicon: t.favicon,
    type: t.type || 'browser',
    isProject: !!t.projectPath, // Mark project tabs with folder icon
  }));

  // Browser State
  const [urlInput, setUrlInput] = useState(DEFAULT_URL); // URL in address bar (editable)
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pageTitle, setPageTitle] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [previewIntent, setPreviewIntent] = useState<{ type: string; label: string; secondaryTypes?: string[]; secondaryLabels?: string[] } | null>(null);

  // Selection States
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const selectedElementRef = useRef<SelectedElement | null>(null);
  useEffect(() => { selectedElementRef.current = selectedElement; }, [selectedElement]);

  // Steering Questions - must be before the useEffect that uses refreshQuestions
  const { questions, dismissQuestion, selectQuestion, refreshQuestions } = useSteeringQuestions();

  // Update steering questions based on context
  useEffect(() => {
    refreshQuestions({
      messages,
      selectedElement,
      currentTab: 'chat', // Could expand this to support other tab types
    });
  }, [messages, selectedElement, refreshQuestions]);

  // Ref to hold file modification handler (allows late binding after addEditedFile is defined)
  const fileModificationHandlerRef = useRef<(event: FileModificationEvent) => void>(() => {});
  const [hoveredElement, setHoveredElement] = useState<{ element: SelectedElement; rect: { top: number; left: number; width: number; height: number } } | null>(null);
  const [screenshotElement, setScreenshotElement] = useState<SelectedElement | null>(null);
  const [capturedScreenshot, setCapturedScreenshot] = useState<string | null>(null);
  const [showScreenshotPreview, setShowScreenshotPreview] = useState(false);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const isUserScrollingRef = useRef(false);

  // Inspector & Context State
  const [isInspectorActive, setIsInspectorActive] = useState(false);
  const [isScreenshotActive, setIsScreenshotActive] = useState(false);
  const [isMoveActive, setIsMoveActive] = useState(false);

  // Move mode state - tracks target position for element repositioning
  const [moveTargetPosition, setMoveTargetPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Refs to track current state values for closures (webview event handlers)
  const isInspectorActiveRef = useRef(false);
  const isScreenshotActiveRef = useRef(false);
  const isMoveActiveRef = useRef(false);

  // Store previous model/thinking settings when inspector is activated
  const preInspectorSettingsRef = useRef<{
    model: typeof MODELS[0];
    thinkingLevel: 'off' | 'low' | 'med' | 'high' | 'ultrathink';
  } | null>(null);

  const [logs, setLogs] = useState<string[]>([]);
  const [attachLogs, setAttachLogs] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Model State - default to Claude Haiku 4.5
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  // Popup Input State
  const [popupInput, setPopupInput] = useState('');
  const [showElementChat, setShowElementChat] = useState(false);

  // File Selection State (@ commands)
  const [selectedFiles, setSelectedFiles] = useState<Array<{path: string; content: string}>>([]);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [showFileAutocomplete, setShowFileAutocomplete] = useState(false);
  const [directoryFiles, setDirectoryFiles] = useState<Array<{name: string; path: string; isDirectory: boolean}>>([]);
  const [currentDirectory, setCurrentDirectory] = useState<string>('');
  const [directoryStack, setDirectoryStack] = useState<string[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);

  // Slash Command State (/ commands)
  const [availableCommands, setAvailableCommands] = useState<Array<{name: string; prompt: string}>>([]);
  const [commandSearchQuery, setCommandSearchQuery] = useState('');
  const [showCommandAutocomplete, setShowCommandAutocomplete] = useState(false);

  // Context Chips State (+ for include, - for exclude)
  // +aisdk = include context, -gpt-4 = exclude/negative context
  const [contextChips, setContextChips] = useState<Array<{name: string; type: 'include' | 'exclude'}>>([]);
  const [recentContextChips, setRecentContextChips] = useState<Array<{name: string; type: 'include' | 'exclude'}>>([]);
  const [showChipAutocomplete, setShowChipAutocomplete] = useState(false);
  const [chipSearchQuery, setChipSearchQuery] = useState('');
  const [chipSearchType, setChipSearchType] = useState<'include' | 'exclude'>('include');

  // Thinking/Reasoning Mode State
  type ThinkingLevel = 'off' | 'low' | 'med' | 'high' | 'ultrathink';
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('off');
  const [showThinkingPopover, setShowThinkingPopover] = useState(false);

  // Git State
  const git = useGit();
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);

  // Tool Execution Tracking
  const toolTracker = useToolTracker();
  const [commitMessage, setCommitMessage] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [gitLoading, setGitLoading] = useState<string | null>(null);

  // Project Setup Flow State
  const [setupProject, setSetupProject] = useState<{ path: string; name: string; port?: number } | null>(null);

  // Web Search Results State (for console log error searching)
  interface SearchResult {
    title: string;
    url: string;
    snippet: string;
  }
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFileSearching, setIsFileSearching] = useState(false);
  const [showSearchPopover, setShowSearchPopover] = useState(false);
  const [attachedSearchResults, setAttachedSearchResults] = useState<SearchResult[] | null>(null); // Chip state

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Theme context - get current theme colors
  const { currentTheme } = useTheme();
  const themeColors = currentTheme.colors;

  // Detect if current theme is dark based on background luminance
  const isThemeDark = themeColors ? getLuminance(themeColors.background) < 0.5 : isDarkMode;

  // Panel colors derived from theme - used for all content panels
  // For dark themes: panels should be LIGHTER than background (creates depth)
  // For light themes: panels should be white/light
  const panelBg = themeColors?.background
    ? adjustBrightness(themeColors.background, isThemeDark ? 25 : 3)
    : (isDarkMode ? '#262626' : '#ffffff');
  const panelBorder = themeColors?.border || (isDarkMode ? '#404040' : '#e7e5e4');
  const panelText = themeColors?.foreground || (isDarkMode ? '#f5f5f5' : '#171717');
  const panelMuted = themeColors?.foreground
    ? adjustBrightness(themeColors.foreground, isThemeDark ? -30 : 30)
    : (isDarkMode ? '#a3a3a3' : '#78716c');
  const headerBg = themeColors?.background
    ? adjustBrightness(themeColors.background, isThemeDark ? 10 : -3)
    : (isDarkMode ? '#1a1a1a' : '#fafaf9');

  // Settings Dialog State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Fast Apply Status (Pro Feature)
  const [fastApplyReady, setFastApplyReady] = useState(false);

  // File Watcher Status
  const [fileWatcherActive, setFileWatcherActive] = useState(false);

  // Mgrep Onboarding State
  const [showMgrepOnboarding, setShowMgrepOnboarding] = useState(false);

  // Patch Approval State
  const [pendingPatches, setPendingPatches] = useState<SourcePatch[]>([]);
  const [currentPatchIndex, setCurrentPatchIndex] = useState(0);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);

  // App Settings State - with localStorage persistence
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('cluso-settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Deep merge to handle new settings added over time
        // Merge models: keep stored models but add any new ones from defaults
        const storedModelIds = new Set((parsed.models || []).map((m: { id: string }) => m.id));
        const newModels = DEFAULT_SETTINGS.models.filter(m => !storedModelIds.has(m.id));
        const mergedModels = [...(parsed.models || []), ...newModels];

        // Merge providers: keep stored providers but add any new ones from defaults
        const storedProviderIds = new Set((parsed.providers || []).map((p: { id: string }) => p.id));
        const newProviders = DEFAULT_SETTINGS.providers.filter(p => !storedProviderIds.has(p.id));
        const mergedProviders = [...(parsed.providers || []), ...newProviders];

        // Migrate old connection format to new MCP transport format
        const migratedConnections = (parsed.connections || []).map((conn: Record<string, unknown>) => {
          // If connection has 'url' but no 'transport', migrate to new format
          if (conn.type === 'mcp' && conn.url && !conn.transport) {
            return {
              ...conn,
              transport: { type: 'sse', url: conn.url },
            };
          }
          return conn;
        });

        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          models: mergedModels,
          providers: mergedProviders,
          connections: migratedConnections,
        };
      }
    } catch (e) {
      console.error('Failed to load settings from localStorage:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Persist settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('cluso-settings', JSON.stringify(appSettings));
    } catch (e) {
      console.error('Failed to save settings to localStorage:', e);
    }
  }, [appSettings]);

  // Close onboarding modal when project changes (but not on initial load)
  const prevProjectPathRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const currentPath = activeTab?.projectPath

    // Skip on first mount
    if (prevProjectPathRef.current === undefined) {
      prevProjectPathRef.current = currentPath
      return
    }

    // Only close if project actually changed (not just same project reloading)
    if (prevProjectPathRef.current !== currentPath && showMgrepOnboarding) {
      setShowMgrepOnboarding(false)
    }

    prevProjectPathRef.current = currentPath
  }, [activeTab?.projectPath, showMgrepOnboarding])

  // Provider order: Claude first, then OpenAI, then Gemini
  const providerSortOrder: Record<string, number> = {
    'claude-code': 1,  // Claude Code OAuth (recommended)
    'anthropic': 2,    // Claude legacy API
    'openai': 3,       // OpenAI API
    'codex': 4,        // Codex OAuth (ChatGPT Plus/Pro)
    'google': 5,       // Gemini (last)
  };

  // Get all models from settings with availability status, sorted by provider
  const displayModels = useMemo(() => {
    const models = appSettings.models.map(settingsModel => {
      const provider = appSettings.providers.find(p => p.id === settingsModel.provider);

      // For claude-code and codex, check OAuth status instead of provider API key
      const isProviderConfigured = settingsModel.provider === 'claude-code'
        ? !!appSettings.claudeCodeAuthenticated
        : settingsModel.provider === 'codex'
          ? !!appSettings.codexAuthenticated
          : provider?.enabled && !!provider?.apiKey;

      const isAvailable = settingsModel.enabled && isProviderConfigured;
      const Icon = getModelIcon(settingsModel.id, settingsModel.provider);

      return {
        id: settingsModel.id,
        name: settingsModel.name,
        provider: settingsModel.provider,
        Icon,
        isAvailable,
        isEnabled: settingsModel.enabled,
        isProviderConfigured,
      };
    });

    // Sort by provider: Claude → OpenAI → Gemini
    return models.sort((a, b) => {
      const orderA = providerSortOrder[a.provider] || 99;
      const orderB = providerSortOrder[b.provider] || 99;
      return orderA - orderB;
    });
  }, [appSettings.models, appSettings.providers, appSettings.claudeCodeAuthenticated, appSettings.codexAuthenticated]);

  // Get only available models (for backwards compatibility)
  const availableModels = useMemo(() => {
    return displayModels.filter(m => m.isAvailable);
  }, [displayModels]);

  // Get provider configs for AI SDK from settings
  const providerConfigs = useMemo((): ProviderConfig[] => {
    return appSettings.providers
      .filter(p => p.enabled && p.apiKey)
      .map(p => ({
        id: p.id as 'google' | 'openai' | 'anthropic',
        apiKey: p.apiKey,
      }));
  }, [appSettings.providers]);

  // Refs to track current values for async callbacks (prevents stale closures)
  const providerConfigsRef = useRef(providerConfigs);
  providerConfigsRef.current = providerConfigs;
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  // Streaming message state
  const [streamingMessage, setStreamingMessage] = useState<{
    id: string
    content: string
    reasoning: string
    toolCalls: Array<{ id: string; name: string; args: unknown; status: 'pending' | 'running' | 'complete' | 'error'; result?: unknown }>
  } | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  // Connection state: 'idle' = connected but not actively generating, 'streaming' = actively processing
  // This allows proper button states while maintaining persistent connection
  const [connectionState, setConnectionState] = useState<'disconnected' | 'idle' | 'streaming'>('disconnected')

  // Track completed tool calls that persist after streaming ends (for showing final success/error states)
  const [completedToolCalls, setCompletedToolCalls] = useState<Array<{
    id: string
    name: string
    status: 'success' | 'error'
    timestamp: Date
  }>>([])

  // Auto-clear completed tool calls after a delay
  useEffect(() => {
    if (completedToolCalls.length > 0) {
      const timer = setTimeout(() => {
        setCompletedToolCalls([])
      }, 5000) // Clear after 5 seconds
      return () => clearTimeout(timer)
    }
  }, [completedToolCalls])

  // Pending UI Patch State - stores patches that need user confirmation
  interface PendingPatch {
    id: string
    filePath: string
    originalContent: string
    patchedContent: string
    description: string
    elementSelector?: string  // CSS selector for the modified element
    cssChanges?: Record<string, string>  // CSS property changes made
    undoCode?: string  // JavaScript to revert DOM changes
    applyCode?: string  // JavaScript to re-apply DOM changes
    generatedBy?: 'fast-apply' | 'gemini' | 'fast-path'  // Which method generated the patch
    durationMs?: number  // How long it took to generate
  }
  const [pendingPatch, setPendingPatch] = useState<PendingPatch | null>(null)
  const [isPreviewingPatchOriginal, setIsPreviewingPatchOriginal] = useState(false)

  // Pending DOM Approval State - stores DOM changes that need user approval before source patch
  interface PendingDOMApproval {
    id: string;
    element: SelectedElement
    cssChanges: Record<string, string>
    textChange?: string
    srcChange?: { oldSrc: string; newSrc: string }  // For image src replacement
    description: string
    undoCode: string
    applyCode: string
    userRequest: string
    patchStatus: 'preparing' | 'ready' | 'error'
    patch?: PendingPatch
    patchError?: string
    userApproved?: boolean  // Set to true when user clicks Accept, triggers auto-apply when patch is ready
  }
  const [pendingDOMApproval, setPendingDOMApproval] = useState<PendingDOMApproval | null>(null)
  const [isGeneratingSourcePatch, setIsGeneratingSourcePatch] = useState(false)

  // Initialize AI Chat hook with streaming support
  const { generate: generateAI, stream: streamAI, cancel: cancelAI, isLoading: isAILoading, isGenerating: isAIGenerating, isInitialized: isAIInitialized } = useAIChat({
    onError: (err) => console.error('[AI SDK] Error:', err),
    onTextDelta: (delta) => {
      // Update streaming message content as chunks arrive
      console.log('[Stream] Text delta:', delta.substring(0, 50));
      setStreamingMessage(prev => {
        if (!prev) {
          console.warn('[Stream] No streaming message state!');
          return null;
        }
        return { ...prev, content: prev.content + delta };
      });
    },
    onReasoningDelta: (delta) => {
      // Update reasoning content as it arrives
      console.log('[Stream] Reasoning delta:', delta.substring(0, 50));
      setStreamingMessage(prev => prev ? { ...prev, reasoning: prev.reasoning + delta } : null)
    },
    onToolCall: (toolCall) => {
      // Add tool call to streaming message
      setStreamingMessage(prev => prev ? {
        ...prev,
        toolCalls: [...prev.toolCalls, {
          id: toolCall.toolCallId,
          name: toolCall.toolName,
          args: toolCall.args,
          status: 'running' as const,
        }]
      } : null)
      // Track tool execution start
      toolTracker.trackStart({
        id: toolCall.toolCallId,
        name: toolCall.toolName,
        args: toolCall.args as Record<string, unknown>,
      })
    },
    onToolResult: (toolResult) => {
      // Update tool call status when result arrives
      setStreamingMessage(prev => prev ? {
        ...prev,
        toolCalls: prev.toolCalls.map(tc =>
          tc.id === toolResult.toolCallId
            ? { ...tc, status: 'complete' as const, result: toolResult.result }
            : tc
        )
      } : null)
      // Track tool execution completion
      const hasError = toolResult.result && typeof toolResult.result === 'object' && 'error' in toolResult.result;
      if (hasError) {
        const errorMsg = String((toolResult.result as any).error);
        const toolName = toolResult.toolName?.replace(/^mcp_[^_]+_/, '') || 'tool';
        const toolError = createToolError(toolResult.toolCallId, toolName, new Error(errorMsg));
        const display = formatErrorForDisplay(toolError);
        console.log(`[Tool Error] ${display.title}: ${display.description}`);
        toolTracker.trackError(toolResult.toolCallId, errorMsg)
      } else {
        toolTracker.trackSuccess(toolResult.toolCallId, toolResult.result)

        // Track file modifications from Agent SDK tools (Write, Edit, MultiEdit)
        // These bypass our local tools, so we need to track them here
        const toolName = toolResult.toolName?.toLowerCase() || '';
        if (toolName.includes('write') || toolName.includes('edit')) {
          const result = toolResult.result as Record<string, unknown> | undefined;
          // Try to extract file path from result or args
          const filePath = result?.path || result?.file_path || result?.filePath;
          if (typeof filePath === 'string') {
            console.log('[Tool Result] File modification detected:', toolName, filePath);
            // Note: We can't get originalContent here as the file is already modified
            // The edited files drawer will show but undo will need git revert
            fileModificationHandlerRef.current({
              type: 'write',
              path: filePath,
              // originalContent is undefined - file already modified by SDK
              newContent: undefined, // We don't have the new content either
            });
          }
        }
      }
    },
  });

  // Update connection state when AI SDK initializes
  useEffect(() => {
    if (isAIInitialized && connectionState === 'disconnected') {
      setConnectionState('idle')
    }
  }, [isAIInitialized, connectionState])

  // Initialize MCP hook for Model Context Protocol server connections
  // Extract MCP server configs from settings connections
  const mcpServerConfigs = useMemo(() => {
    return (appSettings.connections || [])
      .filter((conn): conn is MCPServerConfig => conn.type === 'mcp' && 'transport' in conn)
      .filter(conn => conn.enabled)
  }, [appSettings.connections])

  const {
    allTools: mcpTools,
    callTool: callMCPTool,
    servers: mcpServers,
    isAvailable: mcpAvailable,
  } = useMCP({
    initialServers: mcpServerConfigs,
    autoConnect: true,
    onError: (err, serverId) => {
      console.error(`[MCP] Error${serverId ? ` on server ${serverId}` : ''}:`, err.message)
    },
  })

  // Convert MCP tools to the format expected by useCodingAgent
  // Ensure inputSchema has required 'type: object' field for Anthropic API compatibility
  const mcpToolDefinitions: MCPToolDefinition[] = useMemo(() => {
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object' as const,
        properties: tool.inputSchema?.properties || {},
        required: tool.inputSchema?.required || [],
      },
      serverId: tool.serverId,
    }))
  }, [mcpTools])

  // Clarifying Questions State
  const [pendingClarifyingQuestion, setPendingClarifyingQuestion] = useState<ClarifyingQuestionData | null>(null)
  const clarifyingQuestionResolverRef = useRef<((response: string | string[]) => void) | null>(null)

  // Handler for clarifying questions from AI
  const handleAskClarifyingQuestion = useCallback((question: ClarifyingQuestionData): Promise<string | string[]> => {
    return new Promise((resolve) => {
      clarifyingQuestionResolverRef.current = resolve
      setPendingClarifyingQuestion(question)
    })
  }, [])

  // Handle clarifying question submission
  const handleClarifyingQuestionSubmit = useCallback((questionId: string, response: string | string[]) => {
    if (clarifyingQuestionResolverRef.current) {
      clarifyingQuestionResolverRef.current(response)
      clarifyingQuestionResolverRef.current = null
    }
    setPendingClarifyingQuestion(null)
  }, [])

  // Handle clarifying question skip
  const handleClarifyingQuestionSkip = useCallback((questionId: string) => {
    if (clarifyingQuestionResolverRef.current) {
      clarifyingQuestionResolverRef.current('skipped')
      clarifyingQuestionResolverRef.current = null
    }
    setPendingClarifyingQuestion(null)
  }, [])

  // Initialize Coding Agent hook with MCP tools
  const {
    context: codingContext,
    lastIntent,
    isProcessing: isAgentProcessing,
    updateContext: updateCodingContext,
    processMessage: processCodingMessage,
    setProcessing: setAgentProcessing,
    tools: codingTools,
  } = useCodingAgent({
    mcpTools: mcpToolDefinitions,
    callMCPTool,
    onFileModified: useCallback((event: FileModificationEvent) => {
      // Delegate to ref (allows late binding after addEditedFile is defined)
      fileModificationHandlerRef.current(event);
    }, []),
    onAskClarifyingQuestion: handleAskClarifyingQuestion,
  });

  // Stash Confirmation Dialog State
  const [isStashDialogOpen, setIsStashDialogOpen] = useState(false);
  const [stashMessage, setStashMessage] = useState('');

  // Pending Code Change State (for preview/approve/reject)
  const [pendingChange, setPendingChange] = useState<{
    code: string;
    undoCode: string;
    description: string;
    additions: number;
    deletions: number;
    source?: 'dom' | 'code';
  } | null>(null);
  const [isPreviewingOriginal, setIsPreviewingOriginal] = useState(false);

  // Edited Files Drawer State
  interface EditedFile {
    path: string;
    fileName: string;
    additions: number;
    deletions: number;
    undoCode?: string;
    timestamp: Date;
    // For file-based undo (tool modifications)
    originalContent?: string;
    isFileModification?: boolean;
  }
  const [editedFiles, setEditedFiles] = useState<EditedFile[]>([]);
  const [isEditedFilesDrawerOpen, setIsEditedFilesDrawerOpen] = useState(false);

  // Viewport State (responsive preview)
  type ViewportSize = 'mobile' | 'tablet' | 'desktop';
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop');

  // Device presets for responsive testing
  interface DevicePreset {
    name: string
    width: number
    height: number
    type: ViewportSize
  }

  const devicePresets: DevicePreset[] = [
    // Mobile devices
    { name: 'iPhone SE', width: 375, height: 667, type: 'mobile' },
    { name: 'iPhone 14', width: 390, height: 844, type: 'mobile' },
    { name: 'iPhone 14 Pro Max', width: 430, height: 932, type: 'mobile' },
    { name: 'iPhone 15 Pro', width: 393, height: 852, type: 'mobile' },
    { name: 'Samsung Galaxy S21', width: 360, height: 800, type: 'mobile' },
    { name: 'Pixel 7', width: 412, height: 915, type: 'mobile' },
    // Tablet devices
    { name: 'iPad Mini', width: 768, height: 1024, type: 'tablet' },
    { name: 'iPad Air', width: 820, height: 1180, type: 'tablet' },
    { name: 'iPad Pro 11"', width: 834, height: 1194, type: 'tablet' },
    { name: 'iPad Pro 12.9"', width: 1024, height: 1366, type: 'tablet' },
    { name: 'Surface Pro 7', width: 912, height: 1368, type: 'tablet' },
    { name: 'Galaxy Tab S7', width: 800, height: 1280, type: 'tablet' },
  ]

  const [selectedDevice, setSelectedDevice] = useState<DevicePreset | null>(null)
  const [customWidth, setCustomWidth] = useState<number>(375)
  const [customHeight, setCustomHeight] = useState<number>(667)
  const [isCustomDevice, setIsCustomDevice] = useState(false)
  const [isDeviceSelectorOpen, setIsDeviceSelectorOpen] = useState(false)

  // Zoom options for device preview
  type ZoomLevel = 'fit' | '50' | '75' | '100' | '125' | '150'
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('fit')
  const [isZoomSelectorOpen, setIsZoomSelectorOpen] = useState(false)

  const zoomOptions: { value: ZoomLevel; label: string }[] = [
    { value: 'fit', label: 'Fit' },
    { value: '50', label: '50%' },
    { value: '75', label: '75%' },
    { value: '100', label: '100%' },
    { value: '125', label: '125%' },
    { value: '150', label: '150%' },
  ]

  // Get current viewport dimensions
  const currentWidth = isCustomDevice ? customWidth : (selectedDevice?.width ?? (viewportSize === 'tablet' ? 768 : 375))
  const currentHeight = isCustomDevice ? customHeight : (selectedDevice?.height ?? (viewportSize === 'tablet' ? 1024 : 667))

  const viewportWidths: Record<ViewportSize, number | null> = {
    mobile: 375,
    tablet: 768,
    desktop: null // null means full width
  };

  // Handle device selection
  const handleDeviceSelect = (device: DevicePreset) => {
    setSelectedDevice(device)
    setIsCustomDevice(false)
    setViewportSize(device.type)
    setIsDeviceSelectorOpen(false)
  }

  // Handle custom device
  const handleCustomDevice = () => {
    setIsCustomDevice(true)
    setSelectedDevice(null)
    setViewportSize('mobile')
    setIsDeviceSelectorOpen(false)
  }

  // Console Panel State
  const [consoleLogs, setConsoleLogs] = useState<Array<{type: 'log' | 'warn' | 'error' | 'info'; message: string; timestamp: Date}>>([]);
  const [isConsolePanelOpen, setIsConsolePanelOpen] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(192); // 192px = h-48
  const [consoleFilters, setConsoleFilters] = useState<Set<'log' | 'warn' | 'error' | 'info'>>(new Set());
  const [isConsoleResizing, setIsConsoleResizing] = useState(false);
  const consoleResizeStartY = useRef<number>(0);
  const consoleResizeStartHeight = useRef<number>(192);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [selectedLogIndices, setSelectedLogIndices] = useState<Set<number>>(new Set());
  const lastClickedLogIndex = useRef<number | null>(null);

  // Debug Mode - shows all activity in console panel
  const [debugMode, setDebugMode] = useState(false);

  // Debug logger that shows in both console.log and the console panel when debug mode is on
  const debugLog = useCallback((prefix: string, message: string, data?: unknown) => {
    const fullMessage = data !== undefined
      ? `[${prefix}] ${message}: ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`
      : `[${prefix}] ${message}`;
    console.log(fullMessage);
    if (debugMode) {
      setConsoleLogs(prev => [...prev.slice(-199), {
        type: 'info',
        message: fullMessage,
        timestamp: new Date()
      }]);
    }
  }, [debugMode]);

  // AI Element Selection State (pending confirmation)
  const [aiSelectedElement, setAiSelectedElement] = useState<{
    selector: string;
    reasoning: string;
    count?: number;
    elements?: SelectedElement[];
  } | null>(null);

  // Source code snippet display state
  const [displayedSourceCode, setDisplayedSourceCode] = useState<{
    code: string;
    fileName: string;
    startLine: number;
    endLine: number;
  } | null>(null);

  // LSP UI - hover tooltips and autocomplete for code
  const lspUI = useLSPUI(displayedSourceCode?.fileName);

  // Handle mouse move over code for LSP hover
  const handleCodeMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!displayedSourceCode) return;

    // Get position relative to the code block
    const target = e.target as HTMLElement;
    const codeElement = target.closest('pre');
    if (!codeElement) return;

    // Calculate approximate line and character from mouse position
    const rect = codeElement.getBoundingClientRect();
    const lineHeight = 20; // Approximate line height in pixels
    const charWidth = 8;   // Approximate character width in monospace

    const relativeY = e.clientY - rect.top;
    const relativeX = e.clientX - rect.left;

    const line = Math.floor(relativeY / lineHeight) + displayedSourceCode.startLine;
    const character = Math.floor(relativeX / charWidth);

    lspUI.showHover(e.clientX, e.clientY, line, character);
  }, [displayedSourceCode, lspUI]);

  // File Browser Overlay State
  interface FileBrowserItem {
    name: string;
    isDirectory: boolean;
    path: string;
  }
  interface FileBrowserPanel {
    type: 'directory' | 'file' | 'image';
    path: string;
    title: string;
    items?: FileBrowserItem[];  // for directories
    content?: string;           // for files
  }
  const [fileBrowserStack, setFileBrowserStack] = useState<FileBrowserPanel[]>([]);
  const [fileBrowserVisible, setFileBrowserVisible] = useState(false);
  const [fileBrowserBasePath, setFileBrowserBasePath] = useState<string>('');

  // Refs for file browser state (to avoid stale closures in Gemini session callbacks)
  const fileBrowserStackRef = useRef<FileBrowserPanel[]>([]);
  const fileBrowserVisibleRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    fileBrowserStackRef.current = fileBrowserStack;
    fileBrowserVisibleRef.current = fileBrowserVisible;
  }, [fileBrowserStack, fileBrowserVisible]);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Map of webview refs by tab id - each tab has its own webview instance
  const webviewRefs = useRef<Map<string, WebviewElement>>(new Map());

  // Helper to get the current tab's webview ref
  const getWebviewRef = useCallback((tabId: string) => webviewRefs.current.get(tabId), []);
  const activeWebview = webviewRefs.current.get(activeTabId);
  const isWebviewReady = activeTab.isWebviewReady;

  // Check if in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  // Debug: log electron status on mount
  useEffect(() => {
    console.log('isElectron:', isElectron);
    console.log('electronAPI:', window.electronAPI);
  }, [isElectron]);

  // Persist dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', String(isDarkMode));
  }, [isDarkMode]);

  // Check Fast Apply status (Pro Feature)
  useEffect(() => {
    const checkFastApplyStatus = async () => {
      if (!window.electronAPI?.fastApply) return;
      try {
        const status = await window.electronAPI.fastApply.getStatus();
        setFastApplyReady(status.ready);
      } catch (err) {
        console.log('[FastApply] Status check error:', err);
      }
    };

    checkFastApplyStatus();

    // Listen for model loaded/unloaded events
    const unsubLoaded = window.electronAPI?.fastApply?.onModelLoaded(() => {
      setFastApplyReady(true);
    });
    const unsubUnloaded = window.electronAPI?.fastApply?.onModelUnloaded(() => {
      setFastApplyReady(false);
    });

    return () => {
      unsubLoaded?.();
      unsubUnloaded?.();
    };
  }, []);

  // Keep refs in sync with state for webview event handler closures
  useEffect(() => {
    isInspectorActiveRef.current = isInspectorActive;
  }, [isInspectorActive]);

  useEffect(() => {
    isScreenshotActiveRef.current = isScreenshotActive;
  }, [isScreenshotActive]);

  useEffect(() => {
    isMoveActiveRef.current = isMoveActive;
  }, [isMoveActive]);

  // Auto-switch to Claude Haiku 4.5 (or fallback to fast model) when inspector is active
  useEffect(() => {
    if (isInspectorActive) {
      // Save current settings before switching
      preInspectorSettingsRef.current = {
        model: selectedModel,
        thinkingLevel: thinkingLevel,
      };

      // Prefer Claude Haiku 4.5 for fast tooling, fallback to other fast models
      const fastModel = displayModels.find(m =>
        m.id === 'claude-haiku-4-5' && m.isAvailable
      ) || displayModels.find(m =>
        m.id.includes('haiku') && m.isAvailable
      ) || displayModels.find(m =>
        m.id.includes('gemini-2') && m.id.includes('flash') && m.isAvailable
      ) || displayModels.find(m =>
        m.id.includes('flash') && m.isAvailable
      );

      if (fastModel) {
        console.log('[Inspector] Switching to fast model:', fastModel.id);
        setSelectedModel({
          id: fastModel.id,
          name: fastModel.name,
          provider: fastModel.provider,
          Icon: fastModel.Icon,
        });
      }

      // Disable thinking for faster responses
      if (thinkingLevel !== 'off') {
        console.log('[Inspector] Disabling thinking mode');
        setThinkingLevel('off');
      }
    } else if (preInspectorSettingsRef.current) {
      // Restore previous settings when inspector is deactivated
      console.log('[Inspector] Restoring previous model:', preInspectorSettingsRef.current.model.id);
      setSelectedModel(preInspectorSettingsRef.current.model);
      setThinkingLevel(preInspectorSettingsRef.current.thinkingLevel);
      preInspectorSettingsRef.current = null;
    }
  }, [isInspectorActive]); // Only trigger on inspector state change

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  // Sidebar resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      // Clamp between 430 and 800 pixels
      setSidebarWidth(Math.max(430, Math.min(800, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Console panel resize handlers
  const handleConsoleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    consoleResizeStartY.current = e.clientY;
    consoleResizeStartHeight.current = consoleHeight;
    setIsConsoleResizing(true);
  }, [consoleHeight]);

  useEffect(() => {
    if (!isConsoleResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate delta from start position (negative = dragging up = bigger)
      const delta = consoleResizeStartY.current - e.clientY;
      const newHeight = consoleResizeStartHeight.current + delta;
      // Clamp between 100 and 500 pixels
      setConsoleHeight(Math.max(100, Math.min(500, newHeight)));
    };

    const handleMouseUp = () => {
      setIsConsoleResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isConsoleResizing]);

  // Stash with optional message
  const handleStash = useCallback(async (message?: string) => {
    setGitLoading('stash');
    if (message && message.trim()) {
      // Use git stash push -m for named stash
      await git.stashWithMessage(message.trim());
    } else {
      await git.stash();
    }
    setGitLoading(null);
    setIsStashDialogOpen(false);
    setStashMessage('');
  }, [git]);

  // Approve pending code change - already applied, just confirm
  const handleApproveChange = useCallback(() => {
    console.log('[Exec] Changes confirmed');
    setPendingChange(null);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content: 'Changes confirmed.',
      timestamp: new Date()
    }]);
    // Play approval sound for voice confirmation feedback
    playApprovalSound().catch(err => console.error('[Audio] Approval sound error:', err));
  }, []);

  // Reject pending code change - undo and clear
  const handleRejectChange = useCallback(async () => {
    const webview = webviewRefs.current.get(activeTabId);
    console.log('[Exec] Rejecting change, pendingChange:', pendingChange);
    console.log('[Exec] undoCode:', pendingChange?.undoCode);
    console.log('[Exec] webview:', !!webview);

    let undoSucceeded = false;

    if (pendingChange?.undoCode && webview) {
      console.log('[Exec] Rejecting - running undo code:', pendingChange.undoCode);
      try {
        await webview.executeJavaScript(pendingChange.undoCode);
        console.log('[Exec] Undo executed successfully');
        undoSucceeded = true;
      } catch (err) {
        console.error('[Exec] Undo error:', err);
      }
    } else {
      console.log('[Exec] No undo code available or no webview');
    }

    // If undo failed and we have a webview, reload the page as fallback
    if (!undoSucceeded && webview) {
      console.log('[Exec] Undo failed - reloading page as fallback');
      try {
        (webview as Electron.WebviewTag).reload();
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: 'Changes discarded. Page reloaded to restore state.',
          timestamp: new Date()
        }]);
      } catch (e) {
        console.error('[Exec] Failed to reload:', e);
      }
    } else {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: 'Changes discarded.',
        timestamp: new Date()
      }]);
    }

    setPendingChange(null);
    // Play rejection sound for voice confirmation feedback
    playRejectionSound().catch(err => console.error('[Audio] Rejection sound error:', err));
  }, [pendingChange, activeTabId]);

  // Voice approval handlers that work with the existing pendingChange system
  const handleVoiceApprove = useCallback((reason?: string) => {
    console.log('[Voice] User said approve:', reason);
    // Delegate to existing approve handler which handles the DOM/code execution
    handleApproveChange();
  }, []);

  const handleVoiceReject = useCallback((reason?: string) => {
    console.log('[Voice] User said reject:', reason);
    // Delegate to existing reject handler which undoes changes
    handleRejectChange();
  }, []);

  const handleVoiceUndo = useCallback((reason?: string) => {
    console.log('[Voice] User said undo:', reason);
    // For undo via voice, just trigger the reject handler (same effect)
    // This reverts to the last pending change state
    if (pendingChange) {
      handleRejectChange();
    } else {
      // If no pending change, could implement undo history here
      playUndoSound().catch(err => console.error('[Audio] Undo sound error:', err));
      console.log('[Voice] No pending change to undo');
    }
  }, [pendingChange]);

  // Browser navigation functions - update active tab's URL
  const navigateTo = useCallback((url: string) => {
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'http://' + finalUrl;
    }
    console.log('Navigating to:', finalUrl);

    // Check if any existing tab has this URL with a projectPath - inherit it
    const matchingProjectTab = tabs.find(t =>
      t.projectPath && t.url && t.url.toLowerCase() === finalUrl.toLowerCase()
    );

    // Update both display URL and tab's navigation URL
    setUrlInput(finalUrl);
    if (matchingProjectTab && !activeTab.projectPath) {
      // Inherit projectPath from matching project tab
      console.log('Inheriting projectPath from matching tab:', matchingProjectTab.projectPath);
      updateCurrentTab({ url: finalUrl, projectPath: matchingProjectTab.projectPath });
    } else {
      updateCurrentTab({ url: finalUrl });
    }
  }, [updateCurrentTab, tabs, activeTab.projectPath]);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    navigateTo(urlInput);
  }, [urlInput, navigateTo]);

  const goBack = useCallback(() => {
    const webview = webviewRefs.current.get(activeTabId);
    if (webview && isElectron) {
      webview.goBack();
    }
  }, [isElectron, activeTabId]);

  const goForward = useCallback(() => {
    const webview = webviewRefs.current.get(activeTabId);
    if (webview && isElectron) {
      webview.goForward();
    }
  }, [isElectron, activeTabId]);

  const reload = useCallback(() => {
    const webview = webviewRefs.current.get(activeTabId);
    if (webview && isElectron) {
      webview.reload();
    }
  }, [isElectron, activeTabId]);

  // Handle AI element selection request
  const handleAiElementSelect = useCallback((selector: string, reasoning?: string) => {
    console.log('[AI] Requesting element selection:', selector, reasoning);

    // Validate selector - catch common jQuery mistakes
    const invalidPatterns = [
      { pattern: /:contains\s*\(/i, name: ':contains()' },
      { pattern: /:has\s*\([^)]*text/i, name: ':has(text)' },
      { pattern: /:eq\s*\(/i, name: ':eq()' },
      { pattern: /:gt\s*\(/i, name: ':gt()' },
      { pattern: /:lt\s*\(/i, name: ':lt()' },
      { pattern: /:first(?!\-)/i, name: ':first (use :first-child or :first-of-type)' },
      { pattern: /:last(?!\-)/i, name: ':last (use :last-child or :last-of-type)' },
    ];

    for (const { pattern, name } of invalidPatterns) {
      if (pattern.test(selector)) {
        console.error(`[AI] Invalid selector: ${name} is not valid CSS. Use attribute selectors like [attr*="text"] instead.`);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `Invalid selector: ${name} is jQuery-only, not valid CSS. Use attribute selectors like [attr*="text"] or call get_page_elements first.`,
          timestamp: new Date()
        }]);
        return;
      }
    }

    const webview = webviewRefs.current.get(activeTabId);
    if (webview && isWebviewReady) {
      // Send IPC message to webview to highlight the element
      webview.send('select-element-by-selector', selector);

      // Store pending selection (we'll get confirmation via message)
      setAiSelectedElement({ selector, reasoning: reasoning || '' });
    }
  }, [isWebviewReady, activeTabId]);

  // Handle AI code execution
  const handleExecuteCode = useCallback((code: string, description: string) => {
    console.log('[AI] Executing code:', description);
    console.log('[AI] Code to execute:', code);
    const webview = webviewRefs.current.get(activeTabId);
    if (webview && isWebviewReady) {
      // Wrap code in try-catch to capture actual error from webview
      const wrappedCode = `
        (function() {
          try {
            ${code}
            return { success: true };
          } catch (err) {
            return { success: false, error: err.message, stack: err.stack };
          }
        })()
      `;
      webview.executeJavaScript(wrappedCode)
        .then((result: { success: boolean; error?: string; stack?: string }) => {
          if (result && result.success) {
            console.log('[AI] Code executed successfully');
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'system',
              content: `✓ ${description}`,
              timestamp: new Date()
            }]);
          } else {
            const errorMsg = result?.error || 'Unknown error';
            console.error('[AI] Code execution error inside webview:', errorMsg);
            if (result?.stack) console.error('[AI] Stack:', result.stack);
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'system',
              content: `✗ Error: ${errorMsg}`,
              timestamp: new Date()
            }]);
          }
        })
        .catch((err: Error) => {
          // This catches syntax errors that prevent the code from even running
          console.error('[AI] Code execution error (syntax/parse):', err);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: `✗ Syntax Error: ${err.message}`,
            timestamp: new Date()
          }]);
        });
    }
  }, [isWebviewReady, activeTabId]);

  // Handle voice confirmation - can optionally specify which numbered element (1-indexed)
  const handleConfirmSelection = useCallback((confirmed: boolean, elementNumber?: number) => {
    console.log('[AI] Voice confirmation:', confirmed, 'element number:', elementNumber);
    const webview = webviewRefs.current.get(activeTabId);
    if (confirmed && aiSelectedElement?.elements && aiSelectedElement.elements.length > 0) {
      // If elementNumber specified (1-indexed), use that, otherwise use first
      const index = elementNumber ? Math.min(Math.max(elementNumber - 1, 0), aiSelectedElement.elements.length - 1) : 0;
      setSelectedElement(aiSelectedElement.elements[index]);
      webview?.send('clear-selection');
      setAiSelectedElement(null);
    } else {
      webview?.send('clear-selection');
      setAiSelectedElement(null);
    }
  }, [aiSelectedElement, activeTabId]);

  // Handle get_page_elements tool - scans page for interactive elements
  const handleGetPageElements = useCallback(async (category?: string): Promise<string> => {
    console.log('[AI] Getting page elements, category:', category);
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return 'Error: Webview not ready';
    }

    const scanCode = `
      (function() {
        const category = '${category || 'all'}';
        const results = {};

        // Helper to get element summary
        function summarize(el) {
          const text = el.innerText?.substring(0, 50) || '';
          const id = el.id ? '#' + el.id : '';
          const classes = el.className ? '.' + el.className.split(' ').slice(0, 2).join('.') : '';
          const href = el.getAttribute('href') || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          return { tag: el.tagName.toLowerCase(), id, classes, text: text.trim(), href, ariaLabel };
        }

        // Buttons (native + ARIA + shadcn)
        if (category === 'all' || category === 'buttons') {
          const buttons = document.querySelectorAll('button, [role="button"], [data-slot="button"], input[type="button"], input[type="submit"]');
          results.buttons = {
            count: buttons.length,
            examples: Array.from(buttons).slice(0, 5).map(summarize)
          };
        }

        // Links
        if (category === 'all' || category === 'links') {
          const links = document.querySelectorAll('a[href], [role="link"]');
          results.links = {
            count: links.length,
            examples: Array.from(links).slice(0, 5).map(summarize)
          };
        }

        // Inputs
        if (category === 'all' || category === 'inputs') {
          const inputs = document.querySelectorAll('input, textarea, select, [role="textbox"], [contenteditable="true"]');
          results.inputs = {
            count: inputs.length,
            examples: Array.from(inputs).slice(0, 5).map(el => ({
              ...summarize(el),
              type: el.getAttribute('type') || el.tagName.toLowerCase(),
              name: el.getAttribute('name') || '',
              placeholder: el.getAttribute('placeholder') || ''
            }))
          };
        }

        // Images
        if (category === 'all' || category === 'images') {
          const images = document.querySelectorAll('img, [role="img"], svg');
          results.images = {
            count: images.length,
            examples: Array.from(images).slice(0, 3).map(el => ({
              tag: el.tagName.toLowerCase(),
              alt: el.getAttribute('alt') || '',
              src: (el.getAttribute('src') || '').substring(0, 50)
            }))
          };
        }

        // Headings
        if (category === 'all' || category === 'headings') {
          const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
          results.headings = {
            count: headings.length,
            examples: Array.from(headings).slice(0, 5).map(summarize)
          };
        }

        // Interactive elements with click handlers (approximate)
        if (category === 'all') {
          const clickable = document.querySelectorAll('[onclick], [data-action], .cursor-pointer, [tabindex="0"]');
          results.otherClickable = {
            count: clickable.length,
            note: 'Elements with onclick, data-action, cursor-pointer class, or tabindex=0'
          };
        }

        return JSON.stringify(results, null, 2);
      })()
    `;

    try {
      const result = await webview.executeJavaScript(scanCode);
      console.log('[AI] Page elements result:', result);
      return result;
    } catch (err) {
      console.error('[AI] Failed to scan page elements:', err);
      return 'Error scanning page: ' + (err as Error).message;
    }
  }, [isWebviewReady, activeTabId]);

  // Selector Agent - persistent claude-agent-sdk session for fast element selection
  const {
    isActive: selectorAgentActive,
    isPrimed: selectorAgentPrimed,
    isWaiting: selectorAgentWaiting,
    initialize: initializeSelectorAgent,
    primeContext: primeSelectorContext,
    selectElement: requestElementSelection,
    latestResult: selectorResult,
    error: selectorAgentError,
  } = useSelectorAgent({
    cwd: activeTab?.projectPath || undefined,
    onSelectionResult: useCallback((result) => {
      console.log('[SelectorAgent] Selection result:', result);
      if (result.selector) {
        // Use the existing handleAiElementSelect flow
        handleAiElementSelect(result.selector, result.reasoning);
      } else if (result.suggestions?.length) {
        console.log('[SelectorAgent] No match, suggestions:', result.suggestions);
      }
    }, [handleAiElementSelect]),
    onError: useCallback((err) => {
      console.error('[SelectorAgent] Error:', err);
    }, []),
  });

  // Initialize selector agent when Electron is available
  useEffect(() => {
    if (isElectron && !selectorAgentActive) {
      initializeSelectorAgent().then(success => {
        if (success) {
          console.log('[SelectorAgent] Initialized successfully');
        }
      });
    }
  }, [isElectron, selectorAgentActive, initializeSelectorAgent]);

  // Prime selector agent with page context when page elements are fetched
  const primeAgentWithPageContext = useCallback(async () => {
    if (!selectorAgentActive) return;

    const pageElements = await handleGetPageElements('all');
    if (pageElements && !pageElements.startsWith('Error')) {
      const webview = webviewRefs.current.get(activeTabId);
      const pageUrl = webview ? await webview.executeJavaScript('window.location.href').catch(() => '') : '';
      const pageTitle = webview ? await webview.executeJavaScript('document.title').catch(() => '') : '';

      await primeSelectorContext({
        pageElements,
        pageUrl,
        pageTitle,
      });
      console.log('[SelectorAgent] Context primed');
    }
  }, [selectorAgentActive, handleGetPageElements, primeSelectorContext, activeTabId]);

  // Auto-prime selector agent when page loads
  useEffect(() => {
    if (selectorAgentActive && isWebviewReady && !selectorAgentPrimed) {
      // Debounce priming slightly to ensure page is stable
      const timer = setTimeout(() => {
        primeAgentWithPageContext();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectorAgentActive, isWebviewReady, selectorAgentPrimed, primeAgentWithPageContext]);

  // Handle patch_source_file tool - writes changes to actual source files
  const handlePatchSourceFile = useCallback(async (
    filePath: string,
    searchCode: string,
    replaceCode: string,
    description: string
  ): Promise<{ success: boolean; error?: string }> => {
    console.log('[AI] Patching source file:', filePath, description);

    if (!isElectron || !window.electronAPI?.files) {
      return { success: false, error: 'File editing only available in Electron mode' };
    }

    try {
      // Read the current file content
      const readResult = await window.electronAPI.files.readFile(filePath);
      if (!readResult.success || !readResult.data) {
        return { success: false, error: `Could not read file: ${filePath}` };
      }

      const currentContent = readResult.data;

      // Check if the search code exists in the file
      if (!currentContent.includes(searchCode)) {
        return { success: false, error: `Could not find the code to replace in ${filePath}. The file may have changed.` };
      }

      // Replace the code
      const newContent = currentContent.replace(searchCode, replaceCode);

      // Write the updated content
      const writeResult = await window.electronAPI.files.writeFile(filePath, newContent);
      if (!writeResult.success) {
        return { success: false, error: `Failed to write file: ${filePath}` };
      }

      // Add success message to chat
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `✓ Patched ${filePath}: ${description}`,
        timestamp: new Date()
      }]);

      return { success: true };
    } catch (err) {
      console.error('[AI] Failed to patch source file:', err);
      return { success: false, error: (err as Error).message };
    }
  }, [isElectron]);

  // Handle list_files tool - list files in a directory
  const handleListFiles = useCallback(async (path?: string): Promise<string> => {
    console.log('[AI] Listing files:', path);
    if (!isElectron || !window.electronAPI?.files) {
      return 'Error: File listing only available in Electron mode';
    }
    try {
      const result = await window.electronAPI.files.listDirectory(path);
      if (result.success && result.data) {
        const formatted = result.data.map(f =>
          `${f.isDirectory ? '📁' : '📄'} ${f.name}${f.isDirectory ? '/' : ''}`
        ).join('\n');
        return formatted || 'Empty directory';
      }
      return 'Error: Could not list directory';
    } catch (err) {
      return 'Error: ' + (err as Error).message;
    }
  }, [isElectron]);

  // Handle read_file tool - read a file's contents
  const handleReadFile = useCallback(async (filePath: string): Promise<string> => {
    console.log('[AI] Reading file:', filePath);
    if (!isElectron || !window.electronAPI?.files) {
      return 'Error: File reading only available in Electron mode';
    }
    try {
      const result = await window.electronAPI.files.readFile(filePath);
      if (result.success && result.data) {
        // Truncate if too long
        const content = result.data;
        if (content.length > 10000) {
          return content.substring(0, 10000) + '\n... (truncated, file is ' + content.length + ' chars)';
        }
        return content;
      }
      return 'Error: Could not read file';
    } catch (err) {
      return 'Error: ' + (err as Error).message;
    }
  }, [isElectron]);

  // Handle click_element tool - click on an element
  const handleClickElement = useCallback(async (selector: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[AI] Clicking element:', selector);
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' };
    }
    try {
      const code = `
        (function() {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (el) {
            el.click();
            return { success: true };
          }
          return { success: false, error: 'Element not found' };
        })()
      `;
      const result = await webview.executeJavaScript(code);
      return result;
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, [isWebviewReady, activeTabId]);

  // Handle navigate tool - browser navigation
  const handleNavigate = useCallback(async (action: string, url?: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[AI] Navigating:', action, url);
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview) {
      return { success: false, error: 'Webview not available' };
    }
    try {
      switch (action) {
        case 'back':
          webview.goBack();
          break;
        case 'forward':
          webview.goForward();
          break;
        case 'reload':
          webview.reload();
          break;
        case 'goto':
          if (url) {
            webview.loadURL(url);
          } else {
            return { success: false, error: 'URL required for goto action' };
          }
          break;
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, [activeTabId]);

  // Handle scroll tool - scroll the page
  const handleScroll = useCallback(async (target: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[AI] Scrolling to:', target);
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' };
    }
    try {
      let code: string;
      if (target === 'top') {
        code = `window.scrollTo({ top: 0, behavior: 'smooth' }); true;`;
      } else if (target === 'bottom') {
        code = `window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); true;`;
      } else {
        // Assume it's a selector
        code = `
          (function() {
            const el = document.querySelector('${target.replace(/'/g, "\\'")}');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return true;
            }
            return false;
          })()
        `;
      }
      const result = await webview.executeJavaScript(code);
      return { success: !!result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, [isWebviewReady, activeTabId]);

  // File Browser Overlay Functions
  const showFileBrowser = useCallback(async (path?: string): Promise<string> => {
    console.log('[FileBrowser] Opening:', path);
    if (!isElectron || !window.electronAPI?.files) {
      return 'Error: File browser only available in Electron mode';
    }
    try {
      const targetPath = path || fileBrowserBasePath || '.';
      const result = await window.electronAPI.files.listDirectory(targetPath);
      if (result.success && result.data) {
        const items: FileBrowserItem[] = result.data.map(f => ({
          name: f.name,
          isDirectory: f.isDirectory,
          path: `${targetPath}/${f.name}`.replace(/\/\//g, '/')
        }));

        // Set base path if not set
        if (!fileBrowserBasePath) {
          setFileBrowserBasePath(targetPath);
        }

        const panel: FileBrowserPanel = {
          type: 'directory',
          path: targetPath,
          title: targetPath.split('/').pop() || targetPath,
          items
        };

        // Update refs immediately (before React re-renders) so subsequent tool calls see the update
        fileBrowserStackRef.current = [panel];
        fileBrowserVisibleRef.current = true;

        setFileBrowserStack([panel]);
        setFileBrowserVisible(true);

        console.log('[FileBrowser] Opened - refs updated:', fileBrowserVisibleRef.current, fileBrowserStackRef.current.length);
        return `Showing ${items.length} items. Say "open" followed by a number to open an item.`;
      }
      return 'Error: Could not list directory';
    } catch (err) {
      return 'Error: ' + (err as Error).message;
    }
  }, [isElectron, fileBrowserBasePath]);

  const openFileBrowserItem = useCallback(async (itemNumber: number): Promise<string> => {
    console.log('[FileBrowser] Opening item:', itemNumber);
    console.log('[FileBrowser] State check - visible:', fileBrowserVisibleRef.current, 'stack length:', fileBrowserStackRef.current.length);

    // Use refs to get the latest state (avoids stale closure in Gemini session)
    const currentStack = fileBrowserStackRef.current;
    const isVisible = fileBrowserVisibleRef.current;

    if (!isVisible || currentStack.length === 0) {
      return `Error: No file browser open. (visible: ${isVisible}, stack: ${currentStack.length})`;
    }

    const currentPanel = currentStack[currentStack.length - 1];
    if (currentPanel.type !== 'directory' || !currentPanel.items) {
      return 'Error: Current panel is not a directory';
    }

    const index = itemNumber - 1;
    if (index < 0 || index >= currentPanel.items.length) {
      return `Error: Invalid item number. Choose 1-${currentPanel.items.length}`;
    }

    const item = currentPanel.items[index];

    if (item.isDirectory) {
      // Open directory
      if (!isElectron || !window.electronAPI?.files) {
        return 'Error: File browser only available in Electron mode';
      }
      const result = await window.electronAPI.files.listDirectory(item.path);
      if (result.success && result.data) {
        const items: FileBrowserItem[] = result.data.map(f => ({
          name: f.name,
          isDirectory: f.isDirectory,
          path: `${item.path}/${f.name}`.replace(/\/\//g, '/')
        }));

        const panel: FileBrowserPanel = {
          type: 'directory',
          path: item.path,
          title: item.name,
          items
        };

        // Update ref immediately
        fileBrowserStackRef.current = [...currentStack, panel];
        setFileBrowserStack(prev => [...prev, panel]);
        return `Opened folder "${item.name}" with ${items.length} items.`;
      }
      return 'Error: Could not open folder';
    } else {
      // Open file
      const ext = item.name.split('.').pop()?.toLowerCase();
      const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '');

      if (isImage) {
        const panel: FileBrowserPanel = {
          type: 'image',
          path: item.path,
          title: item.name
        };
        // Update ref immediately
        fileBrowserStackRef.current = [...currentStack, panel];
        setFileBrowserStack(prev => [...prev, panel]);
        return `Showing image "${item.name}"`;
      } else {
        // Read file content
        if (!isElectron || !window.electronAPI?.files) {
          return 'Error: File reading only available in Electron mode';
        }
        const result = await window.electronAPI.files.readFile(item.path);
        if (result.success && result.data) {
          const content = result.data.length > 50000
            ? result.data.substring(0, 50000) + '\n... (truncated)'
            : result.data;

          const panel: FileBrowserPanel = {
            type: 'file',
            path: item.path,
            title: item.name,
            content
          };
          // Update ref immediately
          fileBrowserStackRef.current = [...currentStack, panel];
          setFileBrowserStack(prev => [...prev, panel]);
          return `Opened file "${item.name}"`;
        }
        return 'Error: Could not read file';
      }
    }
  }, [isElectron]); // Uses refs for state, so no dependency on fileBrowserVisible/fileBrowserStack

  const fileBrowserBack = useCallback((): string => {
    // Use refs to get the latest state (avoids stale closure in Gemini session)
    const isVisible = fileBrowserVisibleRef.current;
    const currentStack = fileBrowserStackRef.current;

    if (!isVisible) {
      return 'No file browser open';
    }
    if (currentStack.length <= 1) {
      // Update refs immediately
      fileBrowserVisibleRef.current = false;
      fileBrowserStackRef.current = [];
      setFileBrowserVisible(false);
      setFileBrowserStack([]);
      return 'Closed file browser';
    }
    // Update ref immediately
    fileBrowserStackRef.current = currentStack.slice(0, -1);
    setFileBrowserStack(prev => prev.slice(0, -1));
    const prevPanel = currentStack[currentStack.length - 2];
    return `Back to "${prevPanel?.title || 'root'}"`;
  }, []); // Uses refs for state

  const closeFileBrowser = useCallback((): string => {
    // Update refs immediately
    fileBrowserVisibleRef.current = false;
    fileBrowserStackRef.current = [];
    setFileBrowserVisible(false);
    setFileBrowserStack([]);
    return 'Closed file browser';
  }, []);

  // Open folder by name or number
  const openFolder = useCallback(async (name?: string, itemNumber?: number): Promise<string> => {
    console.log('[FileBrowser] Opening folder:', name || `#${itemNumber}`);
    console.log('[FileBrowser] State check - visible:', fileBrowserVisibleRef.current, 'stack length:', fileBrowserStackRef.current.length);

    // Use refs to get the latest state (avoids stale closure in Gemini session)
    const currentStack = fileBrowserStackRef.current;
    const isVisible = fileBrowserVisibleRef.current;

    if (!isVisible || currentStack.length === 0) {
      return `Error: No file browser open. Use list_files first to show the file browser. (visible: ${isVisible}, stack: ${currentStack.length})`;
    }

    const currentPanel = currentStack[currentStack.length - 1];
    if (currentPanel.type !== 'directory' || !currentPanel.items) {
      return 'Error: Current panel is not a directory';
    }

    let targetItem: FileBrowserItem | undefined;
    let foundIndex: number = -1;

    // Find by name
    if (name) {
      const lowerName = name.toLowerCase();
      foundIndex = currentPanel.items.findIndex(item =>
        item.isDirectory && item.name.toLowerCase() === lowerName
      );
      if (foundIndex === -1) {
        // Try partial match
        foundIndex = currentPanel.items.findIndex(item =>
          item.isDirectory && item.name.toLowerCase().includes(lowerName)
        );
      }
      if (foundIndex !== -1) {
        targetItem = currentPanel.items[foundIndex];
      } else {
        const folders = currentPanel.items.filter(i => i.isDirectory).map(i => i.name).join(', ');
        return `Error: No folder named "${name}" found. Available folders: ${folders || 'none'}`;
      }
    }
    // Find by number
    else if (itemNumber !== undefined) {
      const index = itemNumber - 1;
      if (index < 0 || index >= currentPanel.items.length) {
        return `Error: Invalid item number. Choose 1-${currentPanel.items.length}`;
      }
      const item = currentPanel.items[index];
      if (!item.isDirectory) {
        return `Error: Item ${itemNumber} "${item.name}" is a file, not a folder. Use open_item for files.`;
      }
      targetItem = item;
      foundIndex = index;
    }
    else {
      return 'Error: Please provide either a folder name or item number';
    }

    // Open the folder
    if (!targetItem) {
      return 'Error: Could not find folder';
    }

    if (!isElectron || !window.electronAPI?.files) {
      return 'Error: File browser only available in Electron mode';
    }

    const result = await window.electronAPI.files.listDirectory(targetItem.path);
    if (result.success && result.data) {
      const items: FileBrowserItem[] = result.data.map(f => ({
        name: f.name,
        isDirectory: f.isDirectory,
        path: `${targetItem.path}/${f.name}`.replace(/\/\//g, '/')
      }));

      const panel: FileBrowserPanel = {
        type: 'directory',
        path: targetItem.path,
        title: targetItem.name,
        items
      };

      // Update ref immediately
      fileBrowserStackRef.current = [...currentStack, panel];
      setFileBrowserStack(prev => [...prev, panel]);
      return `Opened folder "${targetItem.name}" (item ${foundIndex + 1}) with ${items.length} items: ${items.slice(0, 5).map((i, idx) => `${idx + 1}. ${i.name}${i.isDirectory ? '/' : ''}`).join(', ')}${items.length > 5 ? '...' : ''}`;
    }
    return 'Error: Could not open folder';
  }, [isElectron]); // Uses refs for state, so no dependency on fileBrowserVisible/fileBrowserStack

  // Open file by name or path
  const openFile = useCallback(async (name?: string, path?: string): Promise<string> => {
    console.log('[FileBrowser] Opening file:', name || path);

    if (!isElectron || !window.electronAPI?.files) {
      return 'Error: File browser only available in Electron mode';
    }

    // If path is provided, use it directly
    if (path) {
      const result = await window.electronAPI.files.readFile(path);
      if (result.success && result.data) {
        const fileName = path.split('/').pop() || path;
        const ext = fileName.split('.').pop()?.toLowerCase();
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '');

        if (isImage) {
          const panel: FileBrowserPanel = {
            type: 'image',
            path: path,
            title: fileName
          };
          fileBrowserStackRef.current = [panel];
          fileBrowserVisibleRef.current = true;
          setFileBrowserStack([panel]);
          setFileBrowserVisible(true);
          return `Showing image "${fileName}"`;
        } else {
          const content = result.data.length > 50000
            ? result.data.substring(0, 50000) + '\n... (truncated)'
            : result.data;

          const panel: FileBrowserPanel = {
            type: 'file',
            path: path,
            title: fileName,
            content
          };
          fileBrowserStackRef.current = [panel];
          fileBrowserVisibleRef.current = true;
          setFileBrowserStack([panel]);
          setFileBrowserVisible(true);
          return `Opened file "${fileName}"`;
        }
      }
      return `Error: Could not read file at ${path}`;
    }

    // Search by name
    if (!name) {
      return 'Error: Please provide either a file name or path';
    }

    // First check the current file browser directory
    const currentStack = fileBrowserStackRef.current;
    let searchPath = fileBrowserBasePath || '.';

    if (currentStack.length > 0 && currentStack[currentStack.length - 1].type === 'directory') {
      searchPath = currentStack[currentStack.length - 1].path;
    }

    // List directory and search for file
    const result = await window.electronAPI.files.listDirectory(searchPath);
    if (result.success && result.data) {
      const lowerName = name.toLowerCase();
      // Find exact match first
      let found = result.data.find(f => !f.isDirectory && f.name.toLowerCase() === lowerName);
      // Then try partial match
      if (!found) {
        found = result.data.find(f => !f.isDirectory && f.name.toLowerCase().includes(lowerName));
      }

      if (found) {
        const filePath = `${searchPath}/${found.name}`.replace(/\/\//g, '/');
        const fileResult = await window.electronAPI.files.readFile(filePath);

        if (fileResult.success && fileResult.data) {
          const ext = found.name.split('.').pop()?.toLowerCase();
          const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '');

          // If browser not visible, show it first with the directory
          if (!fileBrowserVisibleRef.current) {
            const dirItems: FileBrowserItem[] = result.data.map(f => ({
              name: f.name,
              isDirectory: f.isDirectory,
              path: `${searchPath}/${f.name}`.replace(/\/\//g, '/')
            }));

            const dirPanel: FileBrowserPanel = {
              type: 'directory',
              path: searchPath,
              title: searchPath.split('/').pop() || searchPath,
              items: dirItems
            };

            if (isImage) {
              const filePanel: FileBrowserPanel = {
                type: 'image',
                path: filePath,
                title: found.name
              };
              fileBrowserStackRef.current = [dirPanel, filePanel];
              fileBrowserVisibleRef.current = true;
              setFileBrowserStack([dirPanel, filePanel]);
              setFileBrowserVisible(true);
              return `Showing image "${found.name}"`;
            } else {
              const content = fileResult.data.length > 50000
                ? fileResult.data.substring(0, 50000) + '\n... (truncated)'
                : fileResult.data;

              const filePanel: FileBrowserPanel = {
                type: 'file',
                path: filePath,
                title: found.name,
                content
              };
              fileBrowserStackRef.current = [dirPanel, filePanel];
              fileBrowserVisibleRef.current = true;
              setFileBrowserStack([dirPanel, filePanel]);
              setFileBrowserVisible(true);
              return `Opened file "${found.name}"`;
            }
          } else {
            // Browser already visible, just add the file panel
            if (isImage) {
              const panel: FileBrowserPanel = {
                type: 'image',
                path: filePath,
                title: found.name
              };
              fileBrowserStackRef.current = [...currentStack, panel];
              setFileBrowserStack(prev => [...prev, panel]);
              return `Showing image "${found.name}"`;
            } else {
              const content = fileResult.data.length > 50000
                ? fileResult.data.substring(0, 50000) + '\n... (truncated)'
                : fileResult.data;

              const panel: FileBrowserPanel = {
                type: 'file',
                path: filePath,
                title: found.name,
                content
              };
              fileBrowserStackRef.current = [...currentStack, panel];
              setFileBrowserStack(prev => [...prev, panel]);
              return `Opened file "${found.name}"`;
            }
          }
        }
        return `Error: Could not read file "${found.name}"`;
      }

      // File not found in current directory
      const files = result.data.filter(f => !f.isDirectory).map(f => f.name).slice(0, 10).join(', ');
      return `Error: File "${name}" not found in ${searchPath}. Available files: ${files || 'none'}${result.data.filter(f => !f.isDirectory).length > 10 ? '...' : ''}`;
    }

    return 'Error: Could not search directory';
  }, [isElectron, fileBrowserBasePath]);

  // Update handleListFiles to show overlay
  const handleListFilesWithOverlay = useCallback(async (path?: string): Promise<string> => {
    return showFileBrowser(path);
  }, [showFileBrowser]);

  // Handle instant code updates from Gemini's update_ui tool
  const handleCodeUpdate = useCallback((html: string) => {
    console.log('[InstantEdit] Applying HTML update to DOM');
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      console.warn('[InstantEdit] Webview not ready');
      return;
    }

    // Inject HTML into the webview instantly
    const injectCode = `
      (function() {
        try {
          // Replace entire document with new HTML
          document.documentElement.innerHTML = \`${html.replace(/`/g, '\\`')}\`;
          return { success: true, message: 'HTML updated' };
        } catch (err) {
          return { success: false, error: err.message };
        }
      })()
    `;

    webview.executeJavaScript(injectCode)
      .then((result: { success: boolean; message?: string; error?: string }) => {
        if (result?.success) {
          console.log('[InstantEdit] HTML applied to DOM successfully');
          // Show success message
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: '✓ UI updated instantly',
            timestamp: new Date()
          }]);
        } else {
          console.error('[InstantEdit] Failed to apply HTML:', result?.error);
        }
      })
      .catch((err: Error) => {
        console.error('[InstantEdit] Error injecting HTML:', err);
      });
  }, [isWebviewReady, activeTabId]);

  const {
    streamState,
    connect,
    disconnect,
    startVideoStreaming,
    stopVideoStreaming,
    volume
  } = useLiveGemini({
    videoRef,
    canvasRef,
    onCodeUpdate: handleCodeUpdate,
    onElementSelect: handleAiElementSelect,
    onExecuteCode: handleExecuteCode,
    onConfirmSelection: handleConfirmSelection,
    onGetPageElements: handleGetPageElements,
    onPatchSourceFile: handlePatchSourceFile,
    onListFiles: handleListFilesWithOverlay,
    onReadFile: handleReadFile,
    onClickElement: handleClickElement,
    onNavigate: handleNavigate,
    onScroll: handleScroll,
    onOpenItem: openFileBrowserItem,
    onOpenFile: openFile,
    onOpenFolder: openFolder,
    onBrowserBack: fileBrowserBack,
    onCloseBrowser: closeFileBrowser,
    onApproveChange: handleVoiceApprove,
    onRejectChange: handleVoiceReject,
    onUndoChange: handleVoiceUndo,
    selectedElement: selectedElement,
    // Pass Google API key from settings
    googleApiKey: appSettings.providers.find(p => p.id === 'google')?.apiKey,
  });

  // Load available prompts and directory files on mount
  useEffect(() => {
    if (isElectron && window.electronAPI?.files) {
      // Load prompts
      window.electronAPI.files.listPrompts().then(result => {
        if (result.success && result.data) {
          setAvailableCommands(result.data.map(name => ({ name, prompt: '' })));
        }
      });
      // Load directory files
      window.electronAPI.files.listDirectory().then(result => {
        if (result.success && result.data) {
          console.log('[Files] Loaded directory:', result.data.length, 'files');
          setDirectoryFiles(result.data);
        }
      });
    }
  }, [isElectron]);

  // Load directory listing for @ command
  const loadDirectoryFiles = useCallback(async (dirPath?: string) => {
    if (!isElectron || !window.electronAPI?.files) return;
    console.log('[@ Files] Loading directory:', dirPath || '(default)');
    const result = await window.electronAPI.files.listDirectory(dirPath);
    if (result.success && result.data) {
      console.log('[@ Files] Loaded', result.data.length, 'files from:', dirPath || '(default)');
      setDirectoryFiles(result.data);
      if (dirPath) {
        setCurrentDirectory(dirPath);
      }
    }
  }, [isElectron]);

  // Navigate into a subdirectory
  const navigateToDirectory = useCallback((dirPath: string) => {
    setDirectoryStack(prev => [...prev, currentDirectory]);
    loadDirectoryFiles(dirPath);
    setFileSearchQuery('');
    setAutocompleteIndex(0);
  }, [currentDirectory, loadDirectoryFiles]);

  // Navigate back to parent directory - use project path as root
  const navigateBack = useCallback(() => {
    const newStack = [...directoryStack];
    const parentDir = newStack.pop();
    setDirectoryStack(newStack);
    // If no parent in stack, go back to project root (or system root if no project)
    loadDirectoryFiles(parentDir || activeTab.projectPath || undefined);
    setFileSearchQuery('');
    setAutocompleteIndex(0);
  }, [directoryStack, loadDirectoryFiles, activeTab.projectPath]);

  // Handle @ command - select a file from the list
  const handleFileSelect = useCallback(async (filePath: string) => {
    if (!isElectron || !window.electronAPI?.files) return;

    const result = await window.electronAPI.files.selectFile(filePath);
    if (result.success && result.data) {
      const { path, content } = result.data;
      setSelectedFiles(prev => [...prev, { path, content }]);

      // Replace the @query with the file reference in the input
      // Find the last @ and replace from there to the end (or to the next space)
      setInput(prevInput => {
        const lastAtIndex = prevInput.lastIndexOf('@');
        if (lastAtIndex === -1) return ''; // Fallback: clear input

        // Get everything before the @
        const beforeAt = prevInput.substring(0, lastAtIndex);

        // Create a short display name for the file reference
        const fileName = path.split('/').pop() || path;

        // Return the text before @ + a reference marker (file is now in selectedFiles)
        // Add a space after so user can continue typing
        return `${beforeAt}[${fileName}] `;
      });

      setShowFileAutocomplete(false);
      setFileSearchQuery('');
      setAutocompleteIndex(0);
    }
  }, [isElectron]);

  // Handle / command - execute prompt
  const handleCommandSelect = useCallback(async (commandName: string) => {
    if (!isElectron || !window.electronAPI?.files) return;

    const result = await window.electronAPI.files.readPrompt(commandName);
    if (result.success && result.data) {
      setInput(result.data); // Replace input with prompt content
      setShowCommandAutocomplete(false);
      setCommandSearchQuery('');
      setAutocompleteIndex(0);
    }
  }, [isElectron]);

  // Get filtered files based on search query
  const filteredFiles = directoryFiles.filter(f =>
    !f.name.startsWith('.') &&
    f.name.toLowerCase().includes(fileSearchQuery.toLowerCase())
  );

  // Built-in commands for autocomplete (defined as useMemo to avoid re-creation)
  const builtInCommandsForAutocomplete = useMemo(() => [
    { name: 'new', prompt: 'Clear the conversation' },
    { name: 'clear', prompt: 'Clear the conversation' },
    { name: 'compact', prompt: 'Compact context with optional guidance' },
    { name: 'thinking', prompt: 'Set reasoning level: off, low, med, high, ultrathink' },
  ], []);

  // Get filtered commands based on search query (combines built-in + user commands)
  const filteredCommands = useMemo(() => {
    const allCommands = [...builtInCommandsForAutocomplete, ...availableCommands];
    return allCommands.filter(cmd =>
      cmd.name.toLowerCase().includes(commandSearchQuery.toLowerCase())
    );
  }, [builtInCommandsForAutocomplete, availableCommands, commandSearchQuery]);

  // Filtered recent context chips for autocomplete
  const filteredContextChips = useMemo(() => {
    // Filter by search query and exclude already-selected chips
    return recentContextChips.filter(chip => {
      const matchesQuery = chip.name.toLowerCase().includes(chipSearchQuery.toLowerCase());
      const alreadySelected = contextChips.some(c => c.name === chip.name && c.type === chip.type);
      return matchesQuery && !alreadySelected;
    });
  }, [recentContextChips, chipSearchQuery, contextChips]);

  // Handle chip selection from autocomplete
  const handleChipSelect = useCallback((chip: {name: string; type: 'include' | 'exclude'}) => {
    // Add the chip
    setContextChips(prev => {
      const exists = prev.some(c => c.name === chip.name && c.type === chip.type);
      if (exists) return prev;
      return [...prev, chip];
    });
    // Remove the +/- prefix from input
    setInput(prev => {
      const prefix = chip.type === 'include' ? '+' : '-';
      const pattern = new RegExp(`\\${prefix}[a-zA-Z0-9_-]*$`);
      return prev.replace(pattern, '');
    });
    // Hide autocomplete
    setShowChipAutocomplete(false);
    setChipSearchQuery('');
  }, []);

  // Detect @ and / and +/- commands in input
  const handleInputChange = useCallback((value: string) => {
    console.log('[Input] Changed:', value);

    // Detect +word and -word patterns for context chips
    // +word = include context, -word = exclude/negative context
    // Only convert to chip when followed by space (means user finished typing)
    const includePattern = /\+([a-zA-Z0-9_-]+)\s/g;
    const excludePattern = /-([a-zA-Z0-9_-]+)\s/g;
    let processedValue = value;
    const newChips: Array<{name: string; type: 'include' | 'exclude'}> = [];

    // Find include chips (+word)
    let match;
    while ((match = includePattern.exec(value)) !== null) {
      newChips.push({ name: match[1], type: 'include' });
      processedValue = processedValue.replace(match[0], '');
    }

    // Find exclude chips (-word) - but not if it looks like a number or math
    // Only match if preceded by space or start of string
    const excludeMatches = value.matchAll(/(?:^|\s)-([a-zA-Z][a-zA-Z0-9_-]*)\s/g);
    for (const m of excludeMatches) {
      newChips.push({ name: m[1], type: 'exclude' });
      processedValue = processedValue.replace(m[0], m[0].startsWith(' ') ? ' ' : '');
    }

    // Add new chips (avoid duplicates) and update recent chips
    if (newChips.length > 0) {
      setContextChips(prev => {
        const combined = [...prev];
        newChips.forEach(chip => {
          const exists = combined.some(c => c.name === chip.name && c.type === chip.type);
          if (!exists) {
            combined.push(chip);
          }
        });
        return combined;
      });
      // Add to recent chips for autocomplete
      setRecentContextChips(prev => {
        const updated = [...prev];
        newChips.forEach(chip => {
          // Move to front if already exists, or add to front
          const existingIdx = updated.findIndex(c => c.name === chip.name);
          if (existingIdx !== -1) {
            updated.splice(existingIdx, 1);
          }
          updated.unshift(chip);
        });
        // Keep only 20 most recent
        const limited = updated.slice(0, 20);
        // Save to localStorage
        try {
          const storageKey = `cluso-context-chips-${activeTab.projectPath || 'global'}`;
          localStorage.setItem(storageKey, JSON.stringify(limited));
        } catch (e) {
          console.warn('[ContextChips] Failed to save to localStorage:', e);
        }
        return limited;
      });
      // Update input with chips removed
      setInput(processedValue);
    } else {
      setInput(value);
    }

    setAutocompleteIndex(0);

    // Detect + or - for context chip autocomplete
    // Check for + (include)
    const lastPlusIndex = processedValue.lastIndexOf('+');
    const lastMinusIndex = processedValue.lastIndexOf('-');

    // Find which is more recent (later in string) and is a valid chip start
    let chipPrefix: '+' | '-' | null = null;
    let chipStartIndex = -1;

    if (lastPlusIndex !== -1) {
      const beforePlus = lastPlusIndex > 0 ? processedValue.charAt(lastPlusIndex - 1) : ' ';
      const afterPlus = processedValue.substring(lastPlusIndex + 1);
      const isStartOfWord = beforePlus === ' ' || lastPlusIndex === 0;
      const hasSpaceAfter = afterPlus.includes(' ');
      if (isStartOfWord && !hasSpaceAfter) {
        chipPrefix = '+';
        chipStartIndex = lastPlusIndex;
      }
    }

    if (lastMinusIndex !== -1 && lastMinusIndex > chipStartIndex) {
      const beforeMinus = lastMinusIndex > 0 ? processedValue.charAt(lastMinusIndex - 1) : ' ';
      const afterMinus = processedValue.substring(lastMinusIndex + 1);
      const isStartOfWord = beforeMinus === ' ' || lastMinusIndex === 0;
      const hasSpaceAfter = afterMinus.includes(' ');
      // Only treat as exclude chip if followed by a letter (not a number)
      const startsWithLetter = /^[a-zA-Z]/.test(afterMinus);
      if (isStartOfWord && !hasSpaceAfter && startsWithLetter) {
        chipPrefix = '-';
        chipStartIndex = lastMinusIndex;
      }
    }

    if (chipPrefix && chipStartIndex !== -1) {
      const query = processedValue.substring(chipStartIndex + 1);
      setChipSearchQuery(query);
      setChipSearchType(chipPrefix === '+' ? 'include' : 'exclude');
      setShowChipAutocomplete(true);
      setShowFileAutocomplete(false);
      setShowCommandAutocomplete(false);
      return; // Don't check other patterns
    }

    // Hide chip autocomplete if not in +/- mode
    setShowChipAutocomplete(false);
    setChipSearchQuery('');

    // Detect @ command for file selection - works ANYWHERE in input
    // Find the last @ symbol to get the current query
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // Check if there's a space after the @ (means user finished typing file ref)
      const afterAt = value.substring(lastAtIndex + 1);
      const hasSpaceAfter = afterAt.includes(' ');
      if (!hasSpaceAfter) {
        const query = afterAt;
        console.log('[Input] @ detected at position', lastAtIndex, 'query:', query);
        setFileSearchQuery(query);
        setShowFileAutocomplete(true);
        setShowCommandAutocomplete(false);
        // Load files on first @ - use project path if available
        if (query === '') {
          console.log('[@ Files] First @, using project path:', activeTab.projectPath || '(none)');
          loadDirectoryFiles(activeTab.projectPath || undefined);
        }
      } else {
        // User has moved past the @ reference, hide autocomplete
        setShowFileAutocomplete(false);
        setFileSearchQuery('');
      }
    }
    // Detect / command for prompt selection - ONLY at start of input
    else if (value.startsWith('/')) {
      const query = value.substring(1);
      console.log('[Input] / detected, query:', query);
      setCommandSearchQuery(query);
      setShowCommandAutocomplete(true);
      setShowFileAutocomplete(false);
    }
    else {
      setShowFileAutocomplete(false);
      setShowCommandAutocomplete(false);
      setFileSearchQuery('');
      setCommandSearchQuery('');
    }

    // Update preview intent as user types (only for meaningful input)
    if (value.trim().length >= 3 && !value.startsWith('@') && !value.startsWith('/')) {
      const { intent } = processCodingMessage(value);
      const intentLabels: Record<string, string> = {
        // Code operations
        code_edit: 'Edit Code',
        code_create: 'Create',
        code_delete: 'Delete',
        code_explain: 'Explain',
        code_refactor: 'Refactor',
        file_operation: 'File Op',
        // UI operations
        ui_inspect: 'Inspect',
        ui_modify: 'Modify UI',
        ui_build: 'Build UI',
        // Research & Analysis
        research: 'Research',
        analyze: 'Analyze',
        compare: 'Compare',
        // Planning & Architecture
        plan: 'Plan',
        document: 'Document',
        // Testing & Quality
        test: 'Test',
        debug: 'Debug',
        review: 'Review',
        // DevOps
        deploy: 'Deploy',
        configure: 'Configure',
        // Communication
        question: 'Question',
        chat: 'Chat',
        unknown: '',
      };
      if (intent.type !== 'unknown' && intent.confidence > 0.2) {
        // Filter secondary intents - remove primary type to avoid duplicates
        const dedupedSecondary = (intent.secondaryTypes || []).filter(t => t !== intent.type && t !== 'unknown');
        setPreviewIntent({
          type: intent.type,
          label: intentLabels[intent.type] || intent.type,
          secondaryTypes: dedupedSecondary,
          secondaryLabels: dedupedSecondary.map(t => intentLabels[t] || t),
        });
      } else {
        setPreviewIntent(null);
      }
    } else {
      setPreviewIntent(null);
    }
  }, [loadDirectoryFiles, processCodingMessage, activeTab.projectPath]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 144) + 'px';
    }
  }, [input]);

  // Handle Screen Sharing logic
  useEffect(() => {
    if (streamState.isConnected && isScreenSharing) {
        navigator.mediaDevices.getDisplayMedia({ video: true }).then(stream => {
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                startVideoStreaming();
            }
            stream.getVideoTracks()[0].onended = () => {
                setIsScreenSharing(false);
                stopVideoStreaming();
            };
        }).catch(err => {
            console.error("Failed to get display media", err);
            setIsScreenSharing(false);
        });
    } else {
        stopVideoStreaming();
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
    }
  }, [isScreenSharing, streamState.isConnected, startVideoStreaming, stopVideoStreaming]);

  // Track cleanup functions for webview event handlers per tab
  const webviewCleanups = useRef<Map<string, () => void>>(new Map());
  // Store stable ref callbacks per tab to prevent re-creation on every render
  const webviewRefCallbacks = useRef<Map<string, (element: HTMLElement | null) => void>>(new Map());

  // Setup webview event handlers for a specific tab
  const setupWebviewHandlers = useCallback((tabId: string, webview: WebviewElement) => {
    console.log(`[Tab ${tabId}] Setting up webview event handlers`);

    const handleDidNavigate = () => {
      const url = webview.getURL();
      console.log(`[Tab ${tabId}] Did navigate:`, url);
      // Update this tab's state
      updateTab(tabId, {
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward(),
      });
      // Update URL input only if this is the active tab
      if (tabId === activeTabId) {
        setUrlInput(url);
      }
    };

    const handleDidStartLoading = () => {
      console.log(`[Tab ${tabId}] Started loading`);
      updateTab(tabId, { isLoading: true });
    };

    const handleDidStopLoading = () => {
      console.log(`[Tab ${tabId}] Stopped loading`);
      updateTab(tabId, { isLoading: false });
    };

    const handleDidFinishLoad = () => {
      const loadedUrl = webview.getURL();
      console.log(`[Tab ${tabId}] Page finished loading, URL:`, loadedUrl);
      webview.send('set-inspector-mode', isInspectorActiveRef.current);
      webview.send('set-screenshot-mode', isScreenshotActiveRef.current);
      updateTab(tabId, { isWebviewReady: true });
    };

    const handleDidFailLoad = (e: { errorCode: number; errorDescription: string; validatedURL: string }) => {
      console.error(`[Tab ${tabId}] Failed to load:`, e.errorCode, e.errorDescription, e.validatedURL);
    };

    const handlePageTitleUpdated = (e: { title: string }) => {
      updateTab(tabId, { title: e.title });
    };

    const handleIpcMessage = (event: { channel: string; args: unknown[] }) => {
      const { channel, args } = event;

      if (channel === 'inspector-hover') {
        const data = args[0] as { element: SelectedElement; rect: { top: number; left: number; width: number; height: number } };
        setHoveredElement({ element: data.element, rect: data.rect });
      } else if (channel === 'inspector-hover-end') {
        setHoveredElement(null);
      } else if (channel === 'inspector-select') {
        const data = args[0] as { element: SelectedElement; x: number; y: number; rect: unknown };
        setSelectedElement({
          ...data.element,
          x: data.x,
          y: data.y,
          rect: data.rect as SelectedElement['rect']
        });
        setHoveredElement(null); // Clear hover on selection
      } else if (channel === 'screenshot-select') {
        const data = args[0] as { element: SelectedElement; rect: { top: number; left: number; width: number; height: number } };
        setScreenshotElement(data.element);
        setIsScreenshotActive(false);

        if (webview && data.rect) {
          // Hide move handles before screenshot
          webview.send('hide-move-handles');

          // Small delay to let UI update, then capture
          setTimeout(() => {
            webview.capturePage({
              x: Math.floor(data.rect.left),
              y: Math.floor(data.rect.top),
              width: Math.ceil(data.rect.width),
              height: Math.ceil(data.rect.height)
            }).then((image: Electron.NativeImage) => {
              setCapturedScreenshot(image.toDataURL());
              // Restore move handles after screenshot
              webview.send('show-move-handles');
            }).catch((err: Error) => {
              console.error('Failed to capture screenshot:', err);
              // Restore handles even on error
              webview.send('show-move-handles');
            });
          }, 50);
        }
      } else if (channel === 'console-log') {
        const data = args[0] as { level: string; message: string };
        const logType = (data.level.toLowerCase() === 'warning' ? 'warn' : data.level.toLowerCase()) as 'log' | 'warn' | 'error' | 'info';
        setConsoleLogs(prev => [...prev.slice(-99), {
          type: logType,
          message: data.message,
          timestamp: new Date()
        }]);
      } else if (channel === 'ai-selection-confirmed') {
        const data = args[0] as {
          selector: string;
          count: number;
          elements: Array<{ element: SelectedElement; rect: unknown }>;
        };
        console.log('[AI] Element selection confirmed:', data);
        setAiSelectedElement(prev => ({
          selector: data.selector,
          reasoning: prev?.reasoning || '',
          count: data.count,
          elements: data.elements.map(item => ({
            ...item.element,
            rect: item.rect as SelectedElement['rect']
          }))
        }));
      } else if (channel === 'ai-selection-failed') {
        const data = args[0] as { selector: string; error: string };
        console.error('[AI] Element selection failed:', data);
        setAiSelectedElement(null);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `Could not find element: ${data.selector}. ${data.error}`,
          timestamp: new Date()
        }]);
      } else if (channel === 'move-select') {
        // Move mode - element selected, floating overlay created
        const data = args[0] as {
          element: SelectedElement;
          rect: { top: number; left: number; width: number; height: number };
        };
        console.log('[Move] Element selected for repositioning:', data.element.tagName);
        setSelectedElement({
          ...data.element,
          rect: data.rect
        });
        setMoveTargetPosition({
          x: data.rect.left,
          y: data.rect.top,
          width: data.rect.width,
          height: data.rect.height
        });
        setHoveredElement(null);
      } else if (channel === 'move-update') {
        // Move mode - element position/size updated
        const data = args[0] as {
          element: SelectedElement;
          originalRect: { top: number; left: number; width: number; height: number };
          targetRect: { x: number; y: number; width: number; height: number };
        };
        console.log('[Move] Position updated:', data.targetRect);
        setMoveTargetPosition(data.targetRect);
      } else if (channel === 'move-confirmed') {
        // Move mode - user confirmed the new position
        const data = args[0] as {
          element: SelectedElement;
          originalRect: { top: number; left: number; width: number; height: number };
          targetRect: { x: number; y: number; width: number; height: number };
        };
        console.log('[Move] Position confirmed:', data.targetRect);
        // Update selected element with target position info
        setSelectedElement(prev => prev ? {
          ...prev,
          targetPosition: data.targetRect,
          originalPosition: data.originalRect
        } : null);
        setIsMoveActive(false);
        setMoveTargetPosition(null);
      } else if (channel === 'move-cancelled') {
        // Move mode - user cancelled
        console.log('[Move] Cancelled');
        setSelectedElement(null);
        setIsMoveActive(false);
        setMoveTargetPosition(null);
      } else if (channel === 'drop-image-on-element') {
        // Handle image dropped on selected element - SMART insertion
        const data = args[0] as { imageData: string; element: SelectedElement; rect: unknown };
        // Use selectedElementRef for sourceLocation since the drop event doesn't include it
        const currentSelectedElement = selectedElementRef.current;
        const elementWithSource = {
          ...data.element,
          sourceLocation: currentSelectedElement?.sourceLocation
        };
        const tagName = data.element.tagName?.toLowerCase() || '';
        console.log('[Drop] Image dropped on element:', tagName, 'classes:', data.element.className, 'hasSource:', !!elementWithSource.sourceLocation);

        // Get project path from the current tab (use ref for current state)
        const currentTab = tabsRef.current.find(t => t.id === tabId);
        const projectPath = currentTab?.projectPath;
        if (!projectPath) {
          console.error('[Drop] No project path set for tab:', tabId, 'tab:', currentTab);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: 'Cannot save dropped image: no project folder selected. Please set a project folder first.',
            timestamp: new Date()
          }]);
          return;
        }

        // Generate content-hash based filename to prevent duplicates
        // Use first 8 chars of a simple hash of the base64 data
        const hashCode = (str: string) => {
          let hash = 0;
          for (let i = 0; i < Math.min(str.length, 10000); i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return Math.abs(hash).toString(16).padStart(8, '0');
        };
        const contentHash = hashCode(data.imageData);
        const mimeMatch = data.imageData.match(/^data:image\/(\w+);/);
        const ext = mimeMatch ? mimeMatch[1].replace('jpeg', 'jpg') : 'png';
        const filename = `img-${contentHash}.${ext}`;
        const publicPath = `${projectPath}/public/uploads`;
        const fullPath = `${publicPath}/${filename}`;
        const relativePath = `/uploads/${filename}`;

        // Determine insertion strategy based on element type
        const isImgElement = tagName === 'img';
        const isContainerElement = ['div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'figure', 'span', 'p'].includes(tagName);

        // Save image first
        window.electronAPI?.files.saveImage(data.imageData, fullPath)
          .then(async (saveResult) => {
            if (!saveResult?.success) throw new Error(saveResult?.error || 'Failed to save');
            console.log('[Drop] Image saved:', relativePath);

            let applyCode: string;
            let undoCode: string;
            let description: string;
            let insertionMethod: 'src' | 'background' | 'child-img' | 'replace-content';

            if (isImgElement) {
              // Strategy 1: Direct img src replacement
              insertionMethod = 'src';
              const captureOriginal = await webview.executeJavaScript(`
                (function() {
                  const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  return el ? el.src : '';
                })();
              `);

              applyCode = `
                (function() {
                  const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (el && el.tagName === 'IMG') {
                    el.src = '${relativePath}';
                    return 'Applied src';
                  }
                  return 'Element not found';
                })();
              `;
              undoCode = `
                (function() {
                  const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (el && el.tagName === 'IMG') {
                    el.src = '${captureOriginal}';
                    return 'Reverted';
                  }
                  return 'Element not found';
                })();
              `;
              description = `Set image src to ${filename}`;

              // Trigger source patch for img src change
              if (elementWithSource.sourceLocation?.sources?.[0]) {
                const approvalId = `dom-drop-${Date.now()}`;
                const approvalPayload: PendingDOMApproval = {
                  id: approvalId,
                  element: elementWithSource,
                  cssChanges: {},
                  srcChange: { oldSrc: captureOriginal || '', newSrc: relativePath },
                  description,
                  undoCode,
                  applyCode,
                  userRequest: 'Drop image on element',
                  patchStatus: 'preparing',
                };
                setPendingDOMApproval(approvalPayload);
                prepareDomPatch(
                  approvalId,
                  elementWithSource,
                  {},
                  description,
                  undoCode,
                  applyCode,
                  'Drop image on element',
                  projectPath,
                  undefined,
                  { oldSrc: captureOriginal || '', newSrc: relativePath }
                );
              }

            } else if (isContainerElement) {
              // Strategy 2: Check for child img, or use background-image
              const childImgInfo = await webview.executeJavaScript(`
                (function() {
                  const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (!el) return null;
                  const img = el.querySelector('img');
                  if (img) {
                    return { hasChildImg: true, childSrc: img.src };
                  }
                  return { hasChildImg: false, currentBg: el.style.backgroundImage };
                })();
              `);

              if (childImgInfo?.hasChildImg) {
                // Strategy 2a: Update child img src
                insertionMethod = 'child-img';
                applyCode = `
                  (function() {
                    const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el) {
                      const img = el.querySelector('img');
                      if (img) {
                        img.src = '${relativePath}';
                        return 'Applied to child img';
                      }
                    }
                    return 'Element not found';
                  })();
                `;
                undoCode = `
                  (function() {
                    const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el) {
                      const img = el.querySelector('img');
                      if (img) {
                        img.src = '${childImgInfo.childSrc}';
                        return 'Reverted';
                      }
                    }
                    return 'Element not found';
                  })();
                `;
                description = `Set child image src to ${filename}`;

                // Trigger source patch for child img src change
                if (elementWithSource.sourceLocation?.sources?.[0]) {
                  const approvalId = `dom-drop-${Date.now()}`;
                  const approvalPayload: PendingDOMApproval = {
                    id: approvalId,
                    element: elementWithSource,
                    cssChanges: {},
                    srcChange: { oldSrc: childImgInfo.childSrc || '', newSrc: relativePath },
                    description,
                    undoCode,
                    applyCode,
                    userRequest: 'Drop image on child img element',
                    patchStatus: 'preparing',
                  };
                  setPendingDOMApproval(approvalPayload);
                  prepareDomPatch(
                    approvalId,
                    elementWithSource,
                    {},
                    description,
                    undoCode,
                    applyCode,
                    'Drop image on child img element',
                    projectPath,
                    undefined,
                    { oldSrc: childImgInfo.childSrc || '', newSrc: relativePath }
                  );
                }
              } else {
                // Strategy 2b: Use background-image and clear text content
                insertionMethod = 'background';
                const captureContent = await webview.executeJavaScript(`
                  (function() {
                    const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    return el ? { text: el.textContent, bg: el.style.backgroundImage, bgSize: el.style.backgroundSize, bgPos: el.style.backgroundPosition } : null;
                  })();
                `);

                applyCode = `
                  (function() {
                    const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el) {
                      el.style.backgroundImage = 'url(${relativePath})';
                      el.style.backgroundSize = 'cover';
                      el.style.backgroundPosition = 'center';
                      el.textContent = '';
                      return 'Applied background-image';
                    }
                    return 'Element not found';
                  })();
                `;
                undoCode = `
                  (function() {
                    const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el) {
                      el.style.backgroundImage = '${captureContent?.bg || ''}';
                      el.style.backgroundSize = '${captureContent?.bgSize || ''}';
                      el.style.backgroundPosition = '${captureContent?.bgPos || ''}';
                      el.textContent = '${(captureContent?.text || '').replace(/'/g, "\\'")}';
                      return 'Reverted';
                    }
                    return 'Element not found';
                  })();
                `;
                description = `Set background-image to ${filename}`;

                // Trigger source patch with CSS changes
                if (elementWithSource.sourceLocation?.sources?.[0]) {
                  const approvalId = `dom-drop-${Date.now()}`;
                  const approvalPayload: PendingDOMApproval = {
                    id: approvalId,
                    element: elementWithSource,
                    cssChanges: {
                      backgroundImage: `url(${relativePath})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    },
                    description,
                    undoCode,
                    applyCode,
                    userRequest: 'Drop image on container element',
                    patchStatus: 'preparing',
                  };
                  setPendingDOMApproval(approvalPayload);
                  prepareDomPatch(
                    approvalId,
                    elementWithSource,
                    {
                      backgroundImage: `url(${relativePath})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    },
                    description,
                    undoCode,
                    applyCode,
                    'Drop image on container element',
                    projectPath
                  );
                }
              }
            } else {
              // Fallback: Try setting src anyway (for video, iframe, etc.)
              insertionMethod = 'src';

              // Capture original src for undo
              const captureOriginal = await webview.executeJavaScript(`
                (function() {
                  const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  return el ? el.src : '';
                })();
              `);

              applyCode = `
                (function() {
                  const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (el) {
                    el.src = '${relativePath}';
                    return 'Applied src';
                  }
                  return 'Element not found';
                })();
              `;
              undoCode = `
                (function() {
                  const el = document.evaluate('${data.element.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (el) {
                    el.src = '${captureOriginal}';
                    return 'Reverted';
                  }
                  return 'Element not found';
                })();
              `;
              description = `Set ${tagName} src to ${filename}`;

              // Trigger source patch for src change
              if (elementWithSource.sourceLocation?.sources?.[0]) {
                const approvalId = `dom-drop-${Date.now()}`;
                const approvalPayload: PendingDOMApproval = {
                  id: approvalId,
                  element: elementWithSource,
                  cssChanges: {},
                  srcChange: { oldSrc: captureOriginal || '', newSrc: relativePath },
                  description,
                  undoCode,
                  applyCode,
                  userRequest: `Drop image on ${tagName} element`,
                  patchStatus: 'preparing',
                };
                setPendingDOMApproval(approvalPayload);
                prepareDomPatch(
                  approvalId,
                  elementWithSource,
                  {},
                  description,
                  undoCode,
                  applyCode,
                  `Drop image on ${tagName} element`,
                  projectPath,
                  undefined,
                  { oldSrc: captureOriginal || '', newSrc: relativePath }
                );
              }
            }

            // Execute the DOM change
            await webview.executeJavaScript(applyCode);
            console.log('[Drop] Applied image with method:', insertionMethod);

            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: description,
              timestamp: new Date(),
              model: 'system',
              intent: 'ui_modify'
            }]);

            setPendingChange({
              code: applyCode,
              undoCode,
              description,
              additions: 1,
              deletions: 1,
              source: 'dom',
            });
          })
          .catch(err => {
            console.error('[Drop] Failed to save/apply image:', err);
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'system',
              content: `Failed to apply image: ${err.message}`,
              timestamp: new Date()
            }]);
          });
      } else if (channel === 'drop-url-on-element') {
        // Handle URL dropped on element
        const data = args[0] as { url: string; element: SelectedElement; rect: unknown };
        console.log('[Drop] URL dropped on element:', data.element.tagName, data.url);

        // Apply URL based on element type
        const tagName = data.element.tagName?.toLowerCase();
        let attrToSet = 'src';
        if (tagName === 'a') attrToSet = 'href';
        else if (tagName === 'img' || tagName === 'video' || tagName === 'audio') attrToSet = 'src';
        else if (tagName === 'iframe') attrToSet = 'src';

        const applyCode = `
          (function() {
            const elements = document.querySelectorAll('${data.element.tagName}');
            for (const el of elements) {
              if (el.className === '${data.element.className}') {
                el.${attrToSet} = '${data.url}';
                return 'Applied';
              }
            }
            return 'Element not found';
          })();
        `;

        webview.executeJavaScript(applyCode);

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Set ${attrToSet} to dropped URL on ${data.element.tagName}`,
          timestamp: new Date(),
          model: 'system',
          intent: 'ui_modify'
        }]);
      } else if (channel === 'inline-edit-accept') {
        // Handle inline text edit acceptance
        const data = args[0] as { oldText: string; newText: string; element: SelectedElement };
        console.log('[Inline Edit] Accepted:', {
          old: data.oldText?.substring(0, 30),
          new: data.newText?.substring(0, 30),
          hasSourceLocation: !!data.element?.sourceLocation,
          sourceFile: data.element?.sourceLocation?.sources?.[0]?.file
        });

        // Use element from message (now includes source location from when editing started)
        // Fall back to ref if message doesn't have source location (backwards compat)
        const elementWithSource = data.element?.sourceLocation?.sources?.[0]
          ? data.element
          : selectedElementRef.current;
        const currentTab = tabsRef.current.find(t => t.id === tabId);
        const projectPath = currentTab?.projectPath;

        // Trigger source patch with the text change
        if (elementWithSource?.sourceLocation?.sources?.[0] && projectPath) {
          const textChangePayload = { oldText: data.oldText, newText: data.newText };

          const approvalId = `inline-${Date.now()}`;
          setPendingDOMApproval({
            id: approvalId,
            element: elementWithSource,
            cssChanges: {},
            textChange: data.newText,
            description: `Change text: "${data.oldText?.substring(0, 20)}..." → "${data.newText?.substring(0, 20)}..."`,
            undoCode: `document.querySelector('*').textContent = ${JSON.stringify(data.oldText)}`,
            applyCode: `document.querySelector('*').textContent = ${JSON.stringify(data.newText)}`,
            userRequest: 'Inline text edit',
            patchStatus: 'preparing',
            userApproved: true, // Auto-approve: user already clicked tick to accept
          });

          prepareDomPatch(
            approvalId,
            elementWithSource,
            {},
            `Change text to "${data.newText?.substring(0, 30)}..."`,
            '',
            '',
            'Inline text edit',
            projectPath,
            textChangePayload
          );
        } else {
          console.log('[Inline Edit] Cannot create source patch - missing source location or project path', {
            hasSourceLocation: !!elementWithSource?.sourceLocation?.sources?.[0],
            projectPath,
            element: elementWithSource?.tagName
          });
        }

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Text changed: "${data.oldText?.substring(0, 30)}..." → "${data.newText?.substring(0, 30)}..."`,
          timestamp: new Date(),
          model: 'system',
          intent: 'ui_modify'
        }]);
      }
    };

    const handleDomReady = () => {
      console.log(`[Tab ${tabId}] Webview DOM ready`);
      updateTab(tabId, { isWebviewReady: true });
      webview.send('set-inspector-mode', isInspectorActiveRef.current);
      webview.send('set-screenshot-mode', isScreenshotActiveRef.current);
    };

    const handleConsoleMessage = (e: { level: number; message: string; line: number; sourceId: string }) => {
      const levelMap: Record<number, 'log' | 'warn' | 'error' | 'info'> = {
        0: 'log',
        1: 'info',
        2: 'warn',
        3: 'error'
      };
      const logType = levelMap[e.level] || 'log';
      setConsoleLogs(prev => [...prev.slice(-99), {
        type: logType,
        message: e.message,
        timestamp: new Date()
      }]);
    };

    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('console-message', handleConsoleMessage as (e: unknown) => void);
    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('did-navigate-in-page', handleDidNavigate);
    webview.addEventListener('did-start-loading', handleDidStartLoading);
    webview.addEventListener('did-stop-loading', handleDidStopLoading);
    webview.addEventListener('did-finish-load', handleDidFinishLoad);
    webview.addEventListener('did-fail-load', handleDidFailLoad as (e: unknown) => void);
    webview.addEventListener('page-title-updated', handlePageTitleUpdated as (e: unknown) => void);
    webview.addEventListener('ipc-message', handleIpcMessage as (e: unknown) => void);

    // Check if webview is already ready
    try {
      const currentWebviewUrl = webview.getURL();
      if (currentWebviewUrl) {
        updateTab(tabId, { isWebviewReady: true });
        webview.send('set-inspector-mode', isInspectorActiveRef.current);
        webview.send('set-screenshot-mode', isScreenshotActiveRef.current);
      }
    } catch (e) {
      console.log(`[Tab ${tabId}] Webview not yet ready for getURL`);
    }

    // Return cleanup function
    return () => {
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('console-message', handleConsoleMessage as (e: unknown) => void);
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('did-navigate-in-page', handleDidNavigate);
      webview.removeEventListener('did-start-loading', handleDidStartLoading);
      webview.removeEventListener('did-stop-loading', handleDidStopLoading);
      webview.removeEventListener('did-finish-load', handleDidFinishLoad);
      webview.removeEventListener('did-fail-load', handleDidFailLoad as (e: unknown) => void);
      webview.removeEventListener('page-title-updated', handlePageTitleUpdated as (e: unknown) => void);
      webview.removeEventListener('ipc-message', handleIpcMessage as (e: unknown) => void);
    };
  }, [updateTab]);

  // Ref callback for webview elements - sets up handlers when mounted
  // Returns a STABLE callback for each tabId to prevent constant re-setup
  const getWebviewRefCallback = useCallback((tabId: string) => {
    // Return existing callback if we have one
    let callback = webviewRefCallbacks.current.get(tabId);
    if (callback) return callback;

    // Create new stable callback for this tab
    callback = (element: HTMLElement | null) => {
      if (element) {
        const webview = element as unknown as WebviewElement;
        webviewRefs.current.set(tabId, webview);

        // Small delay to ensure webview is fully mounted
        setTimeout(() => {
          // Clean up previous handlers if any
          const prevCleanup = webviewCleanups.current.get(tabId);
          if (prevCleanup) prevCleanup();

          // Set up new handlers
          const cleanup = setupWebviewHandlers(tabId, webview);
          webviewCleanups.current.set(tabId, cleanup);
        }, 100);
      } else {
        // Element unmounted - clean up
        const cleanup = webviewCleanups.current.get(tabId);
        if (cleanup) cleanup();
        webviewCleanups.current.delete(tabId);
        webviewRefs.current.delete(tabId);
      }
    };
    webviewRefCallbacks.current.set(tabId, callback);
    return callback;
  }, [setupWebviewHandlers]);

  // Auto-scroll console panel to bottom when new logs arrive
  useEffect(() => {
    if (consoleEndRef.current && isConsolePanelOpen) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs, isConsolePanelOpen]);

  // Handle console log row click with shift-click range selection
  const handleLogRowClick = useCallback((index: number, event: React.MouseEvent) => {
    setSelectedLogIndices(prev => {
      const newSet = new Set(prev);

      if (event.shiftKey && lastClickedLogIndex.current !== null) {
        // Shift-click: select range from last clicked to current
        const start = Math.min(lastClickedLogIndex.current, index);
        const end = Math.max(lastClickedLogIndex.current, index);
        for (let i = start; i <= end; i++) {
          newSet.add(i);
        }
      } else {
        // Regular click: toggle single item
        if (newSet.has(index)) {
          newSet.delete(index);
        } else {
          newSet.add(index);
        }
        lastClickedLogIndex.current = index;
      }

      return newSet;
    });
  }, []);

  // Get selected logs content for chat chip
  const selectedLogs = useMemo(() => {
    if (selectedLogIndices.size === 0) return null;
    return Array.from(selectedLogIndices)
      .sort((a, b) => a - b)
      .map(i => consoleLogs[i])
      .filter(Boolean);
  }, [selectedLogIndices, consoleLogs]);

  // Sync coding agent context when selections change
  // Remove updateCodingContext from dependencies to prevent infinite loops
  useEffect(() => {
    updateCodingContext({
      selectedElement: selectedElement || null,
      selectedFiles: selectedFiles,
      selectedLogs: selectedLogs?.map(log => ({
        type: log.type,
        message: log.message,
      })) || [],
      projectPath: activeTab?.projectPath || null,
      recentMessages: messages.slice(-10) as any[],
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElement, selectedFiles, selectedLogs, activeTab?.projectPath, messages]);

  // Clear selected logs when console is cleared
  const handleClearConsole = useCallback(() => {
    setConsoleLogs([]);
    setSelectedLogIndices(new Set());
    lastClickedLogIndex.current = null;
  }, []);

  // Toggle console filter
  const toggleConsoleFilter = useCallback((type: 'log' | 'warn' | 'error' | 'info') => {
    setConsoleFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Clear all console filters (show all)
  const clearConsoleFilters = useCallback(() => {
    setConsoleFilters(new Set());
  }, []);

  // Instant web search for console errors
  const performInstantSearch = useCallback(async (query: string) => {
    if (!query.trim() || !window.electronAPI?.aiSdk?.webSearch) {
      console.warn('[Search] No query or webSearch not available');
      return;
    }

    setIsFileSearching(true);
    setSearchQuery(query);
    setShowSearchPopover(true);
    setSearchResults(null);

    try {
      // Format query for error searching
      const searchQuery = `${query.slice(0, 500)} solution fix`;
      console.log('[Search] Searching for:', searchQuery);

      const result = await window.electronAPI.aiSdk.webSearch(searchQuery, 5);

      if (result.success && result.results) {
        setSearchResults(result.results);
        console.log('[Search] Found', result.results.length, 'results');
      } else {
        console.error('[Search] Failed:', result.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('[Search] Error:', error);
      setSearchResults([]);
    } finally {
      setIsFileSearching(false);
    }
  }, []);

  // Attach search results to chat (creates chip)
  const attachSearchResults = useCallback(() => {
    if (searchResults && searchResults.length > 0) {
      setAttachedSearchResults(searchResults);
      setShowSearchPopover(false);
    }
  }, [searchResults]);

  // Keyboard shortcuts for console log actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if console is open and logs are selected
      if (!isConsolePanelOpen || selectedLogIndices.size === 0) return;
      
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      
      if (e.key === 'Escape') {
        // Clear selection
        setSelectedLogIndices(new Set());
        e.preventDefault();
      } else if (modKey && e.key === 'g') {
        // Instant web search for selected logs
        const logsText = Array.from(selectedLogIndices)
          .sort((a, b) => a - b)
          .map(i => consoleLogs[i]?.message || '')
          .join('\n');
        performInstantSearch(logsText);
        e.preventDefault();
      } else if (modKey && e.key === 'c' && selectedLogIndices.size > 0) {
        // Copy (only if in console context, don't override normal copy)
        const activeElement = document.activeElement;
        const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
        if (!isInputFocused) {
          const logsText = Array.from(selectedLogIndices)
            .sort((a, b) => a - b)
            .map(i => {
              const log = consoleLogs[i];
              return log ? `[${log.type}] ${log.message}` : '';
            })
            .filter(Boolean)
            .join('\n');
          navigator.clipboard.writeText(logsText);
          e.preventDefault();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConsolePanelOpen, selectedLogIndices, consoleLogs, setInput]);

  // Filtered console logs
  const filteredConsoleLogs = useMemo(() => {
    if (consoleFilters.size === 0) return consoleLogs;
    return consoleLogs.filter(log => consoleFilters.has(log.type));
  }, [consoleLogs, consoleFilters]);

  // Click-outside handler for thinking popover
  useEffect(() => {
    if (!showThinkingPopover) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-thinking-popover]')) {
        setShowThinkingPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showThinkingPopover]);

  // Edited files management
  const addEditedFile = useCallback((file: {
    path: string;
    additions?: number;
    deletions?: number;
    undoCode?: string;
    originalContent?: string;
    isFileModification?: boolean;
  }) => {
    // Extract filename without query strings (e.g., "?t=123456")
    const rawFileName = file.path.split('/').pop() || file.path;
    const fileName = rawFileName.split('?')[0];
    setEditedFiles(prev => {
      // Check if file already exists, update it
      const existing = prev.findIndex(f => f.path === file.path);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = {
          ...updated[existing],
          additions: updated[existing].additions + (file.additions || 0),
          deletions: updated[existing].deletions + (file.deletions || 0),
          undoCode: file.undoCode || updated[existing].undoCode,
          // Keep original content from first modification for undo
          originalContent: updated[existing].originalContent || file.originalContent,
          isFileModification: file.isFileModification || updated[existing].isFileModification,
          timestamp: new Date()
        };
        return updated;
      }
      return [...prev, {
        path: file.path,
        fileName,
        additions: file.additions || 0,
        deletions: file.deletions || 0,
        undoCode: file.undoCode,
        originalContent: file.originalContent,
        isFileModification: file.isFileModification,
        timestamp: new Date()
      }];
    });
  }, []);

  const undoFileEdit = useCallback(async (path: string) => {
    const file = editedFiles.find(f => f.path === path);
    if (!file) return;

    // Handle file-based undo (restore original content)
    if (file.isFileModification && file.originalContent !== undefined) {
      console.log('[Undo] Restoring file:', path);
      const { api: electronAPI } = getElectronAPI();
      if (electronAPI?.files?.writeFile) {
        const result = await electronAPI.files.writeFile(path, file.originalContent);
        if (result.success) {
          console.log('[Undo] File restored successfully');
          setEditedFiles(prev => prev.filter(f => f.path !== path));
        } else {
          console.error('[Undo] Failed to restore file:', result.error);
        }
      }
      return;
    }

    // Handle DOM-based undo (execute JavaScript in webview)
    if (file.undoCode) {
      const webview = webviewRefs.current.get(activeTabId);
      if (webview) {
        webview.executeJavaScript(file.undoCode)
          .then(() => {
            setEditedFiles(prev => prev.filter(f => f.path !== path));
          })
          .catch((err: Error) => console.error('[Undo] Error:', err));
      }
    } else if (file.isFileModification) {
      // File was modified but we don't have originalContent - use git to restore
      console.log('[Undo] Using git checkoutFile to restore:', path);
      const { api: electronAPI } = getElectronAPI();
      if (electronAPI?.git?.checkoutFile) {
        try {
          const result = await electronAPI.git.checkoutFile(path);
          if (result.success) {
            console.log('[Undo] File restored via git checkoutFile');
            setEditedFiles(prev => prev.filter(f => f.path !== path));
          } else {
            console.error('[Undo] Git checkoutFile failed:', result.error);
            // Still remove from list - user will need to manually revert
            setEditedFiles(prev => prev.filter(f => f.path !== path));
          }
        } catch (err) {
          console.error('[Undo] Git checkoutFile error:', err);
          setEditedFiles(prev => prev.filter(f => f.path !== path));
        }
      } else {
        console.warn('[Undo] Git checkoutFile not available, cannot restore file');
        setEditedFiles(prev => prev.filter(f => f.path !== path));
      }
    } else {
      // No undo mechanism, just remove from list
      setEditedFiles(prev => prev.filter(f => f.path !== path));
    }
  }, [editedFiles, activeTabId]);

  const undoAllEdits = useCallback(async () => {
    const webview = webviewRefs.current.get(activeTabId);
    const { api: electronAPI } = getElectronAPI();

    // Undo in reverse order
    const filesToUndo = [...editedFiles].reverse();

    for (const file of filesToUndo) {
      // Handle file-based undo with original content
      if (file.isFileModification && file.originalContent !== undefined) {
        if (electronAPI?.files?.writeFile) {
          await electronAPI.files.writeFile(file.path, file.originalContent).catch(() => {});
        }
      } else if (file.isFileModification) {
        // No original content - use git to restore
        if (electronAPI?.git?.checkoutFile) {
          await electronAPI.git.checkoutFile(file.path).catch(() => {});
        }
      } else if (file.undoCode && webview) {
        // Handle DOM-based undo
        await webview.executeJavaScript(file.undoCode).catch(() => {});
      }
    }

    setEditedFiles([]);
    setIsEditedFilesDrawerOpen(false);
  }, [editedFiles, activeTabId]);

  const keepAllEdits = useCallback(() => {
    setEditedFiles([]);
    setIsEditedFilesDrawerOpen(false);
  }, []);

  // Wire up file modification handler for coding agent tools
  // This allows write_file, create_file, delete_file to update the edited files drawer
  useEffect(() => {
    fileModificationHandlerRef.current = (event: FileModificationEvent) => {
      console.log('[File Modified] Event:', event.type, event.path);

      // Calculate additions/deletions based on change type
      let additions = 0;
      let deletions = 0;

      if (event.type === 'write' && event.originalContent && event.newContent) {
        const oldLines = event.originalContent.split('\n').length;
        const newLines = event.newContent.split('\n').length;
        additions = Math.max(0, newLines - oldLines);
        deletions = Math.max(0, oldLines - newLines);
        // If same number of lines, assume modifications
        if (additions === 0 && deletions === 0) {
          additions = 1;
          deletions = 1;
        }
      } else if (event.type === 'create' && event.newContent) {
        additions = event.newContent.split('\n').length;
      } else if (event.type === 'delete' && event.originalContent) {
        deletions = event.originalContent.split('\n').length;
      }

      // Add to edited files drawer with undo capability
      addEditedFile({
        path: event.path,
        additions,
        deletions,
        originalContent: event.originalContent,
        isFileModification: true,
      });
    };
  }, [addEditedFile]);

  // Listen for Agent SDK file modifications (from main process tools)
  // These come from write_file, create_file, delete_file in ai-sdk-wrapper
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.agentSdk?.onFileModified) return;

    const removeListener = window.electronAPI.agentSdk.onFileModified((event: {
      type: 'write' | 'create' | 'delete';
      path: string;
      originalContent?: string;
      newContent?: string;
    }) => {
      console.log('[Agent SDK File Modified]', event.type, event.path);

      // Calculate additions/deletions
      let additions = 0;
      let deletions = 0;

      if (event.type === 'write' && event.originalContent && event.newContent) {
        const oldLines = event.originalContent.split('\n').length;
        const newLines = event.newContent.split('\n').length;
        additions = Math.max(0, newLines - oldLines);
        deletions = Math.max(0, oldLines - newLines);
        if (additions === 0 && deletions === 0) {
          additions = 1;
          deletions = 1;
        }
      } else if (event.type === 'create' && event.newContent) {
        additions = event.newContent.split('\n').length;
      } else if (event.type === 'delete' && event.originalContent) {
        deletions = event.originalContent.split('\n').length;
      }

      // Add to edited files drawer
      addEditedFile({
        path: event.path,
        additions,
        deletions,
        originalContent: event.originalContent,
        isFileModification: true,
      });
    });

    return removeListener;
  }, [isElectron, addEditedFile]);

  // Track which projects have active watchers (persistent across tab switches)
  const activeWatchersRef = useRef<Set<string>>(new Set())

  // File watcher - global listener (runs once, never cleaned up)
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.fileWatcher) {
      return;
    }

    // Set up global listener for all file changes
    const removeListener = window.electronAPI.fileWatcher.onChange((event: {
      type: 'add' | 'change' | 'unlink';
      path: string;
      relativePath: string;
      projectPath: string;
    }) => {
      console.log('[FileWatcher] File changed:', event.type, event.relativePath);

      // Add to edited files drawer
      addEditedFile({
        path: event.path,
        additions: event.type === 'add' ? 1 : event.type === 'change' ? 1 : 0,
        deletions: event.type === 'unlink' ? 1 : event.type === 'change' ? 1 : 0,
        isFileModification: true,
      });
    });

    // DON'T cleanup - let watchers run until app closes
    // This is intentional to avoid start/stop churn
    return () => {
      console.log('[FileWatcher] App unmounting')
      removeListener();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isElectron])

  // Start watcher for current project if not already watching
  useEffect(() => {
    const projectPath = activeTab.projectPath
    if (!isElectron || !projectPath || !window.electronAPI?.fileWatcher) {
      setFileWatcherActive(false);
      return;
    }

    // Check if we're already watching this project
    if (activeWatchersRef.current.has(projectPath)) {
      console.log('[FileWatcher] Already watching:', projectPath)
      setFileWatcherActive(true);
      return;
    }

    // Start new watcher for this project (never stopped until app exit)
    console.log('[FileWatcher] Starting watcher for:', projectPath)
    window.electronAPI.fileWatcher.start(projectPath).then((result: { success: boolean }) => {
      if (result.success) {
        activeWatchersRef.current.add(projectPath)
        setFileWatcherActive(true);
        console.log('[FileWatcher] ✓ Watching:', projectPath)
      }
    }).catch(err => {
      console.error('[FileWatcher] Start failed:', err)
    });

    // NO CLEANUP - watchers stay active until app closes
  }, [isElectron, activeTab.projectPath]);

  // Load recent context chips from localStorage when project changes
  useEffect(() => {
    try {
      const storageKey = `cluso-context-chips-${activeTab.projectPath || 'global'}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const chips = JSON.parse(stored);
        if (Array.isArray(chips)) {
          setRecentContextChips(chips);
          console.log('[ContextChips] Loaded', chips.length, 'recent chips for', storageKey);
        }
      } else {
        // No chips stored for this project, start fresh
        setRecentContextChips([]);
      }
    } catch (e) {
      console.warn('[ContextChips] Failed to load from localStorage:', e);
      setRecentContextChips([]);
    }
    // Also clear current context chips when switching projects
    setContextChips([]);
  }, [activeTab.projectPath]);

  // Sync Inspector State with Webview
  useEffect(() => {
    // Only sync for browser tabs
    if (activeTab.type !== 'browser') {
      return;
    }

    const webview = webviewRefs.current.get(activeTabId);
    console.log('[Inspector Sync] Effect triggered:', { isElectron, hasWebview: !!webview, isWebviewReady, isInspectorActive, isScreenshotActive });
    if (!isElectron) {
      console.log('[Inspector Sync] Skipping: not in Electron');
      return;
    }
    if (!webview) {
      console.log('[Inspector Sync] Skipping: no webview ref');
      return;
    }
    if (!isWebviewReady) {
      console.log('[Inspector Sync] Skipping: webview not ready');
      return;
    }

    // Extra safety check - ensure webview is attached to DOM
    try {
      // This will throw if webview is not attached
      if (!webview.isConnected) {
        console.log('[Inspector Sync] Skipping: webview not connected to DOM');
        return;
      }
    } catch (e) {
      console.log('[Inspector Sync] Skipping: webview check failed', e);
      return;
    }

    // Check if webview is actually ready to receive messages
    // getWebContentsId() throws if webview isn't fully attached and ready
    try {
      webview.getWebContentsId();
    } catch (e) {
      console.log('[Inspector Sync] Skipping: webview not ready to receive messages');
      return;
    }

    console.log('[Inspector Sync] Sending inspector modes to webview:', { isInspectorActive, isScreenshotActive, isMoveActive });
    try {
      webview.send('set-inspector-mode', isInspectorActive);
      webview.send('set-screenshot-mode', isScreenshotActive);
      webview.send('set-move-mode', isMoveActive);

      if (!isInspectorActive && !isMoveActive) {
        setSelectedElement(null);
        setShowElementChat(false);
        // Clear canvas indicators when modes are deactivated
        webview.send('clear-selection');
      }
    } catch (e) {
      console.warn('[Inspector Sync] Failed to send to webview:', e);
    }
  }, [isInspectorActive, isScreenshotActive, isMoveActive, isElectron, isWebviewReady, activeTabId]);

  // Auto-reload webview on HMR (Hot Module Replacement)
  useEffect(() => {
    const webview = webviewRefs.current.get(activeTabId);
    if (!isElectron || !webview) return;

    // Vite HMR - reload webview when app code changes
    if (import.meta.hot) {
      const handleHmrUpdate = () => {
        console.log('[HMR] Reloading webview...');
        const currentWebview = webviewRefs.current.get(activeTabId);
        if (currentWebview) {
          currentWebview.reload();
        }
      };

      import.meta.hot.on('vite:afterUpdate', handleHmrUpdate);

      return () => {
        import.meta.hot?.off('vite:afterUpdate', handleHmrUpdate);
      };
    }
  }, [isElectron, activeTabId]);

  // Reset element chat when sidebar opens
  useEffect(() => {
    if (isSidebarOpen) {
      setShowElementChat(false);
    }
  }, [isSidebarOpen]);

  // Scroll to bottom of chat (respects auto-scroll setting)
  // Also scrolls during streaming content updates
  const streamingContent = streamingMessage?.content ?? ''
  useEffect(() => {
    if (isAutoScrollEnabled && !isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (!isAutoScrollEnabled && (messages.length > 0 || isStreaming)) {
      // Show scroll-to-bottom button when new messages arrive and auto-scroll is off
      setShowScrollToBottom(true);
    }
  }, [messages, isAutoScrollEnabled, streamingContent, isStreaming]);

  // Handle scroll events to detect manual scrolling
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      // Mark that user is scrolling
      isUserScrollingRef.current = true;
      clearTimeout(scrollTimeout);

      // Check if user is near the bottom (within 100px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

      if (isNearBottom) {
        // User scrolled to bottom, re-enable auto-scroll
        setIsAutoScrollEnabled(true);
        setShowScrollToBottom(false);
      } else {
        // User scrolled up, disable auto-scroll and show button
        setIsAutoScrollEnabled(false);
        setShowScrollToBottom(true);
      }

      // Reset user scrolling flag after scroll stops
      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Scroll to bottom handler (for the button)
  const scrollToBottom = useCallback(() => {
    setIsAutoScrollEnabled(true);
    setShowScrollToBottom(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Handle Image Upload (supports multiple files)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const filesToProcess = Array.from(files).slice(0, 5 - attachedImages.length);

    filesToProcess.forEach(file => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setAttachedImages(prev => {
          if (prev.length >= 5) return prev;
          return [...prev, base64];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle drag and drop for images
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const filesToProcess = imageFiles.slice(0, 5 - attachedImages.length);

    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setAttachedImages(prev => {
          if (prev.length >= 5) return prev;
          return [...prev, base64];
        });
      };
      reader.readAsDataURL(file);
    });
  }, [attachedImages.length]);

  const removeAttachedImage = useCallback((index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Built-in slash command definitions
  const BUILT_IN_COMMANDS = [
    { name: 'new', aliases: ['clear'], description: 'Clear the conversation' },
    { name: 'compact', description: 'Compact context with optional guidance' },
    { name: 'thinking', description: 'Set reasoning level: off, low, med, high, ultrathink' },
  ];

  // Handle built-in slash commands
  const handleBuiltInCommand = useCallback((commandText: string): boolean => {
    const trimmed = commandText.trim();
    if (!trimmed.startsWith('/')) return false;

    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    // /new or /clear - Clear the conversation
    if (command === 'new' || command === 'clear') {
      setMessages([]);
      setInput('');
      // Add system message
      setMessages([{
        id: Date.now().toString(),
        role: 'system',
        content: '🗑️ Conversation cleared.',
        timestamp: new Date(),
      }]);
      // Clear after a short delay
      setTimeout(() => setMessages([]), 1500);
      return true;
    }

    // /compact [prompt] - Compact the context
    if (command === 'compact') {
      const guidance = args || 'Summarize the key points and decisions from this conversation';
      // Create a summary request
      const summaryPrompt = `Please provide a concise summary of our conversation so far. Focus on:
1. Key topics discussed
2. Decisions made
3. Important code changes or files mentioned
4. Outstanding tasks or questions

${args ? `Additional guidance: ${guidance}` : ''}

Keep the summary brief but comprehensive enough to continue the conversation effectively.`;

      // Add system message showing compact in progress
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `📦 Compacting context${args ? ` with guidance: "${args}"` : ''}...`,
        timestamp: new Date(),
      }]);

      // Process the summary request (don't add to messages, let it flow through normally)
      setTimeout(() => {
        setInput(summaryPrompt);
        // Trigger send
        const form = document.querySelector('form[data-chat-form]') as HTMLFormElement;
        if (form) form.requestSubmit();
      }, 100);
      return true;
    }

    // /thinking [level] - Set reasoning mode
    if (command === 'thinking') {
      const level = args.toLowerCase() as ThinkingLevel;
      const validLevels: ThinkingLevel[] = ['off', 'low', 'med', 'high', 'ultrathink'];

      // Handle 'on' as alias for 'med'
      let actualLevel: ThinkingLevel = 'med';
      if (level === 'on' || level === '') {
        // Toggle: if currently off, turn on (med); if on, turn off
        actualLevel = thinkingLevel === 'off' ? 'med' : 'off';
      } else if (validLevels.includes(level)) {
        actualLevel = level;
      } else {
        // Invalid level
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `❌ Invalid thinking level: "${args}". Valid options: off, low, med, high, ultrathink`,
          timestamp: new Date(),
        }]);
        setInput('');
        return true;
      }

      setThinkingLevel(actualLevel);

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `Thinking mode: ${actualLevel.toUpperCase()}`,
        timestamp: new Date(),
      }]);
      setInput('');
      return true;
    }

    return false; // Not a built-in command
  }, [thinkingLevel]);

  // Handle Text Submission
  const processPrompt = async (promptText: string) => {
    // Check for built-in commands first
    if (handleBuiltInCommand(promptText)) {
      return;
    }

    if (!promptText.trim() && !selectedElement && attachedImages.length === 0 && !screenshotElement) return;

    // Generate turn ID for this conversation turn
    const turnId = generateTurnId();
    console.log('[Turn]', turnId);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText,
      timestamp: new Date(),
      selectedElement: selectedElement || undefined,
      turnId,
      sequenceNumber: 0
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Build element context in react-grab style format
    let elementContext = '';
    if (selectedElement) {
      // Check if user has specified a target position via move mode
      const hasTargetPosition = selectedElement.targetPosition && selectedElement.originalPosition;

      elementContext = `
<selected_element>
${selectedElement.outerHTML || `<${selectedElement.tagName}${selectedElement.id ? ` id="${selectedElement.id}"` : ''}${selectedElement.className ? ` class="${selectedElement.className}"` : ''}>${selectedElement.text || ''}</${selectedElement.tagName}>`}

Element Details:
- Tag: ${selectedElement.tagName}
${selectedElement.id ? `- ID: ${selectedElement.id}` : ''}
${selectedElement.className ? `- Classes: ${selectedElement.className}` : ''}
${selectedElement.xpath ? `- XPath: ${selectedElement.xpath}` : ''}
${selectedElement.text ? `- Text Content: "${selectedElement.text}"` : ''}
${selectedElement.attributes ? `- Attributes: ${JSON.stringify(selectedElement.attributes)}` : ''}
${selectedElement.computedStyle ? `- Computed Style: display=${selectedElement.computedStyle.display}, position=${selectedElement.computedStyle.position}, color=${selectedElement.computedStyle.color}, bg=${selectedElement.computedStyle.backgroundColor}` : ''}
${selectedElement.rect ? `- Current Position: ${Math.round(selectedElement.rect.width)}x${Math.round(selectedElement.rect.height)} at (${Math.round(selectedElement.rect.left)}, ${Math.round(selectedElement.rect.top)})` : ''}
${hasTargetPosition ? `
<repositioning_request>
The user wants to MOVE this element to a new position.
- Original Position: ${Math.round(selectedElement.originalPosition!.width)}x${Math.round(selectedElement.originalPosition!.height)} at (${Math.round(selectedElement.originalPosition!.left)}, ${Math.round(selectedElement.originalPosition!.top)})
- Target Position: ${Math.round(selectedElement.targetPosition!.width)}x${Math.round(selectedElement.targetPosition!.height)} at (${Math.round(selectedElement.targetPosition!.x)}, ${Math.round(selectedElement.targetPosition!.y)})
- Width Change: ${selectedElement.targetPosition!.width - selectedElement.originalPosition!.width}px
- Height Change: ${selectedElement.targetPosition!.height - selectedElement.originalPosition!.height}px
- X Offset: ${selectedElement.targetPosition!.x - selectedElement.originalPosition!.left}px
- Y Offset: ${selectedElement.targetPosition!.y - selectedElement.originalPosition!.top}px

Please help the user achieve this repositioning by modifying the CSS/layout of the element. Consider:
1. Position property (relative, absolute, fixed, or using flexbox/grid)
2. The element's current CSS and its impact on layout
3. Whether the element needs to be extracted from the normal flow
4. Responsive considerations
</repositioning_request>` : ''}
</selected_element>`;
    }

    // Build file context from selected files
    let fileContext = '';
    if (selectedFiles.length > 0) {
      fileContext = `\n\nAttached Files:\n${selectedFiles.map(f => `
File: ${f.path}
\`\`\`
${f.content}
\`\`\`
`).join('\n')}`;
    }

    type UserContentPart =
      | { type: 'text'; text: string }
      | { type: 'image'; image: { base64Data: string; mimeType?: string } };

    // Get project context
    const projectPath = activeTab?.projectPath;
    const projectName = projectPath ? projectPath.split('/').pop() : null;

    let fullPromptText = `
Current Page: ${urlInput}
${pageTitle ? `Page Title: ${pageTitle}` : ''}
${projectPath ? `Project Folder: ${projectPath}` : ''}
${projectName ? `Project Name: ${projectName}` : ''}

User Request: ${userMessage.content}
${elementContext}
${fileContext}
${screenshotElement ? `Context: User selected element for visual reference: <${screenshotElement.tagName}>` : ''}

${projectPath ? `IMPORTANT: The source files for this page are in ${projectPath}. Use the Read and Glob tools to explore the project structure and find relevant source files before making changes.` : ''}
    `;

    if (attachLogs && logs.length > 0) {
        fullPromptText += `\n\nRecent Console Logs:\n${logs.join('\n')}`;
    }

    // Include selected logs if any
    if (selectedLogs && selectedLogs.length > 0) {
        const logsText = selectedLogs.map(log =>
          `[${log.timestamp.toLocaleTimeString()}] [${log.type}] ${log.message}`
        ).join('\n');
        fullPromptText += `\n\nSelected Console Logs (${selectedLogs.length} entries):\n${logsText}`;
    }

    // Include attached search results if any
    if (attachedSearchResults && attachedSearchResults.length > 0) {
        const searchText = attachedSearchResults.map((result, i) =>
          `${i + 1}. ${result.title}\n   URL: ${result.url}\n   ${result.snippet}`
        ).join('\n\n');
        fullPromptText += `\n\nWeb Search Results (${attachedSearchResults.length} results for context):\n${searchText}`;
    }

    // Only include code execution instructions if user has selected an element
    // OR explicitly asks to modify the page (change, update, modify, etc.)
    const modifyKeywords = /\b(change|modify|update|edit|delete|remove|add|make|set|fix|replace|style|color|size|font|width|height|margin|padding|border)\b/i;
    const wantsModification = selectedElement || modifyKeywords.test(userMessage.content);

    if (wantsModification) {
      fullPromptText += `
Instructions:
You are an AI UI assistant that can modify web pages. The user has selected an element to focus on.

CRITICAL WORKFLOW FOR SOURCE CODE CHANGES:
1. FIRST: Use the Read tool to read the ENTIRE source file (the component/page containing this element)
2. UNDERSTAND the full context - how this element fits in the page structure, what styles affect it, what props/data it uses
3. THEN make your changes, considering how they impact the whole page
4. The selected element is just the FOCUS AREA - you need the full file context to make good edits

For QUICK DOM PREVIEWS (temporary, not saved):
- Output: \`\`\`json-exec {"code": "...", "undo": "..."}\`\`\`
- The "code" executes immediately, "undo" restores original
- Use for quick style/text changes before committing to source

For SOURCE CODE EDITS (permanent):
1. READ the full source file first using the Read tool
2. Understand the component structure and how the element is rendered
3. Use the Edit tool to modify the source, preserving the overall structure
4. NEVER guess at the source code - always read it first

Selected Element Context:
- XPath: ${selectedElement?.xpath || 'N/A'}
- ID: ${selectedElement?.id || 'N/A'}
- Classes: ${selectedElement?.className || 'N/A'}

IMPORTANT: The selected element HTML above is just a snippet. For source edits, you MUST read the full file to understand the complete context. Don't assume the structure - READ IT.

Be concise. Confirm what you changed.
      `;
    } else {
      fullPromptText += `
Instructions:
You are a helpful AI assistant. Answer the user's question conversationally.
DO NOT modify the page or execute any code unless the user explicitly asks you to change something.
If you're not sure what the user wants, ask for clarification.
      `;
    }

    const userContentParts: UserContentPart[] = [
      { type: 'text', text: fullPromptText },
    ];

    // Add all attached images with explicit numbering for multi-image context
    attachedImages.forEach((img, index) => {
      // Add a text label before each image when multiple images are attached
      if (attachedImages.length > 1) {
        userContentParts.push({
          type: 'text',
          text: `\n[Image ${index + 1} of ${attachedImages.length}]:`,
        });
      }
      const base64Data = img.split(',')[1];
      const mimeType = img.split(';')[0].split(':')[1] || 'image/png';
      userContentParts.push({
        type: 'image',
        image: {
          base64Data,
          mimeType,
        },
      });
    });

    setAttachLogs(false);
    setAttachedImages([]);
    setScreenshotElement(null);
    setCapturedScreenshot(null); // Clear screenshot thumbnail
    setShowScreenshotPreview(false); // Close preview modal if open
    setAttachedSearchResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      // Determine which provider to use based on selected model
      const providerType = getProviderForModel(selectedModel.id);

      let text: string | null = null;

      // Process through coding agent for intent classification
      const { intent, systemPrompt: agentSystemPrompt, tools, promptMode } = processCodingMessage(userMessage.content);
      console.log(`[Coding Agent] Intent: ${intent.type} (${Math.round(intent.confidence * 100)}%) | Mode: ${promptMode}`);

      const googleProvider = appSettings.providers.find(p => p.id === 'google' && p.enabled && p.apiKey);

      // 🖼️ IMAGE ATTACHMENT HANDLER - works WITH or WITHOUT selected element
      // Must be BEFORE the selectedElement check to handle standalone image attachments
      const hasAttachedImageGlobal = attachedImages.length > 0;
      const isImageRelatedMessage = /(?:add|insert|put|use|replace|change|swap|set|place|show|save|upload).*(?:image|photo|picture|attached|this|screenshot)|(?:this|the|attached)\s*(?:image|photo|picture|screenshot)|(?:image|photo|picture|screenshot)\s*(?:here|to|in|on|as)/i.test(userMessage.content);

      if (hasAttachedImageGlobal && isImageRelatedMessage) {
        const projectPath = activeTab?.projectPath;
        if (!projectPath) {
          const errorMessage: ChatMessage = {
            id: `msg-error-${Date.now()}`,
            role: 'assistant',
            content: 'Cannot save image: No project folder is set. Please open a project first.',
            timestamp: new Date(),
            model: 'system',
          };
          setMessages(prev => [...prev, errorMessage]);
          setAttachedImages([]);
          return;
        }

        try {
          // Generate content-hash based filename
          const hashCode = (str: string) => {
            let hash = 0;
            for (let i = 0; i < Math.min(str.length, 10000); i++) {
              const char = str.charCodeAt(i);
              hash = ((hash << 5) - hash) + char;
              hash = hash & hash;
            }
            return Math.abs(hash).toString(16).padStart(8, '0');
          };
          const attachedImage = attachedImages[0];
          const contentHash = hashCode(attachedImage);
          const mimeMatch = attachedImage.match(/^data:image\/(\w+);/);
          const ext = mimeMatch ? mimeMatch[1].replace('jpeg', 'jpg') : 'png';
          const filename = `img-${contentHash}.${ext}`;
          const publicPath = `${projectPath}/public/uploads`;
          const fullPath = `${publicPath}/${filename}`;
          const relativePath = `/uploads/${filename}`;

          console.log('[Image Save] Saving to:', fullPath);

          // Save the image
          const saveResult = await window.electronAPI?.files.saveImage(attachedImage, fullPath);
          if (!saveResult?.success) {
            throw new Error(saveResult?.error || 'Failed to save image');
          }

          console.log('[Image Save] Image saved successfully');

          // If we have a selected element, apply the image to it
          if (selectedElement) {
            const webview = webviewRefs.current.get(activeTabId);
            if (webview) {
              const tagName = selectedElement.tagName?.toLowerCase() || '';
              const isImgElement = tagName === 'img';
              const isContainerElement = ['div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'figure', 'span', 'p'].includes(tagName);

              let applyCode: string;
              let undoCode: string;
              let description: string;

              if (isImgElement) {
                // Strategy 1: Direct img src replacement
                const originalSrc = await (webview as Electron.WebviewTag).executeJavaScript(`
                  (function() {
                    const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    return el ? el.src : '';
                  })();
                `);

                applyCode = `
                  (function() {
                    const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el && el.tagName === 'IMG') { el.src = '${relativePath}'; return 'Applied'; }
                    return 'Not found';
                  })();
                `;
                undoCode = `
                  (function() {
                    const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el && el.tagName === 'IMG') { el.src = '${originalSrc}'; return 'Reverted'; }
                    return 'Not found';
                  })();
                `;
                description = `Set image src to ${filename}`;

                await (webview as Electron.WebviewTag).executeJavaScript(applyCode);

                // Prepare source patch
                const approvalId = `dom-img-${Date.now()}`;
                const approvalPayload: PendingDOMApproval = {
                  id: approvalId,
                  element: selectedElement,
                  cssChanges: {},
                  srcChange: { oldSrc: originalSrc || '', newSrc: relativePath },
                  description,
                  undoCode,
                  applyCode,
                  userRequest: userMessage.content || 'Insert image',
                  patchStatus: 'preparing',
                };
                setPendingDOMApproval(approvalPayload);
                prepareDomPatch(approvalId, selectedElement, {}, description, undoCode, applyCode, userMessage.content || 'Insert image', projectPath, undefined, { oldSrc: originalSrc || '', newSrc: relativePath });
              } else if (isContainerElement) {
                // Strategy 2: Check for child img, or use background-image
                const childImgInfo = await (webview as Electron.WebviewTag).executeJavaScript(`
                  (function() {
                    const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (!el) return null;
                    const img = el.querySelector('img');
                    if (img) return { hasChildImg: true, childSrc: img.src };
                    return { hasChildImg: false, currentBg: el.style.backgroundImage };
                  })();
                `);

                if (childImgInfo?.hasChildImg) {
                  applyCode = `
                    (function() {
                      const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                      if (el) { const img = el.querySelector('img'); if (img) { img.src = '${relativePath}'; return 'Applied'; } }
                      return 'Not found';
                    })();
                  `;
                  undoCode = `
                    (function() {
                      const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                      if (el) { const img = el.querySelector('img'); if (img) { img.src = '${childImgInfo.childSrc}'; return 'Reverted'; } }
                      return 'Not found';
                    })();
                  `;
                  description = `Set child image src to ${filename}`;
                } else {
                  // Use background-image
                  const captureContent = await (webview as Electron.WebviewTag).executeJavaScript(`
                    (function() {
                      const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                      return el ? { text: el.textContent, bg: el.style.backgroundImage, bgSize: el.style.backgroundSize, bgPos: el.style.backgroundPosition } : null;
                    })();
                  `);

                  applyCode = `
                    (function() {
                      const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                      if (el) {
                        el.textContent = '';
                        el.style.backgroundImage = 'url(${relativePath})';
                        el.style.backgroundSize = 'cover';
                        el.style.backgroundPosition = 'center';
                        return 'Applied as background';
                      }
                      return 'Not found';
                    })();
                  `;
                  undoCode = `
                    (function() {
                      const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                      if (el) {
                        el.textContent = ${JSON.stringify(captureContent?.text || '')};
                        el.style.backgroundImage = '${captureContent?.bg || ''}';
                        el.style.backgroundSize = '${captureContent?.bgSize || ''}';
                        el.style.backgroundPosition = '${captureContent?.bgPos || ''}';
                        return 'Reverted';
                      }
                      return 'Not found';
                    })();
                  `;
                  description = `Set background image to ${filename}`;
                }

                await (webview as Electron.WebviewTag).executeJavaScript(applyCode!);

                // Prepare source patch for CSS changes
                const approvalId = `dom-img-${Date.now()}`;
                const approvalPayload: PendingDOMApproval = {
                  id: approvalId,
                  element: selectedElement,
                  cssChanges: childImgInfo?.hasChildImg ? {} : { backgroundImage: `url(${relativePath})`, backgroundSize: 'cover', backgroundPosition: 'center' },
                  srcChange: childImgInfo?.hasChildImg ? { oldSrc: childImgInfo.childSrc || '', newSrc: relativePath } : undefined,
                  description: description!,
                  undoCode: undoCode!,
                  applyCode: applyCode!,
                  userRequest: userMessage.content || 'Insert image',
                  patchStatus: 'preparing',
                };
                setPendingDOMApproval(approvalPayload);
                prepareDomPatch(approvalId, selectedElement, childImgInfo?.hasChildImg ? {} : { backgroundImage: `url(${relativePath})`, backgroundSize: 'cover', backgroundPosition: 'center' }, description!, undoCode!, applyCode!, userMessage.content || 'Insert image', projectPath);
              } else {
                // Fallback: Try setting src anyway
                applyCode = `
                  (function() {
                    const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el) { el.src = '${relativePath}'; return 'Applied'; }
                    return 'Not found';
                  })();
                `;
                undoCode = 'location.reload()';
                description = `Set ${tagName} src to ${filename}`;
                await (webview as Electron.WebviewTag).executeJavaScript(applyCode);
              }

              const successMessage: ChatMessage = {
                id: `msg-img-${Date.now()}`,
                role: 'assistant',
                content: `✅ ${description}`,
                timestamp: new Date(),
                model: 'system',
                intent: 'ui_modify',
              };
              setMessages(prev => [...prev, successMessage]);
              setPendingChange({ code: applyCode!, undoCode: undoCode!, description: description!, additions: 1, deletions: 1, source: 'dom' });
              setAttachedImages([]);
              return;
            }
          }

          // No selected element - just save the image and confirm
          const successMessage: ChatMessage = {
            id: `msg-img-${Date.now()}`,
            role: 'assistant',
            content: `✅ Image saved to \`${relativePath}\`\n\nTo insert this image into an element, select an element first and then attach the image.`,
            timestamp: new Date(),
            model: 'system',
          };
          setMessages(prev => [...prev, successMessage]);
          setAttachedImages([]);
          return;
        } catch (error) {
          console.error('[Image Save] Error:', error);
          const errorMessage: ChatMessage = {
            id: `msg-error-${Date.now()}`,
            role: 'assistant',
            content: `Failed to save image: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            model: 'system',
          };
          setMessages(prev => [...prev, errorMessage]);
          setAttachedImages([]);
          return;
        }
      }

      // INSTANT UI UPDATE: For ui_modify with a selected element that has source mapping
      // Use Gemini Flash for instant DOM update + prepare source patch for confirmation
      console.log('[Instant UI] Check conditions:', {
        intentType: intent.type,
        hasSelectedElement: !!selectedElement,
        hasGoogleProvider: !!googleProvider?.apiKey,
        hasSourceLocation: !!selectedElement?.sourceLocation?.sources?.[0],
      });

      if (intent.type === 'ui_modify' && selectedElement && googleProvider?.apiKey) {
        console.log('[Instant UI] Triggering instant UI update with source patch...');
        console.log('[Instant UI] Selected element:', {
          tagName: selectedElement.tagName,
          xpath: selectedElement.xpath,
          sourceLocation: selectedElement.sourceLocation,
        });

        // Show progress feedback for instant UI path
        setIsStreaming(true);
        setConnectionState('streaming');
        setCompletedToolCalls([]); // Clear previous tool states
        setStreamingMessage({
          id: `instant-ui-${Date.now()}`,
          content: `🎯 Analyzing \`<${selectedElement.tagName.toLowerCase()}>\` element...`,
          reasoning: '',
          toolCalls: [],
        });

        // 🖼️ SMART IMAGE INSERTION: Works with ANY element type
        const hasAttachedImage = attachedImages.length > 0;
        // Broad pattern to catch any image-related intent
        const isImageInsertIntent = /(?:add|insert|put|use|replace|change|swap|set|place|show).*(?:image|photo|picture|attached|this)|(?:this|the|attached)\s*(?:image|photo|picture)|image\s*(?:here|to|in|on)/i.test(userMessage.content);

        // Trigger if: has attached image AND (mentions image OR empty message with just the image)
        if (hasAttachedImage && (isImageInsertIntent || userMessage.content.trim() === '')) {
          const tagName = selectedElement.tagName?.toLowerCase() || '';
          console.log('[Image Insert] Detected image insertion request for:', tagName);

          const projectPath = activeTab?.projectPath;
          if (!projectPath) {
            const errorMessage: ChatMessage = {
              id: `msg-error-${Date.now()}`,
              role: 'assistant',
              content: 'Cannot insert image: No project folder is set. Please open a project first.',
              timestamp: new Date(),
              model: 'system',
            };
            setMessages(prev => [...prev, errorMessage]);
            setAttachedImages([]);
            return;
          }

          try {
            // Generate content-hash based filename to prevent duplicates
            const hashCode = (str: string) => {
              let hash = 0;
              for (let i = 0; i < Math.min(str.length, 10000); i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
              }
              return Math.abs(hash).toString(16).padStart(8, '0');
            };
            const attachedImage = attachedImages[0];
            const contentHash = hashCode(attachedImage);
            const mimeMatch = attachedImage.match(/^data:image\/(\w+);/);
            const ext = mimeMatch ? mimeMatch[1].replace('jpeg', 'jpg') : 'png';
            const filename = `img-${contentHash}.${ext}`;
            const publicPath = `${projectPath}/public/uploads`;
            const fullPath = `${publicPath}/${filename}`;
            const relativePath = `/uploads/${filename}`;

            console.log('[Image Insert] Saving to:', fullPath);

            // Save the image to the project's public folder
            const saveResult = await window.electronAPI?.files.saveImage(attachedImage, fullPath);
            if (!saveResult?.success) {
              throw new Error(saveResult?.error || 'Failed to save image');
            }

            console.log('[Image Insert] Image saved successfully');

            // Get the webview
            const webview = webviewRefs.current.get(activeTabId);
            if (!webview) {
              throw new Error('Webview not available');
            }

            // Determine insertion strategy based on element type
            const isImgElement = tagName === 'img';
            const isContainerElement = ['div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'figure', 'span', 'p'].includes(tagName);

            let applyCode: string;
            let undoCode: string;
            let description: string;

            if (isImgElement) {
              // Strategy 1: Direct img src replacement
              const originalSrc = await (webview as Electron.WebviewTag).executeJavaScript(`
                (function() {
                  const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  return el ? el.src : '';
                })();
              `);

              applyCode = `
                (function() {
                  const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (el && el.tagName === 'IMG') {
                    el.src = '${relativePath}';
                    return 'Applied src';
                  }
                  return 'Element not found';
                })();
              `;
              undoCode = `
                (function() {
                  const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (el && el.tagName === 'IMG') {
                    el.src = '${originalSrc}';
                    return 'Reverted';
                  }
                  return 'Element not found';
                })();
              `;
              description = `Set image src to ${filename}`;

              // Execute and prepare source patch with srcChange
              await (webview as Electron.WebviewTag).executeJavaScript(applyCode);

              if (selectedElement.sourceLocation?.sources?.[0]) {
                const approvalId = `dom-img-${Date.now()}`;
                const approvalPayload: PendingDOMApproval = {
                  id: approvalId,
                  element: selectedElement,
                  cssChanges: {},
                  srcChange: { oldSrc: originalSrc || '', newSrc: relativePath },
                  description,
                  undoCode,
                  applyCode,
                  userRequest: userMessage.content || 'Insert image',
                  patchStatus: 'preparing',
                };
                setPendingDOMApproval(approvalPayload);
                prepareDomPatch(
                  approvalId,
                  selectedElement,
                  {},
                  description,
                  undoCode,
                  applyCode,
                  userMessage.content || 'Insert image',
                  projectPath,
                  undefined,
                  { oldSrc: originalSrc || '', newSrc: relativePath }
                );
              }

            } else if (isContainerElement) {
              // Strategy 2: Check for child img, or use background-image
              const childImgInfo = await (webview as Electron.WebviewTag).executeJavaScript(`
                (function() {
                  const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (!el) return null;
                  const img = el.querySelector('img');
                  if (img) {
                    return { hasChildImg: true, childSrc: img.src };
                  }
                  return { hasChildImg: false, currentBg: el.style.backgroundImage };
                })();
              `);

              if (childImgInfo?.hasChildImg) {
                // Strategy 2a: Update child img src
                applyCode = `
                  (function() {
                    const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el) {
                      const img = el.querySelector('img');
                      if (img) {
                        img.src = '${relativePath}';
                        return 'Applied to child img';
                      }
                    }
                    return 'Element not found';
                  })();
                `;
                undoCode = `
                  (function() {
                    const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el) {
                      const img = el.querySelector('img');
                      if (img) {
                        img.src = '${childImgInfo.childSrc}';
                        return 'Reverted';
                      }
                    }
                    return 'Element not found';
                  })();
                `;
                description = `Set child image src to ${filename}`;
              } else {
                // Strategy 2b: Use background-image and clear text content
                const captureContent = await (webview as Electron.WebviewTag).executeJavaScript(`
                  (function() {
                    const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    return el ? { text: el.textContent, bg: el.style.backgroundImage, bgSize: el.style.backgroundSize, bgPos: el.style.backgroundPosition } : null;
                  })();
                `);

                applyCode = `
                  (function() {
                    const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el) {
                      el.style.backgroundImage = 'url(${relativePath})';
                      el.style.backgroundSize = 'cover';
                      el.style.backgroundPosition = 'center';
                      el.textContent = '';
                      return 'Applied background-image';
                    }
                    return 'Element not found';
                  })();
                `;
                undoCode = `
                  (function() {
                    const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el) {
                      el.style.backgroundImage = '${captureContent?.bg || ''}';
                      el.style.backgroundSize = '${captureContent?.bgSize || ''}';
                      el.style.backgroundPosition = '${captureContent?.bgPos || ''}';
                      el.textContent = '${(captureContent?.text || '').replace(/'/g, "\\'")}';
                      return 'Reverted';
                    }
                    return 'Element not found';
                  })();
                `;
                description = `Set background-image to ${filename}`;

                // Prepare source patch with CSS changes
                if (selectedElement.sourceLocation?.sources?.[0]) {
                  const approvalId = `dom-img-${Date.now()}`;
                  const approvalPayload: PendingDOMApproval = {
                    id: approvalId,
                    element: selectedElement,
                    cssChanges: {
                      backgroundImage: `url(${relativePath})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    },
                    description,
                    undoCode,
                    applyCode,
                    userRequest: userMessage.content || 'Insert image',
                    patchStatus: 'preparing',
                  };
                  setPendingDOMApproval(approvalPayload);
                  prepareDomPatch(
                    approvalId,
                    selectedElement,
                    {
                      backgroundImage: `url(${relativePath})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    },
                    description,
                    undoCode,
                    applyCode,
                    userMessage.content || 'Insert image',
                    projectPath
                  );
                }
              }

              // Execute the DOM change
              await (webview as Electron.WebviewTag).executeJavaScript(applyCode);

            } else {
              // Fallback: Try setting src anyway
              applyCode = `
                (function() {
                  const el = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (el) {
                    el.src = '${relativePath}';
                    return 'Applied src';
                  }
                  return 'Element not found';
                })();
              `;
              undoCode = 'location.reload()';
              description = `Set ${tagName} src to ${filename}`;
              await (webview as Electron.WebviewTag).executeJavaScript(applyCode);
            }

            // Add success message
            const successMessage: ChatMessage = {
              id: `msg-img-${Date.now()}`,
              role: 'assistant',
              content: `Preview: ${description}`,
              timestamp: new Date(),
              model: selectedModel.id,
              intent: 'ui_modify',
            };
            setMessages(prev => [...prev, successMessage]);

            // Set pending change for approval
            setPendingChange({
              code: applyCode,
              undoCode,
              description,
              additions: 1,
              deletions: 1,
              source: 'dom',
            });

            // Clear attached images
            setAttachedImages([]);
            return;
          } catch (error) {
            console.error('[Image Insert] Error:', error);
            const errorMessage: ChatMessage = {
              id: `msg-error-${Date.now()}`,
              role: 'assistant',
              content: `Failed to insert image: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: new Date(),
              model: 'system',
            };
            setMessages(prev => [...prev, errorMessage]);
            setAttachedImages([]);
            return;
          }
        }
        // Debug: Log full source location details
        if (selectedElement.sourceLocation) {
          console.log('[Instant UI] sourceLocation.sources:', selectedElement.sourceLocation.sources);
          console.log('[Instant UI] sourceLocation.summary:', selectedElement.sourceLocation.summary);
          if (selectedElement.sourceLocation.sources?.[0]) {
            const src = selectedElement.sourceLocation.sources[0];
            console.log('[Instant UI] Source file:', src.file, 'line:', src.line, 'name:', src.name);
          }
        } else {
          console.log('[Instant UI] NO sourceLocation on selectedElement!');
        }

        // Phase 1: Instant DOM update using selected model
        setStreamingMessage(prev => prev ? { ...prev, content: `🎯 Analyzing \`<${selectedElement.tagName.toLowerCase()}>\` element...\n\n⚡ Generating CSS changes with ${selectedModel.name}...` } : null);

        const uiResult = await generateUIUpdate(selectedElement, userMessage.content, googleProvider.apiKey, selectedModel.id);
        const hasCssChanges = Object.keys(uiResult.cssChanges).length > 0;
        const hasTextChange = !!uiResult.textChange;
        const hasAnyChange = hasCssChanges || hasTextChange;

        console.log('[Instant UI] Result:', { hasCssChanges, hasTextChange, textChange: uiResult.textChange, cssChanges: uiResult.cssChanges });
        
        // Update progress with what was generated
        if (hasAnyChange) {
          const changesList = [
            ...Object.entries(uiResult.cssChanges).map(([prop, val]) => `  • \`${prop}\`: \`${val}\``),
            ...(hasTextChange ? [`  • text: "${uiResult.textChange}"`] : [])
          ].join('\n');
          setStreamingMessage(prev => prev ? { 
            ...prev, 
            content: `🎯 Analyzing \`<${selectedElement.tagName.toLowerCase()}>\` element...\n\n⚡ Generated changes:\n${changesList}\n\n🔄 Applying to preview...` 
          } : null);
        }

        // Apply changes to the live DOM if present
        const webview = webviewRefs.current.get(activeTabId);
        let storedUndoCode = '';
        let storedApplyCode = '';

        if (uiResult.success && hasAnyChange && webview) {
          // Build capture script for original values
          const captureOriginalScript = `
            (function() {
              const element = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
              if (element) {
                const original = {
                  textContent: element.textContent || '',
                  styles: {}
                };
                ${hasCssChanges ? Object.keys(uiResult.cssChanges).map(prop => `original.styles['${prop}'] = element.style.${prop} || '';`).join('\n') : ''}
                return JSON.stringify(original);
              }
              return null;
            })();
          `;

          try {
            const originalJson = await (webview as Electron.WebviewTag).executeJavaScript(captureOriginalScript);
            const original = originalJson ? JSON.parse(originalJson) : { textContent: '', styles: {} };
            console.log('[Instant UI] Original captured:', original);

            // Build undo code
            let undoChanges = '';
            if (hasTextChange) {
              undoChanges += `element.textContent = ${JSON.stringify(original.textContent)};\n`;
            }
            if (hasCssChanges) {
              undoChanges += Object.entries(original.styles)
                .map(([prop, val]) => `element.style.${prop} = '${val}';`)
                .join('\n');
            }

            storedUndoCode = `
              (function() {
                const element = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (element) {
                  ${undoChanges}
                  return 'Reverted';
                }
                return 'Element not found';
              })();
            `;

            // Build apply code
            let applyChanges = '';
            if (hasTextChange) {
              applyChanges += `element.textContent = ${JSON.stringify(uiResult.textChange)};\n`;
            }
            if (hasCssChanges) {
              applyChanges += Object.entries(uiResult.cssChanges)
                .map(([prop, val]) => `element.style.${prop} = '${val}';`)
                .join('\n');
            }

            storedApplyCode = `
              (function() {
                const element = document.evaluate('${selectedElement.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (element) {
                  ${applyChanges}
                  return 'Applied';
                }
                return 'Element not found';
              })();
            `;

            // Now apply the changes
            const result = await (webview as Electron.WebviewTag).executeJavaScript(storedApplyCode);
            console.log('[Instant UI] DOM update result:', result);

            // Add immediate feedback message
            const feedbackMessage: ChatMessage = {
              id: `msg-ui-${Date.now()}`,
              role: 'assistant',
              content: `Preview: ${uiResult.description}`,
              timestamp: new Date(),
              model: selectedModel.id,
              intent: 'ui_modify',
            };
            setMessages(prev => [...prev, feedbackMessage]);

            // Set BOTH approval states:
            // 1. pendingChange - for the pill toolbar in main view
            // 2. pendingDOMApproval - for the new floating/chat approval UI
            const hasCssChangesCount = Object.keys(uiResult.cssChanges).length;
            const hasTextChangeCount = hasTextChange ? 1 : 0;

            setPendingChange({
              code: storedApplyCode,
              undoCode: storedUndoCode,
              description: uiResult.description,
              additions: hasCssChangesCount + hasTextChangeCount,
              deletions: hasCssChangesCount + hasTextChangeCount,
              source: 'dom',
            });

            if (selectedElement.sourceLocation?.sources?.[0]) {
              const approvalId = `dom-${Date.now()}`;
              const approvalPayload: PendingDOMApproval = {
                id: approvalId,
                element: selectedElement,
                cssChanges: uiResult.cssChanges,
                textChange: uiResult.textChange,
                description: uiResult.description,
                undoCode: storedUndoCode,
                applyCode: storedApplyCode,
                userRequest: userMessage.content,
                patchStatus: 'preparing',
              };
              console.log('[Instant UI] Pending DOM approval created:', approvalId);
              
              // Clear streaming and show final status
              setStreamingMessage(prev => prev ? { 
                ...prev, 
                content: `✅ Preview applied!\n\n${uiResult.description}\n\n📝 Preparing source code patch...` 
              } : null);
              
              setPendingDOMApproval(approvalPayload);
              // Pass textChange for fast path (skips AI for simple text replacements)
              const textChangePayload = hasTextChange
                ? { oldText: original.textContent, newText: uiResult.textChange }
                : undefined;
              prepareDomPatch(
                approvalId,
                selectedElement,
                uiResult.cssChanges,
                uiResult.description,
                storedUndoCode,
                storedApplyCode,
                userMessage.content,
                activeTab?.projectPath,
                textChangePayload
              );
            }

            // Clear streaming state - DOM approval UI takes over
            setIsStreaming(false);
            setStreamingMessage(null);
            
            // Return early - wait for user to approve
            return;
          } catch (e) {
            console.error('[Instant UI] Failed to apply DOM changes:', e);
            // Clear streaming state
            setIsStreaming(false);
            setStreamingMessage(null);
            // Add error message
            const errorMessage: ChatMessage = {
              id: `msg-error-${Date.now()}`,
              role: 'assistant',
              content: `Failed to apply preview: ${e instanceof Error ? e.message : 'Unknown error'}`,
              timestamp: new Date(),
              model: selectedModel.id,
              intent: 'ui_modify',
            };
            setMessages(prev => [...prev, errorMessage]);
            return;
          }
        } else if (!hasAnyChange) {
          // No changes detected - clear streaming state
          setIsStreaming(false);
          setStreamingMessage(null);
          const noChangeMessage: ChatMessage = {
            id: `msg-nochange-${Date.now()}`,
            role: 'assistant',
            content: `No changes to apply for: "${userMessage.content}"`,
            timestamp: new Date(),
            model: selectedModel.id,
            intent: 'ui_modify',
          };
          setMessages(prev => [...prev, noChangeMessage]);
          return;
        }

        // NOTE: Source patch generation is now triggered by user approval, not automatically
        // This ensures DOM changes are previewed and approved before source is modified
        // See handleAcceptDOMApproval below

        // Legacy path - this should not be reached now
        if (false && selectedElement.sourceLocation?.sources?.[0]) {
          const projectPath = activeTab?.projectPath;
          const capturedUndoCode = storedUndoCode;
          const capturedApplyCode = storedApplyCode;

          console.log('[Source Patch] Triggering source patch generation...');
          console.log('[Source Patch] User message:', userMessage.content);

          generateSourcePatch({
              element: selectedElement,
              cssChanges: uiResult.cssChanges,
              providerConfig: { modelId: selectedModel.id, providers: providerConfigs },
              projectPath: projectPath || undefined,
              userRequest: userMessage.content,
            })
            .then(patch => {
              if (patch) {
                console.log('[Source Patch] Generated patch for:', patch.filePath);
                setPendingPatch({
                  id: `patch-${Date.now()}`,
                  filePath: patch.filePath,
                  originalContent: patch.originalContent,
                  patchedContent: patch.patchedContent,
                  description: uiResult.description || userMessage.content,
                  elementSelector: selectedElement.xpath || undefined,
                  cssChanges: uiResult.cssChanges,
                  undoCode: capturedUndoCode,
                  applyCode: capturedApplyCode,
                });
              } else {
                console.log('[Source Patch] No patch returned');
              }
            })
            .catch(e => console.error('[Source Patch] Failed:', e));

          // Return early - we've handled the UI modification
          return;
        }
      }

      // Determine if we should use coding agent tools
      // ALWAYS provide tools unless in DOM edit mode (fast path for direct CSS changes)
      // This ensures the AI can read files, search, etc. for ANY request
      // DOM edit mode uses minimal prompt without tools (fast path)
      const shouldUseTools = promptMode !== 'dom_edit'
      console.log(`[AI SDK] Mode: ${promptMode} | MCP tools: ${mcpToolDefinitions.length} | Tools enabled: ${shouldUseTools}`);

      // Use AI SDK for OpenAI, Anthropic, Google text models, and OAuth providers
      // Google uses process.env.API_KEY directly, so bypass provider configs check for google too
      if (providerType && (providerConfigs.length > 0 || providerType === 'claude-code' || providerType === 'codex' || providerType === 'google')) {
        console.log(`[AI SDK] Using provider: ${providerType} for model: ${selectedModel.id}`);
        console.log(`[AI SDK] Using tools: ${shouldUseTools}`);

        // Build conversation history for context (last 10 messages)
        // Filter out system messages since AI providers require system content via 'system' param
        const conversationHistory: CoreMessage[] = toCoreMessages(
          messages
            .filter(msg => msg.role !== 'system')
            .slice(-10)
        );

        const userCoreMessage: CoreMessage = {
          role: 'user',
          content: userContentParts as CoreMessage['content'],
        };

        // Add current message with full context
        const allMessages: CoreMessage[] = [
          ...conversationHistory,
          userCoreMessage,
        ];

        setAgentProcessing(true);
        setIsStreaming(true);
        setConnectionState('streaming');
        setCompletedToolCalls([]); // Clear previous tool states

        // Create streaming message placeholder with initial activity indicator
        const streamingId = `streaming-${Date.now()}`;
        setStreamingMessage({
          id: streamingId,
          content: '',
          reasoning: '',
          toolCalls: [],
        });

        // Track accumulated tool calls for display - must include id for proper UI mapping
        const accumulatedToolCalls: Array<{ id: string; name: string; args: unknown; status: 'running' | 'done' | 'error'; result?: unknown }> = [];

        // Use streaming API for real-time response
        console.log('[AI SDK] Starting stream...');
        let streamedTextBuffer = '';

        console.log('[AI SDK] Streaming with project folder:', activeTab?.projectPath || '(none)')
        const result = await streamAI({
          modelId: selectedModel.id,
          messages: allMessages,
          providers: providerConfigs,
          system: shouldUseTools ? agentSystemPrompt : undefined,
          tools: shouldUseTools ? tools : undefined,
          maxSteps: 15, // Allow more steps for complex file operations
          enableReasoning: thinkingLevel !== 'off',
          mcpTools: mcpToolDefinitions, // Pass MCP tools separately
          projectFolder: activeTab?.projectPath || undefined,
          onChunk: (chunk) => {
            // Update streaming message as chunks arrive
            const chunkStr = typeof chunk === 'string' ? chunk : String(chunk ?? '');
            streamedTextBuffer += chunkStr;
            setStreamingMessage(prev => prev ? { ...prev, content: streamedTextBuffer } : null);
          },
          onStepFinish: (step) => {
            console.log('[AI SDK] Step finished:', {
              textLength: step?.text?.length,
              toolCalls: step?.toolCalls?.length,
              toolResults: step?.toolResults?.length,
            });

            // Update streaming message with tool activity
            if (step?.toolCalls && step.toolCalls.length > 0) {
              for (const tc of step.toolCalls) {
                const toolId = tc.toolCallId || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const toolName = tc.toolName?.replace(/^mcp_[^_]+_/, '') || 'tool';
                const existing = accumulatedToolCalls.find(t => t.id === toolId);
                if (!existing) {
                  accumulatedToolCalls.push({ id: toolId, name: toolName, args: tc.args || {}, status: 'running' });
                }
              }
            }

            // Mark tools as done when results come in
            if (step?.toolResults && step.toolResults.length > 0) {
              for (const tr of step.toolResults) {
                const toolId = tr.toolCallId;
                const toolName = tr.toolName?.replace(/^mcp_[^_]+_/, '') || 'tool';
                // Match by ID first, then by name (fallback for tools without IDs)
                const existing = toolId
                  ? accumulatedToolCalls.find(t => t.id === toolId)
                  : accumulatedToolCalls.find(t => t.name === toolName && t.status === 'running');
                if (existing) {
                  existing.status = (tr.result as any)?.error ? 'error' : 'done';
                  existing.result = tr.result;
                }
              }
            }

            // Update streaming message to show tool activity with full structure
            const toolSummary = accumulatedToolCalls.map(t => {
              const icon = t.status === 'running' ? '⏳' : t.status === 'error' ? '❌' : '✓';
              return `${icon} ${t.name}`;
            }).join(' → ');

            if (toolSummary) {
              setStreamingMessage(prev => prev ? {
                ...prev,
                content: streamedTextBuffer || `Working: ${toolSummary}`,
                toolCalls: accumulatedToolCalls.map(t => ({
                  id: t.id,
                  name: t.name,
                  args: t.args,
                  status: t.status === 'done' ? 'complete' : t.status,
                  result: t.result
                }))
              } : null);
            }
          },
          onReasoningChunk: (chunk) => {
            // Reasoning chunk may be a string or an object with content
            const reasoningStr = typeof chunk === 'string' ? chunk : (chunk?.content ?? String(chunk ?? ''));
            console.log('[AI SDK] Reasoning chunk:', reasoningStr.substring(0, 100));
            setStreamingMessage(prev => prev ? { ...prev, reasoning: (prev.reasoning || '') + reasoningStr } : null);
          },
        });

        // Stream complete - finalize the message
        console.log('[AI SDK] Stream complete, clearing streaming state');
        setIsStreaming(false);
        setAgentProcessing(false);
        setConnectionState('idle'); // Move to idle state (connected but not streaming)

        // Capture final tool states before clearing streaming message
        if (streamingMessage?.toolCalls && streamingMessage.toolCalls.length > 0) {
          const finalToolStates = streamingMessage.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            status: (tc.status === 'error' ? 'error' : 'success') as 'success' | 'error',
            timestamp: new Date(),
          }));
          setCompletedToolCalls(finalToolStates);
        }

        // Clear streaming message after capturing tool states
        setStreamingMessage(null);

        let resolvedText = (result.text || streamedTextBuffer || '').trim();
        if (!resolvedText && result.toolResults && result.toolResults.length > 0) {
          // Create a concise summary of tool results instead of dumping raw JSON
          const summaries = result.toolResults
            .map(tr => {
              const toolName = tr.toolName?.replace(/^mcp_[^_]+_/, '') || 'tool';
              const res = tr.result as Record<string, unknown>;

              // Handle different result types with concise summaries
              if (res?.error) {
                return `❌ ${toolName}: ${res.error}`;
              }
              if (res?.content && typeof res.content === 'string') {
                // File content - show truncated preview
                const preview = res.content.length > 200
                  ? res.content.substring(0, 200) + '...'
                  : res.content;
                return `✓ ${toolName}: ${res.path || 'file'}\n\`\`\`\n${preview}\n\`\`\``;
              }
              if (res?.tree && Array.isArray(res.tree)) {
                // File tree - show count
                const countItems = (items: unknown[]): number => {
                  let count = items.length;
                  for (const item of items) {
                    if ((item as any)?.children) count += countItems((item as any).children);
                  }
                  return count;
                };
                return `✓ ${toolName}: Found ${countItems(res.tree)} items`;
              }
              if (res?.entries && Array.isArray(res.entries)) {
                // Directory listing - show count and first few
                const entries = res.entries as Array<{ name: string; isDirectory: boolean }>;
                const preview = entries.slice(0, 5).map(e => e.isDirectory ? `📁 ${e.name}` : `📄 ${e.name}`).join(', ');
                return `✓ ${toolName}: ${entries.length} items (${preview}${entries.length > 5 ? '...' : ''})`;
              }
              if (res?.matches && Array.isArray(res.matches)) {
                // Search results
                return `✓ ${toolName}: Found ${res.matches.length} matches`;
              }
              if (res?.success) {
                return `✓ ${toolName}: Success`;
              }
              // Fallback - show truncated JSON
              const json = JSON.stringify(res, null, 2);
              return `✓ ${toolName}: ${json.length > 200 ? json.substring(0, 200) + '...' : json}`;
            })
            .join('\n\n');
          resolvedText = summaries || 'Tasks completed.';
        }
        if (!resolvedText) {
          // Check if tools were used via accumulatedToolCalls (Agent SDK path)
          if (accumulatedToolCalls.length > 0) {
            const toolSummary = accumulatedToolCalls
              .map(t => `✓ ${t.name}${t.status === 'error' ? ' (error)' : ''}`)
              .join('\n');
            resolvedText = `Done.\n\n${toolSummary}`;
          } else {
            resolvedText = 'No response generated.';
          }
        }
        text = resolvedText;

        // Note: streamingMessage was already cleared above to remove spinning indicators
        // finalStreamingMessage would be null now, but we don't need it since result contains tool info

        // If we got reasoning, log it
        if (result.reasoning) {
          const reasoningStr = typeof result.reasoning === 'string' ? result.reasoning : String(result.reasoning);
          console.log('[AI SDK] Reasoning received:', reasoningStr.substring(0, 200));
        }

        // Collect tool usage for the message
        const toolUsage: ToolUsage[] = [];
        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log(`[AI SDK] Tool calls:`, result.toolCalls);
          for (let i = 0; i < result.toolCalls.length; i++) {
            const tc = result.toolCalls[i];
            const tr = result.toolResults?.[i];
            toolUsage.push({
              id: tc.toolCallId,
              name: tc.toolName,
              args: tc.args as Record<string, unknown>,
              result: tr?.result,
              isError: tr ? (tr.result as any)?.error !== undefined : false,
            });
          }
        }

        // Store tool usage and intent for the response message
        (window as any).__pendingToolUsage = toolUsage.length > 0 ? toolUsage : undefined;
        (window as any).__pendingIntent = intent.type !== 'unknown' ? intent.type : undefined;
        // Ensure reasoning is a resolved string, not a Promise
        console.log('[AI SDK] Result reasoning:', {
          hasReasoning: !!result.reasoning,
          type: typeof result.reasoning,
          length: typeof result.reasoning === 'string' ? result.reasoning.length : 'N/A',
        });
        const resolvedReasoning = result.reasoning && typeof result.reasoning === 'string' ? result.reasoning : undefined;
        (window as any).__pendingReasoning = resolvedReasoning;
        console.log('[AI SDK] Stored pending reasoning:', resolvedReasoning ? `${resolvedReasoning.substring(0, 100)}...` : 'none');
      } else {
        // Fallback to GoogleGenAI for backwards compatibility or if no provider configured
        console.log('[AI SDK] Falling back to GoogleGenAI with streaming');
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("No API Key configured. Please add your API key in Settings.");
        const ai = new GoogleGenAI({ apiKey });

        const geminiContents = [
          {
            role: 'user',
            parts: userContentParts.map(part =>
              part.type === 'text'
                ? { text: part.text }
                : { inlineData: { data: part.image.base64Data, mimeType: part.image.mimeType || 'image/png' } }
            ),
          },
        ];

        setIsStreaming(true);
        setConnectionState('streaming');
        setCompletedToolCalls([]); // Clear previous tool states
        setStreamingMessage({
          id: `streaming-fallback-${Date.now()}`,
          content: '',
          reasoning: '',
          toolCalls: [],
        });

        // Use streaming API for real-time response
        const response = await ai.models.generateContentStream({
          model: selectedModel.id,
          contents: geminiContents
        });

        let streamedText = '';
        for await (const chunk of response) {
          const chunkText = chunk.text || '';
          streamedText += chunkText;
          setStreamingMessage(prev => prev ? { ...prev, content: prev.content + chunkText } : null);
        }

        setIsStreaming(false);
        setStreamingMessage(null);
        text = streamedText;
      }

      if (text) {
        // Check for executable code blocks
        const codeBlockRegex = /```json-exec\s*(\{[\s\S]*?\})\s*```/g;
        let match;
        const codeBlocks: Array<{code: string; undo?: string}> = [];

        while ((match = codeBlockRegex.exec(text)) !== null) {
          try {
            const parsed = JSON.parse(match[1]);
            if (parsed.code) {
              codeBlocks.push({
                code: parsed.code,
                undo: parsed.undo
              });
            }
          } catch (e) {
            console.error('[Exec] Failed to parse:', e);
          }
        }

        // Clean up the response for display
        const cleanedText = text.replace(/```json-exec\s*\{[\s\S]*?\}\s*```/g, '').trim();

        // Get stored tool usage, intent, and reasoning from the request
        const pendingToolUsage = (window as any).__pendingToolUsage as ToolUsage[] | undefined;
        const pendingIntent = (window as any).__pendingIntent as string | undefined;
        const pendingReasoning = (window as any).__pendingReasoning as string | undefined;
        delete (window as any).__pendingToolUsage;
        delete (window as any).__pendingIntent;
        delete (window as any).__pendingReasoning;

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: cleanedText || 'Changes applied.',
          timestamp: new Date(),
          model: selectedModel.name,
          intent: pendingIntent,
          toolUsage: pendingToolUsage,
          reasoning: pendingReasoning,
          turnId,
          parentTurnId: userMessage.id,
          sequenceNumber: 1,
        }]);

        // If we have code to execute, execute immediately and show toolbar
        const webview = webviewRefs.current.get(activeTabId);
        if (codeBlocks.length > 0 && webview && isWebviewReady) {
          const forwardCode = codeBlocks.map(b => b.code).join(';\n');
          const undoCode = codeBlocks.map(b => b.undo || '').filter(Boolean).join(';\n');

          // Execute immediately
          console.log('[Exec] Executing immediately:', forwardCode);
          webview.executeJavaScript(forwardCode)
            .then(() => console.log('[Exec] Applied'))
            .catch((err: Error) => console.error('[Exec] Error:', err));

          // Calculate simple diff stats based on code changes
          // Count semicolons/statements as a rough proxy for changes
          const additions = codeBlocks.length;
          const deletions = codeBlocks.filter(b => b.undo).length;

          // Store for toolbar (undo/confirm/reject)
          setPendingChange({
            code: forwardCode,
            undoCode: undoCode || '',
            description: cleanedText || 'Change applied',
            additions,
            deletions,
            source: 'code',
          });
        }
      }
    } catch (err) {
      console.error('[AI] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}`,
        timestamp: new Date(),
        model: selectedModel.name
      }]);
    } finally {
      // Always clean up streaming state, even on error
      setIsStreaming(false);
      setStreamingMessage(null);
      setAgentProcessing(false);
      // Note: Don't call cancelAI() here - it causes race conditions with tool approvals
      // The generating state is already managed by the stream completion callbacks
    }
  };

  // Calculate popup position for webview - bottom-right of element with smart edge detection
  const getPopupStyle = () => {
    const webview = webviewRefs.current.get(activeTabId);
    if (!selectedElement || !selectedElement.rect || !webview) return { display: 'none' };

    const webviewRect = webview.getBoundingClientRect();
    const buttonSize = 48; // Chat button size (matching w-12 h-12)
    const offset = 4; // Distance from element corner

    // Element position relative to viewport
    const elementRect = selectedElement.rect;
    const elementBottom = webviewRect.top + elementRect.top + elementRect.height;
    const elementRight = webviewRect.left + elementRect.left + elementRect.width;

    // Default: bottom-right
    let top = elementBottom + offset;
    let left = elementRight + offset;

    // Check if off-screen right
    if (left + buttonSize > window.innerWidth - 10) {
      // Position to the left instead
      left = webviewRect.left + elementRect.left - buttonSize - offset;
    }

    // Check if off-screen bottom
    if (top + buttonSize > window.innerHeight - 10) {
      // Position above instead
      top = webviewRect.top + elementRect.top - buttonSize - offset;
    }

    // Final clamp to ensure always visible
    left = Math.max(10, Math.min(left, window.innerWidth - buttonSize - 10));
    top = Math.max(10, Math.min(top, window.innerHeight - buttonSize - 10));

    return { top: `${top}px`, left: `${left}px` };
  };

  // Webview preload path state
  const [webviewPreloadPath, setWebviewPreloadPath] = useState<string>('');

  // Fetch webview preload path on mount
  useEffect(() => {
    if (isElectron && window.electronAPI?.getWebviewPreloadPath) {
      window.electronAPI.getWebviewPreloadPath().then(path => {
        console.log('Webview preload path:', path);
        setWebviewPreloadPath(path);
      });
    }
  }, [isElectron]);

  // Handle showing source code for selected element
  const handleShowSourceCode = useCallback(async () => {
    if (!selectedElement?.sourceLocation?.sources?.[0]) return;

    const src = selectedElement.sourceLocation.sources[0];
    let filePath = src.file;
    const startLine = src.line || 1;
    const endLine = src.endLine || startLine + 10;

    if (!filePath || !isElectron || !window.electronAPI?.files?.readFile) {
      console.log('Cannot read file:', { filePath, isElectron, hasFiles: !!window.electronAPI?.files });
      return;
    }

    // If path is relative and we have a project path, resolve it
    // Handle various path formats from bundlers:
    // - "./src/App.tsx" (explicit relative)
    // - "src/App.tsx" (implicit relative)
    // - "/src/App.tsx" (root-relative, common in Vite/bundlers)
    const isAbsolutePath = filePath.startsWith('/') && (
      filePath.startsWith('/Users/') ||
      filePath.startsWith('/home/') ||
      filePath.startsWith('/var/') ||
      filePath.startsWith('/tmp/')
    );

    if (!isAbsolutePath && activeTab.projectPath) {
      const cleanPath = filePath.replace(/^\.\//, '').replace(/^\//, '');
      filePath = `${activeTab.projectPath}/${cleanPath}`;
      console.log('Resolved relative path:', filePath);
    }

    try {
      const result = await window.electronAPI.files.readFile(filePath);
      if (result.success && result.data) {
        const lines = result.data.split('\n');
        // Get lines around the target (with some context)
        const contextBefore = 3;
        const contextAfter = 7;
        const actualStart = Math.max(1, startLine - contextBefore);
        const actualEnd = Math.min(lines.length, endLine + contextAfter);
        const codeLines = lines.slice(actualStart - 1, actualEnd);

        setDisplayedSourceCode({
          code: codeLines.join('\n'),
          fileName: filePath.split('/').pop() || 'unknown',
          startLine: actualStart,
          endLine: actualEnd
        });
      }
    } catch (error) {
      console.error('Failed to read source file:', error);
    }
  }, [selectedElement, isElectron, activeTab.projectPath]);

  const prepareDomPatch = useCallback((
    approvalId: string,
    element: SelectedElement,
    cssChanges: Record<string, string>,
    description: string,
    undoCode: string,
    applyCode: string,
    userRequest: string,
    projectPath?: string,
    textChange?: { oldText: string; newText: string },
    srcChange?: { oldSrc: string; newSrc: string }
  ) => {
    console.log('='.repeat(60));
    console.log('[DOM Approval] === PREPARING SOURCE PATCH ===');
    console.log('[DOM Approval] Inputs:', {
      approvalId,
      elementTag: element.tagName,
      cssChanges: Object.keys(cssChanges).length > 0 ? cssChanges : 'none',
      projectPath: projectPath || 'NOT SET',
      hasSourceLocation: !!element.sourceLocation,
      sourceFile: element.sourceLocation?.sources?.[0]?.file || 'NONE',
      sourceLine: element.sourceLocation?.sources?.[0]?.line || 'NONE',
      userRequest: userRequest?.substring(0, 50),
      hasSrcChange: !!srcChange,
    });
    console.log('='.repeat(60));
    // Use refs to get current values (prevents stale closures during async operations)
    const providerConfig = { modelId: selectedModelRef.current.id, providers: providerConfigsRef.current };
    generateSourcePatch({
      element,
      cssChanges,
      providerConfig,
      projectPath: projectPath || undefined,
      userRequest,
      textChange,
      srcChange,
    })
      .then(patch => {
        console.log('[DOM Approval] Patch generation completed:', { approvalId, success: !!patch });
        setPendingDOMApproval(prev => {
          if (!prev || prev.id !== approvalId) return prev;
          if (patch) {
            const patchPayload: PendingPatch = {
              id: `patch-${Date.now()}`,
              filePath: patch.filePath,
              originalContent: patch.originalContent,
              patchedContent: patch.patchedContent,
              description,
              elementSelector: element.xpath || undefined,
              cssChanges,
              undoCode,
              applyCode,
              generatedBy: patch.generatedBy,
              durationMs: patch.durationMs,
            };
            console.log('[DOM Approval] Patch ready:', { approvalId, filePath: patch.filePath, generatedBy: patch.generatedBy });
            return {
              ...prev,
              patchStatus: 'ready',
              patch: patchPayload,
              patchError: undefined,
            };
          }
          console.warn('[DOM Approval] Patch generation returned null:', approvalId);
          return { ...prev, patchStatus: 'error', patch: undefined, patchError: 'Could not generate source patch.' };
        });
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate source patch';
        console.error('[DOM Approval] Patch generation failed:', { approvalId, error: errorMessage });
        setPendingDOMApproval(prev => {
          if (!prev || prev.id !== approvalId) return prev;
          return { ...prev, patchStatus: 'error', patch: undefined, patchError: errorMessage };
        });
      });
  }, []); // No dependencies - using refs for current values

  // Handle accepting DOM preview - generates source patch and auto-approves
  const handleAcceptDOMApproval = useCallback(async () => {
    if (!pendingDOMApproval) return;

    console.log('[DOM Approval] Accept clicked:', {
      id: pendingDOMApproval.id,
      status: pendingDOMApproval.patchStatus,
      hasPatch: !!pendingDOMApproval.patch,
      userApproved: pendingDOMApproval.userApproved,
    });

    // If still preparing, mark as user-approved so it auto-applies when ready
    if (pendingDOMApproval.patchStatus === 'preparing') {
      console.log('[DOM Approval] Patch still preparing, marking as user-approved for auto-apply');
      setPendingDOMApproval(prev => prev ? { ...prev, userApproved: true } : null);
      return;
    }

    if (pendingDOMApproval.patchStatus === 'error' || !pendingDOMApproval.patch) {
      setMessages(prev => [...prev, {
        id: `msg-error-${Date.now()}`,
        role: 'assistant',
        content: pendingDOMApproval.patchError || 'Could not prepare a source patch for this change.',
        timestamp: new Date(),
      }]);
      setPendingDOMApproval(null);
      setPendingChange(null);
      return;
    }

    const patch = pendingDOMApproval.patch;
    setIsGeneratingSourcePatch(true);
    console.log('='.repeat(60));
    console.log('[DOM Approval] === USER APPROVED PATCH ===');
    console.log('[DOM Approval] Patch details:', {
      id: patch.id,
      filePath: patch.filePath,
      originalLength: patch.originalContent?.length || 0,
      patchedLength: patch.patchedContent?.length || 0,
      description: patch.description,
    });
    console.log('='.repeat(60));

    setMessages(prev => [...prev, {
      id: `msg-approved-${Date.now()}`,
      role: 'assistant',
      content: `Approved: ${pendingDOMApproval.description}. Updating source code...`,
      timestamp: new Date(),
      model: selectedModel.id,
      intent: 'ui_modify',
    }]);

    try {
      if (!window.electronAPI?.files?.writeFile) {
        console.log('[DOM Approval] ❌ ABORT: writeFile API not available');
        throw new Error('File API not available');
      }
      // Verify content actually changed
      const contentChanged = patch.originalContent !== patch.patchedContent;
      console.log('[DOM Approval] Content changed:', contentChanged);
      if (!contentChanged) {
        console.log('[DOM Approval] ⚠️ WARNING: Patch content is IDENTICAL to original!');
        console.log('[DOM Approval] This means the AI did not make any changes.');
      }
      console.log('[DOM Approval] Writing patch to disk:', patch.filePath);
      console.log('[DOM Approval] Original length:', patch.originalContent?.length || 0);
      console.log('[DOM Approval] Patched length:', patch.patchedContent?.length || 0);
      console.log('[DOM Approval] First 200 chars of patched content:', patch.patchedContent?.substring(0, 200));

      const result = await window.electronAPI.files.writeFile(patch.filePath, patch.patchedContent);
      console.log('[DOM Approval] writeFile result:', result);

      // Verify the write by reading it back
      if (result.success && window.electronAPI?.files?.readFile) {
        const verifyResult = await window.electronAPI.files.readFile(patch.filePath);
        if (verifyResult.success) {
          const matches = verifyResult.data === patch.patchedContent;
          console.log('[DOM Approval] Verification read-back:', matches ? '✅ MATCHES' : '❌ MISMATCH');
          if (!matches) {
            console.log('[DOM Approval] Expected length:', patch.patchedContent?.length);
            console.log('[DOM Approval] Actual length:', verifyResult.data?.length);
          }
        }
      }

      if (result.success) {
        console.log('[Source Patch] ✅ Applied successfully to:', patch.filePath);
        setMessages(prev => [...prev, {
          id: `msg-patch-${Date.now()}`,
          role: 'assistant',
          content: `Source code updated: ${patch.filePath.split('/').pop()}`,
          timestamp: new Date(),
        }]);
        addEditedFile({
          path: patch.filePath,
          additions: 1,
          deletions: 1,
          undoCode: patch.undoCode,
        });
      } else {
        throw new Error(result.error || 'Failed to save file');
      }
    } catch (e) {
      console.error('[Source Patch] Failed:', e);
      setMessages(prev => [...prev, {
        id: `msg-error-${Date.now()}`,
        role: 'assistant',
        content: `Failed to save: ${e instanceof Error ? e.message : 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    }

    setIsGeneratingSourcePatch(false);
    setPendingDOMApproval(null);
    setPendingChange(null); // Clear pill toolbar too
  }, [pendingDOMApproval, addEditedFile]);

  // Auto-apply when patch is ready and user has pre-approved
  useEffect(() => {
    if (pendingDOMApproval?.userApproved && pendingDOMApproval.patchStatus === 'ready' && pendingDOMApproval.patch) {
      console.log('[DOM Approval] Auto-applying: patch ready and user already approved');
      handleAcceptDOMApproval();
    }
  }, [pendingDOMApproval?.patchStatus, pendingDOMApproval?.userApproved, handleAcceptDOMApproval]);

  // Handle rejecting DOM preview - reverts changes
  const handleRejectDOMApproval = useCallback(() => {
    if (!pendingDOMApproval) return;

    const webview = webviewRefs.current.get(activeTabId);
    if (pendingDOMApproval.undoCode && webview) {
      (webview as Electron.WebviewTag).executeJavaScript(pendingDOMApproval.undoCode);
    }
    setPendingDOMApproval(null);
    setPendingChange(null); // Clear pill toolbar too
  }, [pendingDOMApproval, activeTabId]);

  // Handle opening a project from new tab page - triggers setup flow
  const handleOpenProject = useCallback(async (projectPath: string, projectName: string) => {
    console.log('Starting project setup flow:', projectPath, projectName);

    // Lock this window to the project (if not already locked)
    if (!lockedProjectPath && window.electronAPI?.window) {
      const lockResult = await window.electronAPI.window.lockProject(projectPath, projectName);
      if (lockResult.success) {
        setLockedProjectPath(projectPath);
        setLockedProjectName(projectName);
        console.log(`[Window] Locked to project: ${projectPath}`);
      } else if (lockResult.error?.includes('already open in another window')) {
        // Focus the other window instead
        if (lockResult.existingWindowId) {
          await window.electronAPI.window.focus(lockResult.existingWindowId);
        }
        return; // Don't open project in this window
      }
    }

    // Get saved port from recent projects
    const recent = getRecentProject(projectPath);
    setSetupProject({ path: projectPath, name: projectName, port: recent?.port });
  }, [lockedProjectPath]);

  // Handle setup flow completion - actually opens the browser
  const handleSetupComplete = useCallback((url: string, port: number) => {
    if (setupProject) {
      updateCurrentTab({ url, title: setupProject.name, projectPath: setupProject.path });
      // Save port to recent projects
      addToRecentProjects(setupProject.name, setupProject.path, port);
      // URL input is synced via useEffect when tab.url changes
      setSetupProject(null);
    }
  }, [setupProject, updateCurrentTab]);

  // Handle setup flow cancel - go back to new tab page
  const handleSetupCancel = useCallback(() => {
    setSetupProject(null);
  }, []);

  // Handle opening a URL from new tab page
  const handleOpenUrl = useCallback((url: string) => {
    updateCurrentTab({ url, title: new URL(url).hostname });
    // URL input is synced via useEffect when tab.url changes
  }, [updateCurrentTab]);

  // Patch Approval Handlers
  const handleApprovePatch = useCallback((patch: SourcePatch) => {
    console.log('[PatchApproval] Approved patch:', patch.filePath);
    // Move to next patch
    const nextIndex = currentPatchIndex + 1;
    if (nextIndex < pendingPatches.length) {
      setCurrentPatchIndex(nextIndex);
    } else {
      // All patches approved
      setPendingPatches([]);
      setCurrentPatchIndex(0);
      setIsApprovalDialogOpen(false);
    }
  }, [currentPatchIndex, pendingPatches.length]);

  const handleRejectPatch = useCallback((patch: SourcePatch) => {
    console.log('[PatchApproval] Rejected patch:', patch.filePath);
    // Remove rejected patch and move to next
    const updatedPatches = pendingPatches.filter((_, i) => i !== currentPatchIndex);
    setPendingPatches(updatedPatches);
    if (updatedPatches.length > 0) {
      setCurrentPatchIndex(Math.min(currentPatchIndex, updatedPatches.length - 1));
    } else {
      setCurrentPatchIndex(0);
      setIsApprovalDialogOpen(false);
    }
  }, [currentPatchIndex, pendingPatches]);

  const handleEditPatch = useCallback((patch: SourcePatch) => {
    console.log('[PatchApproval] Edit requested for patch:', patch.filePath);
    // TODO: Open editor with patch content
    // For now, just close the dialog
    setIsApprovalDialogOpen(false);
  }, []);

  // Function to show patch approval dialog with patches
  const showPatchApprovalDialog = useCallback((patches: SourcePatch[]) => {
    setPendingPatches(patches);
    setCurrentPatchIndex(0);
    setIsApprovalDialogOpen(true);
  }, []);

  // Check if current tab is "new tab" (no URL)
  const isNewTabPage = !activeTab.url;

  // Background color - MUST match title bar. This is THE source of truth.
  const appBgColor = themeColors?.background || (isDarkMode ? '#171717' : '#d6d3d1');

  return (
    <div
      className={`flex flex-col h-screen w-full overflow-hidden font-sans ${isDarkMode ? 'dark text-neutral-100' : 'text-neutral-900'}`}
      style={{ backgroundColor: appBgColor }}
    >

      {/* Tab Bar - at the very top with traffic light area */}
      <TabBar
        tabs={tabBarTabs}
        activeTabId={activeTabId}
        onTabSelect={handleSelectTab}
        onTabClose={handleCloseTab}
        onNewTab={handleNewTab}
        onReorderTabs={handleReorderTabs}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
        fastApplyReady={fastApplyReady}
        fileWatcherActive={fileWatcherActive}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden pt-1 pb-2 px-2 gap-1">

        {/* --- Left Pane: Browser, New Tab Page, Kanban, Todos, Notes, or Project Setup --- */}
        {setupProject ? (
          <div
            className="flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border"
            style={{ backgroundColor: panelBg, borderColor: panelBorder }}
          >
            <ProjectSetupFlow
              projectPath={setupProject.path}
              projectName={setupProject.name}
              initialPort={setupProject.port}
              isDarkMode={isDarkMode}
              onComplete={handleSetupComplete}
              onCancel={handleSetupCancel}
            />
          </div>
        ) : activeTab.type === 'kanban' ? (
          <div
            className="flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border"
            style={{ backgroundColor: panelBg, borderColor: panelBorder }}
          >
            <KanbanTab
              columns={activeTab.kanbanData?.columns || []}
              boardTitle={activeTab.kanbanData?.boardTitle || 'New Board'}
              isDarkMode={isDarkMode}
              onUpdateColumns={handleUpdateKanbanColumns}
              onUpdateTitle={handleUpdateKanbanTitle}
            />
          </div>
        ) : activeTab.type === 'todos' ? (
          <div
            className="flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border"
            style={{ backgroundColor: panelBg, borderColor: panelBorder }}
          >
            <TodosTab
              items={activeTab.todosData?.items || []}
              isDarkMode={isDarkMode}
              onUpdateItems={handleUpdateTodoItems}
            />
          </div>
        ) : activeTab.type === 'notes' ? (
          <div
            className="flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border"
            style={{ backgroundColor: panelBg, borderColor: panelBorder }}
          >
            <NotesTab
              content={activeTab.notesData?.content || ''}
              isDarkMode={isDarkMode}
              onUpdateContent={handleUpdateNotesContent}
            />
          </div>
        ) : isNewTabPage ? (
          <div
            className="flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border"
            style={{ backgroundColor: panelBg, borderColor: panelBorder }}
          >
            <NewTabPage
              onOpenProject={handleOpenProject}
              onOpenUrl={handleOpenUrl}
              isDarkMode={isDarkMode}
              lockedProjectPath={lockedProjectPath}
            />
          </div>
        ) : (
          <div
            className="flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border"
            style={{ backgroundColor: panelBg, borderColor: panelBorder }}
          >

            {/* Browser Toolbar */}
            <div
              className="h-12 border-b flex items-center gap-2 px-3 flex-shrink-0"
              style={{ borderColor: panelBorder, backgroundColor: headerBg }}
            >
          {/* Navigation Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={goBack}
              disabled={!canGoBack}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${canGoBack ? (isDarkMode ? 'hover:bg-neutral-700 text-neutral-300' : 'hover:bg-stone-200 text-stone-600') : (isDarkMode ? 'text-neutral-600 cursor-not-allowed' : 'text-stone-300 cursor-not-allowed')}`}
              title="Back"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goForward}
              disabled={!canGoForward}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${canGoForward ? (isDarkMode ? 'hover:bg-neutral-700 text-neutral-300' : 'hover:bg-stone-200 text-stone-600') : (isDarkMode ? 'text-neutral-600 cursor-not-allowed' : 'text-stone-300 cursor-not-allowed')}`}
              title="Forward"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={reload}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-300' : 'hover:bg-stone-200 text-stone-600'}`}
              title="Reload"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
            </button>
          </div>

          {/* Viewport Switcher - Desktop, Tablet, Mobile */}
          <div className={`flex items-center rounded-lg p-0.5 ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-100'}`}>
            <button
              onClick={() => setViewportSize('desktop')}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewportSize === 'desktop' ? (isDarkMode ? 'bg-neutral-600 text-white' : 'bg-white text-stone-900 shadow-sm') : (isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-stone-400 hover:text-stone-600')}`}
              title="Desktop view"
            >
              <Monitor size={14} />
            </button>
            <button
              onClick={() => setViewportSize('tablet')}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewportSize === 'tablet' ? (isDarkMode ? 'bg-neutral-600 text-white' : 'bg-white text-stone-900 shadow-sm') : (isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-stone-400 hover:text-stone-600')}`}
              title="Tablet view (768px)"
            >
              <Tablet size={14} />
            </button>
            <button
              onClick={() => setViewportSize('mobile')}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewportSize === 'mobile' ? (isDarkMode ? 'bg-neutral-600 text-white' : 'bg-white text-stone-900 shadow-sm') : (isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-stone-400 hover:text-stone-600')}`}
              title="Mobile view (375px)"
            >
              <Smartphone size={14} />
            </button>
          </div>

          {/* URL Bar */}
          <form onSubmit={handleUrlSubmit} className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => !activeTab.projectPath && setUrlInput(e.target.value)}
                readOnly={!!activeTab.projectPath}
                className={`w-full h-8 px-3 pr-8 text-sm rounded-full focus:outline-none ${
                  activeTab.projectPath
                    ? `cursor-default ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-400' : 'bg-stone-100 border-stone-200 text-stone-500'}`
                    : `focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100 placeholder-neutral-400' : 'bg-white border border-stone-200'}`
                }`}
                placeholder="Enter URL..."
                title={activeTab.projectPath ? `Locked to project: ${activeTab.projectPath}` : 'Enter URL...'}
              />
              {isLoading && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </form>

          {/* Inspector Toggle */}
          <button
            onClick={() => {
              setIsInspectorActive(!isInspectorActive);
              setIsScreenshotActive(false);
              setIsMoveActive(false);
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isInspectorActive ? 'bg-blue-100 text-blue-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500')}`}
            title="Element Inspector"
          >
            <MousePointer2 size={16} />
          </button>

          {/* Move Mode Toggle - can work alongside screenshot */}
          <button
            onClick={() => {
              setIsMoveActive(!isMoveActive);
              setIsInspectorActive(false);
              // DON'T disable screenshot mode - they work together
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isMoveActive ? 'bg-orange-100 text-orange-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500')}`}
            title="Move & Resize Element"
          >
            <Move size={16} />
          </button>

          {/* DevTools Toggle */}
          <button
            onClick={() => {
              const webview = webviewRefs.current.get(activeTabId);
              if (webview) {
                webview.openDevTools();
              }
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'}`}
            title="Open Webview DevTools"
          >
            <Code2 size={16} />
          </button>

          {/* Console Toggle */}
          <button
            onClick={() => setIsConsolePanelOpen(!isConsolePanelOpen)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isConsolePanelOpen ? 'bg-blue-100 text-blue-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500')}`}
            title="Toggle Console"
          >
            <Terminal size={16} />
          </button>

          {/* Sidebar Toggle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'}`}
            title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <PanelRight size={16} />
          </button>

        </div>

        {/* Browser Content */}
        <div data-browser-content className={`flex-1 relative overflow-hidden flex flex-col ${isConsolePanelOpen ? '' : ''}`}>
          <div className={`flex-1 relative overflow-hidden flex flex-col justify-center items-center ${viewportSize === 'desktop' ? '' : 'py-4 gap-3'} ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-200'}`}>

            {/* Device Selector & Zoom - only show in mobile/tablet mode */}
            {viewportSize !== 'desktop' && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Device Selector */}
                <div className="relative">
                  <button
                    onClick={() => { setIsDeviceSelectorOpen(!isDeviceSelectorOpen); setIsZoomSelectorOpen(false); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      isDarkMode
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                        : 'bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 shadow-sm'
                    }`}
                  >
                    {viewportSize === 'mobile' ? <Smartphone size={14} /> : <Tablet size={14} />}
                    <span>{isCustomDevice ? 'Custom' : (selectedDevice?.name || (viewportSize === 'mobile' ? 'iPhone SE' : 'iPad Mini'))}</span>
                    <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                      {currentWidth} × {currentHeight}
                    </span>
                    <ChevronDown size={14} className={`transition-transform ${isDeviceSelectorOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Device Dropdown */}
                  {isDeviceSelectorOpen && (
                    <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl shadow-xl z-50 ${
                      isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-stone-200'
                    }`}>
                      {/* Mobile devices */}
                      <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                        Mobile
                      </div>
                      {devicePresets.filter(d => d.type === 'mobile').map(device => (
                        <button
                          key={device.name}
                          onClick={() => handleDeviceSelect(device)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                            selectedDevice?.name === device.name
                              ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                              : isDarkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-stone-50 text-stone-700'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Smartphone size={14} />
                            {device.name}
                          </span>
                          <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                            {device.width} × {device.height}
                          </span>
                        </button>
                      ))}

                      {/* Tablet devices */}
                      <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-t ${isDarkMode ? 'text-neutral-500 border-neutral-700' : 'text-stone-400 border-stone-100'}`}>
                        Tablet
                      </div>
                      {devicePresets.filter(d => d.type === 'tablet').map(device => (
                        <button
                          key={device.name}
                          onClick={() => handleDeviceSelect(device)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                            selectedDevice?.name === device.name
                              ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                              : isDarkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-stone-50 text-stone-700'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Tablet size={14} />
                            {device.name}
                          </span>
                          <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                            {device.width} × {device.height}
                          </span>
                        </button>
                      ))}

                      {/* Custom option */}
                      <div className={`border-t ${isDarkMode ? 'border-neutral-700' : 'border-stone-100'}`}>
                        <button
                          onClick={handleCustomDevice}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                            isCustomDevice
                              ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                              : isDarkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-stone-50 text-stone-700'
                          }`}
                        >
                          <Settings size={14} />
                          Custom Size
                        </button>
                        {isCustomDevice && (
                          <div className={`flex items-center gap-2 px-3 py-2 ${isDarkMode ? 'bg-neutral-900/50' : 'bg-stone-50'}`}>
                            <input
                              type="number"
                              value={customWidth}
                              onChange={(e) => setCustomWidth(parseInt(e.target.value) || 375)}
                              className={`w-20 px-2 py-1 text-sm rounded-lg text-center ${
                                isDarkMode
                                  ? 'bg-neutral-700 border-neutral-600 text-neutral-200'
                                  : 'bg-white border-stone-200 text-stone-700'
                              } border focus:outline-none focus:ring-2 focus:ring-blue-500/30`}
                              placeholder="Width"
                            />
                            <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>×</span>
                            <input
                              type="number"
                              value={customHeight}
                              onChange={(e) => setCustomHeight(parseInt(e.target.value) || 667)}
                              className={`w-20 px-2 py-1 text-sm rounded-lg text-center ${
                                isDarkMode
                                  ? 'bg-neutral-700 border-neutral-600 text-neutral-200'
                                  : 'bg-white border-stone-200 text-stone-700'
                              } border focus:outline-none focus:ring-2 focus:ring-blue-500/30`}
                              placeholder="Height"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Zoom Selector */}
                <div className="relative">
                  <button
                    onClick={() => { setIsZoomSelectorOpen(!isZoomSelectorOpen); setIsDeviceSelectorOpen(false); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                      isDarkMode
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                        : 'bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 shadow-sm'
                    }`}
                  >
                    <span>{zoomOptions.find(z => z.value === zoomLevel)?.label}</span>
                    <ChevronDown size={14} className={`transition-transform ${isZoomSelectorOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Zoom Dropdown */}
                  {isZoomSelectorOpen && (
                    <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-24 rounded-xl shadow-xl z-50 overflow-hidden ${
                      isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-stone-200'
                    }`}>
                      {zoomOptions.map(option => (
                        <button
                          key={option.value}
                          onClick={() => { setZoomLevel(option.value); setIsZoomSelectorOpen(false); }}
                          className={`w-full px-3 py-2 text-sm text-center transition-colors ${
                            zoomLevel === option.value
                              ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                              : isDarkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-stone-50 text-stone-700'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isElectron && webviewPreloadPath ? (
              /* Render a webview for each tab - only active one is visible */
              <>
                {tabs.filter(tab => tab.url).map(tab => (
                  <div
                    key={tab.id}
                    className={`transition-all duration-300 origin-center ${
                      viewportSize === 'desktop'
                        ? 'w-full h-full'
                        : 'rounded-3xl shadow-2xl ring-4 ring-neutral-700 overflow-hidden flex-shrink-0'
                    }`}
                    style={{
                      ...(viewportSize === 'desktop' ? {} : (
                        zoomLevel === 'fit' ? {
                          aspectRatio: `${currentWidth} / ${currentHeight}`,
                          maxWidth: 'calc(100% - 48px)',
                          maxHeight: 'calc(100% - 80px)',
                          width: 'auto',
                          height: '100%'
                        } : {
                          width: `${currentWidth}px`,
                          height: `${currentHeight}px`,
                          transform: `scale(${parseInt(zoomLevel) / 100})`,
                          transformOrigin: 'center center'
                        }
                      )),
                      // Show only active tab's webview, but keep others in DOM
                      display: tab.id === activeTabId ? 'block' : 'none',
                      position: tab.id === activeTabId ? 'relative' : 'absolute',
                    }}
                  >
                    <webview
                      ref={getWebviewRefCallback(tab.id)}
                      src={tab.url || 'about:blank'}
                      preload={`file://${webviewPreloadPath}`}
                      className="w-full h-full"
                      style={viewportSize === 'desktop' ? {
                        width: '100%'
                      } : undefined}
                      // @ts-expect-error - webview is an Electron-specific element
                      allowpopups="true"
                      nodeintegration="true"
                      webpreferences="contextIsolation=no"
                    />
                  </div>
                ))}
              </>
          ) : isElectron ? (
            <div className={`w-full h-full flex items-center justify-center ${isDarkMode ? 'bg-neutral-800' : 'bg-stone-50'}`}>
              <div className={`w-8 h-8 border-2 rounded-full animate-spin ${isDarkMode ? 'border-neutral-600 border-t-neutral-400' : 'border-stone-300 border-t-stone-600'}`}></div>
            </div>
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${isDarkMode ? 'bg-neutral-800' : 'bg-stone-50'}`}>
              <div className="text-center p-8">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-200'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={isDarkMode ? 'text-neutral-500' : 'text-stone-400'}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                </div>
                <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-neutral-200' : 'text-stone-700'}`}>Browser Preview</h3>
                <p className={`text-sm max-w-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                  Run this app in Electron to browse localhost projects with the inspector.
                </p>
              </div>
            </div>
          )}

            {/* Floating Toolbar when sidebar collapsed */}
            {!isSidebarOpen && (
                <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-1 backdrop-blur shadow-2xl p-2 rounded-full z-40 ${isDarkMode ? 'bg-neutral-800/90 border border-neutral-700/50' : 'bg-white/90 border border-stone-200/50'}`}>
                    <button
                        onClick={() => setIsScreenSharing(!isScreenSharing)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-green-100 text-green-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500')}`}
                        title="Toggle Screen Share"
                    >
                        <Monitor size={16} />
                    </button>

                    <button
                        onClick={() => {
                            setIsInspectorActive(!isInspectorActive);
                            setIsScreenshotActive(false);
                            setIsMoveActive(false);
                        }}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isInspectorActive ? 'bg-blue-100 text-blue-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500')}`}
                        title="Toggle Element Inspector"
                    >
                        <MousePointer2 size={16} />
                    </button>

                    <button
                        onClick={() => {
                            setIsMoveActive(!isMoveActive);
                            setIsInspectorActive(false);
                            // DON'T disable screenshot mode - they work together
                        }}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isMoveActive ? 'bg-orange-100 text-orange-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500')}`}
                        title="Move & Resize Element"
                    >
                        <Move size={16} />
                    </button>

                    <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>

                    <button
                        onClick={streamState.isConnected ? disconnect : connect}
                        className={`flex items-center justify-center w-9 h-9 rounded-full font-medium transition-all ${streamState.isConnected ? 'bg-red-50 text-red-600 ring-1 ring-red-100' : (isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-800')}`}
                        title={streamState.isConnected ? 'End voice session' : 'Start voice session'}
                    >
                        {streamState.isConnected ? (
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                        ) : (
                            <Mic size={16} />
                        )}
                    </button>
                </div>
            )}

            {/* Element Info Label - shows during inspector hover */}
            {(isInspectorActive || isScreenshotActive || isMoveActive) && hoveredElement && (
              <div
                className="fixed z-[60] pointer-events-none"
                style={{
                  top: Math.max(8, (webviewRefs.current.get(activeTabId)?.getBoundingClientRect().top || 0) + hoveredElement.rect.top - 32),
                  left: Math.max(8, (webviewRefs.current.get(activeTabId)?.getBoundingClientRect().left || 0) + hoveredElement.rect.left),
                }}
              >
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono shadow-lg ${
                    isScreenshotActive
                      ? 'bg-purple-600 text-white'
                      : isMoveActive
                        ? 'bg-orange-500 text-white'
                        : 'bg-blue-600 text-white'
                  }`}
                  style={{
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  <span className="font-semibold">{hoveredElement.element.tagName?.toLowerCase()}</span>
                  {hoveredElement.element.id && (
                    <span className="opacity-80">#{hoveredElement.element.id}</span>
                  )}
                  {hoveredElement.element.className && (
                    <span className="opacity-60 max-w-[200px] truncate">.{hoveredElement.element.className.split(' ')[0]}</span>
                  )}
                  <span className="opacity-50 text-[10px] ml-1">
                    {Math.round(hoveredElement.rect.width)}×{Math.round(hoveredElement.rect.height)}
                  </span>
                </div>
              </div>
            )}

            {/* Popup Chat Button/Input when element selected and sidebar collapsed */}
            {!isSidebarOpen && selectedElement && (
                <div
                    className="absolute z-50 group"
                    style={getPopupStyle()}
                    onMouseLeave={() => setShowElementChat(false)}
                >
                    {/* Always-visible chat icon bubble - semi-transparent, fully rounded */}
                    <button
                        onClick={() => setShowElementChat(!showElementChat)}
                        className="w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all text-white"
                        style={{
                            background: 'rgba(59, 130, 246, 0.8)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.3) inset'
                        }}
                        title="Chat about this element (hover to type)"
                    >
                        <MessageCircle size={20} />
                    </button>

                    {/* Hidden chat controls - show on hover */}
                    {showElementChat && (
                        <div
                            className={`absolute top-0 left-14 rounded-3xl shadow-2xl w-80 p-3 transition-all ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-stone-200'}`}
                        >
                            <div className={`flex flex-col gap-2 mb-2`}>
                                <div className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                                    <div className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-medium">
                                        {selectedElement.tagName}
                                    </div>
                                    <span className="truncate max-w-[150px]">{selectedElement.text}</span>
                                    <div className="flex-1"></div>
                                    <button onClick={() => {
                                        setShowElementChat(false);
                                        setSelectedElement(null);
                                        // Clear canvas indicators
                                        const webview = webviewRefs.current.get(activeTabId);
                                        webview?.send('clear-selection');
                                    }} className={isDarkMode ? 'hover:text-neutral-200' : 'hover:text-stone-900'}>
                                        <X size={14} />
                                    </button>
                                </div>
                                {selectedElement.sourceLocation && (
                                    <div className={`text-xs font-mono ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                                        {selectedElement.sourceLocation.summary}
                                    </div>
                                )}
                            </div>

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    processPrompt(popupInput);
                                    setPopupInput('');
                                    setShowElementChat(false);
                                }}
                            >
                                <textarea
                                    value={popupInput}
                                    onChange={(e) => setPopupInput(e.target.value)}
                                    placeholder="What would you like to change?"
                                    className={`w-full text-sm p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100 placeholder-neutral-400' : 'bg-stone-50 border-stone-200'}`}
                                    rows={2}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            processPrompt(popupInput);
                                            setPopupInput('');
                                            setShowElementChat(false);
                                        }
                                        if (e.key === 'Escape') {
                                            setShowElementChat(false);
                                        }
                                    }}
                                />
                                <div className="flex justify-end mt-2">
                                    <button type="submit" disabled={!popupInput.trim()} className={`w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-50 ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-700'}`}>
                                        <ArrowUp size={14} />
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}
          </div>

          {/* Resize overlay - captures mouse events during console resize */}
          {isConsoleResizing && (
            <div className="fixed inset-0 z-50 cursor-ns-resize" />
          )}

          {/* Console Panel */}
          {isConsolePanelOpen && (
            <div className={`flex flex-col overflow-hidden ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-50'}`} style={{ height: consoleHeight }}>
              {/* Resize Handle */}
              <div
                className={`h-2 cursor-ns-resize flex-shrink-0 flex items-center justify-center group ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-50'}`}
                onMouseDown={handleConsoleResizeStart}
              >
                <div className={`w-8 h-0.5 rounded-full transition-colors ${isConsoleResizing ? (isDarkMode ? 'bg-neutral-400' : 'bg-stone-500') : (isDarkMode ? 'bg-neutral-600 group-hover:bg-neutral-500' : 'bg-stone-300 group-hover:bg-stone-400')}`} />
              </div>
              <div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`}>
                <div className="flex items-center gap-1.5" style={{ position: 'relative', top: '-3px' }}>
                  {/* Console label - click to clear filters */}
                  <button
                    onClick={clearConsoleFilters}
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-full transition-colors ${
                      consoleFilters.size === 0
                        ? (isDarkMode ? 'bg-neutral-600 text-neutral-200' : 'bg-stone-300 text-stone-700')
                        : (isDarkMode ? 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600' : 'bg-stone-200 text-stone-500 hover:bg-stone-300')
                    }`}
                    title="Show all logs"
                  >
                    <Terminal size={14} />
                    <span className="text-xs font-medium">Console</span>
                    <span className="text-xs opacity-70">{filteredConsoleLogs.length}</span>
                  </button>

                  {/* Filter chips */}
                  <button
                    onClick={() => toggleConsoleFilter('log')}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      consoleFilters.has('log')
                        ? (isDarkMode ? 'bg-neutral-500 text-white' : 'bg-stone-500 text-white')
                        : (isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200')
                    }`}
                    title="Filter by log"
                  >
                    log
                  </button>
                  <button
                    onClick={() => toggleConsoleFilter('info')}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      consoleFilters.has('info')
                        ? 'bg-blue-500 text-white'
                        : (isDarkMode ? 'bg-neutral-800 text-blue-400 hover:bg-neutral-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')
                    }`}
                    title="Filter by info"
                  >
                    info
                  </button>
                  <button
                    onClick={() => toggleConsoleFilter('warn')}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      consoleFilters.has('warn')
                        ? 'bg-yellow-500 text-white'
                        : (isDarkMode ? 'bg-neutral-800 text-yellow-400 hover:bg-neutral-700' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100')
                    }`}
                    title="Filter by warn"
                  >
                    warn
                  </button>
                  <button
                    onClick={() => toggleConsoleFilter('error')}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      consoleFilters.has('error')
                        ? 'bg-red-500 text-white'
                        : (isDarkMode ? 'bg-neutral-800 text-red-400 hover:bg-neutral-700' : 'bg-red-50 text-red-600 hover:bg-red-100')
                    }`}
                    title="Filter by error"
                  >
                    error
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  {selectedLogIndices.size > 0 && (
                    <>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                        {selectedLogIndices.size} selected
                      </span>
                      {/* Quick Actions for selected logs */}
                      <div className="flex items-center gap-0.5 ml-1">
                        <button
                          onClick={() => {
                            const logsText = selectedLogs?.map(l => l.message).join('\n') || '';
                            // Trigger instant web search
                            performInstantSearch(logsText);
                          }}
                          className={`p-1.5 rounded transition-colors ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-200 text-stone-500 hover:text-stone-700'}`}
                          title="Search for solutions (⌘G)"
                        >
                          <Search size={14} />
                        </button>
                        <button
                          onClick={() => {
                            const logsText = selectedLogs?.map(l => `[${l.type}] ${l.message}`).join('\n') || '';
                            navigator.clipboard.writeText(logsText);
                          }}
                          className={`p-1.5 rounded transition-colors ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-200 text-stone-500 hover:text-stone-700'}`}
                          title="Copy (⌘C)"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => setSelectedLogIndices(new Set())}
                          className={`p-1.5 rounded transition-colors ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-200 text-stone-500 hover:text-stone-700'}`}
                          title="Clear selection (Esc)"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </>
                  )}
                  <button
                    onClick={handleClearConsole}
                    className={`p-1 rounded hover:bg-opacity-80 transition ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'}`}
                    title="Clear console"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                  </button>
                  <button
                    onClick={() => setIsConsolePanelOpen(false)}
                    className={`p-1 rounded hover:bg-opacity-80 transition ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'}`}
                    title="Close console"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className={`flex-1 overflow-y-auto font-mono text-xs p-2 space-y-0.5 ${isDarkMode ? 'text-neutral-300' : 'text-stone-700'}`}>
                {filteredConsoleLogs.length === 0 ? (
                  <div className={`text-center py-8 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                    {consoleLogs.length === 0 ? 'No console messages yet' : 'No logs match current filters'}
                  </div>
                ) : (
                  filteredConsoleLogs.map((log, index) => (
                    <div
                      key={index}
                      onClick={(e) => handleLogRowClick(index, e)}
                      className={`flex items-start gap-2 px-2 py-0.5 rounded cursor-pointer select-none transition-colors ${
                        selectedLogIndices.has(index)
                          ? (isDarkMode ? 'bg-blue-500/20 ring-1 ring-blue-500/50' : 'bg-blue-100 ring-1 ring-blue-300')
                          : log.type === 'error' ? (isDarkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100')
                          : log.type === 'warn' ? (isDarkMode ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100')
                          : log.type === 'info' ? (isDarkMode ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')
                          : (isDarkMode ? 'hover:bg-neutral-700' : 'hover:bg-stone-100')
                      }`}
                      title="Click to select, Shift+click for range"
                    >
                      <span className={`flex-shrink-0 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="flex-shrink-0 w-12 text-center">
                        [{log.type}]
                      </span>
                      <span className="break-all flex-1">{log.message}</span>
                      <span
                        className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          selectedLogIndices.has(index)
                            ? (isDarkMode ? 'bg-blue-500 border-blue-500' : 'bg-blue-500 border-blue-500')
                            : (isDarkMode ? 'border-neutral-500 hover:border-neutral-400' : 'border-stone-300 hover:border-stone-400')
                        }`}
                      >
                        {selectedLogIndices.has(index) && (
                          <Check size={10} className="text-white" />
                        )}
                      </span>
                    </div>
                  ))
                )}
                <div ref={consoleEndRef} />
              </div>
            </div>
          )}

          {/* Search Results Popover */}
          {showSearchPopover && (
            <div 
              className={`absolute bottom-full left-0 right-0 mb-2 mx-2 rounded-xl border shadow-xl overflow-hidden z-50 ${
                isDarkMode ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-stone-200'
              }`}
              style={{ maxHeight: '300px' }}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-3 py-2 border-b ${isDarkMode ? 'border-neutral-700' : 'border-stone-100'}`}>
                <div className="flex items-center gap-2">
                  <Globe size={14} className={isDarkMode ? 'text-blue-400' : 'text-blue-500'} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-700'}`}>
                    {isFileSearching ? 'Searching...' : `${searchResults?.length || 0} Results`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {searchResults && searchResults.length > 0 && (
                    <button
                      onClick={attachSearchResults}
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors ${
                        isDarkMode 
                          ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' 
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                      title="Send to chat"
                    >
                      <Send size={12} />
                      Add to Chat
                    </button>
                  )}
                  <button
                    onClick={() => setShowSearchPopover(false)}
                    className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              
              {/* Results */}
              <div className="overflow-y-auto" style={{ maxHeight: '240px' }}>
                {isFileSearching ? (
                  <div className={`flex items-center justify-center py-8 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                    <Loader2 size={20} className="animate-spin mr-2" />
                    <span className="text-sm">Searching the web...</span>
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  <div className="divide-y divide-stone-100 dark:divide-neutral-700">
                    {searchResults.map((result, idx) => (
                      <a
                        key={idx}
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block px-3 py-2 transition-colors ${
                          isDarkMode ? 'hover:bg-neutral-700' : 'hover:bg-stone-50'
                        }`}
                      >
                        <div className={`text-sm font-medium truncate ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          {result.title}
                        </div>
                        <div className={`text-xs truncate mt-0.5 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                          {result.url}
                        </div>
                        {result.snippet && (
                          <div className={`text-xs mt-1 line-clamp-2 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                            {result.snippet}
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                ) : searchResults && searchResults.length === 0 ? (
                  <div className={`text-center py-8 text-sm ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                    No results found
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
        </div>
        )}

        {/* Resize overlay - captures mouse events during sidebar resize */}
        {isResizing && (
          <div className="fixed inset-0 z-50 cursor-ew-resize" />
        )}

        {/* Resize Handle */}
        {isSidebarOpen && (
          <div
            className={`w-1 cursor-ew-resize z-10 transition-colors flex-shrink-0 ${isResizing ? (isDarkMode ? 'bg-neutral-500' : 'bg-stone-400') : (isDarkMode ? 'hover:bg-neutral-600' : 'hover:bg-stone-300')}`}
            onMouseDown={handleResizeStart}
          />
        )}

        {/* --- Right Pane: Chat --- */}
      {isSidebarOpen && (
      <div
        className="flex flex-col rounded-xl shadow-sm flex-shrink-0 border"
        style={{ width: sidebarWidth, minWidth: 430, backgroundColor: panelBg, borderColor: panelBorder }}
      >

          {/* Git Header */}
          <div className="h-12 border-b flex items-center justify-between px-3 flex-shrink-0" style={{ borderColor: panelBorder }}>
              <div className="flex items-center gap-2">
                  {/* Branch Selector */}
                  <div className="relative">
                      <button
                          onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
                          className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded transition ${isDarkMode ? 'text-neutral-300 hover:bg-neutral-700' : 'text-stone-600 hover:bg-stone-100'}`}
                      >
                          <GitBranch size={14} />
                          <span>{git.currentBranch}</span>
                      </button>

                      {isBranchMenuOpen && (
                          <>
                              <div className="fixed inset-0 z-10" onClick={() => { setIsBranchMenuOpen(false); setIsCreatingBranch(false); }}></div>
                              <div className={`absolute top-full left-0 mt-1 w-56 rounded-xl shadow-xl py-1 z-50 max-h-64 overflow-y-auto ${isDarkMode ? 'bg-neutral-700 border border-neutral-600' : 'bg-white border border-stone-200'}`}>
                                  {isCreatingBranch ? (
                                      <div className="p-2">
                                          <input
                                              type="text"
                                              value={newBranchName}
                                              onChange={(e) => setNewBranchName(e.target.value)}
                                              placeholder="New branch name..."
                                              className={`w-full text-sm px-2 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isDarkMode ? 'bg-neutral-600 border border-neutral-500 text-neutral-100 placeholder-neutral-400' : 'border border-stone-200'}`}
                                              autoFocus
                                              onKeyDown={async (e) => {
                                                  if (e.key === 'Enter' && newBranchName.trim()) {
                                                      await git.createBranch(newBranchName.trim());
                                                      setNewBranchName('');
                                                      setIsCreatingBranch(false);
                                                      setIsBranchMenuOpen(false);
                                                  }
                                                  if (e.key === 'Escape') {
                                                      setIsCreatingBranch(false);
                                                  }
                                              }}
                                          />
                                      </div>
                                  ) : (
                                      <>
                                          {git.branches.filter(b => !b.startsWith('remotes/')).map(branch => (
                                              <button
                                                  key={branch}
                                                  onClick={async () => {
                                                      await git.checkout(branch);
                                                      setIsBranchMenuOpen(false);
                                                  }}
                                                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-200' : 'hover:bg-stone-50'}`}
                                              >
                                                  {branch === git.currentBranch && (
                                                      <Check size={12} className="text-green-600" />
                                                  )}
                                                  <span className={branch === git.currentBranch ? 'font-medium' : ''}>{branch}</span>
                                              </button>
                                          ))}
                                      </>
                                  )}
                              </div>
                          </>
                      )}
                  </div>

                  {/* New Branch */}
                  <button
                      onClick={() => { setIsBranchMenuOpen(true); setIsCreatingBranch(true); }}
                      className={`p-1 rounded transition ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-600'}`}
                      title="New branch"
                  >
                      <Plus size={14} />
                  </button>
              </div>

              {/* Commit Message */}
              <div className="flex-1 mx-3">
                  <input
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="Message (⌘⏎ to commit)"
                      className={`w-full text-xs px-3 py-1.5 rounded-3xl focus:outline-none ${isDarkMode ? 'bg-neutral-800/60 text-neutral-300 placeholder-neutral-600 focus:bg-neutral-800' : 'bg-stone-50 border border-stone-200 text-stone-600 placeholder-stone-400 focus:ring-1 focus:ring-stone-300'}`}
                      onKeyDown={async (e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && commitMessage.trim()) {
                              setGitLoading('commit');
                              await git.commit(commitMessage.trim());
                              setCommitMessage('');
                              setGitLoading(null);
                          }
                      }}
                  />
              </div>

              {/* Git Actions */}
              <div className="flex items-center gap-1">
                  {/* Stash */}
                  <button
                      onClick={() => setIsStashDialogOpen(true)}
                      className={`p-1.5 rounded transition ${gitLoading === 'stash' ? 'animate-pulse' : ''} ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-600'}`}
                      title="Stash changes"
                      disabled={!git.hasChanges}
                  >
                      <Archive size={14} />
                  </button>

                  {/* Pull */}
                  <button
                      onClick={async () => {
                          setGitLoading('pull');
                          await git.pull();
                          setGitLoading(null);
                      }}
                      className={`p-1.5 rounded transition ${gitLoading === 'pull' ? 'animate-pulse' : ''} ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-600'}`}
                      title="Pull"
                  >
                      <ArrowDown size={14} />
                  </button>

                  {/* Push */}
                  <button
                      onClick={async () => {
                          setGitLoading('push');
                          await git.push();
                          setGitLoading(null);
                      }}
                      className={`p-1.5 rounded transition ${gitLoading === 'push' ? 'animate-pulse' : ''} ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-600'}`}
                      title="Push"
                  >
                      <ArrowUp size={14} />
                  </button>

              </div>
          </div>

          {/* Message List */}
          <div className="relative flex-1">
            <div
              ref={messagesContainerRef}
              className="absolute inset-0 overflow-y-auto p-4 space-y-4"
            >
              {/* Steering Questions - at top of messages */}
              {questions.length > 0 && (
                <SteeringQuestions
                  questions={questions}
                  onSelectQuestion={(text) => {
                    setInput(text)
                    textareaRef.current?.focus()
                  }}
                  onDismissQuestion={dismissQuestion}
                  isDarkMode={isDarkMode}
                  isVisible={questions.length > 0}
                  isEmptyChat={messages.length === 0}
                />
              )}

              {messages.length === 0 && (
                  <div className={`h-full flex items-center justify-center text-sm ${isDarkMode ? 'text-neutral-500' : 'text-stone-300'}`}>
                      Start a conversation...
                  </div>
              )}

              {/* Tool chips now only shown in messages, not separately at top */}

              {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {/* Reasoning Display for Assistant Messages */}
                      {msg.role === 'assistant' && msg.reasoning && (
                        <details className={`mb-2 w-full rounded-lg overflow-hidden ${
                          isDarkMode ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-200'
                        }`}>
                          <summary className={`px-3 py-2 text-xs cursor-pointer flex items-center gap-2 ${
                            isDarkMode ? 'text-purple-300 hover:bg-purple-500/20' : 'text-purple-700 hover:bg-purple-100'
                          }`}>
                            <Brain size={14} />
                            <span>View Reasoning</span>
                          </summary>
                          <div className={`px-3 py-2 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto ${
                            isDarkMode ? 'text-purple-200/80 border-t border-purple-500/20' : 'text-purple-600 border-t border-purple-200'
                          }`}>
                            {msg.reasoning}
                          </div>
                        </details>
                      )}

                      {/* Tool Usage Display for Assistant Messages - Compact chips */}
                      {msg.role === 'assistant' && msg.toolUsage && msg.toolUsage.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {msg.toolUsage.map((tool, idx) => (
                            <div
                              key={tool.id || idx}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                tool.isError
                                  ? isDarkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                                  : isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {tool.isError ? <X size={10} /> : <Check size={10} />}
                              <span className="font-mono">{tool.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div
                          className={`leading-relaxed overflow-hidden ${
                              msg.role === 'user'
                                  ? `px-3 py-2 max-w-[85%] ${isDarkMode ? 'bg-white text-neutral-900 rounded-xl' : 'bg-stone-900 text-white rounded-xl'}`
                                  : msg.role === 'system'
                                  ? `px-4 py-3 ${isDarkMode ? 'bg-yellow-500/20 text-yellow-200 rounded-2xl' : 'bg-yellow-50 text-yellow-800 rounded-2xl'}`
                                  : `w-full ${isDarkMode ? 'text-neutral-200' : 'text-stone-700'}`
                          }`}
                          style={{ fontSize: getFontSizeValue(appSettings.fontSize) }}
                      >
                          <MessageResponse>{msg.content}</MessageResponse>
                      </div>
                      <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-right pr-1' : 'text-left'} ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                          {formatRelativeTime(msg.timestamp)}{msg.role === 'assistant' && msg.model && ` · ${msg.model}`}{msg.role === 'assistant' && msg.intent && ` · ${msg.intent}`}
                      </div>
                  </div>
              ))}

              {/* Clarifying Question from AI */}
              {pendingClarifyingQuestion && (
                <ClarifyingQuestion
                  data={pendingClarifyingQuestion}
                  onSubmit={handleClarifyingQuestionSubmit}
                  onSkip={handleClarifyingQuestionSkip}
                  isDarkMode={isDarkMode}
                />
              )}

              {/* Streaming Message Display */}
              {isStreaming && streamingMessage && (
                <div className="flex flex-col items-start">
                  {/* Streaming Tool Calls - Compact chips */}
                  {streamingMessage.toolCalls.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {streamingMessage.toolCalls.map((tool, idx) => (
                        <div
                          key={tool.id || idx}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                            tool.status === 'running'
                              ? isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                              : tool.status === 'error'
                              ? isDarkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                              : isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {tool.status === 'running' && <Loader2 size={10} className="animate-spin" />}
                          {tool.status === 'done' && <Check size={10} />}
                          {tool.status === 'error' && <X size={10} />}
                          <span className="font-mono">{tool.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Streaming Reasoning/Thinking */}
                  {streamingMessage.reasoning && (
                    <div className={`mb-2 w-full px-3 py-2 rounded-lg text-xs ${
                      isDarkMode ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-1 font-medium">
                        <Brain size={14} />
                        <span>Thinking...</span>
                      </div>
                      <div className="font-mono text-xs opacity-80 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {streamingMessage.reasoning}
                      </div>
                    </div>
                  )}

                  {/* Streaming Text Content */}
                  <div
                    className={`w-full ${isDarkMode ? 'text-neutral-200' : 'text-stone-700'}`}
                    style={{ fontSize: getFontSizeValue(appSettings.fontSize) }}
                  >
                    {streamingMessage.content ? (
                      <MessageResponse>{streamingMessage.content}</MessageResponse>
                    ) : (
                      <div className="flex items-center gap-2 text-sm opacity-60">
                        <Loader2 size={14} className="animate-spin" />
                        <span>Generating response...</span>
                      </div>
                    )}
                    {/* Blinking cursor at the end */}
                    <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse" style={{ verticalAlign: 'text-bottom' }} />
                  </div>
                </div>
              )}

              {/* Completed Tool Calls - Shows success/error states after streaming ends */}
              {!isStreaming && completedToolCalls.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5 animate-in fade-in duration-300">
                  {completedToolCalls.map((tool) => (
                    <div
                      key={tool.id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                        tool.status === 'error'
                          ? isDarkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                          : isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {tool.status === 'error' ? <X size={10} /> : <Check size={10} />}
                      <span className="font-mono">{tool.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Loading indicator when processing but no streaming content yet */}
              {isAgentProcessing && !isStreaming && (
                <div className="flex items-center gap-2 text-sm opacity-60">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Processing...</span>
                </div>
              )}

              {/* Pending DOM Approval in chat - uses shared handlers */}
              {pendingDOMApproval && !isGeneratingSourcePatch && (
                <div className={`mx-4 my-3 p-3 rounded-xl border ${
                  isDarkMode
                    ? 'bg-blue-950/50 border-blue-800/50'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Palette size={16} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
                      <span className={`text-sm font-medium truncate ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                        {pendingDOMApproval.description}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center shrink-0">
                      {pendingDOMApproval.patchStatus === 'preparing' && (
                        <div className={`flex items-center gap-1 text-xs ${
                          isDarkMode ? 'text-blue-300/70' : 'text-blue-700/70'
                        }`}>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Preparing source patch…</span>
                        </div>
                      )}
                      {pendingDOMApproval.patchStatus === 'error' && (
                        <div className={`text-xs ${isDarkMode ? 'text-red-300/80' : 'text-red-600/80'}`}>
                          {pendingDOMApproval.patchError || 'Failed to prepare patch'}
                        </div>
                      )}
                      <button
                        onClick={handleRejectDOMApproval}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          isDarkMode
                            ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                            : 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                        }`}
                      >
                        Reject
                      </button>
                      <button
                        onClick={handleAcceptDOMApproval}
                        disabled={pendingDOMApproval.userApproved}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                          isDarkMode
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        } ${pendingDOMApproval.userApproved ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {pendingDOMApproval.userApproved ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Applying…
                          </>
                        ) : pendingDOMApproval.patchStatus === 'ready' ? (
                          <>
                            <Check size={14} />
                            Accept
                          </>
                        ) : (
                          <>
                            <Check size={14} />
                            Accept
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  {/* Tool use indicator showing which method generated the patch */}
                  {pendingDOMApproval.patchStatus === 'ready' && pendingDOMApproval.patch && (
                    <div className={`mt-2 pt-2 border-t ${isDarkMode ? 'border-blue-800/30' : 'border-blue-200'}`}>
                      <div className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-blue-300/70' : 'text-blue-700/70'}`}>
                        {pendingDOMApproval.patch.generatedBy === 'fast-apply' ? (
                          <>
                            <Zap size={12} className="text-yellow-500" />
                            <span className="font-medium text-yellow-500">Fast Apply</span>
                            <span>·</span>
                            <span>{pendingDOMApproval.patch.durationMs}ms</span>
                          </>
                        ) : pendingDOMApproval.patch.generatedBy === 'fast-path' ? (
                          <>
                            <Zap size={12} className="text-green-500" />
                            <span className="font-medium text-green-500">Fast Path</span>
                            <span>· instant</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} />
                            <span className="font-medium">Gemini</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="truncate">{pendingDOMApproval.patch.filePath.split('/').pop()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pending Code Change in chat (json-exec) */}
              {pendingChange?.source === 'code' && (
                <div className={`mx-4 my-3 p-3 rounded-xl border ${
                  isDarkMode
                    ? 'bg-blue-950/50 border-blue-800/50'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Code2 size={16} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
                      <span className={`text-sm font-medium truncate ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                        {pendingChange.description}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center shrink-0">
                      <button
                        onClick={handleRejectChange}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          isDarkMode
                            ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                            : 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                        }`}
                      >
                        Reject
                      </button>
                      <button
                        onClick={handleApproveChange}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                          isDarkMode
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <Check size={14} />
                        Accept
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading state while generating source patch */}
              {isGeneratingSourcePatch && (
                <div className={`mx-4 my-3 p-3 rounded-xl border ${
                  isDarkMode
                    ? 'bg-blue-950/50 border-blue-800/50'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className={`animate-spin ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                      Updating source code...
                    </span>
                  </div>
                </div>
              )}

              {/* Pending Patch Confirmation */}
              {pendingPatch && (
                <div className={`mx-4 my-3 p-4 rounded-xl border ${
                  isDarkMode
                    ? 'bg-emerald-950/50 border-emerald-800/50'
                    : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-emerald-900/50' : 'bg-emerald-100'}`}>
                      <Code2 size={18} className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
                        Apply to Source Code?
                      </div>
                      <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>
                        {pendingPatch.description}
                      </div>
                      <div className={`text-xs mt-1 font-mono truncate ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                        {pendingPatch.filePath.split('/').slice(-2).join('/')}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      {/* Eye button - hold to preview original */}
                      {pendingPatch.undoCode && pendingPatch.applyCode && (
                        <button
                          onMouseDown={() => {
                            const webview = webviewRefs.current.get(activeTabId);
                            if (pendingPatch.undoCode && webview) {
                              console.log('[Preview] Showing original');
                              (webview as Electron.WebviewTag).executeJavaScript(pendingPatch.undoCode);
                              setIsPreviewingPatchOriginal(true);
                            }
                          }}
                          onMouseUp={() => {
                            const webview = webviewRefs.current.get(activeTabId);
                            if (pendingPatch.applyCode && webview) {
                              console.log('[Preview] Showing change');
                              (webview as Electron.WebviewTag).executeJavaScript(pendingPatch.applyCode);
                              setIsPreviewingPatchOriginal(false);
                            }
                          }}
                          onMouseLeave={() => {
                            if (!isPreviewingPatchOriginal) return;
                            const webview = webviewRefs.current.get(activeTabId);
                            if (pendingPatch.applyCode && webview) {
                              console.log('[Preview] Showing change (mouse leave)');
                              (webview as Electron.WebviewTag).executeJavaScript(pendingPatch.applyCode);
                              setIsPreviewingPatchOriginal(false);
                            }
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isDarkMode
                              ? 'hover:bg-neutral-700 text-neutral-400'
                              : 'hover:bg-stone-200 text-stone-500'
                          }`}
                          title="Hold to see original"
                        >
                          {isPreviewingPatchOriginal ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          // Revert DOM changes when dismissing
                          if (pendingPatch.undoCode) {
                            const webview = webviewRefs.current.get(activeTabId);
                            if (webview) {
                              (webview as Electron.WebviewTag).executeJavaScript(pendingPatch.undoCode);
                            }
                          }
                          setPendingPatch(null);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          isDarkMode
                            ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                            : 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                        }`}
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={async () => {
                          if (window.electronAPI?.files?.writeFile && pendingPatch) {
                            const result = await window.electronAPI.files.writeFile(
                              pendingPatch.filePath,
                              pendingPatch.patchedContent
                            );
                            if (result.success) {
                              console.log('[Source Patch] Applied successfully');
                              setMessages(prev => [...prev, {
                                id: `msg-patch-${Date.now()}`,
                                role: 'assistant',
                                content: `Source code updated: ${pendingPatch.filePath.split('/').pop()}`,
                                timestamp: new Date(),
                              }]);
                            } else {
                              console.error('[Source Patch] Failed to apply:', result.error);
                            }
                            setPendingPatch(null);
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                          isDarkMode
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <Check size={14} />
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to Bottom Button */}
            {showScrollToBottom && (
              <button
                onClick={scrollToBottom}
                className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg transition-all duration-200 hover:scale-105 ${
                  isDarkMode
                    ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600 border border-neutral-600'
                    : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200'
                }`}
                title="Scroll to bottom"
              >
                <ArrowDown size={14} />
                <span className="text-xs font-medium">New messages</span>
              </button>
            )}
          </div>

          {/* Edited Files Drawer - slides up from behind chat */}
          {editedFiles.length > 0 && (
            <div className="px-4 pb-2">
              <div
                className={`rounded-t-2xl border border-b-0 overflow-hidden transition-all duration-300 shadow-lg ${
                  isDarkMode ? 'bg-neutral-800 border-neutral-600' : 'bg-stone-100 border-stone-200'
                }`}
              >
                {/* Drawer Header - always visible, shows pending changes */}
                <div
                  onClick={() => setIsEditedFilesDrawerOpen(!isEditedFilesDrawerOpen)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors cursor-pointer ${
                    isDarkMode ? 'hover:bg-neutral-700' : 'hover:bg-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight
                      size={16}
                      className={`transition-transform duration-200 ${isEditedFilesDrawerOpen ? 'rotate-90' : ''} ${
                        isDarkMode ? 'text-neutral-400' : 'text-stone-500'
                      }`}
                    />
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-stone-700'}`}>
                      {editedFiles.length} File{editedFiles.length !== 1 ? 's' : ''} Changed
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                      Pending
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); undoAllEdits(); }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        isDarkMode
                          ? 'text-red-400 hover:bg-red-500/20 border border-red-500/30'
                          : 'text-red-600 hover:bg-red-50 border border-red-200'
                      }`}
                    >
                      Reject
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); keepAllEdits(); }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        isDarkMode
                          ? 'text-green-400 hover:bg-green-500/20 border border-green-500/30'
                          : 'text-green-600 hover:bg-green-50 border border-green-200'
                      }`}
                    >
                      Accept
                    </button>
                  </div>
                </div>

                {/* Drawer Content - file list */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    isEditedFilesDrawerOpen ? 'max-h-80' : 'max-h-0'
                  }`}
                >
                  <div className={`border-t max-h-72 overflow-y-auto ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`}>
                    {editedFiles.map((file, index) => (
                      <div
                        key={file.path}
                        className={`flex items-center justify-between px-4 py-2 ${
                          index !== editedFiles.length - 1 ? (isDarkMode ? 'border-b border-neutral-700' : 'border-b border-stone-200') : ''
                        } ${isDarkMode ? 'hover:bg-neutral-700' : 'hover:bg-stone-200'}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Code2 size={14} className={isDarkMode ? 'text-neutral-400' : 'text-stone-500'} />
                          <span className={`text-sm font-mono truncate ${isDarkMode ? 'text-neutral-200' : 'text-stone-700'}`}>
                            {file.fileName}
                          </span>
                          <div className="flex items-center gap-1 text-xs font-mono">
                            {file.additions > 0 && <span className="text-green-500">+{file.additions}</span>}
                            {file.deletions > 0 && <span className="text-red-500">-{file.deletions}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {(file.undoCode || file.isFileModification) && (
                            <button
                              onClick={() => undoFileEdit(file.path)}
                              className={`p-1.5 rounded-lg text-xs transition-colors ${
                                isDarkMode
                                  ? 'text-red-400 hover:bg-red-500/20'
                                  : 'text-red-500 hover:bg-red-50'
                              }`}
                              title="Reject this change"
                            >
                              <X size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => setEditedFiles(prev => prev.filter(f => f.path !== file.path))}
                            className={`p-1.5 rounded-lg text-xs transition-colors ${
                              isDarkMode
                                ? 'text-green-400 hover:bg-green-500/20'
                                : 'text-green-500 hover:bg-green-50'
                            }`}
                            title="Accept this change"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className={`p-4 ${editedFiles.length > 0 ? 'pt-0' : ''}`} style={{ overflow: 'visible' }}>
              <div
                className={`rounded-2xl border relative ${editedFiles.length > 0 ? 'rounded-t-none border-t-0' : ''} ${isDarkMode ? 'bg-neutral-700 border-neutral-600' : 'bg-stone-50 border-stone-200'} ${isDraggingOver ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
                style={{ overflow: 'visible' }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                  {/* Drop zone overlay */}
                  {isDraggingOver && (
                    <div className="absolute inset-0 bg-blue-500/10 rounded-2xl flex items-center justify-center z-10 pointer-events-none">
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                        <Image size={20} />
                        <span className="font-medium">Drop images here (max 5)</span>
                      </div>
                    </div>
                  )}
                  {/* Selection Chips */}
                  {(selectedElement || screenshotElement || attachLogs || selectedLogs || attachedSearchResults) && (
                      <div className="px-3 pt-3 flex flex-wrap gap-2">
                          {attachLogs && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-xs border border-yellow-200">
                                  <Terminal size={12} />
                                  <span className="font-medium">Console Logs</span>
                                  <button
                                      onClick={() => setAttachLogs(false)}
                                      className="ml-0.5 hover:text-yellow-900"
                                  >
                                      <X size={12} />
                                  </button>
                              </div>
                          )}
                          {selectedLogs && selectedLogs.length > 0 && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs border border-purple-200">
                                  <Terminal size={12} />
                                  <span className="font-medium">{selectedLogs.length} Log{selectedLogs.length > 1 ? 's' : ''} Selected</span>
                                  <button
                                      onClick={() => {
                                        setSelectedLogIndices(new Set());
                                        lastClickedLogIndex.current = null;
                                      }}
                                      className="ml-0.5 hover:text-purple-900"
                                  >
                                      <X size={12} />
                                  </button>
                              </div>
                          )}
                          {attachedSearchResults && attachedSearchResults.length > 0 && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs border border-blue-200">
                                  <Globe size={12} />
                                  <span className="font-medium">{attachedSearchResults.length} Search Result{attachedSearchResults.length > 1 ? 's' : ''}</span>
                                  <button
                                      onClick={() => setAttachedSearchResults(null)}
                                      className="ml-0.5 hover:text-blue-900"
                                  >
                                      <X size={12} />
                                  </button>
                              </div>
                          )}
                          {selectedElement && (
                              <div
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border cursor-pointer transition-colors ${
                                  selectedElement.targetPosition
                                    ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                }`}
                                onClick={handleShowSourceCode}
                                title={selectedElement.targetPosition ? 'Element with repositioning target' : 'Click to view source code'}
                              >
                                  {selectedElement.targetPosition ? <Move size={12} /> : <Check size={12} />}
                                  {selectedElement.sourceLocation ? (
                                      <span className="font-mono font-medium">
                                          {(() => {
                                            const src = selectedElement.sourceLocation.sources?.[0];
                                            if (!src) return selectedElement.sourceLocation.summary;
                                            // Extract filename from URL path (//localhost:4000/src/App.tsx -> App.tsx)
                                            let fileName = 'unknown';
                                            if (src.file) {
                                              // Remove localhost URL prefix and get just the filename
                                              const cleanPath = src.file.replace(/^\/\/localhost:\d+\//, '');
                                              const parts = cleanPath.split('/');
                                              fileName = parts[parts.length - 1] || cleanPath;
                                            }
                                            const startLine = src.line || 0;
                                            const endLine = src.endLine || startLine + 5;
                                            return `${fileName} (${startLine}-${endLine})`;
                                          })()}
                                      </span>
                                  ) : (
                                      <span className="font-medium">{selectedElement.tagName.toLowerCase()}</span>
                                  )}
                                  {selectedElement.targetPosition && (
                                    <span className="text-[10px] opacity-70">
                                      → {Math.round(selectedElement.targetPosition.x)},{Math.round(selectedElement.targetPosition.y)}
                                    </span>
                                  )}
                                  <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Clear selection state
                                        setSelectedElement(null);
                                        setDisplayedSourceCode(null);
                                        setMoveTargetPosition(null);
                                        // Clear canvas indicators
                                        const webview = webviewRefs.current.get(activeTabId);
                                        webview?.send('clear-selection');
                                      }}
                                      className={`ml-0.5 ${selectedElement.targetPosition ? 'hover:text-orange-900' : 'hover:text-blue-900'}`}
                                  >
                                      <X size={12} />
                                  </button>
                              </div>
                          )}
                          {screenshotElement && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs border border-purple-200">
                                  <Camera size={12} />
                                  <span className="font-medium">{screenshotElement.tagName.toLowerCase()}</span>
                                  <button
                                      onClick={() => {
                                          setScreenshotElement(null);
                                          setCapturedScreenshot(null);
                                          // Clear canvas indicators
                                          const webview = webviewRefs.current.get(activeTabId);
                                          webview?.send('clear-selection');
                                      }}
                                      className="ml-0.5 hover:text-purple-900"
                                  >
                                      <X size={12} />
                                  </button>
                              </div>
                          )}
                      </div>
                  )}

                  {/* Intent Preview Chips - supports multiple intents */}
                  {previewIntent && previewIntent.label && (
                      <div className={`px-3 pt-2 flex flex-wrap gap-1.5`}>
                          {/* Primary intent chip */}
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                            isDarkMode
                              ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-300 border border-violet-500/30'
                              : 'bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 border border-violet-200'
                          }`}>
                              {/* Code operations */}
                              {previewIntent.type === 'code_edit' && <Pencil size={12} />}
                              {previewIntent.type === 'code_create' && <FilePlus size={12} />}
                              {previewIntent.type === 'code_delete' && <Trash2 size={12} />}
                              {previewIntent.type === 'code_explain' && <Lightbulb size={12} />}
                              {previewIntent.type === 'code_refactor' && <RefreshCw size={12} />}
                              {previewIntent.type === 'file_operation' && <Folder size={12} />}
                              {/* UI operations */}
                              {previewIntent.type === 'ui_inspect' && <Search size={12} />}
                              {previewIntent.type === 'ui_modify' && <Palette size={12} />}
                              {previewIntent.type === 'ui_build' && <Hammer size={12} />}
                              {/* Research & Analysis */}
                              {previewIntent.type === 'research' && <BookOpen size={12} />}
                              {previewIntent.type === 'analyze' && <BarChart2 size={12} />}
                              {previewIntent.type === 'compare' && <GitCompare size={12} />}
                              {/* Planning */}
                              {previewIntent.type === 'plan' && <MapIcon size={12} />}
                              {previewIntent.type === 'document' && <FileEdit size={12} />}
                              {/* Testing & Quality */}
                              {previewIntent.type === 'test' && <TestTube size={12} />}
                              {previewIntent.type === 'debug' && <Bug size={12} />}
                              {previewIntent.type === 'review' && <ShieldCheck size={12} />}
                              {/* DevOps */}
                              {previewIntent.type === 'deploy' && <Upload size={12} />}
                              {previewIntent.type === 'configure' && <Wrench size={12} />}
                              {/* Communication */}
                              {previewIntent.type === 'question' && <HelpCircle size={12} />}
                              {previewIntent.type === 'chat' && <MessageSquare size={12} />}
                              <span>{previewIntent.label}</span>
                          </div>
                          {/* Secondary intent chips */}
                          {previewIntent.secondaryLabels?.map((label, idx) => (
                              <div key={idx} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                isDarkMode
                                  ? 'bg-gradient-to-r from-blue-500/15 to-cyan-500/15 text-blue-300 border border-blue-500/25'
                                  : 'bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-600 border border-blue-200'
                              }`}>
                                  {/* Secondary icons */}
                                  {previewIntent.secondaryTypes?.[idx] === 'research' && <BookOpen size={12} />}
                                  {previewIntent.secondaryTypes?.[idx] === 'analyze' && <BarChart2 size={12} />}
                                  {previewIntent.secondaryTypes?.[idx] === 'compare' && <GitCompare size={12} />}
                                  {previewIntent.secondaryTypes?.[idx] === 'plan' && <MapIcon size={12} />}
                                  {previewIntent.secondaryTypes?.[idx] === 'test' && <TestTube size={12} />}
                                  {previewIntent.secondaryTypes?.[idx] === 'review' && <ShieldCheck size={12} />}
                                  {previewIntent.secondaryTypes?.[idx] === 'debug' && <Bug size={12} />}
                                  {previewIntent.secondaryTypes?.[idx] === 'question' && <HelpCircle size={12} />}
                                  {previewIntent.secondaryTypes?.[idx] === 'ui_modify' && <Palette size={12} />}
                                  {previewIntent.secondaryTypes?.[idx] === 'ui_build' && <Hammer size={12} />}
                                  {previewIntent.secondaryTypes?.[idx] === 'code_edit' && <Pencil size={12} />}
                                  {previewIntent.secondaryTypes?.[idx] === 'code_create' && <FilePlus size={12} />}
                                  <span>{label}</span>
                              </div>
                          ))}
                      </div>
                  )}

                  {/* File Chips and Context Chips */}
                  {(selectedFiles.length > 0 || contextChips.length > 0) && (
                      <div className={`px-3 pt-2 flex flex-wrap gap-2`}>
                          {/* File Chips */}
                          {selectedFiles.map((file, idx) => (
                              <div key={`file-${idx}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${isDarkMode ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                  <Code2 size={12} />
                                  <span className="font-mono max-w-[120px] truncate">{file.path.split('/').pop()}</span>
                                  <button
                                      onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                                      className="hover:opacity-70"
                                  >
                                      <X size={12} />
                                  </button>
                              </div>
                          ))}
                          {/* Context Chips */}
                          {contextChips.map((chip) => (
                              <div
                                key={`chip-${chip.name}-${chip.type}`}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${
                                  chip.type === 'exclude'
                                    ? isDarkMode ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200'
                                    : isDarkMode ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                  <span className="font-medium uppercase">{chip.name}</span>
                                  <button
                                      onClick={() => setContextChips(prev => prev.filter(c => !(c.name === chip.name && c.type === chip.type)))}
                                      className="hover:opacity-70"
                                  >
                                      <X size={12} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}

                  {/* Attached Images Preview */}
                  {attachedImages.length > 0 && (
                      <div className="px-3 pt-2 flex flex-wrap gap-2">
                          {attachedImages.map((img, idx) => (
                              <div
                                key={idx}
                                className={`relative group rounded-lg overflow-hidden border ${isDarkMode ? 'border-neutral-500' : 'border-stone-300'}`}
                              >
                                <img
                                  src={img}
                                  alt={`Attachment ${idx + 1}`}
                                  className="h-16 w-16 object-cover"
                                />
                                <button
                                  onClick={() => removeAttachedImage(idx)}
                                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                          ))}
                          {attachedImages.length < 5 && (
                            <div className={`text-xs self-center ${isDarkMode ? 'text-neutral-400' : 'text-stone-400'}`}>
                              {5 - attachedImages.length} more
                            </div>
                          )}
                      </div>
                  )}

                  {/* Source Code Preview with LSP hover */}
                  {displayedSourceCode && (
                      <div className="px-3 pt-3">
                          <div className={`text-xs font-mono mb-1 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                            {displayedSourceCode.fileName} ({displayedSourceCode.startLine}-{displayedSourceCode.endLine})
                          </div>
                          <div
                            onMouseMove={handleCodeMouseMove}
                            onMouseLeave={() => lspUI.hideHover()}
                          >
                            <CodeBlock
                              code={displayedSourceCode.code}
                              language="tsx"
                              showLineNumbers={true}
                              isDarkMode={isDarkMode}
                            >
                              <CodeBlockCopyButton />
                            </CodeBlock>
                          </div>
                      </div>
                  )}

                  {/* LSP Hover Tooltip */}
                  <HoverTooltip
                    data={lspUI.uiState.hoverTooltip.data}
                    position={lspUI.uiState.hoverTooltip.position}
                    isVisible={lspUI.uiState.hoverTooltip.isVisible}
                    onDismiss={() => lspUI.hideHover()}
                  />

                  {/* LSP Autocomplete Popup */}
                  <AutocompletePopup
                    items={lspUI.uiState.autocomplete.items}
                    position={lspUI.uiState.autocomplete.position}
                    isVisible={lspUI.uiState.autocomplete.isVisible}
                    filterText={lspUI.uiState.autocomplete.filterText}
                    onSelect={(item) => lspUI.selectCompletion(item)}
                    onDismiss={() => lspUI.hideAutocomplete()}
                  />

                  <div className="relative">
                      <textarea
                          ref={textareaRef}
                          value={input}
                          onChange={(e) => handleInputChange(e.target.value)}
                          style={{ overflowY: 'auto' }}
                          onKeyDown={(e) => {
                              // Handle autocomplete navigation
                              if (showFileAutocomplete && filteredFiles.length > 0) {
                                  const maxIndex = Math.min(filteredFiles.length - 1, 5); // 6 items max
                                  if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      setAutocompleteIndex(prev => Math.min(prev + 1, maxIndex));
                                  } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      setAutocompleteIndex(prev => Math.max(prev - 1, 0));
                                  } else if (e.key === 'Tab' || e.key === 'Enter') {
                                      e.preventDefault();
                                      const selected = filteredFiles[autocompleteIndex];
                                      if (selected) {
                                          if (selected.isDirectory) {
                                              navigateToDirectory(selected.path);
                                          } else {
                                              handleFileSelect(selected.path);
                                          }
                                      }
                                  } else if (e.key === 'Backspace' && directoryStack.length > 0 && fileSearchQuery === '') {
                                      e.preventDefault();
                                      navigateBack();
                                  } else if (e.key === 'Escape') {
                                      setShowFileAutocomplete(false);
                                      setFileSearchQuery('');
                                      setDirectoryStack([]);
                                      setCurrentDirectory('');
                                      loadDirectoryFiles(activeTab.projectPath || undefined);
                                      setInput('');
                                  }
                                  return;
                              }

                              if (showCommandAutocomplete && filteredCommands.length > 0) {
                                  const maxIndex = Math.min(filteredCommands.length - 1, 5); // 6 items max
                                  if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      setAutocompleteIndex(prev => Math.min(prev + 1, maxIndex));
                                  } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      setAutocompleteIndex(prev => Math.max(prev - 1, 0));
                                  } else if (e.key === 'Tab' || e.key === 'Enter') {
                                      e.preventDefault();
                                      const selected = filteredCommands[autocompleteIndex];
                                      if (selected) {
                                          handleCommandSelect(selected.name);
                                      }
                                  } else if (e.key === 'Escape') {
                                      setShowCommandAutocomplete(false);
                                      setCommandSearchQuery('');
                                      setInput('');
                                  }
                                  return;
                              }

                              // Normal input handling
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                  e.preventDefault();
                                  processPrompt(input);
                                  setSelectedFiles([]);
                              }
                              if (e.key === 'Escape') {
                                  setShowFileAutocomplete(false);
                                  setShowCommandAutocomplete(false);
                              }
                          }}
                          placeholder="Plan, @ for context, / for commands"
                          className={`w-full bg-transparent px-4 py-3 text-sm resize-none focus:outline-none min-h-[56px] ${isDarkMode ? 'text-neutral-100 placeholder-neutral-400' : ''}`}
                          rows={2}
                      />

                      {/* Autocomplete for @ (files) */}
                      {showFileAutocomplete && isElectron && (
                          <div className={`absolute bottom-full left-0 mb-2 w-80 rounded-xl shadow-xl py-1 z-[100] max-h-[264px] overflow-y-auto ${isDarkMode ? 'bg-neutral-700 border border-neutral-600' : 'bg-white border border-stone-200'}`}>
                              {/* Back button when in subdirectory */}
                              {directoryStack.length > 0 && (
                                  <button
                                      onClick={navigateBack}
                                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 border-b ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-300 border-neutral-600' : 'hover:bg-stone-50 text-stone-600 border-stone-100'}`}
                                  >
                                      <ChevronLeft size={14} />
                                      <span>..</span>
                                      <span className={`text-xs truncate ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                                          {currentDirectory.split('/').pop()}
                                      </span>
                                  </button>
                              )}
                              {filteredFiles.length === 0 ? (
                                  <div className={`px-3 py-2 text-sm ${isDarkMode ? 'text-neutral-400' : 'text-stone-400'}`}>
                                      {directoryFiles.length === 0 ? 'Loading...' : 'No matching files'}
                                  </div>
                              ) : (
                                  filteredFiles.slice(0, 6).map((file, idx) => (
                                      <button
                                          key={file.path}
                                          onClick={() => {
                                              if (file.isDirectory) {
                                                  navigateToDirectory(file.path);
                                              } else {
                                                  handleFileSelect(file.path);
                                              }
                                          }}
                                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${idx === autocompleteIndex ? (isDarkMode ? 'bg-neutral-600' : 'bg-stone-100') : ''} ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-200' : 'hover:bg-stone-50'}`}
                                      >
                                          {file.isDirectory ? (
                                              <Folder size={14} className={isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} />
                                          ) : (
                                              <File size={14} className={isDarkMode ? 'text-neutral-400' : 'text-stone-400'} />
                                          )}
                                          <span className={`truncate ${file.isDirectory ? 'font-medium' : ''}`}>{file.name}</span>
                                          {file.isDirectory && <ChevronRight size={12} className={isDarkMode ? 'text-neutral-500 ml-auto' : 'text-stone-400 ml-auto'} />}
                                      </button>
                                  ))
                              )}
                          </div>
                      )}

                      {/* Autocomplete for / (commands) */}
                      {showCommandAutocomplete && (
                          <div className={`absolute bottom-full left-0 mb-2 w-64 rounded-xl shadow-xl py-1 z-[100] max-h-[264px] overflow-y-auto ${isDarkMode ? 'bg-neutral-700 border border-neutral-600' : 'bg-white border border-stone-200'}`}>
                              {filteredCommands.length === 0 ? (
                                  <div className={`px-3 py-2 text-sm ${isDarkMode ? 'text-neutral-400' : 'text-stone-400'}`}>
                                      {availableCommands.length === 0 ? 'Loading...' : 'No matching commands'}
                                  </div>
                              ) : (
                                  filteredCommands.slice(0, 6).map((cmd, idx) => (
                                      <button
                                          key={cmd.name}
                                          onClick={() => handleCommandSelect(cmd.name)}
                                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${idx === autocompleteIndex ? (isDarkMode ? 'bg-neutral-600' : 'bg-stone-100') : ''} ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-200' : 'hover:bg-stone-50'}`}
                                      >
                                          <Terminal size={14} />
                                          /{cmd.name}
                                      </button>
                                  ))
                              )}
                          </div>
                      )}

                      {/* Autocomplete for +/- (context chips) */}
                      {showChipAutocomplete && (
                          <div className={`absolute bottom-full left-0 mb-2 w-64 rounded-xl shadow-xl py-1 z-[100] max-h-[264px] overflow-y-auto ${isDarkMode ? 'bg-neutral-700 border border-neutral-600' : 'bg-white border border-stone-200'}`}>
                              {filteredContextChips.length === 0 ? (
                                  <div className={`px-3 py-2 text-sm ${isDarkMode ? 'text-neutral-400' : 'text-stone-400'}`}>
                                      {recentContextChips.length === 0 ? 'No recent chips' : 'No matching chips'}
                                  </div>
                              ) : (
                                  filteredContextChips.slice(0, 6).map((chip, idx) => (
                                      <button
                                          key={`${chip.type}-${chip.name}`}
                                          onClick={() => handleChipSelect({ ...chip, type: chipSearchType })}
                                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${idx === autocompleteIndex ? (isDarkMode ? 'bg-neutral-600' : 'bg-stone-100') : ''} ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-200' : 'hover:bg-stone-50'}`}
                                      >
                                          <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold ${
                                            chipSearchType === 'exclude'
                                              ? isDarkMode ? 'bg-red-500/30 text-red-300' : 'bg-red-100 text-red-600'
                                              : isDarkMode ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-100 text-blue-600'
                                          }`}>
                                            {chipSearchType === 'exclude' ? '-' : '+'}
                                          </span>
                                          <span className="uppercase font-medium">{chip.name}</span>
                                      </button>
                                  ))
                              )}
                          </div>
                      )}
                  </div>

                  {/* Input Toolbar */}
                  <div className={`flex items-center justify-between px-2 py-1.5 border-t ${isDarkMode ? 'border-neutral-600' : 'border-stone-100'}`}>
                      <div className="flex items-center gap-0.5">
                          {/* Agent Selector */}
                          <div className="relative">
                              <button
                                  onClick={() => !isInspectorActive && setIsModelMenuOpen(!isModelMenuOpen)}
                                  className={`flex items-center gap-1.5 px-2 py-1 text-sm rounded-full border transition ${
                                    isInspectorActive
                                      ? isDarkMode
                                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-300 cursor-not-allowed'
                                        : 'border-blue-300 bg-blue-50 text-blue-600 cursor-not-allowed'
                                      : isDarkMode
                                        ? 'border-neutral-600 hover:bg-neutral-600 text-neutral-200 bg-neutral-700'
                                        : 'border-stone-200 hover:bg-stone-50 text-stone-700 bg-white'
                                  }`}
                                  title={isInspectorActive ? 'Model locked while inspector is active' : selectedModel.name}
                              >
                                  <selectedModel.Icon size={14} className="flex-shrink-0" />
                                  <span className="truncate max-w-[100px]">{getShortModelName(selectedModel.name)}</span>
                                  {isInspectorActive ? (
                                    <MousePointer2 size={10} className={isDarkMode ? 'text-blue-400' : 'text-blue-500'} />
                                  ) : (
                                    <ChevronDown size={10} className={isDarkMode ? 'text-neutral-400' : 'text-stone-400'} />
                                  )}
                              </button>

                              {isModelMenuOpen && (
                                  <>
                                      <div className="fixed inset-0 z-[99]" onClick={() => setIsModelMenuOpen(false)}></div>
                                      <div className={`absolute bottom-full left-0 mb-2 w-56 rounded-xl shadow-xl py-1 z-[100] max-h-80 overflow-y-auto ${isDarkMode ? 'bg-neutral-700 border border-neutral-600' : 'bg-white border border-stone-200'}`}>
                                          {/* Show only enabled models from settings */}
                                          {displayModels.filter(m => m.isEnabled).map(model => (
                                              <button
                                                  key={model.id}
                                                  onClick={() => {
                                                    if (model.isAvailable) {
                                                      setSelectedModel({ id: model.id, name: model.name, Icon: model.Icon });
                                                      setIsModelMenuOpen(false);
                                                    }
                                                  }}
                                                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                                      !model.isAvailable
                                                        ? 'opacity-40 cursor-not-allowed'
                                                        : isDarkMode ? 'hover:bg-neutral-600 text-neutral-200' : 'hover:bg-stone-50'
                                                  }`}
                                                  disabled={!model.isAvailable}
                                                  title={!model.isProviderConfigured ? 'Configure provider API key in Settings' : model.name}
                                              >
                                                  <model.Icon size={14} className={model.isAvailable ? (isDarkMode ? 'text-neutral-400' : 'text-stone-500') : 'text-stone-300'} />
                                                  <span className={`flex-1 ${selectedModel.id === model.id ? 'font-medium' : ''}`}>{getShortModelName(model.name)}</span>
                                                  {selectedModel.id === model.id && (
                                                      <Check size={12} className="text-blue-600" />
                                                  )}
                                              </button>
                                          ))}
                                      </div>
                                  </>
                              )}
                          </div>

                          {/* Thinking Level Button with Popover */}
                          <div className="relative" data-thinking-popover>
                            <button
                              onClick={() => !isInspectorActive && setShowThinkingPopover(!showThinkingPopover)}
                              className={`p-2 rounded-lg transition-colors ${
                                isInspectorActive
                                  ? isDarkMode
                                    ? 'text-neutral-600 cursor-not-allowed'
                                    : 'text-stone-300 cursor-not-allowed'
                                  : thinkingLevel !== 'off'
                                    ? isDarkMode
                                      ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                                      : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                                    : isDarkMode
                                      ? 'hover:bg-neutral-600 text-neutral-400'
                                      : 'hover:bg-stone-100 text-stone-400'
                              }`}
                              title={isInspectorActive ? 'Thinking disabled while inspector is active' : `Thinking: ${thinkingLevel}`}
                            >
                              <Brain size={18} />
                            </button>

                            {/* Thinking Level Popover */}
                            {showThinkingPopover && !isInspectorActive && (
                              <div className={`absolute bottom-full right-0 mb-2 p-2 rounded-lg shadow-lg border min-w-[200px] z-50 ${
                                isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'
                              }`}>
                                <div className={`text-xs font-medium mb-2 px-2 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                                  Extended Thinking
                                </div>
                                {/* Model support note */}
                                <div className={`text-xs px-2 py-1.5 mb-2 rounded ${
                                  isDarkMode ? 'bg-neutral-700/50 text-neutral-400' : 'bg-stone-50 text-stone-500'
                                }`}>
                                  <span className="font-medium">{selectedModel.name}</span>
                                  {selectedModel.id.includes('claude') || selectedModel.id.includes('opus') || selectedModel.id.includes('sonnet') || selectedModel.id.includes('haiku')
                                    ? <span className="ml-1 text-emerald-500">(native)</span>
                                    : <span className="ml-1 text-amber-500">(prompted)</span>
                                  }
                                </div>
                                {(['off', 'low', 'med', 'high', 'ultrathink'] as ThinkingLevel[]).map((level) => (
                                  <button
                                    key={level}
                                    onClick={() => {
                                      setThinkingLevel(level);
                                      setShowThinkingPopover(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition ${
                                      thinkingLevel === level
                                        ? isDarkMode
                                          ? 'bg-violet-500/20 text-violet-300'
                                          : 'bg-violet-50 text-violet-700'
                                        : isDarkMode
                                          ? 'hover:bg-neutral-700 text-neutral-300'
                                          : 'hover:bg-stone-50 text-stone-700'
                                    }`}
                                  >
                                    {level === 'off' && <X size={14} />}
                                    {level === 'low' && <Lightbulb size={14} />}
                                    {level === 'med' && <Brain size={14} />}
                                    {level === 'high' && <Flame size={14} />}
                                    {level === 'ultrathink' && <Rocket size={14} />}
                                    <span className="capitalize">{level === 'ultrathink' ? 'Ultra' : level}</span>
                                    {thinkingLevel === level && <Check size={14} className="ml-auto" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          </div>

                      <div className="flex items-center gap-1">
                          {/* Cursor/Inspector */}
                          <button
                              onClick={() => {
                                  setIsInspectorActive(!isInspectorActive);
                                  setIsScreenshotActive(false);
                                  setIsMoveActive(false);
                              }}
                              className={`p-2 rounded-lg transition-colors ${isInspectorActive ? 'bg-blue-100 text-blue-600' : (isDarkMode ? 'hover:bg-neutral-600 text-neutral-400' : 'hover:bg-stone-100 text-stone-400')}`}
                              title="Select Element"
                          >
                              <MousePointer2 size={18} />
                          </button>

                          {/* Move/Reposition - works alongside screenshot */}
                          <button
                              onClick={() => {
                                  setIsMoveActive(!isMoveActive);
                                  setIsInspectorActive(false);
                                  // DON'T disable screenshot mode - they work together
                              }}
                              className={`p-2 rounded-lg transition-colors ${isMoveActive ? 'bg-orange-100 text-orange-600' : (isDarkMode ? 'hover:bg-neutral-600 text-neutral-400' : 'hover:bg-stone-100 text-stone-400')}`}
                              title="Move & Resize Element"
                          >
                              <Move size={18} />
                          </button>

                          {/* Console Logs */}
                          <button
                              onClick={() => setAttachLogs(!attachLogs)}
                              className={`p-2 rounded-lg transition-colors ${attachLogs ? 'bg-yellow-100 text-yellow-600' : (isDarkMode ? 'hover:bg-neutral-600 text-neutral-400' : 'hover:bg-stone-100 text-stone-400')}`}
                              title="Attach Console Logs"
                          >
                              <Terminal size={18} />
                          </button>
                          <input
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              accept="image/*"
                              multiple
                              onChange={handleImageUpload}
                          />

                          {/* Screenshot thumbnail preview */}
                          {capturedScreenshot && (
                              <button
                                  onClick={() => setShowScreenshotPreview(true)}
                                  className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-purple-500 hover:border-purple-600 transition-colors"
                                  title="View captured screenshot"
                              >
                                  <img src={capturedScreenshot} alt="Screenshot preview" className="w-full h-full object-cover" />
                              </button>
                          )}

                          {/* Screenshot/Camera */}
                          <button
                              onClick={() => {
                                  setIsScreenshotActive(!isScreenshotActive);
                                  setIsInspectorActive(false);
                              }}
                              className={`p-2 rounded-lg transition-colors ${isScreenshotActive ? 'bg-purple-100 text-purple-600' : (isDarkMode ? 'hover:bg-neutral-600 text-neutral-400' : 'hover:bg-stone-100 text-stone-400')}`}
                              title="Screenshot Element"
                          >
                              <Camera size={18} />
                          </button>

                          {/* Stop button (visible only during active streaming, not idle connection) */}
                          {connectionState === 'streaming' && (
                              <button
                                  onClick={() => {
                                      cancelAI()
                                      setIsStreaming(false)
                                      setConnectionState('idle')
                                      setStreamingMessage(null)
                                      setStreamingContent('')
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-red-500 text-white hover:bg-red-600'}`}
                                  title="Stop generating"
                              >
                                  <Square size={12} fill="currentColor" />
                              </button>
                          )}

                          {/* Connection state indicator (shows idle = connected but not streaming) */}
                          {connectionState === 'idle' && (
                              <div
                                  className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-emerald-600/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}
                                  title="Connected (idle)"
                              >
                                  <Check size={12} />
                              </div>
                          )}

                          {/* Send button (always visible - queues messages during streaming) */}
                          <button
                              onClick={() => processPrompt(input)}
                              disabled={!input.trim()}
                              className={`p-1.5 rounded-lg transition-colors ml-1 disabled:opacity-30 disabled:cursor-not-allowed ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-800'}`}
                              title={connectionState === 'streaming' ? "Queue message" : "Send message"}
                          >
                              <ArrowUp size={14} />
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      )}


      {/* Stash Confirmation Dialog */}
      {isStashDialogOpen && (
          <>
              <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setIsStashDialogOpen(false)}></div>
              <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-96 rounded-xl shadow-2xl p-5 ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-stone-200'}`}>
                  <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-neutral-100' : 'text-stone-900'}`}>Stash Changes</h3>
                  <p className={`text-sm mb-4 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                      This will temporarily save your uncommitted changes. You can restore them later with "stash pop".
                  </p>
                  <input
                      type="text"
                      value={stashMessage}
                      onChange={(e) => setStashMessage(e.target.value)}
                      placeholder="Optional stash message..."
                      className={`w-full text-sm px-3 py-2 rounded-lg border mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100 placeholder-neutral-400' : 'bg-stone-50 border-stone-200'}`}
                      autoFocus
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                              handleStash(stashMessage);
                          }
                          if (e.key === 'Escape') {
                              setIsStashDialogOpen(false);
                              setStashMessage('');
                          }
                      }}
                  />
                  <div className="flex gap-2 justify-end">
                      <button
                          onClick={() => {
                              setIsStashDialogOpen(false);
                              setStashMessage('');
                          }}
                          className={`px-4 py-2 text-sm rounded-lg transition ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-300' : 'hover:bg-stone-100 text-stone-600'}`}
                      >
                          Cancel
                      </button>
                      <button
                          onClick={() => handleStash(stashMessage)}
                          className={`px-4 py-2 text-sm rounded-lg font-medium transition ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-800'}`}
                      >
                          Stash Changes
                      </button>
                  </div>
              </div>
          </>
      )}

      {/* AI Element Selection Confirmation - Toolbar */}
      {aiSelectedElement && aiSelectedElement.elements && aiSelectedElement.elements.length > 0 && (
          <div className={`absolute top-20 left-1/2 transform -translate-x-1/2 rounded-lg shadow-2xl px-4 py-3 z-50 max-w-3xl ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
              {aiSelectedElement.count === 1 ? (
                  // Single element - simple confirmation
                  <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                          <Check size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                          <div className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
                              Found <code className={`px-1.5 py-0.5 rounded font-mono text-xs ${isDarkMode ? 'bg-neutral-700 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>{aiSelectedElement.elements[0].tagName}</code>
                              {aiSelectedElement.elements[0].text && (
                                  <span className="ml-1">"{aiSelectedElement.elements[0].text.substring(0, 40)}{aiSelectedElement.elements[0].text.length > 40 ? '...' : ''}"</span>
                              )}
                              <span className={`ml-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>- Is this correct?</span>
                          </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                          <button
                              onClick={() => handleConfirmSelection(false)}
                              className={`px-4 py-2 text-sm rounded-lg font-medium transition ${isDarkMode ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'}`}
                          >
                              No
                          </button>
                          <button
                              onClick={() => handleConfirmSelection(true, 1)}
                              className={`px-4 py-2 text-sm rounded-lg font-medium transition ${isDarkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                          >
                              Yes
                          </button>
                      </div>
                  </div>
              ) : (
                  // Multiple elements - show list with numbers
                  <div>
                      <div className="flex items-center gap-2 mb-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                              <Check size={16} />
                          </div>
                          <div className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
                              Found {aiSelectedElement.count} elements - which one?
                          </div>
                          <button
                              onClick={() => handleConfirmSelection(false)}
                              className={`ml-auto px-3 py-1.5 text-sm rounded-lg font-medium transition ${isDarkMode ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'}`}
                          >
                              Cancel
                          </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                          {aiSelectedElement.elements.map((element, index) => (
                              <button
                                  key={index}
                                  onClick={() => handleConfirmSelection(true, index + 1)}
                                  className={`flex items-center gap-3 p-2 rounded-lg text-left transition ${isDarkMode ? 'hover:bg-neutral-700' : 'hover:bg-neutral-50'}`}
                              >
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isDarkMode ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'}`}>
                                      {index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <code className={`text-xs font-mono ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>{element.tagName}</code>
                                      {element.text && (
                                          <span className={`ml-2 text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                              "{element.text.substring(0, 50)}{element.text.length > 50 ? '...' : ''}"
                                          </span>
                                      )}
                                  </div>
                              </button>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* Pending Code Change Preview - 3 Button Popup */}
      {(pendingChange?.source === 'dom' || pendingChange?.source === 'code') && (
          <div className={`absolute bottom-24 left-1/2 transform -translate-x-1/2 flex items-center gap-2 rounded-full shadow-xl p-2 z-50 ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
              {/* Diff Stats */}
              <div className="flex items-center gap-1.5 px-2 text-xs font-mono">
                  <span className="text-green-500">+{pendingChange.additions}</span>
                  <span className="text-red-500">-{pendingChange.deletions}</span>
              </div>
              <div className={`w-[1px] h-6 ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-200'}`}></div>
              <button
                  onMouseDown={() => {
                    const webview = webviewRefs.current.get(activeTabId);
                    if (pendingChange.undoCode && webview) {
                      console.log('[Preview] Showing original');
                      webview.executeJavaScript(pendingChange.undoCode);
                      setIsPreviewingOriginal(true);
                    }
                  }}
                  onMouseUp={() => {
                    const webview = webviewRefs.current.get(activeTabId);
                    if (pendingChange.code && webview) {
                      console.log('[Preview] Showing change');
                      webview.executeJavaScript(pendingChange.code);
                      setIsPreviewingOriginal(false);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isPreviewingOriginal) return;
                    const webview = webviewRefs.current.get(activeTabId);
                    if (pendingChange.code && webview) {
                      console.log('[Preview] Showing change (mouse leave)');
                      webview.executeJavaScript(pendingChange.code);
                      setIsPreviewingOriginal(false);
                    }
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-600'}`}
                  title="Hold to see original"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <div className={`w-[1px] h-6 ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-200'}`}></div>
              <button
                  onClick={pendingDOMApproval ? handleRejectDOMApproval : handleRejectChange}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-red-900/20 text-neutral-400 hover:text-red-400' : 'hover:bg-red-50 text-neutral-600 hover:text-red-600'}`}
                  title="Discard changes"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
              <button
                  onClick={pendingDOMApproval ? handleAcceptDOMApproval : handleApproveChange}
                  disabled={isGeneratingSourcePatch}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-colors disabled:opacity-50 ${
                    isGeneratingSourcePatch
                      ? 'cursor-not-allowed'
                      : (isDarkMode ? 'bg-neutral-100 text-neutral-900 hover:bg-white' : 'bg-neutral-900 text-white hover:bg-neutral-800')
                  }`}
                  title="Apply changes"
              >
                  {isGeneratingSourcePatch ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  )}
              </button>
          </div>
      )}

      {/* Screenshot Preview Modal */}
      {showScreenshotPreview && capturedScreenshot && (
          <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={() => setShowScreenshotPreview(false)}
          >
              <div className="relative max-w-4xl max-h-[90vh] p-4">
                  <button
                      onClick={() => setShowScreenshotPreview(false)}
                      className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
                      title="Close preview"
                  >
                      <X size={24} />
                  </button>
                  <img
                      src={capturedScreenshot}
                      alt="Screenshot preview"
                      className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                  />
              </div>
          </div>
      )}

      {/* Hidden Media Elements */}
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="hidden" />


      {/* File Browser Overlay */}
      {fileBrowserVisible && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 z-[100] backdrop-blur-md"
            onClick={closeFileBrowser}
          />

          {/* Stacked Panels */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
            {fileBrowserStack.map((panel, index) => {
              const isActive = index === fileBrowserStack.length - 1;
              const stackOffset = (fileBrowserStack.length - 1 - index) * 350; // Much bigger offset

              // Get file icon based on extension
              const getFileIcon = (name: string, isDir: boolean) => {
                if (isDir) return <Folder size={18} className="text-blue-400" />;
                const ext = name.split('.').pop()?.toLowerCase() || '';
                if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext))
                  return <Image size={18} className="text-purple-400" />;
                if (['ts', 'tsx'].includes(ext))
                  return <FileCode size={18} className="text-blue-400" />;
                if (['js', 'jsx'].includes(ext))
                  return <FileCode size={18} className="text-yellow-400" />;
                if (['css', 'scss', 'less'].includes(ext))
                  return <Palette size={18} className="text-pink-400" />;
                if (['json', 'yaml', 'yml', 'toml'].includes(ext))
                  return <Settings size={18} className="text-orange-400" />;
                if (['md', 'txt', 'mdx'].includes(ext))
                  return <FileText size={18} className="text-neutral-400" />;
                if (['html', 'htm'].includes(ext))
                  return <Globe size={18} className="text-orange-400" />;
                return <File size={18} className="text-neutral-500" />;
              };

              return (
                <div
                  key={`${panel.path}-${index}`}
                  className={`absolute pointer-events-auto transition-all duration-500 ease-out backdrop-blur-xl border rounded-xl shadow-2xl overflow-hidden ${
                    isDarkMode
                      ? 'bg-neutral-900/80 border-white/10'
                      : 'bg-white/80 border-black/10'
                  }`}
                  style={{
                    width: panel.type === 'image' ? 'auto' : '480px',
                    maxWidth: '90vw',
                    maxHeight: '60vh',
                    transform: isActive
                      ? 'translateX(0) scale(1)'
                      : `translateX(-${stackOffset}px) scale(0.95)`,
                    opacity: isActive ? 1 : 0.4,
                    zIndex: index,
                  }}
                >
                  {/* Header - Compact */}
                  <div className={`flex items-center gap-2 px-3 py-2 border-b ${
                    isDarkMode ? 'border-white/10' : 'border-black/5'
                  }`}>
                    <button
                      onClick={fileBrowserBack}
                      className={`p-1 rounded transition ${
                        isDarkMode ? 'hover:bg-white/10 text-neutral-400' : 'hover:bg-black/5 text-neutral-500'
                      }`}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
                        {panel.title}
                      </div>
                    </div>
                    <button
                      onClick={closeFileBrowser}
                      className={`p-1 rounded transition ${
                        isDarkMode ? 'hover:bg-white/10 text-neutral-400' : 'hover:bg-black/5 text-neutral-500'
                      }`}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 44px)' }}>
                    {panel.type === 'directory' && panel.items && (
                      <div className="py-1">
                        {panel.items.length === 0 ? (
                          <div className={`text-center py-6 text-sm ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            Empty folder
                          </div>
                        ) : (
                          panel.items.map((item, itemIndex) => (
                            <button
                              key={item.path}
                              onClick={() => openFileBrowserItem(itemIndex + 1)}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
                                isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5'
                              }`}
                            >
                              {/* Number badge */}
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/10 text-blue-600'
                              }`}>
                                {itemIndex + 1}
                              </div>
                              {/* Icon */}
                              <div className="flex-shrink-0">
                                {getFileIcon(item.name, item.isDirectory)}
                              </div>
                              {/* Name */}
                              <div className={`flex-1 min-w-0 text-sm truncate ${
                                isDarkMode ? 'text-white' : 'text-neutral-900'
                              }`}>
                                {item.name}
                              </div>
                              {/* Arrow for folders */}
                              {item.isDirectory && (
                                <ChevronRight size={16} className={isDarkMode ? 'text-neutral-600' : 'text-neutral-400'} />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {panel.type === 'file' && panel.content && (
                      <pre className={`p-3 text-xs font-mono overflow-x-auto ${
                        isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
                      }`}>
                        {panel.content}
                      </pre>
                    )}

                    {panel.type === 'image' && (
                      <div className="p-3 flex items-center justify-center">
                        <img
                          src={`file://${panel.path}`}
                          alt={panel.title}
                          className="max-w-full max-h-[50vh] object-contain rounded"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Voice hint */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[102] pointer-events-none">
            <div className={`px-3 py-1.5 rounded-full text-xs backdrop-blur-xl ${
              isDarkMode ? 'bg-white/10 text-white/60' : 'bg-black/10 text-black/60'
            }`}>
              "open 3" / "open App.tsx" / "open src folder" / "go back" / "close"
            </div>
          </div>
        </>
      )}

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        settings={appSettings}
        onSettingsChange={setAppSettings}
        projectPath={activeTab?.projectPath}
      />

      {/* Mgrep Onboarding Demo */}
      {showMgrepOnboarding && (
        <MgrepOnboardingDemo
          isDarkMode={isDarkMode}
          onAccept={() => {
            const projectPath = activeTab?.projectPath
            if (projectPath && window.electronAPI?.mgrep) {
              window.electronAPI.mgrep.initialize(projectPath)
            }
            setShowMgrepOnboarding(false)
          }}
          onDecline={() => {
            setShowMgrepOnboarding(false)
          }}
          onClose={() => {
            localStorage.setItem('mgrep-onboarding-seen', 'true')
            setShowMgrepOnboarding(false)
          }}
        />
      )}

      {/* Patch Approval Dialog */}
      <PatchApprovalDialog
        patch={pendingPatches[currentPatchIndex] || null}
        onApprove={handleApprovePatch}
        onReject={handleRejectPatch}
        onEdit={handleEditPatch}
        projectPath={activeTab?.projectPath || 'default'}
        isOpen={isApprovalDialogOpen}
        totalPatches={pendingPatches.length}
        currentPatchIndex={currentPatchIndex}
      />

      {/* Error Solution Panel - shows detected errors with auto-prefetched solutions */}
      <ErrorSolutionPanel
        errors={errors}
        isVisible={errorPanelVisible}
        onToggle={() => setErrorPanelVisible(!errorPanelVisible)}
        onRemoveError={removeError}
        onSearchForSolution={searchForSolution}
        onClearAll={clearErrors}
      />

      {/* Error Badge in Tab Bar - quick access to error count */}
      {errors.length > 0 && (
        <button
          className="fixed top-12 right-6 z-40 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105"
          onClick={() => setErrorPanelVisible(!errorPanelVisible)}
          style={{
            backgroundColor: errors.some(e => e.isCritical) ? '#ef4444' : '#f59e0b',
            color: 'white'
          }}
          title={`${errors.length} error${errors.length !== 1 ? 's' : ''} detected`}
        >
          {errors.length > 0 && errors.some(e => e.solution) && '✓'} {errors.length}
        </button>
      )}

      </div>
    </div>
  );
}

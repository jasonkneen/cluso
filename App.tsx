
import React, { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useLiveGemini } from './hooks/useLiveGemini';
import { useGit } from './hooks/useGit';
import { useTheme } from './hooks/useTheme';
import { INJECTION_SCRIPT } from './utils/iframe-injection';
import { SelectedElement, Message as ChatMessage, ToolUsage } from './types';
import { TabState, createNewTab } from './types/tab';
import { TabBar, Tab, TabType } from './components/TabBar';
import { NewTabPage, addToRecentProjects, getRecentProject } from './components/NewTabPage';
import { KanbanColumn, TodoItem } from './types/tab';
import { ProjectSetupFlow } from './components/ProjectSetupFlow';
import type { AppSettings } from './components/SettingsDialog';
import { DEFAULT_SETTINGS, getFontSizeValue } from './components/SettingsDialog';

// Lazy-loaded heavy components for code splitting
const KanbanTab = lazy(() => import('./components/tabs/KanbanTab').then(m => ({ default: m.KanbanTab })));
const TodosTab = lazy(() => import('./components/tabs/TodosTab').then(m => ({ default: m.TodosTab })));
const NotesTab = lazy(() => import('./components/tabs/NotesTab').then(m => ({ default: m.NotesTab })));
const SettingsDialog = lazy(() => import('./components/SettingsDialog').then(m => ({ default: m.SettingsDialog })));
const ViewportGrid = lazy(() => import('./components/multi-viewport/ViewportGrid').then(m => ({ default: m.ViewportGrid })));

// Loading spinner fallback for Suspense boundaries
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-neutral-600" />
    </div>
  );
}

import { MgrepOnboardingDemo } from './components/MgrepOnboarding';
import type { Viewport } from './components/multi-viewport/types';
import type { LayoutDirection } from './components/multi-viewport/canvas/elkLayout';
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
import { useClusoAgent, AVAILABLE_DEMOS, DEMO_SCRIPTS } from './hooks/useClusoAgent';
import { useSteeringQuestions } from './hooks/useSteeringQuestions';
import { SteeringQuestions } from './components/SteeringQuestions';
import { useChatState } from './features/chat';
import { generateTurnId } from './utils/turnUtils';
import { createToolError, formatErrorForDisplay } from './utils/toolErrorHandler';
import { PatchApprovalDialog } from './components/PatchApprovalDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LeftSidebar } from './components/LeftSidebar';
import type { SelectedElementSourceSnippet } from './components/LeftSidebar';
import type { TreeNode } from './components/ComponentTree';
import { DEFAULT_ELEMENT_STYLES, type ElementStyles } from './types/elementStyles';
import { FilePanel } from './components/FilePanel';
import { TabbedLeftPanel } from './components/TabbedLeftPanel';
import { CodeEditor } from './components/CodeEditor';

import { getElectronAPI } from './hooks/useElectronAPI';
import type { MCPServerConfig } from './types/mcp';
import type { MCPServerConnection } from './components/SettingsDialog';
import type { ExtensionChatRequest } from './types/electron.d';
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
  Bot,
  LayoutGrid,
  ScreenShare,
  KanbanSquare,
  ListTodo,
  StickyNote,
  Maximize,
  AlignHorizontalSpaceAround,
  Ghost,
  Layers,
  Calendar,
} from 'lucide-react';
import { generateSourcePatch, SourcePatch } from './utils/generateSourcePatch';
import { useErrorPrefetch } from './hooks/useErrorPrefetch';
import { ErrorSolutionPanel } from './components/ErrorSolutionPanel';
import { fileService } from './services/FileService';
// ViewportGrid lazy-loaded below with other heavy components
import { TodoListOverlay } from './components/TodoListOverlay';

// --- Utility Imports ---
import { getLuminance, adjustBrightness } from './utils/colorUtils';
import { formatRelativeTime } from './utils/timeUtils';
import { formatElementContext, buildInstantUIPrompt } from './utils/elementContext';
import { generateUIUpdate, type UIUpdateResult } from './utils/uiUpdate';
import { getTargetOrigin } from './utils/webviewMessaging';
import { groupConsecutiveTools, type ToolCallItem, type GroupedTool } from './utils/toolGrouping';
import {
  ClaudeIcon,
  AnthropicIcon,
  OpenAIIcon,
  GeminiIcon,
  type IconComponent,
  MODEL_ICONS,
  PROVIDER_ICONS,
  getModelIcon,
  getShortModelName,
  DEFAULT_MODEL,
  MODELS,
} from './utils/modelIcons';

// --- Constants ---

const DEFAULT_URL = ''; // Empty string shows project selection (NewTabPage)

// ============================================================================
// GroupedToolChips Component - Groups consecutive same-type tool calls
// e.g., [grep x3] instead of [grep] [grep] [grep]
// ============================================================================
function GroupedToolChips({
  toolCalls,
  isDarkMode,
  isStreaming = false,
}: {
  toolCalls: ToolCallItem[]
  isDarkMode: boolean
  isStreaming?: boolean
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const groups = useMemo(() => groupConsecutiveTools(toolCalls), [toolCalls])

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }, [])

  const getChipStyle = (status: string, isGroup = false) => {
    if (status === 'running') {
      return isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
    }
    if (status === 'error') {
      return isDarkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
    }
    return isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
  }

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {groups.map((group, groupIdx) => {
        const groupKey = `${group.name}-${groupIdx}`
        const isExpanded = expandedGroups.has(groupKey)
        const showGrouped = group.count > 1 && !isExpanded

        if (showGrouped) {
          // Render grouped chip: [read_file x3]
          const groupStatus = group.hasRunning ? 'running' : group.hasError ? 'error' : 'complete'
          return (
            <button
              key={groupKey}
              onClick={() => toggleGroup(groupKey)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer hover:opacity-80 ${getChipStyle(groupStatus, true)}`}
              title={`Click to expand ${group.count} ${group.name} calls`}
            >
              {group.hasRunning && <Loader2 size={10} className="animate-spin" />}
              {!group.hasRunning && !group.hasError && <Check size={10} />}
              {!group.hasRunning && group.hasError && <X size={10} />}
              <span className="font-mono">{group.name}</span>
              <span className={`text-[9px] px-1 rounded ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`}>
                ×{group.count}
              </span>
            </button>
          )
        }

        // Render individual chips (either single tool or expanded group)
        return (
          <React.Fragment key={groupKey}>
            {group.count > 1 && isExpanded && (
              <button
                onClick={() => toggleGroup(groupKey)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all cursor-pointer ${
                  isDarkMode ? 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600' : 'bg-stone-200 text-stone-500 hover:bg-stone-300'
                }`}
                title="Collapse group"
              >
                <ChevronDown size={8} />
              </button>
            )}
            {group.tools.map((tool, idx) => (
              <div
                key={tool.id || `${groupKey}-${idx}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${getChipStyle(tool.status)}`}
              >
                {tool.status === 'running' && <Loader2 size={10} className="animate-spin" />}
                {(tool.status === 'done' || tool.status === 'complete' || tool.status === 'success') && <Check size={10} />}
                {tool.status === 'error' && <X size={10} />}
                <span className="font-mono">{tool.name}</span>
              </div>
            ))}
          </React.Fragment>
        )
      })}
    </div>
  )
}

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
  contentWindow: Window | null;
  capturePage: (rect?: { x: number; y: number; width: number; height: number }) => Promise<{ toDataURL: () => string }>;
  getWebContentsId: () => number;
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

    // Clear chat history and stop file watcher for the closed tab
    if (tabToClose?.projectPath) {
      setMessages([]);
      setSelectedFiles([]);
      setSelectedElement(null);
      // Stop file watcher for this project
      window.electronAPI?.fileWatcher?.stop(tabToClose.projectPath).catch((err: Error) => {
        console.error('[App] Failed to stop file watcher:', err);
      });
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

  // Handle extension chat requests (Chrome extension communication)
  useEffect(() => {
    if (!window.electronAPI?.extensionBridge) return;

    // Check initial connection status and poll periodically
    const checkStatus = async () => {
      try {
        const status = await window.electronAPI.extensionBridge?.getStatus();
        setExtensionConnected(status?.connected ?? false);
      } catch {
        setExtensionConnected(false);
      }
    };

    checkStatus();
    const statusInterval = setInterval(checkStatus, 5000); // Check every 5 seconds

    const handleChatRequest = async (request: ExtensionChatRequest) => {
      console.log('[ExtensionBridge] Chat request:', request.requestId, request.message);
      setExtensionConnected(true); // If we receive a request, we're connected

      try {
        // Build context from selected elements
        const elementContext = request.elements.length > 0
          ? `\n\nSelected elements:\n${request.elements.map(el =>
              `- ${el.tagName} (${el.label})${el.fullInfo ? `: ${JSON.stringify(el.fullInfo)}` : ''}`
            ).join('\n')}`
          : '';

        const pageContext = `Page: ${request.pageTitle} (${request.pageUrl})`;

        // Use aiSdk.generate if available
        if (window.electronAPI.aiSdk?.generate) {
          const result = await window.electronAPI.aiSdk.generate({
            messages: [{
              role: 'user',
              content: `${request.message}\n\n${pageContext}${elementContext}`
            }],
            modelId: selectedModelRef.current.id, // Use selected model, not hardcoded Gemini
            providers: {}, // Providers are loaded from settings in the main process
            system: 'You are Cluso, a helpful AI assistant for web development. The user is inspecting elements on a web page and may ask questions about them or request changes. Keep responses concise.',
          });

          if (result.success && result.text) {
            await window.electronAPI.extensionBridge?.sendChatResponse(request.requestId, result.text);
            console.log('[ExtensionBridge] Response sent for:', request.requestId);
          } else {
            await window.electronAPI.extensionBridge?.sendChatResponse(request.requestId, undefined, result.error || 'Failed to generate response');
          }
        } else {
          // Fallback: return a helpful message
          await window.electronAPI.extensionBridge?.sendChatResponse(
            request.requestId,
            `I received your message about ${request.elements.length} element(s) on "${request.pageTitle}". AI generation is not currently available.`
          );
        }
      } catch (err) {
        console.error('[ExtensionBridge] Chat error:', err);
        await window.electronAPI.extensionBridge?.sendChatResponse(
          request.requestId,
          undefined,
          err instanceof Error ? err.message : 'Unknown error'
        );
      }
    };

    const unsubscribe = window.electronAPI.extensionBridge.onChatRequest(handleChatRequest);
    console.log('[ExtensionBridge] Chat request listener registered');

    return () => {
      unsubscribe?.();
      clearInterval(statusInterval);
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
            setIndexingStatus('indexing')
            window.electronAPI.mgrep.initialize(projectPath).then(() => {
              // Mark as initialized - won't init again even if we switch back to this tab
              mgrepInitializedProjects.current.add(projectPath)
              setIndexingStatus('indexed')
              console.log('[mgrep] ✓ Initialized for:', projectPath)
            }).catch(err => {
              console.error('[mgrep] Auto-init failed:', err)
              setIndexingStatus('idle')
            })
          } else {
            // User opted out - mark as "handled" so we don't keep checking
            mgrepInitializedProjects.current.add(projectPath)
          }
        } else if (result.success && result.status && result.status.ready) {
          // Already initialized - mark it so we don't check again
          mgrepInitializedProjects.current.add(projectPath)
          setIndexingStatus('indexed')
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

  // Convert TabState to Tab for TabBar - only show browser tabs (kanban/todos/notes are internal windows)
  const tabBarTabs: Tab[] = tabs
    .filter(t => t.type === 'browser' || !t.type)
    .map(t => ({
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
  const [selectedElementSourceSnippet, setSelectedElementSourceSnippet] = useState<SelectedElementSourceSnippet>(null);

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
  const [isFloatingToolbarVisible, setIsFloatingToolbarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);

  // Left panel (Layers) state
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const isLeftPanelOpenRef = useRef(false);
  useEffect(() => { isLeftPanelOpenRef.current = isLeftPanelOpen; }, [isLeftPanelOpen]);
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [isLeftResizing, setIsLeftResizing] = useState(false);

  // Code editor state (center pane)
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [editorFilePath, setEditorFilePath] = useState<string | null>(null);
  const [editorFileContent, setEditorFileContent] = useState<string>('');
  const [editorInitialLine, setEditorInitialLine] = useState<number | undefined>(undefined);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  // Keyboard shortcut: Escape to exit editor mode
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditorMode) {
        setIsEditorMode(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isEditorMode])
  const [layersTreeData, setLayersTreeData] = useState<import('./components/ComponentTree').TreeNode | null>(null);
  const layersTreeDataRef = useRef<import('./components/ComponentTree').TreeNode | null>(null);
  useEffect(() => { layersTreeDataRef.current = layersTreeData; }, [layersTreeData]);
  const [selectedTreeNodeId, setSelectedTreeNodeId] = useState<string | null>(null);
  const [isLayersLoading, setIsLayersLoading] = useState(false);
  const isLayersLoadingRef = useRef(false)
  useEffect(() => { isLayersLoadingRef.current = isLayersLoading }, [isLayersLoading])
  const [multiViewportData, setMultiViewportData] = useState<Array<{ id: string; windowType: string; devicePresetId?: string }>>([]);
  const [selectedLayerElementNumber, setSelectedLayerElementNumber] = useState<number | null>(null)
  const [selectedLayerElementName, setSelectedLayerElementName] = useState<string | null>(null)
  const selectedLayerElementNumberRef = useRef<number | null>(null)
  useEffect(() => { selectedLayerElementNumberRef.current = selectedLayerElementNumber }, [selectedLayerElementNumber])
  const layersTreeStaleRef = useRef(false)

  const [elementStyles, setElementStyles] = useState<ElementStyles>(DEFAULT_ELEMENT_STYLES)
  const elementStylesRef = useRef<ElementStyles>(DEFAULT_ELEMENT_STYLES)
  useEffect(() => { elementStylesRef.current = elementStyles }, [elementStyles])
  const applyElementStylesTimerRef = useRef<number | null>(null)
  const [selectedLayerComputedStyles, setSelectedLayerComputedStyles] = useState<Record<string, string> | null>(null)
  const [selectedLayerAttributes, setSelectedLayerAttributes] = useState<Record<string, string> | null>(null)
  const [selectedLayerDataset, setSelectedLayerDataset] = useState<Record<string, string> | null>(null)
  const [selectedLayerFontFamilies, setSelectedLayerFontFamilies] = useState<string[] | null>(null)
  const [selectedLayerClassNames, setSelectedLayerClassNames] = useState<string[] | null>(null)

  // Avoid referencing `isElectron` before it is initialized (it is declared later in this file).
	const isElectronEnv = typeof window !== 'undefined' && !!window.electronAPI?.isElectron

	const resolveSourceFilePath = useCallback((projectPath: string, raw: string) => {
		let file = String(raw || '').trim()
		if (!file) return { absPath: '', displayPath: '' }

		let fromHttpUrl = false
		let fromFileUrl = false
		try {
			if (file.startsWith('http://') || file.startsWith('https://')) {
				const u = new URL(file)
				file = u.pathname
				fromHttpUrl = true
			} else if (file.startsWith('file://')) {
				const u = new URL(file)
				file = u.pathname
				fromFileUrl = true
			}
		} catch (e) {
			// ignore
		}

		// Drop any query/hash noise from sourcemap-style URLs.
		file = file.split('?')[0].split('#')[0]
		file = file.replace(/^webpack-internal:\/\//, '')
			file = file.replace(/^webpack:\/{3}/, '') // webpack:///src/App.tsx
		file = file.replace(/^webpack:\/\//, '') // webpack://src/App.tsx
		// Fallback if URL parsing failed (keeps old behavior for file:// URLs)
		file = file.replace(/^file:\/\//, '')
		// Vite dev URLs can show file system paths as /@fs/Users/...; normalize back.
		file = file.replace(/^\/@fs\//, '/')

		const displayPath = fromHttpUrl ? file.replace(/^\/+/, '') : file

		const isWindowsAbs = /^[A-Z]:\\/.test(file)
		const isPosixAbs = file.startsWith('/')

		// IMPORTANT: If a file path came from an http(s) URL, its pathname is *project-relative*.
		// Also treat /src/... as project-relative, since this is a common URL pathname shape.
		const treatPosixAbsAsProjectRelative =
			!!projectPath &&
			isPosixAbs &&
			!fromFileUrl &&
			(fromHttpUrl || file.startsWith('/src/'))

		const absPath =
			isWindowsAbs || (isPosixAbs && !treatPosixAbsAsProjectRelative)
				? file
				: `${projectPath}/${file.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/')
		return { absPath, displayPath }
	}, [])

  const getCodeLanguageFromPath = useCallback((path: string) => {
    const ext = (path.split('.').pop() || '').toLowerCase()
    if (ext === 'tsx') return 'tsx'
    if (ext === 'ts') return 'typescript'
    if (ext === 'jsx') return 'jsx'
    if (ext === 'js') return 'javascript'
    if (ext === 'html' || ext === 'htm') return 'html'
    if (ext === 'css') return 'css'
    if (ext === 'json') return 'json'
    if (ext === 'md' || ext === 'markdown') return 'markdown'
    return 'tsx'
  }, [])

  useEffect(() => {
    let cancelled = false
    const src0 = selectedElement?.sourceLocation?.sources?.[0] as { file?: string; line?: number } | undefined
    const rawFile = src0?.file
    const rawLine = src0?.line
    const projectPath = activeTab.projectPath

    if (!isElectronEnv || !projectPath || !rawFile || !rawLine) {
      setSelectedElementSourceSnippet(null)
      return
    }

    const { absPath, displayPath } = resolveSourceFilePath(projectPath, rawFile)
    if (!absPath) {
      setSelectedElementSourceSnippet(null)
      return
    }

    fileService.readFileFull(absPath).then((result: { success: boolean; data?: string; error?: string }) => {
      if (cancelled) return
      if (!result.success || typeof result.data !== 'string') {
        setSelectedElementSourceSnippet(null)
        return
      }

      const allLines = result.data.split('\n')
      const focusLine = Math.max(1, Math.min(allLines.length, Number(rawLine) || 1))
      const startLine = Math.max(1, focusLine - 12)
      const endLine = Math.min(allLines.length, focusLine + 28)
      const code = allLines.slice(startLine - 1, endLine).join('\n')

      setSelectedElementSourceSnippet({
        filePath: absPath,
        displayPath,
        startLine,
        focusLine,
        language: getCodeLanguageFromPath(displayPath),
        code,
      })
    }).catch(() => {
      if (!cancelled) setSelectedElementSourceSnippet(null)
    })

    return () => {
      cancelled = true
    }
  }, [selectedElement?.sourceLocation?.sources?.[0]?.file, selectedElement?.sourceLocation?.sources?.[0]?.line, activeTab.projectPath, isElectronEnv, resolveSourceFilePath, getCodeLanguageFromPath])

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

  // Add Todo State (for mini chat popup)
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [todoPriority, setTodoPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [todoDueDate, setTodoDueDate] = useState<string>('');

  // Todo Overlay State
  const [showTodoOverlay, setShowTodoOverlay] = useState(false);

  // Auto-show floating chat when element is selected
  useEffect(() => {
    if (selectedElement && !isSidebarOpen) {
      setShowElementChat(true);
    }
  }, [selectedElement, isSidebarOpen]);

  // File Selection State (@ commands)
  const [selectedFiles, setSelectedFiles] = useState<Array<{
    path: string;
    content: string;
    displayName?: string;  // Clean filename for display (no query params)
    elementType?: string;  // e.g., "Button", "Section", "Component"
    lineStart?: number;
    lineEnd?: number;
  }>>([]);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [showFileAutocomplete, setShowFileAutocomplete] = useState(false);
  const [directoryFiles, setDirectoryFiles] = useState<Array<{name: string; path: string; isDirectory: boolean}>>([]);
  const [currentDirectory, setCurrentDirectory] = useState<string>('');
  const [directoryStack, setDirectoryStack] = useState<string[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);

  // Helper to format file display: "LandingPage.tsx / Button (1426-31)"
  const formatFileDisplay = useCallback((file: typeof selectedFiles[0]): string => {
    // Get clean filename (remove query params like ?t=...)
    const rawName = file.path.split('/').pop() || file.path;
    const cleanName = rawName.split('?')[0];

    // Build display parts
    let display = cleanName;

    // Add element type if available
    if (file.elementType) {
      display += ` / ${file.elementType}`;
    }

    // Add line range if available (compact format: 1426-31 instead of 1426-1431)
    if (file.lineStart !== undefined) {
      if (file.lineEnd !== undefined && file.lineEnd !== file.lineStart) {
        // Compact line range: if same prefix, show shortened end
        const startStr = file.lineStart.toString();
        const endStr = file.lineEnd.toString();
        // Find common prefix length
        let commonLen = 0;
        while (commonLen < startStr.length && commonLen < endStr.length &&
               startStr[commonLen] === endStr[commonLen]) {
          commonLen++;
        }
        // Show shortened end if they share a prefix
        const shortEnd = commonLen > 0 ? endStr.slice(commonLen) : endStr;
        display += ` (${startStr}-${shortEnd})`;
      } else {
        display += ` (${file.lineStart})`;
      }
    }

    return display;
  }, []);

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

  // Cluso Agent - initialized below after appSettings
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);

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

  // Indexing Status
  const [indexingStatus, setIndexingStatus] = useState<'idle' | 'indexing' | 'indexed'>('idle');

  // Extension Bridge Status (Chrome extension connected)
  const [extensionConnected, setExtensionConnected] = useState(false);

  // Extension cursor sharing state
  const [extensionSharing, setExtensionSharing] = useState(false);
  const [extensionCursor, setExtensionCursor] = useState<{
    elementAnchor?: {
      selector: string;
      relativeX: number;
      relativeY: number;
      elementText?: string;
    };
    viewportPercentX?: number;
    viewportPercentY?: number;
    pageX: number; pageY: number;
    clientX: number; clientY: number;
    scrollX: number; scrollY: number;
    viewportWidth: number; viewportHeight: number;
    documentWidth: number; documentHeight: number;
    pageUrl: string;
    timestamp?: number;
  } | null>(null);

  // Send Cluso's cursor to extension when sharing is active
  useEffect(() => {
    if (!extensionSharing || !window.electronAPI?.extensionBridge?.sendCursor) return;

    let lastUpdate = 0;
    const handleMouseMove = (e: MouseEvent) => {
      // Throttle to 30fps
      const now = Date.now();
      if (now - lastUpdate < 33) return;
      lastUpdate = now;

      // Send cursor data to extension
      window.electronAPI?.extensionBridge?.sendCursor?.({
        pageX: e.pageX,
        pageY: e.pageY,
        clientX: e.clientX,
        clientY: e.clientY,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        pageUrl: activeTab?.url || window.location.href,
      });
    };

    // Track cursor movement across the app
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [extensionSharing, activeTab?.url]);
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

  // Cluso Agent - AI control of UI elements (must be after appSettings)
  const clusoAgent = useClusoAgent({
    googleApiKey: appSettings.providers.find(p => p.id === 'google')?.apiKey,
  });

  // Persist settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('cluso-settings', JSON.stringify(appSettings));
    } catch (e) {
      console.error('Failed to save settings to localStorage:', e);
    }
  }, [appSettings]);

  // Keep a ref for callbacks that intentionally have empty deps.
  const appSettingsRef = useRef(appSettings)
  useEffect(() => {
    appSettingsRef.current = appSettings
  }, [appSettings])

  // Apply Electron window appearance settings
  useEffect(() => {
    const isElectronEnv = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
    if (!isElectronEnv || !window.electronAPI?.window?.setAppearance) return;
    window.electronAPI.window.setAppearance({
      transparencyEnabled: !!appSettings.transparencyEnabled,
      opacity: appSettings.windowOpacity,
      blur: appSettings.windowBlur,
    }).catch((err: unknown) => {
      console.warn('[App] Failed to apply window appearance:', err);
    });
  }, [appSettings.transparencyEnabled, appSettings.windowOpacity, appSettings.windowBlur]);


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
  const cancelledApprovalsRef = useRef<Set<string>>(new Set())
  // Per-approval timeout tracking to avoid false timeout logs after success/cancel.
  const domApprovalPatchTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const domApprovalPatchTimeoutTokensRef = useRef<Map<string, string>>(new Map())
  const [isGeneratingSourcePatch, setIsGeneratingSourcePatch] = useState(false)

  const clearDomApprovalPatchTimeout = useCallback((approvalId: string) => {
    const handle = domApprovalPatchTimeoutsRef.current.get(approvalId)
    if (handle) {
      clearTimeout(handle)
      domApprovalPatchTimeoutsRef.current.delete(approvalId)
    }
    domApprovalPatchTimeoutTokensRef.current.delete(approvalId)
  }, [])

  type DomEditTelemetryEvent =
    | 'preview_applied'
    | 'patch_generation_started'
    | 'patch_ready'
    | 'patch_failed'
    | 'user_accept'
    | 'user_reject'
    | 'auto_cancel'
    | 'source_write_started'
    | 'source_write_succeeded'
    | 'source_write_failed'

  type DomEditTelemetry = {
    id: string
    createdAtMs: number
    tabId: string
    elementXpath?: string
    events: Partial<Record<DomEditTelemetryEvent, number>>
  }

  const domEditTelemetryRef = useRef<Record<string, DomEditTelemetry>>({})
  const domEditContextRef = useRef<{ id: string; tabId: string; elementXpath?: string } | null>(null)

  const nowMs = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now()
    return Date.now()
  }

  const ensureDomTelemetry = useCallback((id: string, init?: Partial<DomEditTelemetry>) => {
    if (!domEditTelemetryRef.current[id]) {
      domEditTelemetryRef.current[id] = {
        id,
        createdAtMs: nowMs(),
        tabId: init?.tabId || String(activeTabId),
        elementXpath: init?.elementXpath,
        events: {},
      }
    }
    const existing = domEditTelemetryRef.current[id]
    domEditTelemetryRef.current[id] = {
      ...existing,
      ...init,
      events: { ...existing.events, ...(init?.events || {}) },
    }
  }, [activeTabId])

  const markDomTelemetry = useCallback((id: string, event: DomEditTelemetryEvent) => {
    ensureDomTelemetry(id)
    const telemetry = domEditTelemetryRef.current[id]
    if (!telemetry.events[event]) {
      telemetry.events[event] = nowMs()
    }
  }, [ensureDomTelemetry])

  const finalizeDomTelemetry = useCallback((id: string, outcome: 'accepted' | 'rejected' | 'cancelled') => {
    const telemetry = domEditTelemetryRef.current[id]
    if (!telemetry) return
    const e = telemetry.events
    const ms = (a?: number, b?: number) => (a !== undefined && b !== undefined) ? Math.round(b - a) : undefined

    const summary = {
      outcome,
      tabId: telemetry.tabId,
      xpath: telemetry.elementXpath,
      previewToPatchReadyMs: ms(e.preview_applied, e.patch_ready),
      patchGenMs: ms(e.patch_generation_started, e.patch_ready ?? e.patch_failed),
      acceptToWriteMs: ms(e.user_accept, e.source_write_succeeded ?? e.source_write_failed),
      createdToEndMs: ms(telemetry.createdAtMs, e.source_write_succeeded ?? e.source_write_failed ?? e.user_reject ?? e.auto_cancel ?? e.patch_failed),
    }

    console.log('[Telemetry][DOM Edit]', id, summary)
    cancelledApprovalsRef.current.delete(id)
    delete domEditTelemetryRef.current[id]
  }, [])

  const cancelDomApprovalValue = useCallback((
    approval: PendingDOMApproval,
    params: { tabIdForUndo: string; reason: 'superseded' | 'context_change' }
  ) => {
    const { tabIdForUndo, reason } = params
    const webview = webviewRefs.current.get(tabIdForUndo)

    console.log('[DOM Approval] Cancelling pending change:', { id: approval.id, reason })
    clearDomApprovalPatchTimeout(approval.id)
    markDomTelemetry(approval.id, 'auto_cancel')
    cancelledApprovalsRef.current.add(approval.id)
    if (approval.undoCode && webview) {
      ;(webview as unknown as Electron.WebviewTag).executeJavaScript(approval.undoCode)
    }
    finalizeDomTelemetry(approval.id, 'cancelled')
  }, [markDomTelemetry, finalizeDomTelemetry, clearDomApprovalPatchTimeout])

  const cancelPendingDomApproval = useCallback((reason: 'superseded' | 'context_change') => {
    if (!pendingDOMApproval) return
    if (pendingDOMApproval.userApproved || isGeneratingSourcePatch) return

    const ctx = domEditContextRef.current
    const tabIdForUndo = ctx?.id === pendingDOMApproval.id ? ctx.tabId : String(activeTabId)
    cancelDomApprovalValue(pendingDOMApproval, { tabIdForUndo, reason })
    setPendingDOMApproval(null)
    setPendingChange(null)
  }, [pendingDOMApproval, isGeneratingSourcePatch, activeTabId, cancelDomApprovalValue])

  // Latest-wins: if a new DOM approval replaces an older pending one, auto-cancel the older preview.
  const lastPendingDomApprovalRef = useRef<PendingDOMApproval | null>(null)
  useEffect(() => {
    const prev = lastPendingDomApprovalRef.current
    const next = pendingDOMApproval
    lastPendingDomApprovalRef.current = next

    if (!prev || !next) return
    if (prev.id === next.id) return
    if (prev.userApproved || isGeneratingSourcePatch) return

    // If telemetry wasn't initialized yet (e.g. rapid supersede), create a minimal record now.
    const ctx = domEditContextRef.current
    const tabIdForUndo = ctx?.id === prev.id
      ? ctx.tabId
      : (domEditTelemetryRef.current[prev.id]?.tabId || String(activeTabId))

    ensureDomTelemetry(prev.id, { tabId: tabIdForUndo, elementXpath: prev.element?.xpath })
    cancelDomApprovalValue(prev, { tabIdForUndo, reason: 'superseded' })
  }, [pendingDOMApproval?.id, isGeneratingSourcePatch, activeTabId, ensureDomTelemetry, cancelDomApprovalValue])

  // Initialize telemetry whenever a new pending DOM approval appears.
  useEffect(() => {
    if (!pendingDOMApproval) {
      domEditContextRef.current = null
      return
    }
    domEditContextRef.current = {
      id: pendingDOMApproval.id,
      tabId: String(activeTabId),
      elementXpath: pendingDOMApproval.element?.xpath,
    }
    ensureDomTelemetry(pendingDOMApproval.id, {
      tabId: String(activeTabId),
      elementXpath: pendingDOMApproval.element?.xpath,
    })
    markDomTelemetry(pendingDOMApproval.id, 'preview_applied')
  }, [pendingDOMApproval?.id, activeTabId, ensureDomTelemetry, markDomTelemetry])

  // Auto-cancel an unapproved DOM edit if the user switches tabs.
  useEffect(() => {
    if (!pendingDOMApproval || !domEditContextRef.current) return
    const ctx = domEditContextRef.current
    if (ctx.id !== pendingDOMApproval.id) return
    if (ctx.tabId === String(activeTabId)) return

    console.log('[DOM Approval] Auto-cancelling pending change due to tab switch:', { from: ctx.tabId, to: activeTabId })
    cancelPendingDomApproval('context_change')
  }, [activeTabId, pendingDOMApproval, cancelPendingDomApproval])

  // Auto-cancel if the user changes the selection to a different element (keeps unapproved previews from lingering).
  useEffect(() => {
    if (!pendingDOMApproval || !domEditContextRef.current) return
    const ctx = domEditContextRef.current
    if (ctx.id !== pendingDOMApproval.id) return
    if (!ctx.elementXpath) return
    const selectedXpath = selectedElement?.xpath
    if (!selectedXpath) return
    if (selectedXpath === ctx.elementXpath) return

    console.log('[DOM Approval] Auto-cancelling pending change due to selection change:', { from: ctx.elementXpath, to: selectedXpath })
    cancelPendingDomApproval('context_change')
  }, [activeTabId, pendingDOMApproval, selectedElement?.xpath, cancelPendingDomApproval])

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
  const mcpServerConfigs = useMemo((): MCPServerConfig[] => {
    return (appSettings.connections || [])
      .filter((conn): conn is MCPServerConnection => conn.type === 'mcp' && 'transport' in conn)
      .filter(conn => conn.enabled)
      .map(({ id, name, transport, enabled, timeout }): MCPServerConfig => ({
        id,
        name,
        transport,
        enabled,
        timeout,
      }))
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

  // Multi-viewport mode (shows multiple device viewports simultaneously)
  const [isMultiViewportMode, setIsMultiViewportMode] = useState(false)
  const [viewportCount, setViewportCount] = useState(0)
  const viewportControlsRef = useRef<{
    viewportCount: number
    addDevice: (type: 'mobile' | 'tablet' | 'desktop') => void
    addInternalWindow: (type: 'kanban' | 'todo' | 'notes') => void
    addTerminal: () => void
    autoLayout: (direction?: LayoutDirection) => void
    fitView: () => void
    getViewports: () => Viewport[]
    focusViewport: (id: string) => void
  } | null>(null)

  // Zoom options for device preview
  type ZoomLevel = 'fit' | 'actual' | '50' | '75' | '100' | '125' | '150'
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('fit')
  const [isZoomSelectorOpen, setIsZoomSelectorOpen] = useState(false)

  const zoomOptions: { value: ZoomLevel; label: string }[] = [
    { value: 'fit', label: 'Fit' },
    { value: 'actual', label: 'Actual' },
    { value: '50', label: '50%' },
    { value: '75', label: '75%' },
    { value: '100', label: '100%' },
    { value: '125', label: '125%' },
    { value: '150', label: '150%' },
  ]

  // Approximate "actual size" scaling based on local display PPI.
  // CSS pixels are defined as 96 PPI, so 96 / displayPpi maps CSS px -> physical inches.
  const displayPpi = appSettings.displayPpi
  const actualScale = useMemo(() => {
    const ppi = typeof displayPpi === 'number' && Number.isFinite(displayPpi) && displayPpi > 0
      ? displayPpi
      : undefined
    if (!ppi) return 1
    return 96 / ppi
  }, [displayPpi])

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
  type ConsoleLogEntry = { type: 'log' | 'warn' | 'error' | 'info'; message: string; timestamp: Date }
  const [consoleLogs, setConsoleLogs] = useState<Array<{type: 'log' | 'warn' | 'error' | 'info'; message: string; timestamp: Date}>>([]);
  const [isConsolePanelOpen, setIsConsolePanelOpen] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(192); // 192px = h-48
  const [consoleFilters, setConsoleFilters] = useState<Set<'log' | 'warn' | 'error' | 'info'>>(new Set());
  const [isConsoleResizing, setIsConsoleResizing] = useState(false);
  const [consolePanelTab, setConsolePanelTab] = useState<'console' | 'terminal'>('console');
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<unknown>(null);
  const consoleResizeStartY = useRef<number>(0);
  const consoleResizeStartHeight = useRef<number>(192);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [selectedLogIndices, setSelectedLogIndices] = useState<Set<number>>(new Set());
  const lastClickedLogIndex = useRef<number | null>(null);
  const consoleLogBufferRef = useRef<ConsoleLogEntry[]>([])
  const consoleLogFlushTimerRef = useRef<number | null>(null)

  const flushConsoleLogBuffer = useCallback(() => {
    if (consoleLogFlushTimerRef.current) {
      window.clearTimeout(consoleLogFlushTimerRef.current)
      consoleLogFlushTimerRef.current = null
    }
    if (consoleLogBufferRef.current.length === 0) return
    const buffered = consoleLogBufferRef.current
    consoleLogBufferRef.current = []

    setConsoleLogs(prev => {
      const next = [...prev, ...buffered]
      // Keep at most 200 entries to bound render cost
      return next.length > 200 ? next.slice(-200) : next
    })
  }, [])

  const enqueueConsoleLog = useCallback((entry: ConsoleLogEntry) => {
    consoleLogBufferRef.current.push(entry)
    if (consoleLogFlushTimerRef.current) return
    // Batch multiple console-message events into a single React update
    consoleLogFlushTimerRef.current = window.setTimeout(flushConsoleLogBuffer, 100)
  }, [flushConsoleLogBuffer])

  useEffect(() => {
    return () => {
      if (consoleLogFlushTimerRef.current) {
        window.clearTimeout(consoleLogFlushTimerRef.current)
        consoleLogFlushTimerRef.current = null
      }
    }
  }, [])

  // Debug Mode - shows all activity in console panel
  const [debugMode, setDebugMode] = useState(false);

  // Debug logger that shows in both console.log and the console panel when debug mode is on
  const debugLog = useCallback((prefix: string, message: string, data?: unknown) => {
    const fullMessage = data !== undefined
      ? `[${prefix}] ${message}: ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`
      : `[${prefix}] ${message}`;
    console.log(fullMessage);
    if (debugMode) {
      enqueueConsoleLog({ type: 'info', message: fullMessage, timestamp: new Date() })
    }
  }, [debugMode, enqueueConsoleLog]);

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

  // Get PTY server port dynamically
  const [ptyPort, setPtyPort] = useState<number | null>(null);
  useEffect(() => {
    const fetchPtyPort = async () => {
      if (!isElectron || !window.electronAPI?.pty) return;
      try {
        const result = await window.electronAPI.pty.getPort();
        if (result.success && result.port) {
          setPtyPort(result.port);
          console.log('[PTY] Server port:', result.port);
        }
      } catch (err) {
        console.error('[PTY] Failed to get port:', err);
      }
    };
    // Fetch immediately and retry after a delay in case server is still starting
    fetchPtyPort();
    const timer = setTimeout(fetchPtyPort, 1000);
    return () => clearTimeout(timer);
  }, [isElectron]);

  // Persist dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', String(isDarkMode));
  }, [isDarkMode]);

  // Check Fast Apply status (Pro Feature)
  useEffect(() => {
    const checkFastApplyStatus = async () => {
      if (appSettings.clusoCloudEditsEnabled) {
        setFastApplyReady(false);
        return;
      }
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
  }, [appSettings.clusoCloudEditsEnabled]);

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

  // Inspector should not auto-switch models.
  // We only disable thinking for responsiveness while active.
  useEffect(() => {
    if (isInspectorActive) {
      preInspectorSettingsRef.current = {
        model: selectedModel,
        thinkingLevel: thinkingLevel,
      };

      if (thinkingLevel !== 'off') {
        console.log('[Inspector] Disabling thinking mode');
        setThinkingLevel('off');
      }
    } else if (preInspectorSettingsRef.current) {
      console.log('[Inspector] Restoring previous thinking level:', preInspectorSettingsRef.current.thinkingLevel);
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
        (webview as unknown as Electron.WebviewTag).reload();
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

  // Handle highlight by number - visually highlights element without editing code
  // Uses window.__numberedElements from get_page_elements to ensure consistent numbering
  const handleHighlightByNumber = useCallback(async (elementNumber: number): Promise<{ success: boolean; element?: any; error?: string }> => {
    console.log('[AI] Highlighting element by number:', elementNumber);
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' };
    }

    const highlightCode = `
      (function() {
        const elementNumber = ${elementNumber};
        const elements = window.__numberedElements;

        if (!elements || elements.length === 0) {
          return { success: false, error: 'No numbered elements. Call get_page_elements first.' };
        }

        const index = elementNumber - 1; // Convert to 0-indexed
        if (index < 0 || index >= elements.length) {
          return { success: false, error: 'Element ' + elementNumber + ' not found. Valid range: 1-' + elements.length };
        }

        const element = elements[index];

        // Clear any previous highlight
        document.querySelectorAll('.cluso-highlighted').forEach(el => {
          el.classList.remove('cluso-highlighted');
          el.style.outline = '';
          el.style.outlineOffset = '';
        });

        // Clear all number badges now that user has selected one
        document.querySelectorAll('.element-number-badge').forEach(b => b.remove());

        // Highlight the selected element
        element.classList.add('cluso-highlighted');
        element.style.outline = '3px solid #3b82f6';
        element.style.outlineOffset = '2px';
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Store as current focus for subsequent operations
        window.__focusedElement = element;

        const text = element.innerText?.substring(0, 50) || '';
        const tag = element.tagName.toLowerCase();

        return {
          success: true,
          element: { number: elementNumber, tag, text: text.trim(), totalElements: elements.length }
        };
      })()
    `;

    try {
      const result = await webview.executeJavaScript(highlightCode) as { success: boolean; element?: unknown; error?: string };
      console.log('[AI] Highlight by number result:', result);
      return result;
    } catch (err) {
      console.error('[AI] Highlight by number error:', err);
      return { success: false, error: (err as Error).message };
    }
  }, [isWebviewReady, activeTabId]);

  // Handle clear_focus tool - clears the hierarchical focus scope
  const handleClearFocus = useCallback(async (): Promise<{ success: boolean }> => {
    console.log('[AI] Clearing focus scope');
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false };
    }

    const clearCode = `
      (function() {
        // Clear focus
        window.__focusedElement = null;

        // Clear all highlights
        document.querySelectorAll('.cluso-highlighted').forEach(el => {
          el.classList.remove('cluso-highlighted');
          el.style.outline = '';
          el.style.outlineOffset = '';
        });

        // Clear number badges
        document.querySelectorAll('.element-number-badge').forEach(b => b.remove());

        // Clear stored elements
        window.__numberedElements = [];

        return { success: true };
      })()
    `;

    try {
      await webview.executeJavaScript(clearCode);
      console.log('[AI] Focus cleared');
      return { success: true };
    } catch (err) {
      console.error('[AI] Clear focus error:', err);
      return { success: false };
    }
  }, [isWebviewReady, activeTabId]);

  // Handle set_viewport tool - switches between mobile/tablet/desktop views
  const handleSetViewport = useCallback(async (mode: 'mobile' | 'tablet' | 'desktop'): Promise<{ success: boolean }> => {
    console.log('[AI] Setting viewport to:', mode);
    setViewportSize(mode);
    return { success: true };
  }, []);

  // Handle switch_tab tool - switches to or creates different tab types
  const handleSwitchTab = useCallback(async (type: 'browser' | 'kanban' | 'todos' | 'notes'): Promise<{ success: boolean }> => {
    console.log('[AI] Switching to tab type:', type);
    // Check if a tab of this type already exists
    const existingTab = tabs.find(t => t.type === type);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      // Create a new tab of the specified type
      handleNewTab(type);
    }
    return { success: true };
  }, [tabs, handleNewTab]);

  // Handle find_element_by_text tool - searches page for elements by visible text content
  const handleFindElementByText = useCallback(async (
    searchText: string,
    elementType?: string
  ): Promise<{ success: boolean; matches?: Array<{ elementNumber: number; text: string; tagName: string }>; error?: string }> => {
    console.log('[AI] Finding elements by text:', searchText, 'type:', elementType);
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' };
    }

    const searchCode = `
      (function() {
        const searchText = ${JSON.stringify(searchText.toLowerCase())};
        const elementType = ${elementType ? JSON.stringify(elementType.toLowerCase()) : 'null'};

        // Get all visible elements with text content
        const allElements = Array.from(document.querySelectorAll('*'));
        const matches = [];
        let elementNumber = 0;

        // Store elements for later highlighting
        const numberedElements = [];

        for (const el of allElements) {
          // Skip invisible elements
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

          // Skip non-interactive elements (unless they have meaningful text)
          const tagName = el.tagName.toLowerCase();
          const interactiveTags = ['button', 'a', 'input', 'select', 'textarea', 'label', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li'];
          if (!interactiveTags.includes(tagName)) continue;

          // Filter by element type if specified
          if (elementType && tagName !== elementType) continue;

          // Get text content (direct text, not from children)
          let text = '';
          if (tagName === 'input') {
            text = el.value || el.placeholder || el.getAttribute('aria-label') || '';
          } else {
            // Get direct text content
            text = Array.from(el.childNodes)
              .filter(n => n.nodeType === Node.TEXT_NODE)
              .map(n => n.textContent)
              .join(' ').trim();
            // If no direct text, try innerText but limit to prevent huge strings
            if (!text) {
              text = (el.innerText || '').substring(0, 100);
            }
          }

          // Also check aria-label and title
          const ariaLabel = el.getAttribute('aria-label') || '';
          const title = el.getAttribute('title') || '';
          const combinedText = (text + ' ' + ariaLabel + ' ' + title).toLowerCase();

          // Check for match (case-insensitive, partial match)
          if (combinedText.includes(searchText)) {
            elementNumber++;
            numberedElements.push(el);
            matches.push({
              elementNumber,
              text: text.trim().substring(0, 100) || ariaLabel || title || tagName,
              tagName: tagName.toUpperCase()
            });

            // Limit to 20 matches
            if (matches.length >= 20) break;
          }
        }

        // Store for highlighting
        window.__numberedElements = numberedElements;

        // Add number badges to matched elements
        document.querySelectorAll('.element-number-badge').forEach(b => b.remove());
        numberedElements.forEach((el, i) => {
          const badge = document.createElement('div');
          badge.className = 'element-number-badge';
          badge.setAttribute('data-cluso-ui', '1');
          badge.textContent = String(i + 1);
          badge.style.cssText = 'position:absolute;background:#3b82f6;color:white;font-size:10px;font-weight:bold;padding:1px 4px;border-radius:3px;z-index:99999;pointer-events:none;';
          const rect = el.getBoundingClientRect();
          badge.style.top = (rect.top + window.scrollY - 15) + 'px';
          badge.style.left = (rect.left + window.scrollX) + 'px';
          document.body.appendChild(badge);
        });

        return { success: true, matches };
      })()
    `;

    try {
      const result = await webview.executeJavaScript(searchCode) as { success: boolean; matches?: { elementNumber: number; text: string; tagName: string }[]; error?: string };
      console.log('[AI] Find by text result:', result);
      return result;
    } catch (err) {
      console.error('[AI] Find by text error:', err);
      return { success: false, error: (err as Error).message };
    }
  }, [isWebviewReady, activeTabId]);

  // DOM Navigation handlers for voice agent - these communicate with iframe-injection.ts
  const handleSelectParent = useCallback(async (levels: number = 1): Promise<{ success: boolean; element?: Record<string, unknown>; error?: string }> => {
    console.log('[AI] Select parent, levels:', levels);
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' };
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'SELECT_PARENT_RESULT') {
          window.removeEventListener('message', handleResponse);
          if (event.data.success && event.data.element) {
            resolve({ success: true, element: event.data.element });
          } else {
            resolve({ success: false, error: event.data.error || 'Failed to select parent' });
          }
        }
      };
      window.addEventListener('message', handleResponse);

      // Send message to webview
      webview.contentWindow?.postMessage({ type: 'SELECT_PARENT', levels }, getTargetOrigin(activeTab?.url));

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: false, error: 'Timeout waiting for parent selection' });
      }, 5000);
    });
  }, [isWebviewReady, activeTabId, activeTab?.url]);

  const handleSelectChildren = useCallback(async (selector?: string): Promise<{ success: boolean; children?: Record<string, unknown>[]; error?: string }> => {
    console.log('[AI] Select children, filter:', selector);
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' };
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'SELECT_CHILDREN_RESULT') {
          window.removeEventListener('message', handleResponse);
          if (event.data.success) {
            const children = event.data.children?.map((c: { element: Record<string, unknown> }) => c.element) || [];
            resolve({ success: true, children });
          } else {
            resolve({ success: false, error: event.data.error || 'Failed to get children' });
          }
        }
      };
      window.addEventListener('message', handleResponse);

      webview.contentWindow?.postMessage({ type: 'SELECT_CHILDREN', selector }, getTargetOrigin(activeTab?.url));

      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: false, error: 'Timeout waiting for children' });
      }, 5000);
    });
  }, [isWebviewReady, activeTabId, activeTab?.url]);

  const handleSelectSiblings = useCallback(async (direction: 'next' | 'prev' | 'all'): Promise<{ success: boolean; siblings?: Record<string, unknown>[]; error?: string }> => {
    console.log('[AI] Select siblings, direction:', direction);
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' };
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'SELECT_SIBLINGS_RESULT') {
          window.removeEventListener('message', handleResponse);
          if (event.data.success) {
            const siblings = event.data.siblings?.map((s: { element: Record<string, unknown> }) => s.element) || [];
            resolve({ success: true, siblings });
          } else {
            resolve({ success: false, error: event.data.error || 'Failed to get siblings' });
          }
        }
      };
      window.addEventListener('message', handleResponse);

      webview.contentWindow?.postMessage({ type: 'SELECT_SIBLINGS', direction }, getTargetOrigin(activeTab?.url));

      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: false, error: 'Timeout waiting for siblings' });
      }, 5000);
    });
  }, [isWebviewReady, activeTabId, activeTab?.url]);

  const handleSelectAllMatching = useCallback(async (matchBy: 'tag' | 'class' | 'both'): Promise<{ success: boolean; matches?: Record<string, unknown>[]; error?: string }> => {
    console.log('[AI] Select all matching, by:', matchBy);
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' };
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'SELECT_ALL_MATCHING_RESULT') {
          window.removeEventListener('message', handleResponse);
          if (event.data.success) {
            const matches = event.data.matches?.map((m: { element: Record<string, unknown> }) => m.element) || [];
            resolve({ success: true, matches });
          } else {
            resolve({ success: false, error: event.data.error || 'Failed to find matching elements' });
          }
        }
      };
      window.addEventListener('message', handleResponse);

      webview.contentWindow?.postMessage({ type: 'SELECT_ALL_MATCHING', matchBy }, getTargetOrigin(activeTab?.url));

      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: false, error: 'Timeout waiting for matching elements' });
      }, 5000);
    });
  }, [isWebviewReady, activeTabId, activeTab?.url]);

  // --- Hierarchical Drill-Down Selection Handlers ---
  const handleStartDrillSelection = useCallback(async (): Promise<{ success: boolean; sections?: Record<string, unknown>[]; level?: number; error?: string }> => {
    console.log('[AI] Starting drill-down selection');
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' };
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'START_DRILL_SELECTION_RESULT') {
          window.removeEventListener('message', handleResponse);
          if (event.data.success) {
            resolve({ success: true, sections: event.data.sections, level: event.data.level });
          } else {
            resolve({ success: false, error: event.data.error || 'Failed to start drill selection' });
          }
        }
      };
      window.addEventListener('message', handleResponse);

      webview.contentWindow?.postMessage({ type: 'START_DRILL_SELECTION' }, getTargetOrigin(activeTab?.url));

      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: false, error: 'Timeout starting drill selection' });
      }, 5000);
    });
  }, [isWebviewReady, activeTabId, activeTab?.url]);

  const handleDrillInto = useCallback(async (elementNumber: number): Promise<{ success: boolean; isFinalSelection?: boolean; element?: Record<string, unknown>; children?: Record<string, unknown>[]; description?: string; level?: number; canGoBack?: boolean; canGoForward?: boolean; error?: string }> => {
    console.log('[AI] Drill into element:', elementNumber);
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' };
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'DRILL_INTO_RESULT') {
          window.removeEventListener('message', handleResponse);
          if (event.data.success) {
            resolve({
              success: true,
              isFinalSelection: event.data.isFinalSelection,
              element: event.data.element,
              children: event.data.children,
              description: event.data.description || event.data.parentDescription,
              level: event.data.level,
              canGoBack: event.data.canGoBack,
              canGoForward: event.data.canGoForward,
            });
          } else {
            resolve({ success: false, error: event.data.error || 'Failed to drill into element' });
          }
        }
      };
      window.addEventListener('message', handleResponse);

      webview.contentWindow?.postMessage({ type: 'DRILL_INTO', elementNumber }, getTargetOrigin(activeTab?.url));

      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: false, error: 'Timeout drilling into element' });
      }, 5000);
    });
  }, [isWebviewReady, activeTabId, activeTab?.url]);

  const handleDrillBack = useCallback(async (): Promise<{ success: boolean; children?: Record<string, unknown>[]; level?: number; canGoBack?: boolean; canGoForward?: boolean; error?: string }> => {
    console.log('[AI] Drill back');
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' };
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'DRILL_BACK_RESULT') {
          window.removeEventListener('message', handleResponse);
          if (event.data.success) {
            resolve({
              success: true,
              children: event.data.children,
              level: event.data.level,
              canGoBack: event.data.canGoBack,
              canGoForward: event.data.canGoForward,
            });
          } else {
            resolve({ success: false, error: event.data.error || 'Cannot go back' });
          }
        }
      };
      window.addEventListener('message', handleResponse);

      webview.contentWindow?.postMessage({ type: 'DRILL_BACK' }, getTargetOrigin(activeTab?.url));

      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: false, error: 'Timeout going back' });
      }, 5000);
    });
  }, [isWebviewReady, activeTabId, activeTab?.url]);

  const handleDrillForward = useCallback(async (): Promise<{ success: boolean; children?: Record<string, unknown>[]; level?: number; canGoBack?: boolean; canGoForward?: boolean; error?: string }> => {
    console.log('[AI] Drill forward');
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false, error: 'Webview not ready' };
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'DRILL_FORWARD_RESULT') {
          window.removeEventListener('message', handleResponse);
          if (event.data.success) {
            resolve({
              success: true,
              children: event.data.children,
              level: event.data.level,
              canGoBack: event.data.canGoBack,
              canGoForward: event.data.canGoForward,
            });
          } else {
            resolve({ success: false, error: event.data.error || 'No forward history' });
          }
        }
      };
      window.addEventListener('message', handleResponse);

      webview.contentWindow?.postMessage({ type: 'DRILL_FORWARD' }, getTargetOrigin(activeTab?.url));

      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: false, error: 'Timeout going forward' });
      }, 5000);
    });
  }, [isWebviewReady, activeTabId, activeTab?.url]);

  const handleExitDrillMode = useCallback(async (): Promise<{ success: boolean }> => {
    console.log('[AI] Exit drill mode');
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return { success: false };
    }

    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'EXIT_DRILL_MODE_RESULT') {
          window.removeEventListener('message', handleResponse);
          resolve({ success: event.data.success });
        }
      };
      window.addEventListener('message', handleResponse);

      webview.contentWindow?.postMessage({ type: 'EXIT_DRILL_MODE' }, getTargetOrigin(activeTab?.url));

      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: true }); // Assume success on timeout
      }, 2000);
    });
  }, [isWebviewReady, activeTabId, activeTab?.url]);

  // Layers panel handlers
  const handleRefreshLayers = useCallback(async () => {
    setIsLayersLoading(true);
    try {
      // In multi-viewport mode, show canvas/nodes tree instead of page elements
      if (isMultiViewportMode && multiViewportData.length > 0) {
        const getNodeName = (v: { windowType: string; devicePresetId?: string }) => {
          if (v.windowType === 'device') {
            const presetNames: Record<string, string> = {
              'desktop': 'Desktop',
              'laptop': 'Laptop',
              'iphone-15-pro': 'iPhone 15 Pro',
              'iphone-15': 'iPhone 15',
              'iphone-se': 'iPhone SE',
              'pixel-8': 'Pixel 8',
              'galaxy-s24': 'Galaxy S24',
              'ipad-pro-12': 'iPad Pro 12.9"',
              'ipad-pro-11': 'iPad Pro 11"',
              'ipad-mini': 'iPad Mini',
            };
            return presetNames[v.devicePresetId || 'desktop'] || v.devicePresetId || 'Device';
          }
          const typeNames: Record<string, string> = {
            'kanban': 'Kanban Board',
            'todo': 'Todo List',
            'notes': 'Notes',
            'terminal': 'Terminal',
          };
          return typeNames[v.windowType] || v.windowType;
        };

        const getNodeType = (windowType: string): TreeNode['type'] => {
          if (windowType === 'device') return 'frame';
          if (windowType === 'terminal') return 'input';
          return 'component';
        };

        const canvasTree: TreeNode = {
          id: 'canvas',
          name: 'Canvas',
          type: 'page',
          children: multiViewportData.map(v => ({
            id: `node-${v.id}`,
            name: getNodeName(v),
            type: getNodeType(v.windowType),
            tagName: v.windowType,
          })),
        };

        setLayersTreeData(canvasTree);
        setIsLayersLoading(false);
        return;
      }

      // Single viewport mode - scan page elements
      if (!isWebviewReady) {
        setIsLayersLoading(false);
        return;
      }

      const webview = webviewRefs.current.get(activeTabId);
      if (!webview) {
        setIsLayersLoading(false);
        return;
      }

      // Get page elements and build tree structure with proper DOM nesting
      const scanCode = `
        (function() {
          let elementNumber = 0;
          const elementMap = new Map(); // Store elements by number for highlighting

          // Important selectors - elements we want to show in tree
          const importantTags = new Set(['button', 'a', 'input', 'textarea', 'select', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'form', 'nav', 'header', 'footer', 'main', 'section', 'article', 'aside', 'ul', 'ol', 'table']);
          const containerTags = new Set(['div', 'span', 'li', 'p', 'label', 'td', 'tr', 'th']);

          function getXPath(el) {
            try {
              if (!el) return '';
              if (el.id) return '//*[@id=\"' + String(el.id).replace(/\"/g, '') + '\"]';
              const parts = [];
              let node = el;
              while (node && node.nodeType === 1) {
                let idx = 1;
                let sib = node.previousSibling;
                while (sib) {
                  if (sib.nodeType === 1 && sib.tagName === node.tagName) idx++;
                  sib = sib.previousSibling;
                }
                parts.unshift(node.tagName.toLowerCase() + '[' + idx + ']');
                node = node.parentNode;
              }
              return '/' + parts.join('/');
            } catch (e) {
              return '';
            }
          }

          function getElementType(el) {
            const tagName = el.tagName.toLowerCase();
            if (tagName === 'button' || el.getAttribute('role') === 'button') return 'button';
            if (tagName === 'a') return 'link';
            if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return 'input';
            if (tagName === 'img') return 'image';
            if (['h1','h2','h3','h4','h5','h6','p'].includes(tagName)) return 'text';
            if (['ul','ol','li'].includes(tagName)) return 'list';
            if (['nav','header','footer','main','section','article','aside','form'].includes(tagName)) return 'frame';
            return 'component';
          }

          const markerClasses = new Set([
            'inspector-hover-target',
            'inspector-selected-target',
            'screenshot-hover-target',
            'move-hover-target',
            'inspector-drag-over',
            'move-original-hidden',
            'cluso-highlighted',
          ]);

          function getElementName(el) {
            const tagName = el.tagName.toLowerCase();
            function getCleanClassToken(node) {
              const cls = String(node.className || '');
              if (!cls) return '';
              const tokens = cls.split(/\s+/).map(s => s.trim()).filter(Boolean);
              const clean = tokens.filter(t => !markerClasses.has(t));
              return clean[0] || '';
            }

            function getCleanText(node, maxLen = 30) {
              try {
                const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
                  acceptNode(textNode) {
                    const parent = textNode.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    if (parent.closest && parent.closest('[data-cluso-ui="1"]')) return NodeFilter.FILTER_REJECT;
                    const pCls = String(parent.className || '');
                    if (pCls.includes('element-number-badge')) return NodeFilter.FILTER_REJECT;
                    if (pCls.includes('inspector-edit-toolbar') || pCls.includes('inspector-edit-btn')) return NodeFilter.FILTER_REJECT;
                    if (pCls.includes('drop-zone-label')) return NodeFilter.FILTER_REJECT;
                    if (pCls.includes('move-floating-overlay') || pCls.includes('move-resize-handle') || pCls.includes('move-position-label')) return NodeFilter.FILTER_REJECT;
                    const txt = (textNode.textContent || '').trim();
                    if (!txt) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                  }
                });
                let out = '';
                while (walker.nextNode()) {
                  const t = String(walker.currentNode.textContent || '').replace(/\s+/g, ' ').trim();
                  if (!t) continue;
                  out = (out ? (out + ' ' + t) : t);
                  if (out.length >= maxLen) break;
                }
                return out.substring(0, maxLen).trim();
              } catch (e) {
                return '';
              }
            }

            const text = getCleanText(el, 30);
            const ariaLabel = el.getAttribute('aria-label');
            const placeholder = el.getAttribute('placeholder');
            const id = el.id;
            const className = getCleanClassToken(el);

            if (ariaLabel) return ariaLabel.substring(0, 30);
            if (text && text.length < 30 && !text.includes('\\n')) return text;
            if (placeholder) return placeholder.substring(0, 30);
            if (id) return '#' + id;
            if (className && typeof className === 'string') return '.' + className;
            return '<' + tagName + '>';
          }

          function isElementVisible(el) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none') return false;
            if (style.opacity === '0') return false;
            if (style.visibility === 'hidden') {
              // Ignore our own temporary hiding class so Layers doesn't change due to inspector/move tooling.
              const cls = String(el.className || '');
              if (!cls.includes('move-original-hidden')) return false;
            }
            return true;
          }

          function isClusoUi(el) {
            try {
              if (!el) return false;
              if (el.closest && el.closest('[data-cluso-ui="1"]')) return true;
              const id = String(el.id || '');
              if (id === 'cluso-hover-overlay' || id === 'cluso-selection-overlay' || id === 'cluso-rect-selection' || id === 'inspector-styles') return true;
              const cls = String(el.className || '');
              if (!cls) return false;
              if (cls.includes('element-number-badge')) return true;
              if (cls.includes('inspector-edit-toolbar') || cls.includes('inspector-edit-btn')) return true;
              if (cls.includes('drop-zone-label')) return true;
              if (cls.includes('move-floating-overlay') || cls.includes('move-resize-handle') || cls.includes('move-position-label')) return true;
            } catch (e) {}
            return false;
          }

          function shouldInclude(el) {
            if (isClusoUi(el)) return false;
            if (!isElementVisible(el)) return false;
            const tagName = el.tagName.toLowerCase();

            // Always include important tags
            if (importantTags.has(tagName)) return true;
            if (el.getAttribute('role') === 'button') return true;

            // Include containers only if they have meaningful attributes
            if (containerTags.has(tagName)) {
              const hasId = !!el.id;
              const hasMeaningfulClass = el.className && typeof el.className === 'string' &&
                el.className.split(' ').some(c => c && c.length > 2 && !markerClasses.has(c) && !c.includes('__') && !c.includes('css-'));
              const hasRole = !!el.getAttribute('role');
              const hasAriaLabel = !!el.getAttribute('aria-label');
              const hasDirectText = el.childNodes.length > 0 &&
                Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent?.trim());

              if (hasId || hasRole || hasAriaLabel) return true;
              if (hasMeaningfulClass && (hasDirectText || el.children.length > 0)) return true;
              if (['p', 'li', 'label', 'td', 'th'].includes(tagName) && hasDirectText) return true;
            }

            return false;
          }

          function buildTree(el, maxDepth = 10) {
            if (maxDepth <= 0) return null;

            const children = [];
            for (const child of el.children) {
              if (isClusoUi(child)) continue;
              if (shouldInclude(child)) {
                elementNumber++;

                // Extract Cluso metadata if present
                const clusoId = child.getAttribute('data-cluso-id');
                const clusoName = child.getAttribute('data-cluso-name');

                let sourceFile = null;
                let sourceLine = null;
                let sourceColumn = null;

				if (clusoId) {
					// Parse format: "src/App.tsx:45:12"
					const parts = clusoId.split(':');
					const colStr = parts.pop();
					const lineStr = parts.pop();
					const col = colStr ? parseInt(colStr, 10) : NaN;
					const line = lineStr ? parseInt(lineStr, 10) : NaN;
					sourceColumn = Number.isFinite(col) ? col : null;
					sourceLine = Number.isFinite(line) ? line : null;
					const sf = parts.join(':'); // Handle Windows paths (e.g. C:\\...)
					sourceFile = sf || null;
				}

                const node = {
                  id: getXPath(child) || ('element-' + elementNumber),
                  name: clusoName || getElementName(child), // Prefer data-cluso-name
                  type: getElementType(child),
                  tagName: child.tagName.toLowerCase(),
                  elementNumber,
                  sourceFile,
                  sourceLine,
                  sourceColumn,
                  children: []
                };
                elementMap.set(elementNumber, child);

                // Recursively build children
                const childTree = buildTree(child, maxDepth - 1);
                if (childTree && childTree.length > 0) {
                  node.children = childTree;
                } else {
                  delete node.children;
                }
                children.push(node);
              } else {
                // Skip this element but check its children
                const nested = buildTree(child, maxDepth);
                if (nested) children.push(...nested);
              }
            }
            return children.length > 0 ? children : null;
          }

          // Build from body
          const tree = buildTree(document.body, 12);

          // Store element map for highlighting
          window.__layersElements = elementMap;

          return tree || [];
        })()
      `;

      const elements = await webview.executeJavaScript(scanCode) as TreeNode[];

      // Build tree with nested structure
      const treeData: TreeNode = {
        id: 'root',
        name: 'Page',
        type: 'page',
        children: elements.slice(0, 200), // Limit for performance
      };

      setLayersTreeData(treeData);
      layersTreeStaleRef.current = false
    } catch (err) {
      console.error('[Layers] Refresh error:', err);
    }
    setIsLayersLoading(false);
  }, [isWebviewReady, activeTabId, isMultiViewportMode, multiViewportData]);
  const handleRefreshLayersRef = useRef<() => Promise<void>>(() => Promise.resolve());
  useEffect(() => { handleRefreshLayersRef.current = handleRefreshLayers; }, [handleRefreshLayers]);

  const handleTreeNodeSelect = useCallback(async (node: TreeNode) => {
    setSelectedTreeNodeId(node.id);

    // In multi-viewport mode, clicking a node focuses it on the canvas
    if (isMultiViewportMode && node.id.startsWith('node-')) {
      const viewportId = node.id.replace('node-', '');
      viewportControlsRef.current?.focusViewport?.(viewportId);
      return;
    }

    if (node.elementNumber) {
      setSelectedLayerElementNumber(node.elementNumber)
      setSelectedLayerElementName(node.name || null)

      // Highlight in webview
      const webview = webviewRefs.current.get(activeTabId);
      if (!webview) return;

      // Also sync selection into the inspector overlay for a unified experience
      try {
        webview.send('select-layer-element-by-number', node.elementNumber);
      } catch (e) {
        // ignore
      }

      // Pull computed styles for the element to seed the properties panel
      try {
        const result = await webview.executeJavaScript(`
          (function() {
            const map = window.__layersElements;
            if (!map || !(map instanceof Map)) return { success: false, error: 'No element map' };
            const el = map.get(${node.elementNumber});
            if (!el) return { success: false, error: 'Element not found' };

            const rect = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            const computedStyles = {};
            try {
              for (let i = 0; i < cs.length; i++) {
                const prop = cs[i];
                computedStyles[prop] = String(cs.getPropertyValue(prop) || '').trim();
              }
            } catch (e) {}

            const attributes = {};
            try {
              for (const attr of Array.from(el.attributes || [])) {
                if (!attr || !attr.name) continue;
                attributes[attr.name] = String(attr.value ?? '');
              }
            } catch (e) {}

            const dataset = {};
            try {
              const ds = el.dataset || {};
              for (const k in ds) {
                if (!Object.prototype.hasOwnProperty.call(ds, k)) continue;
                dataset[k] = String(ds[k] ?? '');
              }
            } catch (e) {}

            function addFamilies(set, raw) {
              if (!raw) return;
              const parts = String(raw)
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .map(s => s.replace(/^['\"]|['\"]$/g, ''));
              for (const p of parts) {
                if (p) set.add(p);
              }
            }

            const fontFamiliesSet = new Set();
            try {
              addFamilies(fontFamiliesSet, cs.fontFamily);
              const sheets = Array.from(document.styleSheets || []);
              for (const sheet of sheets) {
                let rules;
                try { rules = sheet.cssRules; } catch (e) { continue; }
                if (!rules) continue;
                for (const rule of Array.from(rules)) {
                  const t = rule.type;
                  // CSSFontFaceRule
                  if (t === 5 && rule.style) {
                    addFamilies(fontFamiliesSet, rule.style.getPropertyValue('font-family'));
                    continue;
                  }
                  // CSSStyleRule
                  if (t === 1 && rule.style) {
                    addFamilies(fontFamiliesSet, rule.style.fontFamily || rule.style.getPropertyValue('font-family'));
                    continue;
                  }
                }
              }
            } catch (e) {}

            const classNamesSet = new Set();
            try {
              const all = Array.from(document.querySelectorAll('[class]'));
              for (const node of all) {
                if (node.closest && node.closest('[data-cluso-ui="1"]')) continue;
                const cls = node.className;
                if (!cls) continue;
                const tokens = String(cls).split(/\\s+/).map(s => s.trim()).filter(Boolean);
                for (const t of tokens) {
                  if (!t || t.length >= 80) continue;
                  if (t === 'element-number-badge' || t === 'inspector-hover-target' || t === 'inspector-selected-target') continue;
                  if (t === 'screenshot-hover-target' || t === 'move-hover-target') continue;
                  if (t === 'drop-zone-label' || t === 'move-floating-overlay' || t === 'move-resize-handle' || t === 'move-position-label') continue;
                  classNamesSet.add(t);
                }
                if (classNamesSet.size > 5000) break;
              }
            } catch (e) {}

            function px(v) {
              const n = parseFloat(String(v || '0'));
              return Number.isFinite(n) ? n : 0;
            }

            function rgbToHex(color) {
              if (!color) return '#000000';
              const c = String(color).trim();
              if (c.startsWith('#')) return c;
              const m = c.match(/^rgba?\\((\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/i);
              if (!m) return '#000000';
              const r = Number(m[1]) || 0;
              const g = Number(m[2]) || 0;
              const b = Number(m[3]) || 0;
              const toHex = (n) => n.toString(16).padStart(2, '0');
              return '#' + toHex(r) + toHex(g) + toHex(b);
            }

            function parseTransform(transform) {
              const t = String(transform || '').trim();
              if (!t || t === 'none') return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
              const m2 = t.match(/^matrix\\(([^)]+)\\)$/);
              if (m2) {
                const parts = m2[1].split(',').map(s => parseFloat(s.trim()));
                if (parts.length >= 6) {
                  const [a, b, c, d, tx, ty] = parts;
                  const rotation = Math.round(Math.atan2(b, a) * (180 / Math.PI));
                  const scaleX = Math.sign(a || 1) * Math.sqrt((a * a) + (b * b));
                  const scaleY = Math.sign(d || 1) * Math.sqrt((c * c) + (d * d));
                  return { x: Math.round(tx), y: Math.round(ty), rotation, scaleX: scaleX >= 0 ? 1 : -1, scaleY: scaleY >= 0 ? 1 : -1 };
                }
              }
              const m3 = t.match(/^matrix3d\\(([^)]+)\\)$/);
              if (m3) {
                const parts = m3[1].split(',').map(s => parseFloat(s.trim()));
                if (parts.length >= 16) {
                  const a = parts[0];
                  const b = parts[1];
                  const c = parts[4];
                  const d = parts[5];
                  const tx = parts[12];
                  const ty = parts[13];
                  const rotation = Math.round(Math.atan2(b, a) * (180 / Math.PI));
                  const scaleX = Math.sign(a || 1) * Math.sqrt((a * a) + (b * b));
                  const scaleY = Math.sign(d || 1) * Math.sqrt((c * c) + (d * d));
                  return { x: Math.round(tx), y: Math.round(ty), rotation, scaleX: scaleX >= 0 ? 1 : -1, scaleY: scaleY >= 0 ? 1 : -1 };
                }
              }
              return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
            }

            const transform = parseTransform(cs.transform);
            const display = cs.display === 'flex' ? 'flex' : cs.display === 'grid' ? 'grid' : 'block';
            const flexDirection = cs.flexDirection === 'column' ? 'column' : 'row';
            const justify = ['flex-start', 'center', 'flex-end', 'space-between'].includes(cs.justifyContent)
              ? cs.justifyContent
              : 'flex-start';
            const align = ['flex-start', 'center', 'flex-end'].includes(cs.alignItems)
              ? cs.alignItems
              : 'flex-start';

            return {
              success: true,
              styles: {
                className: (el.className || ''),
                cssOverrides: {},
                attributeOverrides: {},
                datasetOverrides: {},
                x: transform.x,
                y: transform.y,
                rotation: transform.rotation,
                scaleX: transform.scaleX,
                scaleY: transform.scaleY,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                display,
                flexDirection,
                justifyContent: justify,
                alignItems: align,
                gap: px(cs.gap),
                padding: px(cs.paddingTop),
                overflow: (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') ? 'hidden' : 'visible',
                boxSizing: cs.boxSizing === 'content-box' ? 'content-box' : 'border-box',
                backgroundColor: rgbToHex(cs.backgroundColor),
                opacity: Math.round(parseFloat(cs.opacity || '1') * 100),
                borderRadius: px(cs.borderTopLeftRadius),
                borderWidth: px(cs.borderTopWidth),
                borderStyle: ['none', 'solid', 'dashed', 'dotted'].includes(cs.borderTopStyle) ? cs.borderTopStyle : 'solid',
                borderColor: rgbToHex(cs.borderTopColor),
                color: rgbToHex(cs.color),
                fontFamily: String(cs.fontFamily || 'system-ui'),
                fontSize: px(cs.fontSize),
                fontWeight: Number.parseInt(String(cs.fontWeight || '400'), 10) || 400,
                lineHeight: String(cs.lineHeight || '').trim() === 'normal' ? 0 : px(cs.lineHeight),
                letterSpacing: String(cs.letterSpacing || '').trim() === 'normal' ? 0 : px(cs.letterSpacing),
                textAlign: ['left', 'center', 'right', 'justify'].includes(cs.textAlign) ? cs.textAlign : 'left',
                shadowEnabled: String(cs.boxShadow || '').trim() !== '' && String(cs.boxShadow || '').trim() !== 'none',
                shadowVisible: String(cs.boxShadow || '').trim() !== '' && String(cs.boxShadow || '').trim() !== 'none',
                shadowType: String(cs.boxShadow || '').includes('inset') ? 'inner' : 'drop',
                shadowX: (function() {
                  const m = String(cs.boxShadow || '').match(/(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px/);
                  return m ? (parseFloat(m[1]) || 0) : 0;
                })(),
                shadowY: (function() {
                  const m = String(cs.boxShadow || '').match(/(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px/);
                  return m ? (parseFloat(m[2]) || 0) : 0;
                })(),
                shadowBlur: (function() {
                  const m = String(cs.boxShadow || '').match(/(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px/);
                  return m ? (parseFloat(m[3]) || 0) : 0;
                })(),
                shadowSpread: (function() {
                  const m = String(cs.boxShadow || '').match(/(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px\\s+(-?\\d+(?:\\.\\d+)?)px/);
                  return m ? (parseFloat(m[4]) || 0) : 0;
                })(),
                shadowColor: (function() {
                  const c = String(cs.boxShadow || '');
                  const m = c.match(/(rgba?\\([^\\)]+\\)|#[0-9a-fA-F]{3,8})/);
                  return m ? m[1] : 'rgba(0,0,0,0.25)';
                })(),
                blurType: (function() {
                  const b = String(cs.backdropFilter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  if (b) return 'backdrop';
                  return 'layer';
                })(),
                blurEnabled: (function() {
                  const b = String(cs.backdropFilter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  const f = String(cs.filter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  return !!(b || f);
                })(),
                blurVisible: (function() {
                  const b = String(cs.backdropFilter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  const f = String(cs.filter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  return !!(b || f);
                })(),
                blur: (function() {
                  const b = String(cs.backdropFilter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  if (b) return (parseFloat(b[1]) || 0);
                  const m = String(cs.filter || '').match(/blur\\(([-\\d.]+)px\\)/);
                  return m ? (parseFloat(m[1]) || 0) : 0;
                })(),
              }
              ,
              computedStyles,
              attributes,
              dataset,
              fontFamilies: Array.from(fontFamiliesSet).slice(0, 200),
              classNames: Array.from(classNamesSet).slice(0, 5000)
            };
          })()
        `) as { success: boolean; styles?: Record<string, string>; computedStyles?: Record<string, string>; attributes?: Record<string, string>; dataset?: Record<string, string>; fontFamilies?: string[]; classNames?: string[] } | null;
        if (result?.success && result.styles) {
          setElementStyles((prev) => ({ ...prev, ...result.styles }))
          setSelectedLayerComputedStyles(result.computedStyles || null)
          setSelectedLayerAttributes(result.attributes || null)
          setSelectedLayerDataset(result.dataset || null)
          setSelectedLayerFontFamilies(Array.isArray(result.fontFamilies) ? result.fontFamilies : null)
          setSelectedLayerClassNames(Array.isArray(result.classNames) ? result.classNames : null)
        }
      } catch (e) {
        console.warn('[Layers] Failed to read element styles:', e)
      }
    } else {
      setSelectedLayerElementNumber(null)
      setSelectedLayerElementName(null)
      setSelectedLayerComputedStyles(null)
      setSelectedLayerAttributes(null)
      setSelectedLayerDataset(null)
      setSelectedLayerFontFamilies(null)
      setSelectedLayerClassNames(null)
    }
  }, [activeTabId, isMultiViewportMode]);
  const handleTreeNodeSelectRef = useRef<(node: TreeNode) => void>(() => {});
  useEffect(() => { handleTreeNodeSelectRef.current = handleTreeNodeSelect as unknown as (node: TreeNode) => void; }, [handleTreeNodeSelect]);

  // Handle file selection from file tree
  const handleFileTreeSelect = useCallback(async (filePath: string) => {
    console.log('[App] File selected from tree:', filePath)
    setEditorFilePath(filePath)
    setHasUnsavedEdits(false)

    // Load file content
    try {
      let result = await window.electronAPI.files.readFile(filePath)

      // If file not found, try searching for it by filename
      if (!result.success && result.error?.includes('ENOENT') && activeTab.projectPath) {
        const filename = filePath.split('/').pop()
        console.log('[App] File not found at', filePath, '- searching for:', filename)

        const searchResult = await window.electronAPI.files.findFiles(activeTab.projectPath, filename!)
        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          const foundPath = searchResult.data[0]
          console.log('[App] Found file at:', foundPath)
          setEditorFilePath(foundPath)
          result = await window.electronAPI.files.readFile(foundPath)
        }
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to read file')
      }
      const content = result.data || ''
      console.log('[App] File loaded:', content.length, 'bytes')
      setEditorFileContent(content)
      setIsEditorMode(true) // Switch center pane to editor
    } catch (error) {
      console.error('[App] Failed to load file:', error)
      setEditorFileContent(`// Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsEditorMode(true)
    }
  }, [activeTab.projectPath])

  const flushApplyElementStyles = useCallback(() => {
    if (applyElementStylesTimerRef.current) {
      window.clearTimeout(applyElementStylesTimerRef.current)
      applyElementStylesTimerRef.current = null
    }

    const elementNumber = selectedLayerElementNumberRef.current
    if (!elementNumber) return

    const tabId = activeTabIdRef.current
    const webview = webviewRefs.current.get(tabId)
    if (!webview) return

    const s = elementStylesRef.current
    const payload = JSON.stringify({
      className: s.className,
      cssOverrides: s.cssOverrides,
      attributeOverrides: s.attributeOverrides,
      datasetOverrides: s.datasetOverrides,
      googleFonts: s.googleFonts,
      fontFaces: s.fontFaces,
      x: s.x,
      y: s.y,
      rotation: s.rotation,
      scaleX: s.scaleX,
      scaleY: s.scaleY,
      width: s.width,
      height: s.height,
      display: s.display,
      flexDirection: s.flexDirection,
      justifyContent: s.justifyContent,
      alignItems: s.alignItems,
      gap: s.gap,
      padding: s.padding,
      overflow: s.overflow,
      boxSizing: s.boxSizing,
      backgroundColor: s.backgroundColor,
      opacity: s.opacity,
      borderRadius: s.borderRadius,
      borderWidth: s.borderWidth,
      borderStyle: s.borderStyle,
      borderColor: s.borderColor,
      color: s.color,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      textAlign: s.textAlign,
      shadowEnabled: s.shadowEnabled,
      shadowVisible: s.shadowVisible,
      shadowType: s.shadowType,
      shadowX: s.shadowX,
      shadowY: s.shadowY,
      shadowBlur: s.shadowBlur,
      shadowSpread: s.shadowSpread,
      shadowColor: s.shadowColor,
      blurEnabled: s.blurEnabled,
      blurVisible: s.blurVisible,
      blurType: s.blurType,
      blur: s.blur,
    })

    try {
      webview.executeJavaScript(`
        (function() {
          const map = window.__layersElements;
          if (!map || !(map instanceof Map)) return { success: false, error: 'No element map' };
          const el = map.get(${elementNumber});
          if (!el) return { success: false, error: 'Element not found' };
          const s = ${payload};

          if (typeof s.className === 'string') {
            el.className = s.className;
          }

          // Apply attribute/dataset overrides from the Properties section
          const nextAttrs = (s.attributeOverrides && typeof s.attributeOverrides === 'object') ? s.attributeOverrides : {};
          const prevAttrKeys = Array.isArray(el.__clusoAttrOverrideKeys) ? el.__clusoAttrOverrideKeys : [];
          for (const k of prevAttrKeys) {
            if (!(k in nextAttrs)) {
              try { el.removeAttribute(k); } catch (e) {}
            }
          }
          const appliedAttrKeys = [];
          for (const k in nextAttrs) {
            if (!Object.prototype.hasOwnProperty.call(nextAttrs, k)) continue;
            const v = String(nextAttrs[k] ?? '');
            try {
              if (v === '') el.removeAttribute(k);
              else el.setAttribute(k, v);
              appliedAttrKeys.push(k);
            } catch (e) {}
          }
          el.__clusoAttrOverrideKeys = appliedAttrKeys;

          const nextDataset = (s.datasetOverrides && typeof s.datasetOverrides === 'object') ? s.datasetOverrides : {};
          const prevDataKeys = Array.isArray(el.__clusoDataOverrideKeys) ? el.__clusoDataOverrideKeys : [];
          for (const k of prevDataKeys) {
            if (!(k in nextDataset)) {
              try { delete el.dataset[k]; } catch (e) {}
            }
          }
          const appliedDataKeys = [];
          for (const k in nextDataset) {
            if (!Object.prototype.hasOwnProperty.call(nextDataset, k)) continue;
            const v = String(nextDataset[k] ?? '');
            try {
              if (v === '') delete el.dataset[k];
              else el.dataset[k] = v;
              appliedDataKeys.push(k);
            } catch (e) {}
          }
          el.__clusoDataOverrideKeys = appliedDataKeys;

          // Ensure Google fonts are loaded (document-scoped)
          try {
            const families = Array.isArray(s.googleFonts) ? s.googleFonts : [];
            for (const fam of families) {
              const family = String(fam || '').trim();
              if (!family) continue;
              const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              const id = 'cluso-google-font-' + slug;
              if (!document.getElementById(id)) {
                const link = document.createElement('link');
                link.id = id;
                link.rel = 'stylesheet';
                const familyParam = encodeURIComponent(family).replace(/%20/g, '+');
                link.href = 'https://fonts.googleapis.com/css2?family=' + familyParam + ':wght@100;200;300;400;500;600;700;800;900&display=swap';
                document.head.appendChild(link);
              }
            }
          } catch (e) {}

          // Ensure @font-face rules exist for project/local fonts (document-scoped)
          try {
            const faces = Array.isArray(s.fontFaces) ? s.fontFaces : [];
            let styleEl = document.getElementById('cluso-font-faces');
            if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = 'cluso-font-faces';
              document.head.appendChild(styleEl);
            }
            const seen = new Set();
            const rules = [];
            for (const face of faces) {
              if (!face) continue;
              const family = String(face.family || '').trim();
              const srcUrl = String(face.srcUrl || '').trim();
              if (!family || !srcUrl) continue;
              const key = family + '|' + srcUrl;
              if (seen.has(key)) continue;
              seen.add(key);
              const fmt = String(face.format || '').trim();
              const fmtPart = fmt ? (' format(\\'' + fmt.replace(/'/g, '') + '\\')') : '';
              rules.push(\"@font-face{font-family:'\" + family.replace(/'/g, \"\\\\'\") + \"';src:url('\" + srcUrl.replace(/'/g, \"\\\\'\") + \"')\" + fmtPart + \";font-display:swap;}\");
            }
            styleEl.textContent = rules.join('\\n');
          } catch (e) {}

          el.style.width = s.width + 'px';
          el.style.height = s.height + 'px';
          el.style.transform = 'translate(' + s.x + 'px, ' + s.y + 'px) rotate(' + s.rotation + 'deg) scale(' + (s.scaleX || 1) + ',' + (s.scaleY || 1) + ')';

          el.style.display = s.display;
          if (s.display === 'flex') {
            el.style.flexDirection = s.flexDirection;
            el.style.justifyContent = s.justifyContent;
            el.style.alignItems = s.alignItems;
          }

          el.style.gap = s.gap + 'px';
          el.style.padding = s.padding + 'px';

          el.style.overflow = s.overflow;
          el.style.boxSizing = s.boxSizing;

          el.style.backgroundColor = s.backgroundColor;
          el.style.opacity = String((s.opacity || 0) / 100);
          el.style.borderRadius = s.borderRadius + 'px';

          el.style.borderWidth = (s.borderWidth || 0) + 'px';
          el.style.borderStyle = s.borderStyle || (s.borderWidth ? 'solid' : 'none');
          el.style.borderColor = s.borderColor || '';

          el.style.color = s.color || '';
          el.style.fontFamily = s.fontFamily || '';
          el.style.fontSize = (s.fontSize || 0) ? (s.fontSize + 'px') : '';
          el.style.fontWeight = s.fontWeight ? String(s.fontWeight) : '';
          el.style.lineHeight = (s.lineHeight || 0) ? (s.lineHeight + 'px') : '';
          el.style.letterSpacing = (s.letterSpacing || 0) ? (s.letterSpacing + 'px') : '';
          el.style.textAlign = s.textAlign || '';

          if (s.shadowEnabled && s.shadowVisible) {
            const inset = (s.shadowType === 'inner') ? 'inset ' : '';
            el.style.boxShadow = inset + (s.shadowX || 0) + 'px ' + (s.shadowY || 0) + 'px ' + (s.shadowBlur || 0) + 'px ' + (s.shadowSpread || 0) + 'px ' + (s.shadowColor || 'rgba(0,0,0,0.25)');
          } else {
            el.style.boxShadow = 'none';
          }

          if (s.blurEnabled && s.blurVisible && (s.blur || 0) > 0) {
            if (s.blurType === 'backdrop') {
              el.style.backdropFilter = 'blur(' + s.blur + 'px)';
              el.style.filter = '';
            } else {
              el.style.filter = 'blur(' + s.blur + 'px)';
              el.style.backdropFilter = '';
            }
          } else {
            el.style.filter = '';
            el.style.backdropFilter = '';
          }

          // Apply custom CSS overrides (e.g., from the CSS inspector tab)
          const nextOverrides = (s.cssOverrides && typeof s.cssOverrides === 'object') ? s.cssOverrides : {};
          const prevKeys = Array.isArray(el.__clusoCssOverrideKeys) ? el.__clusoCssOverrideKeys : [];
          for (const k of prevKeys) {
            if (!(k in nextOverrides)) {
              el.style.removeProperty(k);
            }
          }
          const appliedKeys = [];
          for (const k in nextOverrides) {
            if (!Object.prototype.hasOwnProperty.call(nextOverrides, k)) continue;
            const v = String(nextOverrides[k] ?? '').trim();
            if (!v) {
              el.style.removeProperty(k);
              continue;
            }
            el.style.setProperty(k, v);
            appliedKeys.push(k);
          }
          el.__clusoCssOverrideKeys = appliedKeys;

          return { success: true };
        })()
      `);
    } catch (e) {
      console.warn('[Properties] Failed to apply styles:', e)
    }
  }, [])

  const queueApplyElementStyles = useCallback(() => {
    if (applyElementStylesTimerRef.current) {
      window.clearTimeout(applyElementStylesTimerRef.current)
    }
    applyElementStylesTimerRef.current = window.setTimeout(flushApplyElementStyles, 120)
  }, [flushApplyElementStyles])

  useEffect(() => {
    return () => {
      if (applyElementStylesTimerRef.current) {
        window.clearTimeout(applyElementStylesTimerRef.current)
        applyElementStylesTimerRef.current = null
      }
    }
  }, [])

  const handleElementStyleChange = useCallback((key: keyof ElementStyles, value: ElementStyles[keyof ElementStyles]) => {
    setElementStyles(prev => {
      const next = { ...prev, [key]: value } as ElementStyles
      elementStylesRef.current = next
      return next
    })
    queueApplyElementStyles()
  }, [queueApplyElementStyles])

  // Left panel resize handlers
  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsLeftResizing(true);
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(200, Math.min(400, startWidth + deltaX));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsLeftResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [leftPanelWidth]);

  // Mark Layers tree stale on navigation changes; refresh is user/event-driven only.
  useEffect(() => {
    if (activeTab.url) layersTreeStaleRef.current = true
  }, [activeTab.url])

  // No auto-refresh on open; Layers refresh is selection/manual driven.

  // Handle get_page_elements tool - scans page for interactive elements
  // Supports hierarchical focusing: if an element is focused, only shows children of that element
  // showBadges: when false, doesn't create visual number badges (used for background context priming)
  const handleGetPageElements = useCallback(async (category?: string, showBadges: boolean = true): Promise<string> => {
    console.log('[AI] Getting page elements, category:', category, 'showBadges:', showBadges);
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      return 'Error: Webview not ready';
    }

    // Build selector based on category - this selector is used for BOTH counting AND numbering
    const categorySelectors: Record<string, string> = {
      'buttons': 'button, [role="button"], [data-slot="button"], input[type="button"], input[type="submit"]',
      'links': 'a[href], [role="link"]',
      'inputs': 'input, textarea, select, [role="textbox"], [contenteditable="true"]',
      'images': 'img, [role="img"], svg',
      'headings': 'h1, h2, h3, h4, h5, h6, [role="heading"]',
      'all': 'button, [role="button"], a[href], input, textarea, select, img, h1, h2, h3, h4, h5, h6'
    };

    const selector = categorySelectors[category || 'all'] || categorySelectors['all'];

    const scanCode = `
      (function() {
        const category = '${category || 'all'}';
        const selector = '${selector}';
        const showBadges = ${showBadges};
        const results = {};

        // Clear existing number badges
        document.querySelectorAll('.element-number-badge').forEach(b => b.remove());

        // Check if we have a focused element (scoped search)
        const focusScope = window.__focusedElement;
        const searchRoot = focusScope || document;

        // Helper to get element summary
        function summarize(el, number) {
          const text = el.innerText?.substring(0, 50) || '';
          const id = el.id ? '#' + el.id : '';
          const classes = el.className ? '.' + String(el.className).split(' ').filter(c => c && !c.includes('inspector') && !c.includes('cluso')).slice(0, 2).join('.') : '';
          const href = el.getAttribute('href') || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          return { number, tag: el.tagName.toLowerCase(), id, classes, text: text.trim(), href, ariaLabel };
        }

        // Create number badge
        function createBadge(number) {
          const badge = document.createElement('div');
          badge.className = 'element-number-badge';
          badge.setAttribute('data-cluso-ui', '1');
          badge.setAttribute('aria-hidden', 'true');
          badge.textContent = number;
          badge.style.cssText = 'position:absolute;top:-8px;left:-8px;width:20px;height:20px;background:#3b82f6;color:white;border-radius:50%;font-size:11px;font-weight:bold;display:flex;align-items:center;justify-content:center;z-index:999999;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.3);';
          return badge;
        }

        // Find elements - scoped to focused element if exists
        const elements = searchRoot.querySelectorAll(selector);
        const numberedElements = [];

        // Collect element info (and optionally add badges)
        elements.forEach((el, idx) => {
          // Skip if element is hidden
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return;

          const num = numberedElements.length + 1;

          // Only create badges if showBadges is true
          if (showBadges) {
            const badge = createBadge(num);
            const rect = el.getBoundingClientRect();
            badge.style.top = (rect.top + window.scrollY - 8) + 'px';
            badge.style.left = (rect.left + window.scrollX - 8) + 'px';
            document.body.appendChild(badge);
          }
          numberedElements.push({ ...summarize(el, num), element: el });
        });

        // Store elements for highlight_element_by_number to use
        window.__numberedElements = numberedElements.map(e => e.element);

        results.totalElements = numberedElements.length;
        results.category = category;
        results.elements = numberedElements.slice(0, 20).map(({ element, ...rest }) => rest); // Return first 20 for AI context
        results.focusScope = focusScope ? {
          tag: focusScope.tagName.toLowerCase(),
          text: (focusScope.innerText || '').substring(0, 30),
          hint: 'Showing elements WITHIN focused scope. Say "clear focus" to see all elements.'
        } : null;
        results.note = numberedElements.length > 0
          ? 'Elements numbered on page. Use highlight_element_by_number(N) to highlight or set focus.'
          : 'No elements found' + (focusScope ? ' within focused area.' : '.');

        return JSON.stringify(results, null, 2);
      })()
    `;

    try {
      const result = await webview.executeJavaScript(scanCode) as string;
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
      const preferredModelId = selectedModelRef.current?.id;
      initializeSelectorAgent({ modelId: preferredModelId }).then(success => {
        if (success) {
          console.log('[SelectorAgent] Initialized successfully', preferredModelId ? `with model ${preferredModelId}` : '');
          return;
        }
        // Retry with default model if custom selection failed
        if (preferredModelId) {
          console.warn('[SelectorAgent] Init failed with model', preferredModelId, '- retrying default');
          initializeSelectorAgent().then(retrySuccess => {
            if (retrySuccess) {
              console.log('[SelectorAgent] Initialized successfully with default model');
            }
          });
        }
      });
    }
  }, [isElectron, selectorAgentActive, initializeSelectorAgent]);

  // Prime selector agent with page context when page elements are fetched
  const primeAgentWithPageContext = useCallback(async () => {
    if (!selectorAgentActive) return;

    // Pass false for showBadges - we just need the data, not visual badges
    const pageElements = await handleGetPageElements('all', false);
    if (pageElements && !pageElements.startsWith('Error')) {
      const webview = webviewRefs.current.get(activeTabId);
      const pageUrl = webview ? await webview.executeJavaScript('window.location.href').catch(() => '') as string : '';
      const pageTitle = webview ? await webview.executeJavaScript('document.title').catch(() => '') as string : '';

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

    const patchResult = await fileService.patchFileBySearch({
      filePath,
      searchCode,
      replaceCode,
      description,
    });

    if (!patchResult.success) {
      return { success: false, error: patchResult.error || `Failed to patch file: ${filePath}` };
    }

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content: `✓ Patched ${filePath}: ${description}`,
      timestamp: new Date()
    }]);

    return { success: true };
  }, []);

  // Handle list_files tool - list files in a directory
  const handleListFiles = useCallback(async (path?: string): Promise<string> => {
    console.log('[AI] Listing files:', path);
    try {
      const result = await fileService.listDirectory(path);
      if (result.success && result.data) {
        const formatted = result.data.map(f =>
          `${f.isDirectory ? '📁' : '📄'} ${f.name}${f.isDirectory ? '/' : ''}`
        ).join('\n');
        return formatted || 'Empty directory';
      }
      return 'Error: ' + (result.error || 'Could not list directory');
    } catch (err) {
      return 'Error: ' + (err as Error).message;
    }
  }, []);

  // Handle read_file tool - read a file's contents
  const handleReadFile = useCallback(async (filePath: string): Promise<string> => {
    console.log('[AI] Reading file:', filePath);
    try {
      const result = await fileService.readFile(filePath, { truncateAt: 10000 });
      if (result.success && result.data) return result.data;
      return 'Error: ' + (result.error || 'Could not read file');
    } catch (err) {
      return 'Error: ' + (err as Error).message;
    }
  }, []);

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
      const result = await webview.executeJavaScript(code) as { success: boolean; error?: string };
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
    if (!isElectron) {
      return 'Error: File browser only available in Electron mode';
    }
    try {
      const targetPath = path || fileBrowserBasePath || '.';
      const result = await fileService.listDirectory(targetPath);
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
      const result = await fileService.listDirectory(item.path);
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
        const result = await fileService.readFile(item.path, { truncateAt: 50000 });
        if (result.success && result.data) {
          const panel: FileBrowserPanel = {
            type: 'file',
            path: item.path,
            title: item.name,
            content: result.data
          };
          // Update ref immediately
          fileBrowserStackRef.current = [...currentStack, panel];
          setFileBrowserStack(prev => [...prev, panel]);
          return `Opened file "${item.name}"`;
        }
        return 'Error: ' + (result.error || 'Could not read file');
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

    if (!isElectron) {
      return 'Error: File browser only available in Electron mode';
    }

    const result = await fileService.listDirectory(targetItem.path);
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

    if (!isElectron) {
      return 'Error: File browser only available in Electron mode';
    }

    // If path is provided, use it directly
    if (path) {
      const result = await fileService.readFile(path, { truncateAt: 50000 });
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
          const panel: FileBrowserPanel = {
            type: 'file',
            path: path,
            title: fileName,
            content: result.data
          };
          fileBrowserStackRef.current = [panel];
          fileBrowserVisibleRef.current = true;
          setFileBrowserStack([panel]);
          setFileBrowserVisible(true);
          return `Opened file "${fileName}"`;
        }
      }
      return `Error: ${result.error || `Could not read file at ${path}`}`;
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
    const result = await fileService.listDirectory(searchPath);
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
        const fileResult = await fileService.readFile(filePath, { truncateAt: 50000 });

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
              const filePanel: FileBrowserPanel = {
                type: 'file',
                path: filePath,
                title: found.name,
                content: fileResult.data
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
  // IMPORTANT: Only updates the selected element if one exists, not the entire page
  const handleCodeUpdate = useCallback((html: string) => {
    console.log('[InstantEdit] Applying HTML update to DOM');
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview || !isWebviewReady) {
      console.warn('[InstantEdit] Webview not ready');
      return;
    }

    // Validate HTML before injection - basic checks
    const trimmedHtml = html.trim();
    if (!trimmedHtml) {
      console.error('[InstantEdit] Empty HTML provided');
      return;
    }

    // Check for obviously dangerous patterns (security)
    const dangerousPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,  // Script tags
      /javascript:/gi,                        // javascript: URLs
      /on\w+\s*=/gi,                          // Event handlers like onclick=
      /data:text\/html/gi,                    // Data URLs
    ];

    let sanitizedHtml = trimmedHtml;
    let hadDangerousContent = false;
    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitizedHtml)) {
        console.warn('[InstantEdit] Removed potentially dangerous content:', pattern);
        sanitizedHtml = sanitizedHtml.replace(pattern, '');
        hadDangerousContent = true;
      }
    }

    // If we have a selected element, ONLY update that element
    // Otherwise, update the entire document (legacy behavior)
    const currentSelectedElement = selectedElementRef.current;

    let injectCode: string;
    if (currentSelectedElement?.xpath) {
      // Targeted update - only change the selected element
      console.log('[InstantEdit] Targeted update for element:', currentSelectedElement.tagName, currentSelectedElement.xpath);
      injectCode = `
        (function() {
          try {
            const xpath = '${currentSelectedElement.xpath.replace(/'/g, "\\'")}';
            const el = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!el) {
              return { success: false, error: 'Selected element not found in DOM' };
            }
            // Update only the outerHTML of the selected element
            el.outerHTML = \`${sanitizedHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
            return { success: true, message: 'Element updated', targeted: true };
          } catch (err) {
            return { success: false, error: err.message };
          }
        })()
      `;
    } else {
      // Full page update (only if no element selected)
      console.log('[InstantEdit] Full page update (no element selected)');
      injectCode = `
        (function() {
          try {
            // Replace entire document with new HTML
            document.documentElement.innerHTML = \`${sanitizedHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
            return { success: true, message: 'Page updated', targeted: false };
          } catch (err) {
            return { success: false, error: err.message };
          }
        })()
      `;
    }

    webview.executeJavaScript(injectCode)
      .then((result: { success: boolean; message?: string; error?: string; targeted?: boolean }) => {
        if (result?.success) {
          console.log('[InstantEdit] HTML applied to DOM successfully, targeted:', result.targeted);
          const updateType = result.targeted ? 'element' : 'page';
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: hadDangerousContent
              ? `✓ ${updateType} updated (unsafe content removed)`
              : `✓ ${updateType} updated`,
            timestamp: new Date()
          }]);
        } else {
          console.error('[InstantEdit] Failed to apply HTML:', result?.error);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: `✗ Update failed: ${result?.error || 'Unknown error'}`,
            timestamp: new Date()
          }]);
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
    stopSpeaking,
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
    onHighlightByNumber: handleHighlightByNumber,
    onClearFocus: handleClearFocus,
    onSetViewport: handleSetViewport,
    onSwitchTab: handleSwitchTab,
    onFindElementByText: handleFindElementByText,
    // DOM Navigation handlers for voice
    onSelectParent: handleSelectParent,
    onSelectChildren: handleSelectChildren,
    onSelectSiblings: handleSelectSiblings,
    onSelectAllMatching: handleSelectAllMatching,
    // Drill-Down Selection handlers for voice
    onStartDrillSelection: handleStartDrillSelection,
    onDrillInto: handleDrillInto,
    onDrillBack: handleDrillBack,
    onDrillForward: handleDrillForward,
    onExitDrillMode: handleExitDrillMode,
    selectedElement: selectedElement,
    // Pass Google API key from settings
    googleApiKey: appSettings.providers.find(p => p.id === 'google')?.apiKey,
    // Pass selected model for Live Gemini streaming
    selectedModelId: selectedModel.id,
  });

  const isVoiceSessionActive = !!streamState.isConnected

  const pendingEditSession = pendingDOMApproval
    ? ({
        kind: 'dom' as const,
        description: pendingDOMApproval.description,
        patchStatus: pendingDOMApproval.patchStatus,
        patchError: pendingDOMApproval.patchError,
        userApproved: pendingDOMApproval.userApproved,
        patch: pendingDOMApproval.patch,
      })
    : pendingChange?.source === 'code'
      ? ({
          kind: 'code' as const,
          description: pendingChange.description,
        })
      : null

  const pendingPreview = pendingDOMApproval
    ? ({
        applyCode: pendingDOMApproval.applyCode,
        undoCode: pendingDOMApproval.undoCode,
        additions: 1,
        deletions: 1,
      })
    : pendingChange
      ? ({
          applyCode: pendingChange.code,
          undoCode: pendingChange.undoCode,
          additions: pendingChange.additions,
          deletions: pendingChange.deletions,
        })
      : null

  const showWideApprovalCard = !!pendingDOMApproval || (isVoiceSessionActive && !!pendingChange)
  const showCompactApprovalPopup = !!pendingPreview && !isVoiceSessionActive && !pendingDOMApproval

  useEffect(() => {
    setIsPreviewingOriginal(false)
  }, [pendingDOMApproval?.id, pendingChange?.code])

  const showOriginalPreview = useCallback(async () => {
    if (!pendingPreview?.undoCode) return
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview) return
    try {
      await webview.executeJavaScript(pendingPreview.undoCode)
      setIsPreviewingOriginal(true)
    } catch (err) {
      console.error('[Preview] Failed to show original:', err)
    }
  }, [pendingPreview, activeTabId])

  const showChangedPreview = useCallback(async () => {
    if (!pendingPreview?.applyCode) return
    const webview = webviewRefs.current.get(activeTabId)
    if (!webview) return
    try {
      await webview.executeJavaScript(pendingPreview.applyCode)
      setIsPreviewingOriginal(false)
    } catch (err) {
      console.error('[Preview] Failed to show change:', err)
    }
  }, [pendingPreview, activeTabId])

  // Load available prompts and directory files on mount
  useEffect(() => {
    if (!isElectron) return;
    fileService.listPrompts().then(result => {
      if (result.success && result.data) {
        setAvailableCommands(result.data.map(name => ({ name, prompt: '' })));
      }
    });
    fileService.listDirectory().then(result => {
      if (result.success && result.data) {
        console.log('[Files] Loaded directory:', result.data.length, 'files');
        setDirectoryFiles(result.data);
      }
    });
  }, [isElectron]);

  // Load directory listing for @ command
  const loadDirectoryFiles = useCallback(async (dirPath?: string) => {
    if (!isElectron) return;
    console.log('[@ Files] Loading directory:', dirPath || '(default)');
    const result = await fileService.listDirectory(dirPath);
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
    if (!isElectron) return;

    const result = await fileService.selectFile(filePath);
    if (result.success && result.data) {
      const { path, content } = result.data;

      // Parse line range from path if present: "file.tsx (1426-1431)" or "file.tsx?t=123 (1426-1431)"
      let lineStart: number | undefined;
      let lineEnd: number | undefined;
      let elementType: string | undefined;

      const lineMatch = path.match(/\((\d+)-(\d+)\)$/);
      if (lineMatch) {
        lineStart = parseInt(lineMatch[1], 10);
        lineEnd = parseInt(lineMatch[2], 10);
      } else {
        // Try single line format: "(1426)"
        const singleLineMatch = path.match(/\((\d+)\)$/);
        if (singleLineMatch) {
          lineStart = parseInt(singleLineMatch[1], 10);
        }
      }

      // Try to detect element type from content (look for function/component names near start)
      if (content && lineStart) {
        const lines = content.split('\n');
        const startLine = lines[0] || '';
        // Look for common patterns: function X, const X, export function X, etc.
        const funcMatch = startLine.match(/(?:function|const|export\s+(?:default\s+)?(?:function|const)?)\s+(\w+)/);
        if (funcMatch) {
          elementType = funcMatch[1];
        }
      }

      setSelectedFiles(prev => [...prev, { path, content, lineStart, lineEnd, elementType }]);

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
    if (!isElectron) return;

    const result = await fileService.readPrompt(commandName);
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

    const syncInspectorSelectionToLayers = async (xpath: string, element: SelectedElement) => {
      try {
        if ((!layersTreeDataRef.current || layersTreeStaleRef.current) && !isLayersLoadingRef.current) {
          await handleRefreshLayersRef.current?.();
        }

        const elementNumber = await webview.executeJavaScript(`
          (function() {
            const map = window.__layersElements;
            if (!map || !(map instanceof Map)) return null;
            const el = document.evaluate(${JSON.stringify(xpath)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!el) return null;
            for (const entry of map.entries()) {
              const num = entry[0];
              const node = entry[1];
              if (node === el) return num;
            }
            return null;
          })()
        `);

        if (typeof elementNumber === 'number' && elementNumber > 0) {
          const name =
            (element?.text && String(element.text).trim().slice(0, 30)) ||
            (element?.id ? `#${element.id}` : '') ||
            (element?.className ? `.${String(element.className).split(' ')[0]}` : '') ||
            `<${String(element?.tagName || 'element').toLowerCase()}>`;

          handleTreeNodeSelectRef.current({
            id: xpath,
            name,
            type: 'component',
            tagName: String(element?.tagName || 'div').toLowerCase(),
            elementNumber,
          } as any);
        } else {
          setSelectedTreeNodeId(null);
        }
      } catch (e) {
        console.warn('[Inspector→Layers] Failed to sync:', e);
      }
    };

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

    const handleIpcMessage = async (event: { channel: string; args: unknown[] }) => {
      const { channel, args } = event;

      if (channel === 'inspector-hover') {
        const data = args[0] as { element: SelectedElement; rect: { top: number; left: number; width: number; height: number } };
        setHoveredElement({ element: data.element, rect: data.rect });
      } else if (channel === 'inspector-hover-end') {
        setHoveredElement(null);
      } else if (channel === 'inspector-select') {
        const data = args[0] as { element: SelectedElement; x: number; y: number; rect: unknown; source?: string };
        console.log('[Inspector Select] Full element data:', data.element);
        console.log('[Inspector Select] sourceLocation:', data.element.sourceLocation);

        // IMPORTANT: Preserve sourceLocation if re-selecting same element with null sourceLocation
        const prevElement = selectedElementRef.current;
        const isSameElement = prevElement?.xpath && data.element.xpath && prevElement.xpath === data.element.xpath;
        const shouldPreserveSource = isSameElement && !data.element.sourceLocation && prevElement?.sourceLocation;
        if (shouldPreserveSource) {
          console.log('[Inspector Select] Preserving sourceLocation from previous selection');
        }

        setSelectedElement({
          ...data.element,
          x: data.x,
          y: data.y,
          rect: data.rect as SelectedElement['rect'],
          // Keep the old sourceLocation if new one is null but it's the same element
          sourceLocation: shouldPreserveSource ? prevElement.sourceLocation : data.element.sourceLocation
        });
        setHoveredElement(null); // Clear hover on selection

        // Copy element info to clipboard (use Electron API since webview steals focus)
        const el = data.element;
        const preservedSource = shouldPreserveSource ? prevElement.sourceLocation : data.element.sourceLocation;
        const sourceInfo = preservedSource?.summary || 'no source';
        const clipboardText = `${el.outerHTML || `<${el.tagName}>`}\n\nSource: ${sourceInfo}`;
        try {
          if (window.electronAPI?.clipboard?.writeText) {
            window.electronAPI.clipboard.writeText(clipboardText);
            console.log('[Inspector] Copied to clipboard via Electron:', sourceInfo);
          } else {
            // Fallback for web mode - may fail if document not focused
            await navigator.clipboard.writeText(clipboardText);
            console.log('[Inspector] Copied to clipboard via navigator:', sourceInfo);
          }
        } catch (err) {
          // Clipboard copy failed (expected when webview has focus)
          console.log('[Inspector] Clipboard copy skipped (webview focused)');
        }

        // If selection comes from Layers -> inspector sync, don't bounce back
        if (data.source === 'layers') {
          return;
        }

        // If the Layers/Properties panel is closed, don't auto-open it; just keep selection state.
        if (!isLeftPanelOpenRef.current) return;

        const xpath = data.element?.xpath;
        if (!xpath) return;
        await syncInspectorSelectionToLayers(xpath, data.element);
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
              `) as string;

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
              `) as { hasChildImg: boolean; childSrc?: string; currentBg?: string } | null;

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
                `) as { text?: string; bg?: string; bgSize?: string; bgPos?: string } | null;

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
              `) as string;

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
        // Handle inline text edit acceptance - INSTANT SAVE (no approval flow)
        const data = args[0] as { oldText: string; newText: string; element: SelectedElement };

        // Log all available source location data
        const msgSource = data.element?.sourceLocation;
        const refSource = selectedElementRef.current?.sourceLocation;
        console.log('[Inline Edit] Accepted:', {
          old: data.oldText?.substring(0, 30),
          new: data.newText?.substring(0, 30),
          msgHasSource: !!msgSource,
          msgSourceFile: msgSource?.sources?.[0]?.file,
          refHasSource: !!refSource,
          refSourceFile: refSource?.sources?.[0]?.file,
          refSummary: refSource?.summary
        });

        // Use element from message if it has sourceLocation, otherwise use selectedElementRef
        // The selectedElementRef should always have sourceLocation if an element was selected
        const elementWithSource = msgSource?.sources?.[0]
          ? data.element
          : (refSource ? selectedElementRef.current : null);

        const currentTab = tabsRef.current.find(t => t.id === tabId);
        const projectPath = currentTab?.projectPath;

        // INSTANT SAVE: Direct find/replace in source file
        if (elementWithSource?.sourceLocation && projectPath && data.oldText && data.newText) {
          (async () => {
            try {
              // Extract file path from sourceLocation
              const sourceLocation = elementWithSource.sourceLocation!;
              console.log('[Inline Edit] sourceLocation keys:', Object.keys(sourceLocation));
              console.log('[Inline Edit] likelyDefinitionFile:', sourceLocation.likelyDefinitionFile);
              console.log('[Inline Edit] summary:', sourceLocation.summary);
              const sources = sourceLocation.sources || [];
              let filePath = '';
              let targetLine = 0;

              // Strategy 1: Use likelyDefinitionFile FIRST (where text is actually defined)
              if (sourceLocation.likelyDefinitionFile) {
                const defFile = sourceLocation.likelyDefinitionFile;
                console.log('[Inline Edit] Using likelyDefinitionFile:', defFile);
                const globResult = await window.electronAPI?.files?.glob(`**/${defFile}`, projectPath);
                console.log('[Inline Edit] Glob result:', globResult);
                if (globResult?.success && globResult.data && globResult.data.length > 0) {
                  filePath = globResult.data[0].path;
                  console.log('[Inline Edit] Found definition file:', filePath);
                }
              }

              // Strategy 1b: Parse component name from summary if no likelyDefinitionFile
              if (!filePath && sourceLocation.summary) {
                const match = sourceLocation.summary.match(/^(\w+)\s*\(used in/);
                if (match) {
                  const componentName = match[1];
                  console.log('[Inline Edit] Extracted component name from summary:', componentName);
                  const globResult = await window.electronAPI?.files?.glob(`**/${componentName}.tsx`, projectPath);
                  if (globResult?.success && globResult.data && globResult.data.length > 0) {
                    filePath = globResult.data[0].path;
                    console.log('[Inline Edit] Found component file:', filePath);
                  }
                }
              }

              // Strategy 2: Find a source with a full path (contains /) - but only if no definition file
              if (!filePath) {
                for (const src of sources) {
                  if (src.file && src.file.includes('/') && src.line > 0) {
                    filePath = src.file;
                    targetLine = src.line;
                    console.log('[Inline Edit] Found full path in sources:', filePath);
                    break;
                  }
                }
              }

              // Strategy 3: Search for first source file name
              if (!filePath && sources[0]?.file) {
                const fileName = sources[0].file;
                console.log('[Inline Edit] Searching for source file:', fileName);
                const globResult = await window.electronAPI?.files?.glob(`**/${fileName}`, projectPath);
                if (globResult?.success && globResult.data && globResult.data.length > 0) {
                  filePath = globResult.data[0].path;
                  targetLine = sources[0]?.line || 0;
                  console.log('[Inline Edit] Found via glob:', filePath);
                }
              }

              // Make path absolute if relative
              if (filePath && !filePath.startsWith('/')) {
                filePath = `${projectPath}/${filePath}`;
              }

              if (!filePath) {
                console.error('[Inline Edit] Could not determine file path');
                return;
              }

              console.log('[Inline Edit] ====== INSTANT SAVE ======');
              console.log('[Inline Edit] File:', filePath);
              console.log('[Inline Edit] Target line:', targetLine);

              // Read source file
              const readResult = await fileService.readFileFull(filePath);
              if (!readResult.success || !readResult.data) {
                console.error('[Inline Edit] Failed to read file:', readResult.error);
                return;
              }

              const originalContent = readResult.data;
              const oldText = data.oldText;
              const newText = data.newText;

              console.log('[Inline Edit] Old text (' + oldText.length + ' chars):', JSON.stringify(oldText.substring(0, 80)));
              console.log('[Inline Edit] New text (' + newText.length + ' chars):', JSON.stringify(newText.substring(0, 80)));
              console.log('[Inline Edit] File length:', originalContent.length, 'chars,', originalContent.split('\n').length, 'lines');

              // Count occurrences
              let count = 0;
              let idx = 0;
              while ((idx = originalContent.indexOf(oldText, idx)) !== -1) {
                count++;
                idx += oldText.length;
              }
              console.log('[Inline Edit] Found', count, 'occurrences in file');

              let patchedContent = originalContent;

              if (count === 1) {
                // Exact match, single occurrence - safe to replace
                patchedContent = originalContent.replace(oldText, newText);
              } else if (count > 1 && targetLine > 0) {
                // Multiple occurrences - replace only near target line
                const lines = originalContent.split('\n');
                let charOffset = 0;
                for (let i = 0; i < Math.min(targetLine - 1, lines.length); i++) {
                  charOffset += lines[i].length + 1; // +1 for newline
                }
                // Find occurrence nearest to target line
                const searchStart = Math.max(0, charOffset - 500);
                const searchEnd = Math.min(originalContent.length, charOffset + 500);
                const nearIdx = originalContent.indexOf(oldText, searchStart);
                if (nearIdx !== -1 && nearIdx < searchEnd) {
                  patchedContent = originalContent.slice(0, nearIdx) + newText + originalContent.slice(nearIdx + oldText.length);
                  console.log('[Inline Edit] Replaced occurrence near line', targetLine);
                }
              } else if (count === 0) {
                // Text not found - DOM textContent differs from source (br/span tags, etc.)
                // Find the changed part between old and new text
                let commonPrefixLen = 0;
                while (commonPrefixLen < oldText.length && commonPrefixLen < newText.length &&
                       oldText[commonPrefixLen] === newText[commonPrefixLen]) {
                  commonPrefixLen++;
                }
                let commonSuffixLen = 0;
                while (commonSuffixLen < oldText.length - commonPrefixLen &&
                       commonSuffixLen < newText.length - commonPrefixLen &&
                       oldText[oldText.length - 1 - commonSuffixLen] === newText[newText.length - 1 - commonSuffixLen]) {
                  commonSuffixLen++;
                }
                const changedOld = oldText.slice(commonPrefixLen, oldText.length - commonSuffixLen);
                const changedNew = newText.slice(commonPrefixLen, newText.length - commonSuffixLen);

                console.log('[Inline Edit] Changed part:', JSON.stringify(changedOld), '→', JSON.stringify(changedNew));
                console.log('[Inline Edit] targetLine for search:', targetLine);

                // Strategy: Use targetLine to search in nearby source lines (avoids DOM/source mismatch)
                if (targetLine > 0 && changedOld.length >= 2) {
                  console.log('[Inline Edit] Searching lines', Math.max(0, targetLine - 6), 'to', Math.min(originalContent.split('\n').length, targetLine + 5));
                  const lines = originalContent.split('\n');
                  // Search 10 lines around target
                  const startLine = Math.max(0, targetLine - 6);
                  const endLine = Math.min(lines.length, targetLine + 5);

                  for (let lineNum = startLine; lineNum < endLine; lineNum++) {
                    const line = lines[lineNum];
                    // Check if this line contains the changed text (may be wrapped in JSX tags)
                    if (line.includes(changedOld)) {
                      // Found it! Replace in this line only
                      lines[lineNum] = line.replace(changedOld, changedNew);
                      patchedContent = lines.join('\n');
                      console.log('[Inline Edit] ✅ Replaced in line', lineNum + 1);
                      break;
                    }
                  }

                  // If still not found, try partial word match (in case DOM stripped quotes/entities)
                  if (patchedContent === originalContent && changedOld.length >= 4) {
                    const partialOld = changedOld.replace(/^["']|["']$/g, '').trim();
                    if (partialOld.length >= 3) {
                      for (let lineNum = startLine; lineNum < endLine; lineNum++) {
                        const line = lines[lineNum];
                        if (line.includes(partialOld)) {
                          lines[lineNum] = line.replace(partialOld, changedNew.replace(/^["']|["']$/g, '').trim());
                          patchedContent = lines.join('\n');
                          console.log('[Inline Edit] ✅ Replaced partial match in line', lineNum + 1);
                          break;
                        }
                      }
                    }
                  }
                } else if (changedOld && changedOld.length >= 2) {
                  console.log('[Inline Edit] No targetLine, trying global search for changedOld');
                  // Fallback: Search entire file for changedOld and count occurrences
                  const escapedChanged = changedOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const changedCount = (originalContent.match(new RegExp(escapedChanged, 'g')) || []).length;
                  console.log('[Inline Edit] Found', changedCount, 'occurrences of changedOld globally');
                  if (changedCount === 1) {
                    patchedContent = originalContent.replace(changedOld, changedNew);
                    console.log('[Inline Edit] ✅ Replaced single global occurrence');
                  }
                }
              }

              if (patchedContent === originalContent) {
                console.error('[Inline Edit] Could not find text to replace. Old text:', JSON.stringify(oldText.substring(0, 100)));
                console.error('[Inline Edit] targetLine was:', targetLine);
                return;
              }

              // Write immediately
              const writeResult = await fileService.writeFile(filePath, patchedContent);
              if (writeResult.success) {
                console.log('[Inline Edit] ✅ INSTANT SAVED:', filePath);
                addEditedFile({
                  path: filePath,
                  additions: 1,
                  deletions: 1,
                });
              } else {
                console.error('[Inline Edit] Write failed:', writeResult.error);
              }
            } catch (e) {
              console.error('[Inline Edit] Error:', e);
            }
          })();
        } else if (projectPath && data.oldText && data.newText) {
          // FALLBACK: Search for text in source files when sourceLocation is not available
          console.log('[Inline Edit] No sourceLocation - attempting text search fallback');
          (async () => {
            try {
              const oldText = data.oldText!;
              // Search for the text in source files
              const searchResult = await window.electronAPI?.files?.searchInFiles(
                oldText.substring(0, 50), // Use first 50 chars for search
                projectPath,
                { filePattern: '*.{tsx,jsx,ts,js}', maxResults: 10 }
              );

              if (searchResult?.success && searchResult.data && searchResult.data.length > 0) {
                // Filter to find best match (prefer src/ files)
                type Match = { file: string; line: number; content: string };
                const matches = searchResult.data
                  .filter((r: Match) => !r.file.includes('node_modules'))
                  .filter((r: Match) => r.file.includes('src/') || r.file.includes('app/') || r.file.includes('components/'));

                const bestMatch = matches[0] || searchResult.data.find((r: Match) => !r.file.includes('node_modules'));

                if (bestMatch) {
                  const filePath = bestMatch.file.startsWith('/') ? bestMatch.file : `${projectPath}/${bestMatch.file}`;
                  console.log('[Inline Edit] Found text in:', filePath);

                  const readResult = await fileService.readFile(filePath);
                  if (!readResult.success || !readResult.data) {
                    console.error('[Inline Edit] Could not read file');
                    return;
                  }

                  const originalContent = readResult.data;
                  // Simple find/replace
                  if (originalContent.includes(oldText)) {
                    const patchedContent = originalContent.replace(oldText, data.newText!);
                    const writeResult = await fileService.writeFile(filePath, patchedContent);
                    if (writeResult.success) {
                      console.log('[Inline Edit] ✅ FALLBACK SAVED:', filePath);
                      addEditedFile({ path: filePath, additions: 1, deletions: 1 });
                    }
                  }
                }
              } else {
                console.log('[Inline Edit] Text not found in project files');
              }
            } catch (e) {
              console.error('[Inline Edit] Fallback search failed:', e);
            }
          })();
        } else {
          console.log('[Inline Edit] Cannot save - missing project path or text');
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
      enqueueConsoleLog({ type: logType, message: e.message, timestamp: new Date() })
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
  }, [updateTab, enqueueConsoleLog]);

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

  // Initialize ghostty terminal when terminal tab is selected
  useEffect(() => {
    if (consolePanelTab !== 'terminal' || !terminalContainerRef.current || terminalInstanceRef.current) return
    if (!ptyPort) return // Wait for PTY port to be available

    let mounted = true

    async function initTerminal() {
      try {
        // Dynamic import ghostty-web
        const ghostty = await import('ghostty-web')
        await ghostty.init()

        if (!mounted || !terminalContainerRef.current) return

        const term = new ghostty.Terminal({
          cols: 80,
          rows: 12,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
          fontSize: 13,
          theme: {
            background: isDarkMode ? '#1e1e1e' : '#fafaf9',
            foreground: isDarkMode ? '#d4d4d4' : '#292524',
            cursor: isDarkMode ? '#d4d4d4' : '#292524',
          },
        })

        const fitAddon = new ghostty.FitAddon()
        term.loadAddon(fitAddon)

        await term.open(terminalContainerRef.current)
        fitAddon.fit()

        terminalInstanceRef.current = { term, fitAddon }

        // Connect to WebSocket PTY using dynamic port
        const wsUrl = `ws://127.0.0.1:${ptyPort}`
        const cols = term.cols || 80
        const rows = term.rows || 12
        const url = `${wsUrl}?cols=${cols}&rows=${rows}`

        const ws = new WebSocket(url)

        ws.onopen = () => {
          console.log('[Terminal Panel] Connected to PTY')
        }

        let pendingWrites = ''
        let flushScheduled = false
        const scheduleFlush = () => {
          if (flushScheduled) return
          flushScheduled = true
          requestAnimationFrame(() => {
            flushScheduled = false
            if (!pendingWrites) return
            term.write(pendingWrites)
            pendingWrites = ''
          })
        }

        ws.onmessage = (event) => {
          pendingWrites += typeof event.data === 'string' ? event.data : String(event.data)
          scheduleFlush()
        }

        ws.onclose = () => {
          term.write('\r\n\x1b[33mConnection closed.\x1b[0m\r\n')
        }

        // Handle terminal input
        term.onData((data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data)
          }
        })

        // Handle resize
        term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }))
          }
        })

        // Store WebSocket for cleanup
        ;(terminalInstanceRef.current as { term: unknown; fitAddon: unknown; ws?: WebSocket }).ws = ws
      } catch (error) {
        console.error('[Terminal Panel] Failed to initialize terminal:', error)
      }
    }

    initTerminal()

    return () => {
      mounted = false
      if (terminalInstanceRef.current) {
        const instance = terminalInstanceRef.current as { term: { dispose?: () => void }; ws?: WebSocket }
        instance.ws?.close()
        instance.term?.dispose?.()
        terminalInstanceRef.current = null
      }
    }
  }, [consolePanelTab, isDarkMode, ptyPort])

  // Fit terminal when console panel resizes
  useEffect(() => {
    if (consolePanelTab === 'terminal' && terminalInstanceRef.current) {
      const instance = terminalInstanceRef.current as { fitAddon: { fit?: () => void } }
      setTimeout(() => {
        instance.fitAddon?.fit?.()
      }, 50)
    }
  }, [consoleHeight, consolePanelTab])

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

  // Ref for updateCodingContext to avoid triggering effect when function identity changes
  const updateCodingContextRef = useRef(updateCodingContext)
  updateCodingContextRef.current = updateCodingContext

  // Sync coding agent context when selections change
  useEffect(() => {
    updateCodingContextRef.current({
      selectedElement: selectedElement || null,
      selectedFiles: selectedFiles,
      selectedLogs: selectedLogs?.map(log => ({
        type: log.type,
        message: log.message,
      })) || [],
      projectPath: activeTab?.projectPath || null,
      recentMessages: messages.slice(-10) as any[],
    });
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
      const result = await fileService.writeFile(path, file.originalContent);
      if (result.success) {
        console.log('[Undo] File restored successfully');
        setEditedFiles(prev => prev.filter(f => f.path !== path));
      } else {
        console.error('[Undo] Failed to restore file:', result.error);
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
        await fileService.writeFile(file.path, file.originalContent).catch((err) => {
          console.warn(`[Undo] Failed to restore file ${file.path}:`, err)
        });
      } else if (file.isFileModification) {
        // No original content - use git to restore
        if (electronAPI?.git?.checkoutFile) {
          await electronAPI.git.checkoutFile(file.path).catch((err) => {
            console.warn(`[Undo] Failed to git checkout ${file.path}:`, err)
          });
        }
      } else if (file.undoCode && webview) {
        // Handle DOM-based undo
        await webview.executeJavaScript(file.undoCode).catch((err) => {
          console.warn(`[Undo] Failed to execute undo script for ${file.path}:`, err)
        });
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

  // Ref for addEditedFile to avoid triggering effect when function identity changes
  const addEditedFileRef = useRef(addEditedFile)
  addEditedFileRef.current = addEditedFile

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
      addEditedFileRef.current({
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
      const levelArg = args.toLowerCase();
      const validLevels: ThinkingLevel[] = ['off', 'low', 'med', 'high', 'ultrathink'];

      // Handle 'on' as alias for 'med'
      let actualLevel: ThinkingLevel = 'med';
      if (levelArg === 'on' || levelArg === '') {
        // Toggle: if currently off, turn on (med); if on, turn off
        actualLevel = thinkingLevel === 'off' ? 'med' : 'off';
      } else if (validLevels.includes(levelArg as ThinkingLevel)) {
        actualLevel = levelArg as ThinkingLevel;
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

  // Create Todo from Selected Element
  const createTodoFromElement = async (comment: string, priority: 'low' | 'medium' | 'high', dueDate?: string) => {
    if (!selectedElement) return;

    const projectPath = activeTab?.projectPath;
    if (!projectPath) {
      console.warn('[Todo] No project path available for saving todo');
      return;
    }

    const todoItem: TodoItem = {
      id: `todo-${Date.now()}`,
      text: comment || `${selectedElement.tagName}${selectedElement.id ? `#${selectedElement.id}` : ''} - inspect this element`,
      completed: false,
      priority,
      dueDate: dueDate || undefined,
      createdAt: new Date().toISOString(),
      source: 'element-inspection',
      userComment: comment,
      elementContext: {
        tagName: selectedElement.tagName,
        id: selectedElement.id || undefined,
        className: selectedElement.className || undefined,
        text: selectedElement.text?.substring(0, 200) || undefined,
        xpath: selectedElement.xpath || undefined,
        outerHTML: selectedElement.outerHTML?.substring(0, 500) || undefined,
        sourceLocation: selectedElement.sourceLocation ? {
          file: selectedElement.sourceLocation.sources?.[0]?.file,
          line: selectedElement.sourceLocation.sources?.[0]?.line,
          column: selectedElement.sourceLocation.sources?.[0]?.column,
          summary: selectedElement.sourceLocation.summary,
        } : undefined,
      },
    };

    // Save to file system
    const result = await fileService.writeTodo(projectPath, todoItem);
    if (result.success) {
      console.log('[Todo] Saved todo:', todoItem.id);
      // Also add to active tab's todos if available
      if (activeTab?.todosData) {
        setTabs(prev => prev.map(tab =>
          tab.id === activeTabId
            ? {
                ...tab,
                todosData: {
                  items: [...(tab.todosData?.items || []), todoItem]
                }
              }
            : tab
        ));
      }
    } else {
      console.error('[Todo] Failed to save todo:', result.error);
    }
  };

  // Toggle Todo Completion
  const handleToggleTodo = async (id: string, completed: boolean) => {
    const projectPath = activeTab?.projectPath;
    if (!projectPath) return;

    // Update in file system
    const result = await fileService.updateTodo(projectPath, id, { completed });
    if (result.success && result.data) {
      // Update in state
      setTabs(prev => prev.map(tab =>
        tab.id === activeTabId
          ? {
              ...tab,
              todosData: {
                items: (tab.todosData?.items || []).map(todo =>
                  todo.id === id ? { ...todo, completed, completedAt: completed ? new Date().toISOString() : undefined } : todo
                )
              }
            }
          : tab
      ));
    }
  };

  // Delete Todo
  const handleDeleteTodo = async (id: string) => {
    const projectPath = activeTab?.projectPath;
    if (!projectPath) return;

    // Delete from file system
    const result = await fileService.deleteTodo(projectPath, id);
    if (result.success) {
      // Remove from state
      setTabs(prev => prev.map(tab =>
        tab.id === activeTabId
          ? {
              ...tab,
              todosData: {
                items: (tab.todosData?.items || []).filter(todo => todo.id !== id)
              }
            }
          : tab
      ));
    }
  };

  // Load Todos from File System
  const loadTodosFromDisk = async () => {
    const projectPath = activeTab?.projectPath;
    if (!projectPath) return;

    const result = await fileService.listTodos(projectPath);
    if (result.success && result.data) {
      setTabs(prev => prev.map(tab =>
        tab.id === activeTabId
          ? {
              ...tab,
              todosData: {
                items: result.data || []
              }
            }
          : tab
      ));
    }
  };

  // Load todos when project path changes
  React.useEffect(() => {
    if (activeTab?.projectPath) {
      loadTodosFromDisk();
    }
  }, [activeTab?.projectPath]);

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
${selectedElement.sourceLocation ? (() => {
  // Extract the actual file path from summary if sources[0].file is just a component name
  const src = selectedElement.sourceLocation.sources?.[0];
  let filePath = src?.file || '';
  let lineNum = src?.line || 0;
  // If file is just a name (no /), try to extract path from summary: "ComponentName (used in /path/file.tsx:123)"
  if (!filePath.includes('/') && selectedElement.sourceLocation.summary) {
    const match = selectedElement.sourceLocation.summary.match(/\(used in ([^:]+):(\d+)\)/);
    if (match) {
      filePath = match[1];
      lineNum = parseInt(match[2], 10);
    }
  }
  return `- Source Location: ${filePath}${lineNum ? `:${lineNum}` : ''} (${selectedElement.sourceLocation.summary || 'no summary'})`;
})() : ''}
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

      // Get the provider for the SELECTED MODEL (not hardcoded to Google!)
      const selectedModelProvider = appSettings.providers.find(p =>
        p.id === selectedModel.provider && p.enabled && p.apiKey
      );

      // Fallback to Google if selected model's provider not found (backwards compatibility)
      const googleProvider = appSettings.providers.find(p => p.id === 'google' && p.enabled && p.apiKey);
      const providerForUIUpdate = selectedModelProvider || googleProvider;

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
                const originalSrc = await (webview as unknown as Electron.WebviewTag).executeJavaScript(`
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

                await (webview as unknown as Electron.WebviewTag).executeJavaScript(applyCode);

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
                const childImgInfo = await (webview as unknown as Electron.WebviewTag).executeJavaScript(`
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
                  const captureContent = await (webview as unknown as Electron.WebviewTag).executeJavaScript(`
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

                await (webview as unknown as Electron.WebviewTag).executeJavaScript(applyCode!);

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
                await (webview as unknown as Electron.WebviewTag).executeJavaScript(applyCode);
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
        instantUIDisabled: appSettings.instantUIDisabled,
      });

      // If ui_modify intent but no element selected, let it fall through to normal chat
      // (don't block - user might want to describe the element)

      // INSTANT UI PATH: Element selected with source location = fast path
      // Skip if instantUIDisabled is true - user wants to use source patches only
      if (intent.type === 'ui_modify' && selectedElement && selectedElement.sourceLocation?.sources?.[0] && !appSettings.instantUIDisabled) {
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
              const originalSrc = await (webview as unknown as Electron.WebviewTag).executeJavaScript(`
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
              await (webview as unknown as Electron.WebviewTag).executeJavaScript(applyCode);

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
              const childImgInfo = await (webview as unknown as Electron.WebviewTag).executeJavaScript(`
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
                const captureContent = await (webview as unknown as Electron.WebviewTag).executeJavaScript(`
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
              await (webview as unknown as Electron.WebviewTag).executeJavaScript(applyCode);

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
              await (webview as unknown as Electron.WebviewTag).executeJavaScript(applyCode);
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

        // Phase 1: Instant DOM update using the currently selected model.
        // If it's a Gemini model, use direct Google call; otherwise use AI SDK.
        const uiModelForUpdate = selectedModelRef.current.id;
        setStreamingMessage(prev => prev ? { ...prev, content: `🎯 Analyzing \`<${selectedElement.tagName.toLowerCase()}>\` element...\n\n⚡ Generating CSS changes with ${uiModelForUpdate}...` } : null);

        const uiResult = await generateUIUpdate(
          selectedElement,
          userMessage.content,
          providerForUIUpdate?.apiKey || '',
          uiModelForUpdate,
          providerConfigsRef.current,
        );
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
            const originalJson = await (webview as unknown as Electron.WebviewTag).executeJavaScript(captureOriginalScript);
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
            const result = await (webview as unknown as Electron.WebviewTag).executeJavaScript(storedApplyCode);
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
          content: userContentParts as unknown as CoreMessage['content'],
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
                // Normalize name for matching (lowercase, remove underscores)
                const normalizedName = toolName.toLowerCase().replace(/_/g, '');
                // Match by ID first, then fall back to normalized name
                const existing = (toolId && accumulatedToolCalls.find(t => t.id === toolId))
                  || accumulatedToolCalls.find(t => t.name.toLowerCase().replace(/_/g, '') === normalizedName && t.status === 'running')
                  || accumulatedToolCalls.find(t => t.status === 'running'); // Last resort: any running tool
                if (existing) {
                  existing.status = (tr.result as any)?.error ? 'error' : 'done';
                  existing.result = tr.result;
                  console.log('[AI SDK] Marked tool as done:', existing.name, existing.status);
                } else {
                  console.warn('[AI SDK] Could not find tool to mark as done:', toolName, toolId);
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
          onReasoningChunk: (chunk: unknown) => {
            // Reasoning chunk may be a string or an object with content
            const chunkObj = chunk as { content?: string } | string | null;
            const reasoningStr = typeof chunkObj === 'string' ? chunkObj : ((chunkObj as { content?: string })?.content ?? String(chunk ?? ''));
            console.log('[AI SDK] Reasoning chunk:', reasoningStr.substring(0, 100));
            setStreamingMessage(prev => prev ? { ...prev, reasoning: (prev.reasoning || '') + reasoningStr } : null);
          },
        });

        // Stream complete - finalize the message
        console.log('[AI SDK] Stream complete, clearing streaming state');
        setIsStreaming(false);
        setAgentProcessing(false);
        setConnectionState('idle'); // Move to idle state (connected but not streaming)

        // Force-complete any tools still marked as 'running' (matching may have failed)
        for (const tc of accumulatedToolCalls) {
          if (tc.status === 'running') {
            console.warn('[AI SDK] Force-completing stuck tool:', tc.name);
            tc.status = 'done';
          }
        }

        // Capture final tool states from accumulatedToolCalls (not stale streamingMessage closure)
        if (accumulatedToolCalls.length > 0) {
          const finalToolStates = accumulatedToolCalls.map(tc => ({
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
      setAgentProcessing(false);

      // Force-finalize any tool calls that are still showing as 'running'
      // This ensures chips show completion state even if callbacks didn't fire properly
      setStreamingMessage(prev => {
        if (prev && prev.toolCalls && prev.toolCalls.length > 0) {
          // Capture final tool states before clearing
          const finalTools = prev.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            status: (tc.status === 'error' ? 'error' : 'success') as 'success' | 'error',
            timestamp: new Date(),
          }));
          // Set completed tool calls for display after streaming ends
          setCompletedToolCalls(current => current.length > 0 ? current : finalTools);
        }
        return null;
      });
      // Note: Don't call cancelAI() here - it causes race conditions with tool approvals
      // The generating state is already managed by the stream completion callbacks
    }
  };

  // Calculate popup position for webview - smart positioning that accounts for full popup size
  const getPopupStyle = () => {
    const webview = webviewRefs.current.get(activeTabId);
    if (!selectedElement || !selectedElement.rect || !webview) return { display: 'none' };

    const webviewRect = webview.getBoundingClientRect();
    const buttonSize = 48; // Chat button size (matching w-12 h-12)
    const popupWidth = 320 + 56; // w-80 (320px) + left-14 (56px) for the expanded chat
    const popupHeight = 150; // Approximate height of expanded chat panel
    const offset = 8; // Distance from element corner

    // Element position relative to viewport
    const elementRect = selectedElement.rect;
    const elementTop = webviewRect.top + elementRect.top;
    const elementBottom = elementTop + elementRect.height;
    const elementLeft = webviewRect.left + elementRect.left;
    const elementRight = elementLeft + elementRect.width;

    // Determine best position based on available space
    let top: number;
    let left: number;
    let expandDirection = 'right'; // Chat expands to the right by default

    // Horizontal positioning: prefer right of element, fall back to left
    if (elementRight + offset + popupWidth < window.innerWidth - 10) {
      // Enough space on right
      left = elementRight + offset;
    } else if (elementLeft - offset - buttonSize > 10) {
      // Position button to left of element, chat expands right (might overlap element)
      left = elementLeft - buttonSize - offset;
    } else {
      // Fallback: position at element left edge
      left = Math.max(10, elementLeft);
    }

    // Vertical positioning: prefer below element, but go above if near bottom
    const spaceBelow = window.innerHeight - elementBottom - offset;
    const spaceAbove = elementTop - offset;

    if (spaceBelow >= popupHeight + 20) {
      // Plenty of space below
      top = elementBottom + offset;
    } else if (spaceAbove >= popupHeight + 20) {
      // Position above element
      top = elementTop - popupHeight - offset;
    } else {
      // Limited space - position at element center, clamped to screen
      top = Math.max(10, Math.min(elementTop, window.innerHeight - popupHeight - 10));
    }

    // Final clamp to ensure button is always visible
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
      const result = await fileService.readFileFull(filePath);
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
    // Ensure this approval id is not considered cancelled
    cancelledApprovalsRef.current.delete(approvalId);
    clearDomApprovalPatchTimeout(approvalId)
    markDomTelemetry(approvalId, 'patch_generation_started')
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
    
    // Wrap in timeout to prevent indefinite hangs
    const patchPromise = generateSourcePatch({
      element,
      cssChanges,
      providerConfig,
      projectPath: projectPath || undefined,
      userRequest,
      textChange,
      srcChange,
      disableFastApply: appSettingsRef.current.clusoCloudEditsEnabled,
      morphApiKey: appSettingsRef.current.providers.find(p => p.id === 'morph')?.apiKey,
    });

    const timeoutToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    domApprovalPatchTimeoutTokensRef.current.set(approvalId, timeoutToken)

    const timeoutPromise = new Promise<null>((resolve) => {
      const handle = setTimeout(() => {
        // Ignore if superseded/cancelled/cleared.
        const currentToken = domApprovalPatchTimeoutTokensRef.current.get(approvalId)
        if (currentToken !== timeoutToken) return
        // Cleanup so it can't fire again.
        clearDomApprovalPatchTimeout(approvalId)
        console.log('[DOM Approval] Patch generation TIMED OUT after 30s', { approvalId })
        resolve(null)
      }, 30000)
      domApprovalPatchTimeoutsRef.current.set(approvalId, handle)
    })
    
    Promise.race([patchPromise, timeoutPromise])
      .then(patch => {
        clearDomApprovalPatchTimeout(approvalId)
        console.log('[DOM Approval] Patch generation completed:', { approvalId, success: !!patch });
        if (cancelledApprovalsRef.current.has(approvalId)) return
        markDomTelemetry(approvalId, patch ? 'patch_ready' : 'patch_failed')
        setPendingDOMApproval(prev => {
          if (!prev || prev.id !== approvalId) return prev;
          if (cancelledApprovalsRef.current.has(approvalId)) return prev;
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
            const autoApproveFastPath =
              !!appSettingsRef.current.fastPathAutoApplyEnabled && patch.generatedBy === 'fast-path'
            return {
              ...prev,
              patchStatus: 'ready',
              patch: patchPayload,
              patchError: undefined,
              userApproved: prev.userApproved || autoApproveFastPath,
            };
          }
          console.warn('[DOM Approval] Patch generation returned null:', approvalId);
          return { ...prev, patchStatus: 'error', patch: undefined, patchError: 'Could not generate source patch.' };
        });
      })
      .catch((error: unknown) => {
        clearDomApprovalPatchTimeout(approvalId)
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate source patch';
        console.error('[DOM Approval] Patch generation failed:', { approvalId, error: errorMessage });
        if (cancelledApprovalsRef.current.has(approvalId)) return
        markDomTelemetry(approvalId, 'patch_failed')
        setPendingDOMApproval(prev => {
          if (!prev || prev.id !== approvalId) return prev;
          if (cancelledApprovalsRef.current.has(approvalId)) return prev;
          return { ...prev, patchStatus: 'error', patch: undefined, patchError: errorMessage };
        });
      })
      .finally(() => {
        clearDomApprovalPatchTimeout(approvalId)
      });
  }, [clearDomApprovalPatchTimeout, markDomTelemetry]);

  // Handle accepting DOM preview - generates source patch and auto-approves
  const handleAcceptDOMApproval = useCallback(async () => {
    if (!pendingDOMApproval) return;
    if (cancelledApprovalsRef.current.has(pendingDOMApproval.id)) {
      console.log('[DOM Approval] Accept aborted - approval was cancelled:', pendingDOMApproval.id);
      return;
    }

    // Patch generation timeout is only relevant while waiting; clear it once we move into accept flow.
    clearDomApprovalPatchTimeout(pendingDOMApproval.id)

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

    markDomTelemetry(pendingDOMApproval.id, 'user_accept')

    if (pendingDOMApproval.patchStatus === 'error' || !pendingDOMApproval.patch) {
      setMessages(prev => [...prev, {
        id: `msg-error-${Date.now()}`,
        role: 'assistant',
        content: pendingDOMApproval.patchError || 'Could not prepare a source patch for this change.',
        timestamp: new Date(),
      }]);
      setPendingDOMApproval(null);
      setPendingChange(null);
      finalizeDomTelemetry(pendingDOMApproval.id, 'cancelled')
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

      markDomTelemetry(pendingDOMApproval.id, 'source_write_started')
      const result = await fileService.writeFile(patch.filePath, patch.patchedContent);
      console.log('[DOM Approval] writeFile result:', result);

      // Verify the write by reading it back
      if (result.success) {
        const verifyResult = await fileService.readFileFull(patch.filePath);
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
        markDomTelemetry(pendingDOMApproval.id, 'source_write_succeeded')
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
      markDomTelemetry(pendingDOMApproval.id, 'source_write_failed')
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
    // Cleanup cancellation marker once lifecycle ends
    cancelledApprovalsRef.current.delete(pendingDOMApproval.id);
    finalizeDomTelemetry(pendingDOMApproval.id, 'accepted')
  }, [pendingDOMApproval, addEditedFile, markDomTelemetry, finalizeDomTelemetry, clearDomApprovalPatchTimeout]);

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

    clearDomApprovalPatchTimeout(pendingDOMApproval.id)

    markDomTelemetry(pendingDOMApproval.id, 'user_reject')
    cancelledApprovalsRef.current.add(pendingDOMApproval.id);
    const webview = webviewRefs.current.get(activeTabId);
    if (pendingDOMApproval.undoCode && webview) {
      (webview as unknown as Electron.WebviewTag).executeJavaScript(pendingDOMApproval.undoCode);
    }
    setPendingDOMApproval(null);
    setPendingChange(null); // Clear pill toolbar too
    finalizeDomTelemetry(pendingDOMApproval.id, 'rejected')
  }, [pendingDOMApproval, activeTabId, markDomTelemetry, finalizeDomTelemetry, clearDomApprovalPatchTimeout]);

  // Keyboard shortcuts for Accept/Reject pending changes
  // CMD+Enter = Accept, Escape = Reject
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if there's a pending change
      if (!pendingChange && !pendingDOMApproval) return;

      // CMD+Enter (Mac) or Ctrl+Enter (Windows) = Accept
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (pendingDOMApproval) {
          handleAcceptDOMApproval();
        } else {
          handleApproveChange();
        }
      }

      // Escape = Reject
      if (e.key === 'Escape') {
        e.preventDefault();
        if (pendingDOMApproval) {
          handleRejectDOMApproval();
        } else {
          handleRejectChange();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingChange, pendingDOMApproval, handleApproveChange, handleRejectChange, handleAcceptDOMApproval, handleRejectDOMApproval]);

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

  // Transparency settings for CSS backdrop-filter blur
  const isTransparent = !!appSettings.transparencyEnabled;
  const blurAmount = appSettings.windowBlur ?? 0;

  return (
    <div
      className={`relative flex flex-col h-screen w-full overflow-hidden font-sans ${isDarkMode ? 'dark bg-neutral-900 text-neutral-100' : 'bg-stone-50 text-neutral-900'}`}
    >
      {/* Content wrapper */}
      <div className="relative flex flex-col flex-1 overflow-hidden">

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
        extensionConnected={extensionConnected}
        indexingStatus={indexingStatus}
      />

      {/* Remote cursor from extension user */}
      {extensionSharing && extensionCursor && (() => {
        // Get webview bounds to position cursor relative to where the page is displayed
        const webview = webviewRefs.current.get(activeTabId);
        const webviewRect = webview?.getBoundingClientRect();

        let x: number;
        let y: number;
        let isAnchored = false;

        // Priority 1: Use viewport percentages (works across different screen sizes)
        if (extensionCursor.viewportPercentX !== undefined && extensionCursor.viewportPercentY !== undefined && webviewRect) {
          // Map their viewport percentages to our webview bounds
          x = webviewRect.left + (webviewRect.width * extensionCursor.viewportPercentX);
          y = webviewRect.top + (webviewRect.height * extensionCursor.viewportPercentY);
          isAnchored = !!extensionCursor.elementAnchor;
        } else if (webviewRect) {
          // Priority 2: Scale their client coordinates to our webview
          const scaleX = webviewRect.width / extensionCursor.viewportWidth;
          const scaleY = webviewRect.height / extensionCursor.viewportHeight;
          x = webviewRect.left + (extensionCursor.clientX * scaleX);
          y = webviewRect.top + (extensionCursor.clientY * scaleY);
        } else {
          // Fallback: Direct coordinates
          x = extensionCursor.clientX;
          y = extensionCursor.clientY;
        }

        // Calculate scroll difference indicator (shows if they're scrolled differently)
        const scrollDiffY = extensionCursor.scrollY;
        const hasScrollDiff = scrollDiffY > 50;

        return (
          <div
            className="fixed pointer-events-none z-[100000] transition-transform duration-75 ease-out"
            style={{ transform: `translate(${x}px, ${y}px)` }}
          >
            {/* Cursor pointer (rotated triangle) */}
            <div
              className="w-0 h-0"
              style={{
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderBottom: '16px solid #3b82f6',
                transform: 'rotate(-45deg)',
              }}
            />
            {/* Label with anchoring and scroll indicators */}
            <div
              className="absolute top-4 left-3 bg-blue-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap flex items-center gap-1"
            >
              <span>Extension User</span>
              {isAnchored && <span title={extensionCursor.elementAnchor?.elementText}>📍</span>}
              {hasScrollDiff && (
                <span className="opacity-70">↓{Math.round(scrollDiffY)}px</span>
              )}
            </div>
          </div>
        );
      })()}
      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden pt-1 pb-2 px-2 gap-1">

        {/* --- Left Panel: Tabbed (Layers + Files) --- */}
        {isLeftPanelOpen && (
          <ErrorBoundary fallback={<div className="p-4 text-red-500">Left panel failed to load</div>}>
            <>
              <TabbedLeftPanel
                width={leftPanelWidth}
                treeData={layersTreeData}
                selectedId={selectedTreeNodeId}
                onSelect={handleTreeNodeSelect}
                onRefresh={handleRefreshLayers}
                isDarkMode={isDarkMode}
                panelBg={panelBg}
                panelBorder={panelBorder}
                headerBg={headerBg}
                isLoading={isLayersLoading}
                selectedElementName={selectedLayerElementName}
                selectedElementNumber={selectedLayerElementNumber}
                styles={elementStyles}
                onStyleChange={handleElementStyleChange}
                computedStyles={selectedLayerComputedStyles}
                attributes={selectedLayerAttributes}
                dataset={selectedLayerDataset}
                fontFamilies={selectedLayerFontFamilies}
                projectPath={activeTab.projectPath || null}
                classNames={selectedLayerClassNames}
                sourceSnippet={selectedElementSourceSnippet}
                selectedFilePath={editorFilePath}
                onFileSelect={handleFileTreeSelect}
              />
              {/* Left resize handle */}
              <div
                className={`w-1 cursor-ew-resize z-10 transition-colors flex-shrink-0 ${isLeftResizing ? (isDarkMode ? 'bg-neutral-500' : 'bg-stone-400') : (isDarkMode ? 'hover:bg-neutral-600' : 'hover:bg-stone-300')}`}
                onMouseDown={handleLeftResizeStart}
              />
            </>
          </ErrorBoundary>
        )}

        {/* Left resize overlay */}
        {isLeftResizing && (
          <div className="fixed inset-0 z-50 cursor-ew-resize" />
        )}

        {/* --- Center Pane: Browser, New Tab Page, Kanban, Todos, Notes, or Project Setup --- */}
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
          <ErrorBoundary fallback={<div className="flex-1 p-4 text-red-500">Kanban board failed to load</div>}>
            <Suspense fallback={<LoadingSpinner />}>
              <div
                className="flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border"
                style={{ backgroundColor: panelBg, borderColor: panelBorder }}
              >
                <KanbanTab
                  columns={activeTab.kanbanData?.columns || []}
                  boardTitle={activeTab.kanbanData?.boardTitle || activeTab.title || 'Kanban'}
                  isDarkMode={isDarkMode}
                  onUpdateColumns={handleUpdateKanbanColumns}
                  onUpdateTitle={handleUpdateKanbanTitle}
                />
              </div>
            </Suspense>
          </ErrorBoundary>
        ) : activeTab.type === 'todos' ? (
          <ErrorBoundary fallback={<div className="flex-1 p-4 text-red-500">Todos failed to load</div>}>
            <Suspense fallback={<LoadingSpinner />}>
              <div
                className="flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border"
                style={{ backgroundColor: panelBg, borderColor: panelBorder }}
              >
                <TodosTab
                  items={activeTab.todosData?.items || []}
                  isDarkMode={isDarkMode}
                  onUpdateItems={handleUpdateTodoItems}
                  projectPath={activeTab.projectPath}
                />
              </div>
            </Suspense>
          </ErrorBoundary>
        ) : activeTab.type === 'notes' ? (
          <ErrorBoundary fallback={<div className="flex-1 p-4 text-red-500">Notes failed to load</div>}>
            <Suspense fallback={<LoadingSpinner />}>
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
            </Suspense>
          </ErrorBoundary>
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
        ) : isEditorMode ? (
          <div
            className="flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border"
            style={{ backgroundColor: panelBg, borderColor: panelBorder }}
          >
            {/* Code Editor Toolbar */}
            <div
              className="h-12 border-b flex items-center gap-2 px-3 flex-shrink-0 justify-between"
              style={{ borderColor: panelBorder }}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditorMode(false)}
                  className={`text-sm px-2 py-1 rounded transition-colors ${
                    isDarkMode
                      ? 'hover:bg-neutral-700 text-neutral-300'
                      : 'hover:bg-stone-200 text-stone-600'
                  }`}
                  title="Back to preview"
                >
                  ← Preview
                </button>
                <span className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-stone-700'}`}>
                  {editorFilePath?.split('/').pop() || 'Untitled'}
                </span>
                {hasUnsavedEdits && (
                  <span className="text-xs text-orange-500">●</span>
                )}
              </div>
              <button
                onClick={async () => {
                  if (!editorFilePath) return
                  try {
                    const result = await window.electronAPI.files.writeFile(editorFilePath, editorFileContent)
                    if (result.success) {
                      setHasUnsavedEdits(false)
                    }
                  } catch (error) {
                    console.error('Failed to save:', error)
                  }
                }}
                disabled={!hasUnsavedEdits}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  hasUnsavedEdits
                    ? isDarkMode
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                    : isDarkMode
                      ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                Save (Cmd+S)
              </button>
            </div>

            {/* Code Editor Content */}
            <div className="flex-1 min-h-0">
              <CodeEditor
                filePath={editorFilePath || undefined}
                content={editorFileContent}
                onChange={(value) => {
                  setEditorFileContent(value || '')
                  setHasUnsavedEdits(true)
                }}
                onSave={async (value) => {
                  if (!editorFilePath) return
                  try {
                    const result = await window.electronAPI.files.writeFile(editorFilePath, value)
                    if (result.success) {
                      setHasUnsavedEdits(false)
                    }
                  } catch (error) {
                    console.error('Failed to save:', error)
                  }
                }}
                isDarkMode={isDarkMode}
                initialLine={editorInitialLine}
              />
            </div>
          </div>
        ) : (
          <div
            className="flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border"
            style={{ backgroundColor: panelBg, borderColor: panelBorder }}
          >

            {/* Browser Toolbar */}
            <div
              className="h-12 border-b flex items-center gap-2 px-3 flex-shrink-0"
              style={{ borderColor: panelBorder }}
            >
          {/* Layers Toggle */}
          <button
            onClick={async () => {
              const next = !isLeftPanelOpen;
              setIsLeftPanelOpen(next);
              if (next) {
                setIsInspectorActive(true);
                if ((!layersTreeDataRef.current || layersTreeStaleRef.current) && !isLayersLoadingRef.current) {
                  await handleRefreshLayersRef.current?.();
                }

                // If an element is already selected (e.g. inspector used while panel was closed),
                // sync the tree to that selection when opening.
                try {
                  const xpath = selectedElementRef.current?.xpath;
                  const webview = webviewRefs.current.get(activeTabId);
                  if (!xpath || !webview) return;

                  const elementNumber = await webview.executeJavaScript(`
                    (function() {
                      const map = window.__layersElements;
                      if (!map || !(map instanceof Map)) return null;
                      const el = document.evaluate(${JSON.stringify(xpath)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                      if (!el) return null;
                      for (const entry of map.entries()) {
                        const num = entry[0];
                        const node = entry[1];
                        if (node === el) return num;
                      }
                      return null;
                    })()
                  `);

                  if (typeof elementNumber === 'number' && elementNumber > 0) {
                    const element = selectedElementRef.current as SelectedElement;
                    const name =
                      (element?.text && String(element.text).trim().slice(0, 30)) ||
                      (element?.id ? `#${element.id}` : '') ||
                      (element?.className ? `.${String(element.className).split(' ')[0]}` : '') ||
                      `<${String(element?.tagName || 'element').toLowerCase()}>`;

                    handleTreeNodeSelectRef.current({
                      id: xpath,
                      name,
                      type: 'component',
                      tagName: String(element?.tagName || 'div').toLowerCase(),
                      elementNumber,
                    } as any);
                  }
                } catch (e) {
                  console.warn('[Layers Toggle] Failed to sync selection:', e);
                }
              }
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isLeftPanelOpen ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-300' : 'hover:bg-stone-200 text-stone-600')}`}
            title={isLeftPanelOpen ? 'Hide layers' : 'Show layers'}
          >
            <Layers size={16} />
          </button>

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
            {/* Multi-Viewport Toggle */}
            <button
              onClick={() => setIsMultiViewportMode(!isMultiViewportMode)}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${isMultiViewportMode ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white shadow-sm') : (isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-stone-400 hover:text-stone-600')}`}
              title="Multi-Viewport Mode"
            >
              <LayoutGrid size={14} />
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
                data-control-id="url-bar"
                data-control-type="input"
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
            data-control-id="inspector-button"
            data-control-type="button"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isInspectorActive ? 'bg-blue-100 text-blue-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500')}`}
            title="Element Inspector"
          >
            <MousePointer2 size={16} />
          </button>

          {/* Floating Toolbar Toggle */}
          <button
            onClick={() => setIsFloatingToolbarVisible(!isFloatingToolbarVisible)}
            data-control-id="toolbar-toggle-button"
            data-control-type="button"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isFloatingToolbarVisible ? (isDarkMode ? 'bg-neutral-700 text-neutral-200' : 'bg-stone-200 text-stone-700') : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500')}`}
            title={isFloatingToolbarVisible ? 'Hide toolbar' : 'Show toolbar'}
          >
            <Wrench size={16} />
          </button>

          {/* Cluso Agent Toggle - Hidden */}
          {/* <button
            onClick={() => setIsAgentPanelOpen(!isAgentPanelOpen)}
            data-control-id="agent-button"
            data-control-type="button"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isAgentPanelOpen ? 'bg-purple-100 text-purple-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500')}`}
            title="Cluso Agent Demos"
          >
            <Bot size={16} />
          </button> */}

          {/* Console Toggle */}
          <button
            onClick={() => setIsConsolePanelOpen(!isConsolePanelOpen)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isConsolePanelOpen ? 'bg-blue-100 text-blue-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500')}`}
            title="Toggle Console"
          >
            <Terminal size={16} />
          </button>

          {/* Code Editor Toggle - Only visible when element has source location */}
          {activeTab.projectPath && selectedElement?.sourceLocation?.sources?.[0] && (
            <button
              onClick={async () => {
                const sources = selectedElement.sourceLocation?.sources || []
                if (sources.length === 0 || !activeTab.projectPath) return

                // Try each source until we find a file that exists
                for (const source of sources) {
                  if (!source?.file) continue

                  const filename = source.file.split('/').pop() || source.file
                  console.log('[Jump to Source] Trying:', filename)

                  const searchResult = await window.electronAPI.files.glob(`**/${filename}`, activeTab.projectPath)
                  const files = searchResult.data || []

                  if (searchResult.success && files.length > 0) {
                    const foundPath = typeof files[0] === 'string' ? files[0] : files[0]?.path
                    console.log('[Jump to Source] Found at:', foundPath, 'line:', source.line)
                    setEditorInitialLine(source.line)
                    await handleFileTreeSelect(foundPath)
                    setIsLeftPanelOpen(true)
                    return
                  }
                }
                console.error('[Jump to Source] No files found from sources:', sources.map(s => s?.file))
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'}`}
              title="Jump to Source"
            >
              <FileCode size={16} />
            </button>
          )}

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
          <div className={`flex-1 relative overflow-hidden flex flex-col ${isMultiViewportMode ? '' : 'justify-center items-center'} ${viewportSize === 'desktop' && !isMultiViewportMode ? '' : 'py-4 gap-3'} ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-200'}`}>

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

            {/* Multi-Viewport Mode - always mounted, hidden when inactive to preserve webviews */}
            <div
              className="absolute inset-0"
              style={{
                opacity: isMultiViewportMode ? 1 : 0,
                pointerEvents: isMultiViewportMode ? 'auto' : 'none',
                zIndex: isMultiViewportMode ? 10 : -1,
              }}
            >
              <ErrorBoundary fallback={<div className="p-4 text-red-500">Viewport canvas failed to load</div>}>
                <Suspense fallback={<LoadingSpinner />}>
                  <ViewportGrid
                    url={activeTab.url || ''}
                    isDarkMode={isDarkMode}
                    isElectron={isElectron}
                    webviewPreloadPath={webviewPreloadPath}
                    isInspectorActive={isInspectorActive}
                    isScreenshotActive={isScreenshotActive}
                    isMoveActive={isMoveActive}
                    terminalWsUrl={ptyPort ? `ws://127.0.0.1:${ptyPort}` : undefined}
                    onInspectorHover={(element, rect, _viewportId) => {
                      setHoveredElement({
                        element: element as SelectedElement,
                        rect: rect as { top: number; left: number; width: number; height: number }
                      })
                    }}
                    onInspectorSelect={(element, rect, _viewportId) => {
                      const data = { element: element as SelectedElement, rect: rect as SelectedElement['rect'], x: 0, y: 0 }
                      setSelectedElement({
                        ...data.element,
                        x: data.x,
                        y: data.y,
                        rect: data.rect
                      })
                      setHoveredElement(null)
                    }}
                    onScreenshotSelect={(element, rect, _viewportId) => {
                      setScreenshotElement(element as SelectedElement)
                      setIsScreenshotActive(false)
                      // Note: Screenshot capture for multi-viewport would need webview reference
                      // For now, just set the element
                    }}
                    onConsoleLog={(level, message, _viewportId) => {
                      const logType = (level.toLowerCase() === 'warning' ? 'warn' : level.toLowerCase()) as 'log' | 'warn' | 'error' | 'info'
                      setConsoleLogs(prev => [...prev.slice(-99), {
                        type: logType,
                        message: message,
                        timestamp: new Date()
                      }])
                    }}
                    onClose={() => setIsMultiViewportMode(false)}
                    controlsRef={viewportControlsRef}
                    onViewportCountChange={setViewportCount}
                    renderKanban={() => (
                      <Suspense fallback={<LoadingSpinner />}>
                        <KanbanTab
                          columns={activeTab.kanbanData?.columns || [
                            { id: 'backlog', title: 'Backlog', cards: [] },
                            { id: 'in-progress', title: 'In Progress', cards: [] },
                            { id: 'done', title: 'Done', cards: [] },
                          ]}
                          boardTitle={activeTab.kanbanData?.boardTitle || 'Project Board'}
                          isDarkMode={isDarkMode}
                          onUpdateColumns={handleUpdateKanbanColumns}
                          onUpdateTitle={handleUpdateKanbanTitle}
                        />
                      </Suspense>
                    )}
                    renderTodo={() => (
                      <Suspense fallback={<LoadingSpinner />}>
                        <TodosTab
                          items={activeTab.todosData?.items || []}
                          isDarkMode={isDarkMode}
                          onUpdateItems={handleUpdateTodoItems}
                          projectPath={activeTab.projectPath}
                        />
                      </Suspense>
                    )}
                    renderNotes={() => (
                      <Suspense fallback={<LoadingSpinner />}>
                        <NotesTab
                          content={activeTab.notesData?.content || ''}
                          isDarkMode={isDarkMode}
                          onUpdateContent={handleUpdateNotesContent}
                        />
                      </Suspense>
                    )}
                    nodeStyle={appSettings.nodeStyle || 'standard'}
                    elkAlgorithm={appSettings.elkAlgorithm || 'layered'}
                    elkDirection={appSettings.elkDirection || 'RIGHT'}
                    elkSpacing={appSettings.elkSpacing || 120}
                    elkNodeSpacing={appSettings.elkNodeSpacing || 60}
                    onViewportsChange={(viewports) => setMultiViewportData(viewports.map(v => ({ id: v.id, windowType: v.windowType, devicePresetId: v.devicePresetId })))}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>

            {/* Single Viewport Mode */}
            {!isMultiViewportMode && isElectron && webviewPreloadPath ? (
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
                          transform: `scale(${zoomLevel === 'actual' ? actualScale : (parseInt(zoomLevel) / 100)})`,
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
                      // @ts-expect-error - webview is an Electron-specific element
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
            /* Web mode: Use iframe for external URLs, show project info for localhost */
            (() => {
              const activeUrl = activeTab.url || '';
              const isLocalhost = activeUrl.includes('localhost') || activeUrl.includes('127.0.0.1');

              // Both localhost and external URLs can be loaded in iframe
              return (
                <iframe
                  src={activeUrl}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                  title="Web Preview"
                />
              );
            })()
          )}

            {/* Floating Toolbar - always visible when enabled */}
            {isFloatingToolbarVisible && (
                <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-1 backdrop-blur shadow-2xl p-2 rounded-full z-40 ${isDarkMode ? 'bg-neutral-800/90 border border-neutral-700/50' : 'bg-white/90 border border-stone-200/50'}`}>
                    {/* Canvas controls - only shown in multi-viewport mode */}
                    {isMultiViewportMode && (
                      <>
                        {/* Viewport count */}
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-100'}`}>
                          <LayoutGrid size={12} className={isDarkMode ? 'text-neutral-400' : 'text-stone-500'} />
                          <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
                            {viewportCount}
                          </span>
                        </div>

                        <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>

                        {/* Add device buttons */}
                        <button
                          onClick={() => viewportControlsRef.current?.addDevice('desktop')}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
                          title="Add Desktop"
                        >
                          <ScreenShare size={16} />
                        </button>
                        <button
                          onClick={() => viewportControlsRef.current?.addDevice('tablet')}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
                          title="Add Tablet"
                        >
                          <Tablet size={16} />
                        </button>
                        <button
                          onClick={() => viewportControlsRef.current?.addDevice('mobile')}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
                          title="Add Mobile"
                        >
                          <Smartphone size={16} />
                        </button>

                        <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>

                        {/* Add internal window buttons */}
                        <button
                          onClick={() => viewportControlsRef.current?.addInternalWindow('kanban')}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
                          title="Add Kanban"
                        >
                          <KanbanSquare size={16} />
                        </button>
                        <button
                          onClick={() => viewportControlsRef.current?.addInternalWindow('todo')}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
                          title="Add Todo"
                        >
                          <ListTodo size={16} />
                        </button>
                        <button
                          onClick={() => viewportControlsRef.current?.addInternalWindow('notes')}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
                          title="Add Notes"
                        >
                          <StickyNote size={16} />
                        </button>
                        <button
                          onClick={() => viewportControlsRef.current?.addTerminal()}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
                          title="Add Ghostty Terminal"
                        >
                          <Ghost size={16} />
                        </button>

                        <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>

                        {/* Layout control - auto arrange and fit */}
                        <button
                          onClick={() => {
                            viewportControlsRef.current?.autoLayout('RIGHT')
                            setTimeout(() => viewportControlsRef.current?.fitView(), 100)
                          }}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
                          title="Show All"
                        >
                          <Maximize size={16} />
                        </button>

                        <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>

                        {/* Exit canvas mode */}
                        <button
                          onClick={() => setIsMultiViewportMode(false)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-neutral-700 text-red-400' : 'hover:bg-stone-100 text-red-500'}`}
                          title="Exit Canvas"
                        >
                          <X size={16} />
                        </button>

                        <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>
                      </>
                    )}

                    {/* Screen share - only in single viewport mode */}
                    {!isMultiViewportMode && (
                      <button
                          onClick={() => setIsScreenSharing(!isScreenSharing)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-green-100 text-green-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500')}`}
                          title="Toggle Screen Share"
                      >
                          <Monitor size={16} />
                      </button>
                    )}

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

                    <div className={`w-[1px] h-5 mx-0.5 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>

                    <button
                        onClick={() => {
                          // Prevent action while connecting (race condition fix)
                          if (streamState.isStreaming && !streamState.isConnected) {
                            console.log('[Voice] Ignoring click - connection in progress');
                            return;
                          }
                          if (streamState.isConnected) {
                            stopSpeaking(); // Stop any playing audio immediately
                            disconnect();   // Then disconnect the session
                          } else {
                            connect();
                          }
                        }}
                        disabled={streamState.isStreaming && !streamState.isConnected}
                        data-control-id="voice-button"
                        data-control-type="button"
                        className={`flex items-center justify-center w-9 h-9 rounded-full font-medium transition-all ${
                          streamState.isStreaming && !streamState.isConnected
                            ? 'bg-yellow-100 text-yellow-600 ring-1 ring-yellow-200 cursor-wait'
                            : streamState.isConnected
                              ? 'bg-red-50 text-red-600 ring-1 ring-red-100'
                              : (isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-800')
                        }`}
                        title={
                          streamState.isStreaming && !streamState.isConnected
                            ? 'Connecting...'
                            : streamState.isConnected
                              ? 'End voice session'
                              : 'Start voice session'
                        }
                    >
                        {streamState.isStreaming && !streamState.isConnected ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : streamState.isConnected ? (
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

            {/* Floating Chat - shows immediately when element selected */}
            {!isSidebarOpen && selectedElement && showElementChat && (
                <div
                    className="absolute z-50"
                    style={getPopupStyle()}
                >
                    <div
                        className={`rounded-2xl shadow-2xl w-80 p-3 ${isDarkMode ? 'bg-neutral-800/95 border border-neutral-700' : 'bg-white/95 border border-stone-200'}`}
                        style={{
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                        }}
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
                                }} className={`p-1 rounded hover:bg-black/10 ${isDarkMode ? 'hover:text-neutral-200' : 'hover:text-stone-900'}`} title="Dismiss (Esc)">
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
                            onSubmit={async (e) => {
                                e.preventDefault();
                                if (isAddingTodo && popupInput.trim()) {
                                    await createTodoFromElement(popupInput, todoPriority, todoDueDate || undefined);
                                    setPopupInput('');
                                    setTodoPriority('medium');
                                    setTodoDueDate('');
                                    setShowElementChat(false);
                                } else {
                                    processPrompt(popupInput);
                                    setPopupInput('');
                                    setShowElementChat(false);
                                }
                            }}
                        >
                            {/* Add Todo Checkbox */}
                            <div className="flex items-center gap-2 mb-2">
                                <label className={`flex items-center gap-1.5 cursor-pointer text-xs ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
                                    <input
                                        type="checkbox"
                                        checked={isAddingTodo}
                                        onChange={(e) => setIsAddingTodo(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded border-2 accent-blue-500"
                                    />
                                    <ListTodo size={14} className={isAddingTodo ? 'text-blue-500' : ''} />
                                    <span className={isAddingTodo ? 'text-blue-500 font-medium' : ''}>Add Todo</span>
                                </label>
                            </div>

                            {/* Priority and Due Date (shown when checkbox is checked) */}
                            {isAddingTodo && (
                                <div className="flex items-center gap-2 mb-2">
                                    <select
                                        value={todoPriority}
                                        onChange={(e) => setTodoPriority(e.target.value as 'low' | 'medium' | 'high')}
                                        className={`text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100' : 'bg-stone-50 border-stone-200'}`}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                    <div className="relative flex-1">
                                        <input
                                            type="date"
                                            value={todoDueDate}
                                            onChange={(e) => setTodoDueDate(e.target.value)}
                                            className={`w-full text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100' : 'bg-stone-50 border-stone-200'}`}
                                            placeholder="Due date"
                                        />
                                    </div>
                                </div>
                            )}

                            <textarea
                                value={popupInput}
                                onChange={(e) => setPopupInput(e.target.value)}
                                placeholder={isAddingTodo ? "Add a comment about this element..." : "What would you like to change?"}
                                className={`w-full text-sm p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100 placeholder-neutral-400' : 'bg-stone-50 border-stone-200'}`}
                                rows={2}
                                autoFocus
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (isAddingTodo && popupInput.trim()) {
                                            await createTodoFromElement(popupInput, todoPriority, todoDueDate || undefined);
                                            setPopupInput('');
                                            setTodoPriority('medium');
                                            setTodoDueDate('');
                                            setShowElementChat(false);
                                        } else {
                                            processPrompt(popupInput);
                                            setPopupInput('');
                                            setShowElementChat(false);
                                        }
                                    }
                                    if (e.key === 'Escape') {
                                        setShowElementChat(false);
                                        setSelectedElement(null);
                                        setIsAddingTodo(false);
                                        const webview = webviewRefs.current.get(activeTabId);
                                        webview?.send('clear-selection');
                                    }
                                }}
                            />
                            <div className="flex justify-end mt-2">
                                <button type="submit" disabled={!popupInput.trim()} className={`w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-50 ${isAddingTodo ? 'bg-blue-600 text-white hover:bg-blue-500' : isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-700'}`}>
                                    {isAddingTodo ? <Check size={14} /> : <ArrowUp size={14} />}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
          </div>

          {/* Resize overlay - captures mouse events during console resize */}
          {isConsoleResizing && (
            <div className="fixed inset-0 z-50 cursor-ns-resize" />
          )}

          {/* Todo Toggle Button - floating in bottom left */}
          {!isMultiViewportMode && (
            <button
              onClick={() => setShowTodoOverlay(!showTodoOverlay)}
              className={`fixed bottom-20 left-4 z-40 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${
                showTodoOverlay
                  ? 'bg-blue-600 text-white'
                  : isDarkMode
                    ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                    : 'bg-white text-stone-500 hover:bg-stone-100 hover:text-stone-900 border border-stone-200'
              }`}
              title={showTodoOverlay ? 'Hide Todos' : 'Show Todos'}
            >
              <ListTodo size={18} />
              {/* Badge showing todo count */}
              {(activeTab?.todosData?.items?.filter(t => !t.completed).length || 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {activeTab?.todosData?.items?.filter(t => !t.completed).length}
                </span>
              )}
            </button>
          )}

          {/* Todo List Overlay */}
          {showTodoOverlay && !isMultiViewportMode && (
            <TodoListOverlay
              todos={activeTab?.todosData?.items || []}
              isDarkMode={isDarkMode}
              onClose={() => setShowTodoOverlay(false)}
              onToggleTodo={handleToggleTodo}
              onDeleteTodo={handleDeleteTodo}
            />
          )}

          {/* Cluso Agent Demo Panel */}
          {isAgentPanelOpen && (
            <div className={`absolute bottom-4 right-4 w-80 rounded-xl shadow-2xl border z-50 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
              <div className={`flex items-center justify-between px-4 py-3 border-b ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`}>
                <div className="flex items-center gap-2">
                  <Bot size={18} className="text-purple-500" />
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>Cluso Agent</span>
                  {clusoAgent.isProcessing && (
                    <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                <button
                  onClick={() => setIsAgentPanelOpen(false)}
                  className={`w-6 h-6 rounded flex items-center justify-center ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500'}`}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Status */}
                <div className={`text-xs ${clusoAgent.isReady ? 'text-green-500' : 'text-orange-500'}`}>
                  {clusoAgent.isReady ? '● Connected to local model' : '○ Connecting...'}
                </div>

                {/* Scripted Two-Voice Demos */}
                <div className="space-y-2">
                  <div className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                    🎭 Two-Voice Demos (User + App)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {DEMO_SCRIPTS.map((script) => (
                      <button
                        key={script}
                        onClick={() => clusoAgent.runScriptedDemo(script)}
                        disabled={clusoAgent.isProcessing || !clusoAgent.isReady}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors capitalize ${
                          clusoAgent.isProcessing
                            ? 'opacity-50 cursor-not-allowed'
                            : isDarkMode
                              ? 'bg-purple-600 hover:bg-purple-500 text-white'
                              : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                        }`}
                      >
                        {script.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Agent Commands */}
                <div className="space-y-2">
                  <div className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                    ⚡ Quick Commands
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_DEMOS.map((demo) => (
                      <button
                        key={demo}
                        onClick={() => clusoAgent.runDemo(demo)}
                        disabled={clusoAgent.isProcessing || !clusoAgent.isReady}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors capitalize ${
                          clusoAgent.isProcessing
                            ? 'opacity-50 cursor-not-allowed'
                            : isDarkMode
                              ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                        }`}
                      >
                        {demo.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask agent to do something..."
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                      isDarkMode
                        ? 'bg-neutral-700 border-neutral-600 text-white placeholder-neutral-400'
                        : 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400'
                    }`}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && !clusoAgent.isProcessing) {
                        const input = e.currentTarget;
                        const message = input.value.trim();
                        if (message) {
                          input.value = '';
                          await clusoAgent.chat(message);
                        }
                      }
                    }}
                  />
                </div>

                {/* Last response */}
                {clusoAgent.lastResponse && (
                  <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-stone-50 text-stone-600'}`}>
                    {clusoAgent.lastResponse.substring(0, 150)}
                    {clusoAgent.lastResponse.length > 150 && '...'}
                  </div>
                )}

                {/* Error */}
                {clusoAgent.error && (
                  <div className="text-xs p-2 rounded bg-red-500/10 text-red-500">
                    {clusoAgent.error}
                  </div>
                )}

                {/* Reset button */}
                <button
                  onClick={() => clusoAgent.reset()}
                  className={`w-full px-3 py-1.5 text-xs rounded ${isDarkMode ? 'text-neutral-400 hover:bg-neutral-700' : 'text-stone-500 hover:bg-stone-100'}`}
                >
                  Reset conversation
                </button>
              </div>
            </div>
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
                {/* Left side: Tab buttons */}
                <div className="flex items-center gap-1.5" style={{ position: 'relative', top: '-3px' }}>
                  {/* Console tab */}
                  <button
                    onClick={() => setConsolePanelTab('console')}
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-full transition-colors ${
                      consolePanelTab === 'console'
                        ? (isDarkMode ? 'bg-neutral-600 text-neutral-200' : 'bg-stone-300 text-stone-700')
                        : (isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200')
                    }`}
                    title="Console logs"
                  >
                    <Terminal size={14} />
                    <span className="text-xs font-medium">Console</span>
                    <span className="text-xs opacity-70">{filteredConsoleLogs.length}</span>
                  </button>

                  {/* Terminal tab */}
                  <button
                    onClick={() => setConsolePanelTab('terminal')}
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-full transition-colors ${
                      consolePanelTab === 'terminal'
                        ? (isDarkMode ? 'bg-neutral-600 text-neutral-200' : 'bg-stone-300 text-stone-700')
                        : (isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200')
                    }`}
                    title="Terminal"
                  >
                    <Ghost size={14} />
                    <span className="text-xs font-medium">Terminal</span>
                  </button>
                </div>

                {/* Right side: Filter chips (only for console) + actions */}
                <div className="flex items-center gap-1">
                  {/* Filter chips - only show when console tab is active */}
                  {consolePanelTab === 'console' && (
                    <div className="flex items-center gap-1 mr-2">
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
                  )}

                  {/* Selection actions - only for console */}
                  {consolePanelTab === 'console' && selectedLogIndices.size > 0 && (
                    <>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                        {selectedLogIndices.size} selected
                      </span>
                      <div className="flex items-center gap-0.5 ml-1">
                        <button
                          onClick={() => {
                            const logsText = selectedLogs?.map(l => l.message).join('\n') || '';
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

                  {/* Clear console button - only for console tab */}
                  {consolePanelTab === 'console' && (
                    <button
                      onClick={handleClearConsole}
                      className={`p-1 rounded hover:bg-opacity-80 transition ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'}`}
                      title="Clear console"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                    </button>
                  )}

                  <button
                    onClick={() => setIsConsolePanelOpen(false)}
                    className={`p-1 rounded hover:bg-opacity-80 transition ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500'}`}
                    title="Close console"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              {/* Content area - switches between console and terminal */}
              {consolePanelTab === 'console' ? (
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
              ) : (
                /* Terminal view */
                <div
                  ref={terminalContainerRef}
                  className={`flex-1 overflow-hidden ${isDarkMode ? 'bg-[#1e1e1e]' : 'bg-stone-50'}`}
                  style={{ minHeight: 100 }}
                />
              )}
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
      <ErrorBoundary fallback={<div className="p-4 text-red-500">Chat panel failed to load</div>}>
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
                  {/* Streaming Tool Calls - Grouped chips with expand/collapse */}
                  {streamingMessage.toolCalls.length > 0 && (
                    <GroupedToolChips
                      toolCalls={streamingMessage.toolCalls}
                      isDarkMode={isDarkMode}
                      isStreaming={true}
                    />
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
                <div className="mb-3 animate-in fade-in duration-300">
                  <GroupedToolChips
                    toolCalls={completedToolCalls.map(t => ({
                      id: t.id,
                      name: t.name,
                      status: t.status,
                    }))}
                    isDarkMode={isDarkMode}
                    isStreaming={false}
                  />
                </div>
              )}

              {/* Loading indicator when processing but no streaming content yet */}
              {isAgentProcessing && !isStreaming && (
                <div className="flex items-center gap-2 text-sm opacity-60">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Processing...</span>
                </div>
              )}

              {/* Pending Edit Session in chat */}
              {showWideApprovalCard && pendingEditSession && !(pendingEditSession.kind === 'dom' && isGeneratingSourcePatch) && (
                <div className={`mx-4 my-3 p-3 rounded-xl border ${
                  isDarkMode
                    ? 'bg-blue-950/50 border-blue-800/50'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {pendingEditSession.kind === 'dom' ? (
                        <Palette size={16} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
                      ) : (
                        <Code2 size={16} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
                      )}
                      <span className={`text-sm font-medium truncate ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                        {pendingEditSession.description}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center shrink-0">
                      {pendingPreview?.undoCode && (
                        <button
                          onClick={isPreviewingOriginal ? showChangedPreview : showOriginalPreview}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            isDarkMode
                              ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                              : 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                          }`}
                          title={isPreviewingOriginal ? 'Show change' : 'Show original'}
                        >
                          {isPreviewingOriginal ? 'Preview on' : 'Preview off'}
                        </button>
                      )}
                      {pendingEditSession.kind === 'dom' && pendingEditSession.patchStatus === 'preparing' && (
                        <div className={`flex items-center gap-1 text-xs ${
                          isDarkMode ? 'text-blue-300/70' : 'text-blue-700/70'
                        }`}>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Preparing source patch…</span>
                        </div>
                      )}
                      {pendingEditSession.kind === 'dom' && pendingEditSession.patchStatus === 'error' && (
                        <div className={`text-xs ${isDarkMode ? 'text-red-300/80' : 'text-red-600/80'}`}>
                          {pendingEditSession.patchError || 'Failed to prepare patch'}
                        </div>
                      )}
                      <button
                        onClick={pendingEditSession.kind === 'dom' ? handleRejectDOMApproval : handleRejectChange}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          isDarkMode
                            ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                            : 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                        }`}
                      >
                        Reject
                      </button>
                      <button
                        onClick={pendingEditSession.kind === 'dom' ? handleAcceptDOMApproval : handleApproveChange}
                        disabled={pendingEditSession.kind === 'dom' ? !!pendingEditSession.userApproved : false}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                          isDarkMode
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        } ${pendingEditSession.kind === 'dom' && pendingEditSession.userApproved ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {pendingEditSession.kind === 'dom' && pendingEditSession.userApproved ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Applying…
                          </>
                        ) : pendingEditSession.kind === 'dom' && pendingEditSession.patchStatus === 'ready' ? (
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
                  {pendingEditSession.kind === 'dom' && pendingEditSession.patchStatus === 'ready' && pendingEditSession.patch && (
                    <div className={`mt-2 pt-2 border-t ${isDarkMode ? 'border-blue-800/30' : 'border-blue-200'}`}>
                      <div className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-blue-300/70' : 'text-blue-700/70'}`}>
                        {pendingEditSession.patch.generatedBy === 'fast-apply' ? (
                          <>
                            <Zap size={12} className="text-yellow-500" />
                            <span className="font-medium text-yellow-500">Fast Apply</span>
                            <span>·</span>
                            <span>{pendingEditSession.patch.durationMs}ms</span>
                          </>
                        ) : pendingEditSession.patch.generatedBy === 'fast-path' ? (
                          <>
                            <Zap size={12} className="text-green-500" />
                            <span className="font-medium text-green-500">Fast Path</span>
                            <span>· instant</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} />
                            <span className="font-medium">Gemini</span>
                            {(() => {
                              const telemetry = domEditTelemetryRef.current[pendingDOMApproval!.id]
                              const started = telemetry?.events?.patch_generation_started
                              const ready = telemetry?.events?.patch_ready
                              const ms = (started !== undefined && ready !== undefined) ? Math.round(ready - started) : undefined
                              if (ms === undefined) return null
                              return (
                                <>
                                  <span>·</span>
                                  <span>{ms}ms</span>
                                </>
                              )
                            })()}
                          </>
                        )}
                        <span>·</span>
                        <span className="truncate">{pendingEditSession.patch.filePath.split('/').pop()}</span>
                      </div>
                    </div>
                  )}
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
                              (webview as unknown as Electron.WebviewTag).executeJavaScript(pendingPatch.undoCode);
                              setIsPreviewingPatchOriginal(true);
                            }
                          }}
                          onMouseUp={() => {
                            const webview = webviewRefs.current.get(activeTabId);
                            if (pendingPatch.applyCode && webview) {
                              console.log('[Preview] Showing change');
                              (webview as unknown as Electron.WebviewTag).executeJavaScript(pendingPatch.applyCode);
                              setIsPreviewingPatchOriginal(false);
                            }
                          }}
                          onMouseLeave={() => {
                            if (!isPreviewingPatchOriginal) return;
                            const webview = webviewRefs.current.get(activeTabId);
                            if (pendingPatch.applyCode && webview) {
                              console.log('[Preview] Showing change (mouse leave)');
                              (webview as unknown as Electron.WebviewTag).executeJavaScript(pendingPatch.applyCode);
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
                              (webview as unknown as Electron.WebviewTag).executeJavaScript(pendingPatch.undoCode);
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
                          if (!pendingPatch) return;
                          const result = await fileService.writeFile(
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
                                onClick={() => {
                                  console.log('[Element Chip] selectedElement:', selectedElement);
                                  console.log('[Element Chip] sourceLocation:', selectedElement.sourceLocation);
                                  console.log('[Element Chip] sources:', selectedElement.sourceLocation?.sources);
                                  handleShowSourceCode();
                                }}
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
                                              // Handle both http://localhost:4000/src/File.tsx and //localhost:4000/src/File.tsx
                                              const cleanPath = src.file
                                                .replace(/^https?:\/\/localhost:\d+\//, '')
                                                .replace(/^\/\/localhost:\d+\//, '')
                                                .replace(/\?.*$/, ''); // Remove query params like ?t=123456
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
                                  <span className="font-mono max-w-[200px] truncate" title={file.path}>{formatFileDisplay(file)}</span>
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
                          data-control-id="chat-input"
                          data-control-type="input"
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
                                                      setSelectedModel({ id: model.id, name: model.name, Icon: model.Icon as typeof DEFAULT_MODEL.Icon, provider: model.provider });
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
                              data-control-id="send-button"
                              data-control-type="button"
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
      </ErrorBoundary>
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

      {/* Pending Change Preview - 3 Button Popup */}
      {pendingPreview && showCompactApprovalPopup && (
          <div className={`absolute bottom-24 left-1/2 transform -translate-x-1/2 flex items-center gap-2 rounded-full shadow-xl p-2 z-50 ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
              {/* Diff Stats */}
              <div className="flex items-center gap-1.5 px-2 text-xs font-mono">
                  <span className="text-green-500">+{pendingPreview.additions}</span>
                  <span className="text-red-500">-{pendingPreview.deletions}</span>
              </div>
              <div className={`w-[1px] h-6 ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-200'}`}></div>
              <button
                  onMouseDown={() => {
                    const webview = webviewRefs.current.get(activeTabId);
                    if (pendingPreview.undoCode && webview) {
                      console.log('[Preview] Showing original');
                      webview.executeJavaScript(pendingPreview.undoCode);
                      setIsPreviewingOriginal(true);
                    }
                  }}
                  onMouseUp={() => {
                    const webview = webviewRefs.current.get(activeTabId);
                    if (pendingPreview.applyCode && webview) {
                      console.log('[Preview] Showing change');
                      webview.executeJavaScript(pendingPreview.applyCode);
                      setIsPreviewingOriginal(false);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isPreviewingOriginal) return;
                    const webview = webviewRefs.current.get(activeTabId);
                    if (pendingPreview.applyCode && webview) {
                      console.log('[Preview] Showing change (mouse leave)');
                      webview.executeJavaScript(pendingPreview.applyCode);
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
                  title="Reject (Esc)"
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
                  title="Accept (⌘+Enter)"
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
      <ErrorBoundary fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/50"><div className="p-4 bg-white rounded text-red-500">Settings failed to load</div></div>}>
        <Suspense fallback={null}>
          <SettingsDialog
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            settings={appSettings}
            onSettingsChange={setAppSettings}
            projectPath={activeTab?.projectPath}
          />
        </Suspense>
      </ErrorBoundary>

      {/* Mgrep Onboarding Demo */}
      {showMgrepOnboarding && (
        <MgrepOnboardingDemo
          isDarkMode={isDarkMode}
          onAccept={() => {
            const projectPath = activeTab?.projectPath
            if (projectPath && window.electronAPI?.mgrep) {
              setIndexingStatus('indexing')
              window.electronAPI.mgrep.initialize(projectPath).then(() => {
                setIndexingStatus('indexed')
              }).catch(() => {
                setIndexingStatus('idle')
              })
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
        isDarkMode={isThemeDark}
        onToggle={() => setErrorPanelVisible(!errorPanelVisible)}
        onRemoveError={removeError}
        onSearchForSolution={searchForSolution}
        onClearAll={clearErrors}
      />

      {/* Error Badge in Tab Bar - Hidden */}
      {/* {errors.length > 0 && (
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
      )} */}

      </div>
      </div>{/* End content wrapper */}
    </div>
  );
}

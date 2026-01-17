
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
import { useMCPHandlers } from './features/mcp';
import { useSelectorAgent } from './hooks/useSelectorAgent';
import { useToolTracker } from './hooks/useToolTracker';
import { useClusoAgent, AVAILABLE_DEMOS, DEMO_SCRIPTS } from './hooks/useClusoAgent';
import { useSteeringQuestions } from './hooks/useSteeringQuestions';
import { SteeringQuestions } from './components/SteeringQuestions';
import { useChatState } from './features/chat';
import { useEditorState } from './features/editor';
import { useViewportMode, useMultiViewportData } from './features/viewport';
import type { DevicePreset } from './features/viewport';
import { useWebviewState, useWebviewSetup } from './features/webview';
import { useAppSettings } from './features/settings';
import { useLayerDetailsState, useLayersPanel } from './features/layers';
import { useConsolePanel } from './features/console';
import { useSidebarState, useResizeHandlers } from './features/sidebar';
import { usePatchState, usePatchApproval } from './features/patches';
import type { PendingPatch, PendingDOMApproval } from './features/patches';
import { useProjectSetup } from './features/project-setup';
import { useDomApprovalLifecycle } from './features/dom-approval';
import { useNavigationState, useBrowserNavigation } from './features/navigation';
import { useAutocompleteState } from './features/autocomplete';
import { useSelectionState, useSelectionHandlers } from './features/selection';
import type { SelectedElementSourceSnippet, SelectionHandlersDeps } from './features/selection';
import { useFileBrowserState, useFileHandlers } from './features/files';
import type { EditedFile } from './features/files';
import { useDialogState } from './features/dialogs';
import { useProjectState } from './features/project';
import type { SetupProject } from './features/project';
import { useExtensionState, useExtensionCursorSync } from './features/extension';
import type { ExtensionCursor } from './features/extension';
import { useTerminalPanel } from './features/terminal';
import { useMgrepInit } from './features/mgrep';
import { useFileWatcher } from './features/file-watcher';
import { useMediaState } from './features/media';
import { useGitPanelState } from './features/git';
import { useThemeState, useThemeHandlers } from './features/theme';
import { useTabState, useTabDataLoader } from './features/tabs';
import { useInternalWindowHandlers } from './features/internal-windows';
import { useInspectorState, useInspectorSync } from './features/inspector';
import { useSearchState } from './features/search';
import { useAttachmentState } from './features/attachments';
import { useModelState } from './features/model';
import type { ThinkingLevel } from './features/model';
import { useTodoOverlayState, useTodosLoader } from './features/todos';
import { useContextChipsPersistence } from './features/context-chips';
import { useSourceSnippetLoader } from './features/source-snippet';
import { useOnboardingSync } from './features/onboarding';
import { useWebviewHmr } from './features/hmr';
import { usePreviewState } from './features/preview';
import { useScrollState, useScrollEffects } from './features/scroll';
import { useAgentPanelState } from './features/agent';
import type { PreviewIntent } from './features/preview';
import { useDebugState } from './features/debug';
// New extracted feature hooks
import { useExtensionBridge } from './features/extension-bridge';
import { useSidebarResize, useConsoleResize } from './features/resize';
import { useScreenSharing } from './features/screen-sharing';
import { useConsoleKeyboardShortcuts, useApprovalKeyboardShortcuts, useThinkingPopover } from './features/keyboard-shortcuts';
import { useDOMApprovalAutoApply, usePrepareDomPatchRef } from './features/dom-approval';
import { useCodingContextSync } from './features/coding-context';
import { useSelectorAgentInit, useSelectorAgentPriming } from './features/selector-agent';
import { useAutoTextareaResize } from './features/textarea';
import { useWindowAppearance } from './features/window-appearance';
import { useCompletedToolCallsClear } from './features/tool-calls';
import {
  useUrlSync,
  useDarkModePersist,
  useInspectorThinking,
  useAutoShowElementChat,
  useConnectionState as useConnectionStateEffect,
  usePreviewReset,
  useLayersStale,
  useSidebarElementChat,
} from './features/misc-effects';
import { useAISelectionState } from './features/ai-selection';
import type { AISelectedElement, DisplayedSourceCode } from './features/ai-selection';
import { useFileBrowserPanelState } from './features/file-browser';
import type { FileBrowserPanel, FileBrowserItem } from './features/file-browser';
import { useToolExecution } from './features/tools';
import { useCommandsState, useCommandsLoader } from './features/commands';
import { useStatusState } from './features/status';
import { usePendingChangeState, useChangeApprovalHandlers } from './features/changes';
import { useErrorPanelState } from './features/error-panel';
import { useClarifyingState } from './features/clarifying';
import { useWindowInit } from './features/window';
import { useFastApplyStatus } from './features/fast-apply';
import { generateTurnId } from './utils/turnUtils';
import { createToolError, formatErrorForDisplay } from './utils/toolErrorHandler';
import { PatchApprovalDialog } from './components/PatchApprovalDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LeftSidebar } from './components/LeftSidebar';
import type { TreeNode } from './components/ComponentTree';
import { type ElementStyles } from './types/elementStyles';
import { FilePanel } from './components/FilePanel';
import { TabbedLeftPanel } from './components/TabbedLeftPanel';
import { CodeEditor } from './components/CodeEditor';
import { GroupedToolChips } from './components/GroupedToolChips';
import { FileBrowserOverlay } from './components/FileBrowserOverlay';
import { StashDialog } from './components/StashDialog';
import { AIElementSelectionToolbar } from './components/AIElementSelectionToolbar';
import { PendingChangePreview } from './components/PendingChangePreview';
import { ScreenshotPreviewModal } from './components/ScreenshotPreviewModal';
import { ConsolePanel, ConsoleLog } from './components/ConsolePanel';
import { FloatingToolbar } from './components/FloatingToolbar';
import { FloatingChat } from './components/FloatingChat';
import { GitHeader } from './components/GitHeader';
import { ChatInputToolbar } from './components/ChatInputToolbar';
import { BrowserToolbar } from './components/BrowserToolbar';

import { getElectronAPI } from './hooks/useElectronAPI';
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
  // Project State - window locking, setup flow, directory navigation
  const {
    windowId,
    setWindowId,
    lockedProjectPath,
    setLockedProjectPath,
    lockedProjectName,
    setLockedProjectName,
    setupProject,
    setSetupProject,
    directoryStack,
    setDirectoryStack,
  } = useProjectState();

  // Initialize window info on mount - extracted to useWindowInit hook
  useWindowInit({ setWindowId, setLockedProjectPath, setLockedProjectName });

  // Tab State - extracted to useTabState hook
  // Note: We need tabState.updateCurrentTab for useProjectSetup, so it comes first
  const tabState = useTabState();
  const {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    handleNewTab,
    handleCloseTab,
    handleSelectTab,
    handleReorderTabs,
    updateCurrentTab,
    updateTab,
    tabsRef,
    activeTabIdRef,
    tabDataLoadedRef,
    onProjectTabCloseRef,
  } = tabState;

  // Load tab data from disk on startup - extracted to useTabDataLoader hook
  useTabDataLoader({ setTabs, tabDataLoadedRef });

  // Internal window handlers (kanban, todos, notes) - extracted to useInternalWindowHandlers hook
  const {
    handleUpdateKanbanColumns,
    handleUpdateKanbanTitle,
    handleUpdateTodoItems,
    handleUpdateNotesContent,
  } = useInternalWindowHandlers({ tabsRef, activeTabIdRef, updateCurrentTab });

  // Error panel state - centralized via useErrorPanelState hook
  const {
    isVisible: errorPanelVisible,
    setIsVisible: setErrorPanelVisible,
  } = useErrorPanelState();

  // Error prefetch - monitors console for errors and provides solutions
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

  // Browser State - centralized via useNavigationState hook
  const {
    urlInput,
    setUrlInput,
    canGoBack,
    setCanGoBack,
    canGoForward,
    setCanGoForward,
    isLoading,
    setIsLoading,
    pageTitle,
    setPageTitle,
  } = useNavigationState();

  // Sync URL input when switching tabs - extracted to useUrlSync hook
  useUrlSync({
    activeTabId,
    activeTabUrl: activeTab.url,
    setUrlInput,
  });

  // Project Setup Handlers - extracted to useProjectSetup hook
  const {
    handleOpenProject,
    handleSetupComplete,
    handleSetupCancel,
    handleOpenUrl,
  } = useProjectSetup({
    lockedProjectPath,
    setLockedProjectPath,
    setLockedProjectName,
    setSetupProject,
    setupProject,
    updateCurrentTab,
    getRecentProject,
    addToRecentProjects,
  });

  // File Browser State - centralized via useFileBrowserState hook
  const {
    directoryFiles,
    setDirectoryFiles,
    currentDirectory,
    setCurrentDirectory,
    fileSearchQuery,
    setFileSearchQuery,
    showFileAutocomplete,
    setShowFileAutocomplete,
    editedFiles,
    setEditedFiles,
    isEditedFilesDrawerOpen,
    setIsEditedFilesDrawerOpen,
  } = useFileBrowserState();

  // Chat state - centralized via useChatState hook
  const {
    messages,
    setMessages,
    input,
    setInput,
    streamingMessage,
    setStreamingMessage,
    isStreaming,
    setIsStreaming,
    connectionState,
    setConnectionState,
    completedToolCalls,
    setCompletedToolCalls,
  } = useChatState();

  // Preview/Popup state - extracted to usePreviewState hook
  const {
    previewIntent,
    setPreviewIntent,
    popupInput,
    setPopupInput,
    showElementChat,
    setShowElementChat,
  } = usePreviewState();

  // Selection States (extracted to useSelectionState hook)
  const {
    selectedElement,
    setSelectedElement,
    selectedElementRef,
    selectedElementSourceSnippet,
    setSelectedElementSourceSnippet,
    hoveredElement,
    setHoveredElement,
    screenshotElement,
    setScreenshotElement,
    capturedScreenshot,
    setCapturedScreenshot,
    showScreenshotPreview,
    setShowScreenshotPreview,
    elementStyles,
    setElementStyles,
    elementStylesRef,
  } = useSelectionState();

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

  // Media state (voice input, screen sharing, toolbar visibility)
  const {
    isVoiceMode,
    isRecording,
    voiceInputText,
    isScreenSharing,
    isFloatingToolbarVisible,
    setIsVoiceMode,
    setIsRecording,
    setVoiceInputText,
    setIsScreenSharing,
    setIsFloatingToolbarVisible,
    startVoiceInput,
    stopVoiceInput,
    toggleScreenSharing,
    toggleFloatingToolbar,
    clearVoiceInput,
  } = useMediaState();

  // Sidebar state (left and right panels)
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    sidebarWidth,
    setSidebarWidth,
    isResizing,
    setIsResizing,
    isLeftPanelOpen,
    setIsLeftPanelOpen,
    isLeftPanelOpenRef,
    leftPanelWidth,
    setLeftPanelWidth,
    isLeftResizing,
    setIsLeftResizing,
  } = useSidebarState();

  // Sidebar resize handlers (extracted from App.tsx to useResizeHandlers hook)
  const { handleResizeStart, handleLeftResizeStart } = useResizeHandlers({
    isResizing,
    setIsResizing,
    setSidebarWidth,
    leftPanelWidth,
    setIsLeftResizing,
    setLeftPanelWidth,
  });

  // Code editor state (center pane)
  const {
    isEditorMode,
    editorFilePath,
    editorFileContent,
    editorInitialLine,
    hasUnsavedEdits,
    setIsEditorMode,
    setEditorFilePath,
    setEditorFileContent,
    setEditorInitialLine,
    setHasUnsavedEdits,
  } = useEditorState()

  // Layers panel state (component tree)
  const {
    layersTreeData,
    setLayersTreeData,
    layersTreeDataRef,
    selectedTreeNodeId,
    setSelectedTreeNodeId,
    isLayersLoading,
    setIsLayersLoading,
    isLayersLoadingRef,
    selectedLayerElementNumber,
    setSelectedLayerElementNumber,
    selectedLayerElementNumberRef,
    selectedLayerElementName,
    setSelectedLayerElementName,
    layersTreeStaleRef,
  } = useLayersPanel()

  const { multiViewportData, setMultiViewportData } = useMultiViewportData();

  const applyElementStylesTimerRef = useRef<number | null>(null)
  const {
    selectedLayerComputedStyles,
    setSelectedLayerComputedStyles,
    selectedLayerAttributes,
    setSelectedLayerAttributes,
    selectedLayerDataset,
    setSelectedLayerDataset,
    selectedLayerFontFamilies,
    setSelectedLayerFontFamilies,
    selectedLayerClassNames,
    setSelectedLayerClassNames,
  } = useLayerDetailsState()

  // Avoid referencing `isElectron` before it is initialized (it is declared later in this file).
	const isElectronEnv = typeof window !== 'undefined' && !!window.electronAPI?.isElectron

  // Load source code snippets for selected elements - extracted to useSourceSnippetLoader hook
  useSourceSnippetLoader({
    selectedElement,
    projectPath: activeTab.projectPath,
    isElectron: isElectronEnv,
    setSelectedElementSourceSnippet,
  })

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Scroll state - extracted to useScrollState hook
  const { isAutoScrollEnabled, setIsAutoScrollEnabled, showScrollToBottom, setShowScrollToBottom } = useScrollState();
  const isUserScrollingRef = useRef(false);

  // Scroll effects - extracted to useScrollEffects hook (note: called later after messages/streaming are defined)

  // Inspector & Context State - extracted to useInspectorState hook
  const inspectorState = useInspectorState();
  const {
    isInspectorActive,
    setIsInspectorActive,
    isScreenshotActive,
    setIsScreenshotActive,
    isMoveActive,
    setIsMoveActive,
    moveTargetPosition,
    setMoveTargetPosition,
    isInspectorActiveRef,
    isScreenshotActiveRef,
    isMoveActiveRef,
    preInspectorSettingsRef,
  } = inspectorState;

  // Attachment State - extracted to useAttachmentState hook
  const attachmentState = useAttachmentState();
  const {
    logs,
    setLogs,
    attachLogs,
    setAttachLogs,
    attachedImages,
    setAttachedImages,
    isDraggingOver,
    setIsDraggingOver,
    selectedFiles,
    setSelectedFiles,
    // Drag handlers
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeImage: removeAttachedImage,
  } = attachmentState;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Model State - extracted to useModelState hook
  const modelState = useModelState();
  const {
    selectedModel,
    setSelectedModel,
    isModelMenuOpen,
    setIsModelMenuOpen,
    thinkingLevel,
    setThinkingLevel,
    showThinkingPopover,
    setShowThinkingPopover,
  } = modelState;

  // Todo Overlay State - extracted to useTodoOverlayState hook
  const todoOverlayState = useTodoOverlayState();
  const {
    isAddingTodo,
    setIsAddingTodo,
    todoPriority,
    setTodoPriority,
    todoDueDate,
    setTodoDueDate,
    showTodoOverlay,
    setShowTodoOverlay,
  } = todoOverlayState;

  // Auto-show floating chat when element is selected - extracted to useAutoShowElementChat hook
  useAutoShowElementChat({
    selectedElement,
    isSidebarOpen,
    setShowElementChat,
  });

  // Wire up tab close cleanup callback (resolves circular dependency between useTabState and other hooks)
  useEffect(() => {
    onProjectTabCloseRef.current = (projectPath: string) => {
      // Clear chat history and selection state when project tab is closed
      setMessages([]);
      setSelectedFiles([]);
      setSelectedElement(null);
      // Stop file watcher for this project
      window.electronAPI?.fileWatcher?.stop(projectPath).catch((err: Error) => {
        console.error('[App] Failed to stop file watcher:', err);
      });
    };
    return () => {
      onProjectTabCloseRef.current = null;
    };
  }, [setMessages, setSelectedFiles, setSelectedElement, onProjectTabCloseRef]);

  // Autocomplete State (commands, chips, shared index)
  const {
    showCommandAutocomplete,
    setShowCommandAutocomplete,
    commandSearchQuery,
    setCommandSearchQuery,
    contextChips,
    setContextChips,
    recentContextChips,
    setRecentContextChips,
    showChipAutocomplete,
    setShowChipAutocomplete,
    chipSearchQuery,
    setChipSearchQuery,
    chipSearchType,
    setChipSearchType,
    autocompleteIndex,
    setAutocompleteIndex,
  } = useAutocompleteState();

  // Slash Command State (/ commands) - extracted to useCommandsState hook
  const { availableCommands, setAvailableCommands } = useCommandsState();

  // Git State
  const git = useGit();
  const gitPanel = useGitPanelState();
  const {
    isBranchMenuOpen,
    setIsBranchMenuOpen,
    commitMessage,
    setCommitMessage,
    newBranchName,
    setNewBranchName,
    isCreatingBranch,
    setIsCreatingBranch,
    gitLoading,
    setGitLoading,
    isStashDialogOpen,
    setIsStashDialogOpen,
    stashMessage,
    setStashMessage,
  } = gitPanel;

  // Tool Execution Tracking
  const toolTracker = useToolTracker();

  // Cluso Agent - extracted to useAgentPanelState hook
  const { isAgentPanelOpen, setIsAgentPanelOpen } = useAgentPanelState();

  // Web Search Results State - extracted to useSearchState hook
  const searchState = useSearchState();
  const {
    searchResults,
    setSearchResults,
    searchQuery,
    setSearchQuery,
    isFileSearching,
    setIsFileSearching,
    showSearchPopover,
    setShowSearchPopover,
    attachedSearchResults,
    setAttachedSearchResults,
  } = searchState;

  // Dark Mode State
  const { isDarkMode, setIsDarkMode } = useThemeState();

  // Theme handlers (toggleDarkMode + localStorage persistence)
  const { toggleDarkMode } = useThemeHandlers({ isDarkMode, setIsDarkMode });

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

  // Dialog State - centralized via useDialogState hook
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    showMgrepOnboarding,
    setShowMgrepOnboarding,
  } = useDialogState()

  // Status Indicators State
  const {
    fastApplyReady,
    setFastApplyReady,
    fileWatcherActive,
    setFileWatcherActive,
    indexingStatus,
    setIndexingStatus,
  } = useStatusState();

  // Mgrep initialization - extracted to useMgrepInit hook
  useMgrepInit({
    projectPath: activeTab?.projectPath,
    setIndexingStatus,
    setShowOnboarding: setShowMgrepOnboarding,
  })

  // Extension Bridge State - Chrome extension connection and cursor sharing
  const {
    extensionConnected,
    setExtensionConnected,
    extensionSharing,
    setExtensionSharing,
    extensionCursor,
    setExtensionCursor,
  } = useExtensionState();

  // Extension cursor sync - extracted to useExtensionCursorSync hook
  useExtensionCursorSync({
    extensionSharing,
    activeTabUrl: activeTab?.url,
  })

  // Patch Approval State - centralized via usePatchState hook
  const {
    pendingPatch,
    setPendingPatch,
    isPreviewingPatchOriginal,
    setIsPreviewingPatchOriginal,
    pendingDOMApproval,
    setPendingDOMApproval,
    cancelledApprovalsRef,
    domApprovalPatchTimeoutsRef,
    domApprovalPatchTimeoutTokensRef,
    isGeneratingSourcePatch,
    setIsGeneratingSourcePatch,
    clearDomApprovalPatchTimeout,
    pendingPatches,
    setPendingPatches,
    currentPatchIndex,
    setCurrentPatchIndex,
    isApprovalDialogOpen,
    setIsApprovalDialogOpen,
  } = usePatchState()

  // Patch Approval Handlers - centralized via usePatchApproval hook
  const {
    handleApprovePatch,
    handleRejectPatch,
    handleEditPatch,
    showPatchApprovalDialog,
  } = usePatchApproval({
    currentPatchIndex,
    setCurrentPatchIndex,
    pendingPatches,
    setPendingPatches,
    setIsApprovalDialogOpen,
  })

  // App Settings State - centralized via useAppSettings hook
  const { appSettings, setAppSettings, appSettingsRef } = useAppSettings()

  // Fast Apply status - extracted to useFastApplyStatus hook
  useFastApplyStatus({
    clusoCloudEditsEnabled: appSettings.clusoCloudEditsEnabled,
    setFastApplyReady,
  })

  // Cluso Agent - AI control of UI elements (must be after appSettings)
  const clusoAgent = useClusoAgent({
    googleApiKey: appSettings.providers.find(p => p.id === 'google')?.apiKey,
  })

  // Apply Electron window appearance settings - extracted to useWindowAppearance hook
  useWindowAppearance({
    transparencyEnabled: appSettings.transparencyEnabled,
    windowOpacity: appSettings.windowOpacity,
    windowBlur: appSettings.windowBlur,
  });


  // Close onboarding modal when project changes - extracted to useOnboardingSync hook
  useOnboardingSync({
    projectPath: activeTab?.projectPath,
    showMgrepOnboarding,
    setShowMgrepOnboarding,
  })

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

  // Handle extension chat requests (Chrome extension communication) - extracted to useExtensionBridge hook
  useExtensionBridge({
    selectedModelRef,
    setExtensionConnected,
  });

  // Auto-clear completed tool calls after a delay - extracted to useCompletedToolCallsClear hook
  useCompletedToolCallsClear({
    completedToolCalls,
    setCompletedToolCalls,
  });

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

  // Update connection state when AI SDK initializes - extracted to useConnectionState hook
  useConnectionStateEffect({
    isAIInitialized,
    connectionState,
    setConnectionState,
  });

  // MCP State - centralized via useMCPHandlers hook
  const {
    mcpToolDefinitions,
    mcpTools,
    mcpServers,
    mcpAvailable,
    callMCPTool,
  } = useMCPHandlers(appSettings)

  // Clarifying Questions State - centralized via useClarifyingState hook
  const {
    pendingQuestion: pendingClarifyingQuestion,
    handleAskClarifyingQuestion,
    handleClarifyingQuestionSubmit,
    handleClarifyingQuestionSkip,
  } = useClarifyingState()

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

  // Pending Code Change State - centralized via usePendingChangeState hook
  const {
    pendingChange,
    setPendingChange,
    isPreviewingOriginal,
    setIsPreviewingOriginal,
  } = usePendingChangeState();

  // Viewport State - centralized via useViewportMode hook
  const {
    viewportSize,
    setViewportSize,
    selectedDevice,
    setSelectedDevice,
    customWidth,
    setCustomWidth,
    customHeight,
    setCustomHeight,
    isCustomDevice,
    setIsCustomDevice,
    isDeviceSelectorOpen,
    setIsDeviceSelectorOpen,
    isMultiViewportMode,
    setIsMultiViewportMode,
    viewportCount,
    setViewportCount,
    viewportControlsRef,
    zoomLevel,
    setZoomLevel,
    isZoomSelectorOpen,
    setIsZoomSelectorOpen,
    actualScale,
    currentWidth,
    currentHeight,
    devicePresets,
    zoomOptions,
    viewportWidths,
    handleDeviceSelect,
    handleCustomDevice,
  } = useViewportMode({ displayPpi: appSettings.displayPpi })

  // Console Panel State (extracted to useConsolePanel hook)
  const {
    consoleLogs,
    setConsoleLogs,
    isConsolePanelOpen,
    setIsConsolePanelOpen,
    consoleHeight,
    setConsoleHeight,
    consoleFilters,
    setConsoleFilters,
    filteredLogs,
    toggleConsoleFilter,
    clearConsoleFilters,
    isConsoleResizing,
    setIsConsoleResizing,
    consoleResizeStartY,
    consoleResizeStartHeight,
    handleConsoleResizeStart,
    consolePanelTab,
    setConsolePanelTab,
    consoleEndRef,
    selectedLogIndices,
    setSelectedLogIndices,
    lastClickedLogIndex,
    handleLogRowClick,
    selectedLogs,
    consoleLogBufferRef,
    consoleLogFlushTimerRef,
    flushConsoleLogBuffer,
    enqueueConsoleLog,
    handleClearConsole,
  } = useConsolePanel()

  // Check if in Electron (moved early for hook dependencies)
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  // Debug State - debug mode, PTY port, and debug logger (extracted to hook)
  const {
    debugMode,
    setDebugMode,
    ptyPort,
    setPtyPort,
    debugLog,
  } = useDebugState({ enqueueConsoleLog, isElectron });

  // Terminal panel - extracted to useTerminalPanel hook
  const { terminalContainerRef } = useTerminalPanel({
    consolePanelTab,
    isDarkMode,
    ptyPort,
    consoleHeight,
  })

  // AI Selection State - AI-selected element and displayed source code (extracted to hook)
  const {
    aiSelectedElement,
    setAiSelectedElement,
    displayedSourceCode,
    setDisplayedSourceCode,
    clearAISelection,
    clearDisplayedSourceCode,
  } = useAISelectionState();

  // LSP UI - hover tooltips and autocomplete for code
  const lspUI = useLSPUI(displayedSourceCode?.fileName);

  // File Browser Panel State - stack navigation, visibility, and base path (extracted to hook)
  const {
    fileBrowserStack,
    setFileBrowserStack,
    fileBrowserVisible,
    setFileBrowserVisible,
    fileBrowserBasePath,
    setFileBrowserBasePath,
    fileBrowserStackRef,
    fileBrowserVisibleRef,
    pushPanel,
    popPanel,
    closeBrowser,
    openBrowser,
  } = useFileBrowserPanelState();

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Ref for prepareDomPatch (defined later, used by webview setup hook)
  const prepareDomPatchRef = useRef<
    | ((
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
      ) => void)
    | null
  >(null);

  // Bridge refs for handler functions - these are populated later in the component
  // and consumed by useWebviewSetup to avoid circular dependency issues
  const handleRefreshLayersRef = useRef<(() => Promise<void>) | null>(null);
  const handleTreeNodeSelectRef = useRef<((node: import('./components/ComponentTree').TreeNode) => void) | null>(null);
  const addEditedFileRef = useRef<((file: {
    path: string;
    additions?: number;
    deletions?: number;
    undoCode?: string;
    originalContent?: string;
    isFileModification?: boolean;
  }) => void) | null>(null);

  // Webview setup hook - handles all webview event handlers
  // Note: The large setupWebviewHandlers function (~1000 lines) has been extracted to
  // features/webview/useWebviewSetup.ts for better code organization.
  const {
    setupWebviewHandlers: _setupWebviewHandlers,
    getWebviewRefCallback,
    webviewRefs,
    webviewCleanups: _webviewCleanups,
  } = useWebviewSetup({
    updateTab,
    enqueueConsoleLog,
    activeTabId,
    tabsRef,
    setUrlInput,
    setHoveredElement,
    setSelectedElement,
    setSelectedTreeNodeId,
    setConsoleLogs,
    setAiSelectedElement,
    setMessages,
    setScreenshotElement,
    setIsScreenshotActive,
    setCapturedScreenshot,
    setMoveTargetPosition,
    setIsMoveActive,
    setPendingDOMApproval,
    setPendingChange,
    selectedElementRef,
    isLeftPanelOpenRef,
    layersTreeDataRef,
    layersTreeStaleRef,
    isLayersLoadingRef,
    isInspectorActiveRef,
    isScreenshotActiveRef,
    handleRefreshLayersRef,
    handleTreeNodeSelectRef,
    addEditedFileRef,
    prepareDomPatchRef,
  });

  // DOM Approval Lifecycle - handles telemetry, auto-cancellation on tab switch/selection change
  const {
    ensureDomTelemetry,
    markDomTelemetry,
    finalizeDomTelemetry,
    cancelDomApprovalValue,
    domEditTelemetryRef,
  } = useDomApprovalLifecycle({
    pendingDOMApproval,
    activeTabId,
    selectedElementXpath: selectedElement?.xpath,
    isGeneratingSourcePatch,
    cancelledApprovalsRef,
    webviewRefs: webviewRefs as unknown as React.MutableRefObject<Map<string, { executeJavaScript: (code: string) => Promise<unknown> }>>,
    clearDomApprovalPatchTimeout,
  });

  const activeWebview = webviewRefs.current.get(activeTabId);
  const isWebviewReady = activeTab.isWebviewReady;

  // Browser navigation operations - extracted to useBrowserNavigation hook
  const {
    navigateTo,
    handleUrlSubmit,
    goBack,
    goForward,
    reload,
  } = useBrowserNavigation({
    activeTabId,
    tabs,
    activeTab,
    updateCurrentTab,
    setUrlInput,
    urlInput,
    isElectron,
    webviewRefs,
  });

  // Change approval handlers - extracted to useChangeApprovalHandlers hook
  const {
    handleApproveChange,
    handleRejectChange,
    handleVoiceApprove,
    handleVoiceReject,
    handleVoiceUndo,
  } = useChangeApprovalHandlers({
    pendingChange,
    setPendingChange,
    setMessages,
    activeTabId,
    webviewRefs: webviewRefs as unknown as React.MutableRefObject<Map<string, { executeJavaScript: (code: string) => Promise<unknown>; reload: () => void }>>,
  });

  // Selection handlers from extracted hook
  const {
    handleAiElementSelect,
    handleExecuteCode,
    handleConfirmSelection,
    handleHighlightByNumber,
    handleClearFocus,
    handleSetViewport,
    handleSwitchTab,
    handleFindElementByText,
    handleSelectParent,
    handleSelectChildren,
    handleSelectSiblings,
    handleSelectAllMatching,
    handleStartDrillSelection,
    handleDrillInto,
    handleDrillBack,
    handleDrillForward,
    handleExitDrillMode,
    handleRefreshLayers,
    handleRefreshLayersRef: _handleRefreshLayersRef,
    handleTreeNodeSelect,
    handleTreeNodeSelectRef: _handleTreeNodeSelectRef,
    handleElementStyleChange,
    flushApplyElementStyles,
    queueApplyElementStyles,
    handleGetPageElements,
  } = useSelectionHandlers({
    webviewRefs: webviewRefs as unknown as SelectionHandlersDeps['webviewRefs'],
    activeTabId,
    activeTab: { url: activeTab.url, projectPath: activeTab.projectPath },
    isWebviewReady,
    setSelectedElement,
    setMessages,
    setAiSelectedElement,
    setViewportSize,
    setActiveTabId,
    handleNewTab,
    tabs: tabs.map(t => ({ id: t.id, type: t.type })),
    setIsLayersLoading,
    setLayersTreeData,
    layersTreeStaleRef,
    isMultiViewportMode,
    multiViewportData: multiViewportData.map(v => ({ id: v.id, windowType: v.windowType, devicePresetId: v.devicePresetId })),
    setSelectedTreeNodeId,
    setSelectedLayerElementNumber,
    setSelectedLayerElementName,
    setSelectedLayerComputedStyles,
    setSelectedLayerAttributes,
    setSelectedLayerDataset,
    setSelectedLayerFontFamilies,
    setSelectedLayerClassNames,
    setElementStyles,
    elementStylesRef,
    selectedLayerElementNumberRef,
    activeTabIdRef,
    viewportControlsRef,
    aiSelectedElement,
  });

  // Bridge effects: populate refs from useSelectionHandlers for useWebviewSetup
  useEffect(() => {
    handleRefreshLayersRef.current = handleRefreshLayers;
  }, [handleRefreshLayers]);

  useEffect(() => {
    handleTreeNodeSelectRef.current = handleTreeNodeSelect;
  }, [handleTreeNodeSelect]);

  // Debug: log electron status on mount
  useEffect(() => {
    console.log('isElectron:', isElectron);
    console.log('electronAPI:', window.electronAPI);
  }, [isElectron]);

  // Inspector should not auto-switch models - extracted to useInspectorThinking hook
  useInspectorThinking({
    isInspectorActive,
    selectedModel,
    thinkingLevel,
    preInspectorSettingsRef,
    setThinkingLevel,
  });

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

  // Mark Layers tree stale on navigation changes; refresh is user/event-driven only.
  useEffect(() => {
    if (activeTab.url) layersTreeStaleRef.current = true
  }, [activeTab.url])


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

  // Initialize selector agent when Electron is available - extracted to useSelectorAgentInit hook
  useSelectorAgentInit({
    isElectron: !!isElectron,
    selectorAgentActive,
    selectedModelRef,
    initializeSelectorAgent,
  });

  // Tool execution handlers - extracted to useToolExecution hook
  const {
    handlePatchSourceFile,
    handleListFiles,
    handleReadFile,
    handleClickElement,
    handleNavigate,
    handleScroll,
    primeAgentWithPageContext,
  } = useToolExecution({
    webviewRefs: webviewRefs as unknown as React.RefObject<Map<string, {
      getURL: () => string
      canGoBack: () => boolean
      canGoForward: () => boolean
      send: (channel: string, ...args: unknown[]) => void
      executeJavaScript: (code: string) => Promise<unknown>
      contentWindow?: Window
      loadURL: (url: string) => void
      goBack: () => void
      goForward: () => void
      reload: () => void
    }>>,
    activeTabId,
    isWebviewReady,
    setMessages,
    selectorAgentActive,
    handleGetPageElements,
    primeSelectorContext,
  });

  // Auto-prime selector agent when page loads - extracted to useSelectorAgentPriming hook
  useSelectorAgentPriming({
    selectorAgentActive,
    isWebviewReady,
    selectorAgentPrimed,
    primeAgentWithPageContext,
  });

  // File handlers - extracted to useFileHandlers hook
  const {
    handleFileTreeSelect,
    handleReadFile: handleReadFileFromHandler,
    showFileBrowser,
    openFileBrowserItem,
    fileBrowserBack,
    closeFileBrowser,
    openFolder,
    openFile,
    handleListFilesWithOverlay,
    loadDirectoryFiles,
    navigateToDirectory,
    navigateBack,
    handleFileSelect,
    formatFileDisplay,
    addEditedFile,
    undoFileEdit,
    undoAllEdits,
    keepAllEdits,
  } = useFileHandlers({
    isElectron,
    activeTabProjectPath: activeTab?.projectPath,
    activeTabId,
    setEditorFilePath,
    setEditorFileContent,
    setHasUnsavedEdits,
    setIsEditorMode,
    fileBrowserBasePath,
    setFileBrowserBasePath,
    fileBrowserStackRef,
    fileBrowserVisibleRef,
    setFileBrowserStack,
    setFileBrowserVisible,
    directoryStack,
    setDirectoryStack,
    currentDirectory,
    setDirectoryFiles,
    setCurrentDirectory,
    setFileSearchQuery,
    setAutocompleteIndex,
    setShowFileAutocomplete,
    selectedFiles,
    setSelectedFiles,
    setInput,
    editedFiles,
    setEditedFiles,
    setIsEditedFilesDrawerOpen,
    webviewRefs: webviewRefs as unknown as React.MutableRefObject<Map<string, Electron.WebviewTag>>,
  });

  // Populate addEditedFile ref for webview setup
  useEffect(() => {
    addEditedFileRef.current = addEditedFile;
  }, [addEditedFile]);

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

  // Load available prompts and directory files on mount - extracted to useCommandsLoader hook
  useCommandsLoader({
    isElectron,
    setAvailableCommands,
    setDirectoryFiles,
  })

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

  // Auto-resize textarea - extracted to useAutoTextareaResize hook
  useAutoTextareaResize({
    input,
    textareaRef,
  });

  // Handle Screen Sharing logic - extracted to useScreenSharing hook
  useScreenSharing({
    isScreenSharing,
    setIsScreenSharing,
    streamState,
    videoRef,
    startVideoStreaming,
    stopVideoStreaming,
  });

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
        console.log('[Inline Edit] *** MESSAGE RECEIVED ***');
        const data = args[0] as { oldText: string; newText: string; element: SelectedElement };
        console.log('[Inline Edit] Data:', { hasOldText: !!data.oldText, hasNewText: !!data.newText, hasElement: !!data.element });

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

        console.log('[Inline Edit] Condition check:', {
          hasElementWithSource: !!elementWithSource,
          hasSourceLocation: !!elementWithSource?.sourceLocation,
          projectPath: projectPath || 'NONE',
          hasOldText: !!data.oldText,
          hasNewText: !!data.newText,
          tabId,
          currentTabId: currentTab?.id
        });

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


  // Auto-scroll for console is handled in useConsolePanel hook

  // Terminal panel is now handled by useTerminalPanel hook (called earlier)

  // Ref for updateCodingContext to avoid triggering effect when function identity changes
  const updateCodingContextRef = useRef(updateCodingContext)
  updateCodingContextRef.current = updateCodingContext

  // Sync coding agent context when selections change - extracted to useCodingContextSync hook
  useCodingContextSync({
    selectedElement,
    selectedFiles,
    selectedLogs,
    projectPath: activeTab?.projectPath,
    messages,
    updateCodingContextRef,
  });

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

  // Keyboard shortcuts for console log actions - extracted to useConsoleKeyboardShortcuts hook
  useConsoleKeyboardShortcuts({
    isConsolePanelOpen,
    selectedLogIndices,
    setSelectedLogIndices,
    consoleLogs,
    performInstantSearch,
  });

  // filteredLogs is now provided by useConsolePanel hook
  const filteredConsoleLogs = filteredLogs;

  // Click-outside handler for thinking popover - extracted to useThinkingPopover hook
  useThinkingPopover({
    showThinkingPopover,
    setShowThinkingPopover,
  });


  // Bridge effect: populate addEditedFileRef for useWebviewSetup
  // (addEditedFile, undoFileEdit, undoAllEdits, keepAllEdits are now from useFileHandlers hook)
  useEffect(() => {
    addEditedFileRef.current = addEditedFile;
  }, [addEditedFile]);

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

  // Note: addEditedFileRef is declared earlier and populated via useEffect for useWebviewSetup

  // File watcher - extracted to useFileWatcher hook
  useFileWatcher({
    isElectron: !!isElectron,
    projectPath: activeTab.projectPath,
    addEditedFile,
    setFileWatcherActive,
  })

  // Load recent context chips from localStorage when project changes - extracted to useContextChipsPersistence hook
  useContextChipsPersistence({
    projectPath: activeTab.projectPath,
    setRecentContextChips,
    setContextChips,
  })

  // Sync Inspector State with Webview - extracted to useInspectorSync hook
  useInspectorSync({
    isElectron: !!isElectron,
    isWebviewReady,
    activeTabId,
    activeTabType: activeTab.type,
    isInspectorActive,
    isScreenshotActive,
    isMoveActive,
    webviewRefs: webviewRefs as unknown as React.MutableRefObject<Map<string, { send: (channel: string, ...args: unknown[]) => void; isConnected: boolean; getWebContentsId: () => number }>>,
    setSelectedElement: () => setSelectedElement(null),
    setShowElementChat,
  })

  // Auto-reload webview on HMR - extracted to useWebviewHmr hook
  useWebviewHmr({
    isElectron: !!isElectron,
    activeTabId,
    webviewRefs: webviewRefs as unknown as React.MutableRefObject<Map<string, { reload: () => void }>>,
  })

  // Reset element chat when sidebar opens
  useEffect(() => {
    if (isSidebarOpen) {
      setShowElementChat(false);
    }
  }, [isSidebarOpen]);

  // Scroll effects - extracted to useScrollEffects hook
  const streamingContent = streamingMessage?.content ?? ''
  useScrollEffects({
    messages,
    isStreaming,
    streamingContent,
    isAutoScrollEnabled,
    setIsAutoScrollEnabled,
    setShowScrollToBottom,
    messagesEndRef,
    messagesContainerRef,
    isUserScrollingRef,
  })

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

  // Load todos when project path changes - extracted to useTodosLoader hook
  useTodosLoader({
    projectPath: activeTab?.projectPath,
    activeTabId,
    setTabs,
  })

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
            setIsStreaming(false);
            setStreamingMessage(null);
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

            // Clear attached images and streaming state
            setAttachedImages([]);
            setIsStreaming(false);
            setStreamingMessage(null);
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
            setIsStreaming(false);
            setStreamingMessage(null);
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

  // Webview preload path state (auto-fetches on mount when in Electron)
  const { webviewPreloadPath } = useWebviewState(isElectron);

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

  // Populate prepareDomPatchRef for webview setup hook
  useEffect(() => {
    prepareDomPatchRef.current = prepareDomPatch;
  }, [prepareDomPatch]);

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
              <FloatingToolbar
                isDarkMode={isDarkMode}
                isMultiViewportMode={isMultiViewportMode}
                viewportCount={viewportCount}
                isScreenSharing={isScreenSharing}
                isInspectorActive={isInspectorActive}
                streamState={streamState}
                viewportControlsRef={viewportControlsRef}
                onToggleScreenSharing={() => setIsScreenSharing(!isScreenSharing)}
                onToggleInspector={() => {
                  setIsInspectorActive(!isInspectorActive)
                  setIsScreenshotActive(false)
                  setIsMoveActive(false)
                }}
                onToggleVoice={() => {
                  if (streamState.isStreaming && !streamState.isConnected) return
                  if (streamState.isConnected) {
                    stopSpeaking()
                    disconnect()
                  } else {
                    connect()
                  }
                }}
                onExitMultiViewport={() => setIsMultiViewportMode(false)}
              />
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
            <ConsolePanel
              isDarkMode={isDarkMode}
              consoleLogs={consoleLogs}
              filteredConsoleLogs={filteredConsoleLogs}
              consoleFilters={consoleFilters}
              consolePanelTab={consolePanelTab}
              selectedLogIndices={selectedLogIndices}
              selectedLogs={selectedLogs}
              consoleHeight={consoleHeight}
              isConsoleResizing={isConsoleResizing}
              terminalContainerRef={terminalContainerRef}
              onClose={() => setIsConsolePanelOpen(false)}
              onClearConsole={handleClearConsole}
              onToggleFilter={toggleConsoleFilter}
              onSetConsolePanelTab={setConsolePanelTab}
              onLogRowClick={handleLogRowClick}
              onSetSelectedLogIndices={setSelectedLogIndices}
              onResizeStart={handleConsoleResizeStart}
              onSearchSolutions={performInstantSearch}
            />
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
                            onMouseMove={lspUI.createCodeMouseMoveHandler(displayedSourceCode.startLine)}
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
        <StashDialog
          isDarkMode={isDarkMode}
          stashMessage={stashMessage}
          onStashMessageChange={setStashMessage}
          onClose={() => {
            setIsStashDialogOpen(false)
            setStashMessage('')
          }}
          onStash={handleStash}
        />
      )}

      {/* AI Element Selection Confirmation - Toolbar */}
      {aiSelectedElement && aiSelectedElement.elements && aiSelectedElement.elements.length > 0 && (
        <AIElementSelectionToolbar
          isDarkMode={isDarkMode}
          aiSelectedElement={aiSelectedElement}
          onConfirmSelection={handleConfirmSelection}
        />
      )}

      {/* Pending Change Preview - 3 Button Popup */}
      {pendingPreview && showCompactApprovalPopup && (
        <PendingChangePreview
          isDarkMode={isDarkMode}
          pendingPreview={pendingPreview}
          isGeneratingSourcePatch={isGeneratingSourcePatch}
          isPreviewingOriginal={isPreviewingOriginal}
          onSetPreviewingOriginal={setIsPreviewingOriginal}
          onShowOriginal={() => {
            const webview = webviewRefs.current.get(activeTabId)
            if (pendingPreview.undoCode && webview) {
              console.log('[Preview] Showing original')
              webview.executeJavaScript(pendingPreview.undoCode)
            }
          }}
          onShowChange={() => {
            const webview = webviewRefs.current.get(activeTabId)
            if (pendingPreview.applyCode && webview) {
              console.log('[Preview] Showing change')
              webview.executeJavaScript(pendingPreview.applyCode)
            }
          }}
          onReject={pendingDOMApproval ? handleRejectDOMApproval : handleRejectChange}
          onApprove={pendingDOMApproval ? handleAcceptDOMApproval : handleApproveChange}
        />
      )}

      {/* Screenshot Preview Modal */}
      {showScreenshotPreview && capturedScreenshot && (
        <ScreenshotPreviewModal
          screenshot={capturedScreenshot}
          onClose={() => setShowScreenshotPreview(false)}
        />
      )}

      {/* Hidden Media Elements */}
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="hidden" />


      {/* File Browser Overlay */}
      {fileBrowserVisible && (
        <FileBrowserOverlay
          isDarkMode={isDarkMode}
          fileBrowserStack={fileBrowserStack}
          onBack={fileBrowserBack}
          onClose={closeFileBrowser}
          onOpenItem={openFileBrowserItem}
        />
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

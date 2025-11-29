
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveGemini } from './hooks/useLiveGemini';
import { useGit } from './hooks/useGit';
import { INJECTION_SCRIPT } from './utils/iframe-injection';
import { SelectedElement, Message as ChatMessage } from './types';
import { TabState, createNewTab } from './types/tab';
import { TabBar, Tab } from './components/TabBar';
import { NewTabPage } from './components/NewTabPage';
import { ProjectSetupFlow } from './components/ProjectSetupFlow';
import { SettingsDialog, AppSettings, DEFAULT_SETTINGS, getFontSizeValue } from './components/SettingsDialog';
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block';
import { Tool, ToolContent, ToolHeader, ToolOutput } from '@/components/ai-elements/tool';
import { MessageResponse } from '@/components/ai-elements/message';
import { useAIChat, getProviderForModel, ProviderConfig } from './hooks/useAIChat';
import { GoogleGenAI } from '@google/genai'; // Keep for voice streaming
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
} from 'lucide-react';

// --- Helper Functions ---

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

// Icon mapping for models based on provider or specific model
const MODEL_ICONS: Record<string, typeof Sparkles> = {
  'gemini-3-pro-preview': Sparkles,
  'gemini-2.5-flash': Zap,
  'gemini-2.5-pro': Rocket,
  'gemini-2.0-flash': Rocket,
  'gpt-4o': Sparkles,
  'gpt-4o-mini': Zap,
  'claude-3-5-sonnet': Sparkles,
  'claude-3-opus': Rocket,
};

// Provider icons fallback
const PROVIDER_ICONS: Record<string, typeof Sparkles> = {
  'google': Sparkles,
  'openai': Zap,
  'anthropic': Rocket,
};

// Helper to get icon for a model
const getModelIcon = (modelId: string, providerId: string) => {
  return MODEL_ICONS[modelId] || PROVIDER_ICONS[providerId] || Sparkles;
};

// Legacy MODELS constant for backwards compatibility
const MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro', Icon: Sparkles },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', Icon: Zap },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', Icon: Rocket },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', Icon: Rocket },
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
  // Tab State - manages multiple browser tabs
  // First tab starts with the default URL so browser loads immediately
  const [tabs, setTabs] = useState<TabState[]>(() => [{
    ...createNewTab('tab-1'),
    url: DEFAULT_URL,
    title: 'New Tab'
  }]);
  const [activeTabId, setActiveTabId] = useState('tab-1');

  // Get current active tab
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Tab management functions
  const handleNewTab = useCallback(() => {
    const newTab = createNewTab();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const handleCloseTab = useCallback((tabId: string) => {
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
  }, [activeTabId]);

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  // Update current tab state helper
  const updateCurrentTab = useCallback((updates: Partial<TabState>) => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId ? { ...tab, ...updates } : tab
    ));
  }, [activeTabId]);

  // Convert TabState to Tab for TabBar
  const tabBarTabs: Tab[] = tabs.map(t => ({
    id: t.id,
    title: t.title || 'Cluso',
    url: t.url,
    favicon: t.favicon,
  }));

  // Browser State
  const [currentUrl, setCurrentUrl] = useState(DEFAULT_URL); // URL for webview src
  const [urlInput, setUrlInput] = useState(DEFAULT_URL); // URL in address bar (editable)
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pageTitle, setPageTitle] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  // Selection States
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [screenshotElement, setScreenshotElement] = useState<SelectedElement | null>(null);
  const [capturedScreenshot, setCapturedScreenshot] = useState<string | null>(null);
  const [showScreenshotPreview, setShowScreenshotPreview] = useState(false);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Inspector & Context State
  const [isInspectorActive, setIsInspectorActive] = useState(false);
  const [isScreenshotActive, setIsScreenshotActive] = useState(false);

  // Refs to track current state values for closures (webview event handlers)
  const isInspectorActiveRef = useRef(false);
  const isScreenshotActiveRef = useRef(false);

  const [logs, setLogs] = useState<string[]>([]);
  const [attachLogs, setAttachLogs] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Model State
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
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

  // Git State
  const git = useGit();
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [gitLoading, setGitLoading] = useState<string | null>(null);

  // Project Setup Flow State
  const [setupProject, setSetupProject] = useState<{ path: string; name: string } | null>(null);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Settings Dialog State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // App Settings State - with localStorage persistence
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('cluso-settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new settings added over time
        return { ...DEFAULT_SETTINGS, ...parsed };
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

  // Get all models from settings with availability status
  const displayModels = useMemo(() => {
    return appSettings.models.map(settingsModel => {
      const provider = appSettings.providers.find(p => p.id === settingsModel.provider);
      const isProviderConfigured = provider?.enabled && !!provider?.apiKey;
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
  }, [appSettings.models, appSettings.providers]);

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

  // Initialize AI Chat hook
  const { generate: generateAI, isLoading: isAILoading } = useAIChat({
    onError: (err) => console.error('[AI SDK] Error:', err),
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
  } | null>(null);
  const [isPreviewingOriginal, setIsPreviewingOriginal] = useState(false);

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
  const [isConsoleResizing, setIsConsoleResizing] = useState(false);
  const consoleResizeStartY = useRef<number>(0);
  const consoleResizeStartHeight = useRef<number>(192);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [selectedLogIndices, setSelectedLogIndices] = useState<Set<number>>(new Set());
  const lastClickedLogIndex = useRef<number | null>(null);

  // Webview ready state (for sending messages)
  const [isWebviewReady, setIsWebviewReady] = useState(false);

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

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webviewRef = useRef<WebviewElement>(null);

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

  // Keep refs in sync with state for webview event handler closures
  useEffect(() => {
    isInspectorActiveRef.current = isInspectorActive;
  }, [isInspectorActive]);

  useEffect(() => {
    isScreenshotActiveRef.current = isScreenshotActive;
  }, [isScreenshotActive]);

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
      // Clamp between 300 and 800 pixels
      setSidebarWidth(Math.max(300, Math.min(800, newWidth)));
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
  }, []);

  // Reject pending code change - undo and clear
  const handleRejectChange = useCallback(() => {
    console.log('[Exec] Rejecting change, pendingChange:', pendingChange);
    console.log('[Exec] undoCode:', pendingChange?.undoCode);
    console.log('[Exec] webviewRef.current:', !!webviewRef.current);

    if (pendingChange?.undoCode && webviewRef.current) {
      console.log('[Exec] Rejecting - running undo code:', pendingChange.undoCode);
      webviewRef.current.executeJavaScript(pendingChange.undoCode)
        .then(() => console.log('[Exec] Undo executed successfully'))
        .catch((err: Error) => console.error('[Exec] Undo error:', err));
    } else {
      console.log('[Exec] No undo code available or no webview');
    }
    setPendingChange(null);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content: 'Changes discarded.',
      timestamp: new Date()
    }]);
  }, [pendingChange]);

  // Browser navigation functions - use src attribute via currentUrl state
  const navigateTo = useCallback((url: string) => {
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'http://' + finalUrl;
    }
    console.log('Navigating to:', finalUrl);
    // Update both display URL and navigation URL
    setUrlInput(finalUrl);
    setCurrentUrl(finalUrl);
  }, []);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    navigateTo(urlInput);
  }, [urlInput, navigateTo]);

  const goBack = useCallback(() => {
    if (webviewRef.current && isElectron) {
      webviewRef.current.goBack();
    }
  }, [isElectron]);

  const goForward = useCallback(() => {
    if (webviewRef.current && isElectron) {
      webviewRef.current.goForward();
    }
  }, [isElectron]);

  const reload = useCallback(() => {
    if (webviewRef.current && isElectron) {
      webviewRef.current.reload();
    }
  }, [isElectron]);

  // Handle AI element selection request
  const handleAiElementSelect = useCallback((selector: string, reasoning?: string) => {
    console.log('[AI] Requesting element selection:', selector, reasoning);
    if (webviewRef.current && isWebviewReady) {
      // Send IPC message to webview to highlight the element
      webviewRef.current.send('select-element-by-selector', selector);

      // Store pending selection (we'll get confirmation via message)
      setAiSelectedElement({ selector, reasoning: reasoning || '' });
    }
  }, [isWebviewReady]);

  // Handle AI code execution
  const handleExecuteCode = useCallback((code: string, description: string) => {
    console.log('[AI] Executing code:', description);
    if (webviewRef.current && isWebviewReady) {
      webviewRef.current.executeJavaScript(code)
        .then(() => {
          console.log('[AI] Code executed successfully');
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: `✓ ${description}`,
            timestamp: new Date()
          }]);
        })
        .catch((err: Error) => {
          console.error('[AI] Code execution error:', err);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: `✗ Error: ${err.message}`,
            timestamp: new Date()
          }]);
        });
    }
  }, [isWebviewReady]);

  // Handle voice confirmation - can optionally specify which numbered element (1-indexed)
  const handleConfirmSelection = useCallback((confirmed: boolean, elementNumber?: number) => {
    console.log('[AI] Voice confirmation:', confirmed, 'element number:', elementNumber);
    if (confirmed && aiSelectedElement?.elements && aiSelectedElement.elements.length > 0) {
      // If elementNumber specified (1-indexed), use that, otherwise use first
      const index = elementNumber ? Math.min(Math.max(elementNumber - 1, 0), aiSelectedElement.elements.length - 1) : 0;
      setSelectedElement(aiSelectedElement.elements[index]);
      webviewRef.current?.send('clear-selection');
      setAiSelectedElement(null);
    } else {
      webviewRef.current?.send('clear-selection');
      setAiSelectedElement(null);
    }
  }, [aiSelectedElement]);

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
    onCodeUpdate: () => {}, // No longer used for code updates
    onElementSelect: handleAiElementSelect,
    onExecuteCode: handleExecuteCode,
    onConfirmSelection: handleConfirmSelection,
    selectedElement: selectedElement
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
    const result = await window.electronAPI.files.listDirectory(dirPath);
    if (result.success && result.data) {
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

  // Navigate back to parent directory
  const navigateBack = useCallback(() => {
    const newStack = [...directoryStack];
    const parentDir = newStack.pop();
    setDirectoryStack(newStack);
    loadDirectoryFiles(parentDir || undefined);
    setFileSearchQuery('');
    setAutocompleteIndex(0);
  }, [directoryStack, loadDirectoryFiles]);

  // Handle @ command - select a file from the list
  const handleFileSelect = useCallback(async (filePath: string) => {
    if (!isElectron || !window.electronAPI?.files) return;

    const result = await window.electronAPI.files.selectFile(filePath);
    if (result.success && result.data) {
      const { path, content } = result.data;
      setSelectedFiles(prev => [...prev, { path, content }]);
      setInput(''); // Clear @ command
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

  // Get filtered commands based on search query
  const filteredCommands = availableCommands.filter(cmd =>
    cmd.name.toLowerCase().includes(commandSearchQuery.toLowerCase())
  );

  // Detect @ and / commands in input
  const handleInputChange = useCallback((value: string) => {
    console.log('[Input] Changed:', value);
    setInput(value);
    setAutocompleteIndex(0);

    // Detect @ command for file selection
    if (value.startsWith('@')) {
      const query = value.substring(1);
      console.log('[Input] @ detected, query:', query);
      setFileSearchQuery(query);
      setShowFileAutocomplete(true);
      setShowCommandAutocomplete(false);
      // Load files on first @
      if (value === '@') {
        loadDirectoryFiles();
      }
    }
    // Detect / command for prompt selection
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
  }, [loadDirectoryFiles]);

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

  // Webview event handlers (Electron only)
  useEffect(() => {
    if (!isElectron) return;

    // Use a small delay to ensure webview is mounted
    const timer = setTimeout(() => {
      const webview = webviewRef.current;
      if (!webview) {
        console.log('Webview not found');
        return;
      }

      console.log('Setting up webview event handlers');

      const handleDidNavigate = () => {
        const url = webview.getURL();
        console.log('Did navigate:', url);
        // Only update display URL, not navigation URL (to avoid loops)
        setUrlInput(url);
        setCanGoBack(webview.canGoBack());
        setCanGoForward(webview.canGoForward());
      };

      const handleDidStartLoading = () => {
        console.log('Started loading');
        setIsLoading(true);
      };
      const handleDidStopLoading = () => {
        console.log('Stopped loading');
        setIsLoading(false);
      };
      const handleDidFinishLoad = () => {
        const loadedUrl = webview.getURL();
        console.log('Page finished loading, URL:', loadedUrl);
        // Resend inspector state to fresh preload script after each page load
        // The preload script runs fresh on each navigation, so we need to re-sync state
        // Use refs to get current values (state variables would be stale in this closure)
        console.log('Resending inspector modes after page load, inspector:', isInspectorActiveRef.current, 'screenshot:', isScreenshotActiveRef.current);
        webview.send('set-inspector-mode', isInspectorActiveRef.current);
        webview.send('set-screenshot-mode', isScreenshotActiveRef.current);
        setIsWebviewReady(true);
      };

      const handleDidFailLoad = (e: { errorCode: number; errorDescription: string; validatedURL: string }) => {
        console.error('Failed to load:', e.errorCode, e.errorDescription, e.validatedURL);
      };

      const handlePageTitleUpdated = (e: { title: string }) => {
        setPageTitle(e.title);
      };

      const handleIpcMessage = (event: { channel: string; args: unknown[] }) => {
        const { channel, args } = event;

        if (channel === 'inspector-select') {
          const data = args[0] as { element: SelectedElement; x: number; y: number; rect: unknown };
          setSelectedElement({
            ...data.element,
            x: data.x,
            y: data.y,
            rect: data.rect as SelectedElement['rect']
          });
        } else if (channel === 'screenshot-select') {
          const data = args[0] as { element: SelectedElement; rect: { top: number; left: number; width: number; height: number } };
          setScreenshotElement(data.element);
          setIsScreenshotActive(false);

          // Capture the screenshot of the selected element
          if (webview && data.rect) {
            webview.capturePage({
              x: Math.floor(data.rect.left),
              y: Math.floor(data.rect.top),
              width: Math.ceil(data.rect.width),
              height: Math.ceil(data.rect.height)
            }).then((image: Electron.NativeImage) => {
              setCapturedScreenshot(image.toDataURL());
            }).catch((err: Error) => {
              console.error('Failed to capture screenshot:', err);
            });
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
        }
      };

      const handleDomReady = () => {
        console.log('Webview DOM ready');
        setIsWebviewReady(true);
        // Also send inspector state on dom-ready in case page already loaded
        console.log('DOM ready - sending inspector modes, inspector:', isInspectorActiveRef.current, 'screenshot:', isScreenshotActiveRef.current);
        webview.send('set-inspector-mode', isInspectorActiveRef.current);
        webview.send('set-screenshot-mode', isScreenshotActiveRef.current);
      };

      const handleConsoleMessage = (e: { level: number; message: string; line: number; sourceId: string }) => {
        const levelMap: Record<number, 'log' | 'warn' | 'error' | 'info'> = {
          0: 'log',    // Verbose/Debug
          1: 'info',   // Info
          2: 'warn',   // Warning
          3: 'error'   // Error
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

      // Check if webview is already ready (events may have fired before listeners were attached)
      // The webview has a getURL method we can use to check if it's loaded
      try {
        const currentWebviewUrl = webview.getURL();
        console.log('Webview current URL on setup:', currentWebviewUrl);
        if (currentWebviewUrl) {
          // Webview already has a URL loaded, treat as ready
          console.log('Webview already loaded, setting ready and sending inspector state');
          setIsWebviewReady(true);
          webview.send('set-inspector-mode', isInspectorActiveRef.current);
          webview.send('set-screenshot-mode', isScreenshotActiveRef.current);
        }
      } catch (e) {
        console.log('Webview not yet ready for getURL');
      }

      // Cleanup function
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
    }, 100);

    return () => {
      clearTimeout(timer);
      setIsWebviewReady(false);
    };
  // Re-run when these change (webview may mount/unmount based on URL/state):
  // - currentUrl: the webview src
  // - setupProject: when not null, webview is hidden (showing ProjectSetupFlow)
  // - activeTab.url: determines isNewTabPage which controls webview visibility
  }, [isElectron, currentUrl, setupProject, activeTab.url]);

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

  // Clear selected logs when console is cleared
  const handleClearConsole = useCallback(() => {
    setConsoleLogs([]);
    setSelectedLogIndices(new Set());
    lastClickedLogIndex.current = null;
  }, []);

  // Sync Inspector State with Webview
  useEffect(() => {
    console.log('[Inspector Sync] Effect triggered:', { isElectron, hasWebview: !!webviewRef.current, isWebviewReady, isInspectorActive, isScreenshotActive });
    if (!isElectron) {
      console.log('[Inspector Sync] Skipping: not in Electron');
      return;
    }
    if (!webviewRef.current) {
      console.log('[Inspector Sync] Skipping: no webview ref');
      return;
    }
    if (!isWebviewReady) {
      console.log('[Inspector Sync] Skipping: webview not ready');
      return;
    }

    const webview = webviewRef.current;
    console.log('[Inspector Sync] Sending inspector modes to webview:', { isInspectorActive, isScreenshotActive });
    webview.send('set-inspector-mode', isInspectorActive);
    webview.send('set-screenshot-mode', isScreenshotActive);

    if (!isInspectorActive) {
      setSelectedElement(null);
      setShowElementChat(false);
    }
  }, [isInspectorActive, isScreenshotActive, isElectron, isWebviewReady]);

  // Auto-reload webview on HMR (Hot Module Replacement)
  useEffect(() => {
    if (!isElectron || !webviewRef.current) return;

    // Vite HMR - reload webview when app code changes
    if (import.meta.hot) {
      const handleHmrUpdate = () => {
        console.log('[HMR] Reloading webview...');
        if (webviewRef.current) {
          webviewRef.current.reload();
        }
      };

      import.meta.hot.on('vite:afterUpdate', handleHmrUpdate);

      return () => {
        import.meta.hot?.off('vite:afterUpdate', handleHmrUpdate);
      };
    }
  }, [isElectron]);

  // Reset element chat when sidebar opens
  useEffect(() => {
    if (isSidebarOpen) {
      setShowElementChat(false);
    }
  }, [isSidebarOpen]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64 = reader.result as string;
              setAttachedImage(base64);
          };
          reader.readAsDataURL(file);
      }
  };

  // Handle Text Submission
  const processPrompt = async (promptText: string) => {
    if (!promptText.trim() && !selectedElement && !attachedImage && !screenshotElement) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText,
      timestamp: new Date(),
      selectedElement: selectedElement || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    const contents: unknown[] = [];

    // Build element context in react-grab style format
    let elementContext = '';
    if (selectedElement) {
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
${selectedElement.rect ? `- Dimensions: ${Math.round(selectedElement.rect.width)}x${Math.round(selectedElement.rect.height)} at (${Math.round(selectedElement.rect.left)}, ${Math.round(selectedElement.rect.top)})` : ''}
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

    let fullPromptText = `
Current Page: ${urlInput}
${pageTitle ? `Page Title: ${pageTitle}` : ''}

User Request: ${userMessage.content}
${elementContext}
${fileContext}
${screenshotElement ? `Context: User selected element for visual reference: <${screenshotElement.tagName}>` : ''}
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

    // Only include code execution instructions if user has selected an element
    // OR explicitly asks to modify the page (change, update, modify, etc.)
    const modifyKeywords = /\b(change|modify|update|edit|delete|remove|add|make|set|fix|replace|style|color|size|font|width|height|margin|padding|border)\b/i;
    const wantsModification = selectedElement || modifyKeywords.test(userMessage.content);

    if (wantsModification) {
      fullPromptText += `
Instructions:
You are an AI UI assistant that can modify web pages in real-time.

When the user asks you to change, modify, or update something on the page:
1. Output a JSON code block with BOTH forward and undo JavaScript
2. Use the format: \`\`\`json-exec {"code": "...", "undo": "..."}\`\`\`
3. The "code" will be executed immediately, "undo" restores the original

Examples:
- Change text: \`\`\`json-exec {"code": "document.querySelector('#myId').textContent = 'New'", "undo": "document.querySelector('#myId').textContent = 'Old'"}\`\`\`
- Change style: \`\`\`json-exec {"code": "document.querySelector('.btn').style.backgroundColor = 'red'", "undo": "document.querySelector('.btn').style.backgroundColor = 'blue'"}\`\`\`
- XPath example: \`\`\`json-exec {"code": "document.evaluate('${selectedElement?.xpath || ''}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent = 'New'", "undo": "document.evaluate('${selectedElement?.xpath || ''}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent = 'Original'"}\`\`\`

For the selected element, you can use:
- XPath: ${selectedElement?.xpath || 'N/A'}
- ID: ${selectedElement?.id || 'N/A'}
- Classes: ${selectedElement?.className || 'N/A'}

IMPORTANT: Always provide the ORIGINAL value in the "undo" code so the user can preview before/after.

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

    if (attachedImage) {
        const base64Data = attachedImage.split(',')[1];
        const mimeType = attachedImage.split(';')[0].split(':')[1];
        contents.push({
            inlineData: {
                mimeType: mimeType,
                data: base64Data
            }
        });
    }

    contents.push({ text: fullPromptText });

    setAttachLogs(false);
    setAttachedImage(null);
    setScreenshotElement(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      // Determine which provider to use based on selected model
      const providerType = getProviderForModel(selectedModel.id);

      let text: string | null = null;

      // Use AI SDK for OpenAI, Anthropic, and Google text models
      if (providerType && providerConfigs.length > 0) {
        console.log(`[AI SDK] Using provider: ${providerType} for model: ${selectedModel.id}`);

        text = await generateAI({
          modelId: selectedModel.id,
          messages: [{ role: 'user', content: fullPromptText }],
          providers: providerConfigs,
        });
      } else {
        // Fallback to GoogleGenAI for backwards compatibility or if no provider configured
        console.log('[AI SDK] Falling back to GoogleGenAI');
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("No API Key configured. Please add your API key in Settings.");
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
          model: selectedModel.id,
          contents: contents
        });

        text = response.text;
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

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: cleanedText || 'Changes applied.',
          timestamp: new Date(),
          model: selectedModel.name
        }]);

        // If we have code to execute, execute immediately and show toolbar
        if (codeBlocks.length > 0 && webviewRef.current && isWebviewReady) {
          const forwardCode = codeBlocks.map(b => b.code).join(';\n');
          const undoCode = codeBlocks.map(b => b.undo || '').filter(Boolean).join(';\n');

          // Execute immediately
          console.log('[Exec] Executing immediately:', forwardCode);
          webviewRef.current.executeJavaScript(forwardCode)
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
            deletions
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
    }
  };

  // Calculate popup position for webview - bottom-right of element with smart edge detection
  const getPopupStyle = () => {
    if (!selectedElement || !selectedElement.rect || !webviewRef.current) return { display: 'none' };

    const webviewRect = webviewRef.current.getBoundingClientRect();
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

    if (!filePath || !isElectron || !window.electronAPI?.readFile) {
      console.log('Cannot read file:', { filePath, isElectron });
      return;
    }

    // If path is relative and we have a project path, resolve it
    if (!filePath.startsWith('/') && activeTab.projectPath) {
      // Handle various relative path formats from bundlers
      // e.g., "./src/App.tsx", "src/App.tsx", "/src/App.tsx" (relative to project root)
      const cleanPath = filePath.replace(/^\.\//, '').replace(/^\/?/, '');
      filePath = `${activeTab.projectPath}/${cleanPath}`;
      console.log('Resolved relative path:', filePath);
    }

    try {
      const result = await window.electronAPI.readFile(filePath);
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

  // Handle opening a project from new tab page - triggers setup flow
  const handleOpenProject = useCallback((projectPath: string, projectName: string) => {
    console.log('Starting project setup flow:', projectPath, projectName);
    setSetupProject({ path: projectPath, name: projectName });
  }, []);

  // Handle setup flow completion - actually opens the browser
  const handleSetupComplete = useCallback((url: string) => {
    if (setupProject) {
      updateCurrentTab({ url, title: setupProject.name, projectPath: setupProject.path });
      // Update both display URL and navigation URL
      setUrlInput(url);
      setCurrentUrl(url);
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
    // Update both display URL and navigation URL
    setUrlInput(url);
    setCurrentUrl(url);
  }, [updateCurrentTab]);

  // Check if current tab is "new tab" (no URL)
  const isNewTabPage = !activeTab.url;

  return (
    <div className={`flex flex-col h-screen w-full overflow-hidden font-sans ${isDarkMode ? 'dark bg-neutral-900 text-neutral-100' : 'bg-stone-300 text-neutral-900'}`}>

      {/* Tab Bar - at the very top with traffic light area */}
      <TabBar
        tabs={tabBarTabs}
        activeTabId={activeTabId}
        onTabSelect={handleSelectTab}
        onTabClose={handleCloseTab}
        onNewTab={handleNewTab}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden pt-1 pb-2 px-2 gap-1">

        {/* --- Left Pane: Browser, New Tab Page, or Project Setup --- */}
        {setupProject ? (
          <div className={`flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border ${isDarkMode ? 'bg-neutral-800 border-neutral-700/50' : 'bg-white border-stone-200/60'}`}>
            <ProjectSetupFlow
              projectPath={setupProject.path}
              projectName={setupProject.name}
              isDarkMode={isDarkMode}
              onComplete={handleSetupComplete}
              onCancel={handleSetupCancel}
            />
          </div>
        ) : isNewTabPage ? (
          <div className={`flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border ${isDarkMode ? 'bg-neutral-800 border-neutral-700/50' : 'bg-white border-stone-200/60'}`}>
            <NewTabPage
              onOpenProject={handleOpenProject}
              onOpenUrl={handleOpenUrl}
              isDarkMode={isDarkMode}
            />
          </div>
        ) : (
          <div className={`flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm border ${isDarkMode ? 'bg-neutral-800 border-neutral-700/50' : 'bg-white border-stone-200/60'}`}>

            {/* Browser Toolbar */}
            <div className={`h-12 border-b flex items-center gap-2 px-3 flex-shrink-0 ${isDarkMode ? 'border-neutral-700 bg-neutral-800' : 'border-stone-100 bg-stone-50'}`}>
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
                onChange={(e) => setUrlInput(e.target.value)}
                className={`w-full h-8 px-3 pr-8 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100 placeholder-neutral-400' : 'bg-white border border-stone-200'}`}
                placeholder="Enter URL..."
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
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isInspectorActive ? 'bg-blue-100 text-blue-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-500')}`}
            title="Element Inspector"
          >
            <MousePointer2 size={16} />
          </button>

          {/* DevTools Toggle */}
          <button
            onClick={() => {
              if (webviewRef.current) {
                webviewRef.current.openDevTools();
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
              /* Wrapper div for proper corner clipping - uses aspect ratio to fit viewport */
              <div
                className={`transition-all duration-300 origin-center ${
                  viewportSize === 'desktop'
                    ? 'w-full h-full'
                    : 'rounded-3xl shadow-2xl ring-4 ring-neutral-700 overflow-hidden flex-shrink-0'
                }`}
                style={viewportSize === 'desktop' ? undefined : (
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
                )}
              >
                <webview
                  ref={webviewRef as React.RefObject<HTMLElement>}
                  src={currentUrl || 'about:blank'}
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
                <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2 backdrop-blur shadow-2xl p-2 rounded-full z-40 ${isDarkMode ? 'bg-neutral-800/90 border border-neutral-700/50' : 'bg-white/90 border border-stone-200/50'}`}>
                    <button
                        onClick={() => setIsScreenSharing(!isScreenSharing)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-green-100 text-green-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500')}`}
                        title="Toggle Screen Share"
                    >
                        <Monitor size={18} />
                    </button>

                    <button
                        onClick={() => {
                            setIsInspectorActive(!isInspectorActive);
                            setIsScreenshotActive(false);
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isInspectorActive ? 'bg-blue-100 text-blue-600' : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-100 text-stone-500')}`}
                        title="Toggle Element Inspector"
                    >
                        <MousePointer2 size={18} />
                    </button>

                    <div className={`w-[1px] h-6 mx-1 ${isDarkMode ? 'bg-neutral-600' : 'bg-stone-200'}`}></div>

                    <button
                        onClick={streamState.isConnected ? disconnect : connect}
                        className={`flex items-center justify-center w-10 h-10 rounded-full font-medium transition-all ${streamState.isConnected ? 'bg-red-50 text-red-600 ring-1 ring-red-100' : (isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-800')}`}
                        title={streamState.isConnected ? 'End voice session' : 'Start voice session'}
                    >
                        {streamState.isConnected ? (
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                        ) : (
                            <Mic size={18} />
                        )}
                    </button>
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
                <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-200'}`} style={{ position: 'relative', top: '-3px' }}>
                  <Terminal size={14} className={isDarkMode ? 'text-neutral-400' : 'text-stone-500'} />
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>Console</span>
                  <span className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                    {consoleLogs.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {selectedLogIndices.size > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                      {selectedLogIndices.size} selected
                    </span>
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
                {consoleLogs.length === 0 ? (
                  <div className={`text-center py-8 ${isDarkMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                    No console messages yet
                  </div>
                ) : (
                  consoleLogs.map((log, index) => (
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
      <div className={`flex flex-col rounded-xl shadow-sm flex-shrink-0 border ${isDarkMode ? 'bg-neutral-800 border-neutral-700/50' : 'bg-white border-stone-200/60'}`} style={{ width: sidebarWidth }}>

          {/* Git Header */}
          <div className={`h-12 border-b flex items-center justify-between px-3 flex-shrink-0 ${isDarkMode ? 'border-neutral-700' : 'border-stone-100'}`}>
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                  <div className={`h-full flex items-center justify-center text-sm ${isDarkMode ? 'text-neutral-500' : 'text-stone-300'}`}>
                      Start a conversation...
                  </div>
              )}
              {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
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
                          {formatRelativeTime(msg.timestamp)}{msg.role === 'assistant' && msg.model && ` · ${msg.model}`}
                      </div>
                  </div>
              ))}
              <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4" style={{ overflow: 'visible' }}>
              <div className={`rounded-2xl border ${isDarkMode ? 'bg-neutral-700 border-neutral-600' : 'bg-stone-50 border-stone-200'}`} style={{ overflow: 'visible' }}>
                  {/* Selection Chips */}
                  {(selectedElement || screenshotElement || attachLogs || selectedLogs) && (
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
                          {selectedElement && (
                              <div
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                                onClick={handleShowSourceCode}
                                title="Click to view source code"
                              >
                                  <Check size={12} />
                                  {selectedElement.sourceLocation ? (
                                      <span className="font-mono font-medium">
                                          {(() => {
                                            const src = selectedElement.sourceLocation.sources?.[0];
                                            if (!src) return selectedElement.sourceLocation.summary;
                                            const fileName = src.file?.split('/').pop() || 'unknown';
                                            const startLine = src.line || 0;
                                            const endLine = src.endLine || startLine + 5;
                                            return `${fileName} (${startLine}-${endLine})`;
                                          })()}
                                      </span>
                                  ) : (
                                      <span className="font-medium">{selectedElement.tagName.toLowerCase()}</span>
                                  )}
                                  <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedElement(null);
                                        setDisplayedSourceCode(null);
                                      }}
                                      className="ml-0.5 hover:text-blue-900"
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
                                      }}
                                      className="ml-0.5 hover:text-purple-900"
                                  >
                                      <X size={12} />
                                  </button>
                              </div>
                          )}
                      </div>
                  )}

                  {/* File Chips */}
                  {selectedFiles.length > 0 && (
                      <div className={`px-3 pt-2 flex flex-wrap gap-2`}>
                          {selectedFiles.map((file, idx) => (
                              <div key={idx} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${isDarkMode ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
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
                      </div>
                  )}

                  {/* Source Code Preview */}
                  {displayedSourceCode && (
                      <div className="px-3 pt-3">
                          <div className={`text-xs font-mono mb-1 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                            {displayedSourceCode.fileName} ({displayedSourceCode.startLine}-{displayedSourceCode.endLine})
                          </div>
                          <CodeBlock
                            code={displayedSourceCode.code}
                            language="tsx"
                            showLineNumbers={true}
                            isDarkMode={isDarkMode}
                          >
                            <CodeBlockCopyButton />
                          </CodeBlock>
                      </div>
                  )}

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
                                      loadDirectoryFiles();
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
                  </div>

                  {/* Input Toolbar */}
                  <div className={`flex items-center justify-between px-3 py-2 border-t ${isDarkMode ? 'border-neutral-600' : 'border-stone-100'}`}>
                      <div className="flex items-center gap-1">
                          {/* Agent Selector */}
                          <div className="relative">
                              <button
                                  onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition ${isDarkMode ? 'border-neutral-600 hover:bg-neutral-600 text-neutral-200 bg-neutral-700' : 'border-stone-200 hover:bg-stone-50 text-stone-700 bg-white'}`}
                              >
                                  <selectedModel.Icon size={16} />
                                  <span>{selectedModel.name}</span>
                                  <ChevronDown size={12} className={isDarkMode ? 'text-neutral-400' : 'text-stone-400'} />
                              </button>

                              {isModelMenuOpen && (
                                  <>
                                      <div className="fixed inset-0 z-[99]" onClick={() => setIsModelMenuOpen(false)}></div>
                                      <div className={`absolute bottom-full left-0 mb-2 w-56 rounded-xl shadow-xl py-1 z-[100] max-h-80 overflow-y-auto ${isDarkMode ? 'bg-neutral-700 border border-neutral-600' : 'bg-white border border-stone-200'}`}>
                                          {/* Show all models from settings */}
                                          {displayModels.map(model => (
                                              <button
                                                  key={model.id}
                                                  onClick={() => {
                                                    if (model.isAvailable) {
                                                      setSelectedModel({ id: model.id, name: model.name, Icon: model.Icon });
                                                      setIsModelMenuOpen(false);
                                                    }
                                                  }}
                                                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 ${
                                                      !model.isAvailable
                                                        ? 'opacity-40 cursor-not-allowed'
                                                        : isDarkMode ? 'hover:bg-neutral-600 text-neutral-200' : 'hover:bg-stone-50'
                                                  }`}
                                                  disabled={!model.isAvailable}
                                                  title={!model.isProviderConfigured ? 'Configure provider API key in Settings' : !model.isEnabled ? 'Enable in Settings' : ''}
                                              >
                                                  <model.Icon size={16} className={model.isAvailable ? (isDarkMode ? 'text-neutral-400' : 'text-stone-500') : 'text-stone-300'} />
                                                  <span className={`flex-1 ${selectedModel.id === model.id ? 'font-medium' : ''}`}>{model.name}</span>
                                                  {selectedModel.id === model.id && (
                                                      <Check size={14} className="text-blue-600" />
                                                  )}
                                              </button>
                                          ))}
                                      </div>
                                  </>
                              )}
                          </div>

                          </div>

                      <div className="flex items-center gap-1">
                          {/* Cursor/Inspector */}
                          <button
                              onClick={() => {
                                  setIsInspectorActive(!isInspectorActive);
                                  setIsScreenshotActive(false);
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

                          {/* Send */}
                          <button
                              onClick={() => processPrompt(input)}
                              disabled={!input.trim()}
                              className={`p-1.5 rounded-lg transition-colors ml-1 disabled:opacity-30 disabled:cursor-not-allowed ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-800'}`}
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
      {pendingChange && (
          <div className={`absolute bottom-24 left-1/2 transform -translate-x-1/2 flex items-center gap-2 rounded-full shadow-xl p-2 z-50 ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
              {/* Diff Stats */}
              <div className="flex items-center gap-1.5 px-2 text-xs font-mono">
                  <span className="text-green-500">+{pendingChange.additions}</span>
                  <span className="text-red-500">-{pendingChange.deletions}</span>
              </div>
              <div className={`w-[1px] h-6 ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-200'}`}></div>
              <button
                  onMouseDown={() => {
                    if (pendingChange.undoCode && webviewRef.current) {
                      console.log('[Preview] Showing original');
                      webviewRef.current.executeJavaScript(pendingChange.undoCode);
                      setIsPreviewingOriginal(true);
                    }
                  }}
                  onMouseUp={() => {
                    if (pendingChange.code && webviewRef.current) {
                      console.log('[Preview] Showing change');
                      webviewRef.current.executeJavaScript(pendingChange.code);
                      setIsPreviewingOriginal(false);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isPreviewingOriginal) return;
                    if (pendingChange.code && webviewRef.current) {
                      console.log('[Preview] Showing change (mouse leave)');
                      webviewRef.current.executeJavaScript(pendingChange.code);
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
                  onClick={handleRejectChange}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-red-900/20 text-neutral-400 hover:text-red-400' : 'hover:bg-red-50 text-neutral-600 hover:text-red-600'}`}
                  title="Discard changes"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
              <button
                  onClick={handleApproveChange}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-colors ${isDarkMode ? 'bg-neutral-100 text-neutral-900 hover:bg-white' : 'bg-neutral-900 text-white hover:bg-neutral-800'}`}
                  title="Apply changes"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
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

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        settings={appSettings}
        onSettingsChange={setAppSettings}
      />

      </div>
    </div>
  );
}

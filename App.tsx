
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useLiveGemini } from './hooks/useLiveGemini';
import { useGit } from './hooks/useGit';
import { INJECTION_SCRIPT } from './utils/iframe-injection';
import { SelectedElement, Message } from './types';
import { GoogleGenAI } from '@google/genai';
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
} from 'lucide-react';

// --- Constants ---

const MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', Icon: Zap },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', Icon: Sparkles },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', Icon: Rocket },
];

const DEFAULT_URL = 'http://localhost:3000/test.html';

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
  // Browser State
  const [browserUrl, setBrowserUrl] = useState(DEFAULT_URL);
  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pageTitle, setPageTitle] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  // Selection States
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [screenshotElement, setScreenshotElement] = useState<SelectedElement | null>(null);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Inspector & Context State
  const [isInspectorActive, setIsInspectorActive] = useState(false);
  const [isScreenshotActive, setIsScreenshotActive] = useState(false);

  const [logs, setLogs] = useState<string[]>([]);
  const [attachLogs, setAttachLogs] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Model State
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  // Popup Input State
  const [popupInput, setPopupInput] = useState('');

  // Git State
  const git = useGit();
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [gitLoading, setGitLoading] = useState<string | null>(null);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Stash Confirmation Dialog State
  const [isStashDialogOpen, setIsStashDialogOpen] = useState(false);
  const [stashMessage, setStashMessage] = useState('');

  // Pending Code Change State (for preview/approve/reject)
  const [pendingChange, setPendingChange] = useState<{
    code: string;
    undoCode: string;
    description: string;
  } | null>(null);
  const [isPreviewingOriginal, setIsPreviewingOriginal] = useState(false);

  // Webview ready state (for sending messages)
  const [isWebviewReady, setIsWebviewReady] = useState(false);

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

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

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

  // Approve pending code change - execute in webview
  const handleApproveChange = useCallback(() => {
    if (!pendingChange || !webviewRef.current || !isWebviewReady) return;

    console.log('[Exec] Approved - Running code in webview:', pendingChange.code);
    webviewRef.current.executeJavaScript(pendingChange.code)
      .then((result: unknown) => {
        console.log('[Exec] Result:', result);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: 'Changes applied successfully.',
          timestamp: new Date()
        }]);
      })
      .catch((err: Error) => {
        console.error('[Exec] Error:', err);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `Error applying changes: ${err.message}`,
          timestamp: new Date()
        }]);
      });

    setPendingChange(null);
  }, [pendingChange, isWebviewReady]);

  // Reject pending code change
  const handleRejectChange = useCallback(() => {
    setPendingChange(null);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content: 'Changes rejected.',
      timestamp: new Date()
    }]);
  }, []);

  // Browser navigation functions - only use loadURL, don't change src attribute
  const navigateTo = useCallback((url: string) => {
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'http://' + finalUrl;
    }
    console.log('Navigating to:', finalUrl);
    setUrlInput(finalUrl);

    // Only use loadURL - don't update browserUrl state which changes src attribute
    if (webviewRef.current) {
      try {
        webviewRef.current.loadURL(finalUrl);
      } catch (e) {
        console.error('loadURL error:', e);
      }
    }
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
    onCodeUpdate: () => {} // No longer used for code updates
  });

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
        console.log('Did navigate:', webview.getURL());
        setUrlInput(webview.getURL());
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
          const data = args[0] as { element: SelectedElement };
          setScreenshotElement(data.element);
          setIsScreenshotActive(false);
        } else if (channel === 'console-log') {
          const data = args[0] as { level: string; message: string };
          const logEntry = `[${data.level.toUpperCase()}] ${data.message}`;
          setLogs(prev => [...prev.slice(-49), logEntry]);
        }
      };

      const handleDomReady = () => {
        console.log('Webview DOM ready');
        setIsWebviewReady(true);
      };

      webview.addEventListener('dom-ready', handleDomReady);
      webview.addEventListener('did-navigate', handleDidNavigate);
      webview.addEventListener('did-navigate-in-page', handleDidNavigate);
      webview.addEventListener('did-start-loading', handleDidStartLoading);
      webview.addEventListener('did-stop-loading', handleDidStopLoading);
      webview.addEventListener('did-fail-load', handleDidFailLoad as (e: unknown) => void);
      webview.addEventListener('page-title-updated', handlePageTitleUpdated as (e: unknown) => void);
      webview.addEventListener('ipc-message', handleIpcMessage as (e: unknown) => void);

      // Cleanup function
      return () => {
        webview.removeEventListener('dom-ready', handleDomReady);
        webview.removeEventListener('did-navigate', handleDidNavigate);
        webview.removeEventListener('did-navigate-in-page', handleDidNavigate);
        webview.removeEventListener('did-start-loading', handleDidStartLoading);
        webview.removeEventListener('did-stop-loading', handleDidStopLoading);
        webview.removeEventListener('did-fail-load', handleDidFailLoad as (e: unknown) => void);
        webview.removeEventListener('page-title-updated', handlePageTitleUpdated as (e: unknown) => void);
        webview.removeEventListener('ipc-message', handleIpcMessage as (e: unknown) => void);
      };
    }, 100);

    return () => {
      clearTimeout(timer);
      setIsWebviewReady(false);
    };
  }, [isElectron]);

  // Sync Inspector State with Webview
  useEffect(() => {
    if (!isElectron || !webviewRef.current || !isWebviewReady) return;

    const webview = webviewRef.current;
    console.log('Sending inspector modes to webview:', { isInspectorActive, isScreenshotActive });
    webview.send('set-inspector-mode', isInspectorActive);
    webview.send('set-screenshot-mode', isScreenshotActive);

    if (!isInspectorActive) {
      setSelectedElement(null);
    }
  }, [isInspectorActive, isScreenshotActive, isElectron, isWebviewReady]);

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

    const userMessage: Message = {
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

    let fullPromptText = `
Current Page: ${browserUrl}
${pageTitle ? `Page Title: ${pageTitle}` : ''}

User Request: ${userMessage.content}
${elementContext}
${screenshotElement ? `Context: User selected element for visual reference: <${screenshotElement.tagName}>` : ''}
    `;

    if (attachLogs && logs.length > 0) {
        fullPromptText += `\n\nRecent Console Logs:\n${logs.join('\n')}`;
    }

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
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("No API Key");
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: selectedModel.id,
        contents: contents
      });

      const text = response.text;
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
          timestamp: new Date()
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

          // Store for toolbar (undo/confirm/reject)
          setPendingChange({
            code: forwardCode,
            undoCode: undoCode || '',
            description: cleanedText || 'Change applied'
          });
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Sorry, I encountered an error processing that.",
        timestamp: new Date()
      }]);
    }
  };

  // Calculate popup position for webview
  const getPopupStyle = () => {
    if (!selectedElement || !selectedElement.x || !selectedElement.y || !webviewRef.current) return { display: 'none' };
    const webviewRect = webviewRef.current.getBoundingClientRect();
    const top = webviewRect.top + selectedElement.y + 10;
    const left = webviewRect.left + selectedElement.x;
    const clampedLeft = Math.min(Math.max(10, left), window.innerWidth - 320);
    const clampedTop = Math.min(Math.max(10, top), window.innerHeight - 150);
    return { top: `${clampedTop}px`, left: `${clampedLeft}px` };
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

  return (
    <div className={`flex h-screen w-full overflow-hidden font-sans p-2 gap-2 ${isDarkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-stone-200 text-neutral-900'}`}>

      {/* --- Left Pane: Browser --- */}
      <div className={`flex-1 flex flex-col relative h-full rounded-xl overflow-hidden shadow-sm ${isDarkMode ? 'bg-neutral-800' : 'bg-white'}`}>

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

          {/* URL Bar */}
          <form onSubmit={handleUrlSubmit} className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className={`w-full h-8 px-3 pr-8 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-neutral-100 placeholder-neutral-400' : 'bg-white border border-stone-200'}`}
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

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-neutral-700 text-yellow-400' : 'hover:bg-stone-200 text-stone-500'}`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {/* Browser Content */}
        <div className="flex-1 relative overflow-hidden">
          {isElectron && webviewPreloadPath ? (
            <webview
              ref={webviewRef as React.RefObject<HTMLElement>}
              src={browserUrl}
              preload={`file://${webviewPreloadPath}`}
              className="w-full h-full"
              // @ts-expect-error - webview is an Electron-specific element
              allowpopups="true"
              nodeintegration="true"
              webpreferences="contextIsolation=no"
            />
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
                        className={`flex items-center gap-2 px-4 h-10 rounded-full font-medium transition-all ${streamState.isConnected ? 'bg-red-50 text-red-600 ring-1 ring-red-100' : (isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-stone-900 text-white hover:bg-stone-800')}`}
                    >
                        {streamState.isConnected ? (
                            <>
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                                <span>End</span>
                            </>
                        ) : (
                            <>
                                <Mic size={16} />
                                <span>Speak</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Popup Chat when element selected and sidebar collapsed */}
            {!isSidebarOpen && selectedElement && (
                <div
                    className={`absolute z-50 rounded-xl shadow-2xl w-80 p-3 ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-stone-200'}`}
                    style={getPopupStyle()}
                >
                    <div className={`flex items-center gap-2 mb-2 text-xs ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                        <div className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-medium">
                            {selectedElement.tagName}
                        </div>
                        <span className="truncate max-w-[150px]">{selectedElement.text}</span>
                        <div className="flex-1"></div>
                        <button onClick={() => setSelectedElement(null)} className={isDarkMode ? 'hover:text-neutral-200' : 'hover:text-stone-900'}>
                            <X size={14} />
                        </button>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            processPrompt(popupInput);
                            setPopupInput('');
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
      </div>

      {/* --- Right Pane: Chat --- */}
      {isSidebarOpen && (
      <div className={`w-[420px] flex-shrink-0 flex flex-col rounded-xl shadow-sm ${isDarkMode ? 'bg-neutral-800' : 'bg-white'}`}>

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
                      className={`w-full text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 ${isDarkMode ? 'bg-neutral-700 border border-neutral-600 text-neutral-200 placeholder-neutral-500 focus:ring-neutral-500' : 'bg-stone-50 border border-stone-200 text-stone-600 placeholder-stone-400 focus:ring-stone-300'}`}
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

                  {/* Collapse */}
                  <button
                      onClick={() => setIsSidebarOpen(false)}
                      className={`p-1.5 rounded transition ml-1 ${isDarkMode ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-600'}`}
                      title="Collapse sidebar"
                  >
                      <PanelRight size={14} />
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
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && (
                          <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-100'}`}>
                              ✨
                          </div>
                      )}
                      <div className={`max-w-[85%] text-sm leading-relaxed px-3 py-2 rounded-2xl ${
                          msg.role === 'user'
                              ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-stone-900 text-white')
                              : (isDarkMode ? 'bg-neutral-700 text-neutral-200' : 'bg-stone-50 text-stone-700')
                      }`}>
                          {msg.content}
                      </div>
                  </div>
              ))}
              <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className={`p-4 border-t ${isDarkMode ? 'border-neutral-700' : 'border-stone-100'}`} style={{ overflow: 'visible' }}>
              <div className={`rounded-2xl border ${isDarkMode ? 'bg-neutral-700 border-neutral-600' : 'bg-stone-50 border-stone-200'}`} style={{ overflow: 'visible' }}>
                  {/* Selection Chips */}
                  {(selectedElement || screenshotElement || attachLogs) && (
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
                          {selectedElement && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs border border-blue-200">
                                  <Check size={12} />
                                  <span className="font-medium">{selectedElement.tagName.toLowerCase()}</span>
                                  <span className="text-blue-500 truncate max-w-[120px]">{selectedElement.text || '(element)'}</span>
                                  <button
                                      onClick={() => setSelectedElement(null)}
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
                                      onClick={() => setScreenshotElement(null)}
                                      className="ml-0.5 hover:text-purple-900"
                                  >
                                      <X size={12} />
                                  </button>
                              </div>
                          )}
                      </div>
                  )}

                  <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              processPrompt(input);
                          }
                      }}
                      placeholder="Plan, @ for context, / for commands"
                      className={`w-full bg-transparent px-4 py-3 text-sm resize-none focus:outline-none min-h-[56px] ${isDarkMode ? 'text-neutral-100 placeholder-neutral-400' : ''}`}
                      rows={2}
                  />

                  {/* Input Toolbar */}
                  <div className={`flex items-center justify-between px-3 py-2 border-t ${isDarkMode ? 'border-neutral-600' : 'border-stone-100'}`}>
                      <div className="flex items-center gap-1">
                          {/* Agent Selector */}
                          <div className="relative">
                              <button
                                  onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition ${isDarkMode ? 'border-neutral-600 hover:bg-neutral-600 text-neutral-200 bg-neutral-700' : 'border-stone-200 hover:bg-stone-50 text-stone-700 bg-white'}`}
                              >
                                  <Box size={16} />
                                  <span>Cursor</span>
                                  <ChevronDown size={12} className={isDarkMode ? 'text-neutral-400' : 'text-stone-400'} />
                              </button>

                              {isModelMenuOpen && (
                                  <>
                                      <div className="fixed inset-0 z-[99]" onClick={() => setIsModelMenuOpen(false)}></div>
                                      <div className={`absolute bottom-full left-0 mb-2 w-52 rounded-xl shadow-xl py-1 z-[100] ${isDarkMode ? 'bg-neutral-700 border border-neutral-600' : 'bg-white border border-stone-200'}`}>
                                          {MODELS.map(model => (
                                              <button
                                                  key={model.id}
                                                  onClick={() => { setSelectedModel(model); setIsModelMenuOpen(false); }}
                                                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 ${isDarkMode ? 'hover:bg-neutral-600 text-neutral-200' : 'hover:bg-stone-50'}`}
                                              >
                                                  <model.Icon size={16} className={isDarkMode ? 'text-neutral-400' : 'text-stone-500'} />
                                                  <span className={selectedModel.id === model.id ? 'font-medium' : ''}>{model.name}</span>
                                                  {selectedModel.id === model.id && (
                                                      <Check size={14} className="ml-auto text-blue-600" />
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

      {/* Expand Sidebar Button */}
      {!isSidebarOpen && (
          <button
              onClick={() => setIsSidebarOpen(true)}
              className={`absolute right-4 top-4 p-2 rounded-lg shadow-sm transition z-50 ${isDarkMode ? 'bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200' : 'bg-white border border-stone-200 hover:bg-stone-50 text-stone-500 hover:text-stone-700'}`}
              title="Open sidebar"
          >
              <PanelLeft size={16} />
          </button>
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

      {/* Pending Code Change Preview - 3 Button Popup */}
      {pendingChange && (
          <div className={`absolute bottom-24 left-1/2 transform -translate-x-1/2 flex items-center gap-2 rounded-full shadow-xl p-2 z-50 ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
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

      {/* Hidden Media Elements */}
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

    </div>
  );
}

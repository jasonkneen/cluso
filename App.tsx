
import React, { useRef, useState, useEffect } from 'react';
import { useLiveGemini } from './hooks/useLiveGemini';
import { INJECTION_SCRIPT } from './utils/iframe-injection';
import { SelectedElement, Message } from './types';
import { GoogleGenAI } from '@google/genai';

// --- Constants ---

const MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: '⚡' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', icon: '✨' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', icon: '🚀' },
];

const DEFAULT_CODE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inspector</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white min-h-screen flex flex-col items-center justify-center">
    <div class="text-center">
        <div class="flex items-center justify-center gap-3 mb-8">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
            </svg>
            <span class="text-4xl font-bold tracking-tight">Inspector</span>
        </div>
        <div class="max-w-md mx-auto">
            <div class="bg-neutral-100 rounded-xl px-4 py-3 flex items-center gap-2 text-neutral-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <span>localhost:3000</span>
            </div>
        </div>
    </div>
</body>
</html>
`;

export default function App() {
  const [htmlCode, setHtmlCode] = useState(DEFAULT_CODE);

  // Review Mode State
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [originalCode, setOriginalCode] = useState<string | null>(null);
  const [isPreviewingOriginal, setIsPreviewingOriginal] = useState(false);

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

  // Refs for Live API
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Code Update Callback (Called by Live API tool use)
  const handleCodeUpdate = (newCode: string) => {
    setOriginalCode(htmlCode);
    setPendingCode(newCode);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: 'I have prepared some changes. Please review them.',
      timestamp: new Date()
    }]);
  };

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
    onCodeUpdate: handleCodeUpdate
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

  // Sync Inspector State with Iframe
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
            type: 'TOGGLE_INSPECTOR',
            active: isInspectorActive
        }, '*');

        iframeRef.current.contentWindow.postMessage({
            type: 'TOGGLE_SCREENSHOT',
            active: isScreenshotActive
        }, '*');
    }

    if (!isInspectorActive) {
        setSelectedElement(null);
    }
  }, [isInspectorActive, isScreenshotActive]);

  // Handle iframe messages (element selection & logs)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'INSPECTOR_SELECT') {
        const el = event.data.element;
        setSelectedElement({
            ...el,
            x: event.data.x,
            y: event.data.y,
            rect: event.data.rect
        });
      }
      else if (event.data.type === 'SCREENSHOT_SELECT') {
         const el = event.data.element;
         setScreenshotElement(el);
         setIsScreenshotActive(false);
      }
      else if (event.data.type === 'CONSOLE_LOG') {
          const logEntry = `[${event.data.level.toUpperCase()}] ${event.data.message}`;
          setLogs(prev => [...prev.slice(-49), logEntry]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

    const contents: any[] = [];

    let fullPromptText = `
        Current HTML Code:
        \`\`\`html
        ${pendingCode || htmlCode}
        \`\`\`

        User Request: ${userMessage.content}
        ${selectedElement ? `Context: User selected element: <${selectedElement.tagName}> with text "${selectedElement.text}"` : ''}
        ${screenshotElement ? `Context: User selected element for visual reference: <${screenshotElement.tagName}>` : ''}
    `;

    if (attachLogs && logs.length > 0) {
        fullPromptText += `\n\nRecent Console Logs:\n${logs.join('\n')}`;
    }

    fullPromptText += `
        Instructions:
        You are an expert UI engineer.
        Return the FULL updated HTML code to satisfy the user request.
        Do not explain. Just provide the code block.
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
        const match = text.match(/```html([\s\S]*?)```/) || text.match(/```([\s\S]*?)```/);
        const newCode = match ? match[1].trim() : text;

        if (newCode.includes('<html')) {
            handleCodeUpdate(newCode);
        } else {
             setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: text,
                timestamp: new Date()
            }]);
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

  const handleApplyChanges = () => {
    if (pendingCode) {
        setHtmlCode(pendingCode);
        setPendingCode(null);
        setOriginalCode(null);
        setSelectedElement(null);
        setIsInspectorActive(false);
    }
  };

  const handleDiscardChanges = () => {
    setPendingCode(null);
    setOriginalCode(null);
  };

  const displayCode = isPreviewingOriginal ? (originalCode || htmlCode) : (pendingCode || htmlCode);

  // Calculate popup position
  const getPopupStyle = () => {
    if (!selectedElement || !selectedElement.x || !selectedElement.y || !iframeRef.current) return { display: 'none' };
    const iframeRect = iframeRef.current.getBoundingClientRect();
    const top = iframeRect.top + selectedElement.y + 10;
    const left = iframeRect.left + selectedElement.x;
    const clampedLeft = Math.min(Math.max(10, left), window.innerWidth - 320);
    const clampedTop = Math.min(Math.max(10, top), window.innerHeight - 150);
    return { top: `${clampedTop}px`, left: `${clampedLeft}px` };
  };

  return (
    <div className="flex h-screen w-full bg-stone-200 overflow-hidden font-sans text-neutral-900 p-2 gap-2">

      {/* --- Left Pane: Preview --- */}
      <div className="flex-1 flex flex-col relative h-full bg-gradient-to-br from-stone-100 via-stone-50 to-amber-50/30 rounded-xl overflow-hidden shadow-sm">

        {/* Preview Content */}
        <div className="flex-1 relative overflow-hidden">
             <iframe
                ref={iframeRef}
                title="preview"
                srcDoc={`${displayCode}${INJECTION_SCRIPT}`}
                className="w-full h-full border-none bg-white rounded-xl"
                sandbox="allow-scripts allow-modals allow-same-origin"
             />

            {pendingCode && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white rounded-full shadow-xl border border-stone-200 p-2 z-50">
                     <button
                        onMouseDown={() => setIsPreviewingOriginal(true)}
                        onMouseUp={() => setIsPreviewingOriginal(false)}
                        onMouseLeave={() => setIsPreviewingOriginal(false)}
                        className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-600 transition-colors"
                        title="Hold to see original"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                     </button>
                     <div className="w-[1px] h-5 bg-stone-200"></div>
                     <button
                        onClick={handleDiscardChanges}
                        className="w-9 h-9 rounded-full hover:bg-red-50 text-stone-600 hover:text-red-600 flex items-center justify-center transition-colors"
                        title="Discard"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                     </button>
                     <button
                        onClick={handleApplyChanges}
                        className="w-9 h-9 rounded-full bg-stone-900 text-white hover:bg-stone-800 flex items-center justify-center shadow-md transition-colors"
                        title="Apply"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                     </button>
                </div>
            )}

            {/* Floating Toolbar when sidebar collapsed */}
            {!isSidebarOpen && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur shadow-2xl border border-stone-200/50 p-2 rounded-full z-40">
                    <button
                        onClick={() => setIsScreenSharing(!isScreenSharing)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-green-100 text-green-600' : 'hover:bg-stone-100 text-stone-500'}`}
                        title="Toggle Screen Share"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    </button>

                    <button
                        onClick={() => {
                            setIsInspectorActive(!isInspectorActive);
                            setIsScreenshotActive(false);
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isInspectorActive ? 'bg-blue-100 text-blue-600' : 'hover:bg-stone-100 text-stone-500'}`}
                        title="Toggle Element Inspector"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
                    </button>

                    <div className="w-[1px] h-6 bg-stone-200 mx-1"></div>

                    <button
                        onClick={streamState.isConnected ? disconnect : connect}
                        className={`flex items-center gap-2 px-4 h-10 rounded-full font-medium transition-all ${streamState.isConnected ? 'bg-red-50 text-red-600 ring-1 ring-red-100' : 'bg-stone-900 text-white hover:bg-stone-800'}`}
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
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                                <span>Speak</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Popup Chat when element selected and sidebar collapsed */}
            {!isSidebarOpen && selectedElement && (
                <div
                    className="absolute z-50 bg-white rounded-xl shadow-2xl border border-stone-200 w-80 p-3"
                    style={getPopupStyle()}
                >
                    <div className="flex items-center gap-2 mb-2 text-xs text-stone-500">
                        <div className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-medium">
                            {selectedElement.tagName}
                        </div>
                        <span className="truncate max-w-[150px]">{selectedElement.text}</span>
                        <div className="flex-1"></div>
                        <button onClick={() => setSelectedElement(null)} className="hover:text-stone-900">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
                            className="w-full text-sm p-2 bg-stone-50 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
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
                            <button type="submit" disabled={!popupInput.trim()} className="bg-stone-900 text-white w-7 h-7 rounded-full flex items-center justify-center hover:bg-stone-700 disabled:opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
      </div>

      {/* --- Right Pane: Chat --- */}
      {isSidebarOpen && (
      <div className="w-[420px] flex-shrink-0 bg-white flex flex-col rounded-xl overflow-hidden shadow-sm">

          {/* Right Header */}
          <div className="h-12 border-b border-stone-100 flex items-center justify-between px-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-sm text-stone-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/></svg>
                      <span>main</span>
                  </div>
                  <button className="p-1 hover:bg-stone-100 rounded text-stone-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  </button>
              </div>

              <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">⌘⏎ to send</span>
                  <button
                      onClick={() => setIsSidebarOpen(false)}
                      className="p-1.5 hover:bg-stone-100 rounded text-stone-400 hover:text-stone-600 transition"
                      title="Collapse sidebar"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/></svg>
                  </button>
              </div>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                  <div className="h-full flex items-center justify-center text-stone-300 text-sm">
                      Start a conversation...
                  </div>
              )}
              {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && (
                          <div className="w-7 h-7 rounded-full bg-stone-100 flex-shrink-0 flex items-center justify-center text-xs">
                              ✨
                          </div>
                      )}
                      <div className={`max-w-[85%] text-sm leading-relaxed px-3 py-2 rounded-2xl ${
                          msg.role === 'user'
                              ? 'bg-stone-900 text-white'
                              : 'bg-stone-50 text-stone-700'
                      }`}>
                          {msg.content}
                      </div>
                  </div>
              ))}
              <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-stone-100">
              <div className="bg-stone-50 rounded-2xl border border-stone-200 overflow-hidden">
                  {/* Selection Chips */}
                  {(selectedElement || screenshotElement || attachLogs) && (
                      <div className="px-3 pt-3 flex flex-wrap gap-2">
                          {attachLogs && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-xs border border-yellow-200">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m10 8-2 2 2 2"/><path d="m14 8 2 2-2 2"/></svg>
                                  <span className="font-medium">Console Logs</span>
                                  <button
                                      onClick={() => setAttachLogs(false)}
                                      className="ml-0.5 hover:text-yellow-900"
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                  </button>
                              </div>
                          )}
                          {selectedElement && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs border border-blue-200">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 2 2 4-4"/></svg>
                                  <span className="font-medium">{selectedElement.tagName.toLowerCase()}</span>
                                  <span className="text-blue-500 truncate max-w-[120px]">{selectedElement.text || '(element)'}</span>
                                  <button
                                      onClick={() => setSelectedElement(null)}
                                      className="ml-0.5 hover:text-blue-900"
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                  </button>
                              </div>
                          )}
                          {screenshotElement && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs border border-purple-200">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                  <span className="font-medium">{screenshotElement.tagName.toLowerCase()}</span>
                                  <button
                                      onClick={() => setScreenshotElement(null)}
                                      className="ml-0.5 hover:text-purple-900"
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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
                      className="w-full bg-transparent px-4 py-3 text-sm resize-none focus:outline-none min-h-[80px]"
                      rows={3}
                  />

                  {/* Input Toolbar */}
                  <div className="flex items-center justify-between px-3 py-2 border-t border-stone-100">
                      <div className="flex items-center gap-1">
                          {/* Agent Selector */}
                          <div className="relative">
                              <button
                                  onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 transition bg-white"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                                  <span>Cursor</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400"><path d="m6 9 6 6 6-6"/></svg>
                              </button>

                              {isModelMenuOpen && (
                                  <>
                                      <div className="fixed inset-0 z-10" onClick={() => setIsModelMenuOpen(false)}></div>
                                      <div className="absolute bottom-full left-0 mb-1 w-52 bg-white border border-stone-200 rounded-xl shadow-xl py-1 z-50">
                                          {MODELS.map(model => (
                                              <button
                                                  key={model.id}
                                                  onClick={() => { setSelectedModel(model); setIsModelMenuOpen(false); }}
                                                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-stone-50 flex items-center gap-2"
                                              >
                                                  <span>{model.icon}</span>
                                                  <span className={selectedModel.id === model.id ? 'font-medium' : ''}>{model.name}</span>
                                                  {selectedModel.id === model.id && (
                                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-blue-600"><polyline points="20 6 9 17 4 12"/></svg>
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
                              className={`p-2 rounded-lg transition-colors ${isInspectorActive ? 'bg-blue-100 text-blue-600' : 'hover:bg-stone-100 text-stone-400'}`}
                              title="Select Element"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
                          </button>

                          {/* Console Logs */}
                          <button
                              onClick={() => setAttachLogs(!attachLogs)}
                              className={`p-2 rounded-lg transition-colors ${attachLogs ? 'bg-yellow-100 text-yellow-600' : 'hover:bg-stone-100 text-stone-400'}`}
                              title="Attach Console Logs"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m10 8-2 2 2 2"/><path d="m14 8 2 2-2 2"/></svg>
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
                              className={`p-2 rounded-lg transition-colors ${isScreenshotActive ? 'bg-purple-100 text-purple-600' : 'hover:bg-stone-100 text-stone-400'}`}
                              title="Screenshot Element"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          </button>

                          {/* Send */}
                          <button
                              onClick={() => processPrompt(input)}
                              disabled={!input.trim()}
                              className="p-1.5 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors ml-1"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
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
              className="absolute right-4 top-4 p-2 bg-white border border-stone-200 rounded-lg shadow-sm hover:bg-stone-50 text-stone-500 hover:text-stone-700 transition z-50"
              title="Open sidebar"
          >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
          </button>
      )}

      {/* Hidden Media Elements */}
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

    </div>
  );
}

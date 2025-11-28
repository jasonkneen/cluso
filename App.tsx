
import React, { useRef, useState, useEffect } from 'react';
import { useLiveGemini } from './hooks/useLiveGemini';
import { INJECTION_SCRIPT } from './utils/iframe-injection';
import { SelectedElement, Message } from './types';
import { GoogleGenAI } from '@google/genai';

// --- Constants ---

const AGENTS = [
  { id: 'gemini-3-pro', name: 'Gemini 3.0 Pro', icon: '✨', color: 'bg-indigo-50 text-indigo-700' },
  { id: 'gemini-2.5', name: 'Gemini 2.5', icon: '⚡', color: 'bg-blue-50 text-blue-600' },
  { id: 'claude', name: 'Claude Code', icon: 'eh', color: 'bg-orange-50 text-orange-700' },
  { id: 'cursor', name: 'Cursor', icon: '↗️', color: 'bg-neutral-100 text-neutral-700' },
  { id: 'cline', name: 'Cline', icon: '🤖', color: 'bg-purple-50 text-purple-700' },
  { id: 'codex', name: 'Codex', icon: '👾', color: 'bg-green-50 text-green-700' },
  { id: 'opencode', name: 'OpenCode', icon: '🔓', color: 'bg-teal-50 text-teal-700' },
];

const DEFAULT_CODE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inspector</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      console.log("Welcome to Inspector Preview");
    </script>
</head>
<body class="bg-white text-gray-900 font-sans antialiased">
    <div class="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
        
        <nav class="absolute top-0 w-full p-6 flex justify-between items-center z-10">
            <div class="flex items-center gap-2">
                <div class="w-6 h-6 bg-black rounded-full flex items-center justify-center text-white font-bold text-xs">I</div>
                <span class="font-bold text-lg tracking-tight">Inspector</span>
            </div>
            <button class="bg-black text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-gray-800 transition" onclick="console.log('Join Waitlist clicked')">Join Waitlist</button>
        </nav>

        <div class="text-center max-w-3xl px-6 relative z-10 mt-[-50px]">
            <h1 class="text-6xl md:text-8xl font-bold tracking-tighter mb-6 leading-tight">
                The AI IDE for <br>
                <span class="text-gray-400">front-end development</span>
            </h1>
            <p class="text-xl text-gray-500 mb-10 max-w-xl mx-auto">
                Inspector allows you to iterate on your UI at the speed of thought. 
                Use your favorite AI agents directly in the browser.
            </p>

            <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
                <div class="relative group">
                    <div class="absolute -inset-1 bg-gradient-to-r from-blue-200 to-purple-200 rounded-lg blur opacity-50 group-hover:opacity-100 transition duration-1000"></div>
                    <div class="relative flex items-center bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm">
                        <span class="pl-4 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        </span>
                        <input type="email" placeholder="Enter your email..." class="pl-3 pr-4 py-2 outline-none w-64 text-sm" />
                        <button class="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800 transition" onclick="console.log('Join clicked')">Join Waitlist</button>
                    </div>
                </div>
            </div>
            
            <div class="mt-8 flex items-center justify-center gap-4 text-xs text-gray-400">
                <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> Early access open</span>
                <span>•</span>
                <span>No credit card required</span>
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

  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Hello! I can help you edit this page. Click the cursor icon to select elements, then tell me what to change.', timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  
  // Selection States
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [screenshotElement, setScreenshotElement] = useState<SelectedElement | null>(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Inspector & Context State
  const [isInspectorActive, setIsInspectorActive] = useState(false);
  const [isScreenshotActive, setIsScreenshotActive] = useState(false);
  
  const [logs, setLogs] = useState<string[]>([]);
  const [attachLogs, setAttachLogs] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Popup Input State
  const [popupInput, setPopupInput] = useState('');

  // Agent State
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);

  // Refs for Live API
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Code Update Callback (Called by Live API tool use)
  const handleCodeUpdate = (newCode: string) => {
    // Enter Review Mode
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
        // Code Inspector
        iframeRef.current.contentWindow.postMessage({
            type: 'TOGGLE_INSPECTOR',
            active: isInspectorActive
        }, '*');
        
        // Screenshot Mode
        iframeRef.current.contentWindow.postMessage({
            type: 'TOGGLE_SCREENSHOT',
            active: isScreenshotActive
        }, '*');
    }
    
    // Clear selections if modes are turned off
    if (!isInspectorActive) {
        setSelectedElement(null);
    }
    if (!isScreenshotActive) {
        // We don't necessarily clear the screenshot element immediately to allow keeping it as context
        // but if we toggle off, we might want to reset user expectation. 
        // For now, let's keep it until sent or cleared manually.
    }
  }, [isInspectorActive, isScreenshotActive]);

  // Handle iframe messages (element selection & logs)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Code Inspector Selection
      if (event.data.type === 'INSPECTOR_SELECT') {
        const el = event.data.element;
        setSelectedElement({
            ...el,
            x: event.data.x,
            y: event.data.y,
            rect: event.data.rect
        });
        if (!isSidebarOpen) setPopupInput('');
      }
      // Screenshot Selection
      else if (event.data.type === 'SCREENSHOT_SELECT') {
         const el = event.data.element;
         setScreenshotElement(el);
         setIsScreenshotActive(false); // Auto-exit mode after capture
      }
      // Console Logs
      else if (event.data.type === 'CONSOLE_LOG') {
          const logEntry = `[${event.data.level.toUpperCase()}] ${event.data.message}`;
          setLogs(prev => [...prev.slice(-49), logEntry]); // Keep last 50
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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

  // Handle Text Submission (Shared logic)
  const processPrompt = async (promptText: string, source: 'sidebar' | 'popup') => {
    if (!promptText.trim() && !selectedElement && !attachedImage && !screenshotElement) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText,
      timestamp: new Date(),
      selectedElement: selectedElement || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Clear inputs
    if (source === 'sidebar') setInput('');
    if (source === 'popup') setPopupInput('');
    
    // Prepare Multimodal Contents
    const contents: any[] = [];

    // 1. Text Prompt construction
    let fullPromptText = `
        Current HTML Code:
        \`\`\`html
        ${pendingCode || htmlCode}
        \`\`\`

        User Request: ${userMessage.content}
        ${selectedElement ? `Context: User selected element for CODE editing: <${selectedElement.tagName}> with text "${selectedElement.text}"` : ''}
        ${screenshotElement ? `Context: User selected element for VISUAL reference: <${screenshotElement.tagName}>. Treat this as if the user sent a screenshot of this element.` : ''}
    `;

    // 2. Add Logs if attached
    if (attachLogs && logs.length > 0) {
        fullPromptText += `\n\nRecent Console Logs:\n${logs.join('\n')}`;
    }

    fullPromptText += `
        Instructions:
        You are ${selectedAgent.name}, an expert UI engineer. 
        Return the FULL updated HTML code to satisfy the user request.
        Do not explain. Just provide the code block.
    `;

    // 3. Add Image if attached (Multimodal)
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

    // Reset attachments
    setAttachLogs(false);
    setAttachedImage(null);
    setScreenshotElement(null); // Clear screenshot after sending
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("No API Key");
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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

  // Helper to render message content with code blocks
  const renderMessageContent = (content: string) => {
    const parts = content.split(/```(\w+)?\n([\s\S]*?)```/g);
    
    if (parts.length === 1) return <div className="whitespace-pre-wrap">{content}</div>;

    const elements = [];
    for (let i = 0; i < parts.length; i += 3) {
        const text = parts[i];
        const lang = parts[i+1];
        const code = parts[i+2];

        if (text) elements.push(<div key={`text-${i}`} className="whitespace-pre-wrap mb-2">{text}</div>);
        if (code) {
            elements.push(
                <div key={`code-${i}`} className="my-2 rounded-lg overflow-hidden border border-neutral-800 bg-[#1e1e1e] text-[#d4d4d4] shadow-md text-xs font-mono group relative">
                     <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-black/20 text-[10px] text-neutral-400 uppercase tracking-wider select-none">
                        <span className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                            {lang || 'code'}
                        </span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] bg-white/10 px-1.5 py-0.5 rounded">RIGHT CLICK TO COPY</div>
                     </div>
                     <div className="p-3 overflow-x-auto">
                        {code.split('\n').map((line, idx) => {
                            let className = "px-1 border-l-2 border-transparent";
                            if (line.startsWith('+')) className = "px-1 bg-green-500/10 text-green-300 border-l-2 border-green-500 block w-full";
                            else if (line.startsWith('-')) className = "px-1 bg-red-500/10 text-red-300 border-l-2 border-red-500 block w-full";
                            
                            return <div key={idx} className={className}>{line}</div>
                        })}
                     </div>
                </div>
            );
        }
    }
    return elements;
  };

  // Get current active code for display
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
    <div className="flex h-screen w-full bg-neutral-100 overflow-hidden font-sans text-neutral-900">
      
      {/* --- Left Pane: Web Preview --- */}
      <div className={`flex-1 flex flex-col relative h-full bg-white transition-all duration-300 ease-in-out ${isSidebarOpen ? '' : 'w-full'}`}>
        
        {/* Browser Chrome */}
        <div className="h-12 bg-white border-b border-neutral-200 flex items-center px-4 gap-4 flex-shrink-0 justify-between">
            <div className="flex items-center gap-4 flex-1">
                <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                </div>
                
                <div className="max-w-xl">
                    <div className="bg-neutral-100 rounded-md px-3 py-1.5 flex items-center gap-2 text-sm text-neutral-500 font-mono group transition-colors hover:bg-neutral-50">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5 10 10 0 0 0 10 10Z"/><path d="m9 22 3-9 3 9"/><path d="m9 22 3-9 3 9"/></svg>
                        <span>localhost:3000</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 text-neutral-400">
                 {!isSidebarOpen && (
                    <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 hover:bg-neutral-100 rounded-md transition text-neutral-600"
                        title="Open Sidebar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                    </button>
                 )}
            </div>
        </div>

        {/* Iframe Preview */}
        <div className="flex-1 relative bg-neutral-50 overflow-hidden">
             <iframe
                ref={iframeRef}
                title="preview"
                srcDoc={`${displayCode}${INJECTION_SCRIPT}`}
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-modals allow-same-origin"
             />
             
            {pendingCode && (
                <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white rounded-full shadow-xl border border-neutral-200 p-2 z-50 animate-in fade-in slide-in-from-bottom-4">
                     <button 
                        onMouseDown={() => setIsPreviewingOriginal(true)}
                        onMouseUp={() => setIsPreviewingOriginal(false)}
                        onMouseLeave={() => setIsPreviewingOriginal(false)}
                        className="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition-colors"
                        title="Hold to see original"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                     </button>
                     <div className="w-[1px] h-6 bg-neutral-200"></div>
                     <button 
                        onClick={handleDiscardChanges}
                        className="w-10 h-10 rounded-full hover:bg-red-50 text-neutral-600 hover:text-red-600 flex items-center justify-center transition-colors"
                        title="Discard changes"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                     </button>
                     <button 
                        onClick={handleApplyChanges}
                        className="w-10 h-10 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 flex items-center justify-center shadow-md transition-colors"
                        title="Apply changes"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                     </button>
                </div>
            )}

             {!isSidebarOpen && selectedElement && (
                <div 
                    className="absolute z-50 bg-white rounded-xl shadow-2xl border border-neutral-200 w-80 p-3 animate-in zoom-in-95 duration-200 origin-top-left"
                    style={getPopupStyle()}
                >
                    <div className="flex items-center gap-2 mb-2 text-xs text-neutral-500">
                        <div className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-medium">
                            {selectedElement.tagName}
                        </div>
                        <span className="truncate max-w-[150px]">{selectedElement.text}</span>
                        <div className="flex-1"></div>
                        <button onClick={() => setSelectedElement(null)} className="hover:text-neutral-900">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    
                    <form 
                        onSubmit={(e) => {
                            e.preventDefault();
                            processPrompt(popupInput, 'popup');
                        }}
                    >
                        <textarea
                            value={popupInput}
                            onChange={(e) => setPopupInput(e.target.value)}
                            placeholder="What would you like to change?"
                            className="w-full text-sm p-2 bg-neutral-50 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                            rows={2}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    processPrompt(popupInput, 'popup');
                                }
                            }}
                        />
                        <div className="flex justify-between items-center mt-2">
                             <div className="flex gap-1">
                                <button type="button" className="p-1 hover:bg-neutral-100 rounded text-neutral-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                                </button>
                             </div>
                             <button type="submit" disabled={!popupInput.trim()} className="bg-neutral-900 text-white w-7 h-7 rounded-full flex items-center justify-center hover:bg-neutral-700 disabled:opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                             </button>
                        </div>
                    </form>
                </div>
             )}

             {!isSidebarOpen && (
                 <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur shadow-2xl border border-neutral-200/50 p-2 rounded-full z-40 animate-in slide-in-from-bottom-8">
                     <button 
                        onClick={() => setIsScreenSharing(!isScreenSharing)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-green-100 text-green-600' : 'hover:bg-neutral-100 text-neutral-500'}`}
                        title="Toggle Screen Share"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                     </button>

                     <button 
                        onClick={() => {
                            setIsInspectorActive(!isInspectorActive);
                            setIsScreenshotActive(false);
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isInspectorActive ? 'bg-blue-100 text-blue-600' : 'hover:bg-neutral-100 text-neutral-500'}`}
                        title="Toggle Element Inspector"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
                     </button>
                     
                     <div className="w-[1px] h-6 bg-neutral-200 mx-1"></div>

                     <button 
                        onClick={streamState.isConnected ? disconnect : connect}
                        className={`flex items-center gap-2 px-4 h-10 rounded-full font-medium transition-all ${streamState.isConnected ? 'bg-red-50 text-red-600 ring-1 ring-red-100' : 'bg-neutral-900 text-white hover:bg-neutral-800'}`}
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
        </div>
      </div>


      {/* --- Right Pane: Chat Interface --- */}
      {isSidebarOpen && (
        <div className={`w-[400px] flex-shrink-0 border-l border-neutral-200 bg-white flex flex-col transition-all duration-300`}>
            
            {/* Chat Header with Agent Selector */}
            <div className="h-14 border-b border-neutral-100 flex items-center justify-between px-4 flex-shrink-0 bg-white/80 backdrop-blur z-20">
                <div className="relative">
                    <button
                        onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                        className="flex items-center gap-2 text-sm font-medium hover:bg-neutral-50 px-2 py-1.5 rounded-lg transition-colors border border-transparent hover:border-neutral-200"
                    >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${selectedAgent.color}`}>
                            {selectedAgent.icon === 'eh' ? '🤖' : selectedAgent.icon}
                        </div>
                        <span className="text-neutral-700">{selectedAgent.name}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400"><path d="m6 9 6 6 6-6"/></svg>
                    </button>

                    {isAgentMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsAgentMenuOpen(false)}></div>
                            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-neutral-200 rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                                {AGENTS.map(agent => (
                                    <button
                                        key={agent.id}
                                        onClick={() => { setSelectedAgent(agent); setIsAgentMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-neutral-50 flex items-center gap-2.5 transition-colors"
                                    >
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${agent.color}`}>
                                            {agent.icon === 'eh' ? '🤖' : agent.icon}
                                        </div>
                                        <span className={selectedAgent.id === agent.id ? 'font-medium text-neutral-900' : 'text-neutral-600'}>{agent.name}</span>
                                        {selectedAgent.id === agent.id && (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-blue-600"><polyline points="20 6 9 17 4 12"/></svg>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {streamState.isConnected && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">
                            <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                            Live
                        </div>
                    )}
                    <button 
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1.5 hover:bg-neutral-100 rounded-md text-neutral-400 hover:text-neutral-600 transition"
                        title="Close Sidebar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                    </button>
                </div>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${msg.role === 'user' ? 'bg-neutral-900 text-white' : 'bg-blue-100 text-blue-700'}`}>
                            {msg.role === 'user' ? 'U' : 'AI'}
                        </div>
                        <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {msg.selectedElement && (
                                <div className="flex items-center gap-1.5 text-xs bg-neutral-100 border border-neutral-200 px-2 py-1 rounded text-neutral-500 mb-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                    Selected: <span className="font-mono text-neutral-800">{msg.selectedElement.tagName.toLowerCase()}</span>
                                </div>
                            )}
                            <div className={`text-sm leading-relaxed px-3 py-2 rounded-lg ${msg.role === 'user' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 w-full'}`}>
                                {renderMessageContent(msg.content)}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Current Selection Indicators */}
            <div className="flex flex-col">
                {selectedElement && (
                    <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between text-xs text-blue-700">
                        <div className="flex items-center gap-2 truncate">
                            <span className="font-semibold">Selected (Code):</span>
                            <code className="bg-blue-100/50 px-1 py-0.5 rounded text-blue-800 font-mono">{selectedElement.tagName.toLowerCase()}</code>
                            <span className="truncate opacity-75">{selectedElement.text}</span>
                        </div>
                        <button onClick={() => setSelectedElement(null)} className="hover:text-blue-900">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                )}
                
                {screenshotElement && (
                     <div className="px-4 py-2 bg-purple-50 border-t border-purple-100 flex items-center justify-between text-xs text-purple-700">
                        <div className="flex items-center gap-2 truncate">
                            <span className="font-semibold flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                Captured Visual:
                            </span>
                            <code className="bg-purple-100/50 px-1 py-0.5 rounded text-purple-800 font-mono">{screenshotElement.tagName.toLowerCase()}</code>
                        </div>
                        <button onClick={() => setScreenshotElement(null)} className="hover:text-purple-900">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                )}
            </div>
            
            {/* Attachment Preview Indicator */}
            {(attachLogs || attachedImage) && (
                <div className="px-4 py-2 border-t border-neutral-100 flex items-center gap-2 overflow-x-auto">
                    {attachLogs && (
                        <div className="flex items-center gap-1 text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full border border-yellow-100 whitespace-nowrap">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
                            Console Logs ({logs.length})
                            <button onClick={() => setAttachLogs(false)} className="ml-1 hover:text-yellow-900"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                        </div>
                    )}
                    {attachedImage && (
                        <div className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full border border-purple-100 whitespace-nowrap">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                            Image Attached
                             <button onClick={() => setAttachedImage(null)} className="ml-1 hover:text-purple-900"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                        </div>
                    )}
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-neutral-200 bg-white">
                <form onSubmit={(e) => { e.preventDefault(); processPrompt(input, 'sidebar'); }} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={selectedElement ? "Ask to change this element..." : "Ask for a change..."}
                        className="w-full bg-white border border-neutral-200 rounded-xl pl-4 pr-32 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/5 focus:border-neutral-300 shadow-sm transition-all"
                    />
                    
                    {/* Toolbar inside Input */}
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                        
                         {/* Cursor / Select Button */}
                        <button 
                            type="button"
                            onClick={() => {
                                setIsInspectorActive(!isInspectorActive);
                                setIsScreenshotActive(false);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${isInspectorActive ? 'bg-blue-100 text-blue-600' : 'hover:bg-neutral-100 text-neutral-400'}`}
                            title="Inspect Element (Code)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
                        </button>
                        
                        {/* Logs Button */}
                        <button 
                            type="button"
                            onClick={() => setAttachLogs(!attachLogs)}
                            className={`p-1.5 rounded-lg transition-colors ${attachLogs ? 'bg-yellow-100 text-yellow-600' : 'hover:bg-neutral-100 text-neutral-400'}`}
                            title="Attach Console Logs"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
                        </button>

                         {/* Camera Button (Screenshot Mode) */}
                         <button 
                            type="button"
                            onClick={() => {
                                setIsScreenshotActive(!isScreenshotActive);
                                setIsInspectorActive(false);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${isScreenshotActive || screenshotElement ? 'bg-purple-100 text-purple-600' : 'hover:bg-neutral-100 text-neutral-400'}`}
                            title="Visual Capture (Select Element)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </button>

                        {/* Paperclip Button (Upload) */}
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={`p-1.5 rounded-lg transition-colors ${attachedImage ? 'bg-green-100 text-green-600' : 'hover:bg-neutral-100 text-neutral-400'}`}
                            title="Attach File"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleImageUpload}
                        />

                        {/* Send Button */}
                        <button 
                            type="submit"
                            disabled={!input.trim() && !attachedImage && !screenshotElement}
                            className="p-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </button>
                    </div>
                </form>

                {/* Footer controls for Screen Share & Live */}
                <div className="mt-3 flex items-center justify-between">
                     <div className="flex gap-2">
                        <button 
                            onClick={() => setIsScreenSharing(!isScreenSharing)}
                            className={`text-xs flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${isScreenSharing ? 'bg-green-50 text-green-700' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'}`}
                            title="Share Screen with AI"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                            {isScreenSharing ? 'Sharing' : 'Share Screen'}
                        </button>
                         <button 
                            type="button"
                            onClick={streamState.isConnected ? disconnect : connect}
                            className={`text-xs flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${streamState.isConnected ? 'bg-red-50 text-red-600' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'}`}
                        >
                             {streamState.isConnected ? 'Stop Voice' : 'Start Voice'}
                        </button>
                    </div>
                    <div className="text-[10px] text-neutral-300 font-mono">
                        {selectedAgent.name}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Hidden Media Elements for Live API */}
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

    </div>
  );
}

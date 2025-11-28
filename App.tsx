
import React, { useRef, useState, useEffect } from 'react';
import { useLiveGemini } from './hooks/useLiveGemini';
import { INJECTION_SCRIPT } from './utils/iframe-injection';
import { SelectedElement, Message } from './types';
import { GoogleGenAI } from '@google/genai';
import { ControlTray } from './components/ControlTray';
import { Visualizer } from './components/Visualizer';

// --- Constants ---

const AGENTS = [
  { id: 'gemini-3-pro', name: 'Gemini 3.0 Pro', icon: '✨', color: 'text-indigo-400' },
  { id: 'gemini-2.5', name: 'Gemini 2.5', icon: '⚡', color: 'text-blue-400' },
  { id: 'claude', name: 'Claude Code', icon: 'eh', color: 'text-orange-400' },
  { id: 'cursor', name: 'Cursor', icon: '↗️', color: 'text-white' },
  { id: 'cline', name: 'Cline', icon: '🤖', color: 'text-purple-400' },
  { id: 'codex', name: 'Codex', icon: '👾', color: 'text-green-400' },
  { id: 'opencode', name: 'OpenCode', icon: '🔓', color: 'text-teal-400' },
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
      console.warn("Connecting to dev server...");
      setTimeout(() => {
        console.log("Connected.");
      }, 1000);
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
  const [multiSelectRegion, setMultiSelectRegion] = useState<{ rect: any, count: number } | null>(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Live / Media State
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isWebcamActive, setIsWebcamActive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Inspector & Context State
  const [isInspectorActive, setIsInspectorActive] = useState(false);
  const [isScreenshotActive, setIsScreenshotActive] = useState(false);
  
  const [logs, setLogs] = useState<string[]>([]);
  const [attachLogs, setAttachLogs] = useState(false);
  const [showConsole, setShowConsole] = useState(false); 
  
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Popup Input State
  const [popupInput, setPopupInput] = useState('');
  const [isPopupAgentMenuOpen, setIsPopupAgentMenuOpen] = useState(false);

  // Agent State
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [gitBranch, setGitBranch] = useState('main');

  // Input UI State
  const [isInputExpanded, setIsInputExpanded] = useState(false);

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
    } else if (streamState.isConnected && isWebcamActive) {
         navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                startVideoStreaming();
            }
         }).catch(err => {
             console.error("Failed to get webcam", err);
             setIsWebcamActive(false);
         });
    } else {
        stopVideoStreaming();
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
    }
  }, [isScreenSharing, isWebcamActive, streamState.isConnected, startVideoStreaming, stopVideoStreaming]);

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

  // Handle iframe messages
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
        if (!isSidebarOpen) setPopupInput('');
      }
      else if (event.data.type === 'SCREENSHOT_SELECT') {
         const el = event.data.element;
         setScreenshotElement(el);
         setMultiSelectRegion(null);
         setIsScreenshotActive(false); 
      }
      else if (event.data.type === 'MULTI_SELECT') {
         setMultiSelectRegion({
             rect: event.data.rect,
             count: event.data.elements.length
         });
         setScreenshotElement(null);
         setIsScreenshotActive(false);
      }
      else if (event.data.type === 'CONSOLE_LOG') {
          const logEntry = `> [${event.data.level.toUpperCase()}] ${event.data.message}`;
          setLogs(prev => [...prev.slice(-99), logEntry]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isSidebarOpen]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const processPrompt = async (promptText: string, source: 'sidebar' | 'popup') => {
    if (!promptText.trim() && !selectedElement && !attachedImage && !screenshotElement && !multiSelectRegion) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText,
      timestamp: new Date(),
      selectedElement: selectedElement || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    if (source === 'sidebar') setInput('');
    if (source === 'popup') setPopupInput('');
    
    const contents: any[] = [];
    let fullPromptText = `
        Current HTML Code:
        \`\`\`html
        ${pendingCode || htmlCode}
        \`\`\`
        User Request: ${userMessage.content}
        ${selectedElement ? `Context: User selected element for CODE editing: <${selectedElement.tagName}> with text "${selectedElement.text}"` : ''}
        ${screenshotElement ? `Context: User selected element for VISUAL reference: <${screenshotElement.tagName}>.` : ''}
        ${multiSelectRegion ? `Context: User selected a REGION containing ${multiSelectRegion.count} elements.` : ''}
    `;

    if (attachLogs && logs.length > 0) {
        fullPromptText += `\n\nRecent Console Logs:\n${logs.join('\n')}`;
    }

    fullPromptText += `\nInstructions: You are ${selectedAgent.name}. Return updated HTML code.`;

    if (attachedImage) {
        const base64Data = attachedImage.split(',')[1];
        const mimeType = attachedImage.split(';')[0].split(':')[1];
        contents.push({ inlineData: { mimeType: mimeType, data: base64Data } });
    }

    contents.push({ text: fullPromptText });

    setAttachLogs(false);
    setAttachedImage(null);
    setScreenshotElement(null);
    setMultiSelectRegion(null);
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
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "Error processing request.", timestamp: new Date() }]);
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
                        <span>{lang || 'code'}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] bg-white/10 px-1.5 py-0.5 rounded">COPY</div>
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

  const getPopupStyle = () => {
    if (!selectedElement || !selectedElement.x || !selectedElement.y || !iframeRef.current) return { display: 'none' };
    const iframeRect = iframeRef.current.getBoundingClientRect();
    const top = iframeRect.top + selectedElement.y + 10;
    const left = iframeRect.left + selectedElement.x;
    return { top: `${Math.min(Math.max(10, top), window.innerHeight - 200)}px`, left: `${Math.min(Math.max(10, left), window.innerWidth - 320)}px` };
  };

  const displayCode = isPreviewingOriginal ? (originalCode || htmlCode) : (pendingCode || htmlCode);

  return (
    <div className="flex h-screen w-full bg-zinc-950 overflow-hidden font-sans text-neutral-200 relative">
      
      {/* --- Left Pane: Web Preview --- */}
      <div className={`flex-1 flex flex-col relative h-full bg-zinc-900 transition-all duration-300 ease-in-out border-r border-zinc-800 ${isSidebarOpen ? '' : 'w-full'}`}>
        
        {/* Browser Chrome / Git Toolbar */}
        <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-4 flex-shrink-0 justify-between text-xs">
            
            {/* Left: Git Controls */}
            <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5 text-zinc-400 hover:text-white cursor-pointer transition-colors">
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
                     <span className="font-semibold">{gitBranch}</span>
                     <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="m6 9 6 6 6-6"/></svg>
                 </div>
                 <div className="h-4 w-[1px] bg-zinc-700"></div>
                 <button className="text-zinc-400 hover:text-white transition-colors" title="Sync Changes">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                 </button>
            </div>

            {/* Center: Address Bar */}
            <div className="flex-1 flex justify-center">
                 <div className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1 flex items-center gap-2 text-zinc-500 font-mono w-64 hover:border-zinc-700 hover:text-zinc-400 transition-colors cursor-text text-[10px]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><path d="M9 21V9"/></svg>
                    <span>localhost:3000</span>
                </div>
            </div>

            {/* Right: Tools */}
            <div className="flex items-center gap-3 text-zinc-400">
                 <button 
                    onClick={() => setShowConsole(!showConsole)}
                    className={`hover:text-white transition-colors ${showConsole ? 'text-white' : ''}`}
                    title="Toggle Terminal/Console"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                 </button>
                 {!isSidebarOpen && (
                    <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="hover:text-white transition-colors"
                        title="Open Sidebar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                    </button>
                 )}
            </div>
        </div>

        {/* Iframe Preview */}
        <div className="flex-1 relative bg-white overflow-hidden">
             <iframe
                ref={iframeRef}
                title="preview"
                srcDoc={`${displayCode}${INJECTION_SCRIPT}`}
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-modals allow-same-origin"
             />
             
            {pendingCode && (
                <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-zinc-900/90 backdrop-blur rounded-full shadow-xl border border-zinc-700 p-2 z-50">
                     <button 
                        onMouseDown={() => setIsPreviewingOriginal(true)}
                        onMouseUp={() => setIsPreviewingOriginal(false)}
                        onMouseLeave={() => setIsPreviewingOriginal(false)}
                        className="w-10 h-10 rounded-full hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                     </button>
                     <div className="w-[1px] h-6 bg-zinc-700"></div>
                     <button 
                        onClick={handleDiscardChanges}
                        className="w-10 h-10 rounded-full hover:bg-red-900/30 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-colors"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                     </button>
                     <button 
                        onClick={handleApplyChanges}
                        className="w-10 h-10 rounded-full bg-blue-600 text-white hover:bg-blue-500 flex items-center justify-center shadow-md transition-colors"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                     </button>
                </div>
            )}
            
            {/* Context Popup (Only when sidebar closed) */}
             {!isSidebarOpen && selectedElement && (
                <div 
                    className="absolute z-50 bg-zinc-900 rounded-xl shadow-2xl border border-zinc-700 w-80 p-3"
                    style={getPopupStyle()}
                >
                    <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
                        <div className="bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-mono font-medium">
                            {selectedElement.tagName}
                        </div>
                        <span className="truncate max-w-[100px]">{selectedElement.text}</span>
                        <div className="flex-1"></div>
                        
                        {/* Agent Selector in Popup */}
                        <div className="relative">
                            <button onClick={() => setIsPopupAgentMenuOpen(!isPopupAgentMenuOpen)} className="flex items-center gap-1 hover:text-white">
                                <span>{selectedAgent.icon === 'eh' ? '🤖' : selectedAgent.icon}</span>
                            </button>
                            {isPopupAgentMenuOpen && (
                                <div className="absolute top-6 right-0 w-40 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl z-50">
                                    {AGENTS.map(agent => (
                                        <button
                                            key={agent.id}
                                            onClick={() => { setSelectedAgent(agent); setIsPopupAgentMenuOpen(false); }}
                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 text-zinc-300 flex items-center gap-2"
                                        >
                                            <span>{agent.icon === 'eh' ? '🤖' : agent.icon}</span>
                                            {agent.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button onClick={() => setSelectedElement(null)} className="hover:text-white ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    
                    <form onSubmit={(e) => { e.preventDefault(); processPrompt(popupInput, 'popup'); }}>
                        <textarea
                            value={popupInput}
                            onChange={(e) => setPopupInput(e.target.value)}
                            placeholder={`Ask ${selectedAgent.name}...`}
                            className="w-full text-sm p-2 bg-zinc-950 rounded-lg border border-zinc-800 text-white focus:outline-none focus:border-blue-500 resize-none"
                            rows={2}
                            autoFocus
                        />
                        <div className="flex justify-end mt-2">
                             <button type="submit" className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center hover:bg-blue-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                             </button>
                        </div>
                    </form>
                </div>
             )}
        </div>
        
        {/* Bottom Console Panel */}
        {showConsole && (
            <div className="h-48 bg-zinc-950 border-t border-zinc-800 flex flex-col">
                <div className="h-8 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-900/50">
                    <span className="text-xs font-mono text-zinc-400">Console Output</span>
                    <button onClick={() => setLogs([])} className="text-[10px] text-zinc-500 hover:text-zinc-300">Clear</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1">
                    {logs.length === 0 && <div className="text-zinc-600 italic px-2">No logs recorded...</div>}
                    {logs.map((log, i) => (
                        <div key={i} className={`${log.includes('ERROR') ? 'text-red-400' : log.includes('WARN') ? 'text-yellow-400' : 'text-zinc-300'}`}>
                            {log}
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>


      {/* --- Right Pane: Chat Interface --- */}
      {isSidebarOpen && (
        <div className={`w-[400px] flex-shrink-0 bg-zinc-950 flex flex-col transition-all duration-300 border-l border-zinc-800`}>
            
            {/* Header */}
            <div className="h-10 border-b border-zinc-800 flex items-center justify-between px-4 flex-shrink-0 bg-zinc-950">
                <span className="text-xs font-medium text-zinc-400">Thread</span>
                <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-medium ${msg.role === 'user' ? 'bg-zinc-800 text-zinc-300' : 'bg-blue-900/30 text-blue-400'}`}>
                            {msg.role === 'user' ? 'U' : 'AI'}
                        </div>
                        <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {msg.selectedElement && (
                                <div className="flex items-center gap-1.5 text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-500 mb-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                    Selected: <span className="font-mono text-zinc-400">{msg.selectedElement.tagName.toLowerCase()}</span>
                                </div>
                            )}
                            <div className={`text-sm leading-relaxed px-3 py-2 rounded-lg ${msg.role === 'user' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 w-full'}`}>
                                {renderMessageContent(msg.content)}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

             {/* Indicators */}
            {(selectedElement || screenshotElement || multiSelectRegion || attachLogs || attachedImage) && (
                <div className="px-4 py-2 border-t border-zinc-800 flex flex-wrap gap-2">
                     {selectedElement && <span className="text-[10px] bg-blue-900/20 text-blue-400 px-2 py-0.5 rounded border border-blue-900/30">Code: {selectedElement.tagName}</span>}
                     {screenshotElement && <span className="text-[10px] bg-purple-900/20 text-purple-400 px-2 py-0.5 rounded border border-purple-900/30">Visual: {screenshotElement.tagName}</span>}
                     {multiSelectRegion && <span className="text-[10px] bg-purple-900/20 text-purple-400 px-2 py-0.5 rounded border border-purple-900/30">Region: {multiSelectRegion.count} Items</span>}
                     {attachLogs && <span className="text-[10px] bg-yellow-900/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-900/30">Logs</span>}
                     {attachedImage && <span className="text-[10px] bg-green-900/20 text-green-400 px-2 py-0.5 rounded border border-green-900/30">Image</span>}
                </div>
            )}

            {/* Compact Chat Input Bubble */}
            <div className="p-4 bg-zinc-950">
                <form 
                    onSubmit={(e) => { e.preventDefault(); processPrompt(input, 'sidebar'); }} 
                    className={`relative bg-zinc-900 border border-zinc-800 rounded-[20px] transition-all duration-300 ease-in-out ${isInputExpanded || input ? 'rounded-xl p-2' : 'p-1.5'}`}
                >
                    <div className="flex items-center">
                        {/* Mini Agent Badge (Visible when collapsed) */}
                        {!isInputExpanded && !input && (
                             <div className="pl-2 pr-1 text-zinc-500 cursor-default">
                                {selectedAgent.icon === 'eh' ? '🤖' : selectedAgent.icon}
                             </div>
                        )}
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onFocus={() => setIsInputExpanded(true)}
                            onBlur={() => !input && !isAgentMenuOpen && setIsInputExpanded(false)}
                            placeholder={isInputExpanded ? "Ask..." : "Ask..."}
                            className={`w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none transition-all ${isInputExpanded || input ? 'px-2 py-1 mb-2' : 'px-1 py-1'}`}
                        />
                    </div>
                    
                    <div className={`overflow-hidden transition-all duration-300 ${isInputExpanded || input ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="flex items-center justify-between pt-1">
                             <div className="flex items-center gap-1">
                                {/* Agent Selector */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onMouseDown={() => setIsAgentMenuOpen(!isAgentMenuOpen)} // Use onMouseDown to prevent blur
                                        className="flex items-center gap-1.5 px-2 py-1 hover:bg-zinc-800 rounded text-xs text-zinc-400 transition-colors"
                                    >
                                        <span>{selectedAgent.icon === 'eh' ? '🤖' : selectedAgent.icon}</span>
                                        <span className="font-medium">{selectedAgent.name}</span>
                                    </button>
                                    {isAgentMenuOpen && (
                                        <div className="absolute bottom-full left-0 mb-1 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 z-50">
                                            {AGENTS.map(agent => (
                                                <button
                                                    key={agent.id}
                                                    type="button"
                                                    onMouseDown={() => { setSelectedAgent(agent); setIsAgentMenuOpen(false); }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 text-zinc-300 flex items-center gap-2"
                                                >
                                                    <span>{agent.icon === 'eh' ? '🤖' : agent.icon}</span>
                                                    {agent.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="w-[1px] h-4 bg-zinc-800 mx-1"></div>
                                
                                {/* Attachments */}
                                <button type="button" onMouseDown={() => fileInputRef.current?.click()} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

                                <button type="button" onMouseDown={() => { setIsInspectorActive(!isInspectorActive); setIsScreenshotActive(false); }} className={`p-1.5 rounded ${isInspectorActive ? 'bg-blue-900/30 text-blue-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
                                </button>

                                 <button type="button" onMouseDown={() => { setIsScreenshotActive(!isScreenshotActive); setIsInspectorActive(false); }} className={`p-1.5 rounded ${isScreenshotActive ? 'bg-purple-900/30 text-purple-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                </button>
                             </div>

                             <div className="flex items-center gap-1">
                                 <button type="submit" disabled={!input.trim()} className="p-1.5 bg-white text-black rounded hover:bg-zinc-200 transition-colors ml-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                 </button>
                             </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Floating Control Tray (Restored) */}
      <ControlTray 
          isConnected={streamState.isConnected}
          isVideoEnabled={isWebcamActive}
          isScreenEnabled={isScreenSharing}
          onConnect={connect}
          onDisconnect={disconnect}
          onToggleVideo={() => setIsWebcamActive(!isWebcamActive)}
          onToggleScreen={() => setIsScreenSharing(!isScreenSharing)}
      />

      {/* Audio Visualizer Overlay (Restored) */}
      {streamState.isConnected && (
         <div className="fixed bottom-24 right-8 w-64 h-32 z-40 pointer-events-none">
            <Visualizer volume={volume} isActive={true} />
         </div>
      )}

      {/* Hidden Media Elements for Live API */}
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

    </div>
  );
}

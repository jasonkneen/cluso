import React from 'react';

interface ControlTrayProps {
  isConnected: boolean;
  isVideoEnabled: boolean;
  isScreenEnabled: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleVideo: () => void;
  onToggleScreen: () => void;
}

export const ControlTray: React.FC<ControlTrayProps> = ({
  isConnected,
  isVideoEnabled,
  isScreenEnabled,
  onConnect,
  onDisconnect,
  onToggleVideo,
  onToggleScreen
}) => {
  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-neutral-900/80 backdrop-blur-md p-4 rounded-full border border-neutral-800 shadow-2xl z-50">
      
      {!isConnected ? (
        <button
          onClick={onConnect}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full font-semibold transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          Start Live
        </button>
      ) : (
        <>
           {/* Mic Status (Always On when connected for this demo) */}
           <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-blue-400">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
           </div>

           <button
            onClick={onToggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoEnabled ? 'bg-white text-neutral-900' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
          >
            {isVideoEnabled ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            )}
          </button>

          <button
            onClick={onToggleScreen}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isScreenEnabled ? 'bg-white text-neutral-900' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
          </button>

          <div className="h-8 w-[1px] bg-neutral-800 mx-2"></div>

          <button
            onClick={onDisconnect}
            className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><line x1="23" y1="1" x2="1" y2="23"></line></svg>
          </button>
        </>
      )}
    </div>
  );
};

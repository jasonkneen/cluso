/**
 * Toolbar Component
 *
 * Floating toolbar with mode buttons and mic toggle.
 * Matches the design from the main Cluso app.
 */

type InspectorMode = 'screen' | 'select' | 'move' | 'none'

interface ToolbarProps {
  mode: InspectorMode
  isMicActive: boolean
  onModeChange: (mode: InspectorMode) => void
  onMicToggle: () => void
}

export function Toolbar({ mode, isMicActive, onModeChange, onMicToggle }: ToolbarProps) {
  return (
    <div className="flex items-center justify-center gap-1 py-3 px-4 bg-black/50 border-b border-white/10">
      <div className="flex items-center gap-1 p-1 rounded-full bg-white/5">
        {/* Screen capture */}
        <button
          onClick={() => onModeChange('screen')}
          className={`p-2 rounded-lg transition-all ${
            mode === 'screen'
              ? 'bg-purple-500 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title="Screenshot mode"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </button>

        {/* Element selector */}
        <button
          onClick={() => onModeChange('select')}
          className={`p-2 rounded-lg transition-all ${
            mode === 'select'
              ? 'bg-blue-500 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title="Select element"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
            />
          </svg>
        </button>

        {/* Move mode */}
        <button
          onClick={() => onModeChange('move')}
          className={`p-2 rounded-lg transition-all ${
            mode === 'move'
              ? 'bg-amber-500 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title="Move element"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
            />
          </svg>
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-white/20 mx-2" />

      {/* Mic button */}
      <button
        onClick={onMicToggle}
        className={`p-2.5 rounded-full transition-all ${
          isMicActive
            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse'
            : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
        }`}
        title={isMicActive ? 'Stop recording' : 'Start voice input'}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      </button>
    </div>
  )
}

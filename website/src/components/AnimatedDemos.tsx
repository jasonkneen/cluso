import React, { useState, useEffect } from 'react'

// ============================================================================
// DEMO 1: Point & Select with Numbered Element Highlights
// Shows: Cursor movement, numbered badges on elements, selection chips
// ============================================================================
export const PointSelectDemo: React.FC = () => {
  const [phase, setPhase] = useState(0)
  const [cursorPos, setCursorPos] = useState({ x: 15, y: 15 })
  const [highlightedElements, setHighlightedElements] = useState<number[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [showChip, setShowChip] = useState(false)
  const [speechBubble, setSpeechBubble] = useState<{role: 'user' | 'ai', text: string} | null>(null)

  useEffect(() => {
    const runSequence = async () => {
      // Reset
      setCursorPos({ x: 15, y: 15 })
      setHighlightedElements([])
      setSelectedIndex(null)
      setShowChip(false)
      setSpeechBubble(null)
      setPhase(0)

      await sleep(600)

      // User speaks
      setSpeechBubble({ role: 'user', text: 'Highlight all the buttons' })
      await sleep(1400)
      setSpeechBubble(null)
      await sleep(300)

      // AI responds and highlights
      setSpeechBubble({ role: 'ai', text: "I found 3 buttons. I'll highlight them for you." })
      await sleep(600)
      setHighlightedElements([1])
      await sleep(300)
      setHighlightedElements([1, 2])
      await sleep(300)
      setHighlightedElements([1, 2, 3])
      await sleep(1000)
      setSpeechBubble(null)
      await sleep(400)

      // Cursor moves to button 2
      setCursorPos({ x: 72, y: 48 })
      await sleep(600)

      // Click to select
      setSelectedIndex(2)
      setShowChip(true)
      await sleep(200)

      // AI confirms
      setSpeechBubble({ role: 'ai', text: 'Selected "Get Started" button' })
      await sleep(2000)

      // Reset for loop
      setSpeechBubble(null)
      await sleep(800)
    }

    runSequence()
    const interval = setInterval(runSequence, 9500)
    return () => clearInterval(interval)
  }, [])

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#0d0d14',
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Browser Chrome */}
      <div style={{
        height: '32px',
        background: '#18181f',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: '8px',
        borderBottom: '1px solid #252530',
      }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28ca42' }} />
        </div>
        <div style={{
          flex: 1,
          height: '20px',
          background: '#0d0d14',
          borderRadius: '6px',
          marginLeft: '8px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
        }}>
          <span style={{ fontSize: '10px', color: '#666' }}>acme-store.com</span>
        </div>
        {/* Select Mode Indicator */}
        <div style={{
          padding: '4px 8px',
          borderRadius: '6px',
          background: 'rgba(59, 130, 246, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          </svg>
          <span style={{ fontSize: '9px', color: '#3b82f6', fontWeight: 600 }}>Select</span>
        </div>
      </div>

      {/* Webpage Content */}
      <div style={{
        height: 'calc(100% - 32px)',
        position: 'relative',
        background: 'linear-gradient(180deg, #1a1a28 0%, #12121a 100%)',
      }}>
        {/* Nav */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: '1px solid #252530',
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>ACME Store</span>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', color: '#888' }}>Products</span>
            <span style={{ fontSize: '9px', color: '#888' }}>About</span>
            {/* Button 1 - Login */}
            <div style={{ position: 'relative' }}>
              <div style={{
                padding: '5px 10px',
                borderRadius: '6px',
                background: '#333',
                fontSize: '9px',
                color: '#fff',
                fontWeight: 500,
                outline: highlightedElements.includes(1) ? '2px solid #3b82f6' : 'none',
                outlineOffset: '2px',
                transition: 'all 0.2s',
              }}>
                Login
              </div>
              {highlightedElements.includes(1) && (
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#fff',
                  animation: 'popIn 0.3s ease-out',
                }}>1</div>
              )}
            </div>
          </div>
        </div>

        {/* Hero */}
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
            Premium Products
          </div>
          <div style={{ fontSize: '10px', color: '#888', marginBottom: '14px' }}>
            Discover our exclusive collection
          </div>

          {/* Button 2 - Get Started */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{
              padding: '8px 20px',
              borderRadius: '8px',
              background: selectedIndex === 2
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : 'linear-gradient(135deg, #f97316, #fb923c)',
              fontSize: '11px',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              outline: highlightedElements.includes(2) ? '2px solid #3b82f6' : 'none',
              outlineOffset: '3px',
              transition: 'all 0.3s',
              transform: selectedIndex === 2 ? 'scale(1.05)' : 'scale(1)',
              boxShadow: selectedIndex === 2 ? '0 8px 20px rgba(99, 102, 241, 0.4)' : 'none',
            }}>
              Get Started →
            </div>
            {highlightedElements.includes(2) && (
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: selectedIndex === 2 ? '#22c55e' : '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 700,
                color: '#fff',
                animation: 'popIn 0.3s ease-out',
                transition: 'background 0.3s',
              }}>
                {selectedIndex === 2 ? '✓' : '2'}
              </div>
            )}
          </div>
        </div>

        {/* Product Card */}
        <div style={{
          margin: '0 16px',
          padding: '12px',
          background: '#1f1f2e',
          borderRadius: '10px',
          display: 'flex',
          gap: '12px',
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff', marginBottom: '3px' }}>
              Pro Bundle
            </div>
            <div style={{ fontSize: '9px', color: '#888', marginBottom: '6px' }}>
              Everything you need
            </div>
            {/* Button 3 - Buy Now */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div style={{
                padding: '5px 12px',
                borderRadius: '6px',
                background: '#333',
                fontSize: '9px',
                color: '#fff',
                fontWeight: 500,
                outline: highlightedElements.includes(3) ? '2px solid #3b82f6' : 'none',
                outlineOffset: '2px',
                transition: 'all 0.2s',
              }}>
                Buy Now
              </div>
              {highlightedElements.includes(3) && (
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#fff',
                  animation: 'popIn 0.3s ease-out',
                }}>3</div>
              )}
            </div>
          </div>
        </div>

        {/* Selection Chip */}
        {showChip && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            display: 'flex',
            gap: '6px',
            animation: 'slideUp 0.2s ease-out',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: '9px', color: '#3b82f6', fontWeight: 500 }}>button.cta-primary</span>
              <span style={{ fontSize: '8px', color: '#666' }}>L42-48</span>
            </div>
          </div>
        )}

        {/* Speech Bubbles */}
        {speechBubble && (
          <div style={{
            position: 'absolute',
            bottom: showChip ? '45px' : '10px',
            right: '10px',
            maxWidth: '160px',
            padding: '8px 10px',
            borderRadius: speechBubble.role === 'user' ? '10px 10px 4px 10px' : '10px 10px 10px 4px',
            background: speechBubble.role === 'user'
              ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
              : '#252530',
            animation: 'messageIn 0.25s ease-out',
          }}>
            <div style={{
              fontSize: '8px',
              color: speechBubble.role === 'user' ? 'rgba(255,255,255,0.7)' : '#888',
              marginBottom: '3px',
              fontWeight: 600,
            }}>
              {speechBubble.role === 'user' ? 'You' : 'Cluso'}
            </div>
            <div style={{ fontSize: '9px', color: '#fff', lineHeight: 1.4 }}>
              {speechBubble.text}
            </div>
          </div>
        )}

        {/* Cursor */}
        <div style={{
          position: 'absolute',
          left: `${cursorPos.x}%`,
          top: `${cursorPos.y}%`,
          transform: 'translate(-20%, -20%)',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none',
          zIndex: 100,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path d="M5.5 3.5l6.5 15.5 2-6 6-2z" fill="#fff" stroke="#000" strokeWidth="1"/>
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes messageIn {
          from { transform: translateY(8px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ============================================================================
// DEMO 2: Talk to AI with File Picker & Code Viewer
// Shows: Speech bubbles, file picker popup, file chips, code preview
// ============================================================================
export const TalkToAIDemo: React.FC = () => {
  const [phase, setPhase] = useState(0)
  const [speechBubble, setSpeechBubble] = useState<{role: 'user' | 'ai', text: string} | null>(null)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [showCodePreview, setShowCodePreview] = useState(false)
  const [intentChip, setIntentChip] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)

  const files = [
    { name: 'src', isDir: true },
    { name: 'components', isDir: true },
    { name: 'App.tsx', isDir: false },
    { name: 'Button.tsx', isDir: false },
    { name: 'styles.css', isDir: false },
  ]

  useEffect(() => {
    const runSequence = async () => {
      // Reset
      setSpeechBubble(null)
      setShowFilePicker(false)
      setSelectedFile(null)
      setShowCodePreview(false)
      setIntentChip(null)
      setIsTyping(false)
      setPhase(0)

      await sleep(500)

      // User types @ - show file picker
      setShowFilePicker(true)
      setPhase(1)
      await sleep(1200)

      // Select a file
      setSelectedFile('Button.tsx')
      setShowFilePicker(false)
      await sleep(400)

      // Show code preview
      setShowCodePreview(true)
      await sleep(600)

      // User speaks
      setSpeechBubble({ role: 'user', text: 'Add a loading spinner to this button' })
      await sleep(400)
      setIntentChip('Code Edit')
      await sleep(1200)
      setSpeechBubble(null)
      await sleep(300)

      // AI typing
      setIsTyping(true)
      await sleep(1000)
      setIsTyping(false)

      // AI responds
      setSpeechBubble({ role: 'ai', text: "I'll add a loading state with a spinner icon. The button will show the spinner when isLoading is true." })
      await sleep(2500)

      // Clear for loop
      setSpeechBubble(null)
      setIntentChip(null)
      await sleep(600)
    }

    runSequence()
    const interval = setInterval(runSequence, 9000)
    return () => clearInterval(interval)
  }, [])

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#0d0d14',
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        height: '36px',
        background: '#18181f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        borderBottom: '1px solid #252530',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f97316, #fb923c)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: '12px' }}>✨</span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>Cluso AI</span>
        </div>
        <div style={{
          padding: '3px 8px',
          borderRadius: '10px',
          background: '#22c55e20',
          fontSize: '9px',
          color: '#22c55e',
          fontWeight: 500,
        }}>
          Connected
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, position: 'relative', padding: '12px' }}>
        {/* Context chips area */}
        <div style={{ marginBottom: '10px' }}>
          {/* Intent chip */}
          {intentChip && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.15))',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              marginRight: '6px',
              animation: 'chipIn 0.2s ease-out',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span style={{ fontSize: '9px', color: '#a78bfa', fontWeight: 500 }}>{intentChip}</span>
            </div>
          )}

          {/* File chip */}
          {selectedFile && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              animation: 'chipIn 0.2s ease-out',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span style={{ fontSize: '9px', color: '#60a5fa', fontFamily: 'Monaco, monospace' }}>{selectedFile}</span>
              <span style={{ fontSize: '8px', color: '#666' }}>(12-28)</span>
            </div>
          )}
        </div>

        {/* Code Preview */}
        {showCodePreview && (
          <div style={{
            background: '#111118',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '10px',
            border: '1px solid #252530',
            animation: 'slideDown 0.3s ease-out',
          }}>
            <div style={{ fontSize: '9px', color: '#666', marginBottom: '6px', fontFamily: 'Monaco, monospace' }}>
              Button.tsx
            </div>
            <pre style={{
              margin: 0,
              fontSize: '8px',
              lineHeight: 1.5,
              color: '#e5e5e5',
              fontFamily: 'Monaco, Consolas, monospace',
            }}>
              <code>
                <span style={{ color: '#c586c0' }}>export</span>{' '}
                <span style={{ color: '#569cd6' }}>function</span>{' '}
                <span style={{ color: '#dcdcaa' }}>Button</span>{'({'}<br/>
                {'  '}<span style={{ color: '#9cdcfe' }}>children</span>,<br/>
                {'  '}<span style={{ color: '#9cdcfe' }}>onClick</span><br/>
                {'}'}) {'{'}<br/>
                {'  '}<span style={{ color: '#c586c0' }}>return</span> (<br/>
                {'    '}&lt;<span style={{ color: '#4ec9b0' }}>button</span>&gt;...<br/>
              </code>
            </pre>
          </div>
        )}

        {/* Speech Bubbles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {speechBubble && (
            <div style={{
              alignSelf: speechBubble.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              animation: 'messageIn 0.25s ease-out',
            }}>
              <div style={{
                padding: '8px 12px',
                borderRadius: speechBubble.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: speechBubble.role === 'user'
                  ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                  : '#252530',
              }}>
                <span style={{ fontSize: '10px', color: '#fff', lineHeight: 1.5 }}>
                  {speechBubble.text}
                </span>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {isTyping && (
            <div style={{
              alignSelf: 'flex-start',
              padding: '10px 14px',
              background: '#252530',
              borderRadius: '12px 12px 12px 4px',
              display: 'flex',
              gap: '4px',
              animation: 'messageIn 0.2s ease-out',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#666',
                  animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
          )}
        </div>

        {/* File Picker Popup */}
        {showFilePicker && (
          <div style={{
            position: 'absolute',
            bottom: '60px',
            left: '12px',
            width: '180px',
            background: '#1f1f2e',
            borderRadius: '10px',
            border: '1px solid #333',
            overflow: 'hidden',
            animation: 'popUp 0.2s ease-out',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              padding: '8px 10px',
              borderBottom: '1px solid #333',
              fontSize: '9px',
              color: '#888',
            }}>
              Select file with @
            </div>
            {files.map((file, i) => (
              <div key={i} style={{
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: file.name === 'Button.tsx' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                cursor: 'pointer',
              }}>
                {file.isDir ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24" stroke="none">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
                <span style={{
                  fontSize: '10px',
                  color: file.name === 'Button.tsx' ? '#60a5fa' : '#ccc',
                  fontWeight: file.name === 'Button.tsx' ? 500 : 400,
                }}>
                  {file.name}
                </span>
                {file.isDir && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" style={{ marginLeft: 'auto' }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={{
        padding: '10px 12px',
        background: '#18181f',
        borderTop: '1px solid #252530',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: '#111118',
          borderRadius: '10px',
          padding: '10px 12px',
          border: '1px solid #252530',
        }}>
          <span style={{
            fontSize: '10px',
            color: showFilePicker ? '#60a5fa' : '#666',
            transition: 'color 0.2s',
          }}>
            {showFilePicker ? '@Button' : 'Ask Cluso anything...'}
            {showFilePicker && <span style={{ animation: 'blink 1s infinite' }}>|</span>}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f97316, #fb923c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes chipIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes popUp {
          from { transform: translateY(10px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes messageIn {
          from { transform: translateY(8px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ============================================================================
// DEMO 3: Preview & Apply - Live Changes with Code Diff
// Shows: Live preview, apply/reject, code diff panel, success state
// ============================================================================
export const PreviewApplyDemo: React.FC = () => {
  const [phase, setPhase] = useState(0)
  const [buttonState, setButtonState] = useState<'original' | 'preview' | 'applied'>('original')
  const [showDiff, setShowDiff] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [speechBubble, setSpeechBubble] = useState<{role: 'user' | 'ai', text: string} | null>(null)

  const buttonStyles = {
    original: {
      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      padding: '8px 16px',
      fontSize: '10px',
      text: 'Subscribe',
    },
    preview: {
      background: 'linear-gradient(135deg, #dc2626, #ef4444)',
      padding: '10px 22px',
      fontSize: '11px',
      text: 'Subscribe Now!',
    },
    applied: {
      background: 'linear-gradient(135deg, #dc2626, #ef4444)',
      padding: '10px 22px',
      fontSize: '11px',
      text: 'Subscribe Now!',
    },
  }

  useEffect(() => {
    const runSequence = async () => {
      // Reset
      setButtonState('original')
      setShowDiff(false)
      setShowActions(false)
      setSpeechBubble(null)
      setPhase(0)

      await sleep(600)

      // User request
      setSpeechBubble({ role: 'user', text: 'Make this button red and more prominent' })
      await sleep(1400)
      setSpeechBubble(null)
      await sleep(300)

      // AI responds
      setSpeechBubble({ role: 'ai', text: "I'll make it larger with a red gradient and add urgency to the text." })
      await sleep(800)

      // Show diff
      setShowDiff(true)
      await sleep(400)

      // Apply preview
      setButtonState('preview')
      await sleep(400)
      setSpeechBubble(null)

      // Show action buttons
      setShowActions(true)
      await sleep(1800)

      // Apply changes
      setButtonState('applied')
      await sleep(200)
      setShowActions(false)

      // Success message
      setSpeechBubble({ role: 'ai', text: '✓ Changes applied successfully!' })
      await sleep(1500)

      // Clear
      setShowDiff(false)
      setSpeechBubble(null)
      await sleep(800)
    }

    runSequence()
    const interval = setInterval(runSequence, 9000)
    return () => clearInterval(interval)
  }, [])

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  const currentStyle = buttonStyles[buttonState]

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#0d0d14',
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: 'flex',
    }}>
      {/* Preview Panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          height: '32px',
          background: '#18181f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: '1px solid #252530',
        }}>
          <span style={{ fontSize: '10px', color: '#888' }}>Live Preview</span>
          {buttonState === 'preview' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(249, 115, 22, 0.15)',
              animation: 'pulse 2s infinite',
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#f97316',
              }} />
              <span style={{ fontSize: '9px', color: '#f97316', fontWeight: 500 }}>Preview Active</span>
            </div>
          )}
          {buttonState === 'applied' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(34, 197, 94, 0.15)',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: '9px', color: '#22c55e', fontWeight: 500 }}>Applied</span>
            </div>
          )}
        </div>

        {/* Preview Content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #1a1a28 0%, #12121a 100%)',
          position: 'relative',
        }}>
          {/* Mini page mockup */}
          <div style={{
            background: '#1f1f2e',
            borderRadius: '10px',
            padding: '16px',
            textAlign: 'center',
            border: buttonState === 'preview' ? '2px dashed #f97316' : '1px solid #333',
            transition: 'all 0.3s',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
              Newsletter
            </div>
            <div style={{ fontSize: '9px', color: '#888', marginBottom: '12px' }}>
              Stay updated with our latest news
            </div>

            {/* The Button */}
            <div style={{
              display: 'inline-block',
              ...currentStyle,
              padding: currentStyle.padding,
              fontSize: currentStyle.fontSize,
              borderRadius: '8px',
              fontWeight: 600,
              color: '#fff',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: buttonState !== 'original' ? '0 8px 24px rgba(220, 38, 38, 0.3)' : 'none',
            }}>
              {currentStyle.text}
            </div>
          </div>

          {/* Action Buttons */}
          {showActions && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              display: 'flex',
              gap: '10px',
              animation: 'slideUp 0.3s ease-out',
            }}>
              <button style={{
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '10px',
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Apply
              </button>
              <button style={{
                background: '#333',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '10px',
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
              }}>
                Reject
              </button>
            </div>
          )}

          {/* Speech Bubbles */}
          {speechBubble && (
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              right: '12px',
              animation: 'messageIn 0.25s ease-out',
            }}>
              <div style={{
                display: 'inline-block',
                padding: '8px 12px',
                borderRadius: speechBubble.role === 'user' ? '10px 10px 10px 4px' : '10px 10px 4px 10px',
                background: speechBubble.role === 'user'
                  ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                  : '#252530',
                maxWidth: '90%',
              }}>
                <span style={{ fontSize: '9px', color: '#fff', lineHeight: 1.4 }}>
                  {speechBubble.text}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Code Diff Panel */}
      {showDiff && (
        <div style={{
          width: '45%',
          background: '#111118',
          borderLeft: '1px solid #252530',
          animation: 'slideIn 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 12px',
            borderBottom: '1px solid #252530',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            </svg>
            <span style={{ fontSize: '9px', color: '#888', fontFamily: 'Monaco, monospace' }}>
              Button.tsx
            </span>
          </div>
          <div style={{
            padding: '10px',
            fontSize: '8px',
            fontFamily: 'Monaco, Consolas, monospace',
            lineHeight: 1.6,
          }}>
            <div style={{ color: '#ef4444', marginBottom: '2px' }}>
              - background: #4f46e5;
            </div>
            <div style={{ color: '#22c55e', marginBottom: '6px' }}>
              + background: #dc2626;
            </div>
            <div style={{ color: '#ef4444', marginBottom: '2px' }}>
              - padding: 8px 16px;
            </div>
            <div style={{ color: '#22c55e', marginBottom: '6px' }}>
              + padding: 10px 22px;
            </div>
            <div style={{ color: '#ef4444', marginBottom: '2px' }}>
              - font-size: 10px;
            </div>
            <div style={{ color: '#22c55e', marginBottom: '6px' }}>
              + font-size: 11px;
            </div>
            <div style={{ color: '#ef4444', marginBottom: '2px' }}>
              - Subscribe
            </div>
            <div style={{ color: '#22c55e' }}>
              + Subscribe Now!
            </div>
          </div>
          <div style={{
            marginTop: 'auto',
            padding: '8px 10px',
            borderTop: '1px solid #252530',
            fontSize: '8px',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <span style={{ color: '#22c55e' }}>+4</span>
            <span style={{ color: '#ef4444' }}>-4</span>
            <span>changes</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes messageIn {
          from { transform: translateY(-8px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}

export default { PointSelectDemo, TalkToAIDemo, PreviewApplyDemo }

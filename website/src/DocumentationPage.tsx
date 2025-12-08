import React, { useState, useEffect } from 'react'

const styles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :root {
    --bg-primary: #0a0a0a;
    --bg-secondary: #141414;
    --bg-card: #1a1a1a;
    --text-primary: #ffffff;
    --text-secondary: #a1a1a1;
    --text-muted: #666666;
    --accent: #f97316;
    --accent-hover: #ea580c;
    --border: #262626;
    --gradient-start: #f97316;
    --gradient-end: #fb923c;
  }

  .docs-page.light {
    --bg-primary: #ffffff;
    --bg-secondary: #f9f9f9;
    --bg-card: #f5f5f5;
    --text-primary: #0a0a0a;
    --text-secondary: #525252;
    --text-muted: #a1a1a1;
    --border: #e5e5e5;
  }

  .docs-page {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.6;
    min-height: 100vh;
    transition: background 0.3s, color 0.3s;
  }

  /* Navigation Bar */
  .docs-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: 1rem 2rem;
    background: rgba(10, 10, 10, 0.8);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    transition: background 0.3s;
  }

  .docs-nav.light {
    background: rgba(255, 255, 255, 0.8);
  }

  .docs-nav-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .docs-nav-left {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .docs-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    cursor: pointer;
  }

  .docs-logo img {
    height: 64px;
    width: auto;
  }

  .docs-nav-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .docs-nav-link {
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
    transition: color 0.2s;
    text-decoration: none;
  }

  .docs-nav-link:hover {
    color: var(--text-primary);
  }

  .theme-toggle {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 9999px;
    padding: 0.35rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .theme-toggle:hover {
    background: var(--bg-secondary);
    border-color: var(--text-muted);
  }

  .theme-toggle svg {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
  }

  /* Main Container */
  .docs-container {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 2rem;
    padding: 6rem 2rem 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* Sidebar Navigation */
  .docs-sidebar {
    position: sticky;
    top: 5rem;
    height: fit-content;
    max-height: calc(100vh - 6rem);
    overflow-y: auto;
  }

  .docs-sidebar::-webkit-scrollbar {
    width: 6px;
  }

  .docs-sidebar::-webkit-scrollbar-track {
    background: transparent;
  }

  .docs-sidebar::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }

  .docs-sidebar::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }

  .sidebar-section {
    margin-bottom: 1.5rem;
  }

  .sidebar-title {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    padding: 0.5rem 0;
    margin-bottom: 0.75rem;
  }

  .sidebar-links {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .sidebar-links a {
    display: block;
    padding: 0.5rem 0.75rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    border-radius: 6px;
    border-left: 2px solid transparent;
    transition: all 0.2s;
  }

  .sidebar-links a:hover {
    color: var(--text-primary);
    background: var(--bg-card);
  }

  .sidebar-links a.active {
    color: var(--accent);
    border-left-color: var(--accent);
    background: rgba(249, 115, 22, 0.1);
  }

  /* Main Content */
  .docs-content {
    padding-bottom: 4rem;
  }

  .docs-section {
    margin-bottom: 4rem;
    scroll-margin-top: 6rem;
  }

  .docs-section h2 {
    font-size: 1.8rem;
    font-weight: 700;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .docs-section h3 {
    font-size: 1.3rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    color: var(--text-primary);
  }

  .docs-section p {
    color: var(--text-secondary);
    margin-bottom: 1rem;
    line-height: 1.8;
  }

  .docs-section ul,
  .docs-section ol {
    margin-left: 1.5rem;
    margin-bottom: 1rem;
    color: var(--text-secondary);
  }

  .docs-section li {
    margin-bottom: 0.5rem;
    line-height: 1.7;
  }

  .code-block {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
    overflow-x: auto;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .info-box {
    background: rgba(249, 115, 22, 0.05);
    border-left: 3px solid var(--accent);
    padding: 1rem;
    border-radius: 6px;
    margin: 1.5rem 0;
  }

  .info-box strong {
    color: var(--accent);
  }

  /* Soon Badge */
  .soon-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.6rem;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-left: 0.75rem;
    vertical-align: middle;
  }

  .soon-section {
    opacity: 0.6;
  }

  .soon-section h3 {
    display: flex;
    align-items: center;
  }

  .link-disabled {
    color: var(--text-muted) !important;
    cursor: not-allowed;
    pointer-events: none;
    text-decoration: line-through;
  }

  .link-soon {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .link-soon .soon-badge {
    margin-left: 0;
    font-size: 0.6rem;
    padding: 0.15rem 0.4rem;
  }

  .breadcrumb {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 2rem;
  }

  .breadcrumb a {
    color: var(--accent);
    text-decoration: none;
    transition: color 0.2s;
  }

  .breadcrumb a:hover {
    color: var(--accent-hover);
  }

  /* Responsive */
  @media (max-width: 968px) {
    .docs-container {
      grid-template-columns: 1fr;
      gap: 0;
      padding: 6rem 1.5rem 2rem;
      position: relative;
    }

    .docs-sidebar {
      position: fixed;
      left: 0;
      top: 0;
      height: 100vh;
      width: 280px;
      background: var(--bg-primary);
      border-right: 1px solid var(--border);
      padding: 6rem 1rem 2rem;
      overflow-y: auto;
      z-index: 90;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
    }

    .docs-sidebar.open {
      transform: translateX(0);
    }

    .docs-sidebar::before {
      content: '';
      position: fixed;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      z-index: 85;
    }

    .docs-sidebar.open::before {
      opacity: 1;
      pointer-events: all;
    }

    .docs-logo {
      width: auto;
      height: auto;
    }

    .docs-logo img {
      height: 48px;
    }

    .docs-nav-right {
      gap: 0.5rem;
    }
  }
`

interface DocumentationPageProps {
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const DocumentationPage: React.FC<DocumentationPageProps> = ({ isDark: initialDark = true, onToggleTheme }) => {
  const [isDark, setIsDark] = useState(initialDark)
  const [activeSection, setActiveSection] = useState('getting-started')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    onToggleTheme?.()
  }

  const sections = [
    {
      id: 'getting-started',
      label: 'Getting Started',
      subsections: [
        { id: 'installation', label: 'Installation' },
        { id: 'quick-start', label: 'Quick Start' },
        { id: 'system-requirements', label: 'System Requirements' },
      ],
    },
    {
      id: 'basics',
      label: 'Basics',
      subsections: [
        { id: 'interface', label: 'Interface Overview' },
        { id: 'element-selection', label: 'Element Selection' },
        { id: 'voice-commands', label: 'Voice Commands' },
      ],
    },
    {
      id: 'features',
      label: 'Features',
      subsections: [
        { id: 'ai-editing', label: 'AI-Powered Editing' },
        { id: 'live-preview', label: 'Live Preview' },
        { id: 'code-export', label: 'Code Export', soon: true },
      ],
    },
    {
      id: 'advanced',
      label: 'Advanced',
      subsections: [
        { id: 'api', label: 'API Reference', soon: true },
        { id: 'plugins', label: 'Plugins & Extensions', soon: true },
        { id: 'configuration', label: 'Configuration' },
      ],
    },
    {
      id: 'support',
      label: 'Support',
      subsections: [
        { id: 'faq', label: 'FAQ' },
        { id: 'troubleshooting', label: 'Troubleshooting' },
        { id: 'contact', label: 'Contact & Support' },
      ],
    },
  ]

  return (
    <>
      <style>{styles}</style>
      <div className={`docs-page ${isDark ? '' : 'light'}`}>
        {/* Navigation */}
        <nav className={`docs-nav ${isDark ? '' : 'light'}`}>
          <div className="docs-nav-container">
            <a href="/" className="docs-logo">
              <img
                src={isDark ? '/logo_dark.png' : '/logo_light.png'}
                alt="Cluso"
              />
            </a>
            <div className="docs-nav-right">
              <a href="/" className="docs-nav-link">Back to Home</a>
              <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                {isDark ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5"/>
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* Main Container */}
        <div className="docs-container" onClick={() => sidebarOpen && setSidebarOpen(false)}>
          {/* Sidebar */}
          <aside className={`docs-sidebar ${sidebarOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
            {sections.map((section) => (
              <div key={section.id} className="sidebar-section">
                <div className="sidebar-title">{section.label}</div>
                <ul className="sidebar-links">
                  {section.subsections.map((subsection: { id: string; label: string; soon?: boolean }) => (
                    <li key={subsection.id}>
                      <a
                        href={`#${subsection.id}`}
                        className={activeSection === subsection.id ? 'active' : ''}
                        onClick={(e) => {
                          e.preventDefault()
                          setActiveSection(subsection.id)
                          setSidebarOpen(false)
                          document.getElementById(subsection.id)?.scrollIntoView({ behavior: 'smooth' })
                        }}
                      >
                        {subsection.label}
                        {subsection.soon && <span className="soon-badge">Soon</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>

          {/* Main Content */}
          <main className="docs-content">
            <div className="breadcrumb">
              <a href="/">Home</a> / Documentation
            </div>

            {/* Getting Started Section */}
            <section className="docs-section" id="getting-started">
              <h2>Getting Started</h2>
              <p>Welcome to Cluso documentation. This guide will help you get up and running with our AI-powered browser development tool.</p>
            </section>

            <section className="docs-section" id="installation">
              <h3>Installation</h3>
              <p>Follow these steps to install Cluso on your system:</p>
              <ol>
                <li>Download the installer from our <a href="/downloads" style={{ color: 'var(--accent)' }}>downloads page</a></li>
                <li>Run the installer and follow the setup wizard</li>
                <li>Launch Cluso from your applications menu</li>
                <li>Configure your AI provider API keys in Settings</li>
              </ol>
              <div className="info-box">
                <strong>💡 Tip:</strong> Make sure your system meets the minimum requirements before installation. You'll need API keys from Google (Gemini) or other supported AI providers.
              </div>
            </section>

            <section className="docs-section" id="quick-start">
              <h3>Quick Start</h3>
              <p>Get started with Cluso in just a few minutes:</p>
              <ol>
                <li><strong>Open your webpage</strong> - Navigate to any website or local project</li>
                <li><strong>Select an element</strong> - Click the inspector tool and click on any UI element</li>
                <li><strong>Describe your change</strong> - Use your voice or type what you want to modify</li>
                <li><strong>Review the preview</strong> - See the AI-generated changes in real-time</li>
                <li><strong>Apply or iterate</strong> - Accept the changes or ask for adjustments</li>
              </ol>
            </section>

            <section className="docs-section" id="system-requirements">
              <h3>System Requirements</h3>
              <p>Cluso requires the following minimum specifications:</p>
              <ul>
                <li><strong>OS:</strong> macOS 10.15+, Windows 10+, or Linux (Ubuntu 18.04+)</li>
                <li><strong>RAM:</strong> 4GB minimum (8GB recommended)</li>
                <li><strong>Storage:</strong> 2GB free space</li>
                <li><strong>Internet:</strong> Stable connection required for AI features</li>
                <li><strong>Browser:</strong> Chrome, Firefox, Safari, or Edge (latest versions)</li>
              </ul>
            </section>

            {/* Basics Section */}
            <section className="docs-section" id="basics">
              <h2>Basics</h2>
              <p>Learn the fundamental concepts and workflows in Cluso.</p>
            </section>

            <section className="docs-section" id="interface">
              <h3>Interface Overview</h3>
              <p>The Cluso interface is designed for efficient frontend development with both visual and voice-driven workflows:</p>

              <p style={{ marginTop: '1.5rem' }}><strong>Main Components</strong></p>
              <ul>
                <li><strong>Browser Webview:</strong> Embedded browser that loads your project or any website for inspection</li>
                <li><strong>AI Chat Panel:</strong> Text-based chat for complex queries and code generation</li>
                <li><strong>Voice Control:</strong> Microphone button for hands-free voice commands</li>
                <li><strong>Inspector Tool:</strong> Click to select and highlight page elements</li>
                <li><strong>File Browser:</strong> Navigate your project files with voice or clicks</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>Tab System</strong></p>
              <ul>
                <li><strong>Browser Tabs:</strong> Multiple browser windows for different pages/sites</li>
                <li><strong>Kanban Board:</strong> Track tasks and project progress</li>
                <li><strong>Todo List:</strong> Quick task management</li>
                <li><strong>Notes:</strong> Scratch pad for ideas and snippets</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>Control Bar</strong></p>
              <ul>
                <li><strong>Navigation:</strong> Back, forward, reload, URL bar</li>
                <li><strong>Media Controls:</strong> Microphone, camera, screen share toggles</li>
                <li><strong>Model Selector:</strong> Choose AI provider (Gemini, Claude, GPT)</li>
                <li><strong>Settings:</strong> Configure API keys, theme, preferences</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>Responsive Views</strong></p>
              <ul>
                <li><strong>Desktop:</strong> Full browser view (default)</li>
                <li><strong>Tablet:</strong> 768px width preview</li>
                <li><strong>Mobile:</strong> 375px width preview</li>
              </ul>
            </section>

            <section className="docs-section" id="element-selection">
              <h3>Element Selection</h3>
              <p>Select elements visually or with voice commands to provide context for AI-powered editing:</p>

              <p style={{ marginTop: '1.5rem' }}><strong>Selection Methods</strong></p>
              <ul>
                <li><strong>Click Inspector:</strong> Click the inspector icon, then click any element on the page</li>
                <li><strong>Voice Command:</strong> Say "select the button" or "highlight the image"</li>
                <li><strong>CSS Selector:</strong> AI can target elements using class names, IDs, or attributes</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>Element Information</strong></p>
              <p>When you select an element, Cluso captures:</p>
              <ul>
                <li><strong>HTML Tag:</strong> Element type (button, div, img, etc.)</li>
                <li><strong>Classes & IDs:</strong> CSS identifiers for targeting</li>
                <li><strong>Text Content:</strong> The element's visible text</li>
                <li><strong>Computed Styles:</strong> All applied CSS properties</li>
                <li><strong>Source Location:</strong> File path and line number (for local projects)</li>
                <li><strong>Outer HTML:</strong> The element's full markup</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>Multiple Matches</strong></p>
              <p>When your selector matches multiple elements:</p>
              <ol>
                <li>Cluso highlights all matching elements with numbered badges</li>
                <li>You can say "the second one" or "number 3" to pick one</li>
                <li>Or refine your selection with a more specific command</li>
              </ol>

              <div className="code-block">
"Select the button" → 5 buttons found
"The one that says Download" → Specific button selected
              </div>
            </section>

            <section className="docs-section" id="voice-commands">
              <h3>Voice Commands</h3>
              <p>Control Cluso hands-free using natural voice commands. Click the microphone icon to start speaking. Cluso uses Gemini's native audio model for real-time understanding.</p>

              <p style={{ marginTop: '1.5rem' }}><strong>Element Selection & Inspection</strong></p>
              <ul>
                <li>"Highlight the buttons" - Select all buttons on the page</li>
                <li>"Select the image" - Find and select images</li>
                <li>"Show me the headings" - Highlight heading elements</li>
                <li>"What elements are on this page?" - Discover available elements</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>File Browser</strong></p>
              <ul>
                <li>"Show me the files" / "List files" - Open file browser overlay</li>
                <li>"Open number 3" / "Open three" - Open numbered item from list</li>
                <li>"Open the src folder" / "Go into hooks" - Navigate to folder by name</li>
                <li>"Open LandingPage.tsx" - Open specific file by name</li>
                <li>"Go back" - Navigate back in file browser</li>
                <li>"Close that" / "Clear" / "Dismiss" - Close the file browser</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>Page Navigation</strong></p>
              <ul>
                <li>"Click that" / "Click the download button" - Click elements</li>
                <li>"Go back" / "Go forward" / "Reload" - Browser navigation</li>
                <li>"Scroll down" / "Scroll to top" - Page scrolling</li>
                <li>"Navigate to google.com" - Go to a URL</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>Confirmation & Selection</strong></p>
              <ul>
                <li>"Yes" / "Approve" / "Do it" / "Go ahead" - Confirm action</li>
                <li>"No" / "Reject" / "Cancel" / "Wrong" - Cancel action</li>
                <li>"The second one" / "Number 3" - Choose from multiple matches</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>UI Editing</strong></p>
              <ul>
                <li>"Make it bigger" / "Increase the font size"</li>
                <li>"Change the color to blue" / "Make it red"</li>
                <li>"Add a shadow" / "Add some padding"</li>
                <li>"Change the text to Download Now"</li>
                <li>"Make it bold" / "Center this"</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>Code Operations</strong></p>
              <ul>
                <li>"Save the changes" - Write modifications to source file</li>
                <li>"Read the file" - View source code</li>
                <li>"Show me the code" - Display current element's code</li>
              </ul>

              <div className="info-box" style={{ marginTop: '1.5rem' }}>
                <strong>💡 Tips:</strong>
                <ul style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                  <li>Speak naturally - the AI understands context and intent</li>
                  <li>You can combine commands: "Make it red and bigger"</li>
                  <li>If multiple elements match, you'll be asked to confirm which one</li>
                  <li>Enable camera/screen share for visual context awareness</li>
                </ul>
              </div>

              <div className="info-box" style={{ marginTop: '1rem' }}>
                <strong>ℹ️ Requirements:</strong> Voice commands require microphone access and a Google Gemini API key. Make sure to grant permissions when prompted.
              </div>
            </section>

            {/* Features Section */}
            <section className="docs-section" id="features">
              <h2>Features</h2>
              <p>Explore the powerful features that make Cluso unique.</p>
            </section>

            <section className="docs-section" id="ai-editing">
              <h3>AI-Powered Editing</h3>
              <p>Leverage artificial intelligence to generate and modify code intelligently. Cluso supports multiple AI providers for different use cases:</p>

              <p style={{ marginTop: '1.5rem' }}><strong>Supported AI Providers</strong></p>
              <ul>
                <li><strong>Google Gemini:</strong> Voice interaction, fast UI updates, visual understanding</li>
                <li><strong>Anthropic Claude:</strong> Complex code generation, reasoning, multi-step tasks</li>
                <li><strong>OpenAI GPT:</strong> Code completion, general assistance</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>Editing Capabilities</strong></p>
              <ul>
                <li><strong>Instant CSS Changes:</strong> Colors, fonts, spacing, shadows, animations</li>
                <li><strong>Text Modifications:</strong> Change button labels, headings, content</li>
                <li><strong>Layout Adjustments:</strong> Flexbox, grid, positioning, alignment</li>
                <li><strong>Source File Patching:</strong> Save changes directly to your project files</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>How It Works</strong></p>
              <ol>
                <li>Select an element using the inspector or voice command</li>
                <li>Describe your desired change in natural language</li>
                <li>AI analyzes the element's HTML, CSS, and context</li>
                <li>Preview the change in real-time</li>
                <li>Approve to save changes to your source files</li>
              </ol>

              <div className="info-box" style={{ marginTop: '1.5rem' }}>
                <strong>🔑 Bring Your Own Keys:</strong> Cluso works with your own API keys. Your code stays on your machine, and you control the AI providers you use.
              </div>
            </section>

            <section className="docs-section" id="live-preview">
              <h3>Live Preview</h3>
              <p>See your changes instantly in the embedded browser before committing them to your source files:</p>

              <p style={{ marginTop: '1.5rem' }}><strong>Preview Features</strong></p>
              <ul>
                <li><strong>Instant Updates:</strong> CSS and text changes apply immediately to the page</li>
                <li><strong>Non-Destructive:</strong> Preview changes before saving to source</li>
                <li><strong>Hot Reload:</strong> Works with Vite, Next.js, and other dev servers</li>
                <li><strong>Any Website:</strong> Inspect and modify any public website</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>Responsive Testing</strong></p>
              <ul>
                <li>Switch between desktop, tablet, and mobile viewport sizes</li>
                <li>Test responsive breakpoints without leaving Cluso</li>
                <li>Inspect how elements behave at different widths</li>
              </ul>

              <p style={{ marginTop: '1.5rem' }}><strong>Workflow</strong></p>
              <ol>
                <li>Make a change via voice or chat</li>
                <li>See the change applied instantly in the webview</li>
                <li>Say "yes" to save, or "no" to discard and try again</li>
                <li>Saved changes are written directly to your source files</li>
              </ol>

              <div className="info-box" style={{ marginTop: '1.5rem' }}>
                <strong>💡 Pro Tip:</strong> Use "show me the files" to browse your project, then open a file to see its source code while previewing changes in the browser.
              </div>
            </section>

            <section className="docs-section soon-section" id="code-export">
              <h3>Code Export <span className="soon-badge">Soon</span></h3>
              <p>Export your changes in multiple formats. Currently, changes are applied directly to your project files.</p>
              <div className="info-box">
                <strong>Coming Soon:</strong> Advanced export options are being developed to support multiple output formats.
              </div>
              <p>Planned export formats:</p>
              <ul>
                <li><strong>HTML/CSS:</strong> Clean, production-ready code</li>
                <li><strong>React:</strong> Component-ready JSX files</li>
                <li><strong>Vue/Svelte:</strong> Framework-specific components</li>
                <li><strong>Tailwind:</strong> Utility-class based exports</li>
                <li><strong>Git Patches:</strong> Version control-ready diffs</li>
              </ul>
            </section>

            {/* Advanced Section */}
            <section className="docs-section" id="advanced">
              <h2>Advanced</h2>
              <p>Unlock advanced capabilities for power users and developers.</p>
            </section>

            <section className="docs-section soon-section" id="api">
              <h3>API Reference <span className="soon-badge">Soon</span></h3>
              <p>We're building a powerful API to let you extend and integrate Cluso with your own tools and workflows.</p>
              <div className="info-box">
                <strong>Coming Soon:</strong> The Cluso API will allow programmatic access to UI analysis, code generation, and project management features. Join our waitlist to be notified when it launches.
              </div>
              <p>Planned capabilities:</p>
              <ul>
                <li>Programmatic element analysis</li>
                <li>Batch code generation</li>
                <li>Custom AI model integration</li>
                <li>Webhook notifications</li>
              </ul>
            </section>

            <section className="docs-section soon-section" id="plugins">
              <h3>Plugins & Extensions <span className="soon-badge">Soon</span></h3>
              <p>We're designing a plugin system to let you extend Cluso with custom functionality.</p>
              <div className="info-box">
                <strong>Coming Soon:</strong> The plugin marketplace will allow developers to create, share, and install extensions that add new capabilities to Cluso.
              </div>
              <p>Planned plugin capabilities:</p>
              <ul>
                <li>Custom AI model providers</li>
                <li>Framework-specific code generators (Vue, Svelte, etc.)</li>
                <li>Design system integrations</li>
                <li>Custom export formats</li>
                <li>Third-party service connectors</li>
              </ul>
            </section>

            <section className="docs-section" id="configuration">
              <h3>Configuration</h3>
              <p>Customize Cluso to fit your workflow using the Settings panel. Click the gear icon in the top-right corner to access settings.</p>
              <p>Available options include:</p>
              <ul>
                <li><strong>Theme:</strong> Switch between light and dark mode</li>
                <li><strong>AI Provider:</strong> Choose between Gemini, Claude, or other providers</li>
                <li><strong>API Keys:</strong> Configure your AI provider credentials</li>
                <li><strong>Voice Settings:</strong> Adjust voice input sensitivity and language</li>
                <li><strong>Editor Preferences:</strong> Font size, tab behavior, and display options</li>
              </ul>
              <div className="info-box">
                <strong>🔐 Privacy:</strong> Your API keys are stored locally on your device and are never sent to our servers.
              </div>
            </section>

            {/* Support Section */}
            <section className="docs-section" id="support">
              <h2>Support</h2>
              <p>Get help and find answers to common questions.</p>
            </section>

            <section className="docs-section" id="faq">
              <h3>Frequently Asked Questions</h3>
              <dl style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <dt style={{ fontWeight: '600', marginBottom: '0.5rem' }}>What's the difference between Starter and Pro?</dt>
                  <dd style={{ color: 'var(--text-secondary)' }}>Starter uses local AI processing, while Pro offers cloud-based features with higher accuracy and additional capabilities.</dd>
                </div>
                <div>
                  <dt style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Can I use Cluso offline?</dt>
                  <dd style={{ color: 'var(--text-secondary)' }}>Yes, the Starter edition works offline with local processing. Pro features require internet connectivity.</dd>
                </div>
                <div>
                  <dt style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Is my code private?</dt>
                  <dd style={{ color: 'var(--text-secondary)' }}>Yes, all code stays on your device by default. Pro users can opt into cloud sync with enterprise-grade encryption.</dd>
                </div>
                <div>
                  <dt style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Does Cluso support frameworks like React or Vue?</dt>
                  <dd style={{ color: 'var(--text-secondary)' }}>Yes, Cluso supports all modern frameworks. You can export code as vanilla HTML/CSS or framework-specific formats.</dd>
                </div>
              </dl>
            </section>

            <section className="docs-section" id="troubleshooting">
              <h3>Troubleshooting</h3>
              <p><strong>AI responses are slow</strong></p>
              <ul>
                <li>Check your internet connection</li>
                <li>Try selecting a smaller element</li>
                <li>Restart the application</li>
              </ul>
              <p style={{ marginTop: '1.5rem' }}><strong>Voice input not working</strong></p>
              <ul>
                <li>Verify microphone permissions in system settings</li>
                <li>Check that microphone is not in use by another app</li>
                <li>Test microphone in system preferences</li>
              </ul>
              <p style={{ marginTop: '1.5rem' }}><strong>Changes not applying</strong></p>
              <ul>
                <li>Ensure you're viewing the correct element</li>
                <li>Check browser console for errors</li>
                <li>Try refreshing the page</li>
              </ul>
            </section>

            <section className="docs-section" id="contact">
              <h3>Contact & Support</h3>
              <p>Need help? We're here for you:</p>
              <ul>
                <li><strong>Email:</strong> <a href="mailto:hello@cluso.dev" style={{ color: 'var(--accent)' }}>hello@cluso.dev</a></li>
                <li><strong>X:</strong> <a href="https://x.com/cluso_app" style={{ color: 'var(--accent)' }}>@cluso_app</a></li>
                <li>
                  <strong>Discord:</strong>{' '}
                  <span className="link-soon">
                    <span style={{ color: 'var(--text-muted)' }}>Community server</span>
                    <span className="soon-badge">Soon</span>
                  </span>
                </li>
                <li>
                  <strong>GitHub:</strong>{' '}
                  <span className="link-soon">
                    <span style={{ color: 'var(--text-muted)' }}>Public repository</span>
                    <span className="soon-badge">Soon</span>
                  </span>
                </li>
              </ul>
              <div className="info-box" style={{ marginTop: '1.5rem' }}>
                <strong>📧 Response Time:</strong> We typically respond to support emails within 24 hours on business days.
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  )
}

export default DocumentationPage

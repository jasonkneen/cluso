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
        { id: 'code-export', label: 'Code Export' },
      ],
    },
    {
      id: 'advanced',
      label: 'Advanced',
      subsections: [
        { id: 'api', label: 'API Reference' },
        { id: 'plugins', label: 'Plugins & Extensions' },
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
                  {section.subsections.map((subsection) => (
                    <li key={subsection.id}>
                      <a
                        href={`#${subsection.id}`}
                        className={activeSection === subsection.id ? 'active' : ''}
                        onClick={() => {
                          setActiveSection(subsection.id)
                          setSidebarOpen(false)
                        }}
                      >
                        {subsection.label}
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
                <li>Download the installer from our <a href="#downloads" style={{ color: 'var(--accent)' }}>downloads page</a></li>
                <li>Run the installer and follow the setup wizard</li>
                <li>Launch Cluso from your applications menu</li>
                <li>Sign in with your account or create a new one</li>
              </ol>
              <div className="info-box">
                <strong>💡 Tip:</strong> Make sure your system meets the minimum requirements before installation.
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
              <p>The Cluso interface consists of several key components:</p>
              <ul>
                <li><strong>Inspector Panel:</strong> Select and inspect UI elements</li>
                <li><strong>AI Chat Window:</strong> Communicate with the AI assistant</li>
                <li><strong>Preview Panel:</strong> Review changes before applying</li>
                <li><strong>Code Editor:</strong> View and edit the generated code</li>
                <li><strong>Settings:</strong> Configure application preferences</li>
              </ul>
            </section>

            <section className="docs-section" id="element-selection">
              <h3>Element Selection</h3>
              <p>The element selection tool allows you to identify and target specific UI components:</p>
              <div className="code-block">
                Click Inspector → Point to element → View HTML/CSS details
              </div>
              <p>Once selected, you can:</p>
              <ul>
                <li>View the element's HTML structure</li>
                <li>See applied CSS styles</li>
                <li>Understand layout and positioning</li>
                <li>Pass context to the AI assistant</li>
              </ul>
            </section>

            <section className="docs-section" id="voice-commands">
              <h3>Voice Commands</h3>
              <p>Control Cluso hands-free using voice commands. Click the microphone icon and speak naturally:</p>
              <ul>
                <li>"Make this button bigger"</li>
                <li>"Change the color to blue"</li>
                <li>"Add a hover animation"</li>
                <li>"Center this text"</li>
                <li>"Apply a shadow effect"</li>
              </ul>
              <div className="info-box">
                <strong>ℹ️ Note:</strong> Voice commands require microphone access. Make sure to grant permissions when prompted.
              </div>
            </section>

            {/* Features Section */}
            <section className="docs-section" id="features">
              <h2>Features</h2>
              <p>Explore the powerful features that make Cluso unique.</p>
            </section>

            <section className="docs-section" id="ai-editing">
              <h3>AI-Powered Editing</h3>
              <p>Leverage artificial intelligence to generate and modify code intelligently:</p>
              <ul>
                <li><strong>Context-Aware:</strong> AI understands your selected element and surrounding context</li>
                <li><strong>Natural Language:</strong> Describe changes in plain English</li>
                <li><strong>Smart Suggestions:</strong> Get suggestions based on best practices</li>
                <li><strong>Multi-language:</strong> Works with HTML, CSS, JavaScript, and more</li>
              </ul>
            </section>

            <section className="docs-section" id="live-preview">
              <h3>Live Preview</h3>
              <p>See your changes instantly with live preview:</p>
              <ul>
                <li>Real-time rendering of modifications</li>
                <li>Side-by-side before/after comparison</li>
                <li>Browser compatibility checking</li>
                <li>Responsive design preview</li>
              </ul>
            </section>

            <section className="docs-section" id="code-export">
              <h3>Code Export</h3>
              <p>Export your changes in multiple formats:</p>
              <ul>
                <li><strong>HTML/CSS:</strong> Clean, production-ready code</li>
                <li><strong>React:</strong> Component-ready JSX files</li>
                <li><strong>Framework Agnostic:</strong> Vanilla JavaScript support</li>
                <li><strong>Version Control:</strong> Git-compatible diffs</li>
              </ul>
            </section>

            {/* Advanced Section */}
            <section className="docs-section" id="advanced">
              <h2>Advanced</h2>
              <p>Unlock advanced capabilities for power users and developers.</p>
            </section>

            <section className="docs-section" id="api">
              <h3>API Reference</h3>
              <p>Extend Cluso functionality with the API:</p>
              <div className="code-block">
GET /api/projects          List all projects
POST /api/projects         Create a new project
GET /api/projects/:id      Get project details
PUT /api/projects/:id      Update project
DELETE /api/projects/:id   Delete project
              </div>
              <p>For detailed API documentation, visit our <a href="#" style={{ color: 'var(--accent)' }}>API documentation</a>.</p>
            </section>

            <section className="docs-section" id="plugins">
              <h3>Plugins & Extensions</h3>
              <p>Create custom plugins to extend Cluso:</p>
              <ol>
                <li>Create a plugin manifest in JSON format</li>
                <li>Implement plugin hooks and event handlers</li>
                <li>Package and distribute your plugin</li>
                <li>Users can install from the plugin marketplace</li>
              </ol>
            </section>

            <section className="docs-section" id="configuration">
              <h3>Configuration</h3>
              <p>Customize Cluso to fit your workflow. Edit the configuration file at:</p>
              <div className="code-block">
~/.cluso/config.json
              </div>
              <p>Available options include:</p>
              <ul>
                <li><strong>theme:</strong> 'light' or 'dark'</li>
                <li><strong>autoPreview:</strong> Enable/disable live preview</li>
                <li><strong>defaultModel:</strong> AI model selection</li>
                <li><strong>apiKey:</strong> Your API key for cloud features</li>
              </ul>
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
                <li><strong>Email:</strong> <a href="mailto:support@cluso.dev" style={{ color: 'var(--accent)' }}>support@cluso.dev</a></li>
                <li><strong>Twitter:</strong> <a href="https://twitter.com/cluso" style={{ color: 'var(--accent)' }}>@cluso</a></li>
                <li><strong>Discord:</strong> <a href="#" style={{ color: 'var(--accent)' }}>Join our community</a></li>
                <li><strong>Docs:</strong> <a href="#" style={{ color: 'var(--accent)' }}>GitHub Repository</a></li>
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

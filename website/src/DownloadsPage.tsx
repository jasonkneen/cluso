import React, { useState, useEffect } from 'react';

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
    --nav-bg: rgba(10, 10, 10, 0.8);
    --shadow-color: rgba(0, 0, 0, 0.5);
  }

  .downloads-page.light {
    --bg-primary: #ffffff;
    --bg-secondary: #f5f5f5;
    --bg-card: #ffffff;
    --text-primary: #0a0a0a;
    --text-secondary: #525252;
    --text-muted: #a1a1a1;
    --border: #e5e5e5;
    --nav-bg: rgba(255, 255, 255, 0.8);
    --shadow-color: rgba(0, 0, 0, 0.1);
  }

  .downloads-page {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    padding: 8rem 2rem 4rem;
    transition: background 0.3s, color 0.3s;
  }

  .downloads-container {
    max-width: 900px;
    margin: 0 auto;
  }

  .downloads-hero {
    text-align: center;
    margin-bottom: 5rem;
    animation: fadeInDown 0.8s ease-out;
  }

  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .downloads-hero h1 {
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 800;
    margin-bottom: 1rem;
    letter-spacing: -0.03em;
    background: linear-gradient(135deg, var(--text-primary), var(--text-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .downloads-hero p {
    font-size: 1.1rem;
    color: var(--text-secondary);
    max-width: 600px;
    margin: 0 auto;
    line-height: 1.6;
  }

  .download-cards {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
    margin-bottom: 4rem;
  }

  .download-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 2.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    animation: cardSlideUp 0.6s ease-out both;
  }

  .download-card:nth-child(1) {
    animation-delay: 0.1s;
  }

  .download-card:nth-child(2) {
    animation-delay: 0.2s;
  }

  @keyframes cardSlideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .download-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(251, 146, 60, 0.05));
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  .download-card:hover::before {
    opacity: 1;
  }

  .download-card:hover {
    border-color: var(--accent);
    transform: translateY(-8px);
    box-shadow: 0 20px 40px -10px rgba(249, 115, 22, 0.2);
  }

  .light .download-card {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .light .download-card:hover {
    border-color: #d4d4d4;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  /* Navigation */
  .downloads-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: 1rem 2rem;
    background: var(--nav-bg);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    transition: background 0.3s;
  }

  .downloads-nav-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .downloads-nav-logo {
    font-size: 1.5rem;
    font-weight: 800;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
    text-decoration: none;
  }

  .downloads-nav-logo img {
    height: 64px;
    width: auto;
  }

  .downloads-nav-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .downloads-nav-link {
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
    transition: color 0.2s;
    text-decoration: none;
  }

  .downloads-nav-link:hover {
    color: var(--text-primary);
  }

  /* Theme Toggle */
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

  .light .theme-toggle:hover {
    border-color: #d4d4d4;
  }

  .theme-toggle svg {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
  }

  .download-icon {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    transition: all 0.3s ease;
    position: relative;
    box-shadow: 0 8px 16px -2px rgba(249, 115, 22, 0.3);
  }

  .download-icon::before {
    content: '';
    position: absolute;
    inset: -2px;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    border-radius: 12px;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: -1;
    filter: blur(8px);
  }

  .download-card:hover .download-icon {
    transform: scale(1.1);
    box-shadow: 0 12px 24px -4px rgba(249, 115, 22, 0.4);
  }

  .download-card:hover .download-icon::before {
    opacity: 0.5;
  }

  .download-icon svg {
    width: 32px;
    height: 32px;
    color: white;
  }

  .download-card h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .download-card .subtitle {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
  }

  .system-requirements {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 2rem;
    text-align: left;
    width: 100%;
  }

  .system-requirements h3 {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }

  .system-requirements ul {
    list-style: none;
  }

  .system-requirements li {
    font-size: 0.85rem;
    color: var(--text-secondary);
    padding: 0.3rem 0;
  }

  .download-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 2rem;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    color: white;
    border: none;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
    width: 100%;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .download-button::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .download-button:hover::before {
    opacity: 1;
  }

  .download-button:hover {
    transform: translateY(-3px);
    box-shadow: 0 15px 30px -8px rgba(249, 115, 22, 0.4);
  }

  .download-button:active {
    transform: translateY(-1px);
  }

  .download-button svg {
    width: 18px;
    height: 18px;
  }

  .download-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .download-option-label {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    text-align: left;
  }

  .version-info {
    background: linear-gradient(135deg, var(--bg-secondary) 0%, rgba(249, 115, 22, 0.03) 100%);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 2rem;
    text-align: center;
    margin-bottom: 4rem;
    animation: cardSlideUp 0.6s ease-out 0.3s both;
  }

  .version-info p {
    color: var(--text-secondary);
    margin: 0;
    font-size: 0.95rem;
  }

  .version-number {
    font-weight: 700;
    color: var(--accent);
    padding: 0.25rem 0.75rem;
    background: rgba(249, 115, 22, 0.1);
    border-radius: 6px;
    display: inline-block;
  }

  @media (max-width: 768px) {
    .download-cards {
      grid-template-columns: 1fr;
    }

    .downloads-page {
      padding: 6rem 1.5rem 2rem;
    }

    .downloads-hero {
      margin-bottom: 3rem;
    }
  }
`;

export const DownloadsPage: React.FC = () => {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <>
      <style>{styles}</style>
      <div className={`downloads-page ${isDark ? '' : 'light'}`}>
        {/* Navigation */}
        <nav className="downloads-nav">
          <div className="downloads-nav-container">
            <a href="#" className="downloads-nav-logo">
              <img
                src={isDark ? '/logo_dark.png' : '/logo_light.png'}
                alt="Cluso"
              />
            </a>
            <div className="downloads-nav-right">
              <a href="#" className="downloads-nav-link">Back to Home</a>
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

        <div className="downloads-container">
          {/* Hero */}
          <section className="downloads-hero">
            <h1>Download Cluso</h1>
            <p>Get the AI-powered browser dev tool for Mac and Windows. Start building faster with voice-driven UI creation.</p>
          </section>

          {/* Download Cards */}
          <div className="download-cards">
            {/* macOS */}
            <div className="download-card">
              <div className="download-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.3-3.14-2.53C4.25 17.12 3.75 15.36 4.4 13.9c.6-1.23 1.85-2.02 3.12-2.05 1.28-.03 2.5.77 3.27.77.76 0 2.39-1 4.04-.92 1.44.15 2.87.72 3.85 1.65-.35.2-1.65 1.24-1.65 2.73 0 1.73 1.4 2.58 1.4 2.58s-.45 1.52-1.47 2.27z"/>
                  <path d="M12.07 5.22c.65-.78 1.14-1.87.99-2.96-.96.04-2.14.65-2.85 1.44-.63.73-1.18 1.89-.99 3.01 1.07.08 2.17-.54 2.85-1.49z"/>
                </svg>
              </div>
              <h2>macOS</h2>
              <p className="subtitle">Version 1.0.0</p>
              <div className="system-requirements">
                <h3>System Requirements</h3>
                <ul>
                  <li>• macOS 10.15 or later</li>
                  <li>• Intel or Apple Silicon</li>
                  <li>• 2 GB RAM minimum</li>
                </ul>
              </div>
              <a href="https://github.com/anthropics/cluso/releases/download/v1.0.0/Cluso-1.0.0.dmg" className="download-button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download for Mac
              </a>
            </div>

            {/* Windows */}
            <div className="download-card" style={{ opacity: 0.5, pointerEvents: 'none' }}>
              <div className="download-icon" style={{ background: 'var(--text-muted)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
                </svg>
              </div>
              <h2>Windows</h2>
              <p className="subtitle" style={{ color: 'var(--accent)' }}>Coming Soon</p>
              <div className="system-requirements">
                <h3>System Requirements</h3>
                <ul>
                  <li>• Windows 10 or later</li>
                  <li>• 2 GB RAM minimum</li>
                  <li>• 500 MB disk space</li>
                </ul>
              </div>
              <span className="download-button" style={{ background: 'var(--text-muted)', cursor: 'not-allowed' }}>
                Coming Soon
              </span>
            </div>
          </div>

          {/* Version Info */}
          <div className="version-info">
            <p>Latest Version: <span className="version-number">1.0.0</span> • December 2025</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default DownloadsPage;

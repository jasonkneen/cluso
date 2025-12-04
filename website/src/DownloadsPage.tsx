import React, { useState } from 'react';

const styles = `
  .downloads-page {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.6;
    overflow-x: hidden;
    min-height: 100vh;
  }

  .downloads-hero {
    min-height: 60vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 8rem 2rem 4rem;
    position: relative;
    overflow: hidden;
  }

  .downloads-hero::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 100%;
    background: radial-gradient(ellipse 80% 50% at 50% -20%, var(--hero-glow), transparent);
    pointer-events: none;
  }

  .downloads-hero h1 {
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.03em;
    max-width: 800px;
    margin-bottom: 1rem;
    position: relative;
    z-index: 1;
  }

  .downloads-hero p {
    font-size: 1.1rem;
    color: var(--text-secondary);
    max-width: 600px;
    margin-bottom: 3rem;
    position: relative;
    z-index: 1;
  }

  .downloads-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .downloads-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
    margin-bottom: 4rem;
  }

  .download-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 3rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .download-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.05), rgba(139, 92, 246, 0.05));
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .download-card:hover {
    border-color: #404040;
    transform: translateY(-4px);
  }

  .download-card:hover::before {
    opacity: 1;
  }

  .light .download-card {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .light .download-card:hover {
    border-color: #d4d4d4;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  .download-icon {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    position: relative;
    z-index: 1;
  }

  .download-icon svg {
    width: 40px;
    height: 40px;
    color: white;
  }

  .download-card h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    position: relative;
    z-index: 1;
  }

  .download-card .os-version {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
    position: relative;
    z-index: 1;
  }

  .download-card p {
    color: var(--text-secondary);
    margin-bottom: 2rem;
    line-height: 1.6;
    position: relative;
    z-index: 1;
  }

  .download-requirements {
    text-align: left;
    width: 100%;
    margin-bottom: 2rem;
    position: relative;
    z-index: 1;
  }

  .download-requirements h3 {
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }

  .download-requirements ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .download-requirements li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .download-requirements li svg {
    width: 16px;
    height: 16px;
    color: var(--accent);
    flex-shrink: 0;
  }

  .download-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    color: white;
    border: none;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    z-index: 2;
    width: 100%;
    justify-content: center;
    text-decoration: none;
  }

  .download-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px -5px rgba(249, 115, 22, 0.3);
  }

  .download-button svg {
    width: 18px;
    height: 18px;
  }

  .version-info {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 4rem;
    text-align: center;
  }

  .version-info p {
    color: var(--text-secondary);
    margin: 0;
  }

  .version-number {
    font-weight: 700;
    color: var(--accent);
  }

  .installation-section {
    margin-top: 4rem;
    padding-top: 4rem;
    border-top: 1px solid var(--border);
  }

  .installation-section h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 2rem;
    text-align: center;
  }

  .installation-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
  }

  .installation-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .installation-card h3 {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .installation-card h3 svg {
    width: 24px;
    height: 24px;
  }

  .installation-card ol {
    list-style: decimal;
    list-style-position: inside;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .installation-card li {
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .installation-card code {
    background: var(--bg-secondary);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    color: var(--accent);
  }

  .requirements-section {
    margin-top: 4rem;
    padding-top: 4rem;
    border-top: 1px solid var(--border);
  }

  .requirements-section h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 2rem;
    text-align: center;
  }

  .requirements-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
  }

  .requirement-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .requirement-card h3 {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  .requirement-card ul {
    list-style: none;
  }

  .requirement-card li {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .requirement-card li svg {
    width: 16px;
    height: 16px;
    color: var(--accent);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .troubleshooting-section {
    margin-top: 4rem;
    padding-top: 4rem;
    border-top: 1px solid var(--border);
    margin-bottom: 4rem;
  }

  .troubleshooting-section h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 2rem;
    text-align: center;
  }

  .faq-item {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 1rem;
    transition: all 0.2s;
  }

  .faq-item:hover {
    border-color: #404040;
  }

  .faq-question {
    padding: 1.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    color: var(--text-primary);
    user-select: none;
    transition: all 0.2s;
    background: none;
    border: none;
    width: 100%;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
  }

  .faq-question:hover {
    color: var(--accent);
  }

  .faq-question svg {
    width: 20px;
    height: 20px;
    transition: transform 0.3s ease;
    flex-shrink: 0;
  }

  .faq-item.open .faq-question svg {
    transform: rotate(180deg);
  }

  .faq-answer {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
    border-top: 1px solid var(--border);
  }

  .faq-item.open .faq-answer {
    max-height: 500px;
  }

  .faq-answer-content {
    padding: 1.25rem;
    color: var(--text-secondary);
    line-height: 1.7;
  }

  @media (max-width: 768px) {
    .downloads-grid {
      grid-template-columns: 1fr;
    }

    .installation-grid,
    .requirements-grid {
      grid-template-columns: 1fr;
    }

    .download-card {
      padding: 2rem;
    }

    .downloads-hero {
      padding: 6rem 1.5rem 3rem;
    }
  }
`;

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'Is Cluso free to download?',
    answer: 'Yes! Cluso is completely free to download and use. We offer a free version with all essential features, and optional Pro and Team plans for advanced functionality.'
  },
  {
    id: 'faq-2',
    question: 'What browsers does Cluso support?',
    answer: 'Cluso works on Chrome, Edge, and other Chromium-based browsers. Firefox support is coming soon. Safari support is on our roadmap.'
  },
  {
    id: 'faq-3',
    question: 'Is my data secure?',
    answer: 'We take security seriously. All your code and data is processed locally on your machine by default. Optional cloud features are encrypted end-to-end.'
  },
  {
    id: 'faq-4',
    question: 'Can I use Cluso offline?',
    answer: 'Yes, Cluso works offline for most features. Some AI-powered features may require an internet connection for best results.'
  },
  {
    id: 'faq-5',
    question: 'How do I update Cluso?',
    answer: 'Cluso automatically checks for updates on launch. When an update is available, you\'ll be notified and can update with one click. You can also manually check in Settings > About.'
  },
  {
    id: 'faq-6',
    question: 'What do I do if I encounter a bug?',
    answer: 'Please report bugs on our GitHub repository or contact us at support@cluso.dev. Include any error messages or steps to reproduce the issue.'
  }
];

export const DownloadsPage: React.FC = () => {
  const [openFAQ, setOpenFAQ] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="downloads-page">
        {/* Hero Section */}
        <section className="downloads-hero">
          <h1>Download Cluso</h1>
          <p>Get AI-powered browser development tools for Mac and Windows. Start building faster with voice-driven UI creation.</p>
        </section>

        <div className="downloads-container">
          {/* Downloads Grid */}
          <div className="downloads-grid">
            {/* macOS Card */}
            <div className="download-card">
              <div className="download-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 2h-3a6 6 0 0 0-6 6v3H2v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                  <rect x="2" y="12" width="20" height="8" rx="2"/>
                </svg>
              </div>
              <h2>macOS</h2>
              <p className="os-version">Version 1.0.0</p>
              <p>Optimized for Mac with native performance and seamless system integration.</p>
              <div className="download-requirements">
                <h3>Requirements</h3>
                <ul>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    macOS 10.15 or later
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Intel or Apple Silicon
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    2 GB RAM minimum
                  </li>
                </ul>
              </div>
              <a href="#" className="download-button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download for Mac
              </a>
            </div>

            {/* Windows Card */}
            <div className="download-card">
              <div className="download-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3h9v9H3V3z"/>
                  <path d="M12 3h9v9h-9V3z"/>
                  <path d="M3 12h9v9H3v-9z"/>
                  <path d="M12 12h9v9h-9v-9z"/>
                </svg>
              </div>
              <h2>Windows</h2>
              <p className="os-version">Version 1.0.0</p>
              <p>Full-featured Windows version with native Windows integration and automatic updates.</p>
              <div className="download-requirements">
                <h3>Requirements</h3>
                <ul>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Windows 10 or later
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    64-bit processor
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    2 GB RAM minimum
                  </li>
                </ul>
              </div>
              <a href="#" className="download-button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download for Windows
              </a>
            </div>
          </div>

          {/* Version Info */}
          <div className="version-info">
            <p>Latest Version: <span className="version-number">1.0.0</span> • Released on Dec 15, 2024</p>
          </div>

          {/* Installation Instructions */}
          <section className="installation-section">
            <h2>Installation Instructions</h2>
            <div className="installation-grid">
              <div className="installation-card">
                <h3>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 2h-3a6 6 0 0 0-6 6v3H2v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                  </svg>
                  macOS Installation
                </h3>
                <ol>
                  <li>Download the <code>.dmg</code> file</li>
                  <li>Double-click to mount the disk image</li>
                  <li>Drag the Cluso app to Applications folder</li>
                  <li>Eject the disk image</li>
                  <li>Open Applications and launch Cluso</li>
                  <li>Grant necessary permissions when prompted</li>
                </ol>
              </div>
              <div className="installation-card">
                <h3>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3h9v9H3V3z"/>
                    <path d="M12 3h9v9h-9V3z"/>
                    <path d="M3 12h9v9H3v-9z"/>
                    <path d="M12 12h9v9h-9v-9z"/>
                  </svg>
                  Windows Installation
                </h3>
                <ol>
                  <li>Download the <code>.exe</code> installer</li>
                  <li>Run the installer file</li>
                  <li>Follow the installation wizard</li>
                  <li>Choose installation location</li>
                  <li>Complete the setup process</li>
                  <li>Launch Cluso from Start Menu</li>
                </ol>
              </div>
            </div>
          </section>

          {/* System Requirements */}
          <section className="requirements-section">
            <h2>System Requirements</h2>
            <div className="requirements-grid">
              <div className="requirement-card">
                <h3>macOS Requirements</h3>
                <ul>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <strong>OS:</strong> macOS 10.15 (Catalina) or later
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <strong>Processor:</strong> Intel or Apple Silicon
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <strong>RAM:</strong> 2 GB minimum, 8 GB recommended
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <strong>Storage:</strong> 500 MB available space
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <strong>Browser:</strong> Chrome/Edge/Chromium-based
                  </li>
                </ul>
              </div>
              <div className="requirement-card">
                <h3>Windows Requirements</h3>
                <ul>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <strong>OS:</strong> Windows 10 (Build 1909) or later
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <strong>Processor:</strong> 64-bit processor with SSE2
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <strong>RAM:</strong> 2 GB minimum, 8 GB recommended
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <strong>Storage:</strong> 500 MB available space
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <strong>Browser:</strong> Chrome/Edge/Chromium-based
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Troubleshooting FAQ */}
          <section className="troubleshooting-section">
            <h2>Frequently Asked Questions</h2>
            <div className="faq-container">
              {faqItems.map((item) => (
                <div
                  key={item.id}
                  className={`faq-item ${openFAQ === item.id ? 'open' : ''}`}
                >
                  <button
                    className="faq-question"
                    onClick={() => toggleFAQ(item.id)}
                  >
                    {item.question}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  <div className="faq-answer">
                    <div className="faq-answer-content">
                      {item.answer}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default DownloadsPage;
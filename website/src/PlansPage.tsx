import React, { useState } from 'react'

const styles = `
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
    --hero-glow: rgba(249, 115, 22, 0.15);
    --cta-glow: rgba(249, 115, 22, 0.1);
    --shadow-color: rgba(0, 0, 0, 0.5);
  }

  .plans-page.light {
    --bg-primary: #ffffff;
    --bg-secondary: #f5f5f5;
    --bg-card: #ffffff;
    --text-primary: #0a0a0a;
    --text-secondary: #525252;
    --text-muted: #a1a1a1;
    --border: #e5e5e5;
    --nav-bg: rgba(255, 255, 255, 0.8);
    --hero-glow: rgba(249, 115, 22, 0.08);
    --cta-glow: rgba(249, 115, 22, 0.05);
    --shadow-color: rgba(0, 0, 0, 0.1);
  }

  .plans-page {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.6;
    overflow-x: hidden;
    min-height: 100vh;
    transition: background 0.3s, color 0.3s;
  }

  .plans-page a {
    text-decoration: none;
  }

  /* Navigation */
  .plans-nav {
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

  .nav-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo {
    font-size: 1.5rem;
    font-weight: 800;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }

  .nav-links {
    display: flex;
    gap: 2rem;
    align-items: center;
  }

  .nav-links a {
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
    transition: color 0.2s;
  }

  .nav-links a:hover {
    color: var(--text-primary);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 0.9rem;
    transition: all 0.2s;
    cursor: pointer;
    border: none;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #ffffff;
    color: #0a0a0a;
  }

  .btn-primary:hover:not(:disabled) {
    background: #e5e5e5;
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--bg-card);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-secondary);
    border-color: #404040;
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
    margin-left: 0.5rem;
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

  /* Hero Section */
  .plans-hero {
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

  .plans-hero::before {
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

  .plans-hero h1 {
    font-size: clamp(2.5rem, 8vw, 4rem);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.03em;
    max-width: 900px;
    margin-bottom: 1.5rem;
  }

  .plans-hero h1 .gradient {
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .plans-hero-subtitle {
    font-size: 1.25rem;
    color: var(--text-secondary);
    max-width: 600px;
    margin-bottom: 2.5rem;
    line-height: 1.7;
  }

  /* Plans Section */
  .plans-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 4rem 2rem;
  }

  .section-header {
    text-align: center;
    margin-bottom: 4rem;
  }

  .section-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 1rem;
  }

  .section-title {
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 1rem;
  }

  .section-subtitle {
    font-size: 1.1rem;
    color: var(--text-secondary);
    max-width: 600px;
    margin: 0 auto;
  }

  /* Cloud Plans Grid */
  .plans-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
    margin-top: 3rem;
  }

  .plan-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 2.5rem;
    display: flex;
    flex-direction: column;
    transition: all 0.3s;
    position: relative;
  }

  .plan-card:hover {
    border-color: #404040;
    transform: translateY(-4px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .plan-card.featured {
    border-color: var(--accent);
    background: linear-gradient(135deg, var(--bg-card) 0%, rgba(249, 115, 22, 0.05) 100%);
  }

  .plan-badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.4rem 1rem;
    border-radius: 9999px;
  }

  .plan-name {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
    margin-top: 0.5rem;
  }

  .plan-price {
    font-size: 3rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
  }

  .plan-price span {
    font-size: 1rem;
    font-weight: 400;
    color: var(--text-secondary);
  }

  .plan-billing {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-bottom: 2rem;
  }

  .plan-description {
    color: var(--text-secondary);
    font-size: 0.95rem;
    margin-bottom: 2rem;
    flex-grow: 1;
  }

  /* Features List */
  .plan-features {
    list-style: none;
    margin-bottom: 2rem;
    flex-grow: 1;
  }

  .plan-features li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
  }

  .plan-features li:last-child {
    margin-bottom: 0;
  }

  .plan-features svg {
    width: 18px;
    height: 18px;
    color: #22c55e;
    flex-shrink: 0;
  }

  .plan-cta {
    width: 100%;
    justify-content: center;
    padding: 0.75rem 1.5rem;
  }

  .plan-card.featured .plan-cta {
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    color: white;
  }

  .plan-card.featured .plan-cta:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  /* Cloud Features Section */
  .cloud-features {
    margin-top: 8rem;
    padding-top: 4rem;
    border-top: 1px solid var(--border);
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
    margin-top: 3rem;
  }

  .feature-item {
    padding: 2rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    transition: all 0.3s;
  }

  .feature-item:hover {
    border-color: #404040;
    transform: translateY(-2px);
  }

  .feature-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
    color: white;
    font-weight: 700;
    font-size: 1.5rem;
  }

  .feature-item h3 {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .feature-item p {
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  /* Comparison Table */
  .comparison-section {
    margin-top: 6rem;
    padding-top: 4rem;
    border-top: 1px solid var(--border);
  }

  .comparison-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 2rem;
    overflow-x: auto;
  }

  .comparison-table thead {
    background: var(--bg-secondary);
  }

  .comparison-table th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    border-bottom: 1px solid var(--border);
  }

  .comparison-table td {
    padding: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .comparison-table tr:hover {
    background: var(--bg-secondary);
  }

  .comparison-table .feature-name {
    font-weight: 600;
    color: var(--text-primary);
    min-width: 200px;
  }

  .comparison-table .check {
    color: #22c55e;
    font-weight: 700;
  }

  .comparison-table .cross {
    color: var(--text-muted);
  }

  /* Footer */
  .plans-footer {
    padding: 4rem 2rem 2rem;
    border-top: 1px solid var(--border);
    margin-top: 4rem;
  }

  .footer-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .footer-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  /* Responsive */
  @media (max-width: 900px) {
    .plans-grid,
    .features-grid {
      grid-template-columns: 1fr;
    }

    .comparison-table {
      font-size: 0.9rem;
    }

    .comparison-table th,
    .comparison-table td {
      padding: 0.75rem;
    }
  }

  @media (max-width: 768px) {
    .nav-links {
      display: none;
    }

    .plans-hero {
      padding: 6rem 1.5rem 3rem;
    }

    .plans-container {
      padding: 2rem 1.5rem;
    }

    .footer-bottom {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }
  }
`

interface PlansPageProps {
  isDark?: boolean
  onToggleTheme?: () => void
}

const IconComponent: React.FC<{ name: string }> = ({ name }) => {
  const iconMap: Record<string, JSX.Element> = {
    cloud: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9H9l-3-9H2" />
        <path d="M7 12a5 5 0 0 1 10 0" />
      </svg>
    ),
    zap: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    cpu: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2" />
      </svg>
    ),
    users: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    'bar-chart-2': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  }

  return iconMap[name] || <svg />
}

export const PlansPage: React.FC<PlansPageProps> = ({ isDark = true, onToggleTheme }) => {
  const [theme, setTheme] = useState(isDark)

  const toggleTheme = () => {
    setTheme(!theme)
    onToggleTheme?.()
  }

  const plans = [
    {
      name: 'Starter',
      price: 'Free',
      billing: 'Forever',
      description: 'Perfect for getting started with cloud development',
      features: [
        'Up to 5 projects',
        'Basic AI assistance',
        'Community support',
        '5GB storage',
        'Basic analytics',
      ],
      cta: 'Start Free Trial',
      stripeLink: 'https://checkout.stripe.com/pay/cs_test_starter',
      featured: false,
    },
    {
      name: 'Pro',
      price: '$29',
      billing: '/month',
      description: 'For professional developers who need more power',
      features: [
        'Unlimited projects',
        'Advanced AI features',
        'Priority support',
        '100GB storage',
        'Advanced analytics',
        'Team collaboration',
        'Custom integrations',
      ],
      cta: 'Start 7-Day Trial',
      stripeLink: 'https://checkout.stripe.com/pay/cs_test_pro',
      featured: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      billing: 'Contact sales',
      description: 'For teams and enterprises with advanced needs',
      features: [
        'Everything in Pro',
        'Unlimited storage',
        'Dedicated support',
        'SSO & SAML',
        'Advanced security',
        'Custom contracts',
        'SLA guarantees',
      ],
      cta: 'Contact Sales',
      stripeLink: 'https://calendly.com/cluso/enterprise',
      featured: false,
    },
  ]

  const cloudFeatures = [
    {
      icon: 'cloud',
      title: 'Cloud Sync',
      description: 'Your work syncs instantly across all devices with real-time collaboration',
    },
    {
      icon: 'zap',
      title: 'Lightning Fast',
      description: 'Ultra-low latency cloud infrastructure for instant response times',
    },
    {
      icon: 'shield',
      title: 'Enterprise Security',
      description: 'End-to-end encryption, SOC 2 compliance, and regular security audits',
    },
    {
      icon: 'cpu',
      title: 'Advanced AI',
      description: 'Access to latest AI models with higher rate limits and priority inference',
    },
    {
      icon: 'users',
      title: 'Team Features',
      description: 'Invite teammates, manage permissions, and track collective progress',
    },
    {
      icon: 'bar-chart-2',
      title: 'Analytics',
      description: 'Detailed insights into your development workflow and productivity metrics',
    },
  ]

  return (
    <>
      <style>{styles}</style>
      <div className={`plans-page ${theme ? '' : 'light'}`}>
        {/* Navigation */}
        <nav className="plans-nav">
          <div className="nav-container">
            <img
              src={theme ? '/logo_dark.png' : '/logo_light.png'}
              alt="Cluso"
              className="logo"
              style={{ height: '40px', width: 'auto' }}
            />
            <div className="nav-links">
              <a href="#">Home</a>
              <a href="#pricing">Pricing</a>
              <a href="#plans" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                Cloud Plans
              </a>
              <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                {theme ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="plans-hero">
          <h1>
            Cloud Plans for <span className="gradient">Every Developer</span>
          </h1>
          <p className="plans-hero-subtitle">
            Scale your development with our cloud-powered platform. Start free, upgrade when you need more.
          </p>
        </section>

        {/* Plans Container */}
        <div className="plans-container">
          {/* Plans Grid */}
          <section>
            <div className="plans-grid">
              {plans.map((plan, index) => (
                <div key={index} className={`plan-card ${plan.featured ? 'featured' : ''}`}>
                  {plan.featured && <div className="plan-badge">Most Popular</div>}

                  <div className="plan-name">{plan.name}</div>

                  <div className="plan-price">
                    {plan.price}
                    <span> {plan.billing}</span>
                  </div>

                  <p className="plan-billing">{plan.description}</p>

                  <ul className="plan-features">
                    {plan.features.map((feature, idx) => (
                      <li key={idx}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <a
                    href={plan.stripeLink}
                    className={`btn ${plan.featured ? 'btn-primary' : 'btn-secondary'} plan-cta`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {plan.cta}
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* Cloud Features Section */}
          <section className="cloud-features">
            <div className="section-header">
              <p className="section-label">Cloud Capabilities</p>
              <h2 className="section-title">Powerful Cloud Features</h2>
              <p className="section-subtitle">
                All the tools you need to collaborate, scale, and build faster in the cloud
              </p>
            </div>

            <div className="features-grid">
              {cloudFeatures.map((feature, index) => (
                <div key={index} className="feature-item">
                  <div className="feature-icon">
                    <IconComponent name={feature.icon} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Comparison Table */}
          <section className="comparison-section">
            <div className="section-header">
              <h2 className="section-title">Plan Comparison</h2>
              <p className="section-subtitle">
                See what's included in each plan
              </p>
            </div>

            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Starter</th>
                  <th>Pro</th>
                  <th>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="feature-name">Projects</td>
                  <td><span className="check">5</span></td>
                  <td><span className="check">Unlimited</span></td>
                  <td><span className="check">Unlimited</span></td>
                </tr>
                <tr>
                  <td className="feature-name">Storage</td>
                  <td><span className="check">5GB</span></td>
                  <td><span className="check">100GB</span></td>
                  <td><span className="check">Unlimited</span></td>
                </tr>
                <tr>
                  <td className="feature-name">AI Assistance</td>
                  <td><span className="check">Basic</span></td>
                  <td><span className="check">Advanced</span></td>
                  <td><span className="check">Advanced+</span></td>
                </tr>
                <tr>
                  <td className="feature-name">Team Members</td>
                  <td><span className="cross">1</span></td>
                  <td><span className="check">Unlimited</span></td>
                  <td><span className="check">Unlimited</span></td>
                </tr>
                <tr>
                  <td className="feature-name">Support</td>
                  <td><span className="cross">Community</span></td>
                  <td><span className="check">Priority</span></td>
                  <td><span className="check">Dedicated</span></td>
                </tr>
                <tr>
                  <td className="feature-name">API Access</td>
                  <td><span className="cross">—</span></td>
                  <td><span className="check">✓</span></td>
                  <td><span className="check">✓</span></td>
                </tr>
                <tr>
                  <td className="feature-name">SSO & SAML</td>
                  <td><span className="cross">—</span></td>
                  <td><span className="cross">—</span></td>
                  <td><span className="check">✓</span></td>
                </tr>
                <tr>
                  <td className="feature-name">SLA Guarantee</td>
                  <td><span className="cross">—</span></td>
                  <td><span className="cross">—</span></td>
                  <td><span className="check">99.9%</span></td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        {/* Footer */}
        <footer className="plans-footer">
          <div className="footer-container">
            <div className="footer-bottom">
              <span>&copy; 2024/2025 Jason Kneen. All rights reserved.</span>
              <div style={{ fontSize: '0.9rem' }}>
                All plans include 14-day free trial. No credit card required.
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

export default PlansPage

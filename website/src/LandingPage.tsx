import React, { useState, useEffect } from 'react';
import { PointSelectDemo, TalkToAIDemo, PreviewApplyDemo } from './components/AnimatedDemos';
import { FeatureComparison } from './components/FeatureComparison';

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
    --hero-glow: rgba(249, 115, 22, 0.15);
    --cta-glow: rgba(249, 115, 22, 0.1);
    --shadow-color: rgba(0, 0, 0, 0.5);
  }

  .landing-page.light {
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

  .landing-page {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.6;
    overflow-x: hidden;
    min-height: 100vh;
    transition: background 0.3s, color 0.3s;
  }

  .landing-page a {
    text-decoration: none;
  }

  /* Notification Toast */
  .notification-toast {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    animation: slideIn 0.3s ease;
    z-index: 1000;
    max-width: 400px;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .notification-toast.success {
    background: #22c55e;
    color: white;
  }

  .notification-toast.error {
    background: #ef4444;
    color: white;
  }

  /* Navigation */
  .landing-nav {
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

  .landing-page.light .theme-toggle:hover {
    border-color: #d4d4d4;
  }

  .theme-toggle svg {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
  }

  /* Sticky Scroll Header */
  .scroll-header {
    position: fixed;
    top: 0;
    z-index: 101;
    padding: 0.75rem 1.25rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-top: none;
    transform: translateY(-100%);
    transition: transform 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-radius: 0 0 20px 20px;
    width: 600px;
    left: 50%;
    margin-left: -300px;
  }

  .scroll-header.visible {
    transform: translateY(0);
  }

  .scroll-header .scroll-email-form {
    display: flex;
    align-items: center;
    width: 200px;
    overflow: hidden;
  }

  .scroll-header .scroll-email-form input {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 9999px;
    padding: 0.5rem 1rem;
    color: var(--text-primary);
    font-size: 0.85rem;
    width: 200px;
    outline: none;
    transition: all 0.3s ease;
    transform: translateX(220px);
    opacity: 0;
  }

  .scroll-header:hover .scroll-email-form input {
    transform: translateX(0);
    opacity: 1;
  }

  .scroll-header .scroll-email-form input:focus {
    border-color: var(--accent);
  }

  .scroll-header .scroll-email-form input::placeholder {
    color: var(--text-muted);
  }

  .scroll-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .scroll-header-logo {
    width: 32px;
    height: 32px;
    background: #ffffff;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .scroll-header-logo svg {
    width: 20px;
    height: 20px;
  }

  .scroll-header-title {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .scroll-header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  /* Email Input */
  .email-form {
    display: flex;
    align-items: center;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 9999px;
    padding: 0.5rem 0.5rem 0.5rem 1.25rem;
    max-width: 520px;
    width: 100%;
    transition: border-color 0.2s;
  }

  .email-form:focus-within {
    border-color: var(--accent);
  }

  .email-form-icon {
    color: var(--text-muted);
    margin-right: 0.75rem;
    flex-shrink: 0;
  }

  .email-form-icon svg {
    width: 20px;
    height: 20px;
  }

  .email-form input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 0.95rem;
    min-width: 0;
  }

  .email-form input::placeholder {
    color: var(--text-muted);
  }

  .email-form .btn {
    flex-shrink: 0;
    padding: 0.6rem 1.25rem;
    font-size: 0.9rem;
  }

  .email-form-small {
    padding: 0.35rem 0.35rem 0.35rem 1rem;
  }

  .email-form-small .btn {
    padding: 0.45rem 1rem;
    font-size: 0.85rem;
  }

  .footer-email-form {
    margin-top: 1.5rem;
    max-width: 450px;
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
    color: #0a0a0a;
    transform: translateY(-1px);
  }

  .landing-page.light .btn-primary {
    background: #0a0a0a;
    color: #ffffff;
  }

  .landing-page.light .btn-primary:hover:not(:disabled) {
    background: #1a1a1a;
    color: #ffffff;
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

  .btn-large {
    padding: 0.75rem 1.5rem;
    font-size: 0.95rem;
  }

  /* Hero Section */
  .hero {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 8rem 2rem 2rem;
    position: relative;
    overflow: hidden;
  }

  .hero::before {
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

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 9999px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 2rem;
  }

  .hero-badge .dot {
    width: 6px;
    height: 6px;
    background: #22c55e;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .hero h1 {
    font-size: clamp(2.5rem, 8vw, 4.5rem);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.03em;
    max-width: 900px;
    margin-bottom: 1.5rem;
  }

  .hero h1 .gradient {
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-subtitle {
    font-size: 1.25rem;
    color: var(--text-secondary);
    max-width: 600px;
    margin-bottom: 2.5rem;
    line-height: 1.7;
  }

  .hero-buttons {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .btn-icon {
    width: 20px;
    height: 20px;
  }

  .hero-note {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 1rem;
  }

  /* Hero Image */
  .hero-image {
    margin-top: 4rem;
    max-width: 1100px;
    width: 100%;
    position: relative;
    padding-bottom: 3rem;
  }

  .hero-image-placeholder {
    aspect-ratio: 16/10;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 1rem;
    box-shadow: 0 25px 50px -12px var(--shadow-color);
    overflow: hidden;
    position: relative;
  }

  .hero-image-placeholder::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0.05));
  }

  .placeholder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    z-index: 1;
  }

  .placeholder-icon {
    width: 64px;
    height: 64px;
    background: var(--bg-secondary);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Features Section */
  .features {
    padding: 2rem 2rem 8rem;
    max-width: 1200px;
    margin: 0 auto;
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

  .features-grid {
    display: flex;
    flex-direction: column;
    gap: 3rem;
  }

  .feature-card {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 3rem;
    align-items: center;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 2.5rem;
    transition: all 0.3s;
  }

  .feature-card:nth-child(2) {
    grid-template-columns: 1.5fr 1fr;
  }

  .feature-card:nth-child(2) .feature-content {
    order: 2;
  }

  .feature-card:nth-child(2) .feature-image {
    order: 1;
  }

  .feature-card:hover {
    border-color: #404040;
  }

  .landing-page.light .feature-card {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .landing-page.light .feature-card:hover {
    border-color: #d4d4d4;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  .feature-content {
    display: flex;
    flex-direction: column;
  }

  .feature-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    border-radius: 10px;
    font-weight: 700;
    font-size: 1rem;
    margin-bottom: 1.5rem;
  }

  .feature-card h3 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  .feature-card p {
    color: var(--text-secondary);
    font-size: 1rem;
    line-height: 1.8;
  }

  .feature-image {
    aspect-ratio: 4/3;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  @media (max-width: 800px) {
    .feature-card {
      grid-template-columns: 1fr !important;
      gap: 1.5rem;
    }
    .feature-card:nth-child(2) .feature-content,
    .feature-card:nth-child(2) .feature-image {
      order: unset;
    }
  }

  /* Pricing Section */
  .pricing {
    padding: 6rem 2rem;
    background: var(--bg-secondary);
  }

  .pricing-container {
    max-width: 1100px;
    margin: 0 auto;
  }

  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    margin-top: 3rem;
  }

  .pricing-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    transition: all 0.3s;
  }

  .pricing-card:hover {
    border-color: #404040;
    transform: translateY(-4px);
  }

  .pricing-card.featured {
    border-color: var(--accent);
    position: relative;
  }

  .pricing-card.featured::before {
    content: 'Cloud Services';
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
  }

  .pricing-card-wrapper {
    position: relative;
  }

  .pricing-card h3 {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .pricing-card .price {
    font-size: 2.5rem;
    font-weight: 800;
    margin-bottom: 0.25rem;
  }

  .pricing-card .price span {
    font-size: 1rem;
    font-weight: 400;
    color: var(--text-secondary);
  }

  .pricing-card .original-price {
    font-size: 1rem;
    color: var(--text-muted);
    text-decoration: line-through;
    margin-right: 0.5rem;
  }

  .pricing-card .price-note {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 1.5rem;
  }

  .pricing-card ul {
    list-style: none;
    margin-bottom: 2rem;
    flex-grow: 1;
  }

  .pricing-card li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
  }

  .pricing-card li svg {
    width: 16px;
    height: 16px;
    color: #22c55e;
    flex-shrink: 0;
  }

  .pricing-card .btn {
    width: 100%;
    justify-content: center;
  }

  .landing-page.light .pricing-card {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .landing-page.light .pricing-card:hover {
    border-color: #d4d4d4;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 900px) {
    .pricing-grid {
      grid-template-columns: 1fr;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }
  }

  /* CTA Section */
  .cta {
    padding: 8rem 2rem;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .cta::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 100%;
    background: radial-gradient(ellipse 80% 50% at 50% 120%, var(--cta-glow), transparent);
    pointer-events: none;
  }

  .cta-content {
    position: relative;
    z-index: 1;
  }

  .cta h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 1rem;
  }

  .cta p {
    font-size: 1.1rem;
    color: var(--text-secondary);
    margin-bottom: 2rem;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
  }

  .cta-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  /* Footer */
  .landing-footer {
    padding: 4rem 2rem 2rem;
    border-top: 1px solid var(--border);
  }

  .footer-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .footer-top {
    display: grid;
    grid-template-columns: 2fr repeat(3, 1fr);
    gap: 4rem;
    margin-bottom: 4rem;
  }

  .footer-brand {
    max-width: 300px;
  }

  .footer-brand .logo {
    margin-bottom: 1rem;
    display: inline-block;
  }

  .footer-brand p {
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.7;
  }

  .footer-links h4 {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 1rem;
    color: var(--text-muted);
  }

  .footer-links ul {
    list-style: none;
  }

  .footer-links li {
    margin-bottom: 0.5rem;
  }

  .footer-links a {
    color: var(--text-secondary);
    font-size: 0.9rem;
    transition: color 0.2s;
  }

  .footer-links a:hover {
    color: var(--text-primary);
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

  .social-links {
    display: flex;
    gap: 1rem;
  }

  .social-links a {
    color: var(--text-muted);
    transition: color 0.2s;
  }

  .social-links a:hover {
    color: var(--text-primary);
}

  /* Comparison Matrix */
  .comparison {
    padding: 6rem 2rem;
    background: var(--bg-secondary);
  }

  .comparison-container {
    max-width: 1000px;
    margin: 0 auto;
  }

  .comparison-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 3rem;
    background: var(--bg-card);
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .comparison-table thead {
    background: var(--bg-primary);
  }

  .comparison-table th {
    padding: 1.25rem 1rem;
    text-align: left;
    font-weight: 700;
    font-size: 0.95rem;
    border-bottom: 1px solid var(--border);
  }

  .comparison-table th:first-child {
    width: 50%;
  }

  .comparison-table th:not(:first-child) {
    text-align: center;
    width: 25%;
  }

  .comparison-table th.cluso-header {
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    color: white;
  }

  .comparison-table th.others-header {
    color: var(--text-muted);
  }

  .comparison-table td {
    padding: 1rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.9rem;
  }

  .comparison-table td:first-child {
    color: var(--text-primary);
    font-weight: 500;
  }

  .comparison-table td:not(:first-child) {
    text-align: center;
  }

  .comparison-table tbody tr:last-child td {
    border-bottom: none;
  }

  .comparison-table tbody tr:hover {
    background: var(--bg-secondary);
  }

  .comparison-table .category-row td {
    background: var(--bg-primary);
    font-weight: 700;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    padding: 0.75rem 1rem;
  }

  .comparison-table .category-row:hover td {
    background: var(--bg-primary);
  }

  .status-yes {
    color: #22c55e;
    font-weight: 600;
  }

  .status-no {
    color: #ef4444;
    font-weight: 600;
  }

  .status-partial {
    color: #f59e0b;
    font-weight: 600;
  }

  .check-icon, .x-icon, .partial-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }

  .check-icon {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .x-icon {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .partial-icon {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .check-icon svg, .x-icon svg, .partial-icon svg {
    width: 14px;
    height: 14px;
  }

  @media (max-width: 768px) {
    .comparison-table {
      font-size: 0.85rem;
    }
    .comparison-table th,
    .comparison-table td {
      padding: 0.75rem 0.5rem;
    }
    .comparison-table th:first-child {
      width: 40%;
    }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .nav-links {
      display: none;
    }

    .hero {
      padding: 6rem 1.5rem 3rem;
    }

    .hero-buttons {
      flex-direction: column;
      width: 100%;
      max-width: 300px;
    }

    .btn-large {
      width: 100%;
      justify-content: center;
    }

    .features, .how-it-works, .cta {
      padding: 4rem 1.5rem;
    }

    .footer-top {
      grid-template-columns: 1fr;
      gap: 2rem;
    }

    .footer-bottom {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }
  }
`;
interface LandingPageProps {
  onDownload?: () => void;
}

interface NotificationState {
  type: 'success' | 'error' | null;
  message: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onDownload }) => {
  const [isDark, setIsDark] = useState(true);
  const [email, setEmail] = useState('');
  const [showScrollHeader, setShowScrollHeader] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted'>('idle');
  const [notification, setNotification] = useState<NotificationState>({ type: null, message: '' });

  const toggleTheme = () => setIsDark(!isDark);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollHeader(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification({ type: null, message: '' });
    }, 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitState === 'submitted' || submitState === 'submitting') return;

    // Check if email already submitted (client-side check)
    const submittedEmails = JSON.parse(localStorage.getItem('cluso_waitlist') || '[]');
    if (submittedEmails.includes(email.toLowerCase())) {
      setSubmitState('submitted');
      setEmail('');
      showNotification('success', "You're already on the waitlist!");
      return;
    }

    setSubmitState('submitting');

    try {
      const response = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      // Save to localStorage regardless of response (for duplicate detection)
      submittedEmails.push(email.toLowerCase());
      localStorage.setItem('cluso_waitlist', JSON.stringify(submittedEmails));

      setSubmitState('submitted');
      setEmail('');

      if (response.ok) {
        showNotification('success', "You're on the list! Check your email.");
      } else {
        // Still show success to user, we saved their email locally
        showNotification('success', "You're on the list!");
      }
    } catch (error) {
      console.error('Error:', error);
      // Still save locally and show success
      submittedEmails.push(email.toLowerCase());
      localStorage.setItem('cluso_waitlist', JSON.stringify(submittedEmails));
      setSubmitState('submitted');
      setEmail('');
      showNotification('success', "You're on the list!");
    }
  };

  const getButtonText = () => {
    switch (submitState) {
      case 'submitting': return 'Joining...';
      case 'submitted': return 'Joined';
      default: return 'Join Waitlist';
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className={`landing-page ${isDark ? '' : 'light'}`}>
        {/* Notification Toast */}
        {notification.type && (
          <div className={`notification-toast ${notification.type}`}>
            {notification.message}
          </div>
        )}

        {/* Sticky Scroll Header */}
        <div className={`scroll-header ${showScrollHeader ? 'visible' : ''}`}>
          <div className="scroll-header-left">
            <img
              src="/icon.png"
              alt="Cluso"
              style={{ height: '35px', width: 'auto' }}
            />
          </div>
          <div className="scroll-header-right">
            <form className="scroll-email-form" onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Enter email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </form>
            <button type="submit" className="btn btn-primary" onClick={handleSubmit} disabled={submitState === 'submitting' || submitState === 'submitted'}>
              {getButtonText()}
            </button>
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

        {/* Navigation */}
        <nav className="landing-nav">
          <div className="nav-container">
            <img
              src={isDark ? '/logo_dark.png' : '/logo_light.png'}
              alt="Cluso"
              className="logo"
              style={{ height: '64px', width: 'auto' }}
            />
            <div className="nav-links">
              <a href="#features">Features</a>
              <a href="#docs">Documentation</a>
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

        {/* Hero Section */}
        <section className="hero">
          <a href="#downloads" className="hero-badge" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="dot"></span>
            <span>Download 3 Day Trial</span>
          </a>

          <h1>
            The <span className="gradient">AI-powered</span> browser<br />for frontend development
          </h1>

          <p className="hero-subtitle">
            Inspect any element on the web, describe your changes with your voice, and see them live instantly.
            The AI-powered browser for developers who think faster than they type.
          </p>

          <form className="email-form" onSubmit={handleSubmit} id="download">
            <div className="email-form-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <input
              id="hero-email"
              type="email"
              placeholder="Enter your email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={submitState === 'submitting' || submitState === 'submitted'}>
              {getButtonText()}
            </button>
          </form>

          <p className="hero-note">Join for early access</p>

          <div className="hero-image">
            <img
              src="/screenshot1.png"
              alt="Cluso app screenshot showing AI-powered browser development"
              style={{
                width: '100%',
                borderRadius: '16px',
                boxShadow: isDark
                  ? '0 25px 80px -12px rgba(0, 0, 0, 0.7), 0 10px 30px -5px rgba(0, 0, 0, 0.4)'
                  : '0 25px 60px -12px rgba(0, 0, 0, 0.25), 0 10px 20px -5px rgba(0, 0, 0, 0.1)',
                border: '1px solid var(--border)'
              }}
            />
          </div>
        </section>

        {/* Comparison Matrix */}
        <FeatureComparison />

        {/* Features Section */}
        <section className="features" id="features">
          <div className="section-header">
            <p className="section-label">How It Works</p>
            <h2 className="section-title">Three simple steps to faster development</h2>
            <p className="section-subtitle">
              Cluso combines visual element selection with AI-powered code generation
              to supercharge your frontend workflow.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-content">
                <div className="feature-number">1</div>
                <h3>Point & Select</h3>
                <p>
                  Click on any element in your page to select it. Cluso automatically
                  captures the HTML, CSS, and context needed for AI to understand what
                  you're working with.
                </p>
              </div>
              <div className="feature-image" style={{ padding: 0, overflow: 'hidden', background: '#0a0a0a' }}>
                <PointSelectDemo />
                <p style={{ fontSize: '10px', color: '#666', textAlign: 'center', margin: '8px 0 4px', fontStyle: 'italic' }}>Animation indicative, does not reflect the final version</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-content">
                <div className="feature-number">2</div>
                <h3>Talk to AI</h3>
                <p>
                  Use your voice or type to describe what changes you want.
                  "Make this button bigger", "Change the color to blue",
                  "Add a hover animation" - just say it.
                </p>
              </div>
              <div className="feature-image" style={{ padding: 0, overflow: 'hidden', background: '#0a0a0a' }}>
                <TalkToAIDemo />
                <p style={{ fontSize: '10px', color: '#666', textAlign: 'center', margin: '8px 0 4px', fontStyle: 'italic' }}>Animation indicative, does not reflect the final version</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-content">
                <div className="feature-number">3</div>
                <h3>Preview & Apply</h3>
                <p>
                  See changes instantly in your browser. Preview the before/after,
                  approve what you like, or reject and try again. Your code updates
                  in real-time.
                </p>
              </div>
              <div className="feature-image" style={{ padding: 0, overflow: 'hidden', background: '#0a0a0a' }}>
                <PreviewApplyDemo />
                <p style={{ fontSize: '10px', color: '#666', textAlign: 'center', margin: '8px 0 4px', fontStyle: 'italic' }}>Animation indicative, does not reflect the final version</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta">
          <div className="cta-content">
            <h2>Ready to build faster?</h2>
            <p>
              Download Cluso for free and transform how you build user interfaces.
            </p>
            <div className="cta-buttons">
              <a href="#downloads" className="btn btn-primary btn-large" style={{ backgroundColor: 'white', color: 'black' }}>
                Download Now
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="footer-container">
            <div className="footer-top">
              <div className="footer-brand">
                <img src={isDark ? '/logo_dark.png' : '/logo_light.png'} alt="Cluso" className="logo" style={{ height: '56px', width: 'auto', marginBottom: '1rem' }} />
                <p>
                  AI-powered browser dev tools that let you build UIs
                  with your voice. Open source and free forever.
                </p>
                <form className="email-form footer-email-form" onSubmit={handleSubmit} style={{ width: '100%', marginLeft: 'auto', marginRight: 'auto' }}>
                  <div className="email-form-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <input
                    type="email"
                    placeholder="Enter your email..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-primary" disabled={submitState === 'submitting' || submitState === 'submitted'}>
                    {getButtonText()}
                  </button>
                </form>
              </div>

              <div className="footer-links">
                <h4>Product</h4>
                <ul>
                  <li><a href="#features">Features</a></li>
                  <li><a href="#downloads">Download</a></li>
                </ul>
              </div>

              <div className="footer-links">
                <h4>Resources</h4>
                <ul>
                  <li><a href="#docs" >Documentation</a></li>
                </ul>
              </div>

              <div className="footer-links">
                <h4>Connect</h4>
                <ul>
                  <li><a href="#">Twitter</a></li>
                  <li><a href="mailto:hello@cluso.dev">Contact</a></li>
                </ul>
              </div>
            </div>

            <div className="footer-bottom">
              <span>&copy; 2024 Cluso. All rights reserved.</span>
              <div className="social-links">
                <a href="#" aria-label="Twitter">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
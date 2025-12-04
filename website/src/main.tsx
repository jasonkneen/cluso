import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { LandingPage } from './LandingPage';
import { DownloadsPage } from './DownloadsPage';
import { PlansPage } from './PlansPage';
import { DocumentationPage } from './DocumentationPage';

const App = () => {
  const [currentPage, setCurrentPage] = useState<'landing' | 'downloads' | 'plans' | 'docs'>('landing');
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Handle hash-based routing
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'downloads') {
        setCurrentPage('downloads');
      } else if (hash === 'plans') {
        setCurrentPage('plans');
      } else if (hash === 'docs') {
        setCurrentPage('docs');
      } else {
        setCurrentPage('landing');
      }
    };

    // Set initial page based on URL
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    // Update URL when page changes
    if (currentPage === 'downloads') {
      window.location.hash = '#downloads';
    } else if (currentPage === 'plans') {
      window.location.hash = '#plans';
    } else if (currentPage === 'docs') {
      window.location.hash = '#docs';
    } else {
      window.location.hash = '';
    }
  }, [currentPage]);

  const toggleTheme = () => setIsDark(!isDark);

  if (currentPage === 'downloads') {
    return <DownloadsPage />;
  } else if (currentPage === 'plans') {
    return <PlansPage isDark={isDark} onToggleTheme={toggleTheme} />;
  } else if (currentPage === 'docs') {
    return <DocumentationPage isDark={isDark} onToggleTheme={toggleTheme} />;
  }
  return <LandingPage />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { LandingPage } from './LandingPage';
import { DownloadsPage } from './DownloadsPage';

const App = () => {
  const [currentPage, setCurrentPage] = useState<'landing' | 'downloads'>('landing');

  useEffect(() => {
    // Handle hash-based routing
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'downloads') {
        setCurrentPage('downloads');
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
    window.location.hash = currentPage === 'downloads' ? '#downloads' : '';
  }, [currentPage]);

  return currentPage === 'downloads' ? <DownloadsPage /> : <LandingPage />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
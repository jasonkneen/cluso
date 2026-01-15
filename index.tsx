import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AppProviders } from './components/AppProviders';
import { initSourceLocationTracking } from './utils/source-location';

// Initialize source location tracking for inspector
initSourceLocationTracking();

// Global error handlers to prevent app crashes from module loading failures
// (e.g., Vite HMR stale dependencies, network errors on dynamic imports)
window.addEventListener('error', (event) => {
  // Check if it's a module loading error
  if (event.message?.includes('dynamically imported module') ||
      event.message?.includes('Failed to fetch') ||
      event.message?.includes('Loading chunk')) {
    console.error('[GlobalErrorHandler] Module loading failed:', event.message);
    // Prevent the error from crashing the app
    event.preventDefault();
    // Show a non-intrusive notification instead of crashing
    console.warn('[GlobalErrorHandler] A component failed to load. Try refreshing the page.');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || String(event.reason);
  // Check if it's a dynamic import rejection
  if (reason?.includes('dynamically imported module') ||
      reason?.includes('Failed to fetch') ||
      reason?.includes('Loading chunk')) {
    console.error('[GlobalErrorHandler] Async module loading failed:', reason);
    // Prevent the rejection from crashing the app
    event.preventDefault();
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);

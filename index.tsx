import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initSourceLocationTracking } from './utils/source-location';

// Initialize source location tracking for inspector
initSourceLocationTracking();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
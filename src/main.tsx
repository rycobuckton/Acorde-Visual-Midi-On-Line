import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handlers to prevent file permission handle revocations or AudioBuffer allocation errors from causing unhandled crashes
window.addEventListener('unhandledrejection', (event) => {
  const reasonStr = String(event.reason?.message || event.reason || '');
  if (
    reasonStr.includes('The requested file could not be read') ||
    reasonStr.includes('createBuffer') ||
    reasonStr.includes('permission problems') ||
    reasonStr.includes('NotReadableError')
  ) {
    event.preventDefault(); // Prevent default browser unhandled error overlay
    event.stopImmediatePropagation();
    console.warn('[Studio-SF2 System] Handled browser resource limit exception:', reasonStr);
  }
}, true);

window.addEventListener('error', (event) => {
  const msg = String(event.message || event.error?.message || '');
  if (
    msg.includes('The requested file could not be read') ||
    msg.includes('permission problems') ||
    msg.includes('NotReadableError')
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    console.warn('[Studio-SF2 System] Handled browser file error:', msg);
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


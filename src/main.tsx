import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('error', function (e) {
  const el = document.getElementById('runtime-error-display');
  if (!el) {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'runtime-error-display';
    errorDiv.style.cssText = 'color:#ff4444;background:#18181b;border:2px solid #ff4444;border-radius:8px;padding:20px;margin:16px;font-family:monospace;font-size:14px;white-space:pre-wrap;z-index:999999;position:relative;';
    errorDiv.innerHTML = `<b>Runtime Error:</b>\n${e.message || String(e)}\n\n<b>File:</b> ${e.filename || 'unknown'}:${e.lineno || ''}:${e.colno || ''}\n\n<b>Stack:</b>\n${e.error?.stack || 'N/A'}`;
    document.body.appendChild(errorDiv);
  }
});

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}


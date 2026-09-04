import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { ToastProvider } from './components/ToastContext.jsx'

// Global Unhandled Rejection & Error Trap
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[Global Resilience Trap] Caught unhandled promise rejection:', event.reason);
    event.preventDefault(); // Prevents browser console crashing
  });

  window.addEventListener('error', (event) => {
    console.warn('[Global Resilience Trap] Caught runtime error:', event.message, event.filename, event.lineno);
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)


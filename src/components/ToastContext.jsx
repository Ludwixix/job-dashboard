import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full font-mono">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-3.5 rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 ${
              toast.type === 'success'
                ? 'bg-slate-900 border-2 border-emerald-500 text-white'
                : toast.type === 'error'
                ? 'bg-rose-950 border-2 border-rose-500 text-rose-100'
                : 'bg-slate-800 border-2 border-indigo-500 text-white'
            }`}
          >
            <div
              className={`p-2 rounded-xl shrink-0 ${
                toast.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : toast.type === 'error'
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-indigo-500/20 text-indigo-400'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : toast.type === 'error' ? <XCircle size={18} /> : <Info size={18} />}
            </div>
            <div className="flex-1 mt-0.5">
              <p className="text-xs font-bold leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

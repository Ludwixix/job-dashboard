import React from 'react';
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearSession = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-5">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-100 font-sans tracking-tight">Something went wrong</h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              We encountered an unexpected application error. You can reload the application or reset your local session state to recover.
            </p>
            {this.state.error && (
              <div className="p-3 bg-slate-950 rounded-xl text-left max-h-28 overflow-auto border border-slate-800">
                <pre className="text-[11px] text-rose-300 font-mono whitespace-pre-wrap break-all">
                  {this.state.error.message || this.state.error.toString()}
                </pre>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <RefreshCcw size={15} />
                Reload App
              </button>
              <button
                onClick={this.handleClearSession}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Trash2 size={15} />
                Clear Session
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

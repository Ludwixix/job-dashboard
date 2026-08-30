import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

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

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-rose-200">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2 font-sans tracking-tight">Something went wrong</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-8 font-sans leading-relaxed">
            We encountered an unexpected error while rendering this component.
            Our team has been notified.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              <RefreshCcw size={18} />
              RELOAD APPLICATION
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold transition-all shadow-sm cursor-pointer"
            >
              TRY AGAIN
            </button>
          </div>
          {this.state.error && (
            <div className="mt-8 p-4 bg-slate-100 rounded-xl text-left max-w-2xl w-full overflow-auto">
              <pre className="text-[10px] text-slate-500 font-mono">
                {this.state.error.toString()}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

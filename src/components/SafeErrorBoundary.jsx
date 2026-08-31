import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class SafeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[SafeErrorBoundary:${this.props.sectionName || 'Component'}] caught error:`, error, errorInfo);
    this.setState({ error, errorInfo });
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (e) {
        console.warn('Error in onError callback:', e);
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        console.warn('Error in onReset callback:', e);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
          : this.props.fallback;
      }

      const isCompact = this.props.compact || this.props.sectionName === 'Card';

      if (isCompact) {
        return (
          <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/40 text-slate-300 font-mono text-xs flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={14} className="shrink-0" />
              <span className="font-bold truncate max-w-[200px]">
                {this.props.sectionName || 'Component'} issue
              </span>
            </div>
            <button
              onClick={this.handleReset}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw size={10} /> Retry
            </button>
          </div>
        );
      }

      return (
        <div className="p-6 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-xl my-4 text-center max-w-lg mx-auto font-sans">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
            <AlertTriangle size={24} />
          </div>
          <h3 className="font-black text-white text-base mb-1">
            {this.props.sectionName || 'Section'} Recovered Gracefully
          </h3>
          <p className="text-slate-400 text-xs mb-4 font-mono">
            An unexpected error occurred in this module, but the rest of the application remains fully functional.
          </p>
          <button
            onClick={this.handleReset}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all flex items-center gap-2 mx-auto cursor-pointer shadow-md"
          >
            <RefreshCw size={14} />
            RELOAD {this.props.sectionName?.toUpperCase() || 'MODULE'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

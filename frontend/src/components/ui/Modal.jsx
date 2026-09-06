import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
  '4xl': 'max-w-6xl',
  full: 'max-w-[95vw]'
};

export const Modal = ({
  isOpen = true,
  onClose,
  title,
  subtitle,
  badge,
  icon: Icon,
  size = 'xl',
  nested = false,
  children,
  footer,
  className = '',
  bodyClassName = ''
}) => {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const zIndexClass = nested ? 'z-[60]' : 'z-50';
  const sizeClass = SIZES[size] || SIZES.xl;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-150`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className={`bg-slate-900 rounded-2xl border border-slate-700/60 shadow-2xl flex flex-col w-full max-h-[92vh] overflow-hidden ${sizeClass} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        {(title || onClose) && (
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {Icon && (
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
                  <Icon size={16} />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {title && (
                    <h2 className="text-sm sm:text-base font-black text-white font-mono uppercase tracking-wide truncate">
                      {title}
                    </h2>
                  )}
                  {badge}
                </div>
                {subtitle && (
                  <p className="text-xs text-slate-400 truncate mt-0.5 font-sans">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 sm:p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer border border-slate-700/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className={`p-4 sm:p-6 overflow-y-auto flex-1 font-sans ${bodyClassName}`}>
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};


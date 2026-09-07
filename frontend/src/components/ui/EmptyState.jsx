import React from 'react';
import { SearchX } from 'lucide-react';

/**
 * EmptyState — reusable zero-results / empty-data block.
 * Props: icon, title, description, action (React node), compact, className
 */
export const EmptyState = ({
  icon: Icon = SearchX,
  title = 'Nothing here yet',
  description,
  action,
  className = '',
  compact = false,
}) => {
  const paddingClass = compact ? 'py-8 px-4' : 'py-16 px-6';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center text-center ${paddingClass} ${className}`}
    >
      <div className="mb-4 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50 text-slate-500">
        <Icon size={compact ? 24 : 32} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-bold text-slate-300 font-mono uppercase tracking-wide mb-1.5">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};

export default EmptyState;

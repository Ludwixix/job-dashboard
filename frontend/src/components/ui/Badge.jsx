import React from 'react';

const VARIANTS = {
  cyan: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40',
  emerald: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
  indigo: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40',
  amber: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
  rose: 'bg-rose-950/80 text-rose-300 border-rose-500/40',
  teal: 'bg-teal-950/80 text-teal-300 border-teal-500/40',
  slate: 'bg-slate-800 text-slate-300 border-slate-700/80',
  bronze: 'bg-amber-950/60 text-amber-300 border-amber-600/40'
};

const SIZES = {
  xs: 'px-1.5 py-0.5 text-[9px]',
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs'
};

export const Badge = ({
  children,
  variant = 'slate',
  size = 'sm',
  className = '',
  icon: Icon,
  ...props
}) => {
  const variantClass = VARIANTS[variant] || VARIANTS.slate;
  const sizeClass = SIZES[size] || SIZES.sm;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-mono font-bold uppercase tracking-wider ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {Icon && <Icon size={11} className="shrink-0" />}
      {children}
    </span>
  );
};


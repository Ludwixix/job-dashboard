import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 border border-indigo-500/60',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 shadow-xs',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 border border-emerald-500/60',
  danger: 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 shadow-xs',
  ghost: 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent',
  hud: 'bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 shadow-xs',
  bronze: 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/40 shadow-xs'
};

const SIZES = {
  xs: 'px-2 py-1 text-[10px] font-bold',
  sm: 'px-2.5 py-1.5 text-xs font-bold',
  md: 'px-3.5 py-2 text-xs font-bold',
  lg: 'px-5 py-2.5 text-sm font-bold',
  icon: 'p-2'
};

export const Button = React.forwardRef(({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  icon: Icon,
  type = 'button',
  ...props
}, ref) => {
  const variantClasses = VARIANTS[variant] || VARIANTS.secondary;
  const sizeClasses = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-mono uppercase tracking-wider transition-all duration-150 cursor-pointer select-none active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed ${variantClasses} ${sizeClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 size={13} className="animate-spin text-current shrink-0" />
      ) : Icon ? (
        <Icon size={13} className="shrink-0" />
      ) : null}
      {children}
    </button>
  );
});

Button.displayName = 'Button';


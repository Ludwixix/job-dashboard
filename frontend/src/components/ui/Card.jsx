import React from 'react';

export const Card = ({
  children,
  interactive = false,
  hoverLift = false,
  padding = 'md',
  className = '',
  onClick,
  ...props
}) => {
  const paddings = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  const interactiveClasses = interactive
    ? 'cursor-pointer hover:border-indigo-500/50 hover:bg-slate-800/90 transition-all'
    : '';

  const liftClasses = hoverLift ? 'card-hover-lift' : '';

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800/80 shadow-md ${paddings[padding] || paddings.md} ${interactiveClasses} ${liftClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};


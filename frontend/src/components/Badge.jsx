import React from 'react';
import { getStatusStyle } from '../utils/statusStyles';

export const Badge = ({ status, size = 'normal' }) => {
  const config = getStatusStyle(status);

  const sizeClasses = size === 'small' 
    ? 'px-2 py-0.5 text-[11px] font-bold' 
    : 'px-2.5 py-1 text-xs font-mono font-bold tracking-wider';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}>
      <span className={`w-2 h-2 rounded-sm ${config.dot}`} />
      <span>{status}</span>
    </span>
  );
};

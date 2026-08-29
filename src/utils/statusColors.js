export const getStatusConfig = (status = '') => {
  const s = status.toLowerCase();

  if (s.includes('interview')) {
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-900',
      border: 'border-emerald-300',
      dot: 'bg-emerald-600',
      code: 'INTV'
    };
  }
  if (s.includes('action required') || s.includes('verification')) {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-900',
      border: 'border-amber-300',
      dot: 'bg-amber-600',
      code: 'ACTN'
    };
  }
  if (s.includes('package prepared') || s.includes('to submit')) {
    return {
      bg: 'bg-indigo-50',
      text: 'text-indigo-900',
      border: 'border-indigo-300',
      dot: 'bg-indigo-600',
      code: 'PREP'
    };
  }
  if (s.includes('applied') || s.includes('viewed') || s.includes('confirmation')) {
    return {
      bg: 'bg-blue-50',
      text: 'text-blue-900',
      border: 'border-blue-300',
      dot: 'bg-blue-600',
      code: 'APPL'
    };
  }
  if (s.includes('under review')) {
    return {
      bg: 'bg-purple-50',
      text: 'text-purple-900',
      border: 'border-purple-300',
      dot: 'bg-purple-600',
      code: 'REVW'
    };
  }
  if (s.includes('unsuccessful') || s.includes('rejected')) {
    return {
      bg: 'bg-rose-50',
      text: 'text-rose-900',
      border: 'border-rose-300',
      dot: 'bg-rose-600',
      code: 'REJ'
    };
  }
  if (s.includes('closed') || s.includes('expired')) {
    return {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-300',
      dot: 'bg-slate-500',
      code: 'CLSD'
    };
  }

  // Default
  return {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-300',
    dot: 'bg-slate-600',
    code: 'STAT'
  };
};

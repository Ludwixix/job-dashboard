/**
 * statusStyles.js
 * ----------------
 * Single source of truth for job/application status visual tokens.
 */

export const STATUS_STYLES = {
  sourced: {
    label: 'Sourced',
    bg: 'bg-slate-700/60',
    text: 'text-slate-300',
    border: 'border-slate-600/50',
    dot: 'bg-slate-400',
    ring: 'ring-slate-500/40',
  },
  shortlisted: {
    label: 'Shortlisted',
    bg: 'bg-cyan-950/70',
    text: 'text-cyan-300',
    border: 'border-cyan-600/50',
    dot: 'bg-cyan-400',
    ring: 'ring-cyan-500/40',
  },
  applied: {
    label: 'Applied',
    bg: 'bg-indigo-950/70',
    text: 'text-indigo-300',
    border: 'border-indigo-600/50',
    dot: 'bg-indigo-400',
    ring: 'ring-indigo-500/40',
  },
  interviewing: {
    label: 'Interviewing',
    bg: 'bg-amber-950/70',
    text: 'text-amber-300',
    border: 'border-amber-600/50',
    dot: 'bg-amber-400',
    ring: 'ring-amber-500/40',
  },
  offer: {
    label: 'Offer',
    bg: 'bg-emerald-950/70',
    text: 'text-emerald-300',
    border: 'border-emerald-600/50',
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-500/40',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-950/70',
    text: 'text-rose-400',
    border: 'border-rose-700/50',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500/40',
  },
};

const FALLBACK = {
  label: 'Unknown',
  bg: 'bg-slate-800/60',
  text: 'text-slate-400',
  border: 'border-slate-600/40',
  dot: 'bg-slate-500',
  ring: 'ring-slate-500/30',
};

export function getStatusStyle(status) {
  return STATUS_STYLES[status?.toLowerCase()] ?? FALLBACK;
}

export function statusBadgeClass(status, extra = '') {
  const s = getStatusStyle(status);
  return `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider border ${s.bg} ${s.text} ${s.border} ${extra}`.trim();
}

export function statusDotClass(status) {
  const s = getStatusStyle(status);
  return `inline-block w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`;
}

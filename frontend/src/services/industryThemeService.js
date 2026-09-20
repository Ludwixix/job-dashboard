/**
 * industryThemeService.js
 * Provides subtle, elegant color themes tailored for each candidate industry.
 * Applies CSS custom variables with smooth transitions when scraper results return.
 */

export const INDUSTRY_THEMES = {
  'Technology & IT': {
    name: 'Technology & IT',
    accent: '#6366f1', // Indigo
    accentRgb: '99, 102, 241',
    light: '#818cf8',
    glow: 'rgba(99, 102, 241, 0.15)',
    border: 'rgba(99, 102, 241, 0.35)',
    subtle: 'rgba(99, 102, 241, 0.05)',
    badgeBg: 'rgba(49, 46, 129, 0.6)',
    badgeText: '#a5b4fc',
    gradient: 'from-indigo-950/40 via-slate-900 to-slate-950',
    tag: 'CYBER INDIGO'
  },
  'Healthcare & Medical': {
    name: 'Healthcare & Medical',
    accent: '#10b981', // Emerald / Teal
    accentRgb: '16, 185, 129',
    light: '#34d399',
    glow: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.35)',
    subtle: 'rgba(16, 185, 129, 0.05)',
    badgeBg: 'rgba(6, 78, 59, 0.6)',
    badgeText: '#6ee7b7',
    gradient: 'from-emerald-950/40 via-slate-900 to-slate-950',
    tag: 'CLINICAL EMERALD'
  },
  'Finance & Accounting': {
    name: 'Finance & Accounting',
    accent: '#f59e0b', // Amber / Gold
    accentRgb: '245, 158, 11',
    light: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.35)',
    subtle: 'rgba(245, 158, 11, 0.05)',
    badgeBg: 'rgba(120, 53, 15, 0.6)',
    badgeText: '#fde68a',
    gradient: 'from-amber-950/40 via-slate-900 to-slate-950',
    tag: 'FINANCIAL GOLD'
  },
  'Marketing & Sales': {
    name: 'Marketing & Sales',
    accent: '#f43f5e', // Rose / Coral
    accentRgb: '244, 63, 94',
    light: '#fb7185',
    glow: 'rgba(244, 63, 94, 0.15)',
    border: 'rgba(244, 63, 94, 0.35)',
    subtle: 'rgba(244, 63, 94, 0.05)',
    badgeBg: 'rgba(136, 19, 55, 0.6)',
    badgeText: '#fecdd3',
    gradient: 'from-rose-950/40 via-slate-900 to-slate-950',
    tag: 'DYNAMIC ROSE'
  },
  'Construction & Trades': {
    name: 'Construction & Trades',
    accent: '#ea580c', // Safety Orange
    accentRgb: '234, 88, 12',
    light: '#fb923c',
    glow: 'rgba(234, 88, 12, 0.15)',
    border: 'rgba(234, 88, 12, 0.35)',
    subtle: 'rgba(234, 88, 12, 0.05)',
    badgeBg: 'rgba(124, 45, 18, 0.6)',
    badgeText: '#fed7aa',
    gradient: 'from-orange-950/40 via-slate-900 to-slate-950',
    tag: 'INDUSTRIAL ORANGE'
  },
  'Education': {
    name: 'Education',
    accent: '#0ea5e9', // Sky Blue
    accentRgb: '14, 165, 233',
    light: '#38bdf8',
    glow: 'rgba(14, 165, 233, 0.15)',
    border: 'rgba(14, 165, 233, 0.35)',
    subtle: 'rgba(14, 165, 233, 0.05)',
    badgeBg: 'rgba(12, 74, 110, 0.6)',
    badgeText: '#bae6fd',
    gradient: 'from-sky-950/40 via-slate-900 to-slate-950',
    tag: 'ACADEMIC SKY'
  },
  'Legal': {
    name: 'Legal',
    accent: '#a855f7', // Purple
    accentRgb: '168, 85, 247',
    light: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.15)',
    border: 'rgba(168, 85, 247, 0.35)',
    subtle: 'rgba(168, 85, 247, 0.05)',
    badgeBg: 'rgba(88, 28, 135, 0.6)',
    badgeText: '#e9d5ff',
    gradient: 'from-purple-950/40 via-slate-900 to-slate-950',
    tag: 'JURIS PURPLE'
  },
  'HR & People': {
    name: 'HR & People',
    accent: '#ec4899', // Pink / Magenta
    accentRgb: '236, 72, 153',
    light: '#f472b6',
    glow: 'rgba(236, 72, 153, 0.15)',
    border: 'rgba(236, 72, 153, 0.35)',
    subtle: 'rgba(236, 72, 153, 0.05)',
    badgeBg: 'rgba(131, 24, 67, 0.6)',
    badgeText: '#fbcfe8',
    gradient: 'from-pink-950/40 via-slate-900 to-slate-950',
    tag: 'PEOPLE MAGENTA'
  },
  'Retail & Hospitality': {
    name: 'Retail & Hospitality',
    accent: '#84cc16', // Lime
    accentRgb: '132, 204, 22',
    light: '#a3e635',
    glow: 'rgba(132, 204, 22, 0.15)',
    border: 'rgba(132, 204, 22, 0.35)',
    subtle: 'rgba(132, 204, 22, 0.05)',
    badgeBg: 'rgba(54, 83, 20, 0.6)',
    badgeText: '#d9f99d',
    gradient: 'from-lime-950/40 via-slate-900 to-slate-950',
    tag: 'VIBRANT LIME'
  },
  'Engineering': {
    name: 'Engineering',
    accent: '#06b6d4', // Cyan
    accentRgb: '6, 182, 212',
    light: '#22d3ee',
    glow: 'rgba(6, 182, 212, 0.15)',
    border: 'rgba(6, 182, 212, 0.35)',
    subtle: 'rgba(6, 182, 212, 0.05)',
    badgeBg: 'rgba(22, 78, 99, 0.6)',
    badgeText: '#a5f3fc',
    gradient: 'from-cyan-950/40 via-slate-900 to-slate-950',
    tag: 'PRECISION CYAN'
  },
  'Logistics & Supply Chain': {
    name: 'Logistics & Supply Chain',
    accent: '#d97706', // Bronze Amber
    accentRgb: '217, 119, 6',
    light: '#f59e0b',
    glow: 'rgba(217, 119, 6, 0.15)',
    border: 'rgba(217, 119, 6, 0.35)',
    subtle: 'rgba(217, 119, 6, 0.05)',
    badgeBg: 'rgba(120, 53, 15, 0.6)',
    badgeText: '#fde68a',
    gradient: 'from-amber-950/40 via-slate-900 to-slate-950',
    tag: 'LOGISTICS BRONZE'
  },
  'Creative & Design': {
    name: 'Creative & Design',
    accent: '#d946ef', // Fuchsia / Neon Pink
    accentRgb: '217, 70, 239',
    light: '#e879f9',
    glow: 'rgba(217, 70, 239, 0.15)',
    border: 'rgba(217, 70, 239, 0.35)',
    subtle: 'rgba(217, 70, 239, 0.05)',
    badgeBg: 'rgba(112, 26, 117, 0.6)',
    badgeText: '#f5d0fe',
    gradient: 'from-fuchsia-950/40 via-slate-900 to-slate-950',
    tag: 'CREATIVE FUCHSIA'
  }
};

export const TIER_THEMES = {
  free: {
    tier: 'free',
    label: 'FREE TIER',
    isPremium: false,
    cardBg: 'var(--bg-surface)',
    cardBackdrop: 'none',
    cardBorder: 'var(--industry-border)',
    badgeBg: 'rgba(30, 41, 59, 0.7)',
    badgeBorder: 'rgba(71, 85, 105, 0.4)',
    badgeText: '#cbd5e1',
    crownColor: '#f59e0b',
    auraOpacity: '0.08',
    haloGradient: 'radial-gradient(ellipse 90% 55% at 50% -10%, var(--industry-glow), transparent 75%)',
    tag: 'DEVELOPER & BYO KEY'
  },
  pro: {
    tier: 'pro',
    label: 'PRO SUBSCRIBER',
    isPremium: true,
    cardBg: 'rgba(18, 22, 33, 0.72)',
    cardBackdrop: 'blur(16px)',
    cardBorder: 'rgba(16, 185, 129, 0.28)',
    badgeBg: 'linear-gradient(135deg, rgba(6, 78, 59, 0.85), rgba(15, 23, 42, 0.9))',
    badgeBorder: 'rgba(52, 211, 153, 0.45)',
    badgeText: '#6ee7b7',
    crownColor: '#10b981',
    auraOpacity: '0.22',
    haloGradient: 'radial-gradient(ellipse 95% 65% at 50% -8%, rgba(16, 185, 129, 0.20), var(--industry-glow), transparent 75%)',
    tag: 'PRO JOB HUNTER // BUILT-IN AI'
  },
  pass: {
    tier: 'pass',
    label: 'CAREER PASS VIP',
    isPremium: true,
    cardBg: 'rgba(18, 22, 33, 0.72)',
    cardBackdrop: 'blur(16px)',
    cardBorder: 'rgba(6, 182, 212, 0.32)',
    badgeBg: 'linear-gradient(135deg, rgba(22, 78, 99, 0.85), rgba(15, 23, 42, 0.9))',
    badgeBorder: 'rgba(34, 211, 238, 0.45)',
    badgeText: '#a5f3fc',
    crownColor: '#06b6d4',
    auraOpacity: '0.24',
    haloGradient: 'radial-gradient(ellipse 95% 65% at 50% -8%, rgba(6, 182, 212, 0.20), var(--industry-glow), transparent 75%)',
    tag: 'CAREER PASS VIP // 90-DAY ALL-INCLUSIVE'
  }
};

/**
 * Get the tier theme config from billingStatus
 */
export const getTierTheme = (billingStatus) => {
  if (!billingStatus || !billingStatus.is_active) {
    return TIER_THEMES.free;
  }
  const plan = billingStatus.plan_tier || '';
  if (plan === 'pass_3mo') {
    return TIER_THEMES.pass;
  }
  return TIER_THEMES.pro;
};

/**
 * Get the theme config for a given industry name (falls back to Technology & IT)
 */
export const getIndustryTheme = (industryName) => {
  if (!industryName) return INDUSTRY_THEMES['Technology & IT'];
  return INDUSTRY_THEMES[industryName] || INDUSTRY_THEMES['Technology & IT'];
};

/**
 * Smoothly applies the industry and subscription tier CSS custom variables onto the root document element.
 */
export const applyIndustryTheme = (industryName, billingStatus = null) => {
  if (typeof document === 'undefined') return;
  const industryTheme = getIndustryTheme(industryName);
  const tierTheme = getTierTheme(billingStatus);
  const root = document.documentElement;

  // Industry custom properties
  root.style.setProperty('--industry-accent', industryTheme.accent);
  root.style.setProperty('--industry-accent-rgb', industryTheme.accentRgb);
  root.style.setProperty('--industry-light', industryTheme.light);
  root.style.setProperty('--industry-glow', industryTheme.glow);
  root.style.setProperty('--industry-border', industryTheme.border);
  root.style.setProperty('--industry-subtle', industryTheme.subtle);
  root.style.setProperty('--industry-badge-bg', industryTheme.badgeBg);
  root.style.setProperty('--industry-badge-text', industryTheme.badgeText);
  root.style.setProperty('--industry-tag', industryTheme.tag);
  root.style.setProperty('--industry-name', industryTheme.name);
  root.setAttribute('data-industry', industryTheme.name);

  // Subscription tier custom properties & attributes
  root.setAttribute('data-tier', tierTheme.tier);
  root.setAttribute('data-premium', tierTheme.isPremium ? 'true' : 'false');
  root.style.setProperty('--tier-is-premium', tierTheme.isPremium ? '1' : '0');
  root.style.setProperty('--tier-label', tierTheme.label);
  root.style.setProperty('--tier-tag', tierTheme.tag);
  root.style.setProperty('--tier-card-bg', tierTheme.cardBg);
  root.style.setProperty('--tier-card-backdrop', tierTheme.cardBackdrop);
  root.style.setProperty('--tier-card-border', tierTheme.cardBorder);
  root.style.setProperty('--tier-crown-color', tierTheme.crownColor);
  root.style.setProperty('--tier-aura-opacity', tierTheme.auraOpacity);
  root.style.setProperty('--tier-halo-gradient', tierTheme.haloGradient);

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('industryThemeChange', {
        detail: {
          industry: industryTheme,
          tier: tierTheme
        }
      }));
    } catch {
      // Ignore if CustomEvent not supported in test environment
    }
  }
};

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { INDUSTRY_THEMES, getIndustryTheme, applyIndustryTheme } from '../industryThemeService';

describe('industryThemeService', () => {
  beforeEach(() => {
    // Reset root attributes and style
    document.documentElement.removeAttribute('data-industry');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-industry');
  });

  it('defines theme specifications for key industry sectors', () => {
    expect(INDUSTRY_THEMES['Technology & IT']).toBeDefined();
    expect(INDUSTRY_THEMES['Healthcare & Medical']).toBeDefined();
    expect(INDUSTRY_THEMES['Finance & Accounting']).toBeDefined();
    expect(INDUSTRY_THEMES['Construction & Trades']).toBeDefined();
    expect(INDUSTRY_THEMES['Legal']).toBeDefined();
    expect(INDUSTRY_THEMES['Engineering']).toBeDefined();
  });

  it('returns Technology & IT as default fallback for unknown industry', () => {
    const fallbackTheme = getIndustryTheme('Astronaut & Space Exploration');
    expect(fallbackTheme.name).toBe('Technology & IT');
    expect(fallbackTheme.accent).toBe('#6366f1');

    const emptyTheme = getIndustryTheme('');
    expect(emptyTheme.name).toBe('Technology & IT');
  });

  it('returns correct theme colors for specified industry', () => {
    const health = getIndustryTheme('Healthcare & Medical');
    expect(health.accent).toBe('#10b981');
    expect(health.tag).toBe('CLINICAL EMERALD');

    const finance = getIndustryTheme('Finance & Accounting');
    expect(finance.accent).toBe('#f59e0b');
    expect(finance.tag).toBe('FINANCIAL GOLD');

    const legal = getIndustryTheme('Legal');
    expect(legal.accent).toBe('#a855f7');
    expect(legal.tag).toBe('JURIS PURPLE');
  });

  it('smoothly applies CSS variables onto documentElement', () => {
    applyIndustryTheme('Healthcare & Medical');

    const root = document.documentElement;
    expect(root.getAttribute('data-industry')).toBe('Healthcare & Medical');
    expect(root.style.getPropertyValue('--industry-accent')).toBe('#10b981');
    expect(root.style.getPropertyValue('--industry-tag')).toBe('CLINICAL EMERALD');
    expect(root.style.getPropertyValue('--industry-name')).toBe('Healthcare & Medical');
  });

  it('defaults to free tier attributes when no billing status is passed', () => {
    applyIndustryTheme('Technology & IT');

    const root = document.documentElement;
    expect(root.getAttribute('data-tier')).toBe('free');
    expect(root.getAttribute('data-premium')).toBe('false');
    expect(root.style.getPropertyValue('--tier-is-premium')).toBe('0');
  });

  it('applies pro_monthly premium tier attributes and variables when active', () => {
    applyIndustryTheme('Healthcare & Medical', {
      is_active: true,
      plan_tier: 'pro_monthly'
    });

    const root = document.documentElement;
    expect(root.getAttribute('data-tier')).toBe('pro');
    expect(root.getAttribute('data-premium')).toBe('true');
    expect(root.style.getPropertyValue('--tier-is-premium')).toBe('1');
    expect(root.style.getPropertyValue('--tier-label')).toBe('PRO SUBSCRIBER');
  });

  it('applies pass_3mo premium tier attributes and variables when active', () => {
    applyIndustryTheme('Legal', {
      is_active: true,
      plan_tier: 'pass_3mo'
    });

    const root = document.documentElement;
    expect(root.getAttribute('data-tier')).toBe('pass');
    expect(root.getAttribute('data-premium')).toBe('true');
    expect(root.style.getPropertyValue('--tier-is-premium')).toBe('1');
    expect(root.style.getPropertyValue('--tier-label')).toBe('CAREER PASS VIP');
  });
});

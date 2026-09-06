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
});

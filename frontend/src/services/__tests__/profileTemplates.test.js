import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  SECTOR_TEMPLATES, 
  loadSectorTemplate, 
  getActiveProfile,
  HEALTHCARE_PROFILE,
  FINANCE_PROFILE,
  TRADES_CONSTRUCTION_PROFILE,
  LEGAL_PROFILE,
  DEFAULT_USER_PROFILE
} from '../profileService';

describe('Multi-Sector Profile Templates', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('contains all 5 sector templates with complete candidate properties', () => {
    expect(SECTOR_TEMPLATES.healthcare).toBeDefined();
    expect(SECTOR_TEMPLATES.finance).toBeDefined();
    expect(SECTOR_TEMPLATES.trades).toBeDefined();
    expect(SECTOR_TEMPLATES.legal).toBeDefined();
    expect(SECTOR_TEMPLATES.technology).toBeDefined();

    // Healthcare verification
    expect(HEALTHCARE_PROFILE.name).toBe('Sarah Jenkins');
    expect(HEALTHCARE_PROFILE.industry).toBe('Healthcare & Medical');
    expect(HEALTHCARE_PROFILE.coreSkills).toContain('AHPRA');
    expect(HEALTHCARE_PROFILE.targetTitles).toContain('Registered Nurse');

    // Finance verification
    expect(FINANCE_PROFILE.name).toBe('Marcus Wong');
    expect(FINANCE_PROFILE.industry).toBe('Finance & Accounting');
    expect(FINANCE_PROFILE.coreSkills).toContain('CPA Qualification');

    // Trades verification
    expect(TRADES_CONSTRUCTION_PROFILE.name).toBe('David Miller');
    expect(TRADES_CONSTRUCTION_PROFILE.industry).toBe('Construction & Trades');
    expect(TRADES_CONSTRUCTION_PROFILE.coreSkills).toContain('White Card (CPCCWHS1001)');

    // Legal verification
    expect(LEGAL_PROFILE.name).toBe('Jessica Chen');
    expect(LEGAL_PROFILE.industry).toBe('Legal');
    expect(LEGAL_PROFILE.coreSkills).toContain('Australian Practising Certificate');
  });

  it('loadSectorTemplate updates localStorage and dispatches event', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const loaded = loadSectorTemplate('healthcare');
    expect(loaded.name).toBe('Sarah Jenkins');
    expect(loaded.targetTitles).toContain('Registered Nurse');

    const active = getActiveProfile();
    expect(active.name).toBe('Sarah Jenkins');
    expect(active.industry).toBe('Healthcare & Medical');

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'candidate-profile-updated',
        detail: expect.objectContaining({ name: 'Sarah Jenkins' }),
      })
    );
  });

  it('loadSectorTemplate falls back to default profile on unknown sector key', () => {
    const loaded = loadSectorTemplate('unknown_sector_key');
    expect(loaded.name).toBe(DEFAULT_USER_PROFILE.name);
  });
});

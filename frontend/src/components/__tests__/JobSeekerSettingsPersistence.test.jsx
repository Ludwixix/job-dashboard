import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobSeeker } from '../JobSeeker';
import { VIEW_SETTINGS_STORAGE_KEY } from '../../services/viewSettingsService';

vi.mock('../AutoApplyModal', () => ({ AutoApplyModal: () => <div data-testid="auto-apply-modal" /> }));
vi.mock('../PsychologyDecoderModal', () => ({ PsychologyDecoderModal: () => <div data-testid="psychology-modal" /> }));
vi.mock('../GeneratorModal', () => ({ GeneratorModal: () => <div data-testid="generator-modal" /> }));
vi.mock('../TopMatchesSidebar', () => ({ TopMatchesSidebar: () => <div data-testid="top-matches-sidebar" /> }));

describe('JobSeeker Sort Order & Settings Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockJobs = [
    {
      id: 'job_1',
      title: 'Senior Systems Engineer',
      company: 'Enterprise Corp',
      location: 'Melbourne VIC',
      date: '2026-10-01',
      score: 85,
      isComplete: true,
    },
    {
      id: 'job_2',
      title: 'Senior Infrastructure Specialist',
      company: 'Cloud Innovations',
      location: 'Melbourne VIC',
      date: '2026-09-28',
      score: 95,
      isComplete: true,
    }
  ];

  const profile = {
    id: 'sam_ludwig',
    name: 'Sam Ludwig',
    title: 'Senior Systems Engineer',
    targetTitles: ['Senior Systems Engineer', 'Senior Infrastructure Specialist']
  };

  const getSortSelect = () => {
    const comboboxes = screen.getAllByRole('combobox');
    return comboboxes.find(cb => 
      Array.from(cb.options || []).some(o => o.value === 'date' || o.value === 'score')
    );
  };

  it('defaults to newest jobs first (date) and displays the default sort option', () => {
    render(
      <JobSeeker
        jobs={mockJobs}
        onUpdateJob={() => {}}
        onAddJob={() => {}}
        activeProfile={profile}
      />
    );

    const sortSelect = getSortSelect();
    expect(sortSelect).toBeTruthy();
    expect(sortSelect.value).toBe('date');
    expect(screen.getByText(/MOST RECENT \(NEWEST FIRST\) \(DEFAULT\)/i)).toBeTruthy();
  });

  it('persists sort order changes to localStorage so they stick across page reloads', () => {
    const { unmount } = render(
      <JobSeeker
        jobs={mockJobs}
        onUpdateJob={() => {}}
        onAddJob={() => {}}
        activeProfile={profile}
      />
    );

    const sortSelect = getSortSelect();
    expect(sortSelect).toBeTruthy();

    // Change sort order to 'score'
    fireEvent.change(sortSelect, { target: { value: 'score' } });
    expect(sortSelect.value).toBe('score');

    // Verify localStorage has recorded the change
    const saved = JSON.parse(localStorage.getItem(VIEW_SETTINGS_STORAGE_KEY) || '{}');
    expect(saved.sortBy).toBe('score');

    unmount();

    // Simulate page refresh / re-opening: JobSeeker mounts again
    render(
      <JobSeeker
        jobs={mockJobs}
        onUpdateJob={() => {}}
        onAddJob={() => {}}
        activeProfile={profile}
      />
    );

    const newSortSelect = getSortSelect();
    expect(newSortSelect).toBeTruthy();
    expect(newSortSelect.value).toBe('score');
  });

  it('resets to newest jobs first when RESET ALL is triggered', () => {
    // Pre-seed with custom setting
    localStorage.setItem(VIEW_SETTINGS_STORAGE_KEY, JSON.stringify({
      sortBy: 'score',
      sortDirection: 'asc',
      minSalaryFilter: '100k+'
    }));

    render(
      <JobSeeker
        jobs={mockJobs}
        onUpdateJob={() => {}}
        onAddJob={() => {}}
        activeProfile={profile}
      />
    );

    // Verify it picked up the saved score sort
    const sortSelect = getSortSelect();
    expect(sortSelect).toBeTruthy();
    expect(sortSelect.value).toBe('score');

    // Reset button appears because it is filtered/customized
    const resetButtons = screen.getAllByRole('button', { name: /RESET ALL/i });
    expect(resetButtons.length).toBeGreaterThan(0);

    fireEvent.click(resetButtons[0]);

    // Should reset back to date
    expect(sortSelect.value).toBe('date');
    const saved = JSON.parse(localStorage.getItem(VIEW_SETTINGS_STORAGE_KEY) || '{}');
    expect(saved.sortBy).toBe('date');
    expect(saved.sortDirection).toBe('desc');
  });
});

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoleFilterBar } from '../RoleFilterBar';

describe('RoleFilterBar', () => {
  const mockRoles = [
    { id: 'cloud_infra', title: 'Cloud & Infrastructure Engineer', count: 12, category: 'Technology & IT', isRecommended: true, keywords: ['cloud', 'aws'] },
    { id: 'sysadmin', title: 'Systems Administrator', count: 8, category: 'Technology & IT', isRecommended: true, keywords: ['sysadmin'] },
    { id: 'nursing_clinical', title: 'Registered Nursing', count: 15, category: 'Healthcare & Clinical', isRecommended: false, keywords: ['nurse'] },
    { id: 'accounting_tax', title: 'Corporate Accounting', count: 5, category: 'Finance & Commercial', isRecommended: false, keywords: ['accountant'] }
  ];

  it('renders pinned popular roles and targeting header', () => {
    render(
      <RoleFilterBar
        roleArchetypeCounts={mockRoles}
        selectedRoleIds={['cloud_infra', 'sysadmin']}
        currentProfile={{ name: 'Alex Doe' }}
        profileAutoRoles={['cloud_infra', 'sysadmin']}
        totalJobsCount={40}
      />
    );

    expect(screen.getByText('ROLE TARGETING')).toBeDefined();
    expect(screen.getByText('2 Active')).toBeDefined();
    expect(screen.getByText('Cloud & Infrastructure Engineer')).toBeDefined();
    expect(screen.getByText('Systems Administrator')).toBeDefined();
  });

  it('calls onResetToProfile when Profile Target button is clicked', () => {
    const onReset = vi.fn();
    render(
      <RoleFilterBar
        roleArchetypeCounts={mockRoles}
        selectedRoleIds={['cloud_infra']}
        onResetToProfile={onReset}
        profileAutoRoles={['cloud_infra', 'sysadmin']}
      />
    );

    const profileBtn = screen.getByText(/PROFILE TARGET/i);
    fireEvent.click(profileBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('toggles collapsible drawer on click', () => {
    render(
      <RoleFilterBar
        roleArchetypeCounts={mockRoles}
        selectedRoleIds={[]}
      />
    );

    const expandBtn = screen.getByText(/ALL ROLES/i);
    fireEvent.click(expandBtn);

    // After expanding, the search input and domain groups should be visible
    expect(screen.getByPlaceholderText(/Search archetypes by title or keyword/i)).toBeDefined();
    expect(screen.getByText('COLLAPSE')).toBeDefined();
  });

  it('filters drawer roles via search input', () => {
    render(
      <RoleFilterBar
        roleArchetypeCounts={mockRoles}
        selectedRoleIds={[]}
      />
    );

    fireEvent.click(screen.getByText(/ALL ROLES/i));
    const searchInput = screen.getByPlaceholderText(/Search archetypes by title or keyword/i);
    fireEvent.change(searchInput, { target: { value: 'nurse' } });

    expect(screen.getAllByText('Registered Nursing').length).toBeGreaterThanOrEqual(1);
    // Corporate Accounting is filtered out
    const matches = screen.queryAllByText('Corporate Accounting');
    // Only in pinned strip if pinned, but not in drawer
    expect(matches.length).toBeLessThanOrEqual(1);
  });
});

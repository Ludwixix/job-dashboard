import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SamModeHeaderToggle } from '../SamModeHeaderToggle';

describe('SamModeHeaderToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders correctly with default off state', () => {
    render(<SamModeHeaderToggle isActive={false} onToggle={vi.fn()} />);

    expect(screen.getByRole('switch')).toBeInTheDocument();
    expect(screen.getByText('SAM MODE')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('verifies Sam mode user restriction helper', () => {
    const { isSamModeUser } = require('../../utils/samModeAuth');
    expect(isSamModeUser({ email: 'sam.ludwig@gmail.com' })).toBe(true);
    expect(isSamModeUser({ email: 'SAM.LUDWIG@GMAIL.COM' })).toBe(true);
    expect(isSamModeUser({ email: 'other@example.com' })).toBe(false);
    expect(isSamModeUser(null, { email: 'sam.ludwig@gmail.com' })).toBe(true);
    expect(isSamModeUser(null, { email: 'sarah.jenkins@gmail.com' })).toBe(false);
    expect(isSamModeUser(null, null)).toBe(false);
  });

  it('renders active state and reflects persistent storage', () => {
    localStorage.setItem('sam_mode_active', 'true');
    render(<SamModeHeaderToggle isActive={true} onToggle={vi.fn()} />);

    expect(screen.getByText('Cockpit Active')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles state, updates localStorage, and dispatches custom event', () => {
    const handleToggle = vi.fn();
    const eventSpy = vi.fn();
    window.addEventListener('sam-mode-toggled', eventSpy);

    render(<SamModeHeaderToggle isActive={false} onToggle={handleToggle} />);

    const button = screen.getByRole('switch');
    fireEvent.click(button);

    expect(handleToggle).toHaveBeenCalledWith(true);
    expect(localStorage.getItem('sam_mode_active')).toBe('true');
    expect(eventSpy).toHaveBeenCalled();

    window.removeEventListener('sam-mode-toggled', eventSpy);
  });
});

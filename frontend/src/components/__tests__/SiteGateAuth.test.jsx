import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SiteGate from '../SiteGate';
import * as authService from '../../services/authService';
import * as googleAuthService from '../../services/googleAuthService';

vi.mock('../../services/authService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loginWithEmail: vi.fn(),
    registerWithEmail: vi.fn(),
    setSession: vi.fn(),
    getAuthToken: vi.fn(() => 'mock-token')
  };
});

vi.mock('../../services/googleAuthService', () => ({
  loginWithGoogle: vi.fn()
}));

describe('SiteGate Authentication Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders Sign In view by default with email, password, and Google options', () => {
    render(<SiteGate onUnlock={vi.fn()} />);

    expect(screen.getByText(/CAREER.AGENT \/\/ ACCESS PORTAL/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Create Account$/i })).toBeInTheDocument();
    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('candidate@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SIGN IN TO DASHBOARD/i })).toBeInTheDocument();
  });

  it('switches to Create Account form with Full Name and Confirm Password fields', () => {
    render(<SiteGate onUnlock={vi.fn()} />);

    const createAccountTab = screen.getByRole('button', { name: /Create Account/i });
    fireEvent.click(createAccountTab);

    expect(screen.getByPlaceholderText('e.g. Alex Morgan')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('candidate@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Min. 8 chars, 1 upper, 1 special')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Repeat password')).toBeInTheDocument();
    expect(screen.getByText(/REGISTER & START DISCOVERY/i)).toBeInTheDocument();
  });

  it('displays real-time password complexity checklist when typing password', () => {
    render(<SiteGate onUnlock={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    const pwdInput = screen.getByPlaceholderText('Min. 8 chars, 1 upper, 1 special');
    fireEvent.change(pwdInput, { target: { value: 'short' } });

    expect(screen.getByText(/PASSWORD STRENGTH:/i)).toBeInTheDocument();
    expect(screen.getByText(/Weak/i)).toBeInTheDocument();
    expect(screen.getByText(/8\+ characters/i)).toBeInTheDocument();
    expect(screen.getByText(/1 uppercase \(A-Z\)/i)).toBeInTheDocument();

    fireEvent.change(pwdInput, { target: { value: 'StrongPassword123!' } });
    expect(screen.getByText(/Strong \(5\/5\)/i)).toBeInTheDocument();
  });

  it('submits registration successfully with complex password and calls onUnlock', async () => {
    const mockUnlock = vi.fn();
    authService.registerWithEmail.mockResolvedValueOnce({
      id: 'new_user_123',
      name: 'Alex Morgan',
      email: 'alex@example.com',
      email_verified: false
    });

    render(<SiteGate onUnlock={mockUnlock} />);

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    fireEvent.change(screen.getByPlaceholderText('e.g. Alex Morgan'), { target: { value: 'Alex Morgan' } });
    fireEvent.change(screen.getByPlaceholderText('candidate@example.com'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min. 8 chars, 1 upper, 1 special'), { target: { value: 'ComplexPass123!' } });
    fireEvent.change(screen.getByPlaceholderText('Repeat password'), { target: { value: 'ComplexPass123!' } });

    fireEvent.click(screen.getByText(/REGISTER & START DISCOVERY/i));

    await waitFor(() => {
      expect(authService.registerWithEmail).toHaveBeenCalledWith('Alex Morgan', 'alex@example.com', 'ComplexPass123!');
      expect(mockUnlock).toHaveBeenCalledWith(expect.objectContaining({
        email: 'alex@example.com'
      }));
    });
  });

  it('submits sign in successfully and calls onUnlock', async () => {
    const mockUnlock = vi.fn();
    authService.loginWithEmail.mockResolvedValueOnce({
      id: 'user_456',
      name: 'Existing User',
      email: 'user@example.com'
    });

    render(<SiteGate onUnlock={mockUnlock} />);

    fireEvent.change(screen.getByPlaceholderText('candidate@example.com'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••'), { target: { value: 'Secret123' } });

    fireEvent.click(screen.getByText(/SIGN IN TO DASHBOARD/i));

    await waitFor(() => {
      expect(authService.loginWithEmail).toHaveBeenCalledWith('user@example.com', 'Secret123');
      expect(mockUnlock).toHaveBeenCalledWith(expect.objectContaining({
        email: 'user@example.com'
      }));
    });
  });

  it('supports 1-click Google authentication', async () => {
    const mockUnlock = vi.fn();
    googleAuthService.loginWithGoogle.mockResolvedValueOnce({
      user: { id: 'google_789', name: 'Google User', email: 'google@gmail.com' },
      session: { id: 'google_789', name: 'Google User', email: 'google@gmail.com' }
    });

    render(<SiteGate onUnlock={mockUnlock} />);

    fireEvent.click(screen.getByText(/Continue with Google/i));

    await waitFor(() => {
      expect(googleAuthService.loginWithGoogle).toHaveBeenCalled();
      expect(mockUnlock).toHaveBeenCalledWith(expect.objectContaining({
        email: 'google@gmail.com'
      }));
    });
  });

  it('allows access via Admin Passcode fallback', async () => {
    const mockUnlock = vi.fn();
    render(<SiteGate onUnlock={mockUnlock} />);

    fireEvent.click(screen.getByText(/ADMIN PASSCODE/i));

    expect(screen.getByText(/ENTER ADMIN PASSCODE/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('••••••••••••'), { target: { value: 'Scamper123' } });
    fireEvent.click(screen.getByText(/ACCESS DASHBOARD/i));

    await waitFor(() => {
      expect(mockUnlock).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Sam Ludwig',
        email: 'sam.ludwig@gmail.com'
      }));
    });
  });
});

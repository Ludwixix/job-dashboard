import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingFlow } from '../OnboardingFlow';
import * as authService from '../../services/authService';

vi.mock('../../services/authService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loginWithEmail: vi.fn(),
    registerWithEmail: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerificationCode: vi.fn(),
    completeOnboarding: vi.fn((profile) => ({ session: { ...profile, onboardingCompleted: true }, profile })),
    loginWithDemoPersona: vi.fn()
  };
});

describe('OnboardingFlow Component & Email Verification Step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders Step 1 Email Verification when initialUser has email_verified = false', () => {
    const unverifiedUser = {
      id: 'candidate_1',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      email_verified: false,
      verificationCodePreview: '654321'
    };

    render(<OnboardingFlow initialUser={unverifiedUser} onComplete={vi.fn()} />);

    expect(screen.getByText(/STEP 1 OF 5 \/\/ EMAIL VERIFICATION/i)).toBeInTheDocument();
    expect(screen.getByText(/Verify Your Email Address/i)).toBeInTheDocument();
    expect(screen.getByText(/jordan@example.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    expect(screen.getByText(/DEV CODE/i)).toBeInTheDocument();
    expect(screen.getByText('654321')).toBeInTheDocument();
  });

  it('auto-fills dev code when clicking Auto-fill button', () => {
    const unverifiedUser = {
      id: 'candidate_1',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      email_verified: false,
      verificationCodePreview: '987654'
    };

    render(<OnboardingFlow initialUser={unverifiedUser} onComplete={vi.fn()} />);

    const autoFillBtn = screen.getByRole('button', { name: /Auto-fill/i });
    fireEvent.click(autoFillBtn);

    const input = screen.getByPlaceholderText('000000');
    expect(input.value).toBe('987654');
  });

  it('verifies email successfully and transitions to Step 2 (Industry)', async () => {
    const unverifiedUser = {
      id: 'candidate_1',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      email_verified: false,
      verificationCodePreview: '123456'
    };

    authService.verifyEmail.mockResolvedValueOnce({
      success: true,
      message: 'Email verified'
    });

    render(<OnboardingFlow initialUser={unverifiedUser} onComplete={vi.fn()} />);

    const input = screen.getByPlaceholderText('000000');
    fireEvent.change(input, { target: { value: '123456' } });

    const submitBtn = screen.getByRole('button', { name: /CONFIRM & PROCEED TO SETUP/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authService.verifyEmail).toHaveBeenCalledWith('123456', 'jordan@example.com');
      expect(screen.getByText(/Email verified!/i)).toBeInTheDocument();
    });

    // Advances to Step 2 (AI Intelligence Engine)
    await waitFor(() => {
      expect(screen.getByText(/STEP 2 OF 6 \/\/ AI INTELLIGENCE ENGINE/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('starts at Step 2 directly if user email is already verified', () => {
    const verifiedUser = {
      id: 'candidate_2',
      name: 'Taylor Swift',
      email: 'taylor@example.com',
      email_verified: true
    };

    render(<OnboardingFlow initialUser={verifiedUser} onComplete={vi.fn()} />);

    expect(screen.getByText(/STEP 2 OF 6 \/\/ AI INTELLIGENCE ENGINE/i)).toBeInTheDocument();
  });
});

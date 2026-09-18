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

vi.mock('../../services/profileService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    saveProfileToBackend: vi.fn().mockResolvedValue({ success: true }),
    parseResumeWithAI: vi.fn(),
    parseResumeTextClientSide: vi.fn()
  };
});

vi.mock('../../services/profileOnboardingPipeline', () => ({
  runProfileOnboardingPipeline: vi.fn().mockResolvedValue({ success: true }),
  syncProfileQueriesToBackend: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock('../../services/llmConfig', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getLlmConfig: vi.fn(() => ({
      provider: 'openrouter',
      model: 'anthropic/claude-3.7-sonnet',
      apiKey: 'sk-or-v1-testkey12345',
      endpoint: 'https://openrouter.ai/api/v1'
    })),
    saveLlmConfig: vi.fn(),
    testLlmConnection: vi.fn().mockResolvedValue({ success: true, latencyMs: 120 })
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

    expect(screen.getByText(/STEP 1 OF 6 \/\/ EMAIL VERIFICATION/i)).toBeInTheDocument();
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

  it('allows user to progress from Step 2 to Step 3 (Industry Selection) and select an industry and seniority', async () => {
    const verifiedUser = {
      id: 'candidate_3',
      name: 'Morgan Blake',
      email: 'morgan@example.com',
      email_verified: true
    };

    render(<OnboardingFlow initialUser={verifiedUser} onComplete={vi.fn()} />);

    // In Step 2 (AI Engine), click "Save & Continue to Industry"
    const continueToIndustryBtn = screen.getByRole('button', { name: /Save & Continue to Industry/i });
    fireEvent.click(continueToIndustryBtn);

    // Verify Step 3 is rendered
    expect(screen.getByText(/STEP 3 OF 6 \/\/ TARGET SECTOR & INDUSTRY/i)).toBeInTheDocument();
    expect(screen.getByText(/What Industry Do You Specialize In\?/i)).toBeInTheDocument();

    // Verify industry options are present
    expect(screen.getByText(/Healthcare, Nursing & Medical/i)).toBeInTheDocument();
    expect(screen.getByText(/Finance, Banking & Accounting/i)).toBeInTheDocument();

    // Click on "Healthcare, Nursing & Medical"
    const healthcareCard = screen.getByText(/Healthcare, Nursing & Medical/i).closest('button');
    fireEvent.click(healthcareCard);

    // Verify card is now selected (remains on Step 3)
    expect(screen.getByText(/STEP 3 OF 6 \/\/ TARGET SECTOR & INDUSTRY/i)).toBeInTheDocument();

    // Change Career Seniority Stage to Lead & Staff
    const leadSeniorityBtn = screen.getByText(/Lead & Staff/i).closest('button');
    fireEvent.click(leadSeniorityBtn);

    expect(screen.getByText(/Active: Lead & Staff/i)).toBeInTheDocument();

    // Now click Continue to Roles & Skills
    const continueToRolesBtn = screen.getByRole('button', { name: /Continue to Roles & Skills/i });
    fireEvent.click(continueToRolesBtn);

    // Verify Step 4 is rendered
    expect(screen.getByText(/STEP 4 OF 6 \/\/ TARGET ROLES & CORE SKILLS/i)).toBeInTheDocument();
  });

  it('completes the entire onboarding journey from Step 2 through Step 6 and triggers auto-scrape', async () => {
    const onCompleteMock = vi.fn();
    const verifiedUser = {
      id: 'candidate_4',
      name: 'Alex Rivera',
      email: 'alex@example.com',
      email_verified: true
    };

    render(<OnboardingFlow initialUser={verifiedUser} onComplete={onCompleteMock} />);

    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /Save & Continue to Industry/i }));
    expect(screen.getByText(/STEP 3 OF 6 \/\/ TARGET SECTOR & INDUSTRY/i)).toBeInTheDocument();

    // Select Technology & IT
    const techCard = screen.getByText(/Technology, Cloud & Software/i).closest('button');
    fireEvent.click(techCard);

    // Continue to Step 4 (Roles & Skills)
    fireEvent.click(screen.getByRole('button', { name: /Continue to Roles & Skills/i }));
    expect(screen.getByText(/STEP 4 OF 6 \/\/ TARGET ROLES & CORE SKILLS/i)).toBeInTheDocument();

    // Continue to Step 5 (Location & Preferences)
    fireEvent.click(screen.getByRole('button', { name: /Continue to Location & Preferences/i }));
    expect(screen.getByText(/STEP 5 OF 6 \/\/ LOCATION, WORK STYLE & COMPENSATION/i)).toBeInTheDocument();

    // Fill in location and salary
    const locationInput = screen.getByPlaceholderText(/e\.g\. Balaclava VIC 3183/i);
    fireEvent.change(locationInput, { target: { value: 'Richmond VIC 3121' } });

    // Continue to Step 6 (Review & Launch)
    fireEvent.click(screen.getByRole('button', { name: /Review Bespoke Blueprint/i }));
    expect(screen.getByText(/STEP 6 OF 6 \/\/ BESPOKE BLUEPRINT READY/i)).toBeInTheDocument();

    // Verify Review summary shows the candidate's chosen industry & location
    expect(screen.getByText('Richmond VIC 3121')).toBeInTheDocument();

    // Click Launch
    const launchBtn = screen.getByRole('button', { name: /LAUNCH.*BESPOKE.*MATRIX/i });
    fireEvent.click(launchBtn);

    // Verify sessionStorage has 'trigger_initial_scrape' set to 'true'
    await waitFor(() => {
      expect(sessionStorage.getItem('trigger_initial_scrape')).toBe('true');
      expect(onCompleteMock).toHaveBeenCalled();
    });
  });

  it('allows skipping Step 2 (AI Engine) and advances to Step 3 without an API key', () => {
    const verifiedUser = {
      id: 'candidate_skip_llm',
      name: 'Sam Taylor',
      email: 'sam@example.com',
      email_verified: true
    };

    render(<OnboardingFlow initialUser={verifiedUser} onComplete={vi.fn()} />);

    expect(screen.getByText(/STEP 2 OF 6 \/\/ AI INTELLIGENCE ENGINE/i)).toBeInTheDocument();

    // Click "Skip for now"
    const skipBtn = screen.getByRole('button', { name: /Skip for now/i });
    fireEvent.click(skipBtn);

    // Should transition cleanly to Step 3
    expect(screen.getByText(/STEP 3 OF 6 \/\/ TARGET SECTOR & INDUSTRY/i)).toBeInTheDocument();
  });

  it('allows skipping directly to Step 6 (Review & Launch), calculates completeness score, and CTA navigates to target step', () => {
    const verifiedUser = {
      id: 'candidate_skip_step6',
      name: 'Robin Wood',
      email: 'robin@example.com',
      email_verified: true
    };

    render(<OnboardingFlow initialUser={verifiedUser} onComplete={vi.fn()} />);

    expect(screen.getByText(/STEP 2 OF 6 \/\/ AI INTELLIGENCE ENGINE/i)).toBeInTheDocument();

    // Click "Skip directly to Review & Launch (Step 6)"
    const skipToLaunchBtn = screen.getByRole('button', { name: /Skip directly to Review & Launch \(Step 6\)/i });
    fireEvent.click(skipToLaunchBtn);

    // Verifies Step 6 is shown
    expect(screen.getByText(/STEP 6 OF 6 \/\/ BESPOKE BLUEPRINT READY/i)).toBeInTheDocument();
    expect(screen.getByText(/PROFILE COMPLETENESS & CALIBRATION SCORE/i)).toBeInTheDocument();

    // With default profile and API key, score is 75%
    expect(screen.getAllByText(/75% COMPLETE/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/WHAT MORE CAN BE DONE TO REACH 100%:/i)).toBeInTheDocument();
    expect(screen.getByText(/\+25% Potential Boost Available/i)).toBeInTheDocument();

    // CTAs should be available to improve profile
    const addSkillsCta = screen.getByRole('button', { name: /Add Skills \(\+10%\)/i });
    expect(addSkillsCta).toBeInTheDocument();

    // Clicking CTA jumps straight to Step 4 (Skills & Experience)
    fireEvent.click(addSkillsCta);
    expect(screen.getByText(/STEP 4 OF 6 \/\/ TARGET ROLES & CORE SKILLS/i)).toBeInTheDocument();
  });

  it('shows 100% complete state when all profile criteria are met', () => {
    const verifiedUser = {
      id: 'candidate_100',
      name: 'Full Profile Candidate',
      email: 'full@example.com',
      email_verified: true
    };

    render(<OnboardingFlow initialUser={verifiedUser} onComplete={vi.fn()} />);

    // Step 2 -> 3
    fireEvent.click(screen.getByRole('button', { name: /Save & Continue to Industry/i }));

    // Step 3 -> 4
    fireEvent.click(screen.getByRole('button', { name: /Continue to Roles & Skills/i }));

    // In Step 4: add skills to have 6+ skills (default has 4 skills)
    const newSkillInput = screen.getByPlaceholderText('+ Add skill...');
    fireEvent.change(newSkillInput, { target: { value: 'Kubernetes' } });
    fireEvent.keyDown(newSkillInput, { key: 'Enter', code: 'Enter' });
    fireEvent.change(newSkillInput, { target: { value: 'Docker' } });
    fireEvent.keyDown(newSkillInput, { key: 'Enter', code: 'Enter' });

    // Add resume work experience (>40 chars)
    const resumeTextarea = screen.getByPlaceholderText(/Paste work experience/i);
    fireEvent.change(resumeTextarea, {
      target: {
        value: 'Senior Lead Software Architect with over 10 years experience building scalable cloud distributed systems and microservices.'
      }
    });

    // Continue to Step 5
    fireEvent.click(screen.getByRole('button', { name: /Continue to Location & Preferences/i }));

    // Location is already set by default ("Melbourne VIC, Australia")
    // Continue to Step 6
    fireEvent.click(screen.getByRole('button', { name: /Review Bespoke Blueprint/i }));

    // Step 6 should now be 100% Complete
    expect(screen.getByText(/STEP 6 OF 6 \/\/ BESPOKE BLUEPRINT READY/i)).toBeInTheDocument();
    expect(screen.getAllByText(/100% COMPLETE/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Full 100% Candidate Profile Power Reached!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /⚡ LAUNCH BESPOKE MATRIX \(100% READY\)/i })).toBeInTheDocument();
  });
});


import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validatePasswordStrength,
  verifyEmail,
  resendVerificationCode,
  registerWithEmail,
  getCurrentSession,
  setSession
} from '../authService';

describe('Auth Password Complexity & Email Verification Service', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  describe('validatePasswordStrength', () => {
    it('rejects passwords shorter than 8 characters', () => {
      const res = validatePasswordStrength('Ab1!xyz');
      expect(res.rules.minLength).toBe(false);
      expect(res.isComplex).toBe(false);
    });

    it('rejects passwords missing uppercase letters', () => {
      const res = validatePasswordStrength('abcdef123!@#');
      expect(res.rules.hasUpper).toBe(false);
      expect(res.isComplex).toBe(false);
    });

    it('rejects passwords missing lowercase letters', () => {
      const res = validatePasswordStrength('ABCDEF123!@#');
      expect(res.rules.hasLower).toBe(false);
      expect(res.isComplex).toBe(false);
    });

    it('rejects passwords missing digits', () => {
      const res = validatePasswordStrength('Abcdefgh!@#$');
      expect(res.rules.hasDigit).toBe(false);
      expect(res.isComplex).toBe(false);
    });

    it('rejects passwords missing special characters', () => {
      const res = validatePasswordStrength('Abcdefgh1234');
      expect(res.rules.hasSpecial).toBe(false);
      expect(res.isComplex).toBe(false);
    });

    it('accepts passwords meeting all 5 complexity criteria', () => {
      const res = validatePasswordStrength('P@ssw0rd2026!');
      expect(res.rules.minLength).toBe(true);
      expect(res.rules.hasUpper).toBe(true);
      expect(res.rules.hasLower).toBe(true);
      expect(res.rules.hasDigit).toBe(true);
      expect(res.rules.hasSpecial).toBe(true);
      expect(res.score).toBe(5);
      expect(res.isComplex).toBe(true);
      expect(res.strengthLabel).toBe('Strong');
    });

    it('computes Medium strength when 3-4 rules pass', () => {
      const res = validatePasswordStrength('password123'); // minLength, hasLower, hasDigit
      expect(res.score).toBe(3);
      expect(res.isComplex).toBe(false);
      expect(res.strengthLabel).toBe('Medium');
    });
  });

  describe('verifyEmail', () => {
    it('throws error when code is empty', async () => {
      await expect(verifyEmail('', 'test@example.com')).rejects.toThrow('Please enter the 6-digit verification code.');
    });

    it('sends POST to /api/verify-email and marks session email_verified', async () => {
      // Setup initial unverified session
      setSession({
        id: 'user_123',
        email: 'test@example.com',
        email_verified: false,
        onboardingCompleted: false
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Email verified successfully.' })
      });

      const res = await verifyEmail('654321', 'test@example.com');
      expect(res.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/verify-email'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ code: '654321', email: 'test@example.com' })
        })
      );

      // Verify updated session
      const updated = getCurrentSession();
      expect(updated.email_verified).toBe(true);
    });

    it('throws server error message if verification fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: 'Invalid or expired verification code.' })
      });

      await expect(verifyEmail('000000', 'test@example.com')).rejects.toThrow('Invalid or expired verification code.');
    });
  });

  describe('resendVerificationCode', () => {
    it('sends POST to /api/resend-verification', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Verification code resent.', verification_code_preview: '999888' })
      });

      const res = await resendVerificationCode('candidate@example.com');
      expect(res.success).toBe(true);
      expect(res.verification_code_preview).toBe('999888');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/resend-verification'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'candidate@example.com' })
        })
      );
    });
  });

  describe('registerWithEmail', () => {
    it('blocks registration client-side if password is not complex', async () => {
      await expect(
        registerWithEmail('Alex Candidate', 'alex@example.com', 'weak')
      ).rejects.toThrow('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
    });

    it('successfully registers with complex password and sets email_verified to false', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          token: 'mock-jwt-token',
          verification_code_preview: '123456',
          user: {
            id: 'alex_candidate',
            name: 'Alex Candidate',
            email: 'alex@example.com',
            email_verified: false
          }
        })
      });

      const user = await registerWithEmail('Alex Candidate', 'alex@example.com', 'SuperSecure2026!');
      expect(user.id).toBe('alex_candidate');
      expect(user.email_verified).toBe(false);
      expect(user.onboardingCompleted).toBe(false);
      expect(user.verificationCodePreview).toBe('123456');

      const session = getCurrentSession();
      expect(session.email_verified).toBe(false);
      expect(session.onboardingCompleted).toBe(false);
    });
  });
});

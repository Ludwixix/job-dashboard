/**
 * authService.js
 * Comprehensive User Authentication & Onboarding Session Manager
 * Supports Direct Email/Password Auth, Google OAuth (GIS), and Guest/Demo Personas.
 */

import { DEFAULT_PROFILES, saveProfile, setActiveProfileId } from './profileService';
import { getBackendApiBase } from './apiConfig';

const LS_SESSION = 'job_dashboard_current_user_session';
const LS_TOKEN = 'job_dashboard_auth_token';

const getApiBase = () => getBackendApiBase();

/**
 * Retrieves the currently active authenticated session (cached)
 */
export const getCurrentSession = () => {
  try {
    const raw = localStorage.getItem(LS_SESSION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading current auth session:', e);
    return null;
  }
};

/**
 * Persists the user session to localStorage
 */
export const setSession = (userData, token = null) => {
  if (userData) {
    localStorage.setItem(LS_SESSION, JSON.stringify(userData));
    if (token) localStorage.setItem(LS_TOKEN, token);
  } else {
    localStorage.removeItem(LS_SESSION);
    localStorage.removeItem(LS_TOKEN);
  }
};

export const getAuthToken = () => {
  try {
    return localStorage.getItem(LS_TOKEN) || localStorage.getItem('job_dashboard_token') || null;
  } catch {
    return null;
  }
};

/**
 * Validates or restores the active user session on page load / refresh
 */
export const validateSession = async () => {
  const current = getCurrentSession();
  if (!current) return null;

  const token = getAuthToken();
  if (!token) {
    return current;
  }

  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/session`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        const hasProfile = Boolean(data.has_profile && data.profile && Object.keys(data.profile).length > 0);
        const verifiedSession = {
          ...current,
          ...data.user,
          authProvider: current.authProvider || 'email',
          onboardingCompleted: current.onboardingCompleted !== undefined ? current.onboardingCompleted : hasProfile
        };
        setSession(verifiedSession, token);
        let activeProfile = null;
        if (hasProfile && data.profile) {
          activeProfile = saveProfile(data.profile);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth-changed', {
            detail: { user: verifiedSession, session: verifiedSession, profile: activeProfile }
          }));
        }
        return verifiedSession;
      }
    }
  } catch (err) {
    console.warn("Backend session validation deferred (offline / network):", err);
  }

  // Preserve existing local session so user stays logged in across page reloads
  return current;
};



/**
 * Sign In with Email & Password
 */
export const loginWithEmail = async (email, password) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Please enter a valid email address.');
  if (!password) throw new Error('Please enter a password.');
  const apiBase = getApiBase();

  const res = await fetch(`${apiBase}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Invalid credentials');
  }

  const hasProfile = Boolean(data.has_profile && data.profile && Object.keys(data.profile).length > 0);
  const sessionUser = {
    ...data.user,
    authProvider: 'email',
    onboardingCompleted: hasProfile,
    profileId: data.user.id
  };

  setSession(sessionUser, data.token);
  try {
    localStorage.setItem('career_agent_site_unlocked', 'true');
  } catch {}

  let activeProfile = null;
  if (hasProfile && data.profile) {
    activeProfile = saveProfile(data.profile);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-changed', {
      detail: { user: sessionUser, session: sessionUser, profile: activeProfile }
    }));
  }

  return sessionUser;
};

/**
 * Evaluates password complexity against security standards:
 * - At least 8 characters
 * - Uppercase letter [A-Z]
 * - Lowercase letter [a-z]
 * - Number [0-9]
 * - Special character / symbol
 */
export const validatePasswordStrength = (password = '') => {
  const pwd = String(password || '');
  const rules = {
    minLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasDigit: /[0-9]/.test(pwd),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(pwd)
  };

  const passedCount = Object.values(rules).filter(Boolean).length;
  const isComplex = passedCount === 5;

  let strengthLabel = 'Weak';
  if (passedCount >= 5) strengthLabel = 'Strong';
  else if (passedCount >= 3) strengthLabel = 'Medium';

  return {
    isComplex,
    score: passedCount,
    strengthLabel,
    rules
  };
};

/**
 * Verify Email with 6-digit code
 */
export const verifyEmail = async (code, email) => {
  const cleanCode = String(code || '').trim();
  if (!cleanCode) throw new Error('Please enter the 6-digit verification code.');

  const apiBase = getApiBase();
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${apiBase}/api/verify-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: cleanCode, email: email || undefined })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Email verification failed.');
  }

  // Update stored session if email_verified is confirmed
  const current = getCurrentSession();
  if (current) {
    const updated = { ...current, email_verified: true };
    setSession(updated, token);
  }

  return data;
};

/**
 * Resend Email Verification Code
 */
export const resendVerificationCode = async (email) => {
  const apiBase = getApiBase();
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${apiBase}/api/resend-verification`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: email || undefined })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to resend verification code.');
  }

  return data;
};

/**
 * Sign Up with Full Name, Email & Password
 */
export const registerWithEmail = async (name, email, password) => {
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanName) throw new Error('Please enter your full name.');
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Please enter a valid email address.');
  
  const complexity = validatePasswordStrength(password);
  if (!complexity.isComplex) {
    throw new Error('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
  }

  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: cleanName, email: cleanEmail, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  const sessionUser = {
    ...data.user,
    authProvider: 'email',
    onboardingCompleted: false,
    email_verified: Boolean(data.user?.email_verified),
    verificationCodePreview: data.verification_code_preview,
    profileId: data.user.id
  };

  setSession(sessionUser, data.token);
  try {
    localStorage.setItem('career_agent_site_unlocked', 'true');
  } catch {}

  // Initialize clean candidate profile with user's name & email
  const initialProfile = {
    id: data.user.id,
    name: cleanName,
    email: cleanEmail,
    title: '',
    industry: 'Technology & IT',
    location: 'Melbourne, VIC',
    workRights: 'Australian Citizen (Unrestricted)',
    targetTitles: [],
    coreSkills: [],
    keyStrengths: [],
    updatedAt: new Date().toISOString()
  };
  saveProfile(initialProfile);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-changed', {
      detail: { user: sessionUser, session: sessionUser, profile: initialProfile }
    }));
    window.dispatchEvent(new CustomEvent('profile-updated', {
      detail: initialProfile
    }));
  }

  return sessionUser;
};

/**
 * Links a Google Account to the currently active authenticated session
 */
export const linkGoogleAccount = async (googleAuthData) => {
  const token = getAuthToken();
  const apiBase = getApiBase();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${apiBase}/api/link-google`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      google_id: googleAuthData.id || googleAuthData.sub,
      email: googleAuthData.email,
      picture: googleAuthData.picture
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to link Google account');
  }

  const current = getCurrentSession();
  if (current) {
    const updated = {
      ...current,
      googleEmail: data.linked_email || googleAuthData.email,
      picture: googleAuthData.picture || current.picture
    };
    setSession(updated, token);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth-changed', {
        detail: { user: updated, session: updated, profile: getActiveProfile() }
      }));
    }
  }

  return data;
};

/**
 * Complete Onboarding and link Candidate Profile
 */
export const completeOnboarding = (profileData) => {
  const current = getCurrentSession() || {
    id: `user_${Date.now()}`,
    name: profileData?.name || 'Candidate',
    email: profileData?.email || 'user@example.com',
    authProvider: 'email'
  };

  const finalProfile = {
    ...profileData,
    id: current.id || profileData?.id || `user_${Date.now()}`,
    name: profileData?.name || current.name,
    email: profileData?.email || current.email
  };

  saveProfile(finalProfile);
  setActiveProfileId(finalProfile.id);

  const updatedSession = {
    ...current,
    name: finalProfile.name,
    email: finalProfile.email,
    profileId: finalProfile.id,
    industry: finalProfile.industry || 'Technology & IT',
    onboardingCompleted: true,
    lastActiveAt: new Date().toISOString()
  };

  setSession(updatedSession, getAuthToken()); // preserve token
  return { session: updatedSession, profile: finalProfile };
};

/**
 * Quick Login with Pre-built Industry Demo Persona
 */
export const loginWithDemoPersona = (presetId) => {
  const preset = DEFAULT_PROFILES.find(p => p.id === presetId) || DEFAULT_PROFILES[0];
  
  const demoSession = {
    id: preset.id,
    name: preset.name,
    email: preset.email,
    profileId: preset.id,
    industry: preset.industry || 'Technology & IT',
    authProvider: 'demo',
    onboardingCompleted: true,
    isDemoUser: true, // Marker for UI
    createdAt: new Date().toISOString()
  };

  setSession(demoSession);
  setActiveProfileId(preset.id);
  return { session: demoSession, profile: preset };
};

export const USER_STORAGE_KEYS = [
  LS_SESSION,
  LS_TOKEN,
  'job_dashboard_token',
  'job_dashboard_current_user_session',
  'job_dashboard_google_auth_user',
  'job_dashboard_candidate_profile',
  'job_dashboard_profiles',
  'job_dashboard_active_profile_id',
  'career_agent_site_unlocked',
  'userBaseLocation',
  'userName',
  'userEmail',
  'userPhone',
  'userTargetSalary',
  'userTargetTitles',
  'job_dashboard_selected_roles',
  'job_dashboard_custom_roles',
  'job_dashboard_custom_jobs',
  'job_dashboard_local_applications',
  'job_dashboard_starred_jobs',
  'job_dashboard_dismissed_jobs',
  'job_dashboard_archived_jobs',
  'job_dashboard_interaction_history',
  'job_dashboard_last_email_scan_timestamp',
  'trigger_initial_scrape',
  'profile_synced_flag'
];

/**
 * Completely purges all user, profile, and application keys from localStorage & sessionStorage.
 */
export const clearAllUserData = () => {
  if (typeof localStorage !== 'undefined') {
    USER_STORAGE_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {}
    });
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.clear();
    } catch {}
  }
};

/**
 * Log Out Current User
 */
export const logoutUser = () => {
  clearAllUserData();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-logged-out'));
    window.dispatchEvent(new CustomEvent('auth-changed', {
      detail: { user: null, session: null, profile: null }
    }));
  }
};

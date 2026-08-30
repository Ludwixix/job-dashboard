/**
 * authService.js
 * Comprehensive User Authentication & Onboarding Session Manager
 * Supports Direct Email/Password Auth, Google OAuth (GIS), and Guest/Demo Personas.
 */

import { DEFAULT_PROFILES, saveProfile, setActiveProfileId } from './profileService';
import { SCRAPER_BASE_URL } from './jobQueryService';

const LS_SESSION = 'job_dashboard_current_user_session';
const LS_TOKEN = 'job_dashboard_auth_token';

const getApiBase = () => {
  const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  return isLocalHost ? '' : (SCRAPER_BASE_URL || '');
};

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

/**
 * Validates the session with the backend on load
 */
export const validateSession = async () => {
  const token = localStorage.getItem(LS_TOKEN);
  if (!token) return null;

  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/session`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        // Keep onboarding state if it exists locally, but verify user details
        const current = getCurrentSession() || {};
        const verifiedSession = {
          ...current,
          ...data.user,
          authProvider: 'email'
        };
        setSession(verifiedSession, token);
        return verifiedSession;
      }
    }
  } catch (err) {
    console.error("Session validation failed:", err);
  }

  // If we reach here, token is invalid or expired
  setSession(null);
  return null;
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

  const sessionUser = {
    ...data.user,
    authProvider: 'email',
    onboardingCompleted: true // Assuming if they have an account, they onboarded. Or derive from profile sync.
  };

  setSession(sessionUser, data.token);
  return sessionUser;
};

/**
 * Sign Up with Full Name, Email & Password
 */
export const registerWithEmail = async (name, email, password) => {
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanName) throw new Error('Please enter your full name.');
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Please enter a valid email address.');
  if (!password || password.length < 4) throw new Error('Password must be at least 4 characters.');

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
    onboardingCompleted: false
  };

  setSession(sessionUser, data.token);
  return sessionUser;
};

/**
 * Complete Onboarding and link Candidate Profile
 */
export const completeOnboarding = (profileData) => {
  const current = getCurrentSession() || {
    id: `user_${Date.now()}`,
    name: profileData.name || 'Candidate',
    email: profileData.email || 'user@example.com',
    authProvider: 'email'
  };

  const finalProfile = {
    ...profileData,
    id: profileData.id || current.id || `profile_${Date.now()}`,
    name: profileData.name || current.name,
    email: profileData.email || current.email
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

  setSession(updatedSession, localStorage.getItem(LS_TOKEN)); // preserve token
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

/**
 * Log Out Current User
 */
export const logoutUser = () => {
  localStorage.removeItem(LS_SESSION);
  localStorage.removeItem(LS_TOKEN);
};

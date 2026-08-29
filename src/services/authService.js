/**
 * authService.js
 * Comprehensive User Authentication & Onboarding Session Manager
 * Supports Direct Email/Password Auth, Google OAuth (GIS), and Guest/Demo Personas.
 */

import { DEFAULT_PROFILES, saveProfile, setActiveProfileId } from './profileService';

const LS_SESSION = 'job_dashboard_current_user_session';
const LS_USERS = 'job_dashboard_registered_users';

/**
 * Retrieves the currently active authenticated session
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
export const setSession = (userData) => {
  if (userData) {
    localStorage.setItem(LS_SESSION, JSON.stringify(userData));
  } else {
    localStorage.removeItem(LS_SESSION);
  }
};

/**
 * Gets all locally registered user accounts
 */
const getRegisteredUsers = () => {
  try {
    const raw = localStorage.getItem(LS_USERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Sign In with Email & Password
 */
export const loginWithEmail = async (email, password) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Please enter a valid email address.');
  if (!password || password.length < 4) throw new Error('Please enter a password with at least 4 characters.');

  const users = getRegisteredUsers();
  const existing = users.find(u => u.email.toLowerCase() === cleanEmail);

  if (existing) {
    if (existing.password && existing.password !== password) {
      throw new Error('Incorrect password for this account.');
    }
    const sessionUser = { ...existing };
    delete sessionUser.password;
    setSession(sessionUser);
    return sessionUser;
  }

  // Create new account if first time logging in
  const nameFromEmail = cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const newUser = {
    id: `user_${Date.now()}`,
    email: cleanEmail,
    name: nameFromEmail || 'Professional Candidate',
    password: password,
    authProvider: 'email',
    createdAt: new Date().toISOString(),
    onboardingCompleted: false
  };

  users.push(newUser);
  localStorage.setItem(LS_USERS, JSON.stringify(users));

  const sessionUser = { ...newUser };
  delete sessionUser.password;
  setSession(sessionUser);
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

  const users = getRegisteredUsers();
  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    // Log them in if account already exists
    return loginWithEmail(cleanEmail, password);
  }

  const newUser = {
    id: `user_${Date.now()}`,
    name: cleanName,
    email: cleanEmail,
    password: password,
    authProvider: 'email',
    createdAt: new Date().toISOString(),
    onboardingCompleted: false
  };

  users.push(newUser);
  localStorage.setItem(LS_USERS, JSON.stringify(users));

  const sessionUser = { ...newUser };
  delete sessionUser.password;
  setSession(sessionUser);
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

  // Save profile to candidate profile storage
  saveProfile(finalProfile);
  setActiveProfileId(finalProfile.id);

  // Update session
  const updatedSession = {
    ...current,
    name: finalProfile.name,
    email: finalProfile.email,
    profileId: finalProfile.id,
    industry: finalProfile.industry || 'Technology & IT',
    onboardingCompleted: true,
    lastActiveAt: new Date().toISOString()
  };

  setSession(updatedSession);
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
    isDemoUser: true,
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
};

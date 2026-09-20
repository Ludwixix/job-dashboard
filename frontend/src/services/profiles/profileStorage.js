/**
 * profileStorage.js
 * LocalStorage persistence, backend synchronization, and Last-Write-Wins (LWW) reconciliation
 * for single-user logged-in personas.
 */

import { getBackendApiBase } from '../apiConfig';
import { DEFAULT_USER_PROFILE, CLEAN_CANDIDATE_PROFILE } from './profileTemplates';

export const STORAGE_KEY_PROFILES = 'job_dashboard_profiles';
export const STORAGE_KEY_ACTIVE_PROFILE_ID = 'job_dashboard_active_profile_id';
export const STORAGE_KEY_CANDIDATE_PROFILE = 'candidate_profile';

/**
 * Returns the single active user profile.
 */
export const getActiveProfile = () => {
  try {
    let sessionUser = null;
    try {
      const rawSession = localStorage.getItem('job_dashboard_current_user_session') || localStorage.getItem('job_dashboard_google_auth_user');
      if (rawSession) sessionUser = JSON.parse(rawSession);
    } catch {}

    const rawCandidate = localStorage.getItem(STORAGE_KEY_CANDIDATE_PROFILE);
    if (rawCandidate) {
      const parsed = JSON.parse(rawCandidate);
      if (parsed && typeof parsed === 'object' && parsed.name) {
        // If an authenticated session user exists, verify cached candidate matches
        if (!sessionUser || parsed.id === sessionUser.id || parsed.id === sessionUser.profileId || (parsed.email && sessionUser.email && parsed.email.toLowerCase() === sessionUser.email.toLowerCase())) {
          return parsed;
        }
      }
    }

    const rawProfiles = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (rawProfiles) {
      const parsedList = JSON.parse(rawProfiles);
      if (Array.isArray(parsedList) && parsedList.length > 0) {
        let matched = null;
        if (sessionUser) {
          matched = parsedList.find(p => p.id === sessionUser.id || p.id === sessionUser.profileId || (p.email && sessionUser.email && p.email.toLowerCase() === sessionUser.email.toLowerCase()));
        }
        if (!matched && sessionUser && (sessionUser.name || sessionUser.email)) {
          const userProfile = {
            ...CLEAN_CANDIDATE_PROFILE,
            id: sessionUser.id || sessionUser.profileId || 'user_' + Date.now(),
            name: sessionUser.name || '',
            email: sessionUser.email || '',
            industry: sessionUser.industry || '',
            updatedAt: new Date().toISOString()
          };
          localStorage.setItem(STORAGE_KEY_CANDIDATE_PROFILE, JSON.stringify(userProfile));
          return userProfile;
        }
        if (!matched) {
          matched = parsedList.find(p => p.name?.toLowerCase().includes('sam') || p.id === 'sam_ludwig') || parsedList[0];
        }
        if (matched) {
          localStorage.setItem(STORAGE_KEY_CANDIDATE_PROFILE, JSON.stringify(matched));
          return matched;
        }
      }
    }

    if (sessionUser && (sessionUser.name || sessionUser.email)) {
      const userProfile = {
        ...CLEAN_CANDIDATE_PROFILE,
        id: sessionUser.id || sessionUser.profileId || 'user_' + Date.now(),
        name: sessionUser.name || '',
        email: sessionUser.email || '',
        industry: sessionUser.industry || '',
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY_CANDIDATE_PROFILE, JSON.stringify(userProfile));
      return userProfile;
    }
  } catch (e) {
    console.warn('Error reading active profile:', e);
  }

  // Default fallback — blank candidate profile rather than personal developer profile
  const guestProfile = {
    ...CLEAN_CANDIDATE_PROFILE,
    id: 'guest',
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEY_CANDIDATE_PROFILE, JSON.stringify(guestProfile));
  localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify([guestProfile]));
  localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE_ID, guestProfile.id);
  return guestProfile;
};

/**
 * Returns an array containing solely the single logged-in user profile.
 */
export const getProfiles = () => {
  const active = getActiveProfile();
  return [active];
};

export const getAllProfiles = getProfiles;

let _saveSequence = 0;
let _latestCompletedSequence = 0;

/**
 * Persists user profile to backend SQLite database.
 */
export const saveProfileToBackend = async (profile) => {
  if (!profile || typeof profile !== 'object') return null;
  const userId = profile.id;
  if (!userId) {
    console.warn('saveProfileToBackend called without valid profile.id; aborting backend sync');
    return null;
  }
  const currentSeq = ++_saveSequence;
  const apiBase = getBackendApiBase();
  const token = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('job_dashboard_auth_token') || localStorage.getItem('job_dashboard_token'))
    : null;

  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': userId
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${apiBase}/api/profile`, {
      method: 'POST',
      headers,
      body: JSON.stringify(profile)
    });
    if (res.ok) {
      if (currentSeq < _latestCompletedSequence) {
        // A newer save request already completed; discard stale response
        return null;
      }
      _latestCompletedSequence = currentSeq;
      const data = await res.json();
      return data.profile;
    }
  } catch (e) {
    console.warn('Backend profile sync non-blocking error:', e);
  }
  return null;
};

/**
 * Saves and updates the single logged-in user profile, synchronizing all storage keys.
 */
export const saveProfile = (updatedProfile, options = {}) => {
  if (!updatedProfile || typeof updatedProfile !== 'object') return DEFAULT_USER_PROFILE;

  let sessionUserId = null;
  let sessionUser = null;
  try {
    const rawSession = localStorage.getItem('job_dashboard_current_user_session') || localStorage.getItem('job_dashboard_google_auth_user');
    if (rawSession) {
      sessionUser = JSON.parse(rawSession);
      sessionUserId = sessionUser?.id;
    }
  } catch {}

  const email = (updatedProfile.email || sessionUser?.email || '').toLowerCase();
  const isSam = email.includes('sam.ludwig') || updatedProfile.id === 'sam_ludwig';
  const baseProfile = isSam ? DEFAULT_USER_PROFILE : CLEAN_CANDIDATE_PROFILE;

  const profile = {
    ...baseProfile,
    ...updatedProfile,
    id: updatedProfile.id || sessionUserId || baseProfile.id || `user_${Date.now()}`,
    updatedAt: updatedProfile.updatedAt || new Date().toISOString()
  };

  // Cross-populate aliases so both frontend and backend conventions are always complete
  if (profile.targetTitles && !profile.targetRoles) {
    profile.targetRoles = [...profile.targetTitles];
  } else if (profile.targetRoles && !profile.targetTitles) {
    profile.targetTitles = [...profile.targetRoles];
  }

  if (profile.seniorityLevel && !profile.seniority) {
    profile.seniority = profile.seniorityLevel;
  } else if (profile.seniority && !profile.seniorityLevel) {
    profile.seniorityLevel = profile.seniority;
  }

  if (profile.location && !profile.locationPreference) {
    profile.locationPreference = profile.location;
  } else if (profile.locationPreference && !profile.location) {
    profile.location = profile.locationPreference;
  }

  try {
    // Single profile persistence
    localStorage.setItem(STORAGE_KEY_CANDIDATE_PROFILE, JSON.stringify(profile));
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify([profile]));
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE_ID, profile.id);

    // Sync individual profile metadata for fast indexing
    if (profile.location) localStorage.setItem('userBaseLocation', profile.location);
    if (profile.name) localStorage.setItem('userName', profile.name);
    if (profile.email) localStorage.setItem('userEmail', profile.email);
    if (profile.phone) localStorage.setItem('userPhone', profile.phone);
    if (profile.targetSalary) localStorage.setItem('userTargetSalary', profile.targetSalary);
    if (Array.isArray(profile.targetTitles)) localStorage.setItem('userTargetTitles', JSON.stringify(profile.targetTitles));

    // Dispatch global event for instant re-scoring and UI synchronization
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: profile }));
    }

    // Persist to backend database asynchronously unless explicitly bypassed
    if (options.syncToBackend !== false) {
      saveProfileToBackend(profile).catch(() => {});
      import('../jobQueryService.js').then(({ pushQueriesToBackend }) => {
        pushQueriesToBackend(profile).catch(() => {});
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Error saving profile:', e);
  }

  return profile;
};

/**
 * Fetches user profile from backend SQLite database with local storage fallback and LWW reconciliation.
 */
export const fetchProfileFromBackend = async (userId, userEmail) => {
  const resolvedUserId = userId || getActiveProfile()?.id;
  if (!resolvedUserId) {
    console.warn('fetchProfileFromBackend called without userId; using local profile');
    return getActiveProfile();
  }
  let emailParam = userEmail;
  if (!emailParam) {
    try {
      const rawSession = localStorage.getItem('job_dashboard_current_user_session') || localStorage.getItem('job_dashboard_google_auth_user');
      if (rawSession) emailParam = JSON.parse(rawSession)?.email;
    } catch {}
  }
  const apiBase = getBackendApiBase();
  const token = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('job_dashboard_auth_token') || localStorage.getItem('job_dashboard_token'))
    : null;

  const headers = {
    'X-User-Id': resolvedUserId
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const query = new URLSearchParams({ user_id: resolvedUserId });
  if (emailParam) query.append('email', emailParam);

  try {
    const res = await fetch(`${apiBase}/api/profile?${query.toString()}`, {
      headers
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.profile && Object.keys(data.profile).length > 0) {
        const localProfile = getActiveProfile();
        const remoteProfile = data.profile;

        // Parse timestamps for Last-Write-Wins (LWW) conflict resolution
        const remoteTimestamp = new Date(remoteProfile.updatedAt || remoteProfile.updated_at || 0).getTime();
        const localTimestamp = new Date(localProfile?.updatedAt || localProfile?.updated_at || 0).getTime();

        // If local profile has newer edits, do NOT clobber with older remote snapshot.
        // Instead, automatically heal the backend with the newer local profile!
        if (localProfile && localTimestamp > remoteTimestamp) {
          saveProfileToBackend(localProfile).catch(() => {});
          return localProfile;
        }

        // Remote is newer or equal: persist remote profile locally without an echo-sync loop
        saveProfile(remoteProfile, { syncToBackend: false });
        return remoteProfile;
      }
    }
  } catch (e) {
    console.warn('Backend profile fetch error, using local cached profile:', e);
  }
  return getActiveProfile();
};

export const setActiveProfile = (_profileId) => {
  const active = getActiveProfile();
  return active;
};

export const setActiveProfileId = setActiveProfile;

export const getActiveProfileId = () => {
  return getActiveProfile()?.id || null;
};

export const deleteProfile = () => {
  // Reset to clean default user profile
  saveProfile(DEFAULT_USER_PROFILE);
  return [DEFAULT_USER_PROFILE];
};

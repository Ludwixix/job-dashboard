/**
 * googleAuthService.js
 * Google Identity Services (GIS) OAuth 2.0 Token Client
 * Manages user authentication, profile persistence, and access tokens for Gmail & Sheets APIs.
 */

const LS_AUTH_USER = 'job_dashboard_google_auth_user';
const LS_GOOGLE_CLIENT_ID = 'job_dashboard_google_client_id';

// Default / fallback demo client ID or user-configured client ID
const DEFAULT_CLIENT_ID = '1088456428789-demo-client-id.apps.googleusercontent.com';

export const getGoogleClientId = () => {
  return localStorage.getItem(LS_GOOGLE_CLIENT_ID) || '';
};

export const setGoogleClientId = (clientId) => {
  if (clientId) {
    localStorage.setItem(LS_GOOGLE_CLIENT_ID, clientId.trim());
  } else {
    localStorage.removeItem(LS_GOOGLE_CLIENT_ID);
  }
};

/**
 * Load Google Identity Services script dynamically
 */
export const loadGoogleIdentityScript = () => {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve(window.google.accounts.oauth2);
      return;
    }

    const existingScript = document.getElementById('google-identity-services');
    if (existingScript) {
      existingScript.onload = () => resolve(window.google.accounts.oauth2);
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-identity-services';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) {
        resolve(window.google.accounts.oauth2);
      } else {
        reject(new Error('Google Identity Services SDK failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services SDK'));
    document.head.appendChild(script);
  });
};

/**
 * Get the currently authenticated user from localStorage
 */
export const getAuthenticatedUser = () => {
  try {
    const raw = localStorage.getItem(LS_AUTH_USER);
    if (!raw) return null;
    const user = JSON.parse(raw);
    // Check if token expired
    if (user.expiresAt && Date.now() > user.expiresAt) {
      return { ...user, isTokenExpired: true };
    }
    return user;
  } catch (e) {
    console.error('Error reading auth user:', e);
    return null;
  }
};

/**
 * Persist authenticated user in localStorage
 */
export const setAuthenticatedUser = (userData) => {
  if (userData) {
    localStorage.setItem(LS_AUTH_USER, JSON.stringify(userData));
  } else {
    localStorage.removeItem(LS_AUTH_USER);
  }
};

/**
 * Sign out and clear stored tokens
 */
export const signOutGoogleUser = () => {
  const user = getAuthenticatedUser();
  if (user?.accessToken && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(user.accessToken, () => {});
    } catch {
      // Ignore
    }
  }
  localStorage.removeItem(LS_AUTH_USER);
};

export const isValidGoogleClientId = (id) => {
  if (!id || typeof id !== 'string') return false;
  const clean = id.trim();
  if (clean.includes('demo-client-id') || clean.length < 25 || !clean.includes('.apps.googleusercontent.com')) {
    return false;
  }
  return true;
};

/**
 * Creates a simulated / local Google Workspace session for instant testing
 */
export const simulateGoogleWorkspaceAuth = (profile) => {
  const email = profile?.email || 'candidate@gmail.com';
  const name = profile?.name || 'Google User';
  const simulatedId = `google_sim_${Date.now()}`;
  
  const authUser = {
    id: simulatedId,
    name: name,
    email: email,
    picture: '',
    accessToken: `simulated_token_${Date.now()}`,
    expiresAt: Date.now() + (3600 * 1000 * 24 * 7), // 7 days
    scopes: ['openid', 'email', 'profile', 'gmail.readonly', 'spreadsheets', 'drive.file'],
    spreadsheetId: `1IciRjQBBQoykm0K6NljjDNEWDTzdjsSaEPef8-hw8Lk`,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/1IciRjQBBQoykm0K6NljjDNEWDTzdjsSaEPef8-hw8Lk/edit`,
    lastGmailScan: new Date().toISOString(),
    isSimulated: true
  };

  setAuthenticatedUser(authUser);
  return authUser;
};

/**
 * Request Google OAuth 2.0 Access Token with Gmail & Sheets scopes
 */
export const requestGoogleAuthToken = async ({
  clientId = getGoogleClientId(),
  scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ],
  prompt = 'consent'
} = {}) => {
  if (!isValidGoogleClientId(clientId)) {
    throw new Error(
      'Google OAuth requires a registered Google Cloud Client ID (e.g. xxxxx.apps.googleusercontent.com). Enter your Client ID or use 1-Click Direct Login / Demo Mode.'
    );
  }

  await loadGoogleIdentityScript();

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: scopes.join(' '),
        prompt: prompt,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }

          const accessToken = tokenResponse.access_token;
          const expiresIn = Number(tokenResponse.expires_in || 3599);
          const expiresAt = Date.now() + (expiresIn * 1000);

          // Fetch user profile from Google OAuth userinfo endpoint
          let profile = { name: 'Google User', email: '', picture: '' };
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userRes.ok) {
              profile = await userRes.json();
            }
          } catch (e) {
            console.warn('Could not fetch user profile details:', e);
          }

          const authUser = {
            id: profile.sub || `user_${Date.now()}`,
            name: profile.name || 'Authenticated User',
            email: profile.email || '',
            picture: profile.picture || '',
            accessToken: accessToken,
            expiresAt: expiresAt,
            scopes: tokenResponse.scope ? tokenResponse.scope.split(' ') : scopes,
            spreadsheetId: null,
            spreadsheetUrl: null,
            lastGmailScan: null
          };

          // Merge with any existing user data (like existing spreadsheetId)
          const existing = getAuthenticatedUser();
          if (existing && existing.email === authUser.email) {
            authUser.spreadsheetId = existing.spreadsheetId;
            authUser.spreadsheetUrl = existing.spreadsheetUrl;
            authUser.lastGmailScan = existing.lastGmailScan;
          }

          setAuthenticatedUser(authUser);
          resolve(authUser);
        }
      });

      tokenClient.requestAccessToken();
    } catch (e) {
      reject(e);
    }
  });
};

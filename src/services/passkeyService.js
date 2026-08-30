/**
 * passkeyService.js
 * Browser Credential Management & WebAuthn / Passkey Authentication
 * Enables 1-click login using verified browser stored credentials or WebAuthn Passkeys.
 */

import { setSession } from './authService';
import { SCRAPER_BASE_URL } from './jobQueryService';

const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const getApiBase = () => isLocalHost ? '' : (SCRAPER_BASE_URL || '');

/**
 * Checks if WebAuthn or Credential Management is supported by the current browser
 */
export const isPasskeySupported = () => {
  return typeof window !== 'undefined' && (
    !!window.PublicKeyCredential || 
    (navigator.credentials && typeof navigator.credentials.get === 'function')
  );
};

/**
 * Attempt to authenticate using browser stored credentials or WebAuthn Passkey.
 * Strictly verifies against backend /api/passkey-login and sets authentic session token.
 * Throws a clear error if no credentials or passkey verification is available.
 */
export const loginWithBrowserPasskey = async () => {
  if (!isPasskeySupported()) {
    throw new Error("Passkey sign-in isn't available in this browser. Try email/password or Guest Mode instead.");
  }

  const apiBase = getApiBase();

  // 1. Attempt Credential Management API (stored password/credentials)
  try {
    if (navigator.credentials && navigator.credentials.get) {
      const cred = await navigator.credentials.get({
        password: true,
        mediation: 'optional'
      });

      if (cred && cred.id) {
        // Authenticate with backend using stored credential
        const res = await fetch(`${apiBase}/api/passkey-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credential_type: 'password_credential',
            email: cred.id,
            name: cred.name || cred.id.split('@')[0],
            password: cred.password || undefined
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.token && data.user) {
            localStorage.setItem('job_dashboard_auth_token', data.token);
            setSession({
              ...data.user,
              authProvider: 'passkey',
              onboardingCompleted: true,
              lastActiveAt: new Date().toISOString()
            });
            return data.user;
          }
        }
      }
    }
  } catch (e) {
    console.log('Stored credential lookup deferred:', e);
  }

  // 2. Attempt WebAuthn Passkey Challenge
  if (window.PublicKeyCredential) {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: 'preferred',
          rpId: window.location.hostname
        }
      });

      if (credential) {
        // Convert raw ID to base64 string
        const rawId = credential.rawId ? btoa(String.fromCharCode(...new Uint8Array(credential.rawId))) : credential.id;
        
        const res = await fetch(`${apiBase}/api/passkey-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credential_type: 'webauthn_passkey',
            credential_id: rawId,
            id: credential.id
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.token && data.user) {
            localStorage.setItem('job_dashboard_auth_token', data.token);
            setSession({
              ...data.user,
              authProvider: 'passkey',
              onboardingCompleted: true,
              lastActiveAt: new Date().toISOString()
            });
            return data.user;
          }
        }
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Passkey authentication was cancelled.');
      }
      console.warn('WebAuthn prompt error:', err);
    }
  }

  // If no passkey or credential could be authenticated, fail cleanly without granting unauthenticated access
  throw new Error("Passkey sign-in isn't available in this browser. Try email/password or Guest Mode instead.");
};

/**
 * Register and store credentials in the browser password manager
 */
export const storeBrowserCredentials = async (email, password, name) => {
  try {
    if (typeof window !== 'undefined' && window.PasswordCredential && navigator.credentials?.store) {
      const cred = new window.PasswordCredential({
        id: email,
        password: password,
        name: name
      });
      await navigator.credentials.store(cred);
    }
  } catch (e) {
    console.warn('Could not store credentials in browser password manager:', e);
  }
};

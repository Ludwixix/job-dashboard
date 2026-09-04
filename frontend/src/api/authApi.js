/**
 * authApi.js
 * API interactions for authentication, session check, registration, and passkeys.
 */
import { apiRequest } from './client';

export const authApi = {
  /**
   * Validate session token
   */
  async checkSession() {
    return await apiRequest('/api/session');
  },

  /**
   * Login with email and password
   */
  async login(email, password) {
    return await apiRequest('/api/login', {
      method: 'POST',
      body: { email, password }
    });
  },

  /**
   * Register a new account
   */
  async register(email, password, name = '') {
    return await apiRequest('/api/register', {
      method: 'POST',
      body: { email, password, name }
    });
  },

  /**
   * Complete Google OAuth login
   */
  async googleLogin(credentialPayload) {
    return await apiRequest('/api/google-login', {
      method: 'POST',
      body: credentialPayload
    });
  },

  /**
   * Passkey authentication
   */
  async passkeyLogin(payload) {
    return await apiRequest('/api/passkey-login', {
      method: 'POST',
      body: payload
    });
  }
};

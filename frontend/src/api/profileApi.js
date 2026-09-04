/**
 * profileApi.js
 * API interactions for user profile and scoring preferences.
 */
import { apiRequest } from './client';

export const profileApi = {
  /**
   * Get user profile
   */
  async getProfile(userId = '') {
    const endpoint = userId 
      ? `/api/profile?user_id=${encodeURIComponent(userId)}` 
      : '/api/profile';
    return await apiRequest(endpoint);
  },

  /**
   * Save or update user profile
   */
  async saveProfile(profile) {
    return await apiRequest('/api/profile', {
      method: 'POST',
      body: profile
    });
  },

  /**
   * Get scoring preferences
   */
  async getPreferences(userId = '') {
    const endpoint = userId 
      ? `/api/preferences?user_id=${encodeURIComponent(userId)}` 
      : '/api/preferences';
    return await apiRequest(endpoint);
  },

  /**
   * Save scoring preferences
   */
  async savePreferences(preferences) {
    return await apiRequest('/api/preferences', {
      method: 'POST',
      body: preferences
    });
  }
};

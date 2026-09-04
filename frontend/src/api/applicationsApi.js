/**
 * applicationsApi.js
 * API interactions for tracked applications, status changes, and sync.
 */
import { apiRequest } from './client';

export const applicationsApi = {
  /**
   * Fetch user applications
   */
  async getApplications(userId = '') {
    const endpoint = userId 
      ? `/api/applications?user_id=${encodeURIComponent(userId)}` 
      : '/api/applications';
    return await apiRequest(endpoint);
  },

  /**
   * Create or update an application
   */
  async saveApplication(appData) {
    return await apiRequest('/api/applications', {
      method: 'POST',
      body: appData
    });
  },

  /**
   * Sync a batch of applications
   */
  async syncApplications(applications, userId = '') {
    return await apiRequest('/api/applications/sync', {
      method: 'POST',
      body: {
        user_id: userId,
        applications
      }
    });
  },

  /**
   * Scan inbox or background updates for status changes
   */
  async scanUpdates(userId = '') {
    return await apiRequest('/api/applications/scan-updates', {
      method: 'POST',
      body: { user_id: userId }
    });
  }
};

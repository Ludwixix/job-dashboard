/**
 * jobsApi.js
 * API interactions for job search, job fetching, scraper triggers, and link verification.
 */
import { apiRequest } from './client';
import { SCRAPER_BASE_URL } from '../services/jobQueryService';

export const jobsApi = {
  /**
   * Fetch jobs with optional filtering query parameters
   */
  async getJobs(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    const endpoint = queryString ? `/api/jobs?${queryString}` : '/api/jobs';
    return await apiRequest(endpoint);
  },

  /**
   * Fetch saved search criteria
   */
  async getSearchCriteria(userId = '') {
    const endpoint = userId 
      ? `/api/search-criteria?user_id=${encodeURIComponent(userId)}` 
      : '/api/search-criteria';
    return await apiRequest(endpoint, { baseUrl: SCRAPER_BASE_URL || undefined });
  },

  /**
   * Trigger background scraping / refresh
   */
  async triggerRefresh(criteria) {
    return await apiRequest('/api/refresh', {
      method: 'POST',
      body: criteria,
      baseUrl: SCRAPER_BASE_URL || undefined
    });
  },

  /**
   * Verify individual job URL liveness
   */
  async verifyJobUrl(url, force = false) {
    const endpoint = `/api/verify-job-url?url=${encodeURIComponent(url)}&force=${force ? 'true' : 'false'}`;
    return await apiRequest(endpoint);
  },

  /**
   * Batch verify job URLs
   */
  async verifyJobs(urls = []) {
    return await apiRequest('/api/verify-jobs', {
      method: 'POST',
      body: { urls }
    });
  }
};

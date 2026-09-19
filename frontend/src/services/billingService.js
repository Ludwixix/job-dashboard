/**
 * billingService.js
 * Manages user subscription lifecycle, Stripe Checkout redirect, Customer Portal,
 * and authenticated server-side AI proxy requests (Zero Secret Exposure).
 */

import { getBackendApiBase } from './apiConfig';
import { getAuthToken, getCurrentSession } from './authService';

const CACHE_KEY_BILLING = 'job_dashboard_billing_status_cache';

let inMemoryBillingStatus = null;

/**
 * Retrieves cached billing status synchronously.
 *
 * @returns {Object|null} Cached billing status or null.
 */
export const getCachedBillingStatus = () => {
  if (inMemoryBillingStatus) return inMemoryBillingStatus;
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY_BILLING);
    if (raw) {
      inMemoryBillingStatus = JSON.parse(raw);
      return inMemoryBillingStatus;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
};

/**
 * Fetches the user's live subscription status and token usage from backend.
 *
 * @param {Object} [options]
 * @param {boolean} [options.force=false]
 * @returns {Promise<Object>} Billing status payload.
 */
export const fetchBillingStatus = async ({ force = false } = {}) => {
  const token = getAuthToken();
  if (!token) {
    const fallback = {
      success: true,
      plan_tier: 'free',
      status: 'inactive',
      is_active: false,
      trial_generations_remaining: 3,
      tokens_used_this_month: 0,
      tokens_remaining: 0,
    };
    inMemoryBillingStatus = fallback;
    return fallback;
  }

  if (!force && inMemoryBillingStatus) {
    return inMemoryBillingStatus;
  }

  try {
    const apiBase = getBackendApiBase();
    const res = await fetch(`${apiBase}/api/billing/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      inMemoryBillingStatus = data;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(CACHE_KEY_BILLING, JSON.stringify(data));
        } catch {
          // Ignore storage quota
        }
        window.dispatchEvent(new CustomEvent('billing-status-updated', { detail: data }));
      }
      return data;
    }
  } catch (err) {
    console.warn('Could not fetch billing status from backend:', err);
  }

  return getCachedBillingStatus() || {
    success: true,
    plan_tier: 'free',
    status: 'inactive',
    is_active: false,
    trial_generations_remaining: 3,
    tokens_used_this_month: 0,
    tokens_remaining: 0,
  };
};

/**
 * Initiates Stripe Checkout Session for subscription or 3-month pass.
 *
 * @param {string} planId - 'pro_monthly' | 'pass_3mo'
 * @returns {Promise<{success: boolean, checkout_url?: string, error?: string}>}
 */
export const createCheckoutSession = async (planId = 'pro_monthly') => {
  const token = getAuthToken();
  const apiBase = getBackendApiBase();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

  const res = await fetch(`${apiBase}/api/billing/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      plan_id: planId,
      success_url: `${origin}/dashboard?payment=success&plan=${encodeURIComponent(planId)}`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Checkout initiation failed (HTTP ${res.status})`);
  }
  return data;
};

/**
 * Opens the Stripe Customer Portal for self-serve cancellation and invoice management.
 *
 * @returns {Promise<{success: boolean, portal_url?: string, error?: string}>}
 */
export const openCustomerPortal = async () => {
  const token = getAuthToken();
  const apiBase = getBackendApiBase();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

  const res = await fetch(`${apiBase}/api/billing/customer-portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      return_url: `${origin}/dashboard`,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Portal creation failed (HTTP ${res.status})`);
  }
  return data;
};

/**
 * Proxies an AI inference call through backend server using platform master credentials.
 * Used for Pro subscribers and trial accounts with zero API keys.
 *
 * @param {Object} payload - OpenAI-compatible request payload (messages, model, temperature).
 * @returns {Promise<Object>} Completed inference response.
 */
export const callAIProxy = async (payload) => {
  const token = getAuthToken();
  const apiBase = getBackendApiBase();

  const res = await fetch(`${apiBase}/api/ai/proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 402) {
    // Payment Required: trial exhausted or active subscription needed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-pricing-modal', {
        detail: { reason: 'trial_exhausted' }
      }));
    }
    const err = new Error(data?.error || 'Subscription required for built-in AI.');
    err.code = 'PAYMENT_REQUIRED';
    err.trialExhausted = true;
    throw err;
  }

  if (res.status === 429) {
    const err = new Error(data?.error || 'Monthly AI token allowance reached.');
    err.code = 'QUOTA_EXCEEDED';
    throw err;
  }

  if (!res.ok) {
    throw new Error(data?.error || `AI Gateway proxy returned HTTP ${res.status}`);
  }

  // Refresh billing status in background after successful proxy call
  fetchBillingStatus({ force: true }).catch(() => {});

  return data;
};


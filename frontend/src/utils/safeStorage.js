/**
 * safeStorage.js
 * Fault-tolerant LocalStorage & SessionStorage wrapper.
 * Prevents DOMExceptions in private browsing modes, quota exhaustion, or corrupted JSON crashes.
 */

export const safeStorage = {
  getItem: (key, defaultValue = null) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return defaultValue;
      const val = window.localStorage.getItem(key);
      if (val === null || val === undefined) return defaultValue;
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    } catch (e) {
      console.warn(`[safeStorage] Read failed for key "${key}":`, e);
      return defaultValue;
    }
  },

  setItem: (key, value) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      window.localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      console.warn(`[safeStorage] Write failed for key "${key}":`, e);
      return false;
    }
  },

  removeItem: (key) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      window.localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn(`[safeStorage] Remove failed for key "${key}":`, e);
      return false;
    }
  }
};

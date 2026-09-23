export const STORAGE_KEY_SITE_UNLOCKED = 'career_agent_site_unlocked';

export function isSiteUnlocked() {
  try {
    return localStorage.getItem(STORAGE_KEY_SITE_UNLOCKED) === 'true';
  } catch {
    return false;
  }
}

export function setSiteUnlocked(unlocked = true) {
  try {
    if (unlocked) {
      localStorage.setItem(STORAGE_KEY_SITE_UNLOCKED, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_SITE_UNLOCKED);
    }
  } catch (e) {
    console.warn('Could not persist site unlock state:', e);
  }
}

/**
 * profileOnboardingPipeline.js
 * Orchestrates everything that must happen the moment a profile is created or
 * updated so the dashboard is immediately and fully personalised:
 *   1. Apply the industry visual theme.
 *   2. Push profile-derived search queries to the backend (the scraper reads
 *      these server-side; without this step, discovery scrapes ignore the
 *      profile entirely and keep searching the previous/default queries).
 *   3. Seed recommendation preferences (boosted terms) from the resume so
 *      scoring/ranking favours the candidate's own skills and titles from
 *      the very first result set.
 *   4. Create a default saved search + reminder-ready view in Career
 *      Operations, so analytics and the fit-audit view have a concrete
 *      starting point instead of an empty state.
 */
import { buildQueriesFromProfile, pushQueriesToBackend } from './jobQueryService';
import { getUserPreferences, saveUserPreferences } from './scoringEngine';
import { applyIndustryTheme } from './industryThemeService';
import { saveSearch } from './careerOperationsService';

const TOP_N_SKILLS = 8;
const TOP_N_TITLES = 4;

/**
 * Merge resume-derived skills/titles into existing recommendation weights
 * without discarding any manual promote/demote choices the user already made.
 */
export const deriveInitialPreferences = (profile) => {
  const existing = getUserPreferences();
  const boostedTerms = Array.from(new Set([
    ...(existing.boostedTerms || []),
    ...(profile.coreSkills || []).slice(0, TOP_N_SKILLS),
    ...(profile.targetTitles || []).slice(0, TOP_N_TITLES),
  ]));
  return { ...existing, boostedTerms };
};

const buildDefaultSavedSearchName = (profile) => {
  const industry = profile.industry || 'My Roles';
  return `Primary — ${industry}`;
};

/**
 * Runs once per profile save (upload/edit completion). Returns a summary the
 * caller can surface as a status message; every step degrades gracefully so a
 * single failing network call never blocks the rest of the personalization.
 */
export const runProfileOnboardingPipeline = async (profile) => {
  if (!profile) return { success: false };
  const summary = { themeApplied: false, queriesPushed: false, preferencesSeeded: false, savedSearchCreated: false };

  try {
    applyIndustryTheme(profile.industry);
    summary.themeApplied = true;
  } catch {}

  const queries = buildQueriesFromProfile(profile);

  try {
    const pushResult = await pushQueriesToBackend(profile);
    summary.queriesPushed = Boolean(pushResult?.success);
  } catch {}

  try {
    saveUserPreferences(deriveInitialPreferences(profile));
    summary.preferencesSeeded = true;
  } catch {}

  try {
    const keywords = Array.from(new Set([
      ...(profile.targetTitles || []).slice(0, 5),
      ...(profile.coreSkills || []).slice(0, 5),
    ]));
    if (keywords.length) {
      await saveSearch(buildDefaultSavedSearchName(profile), { include: keywords, location: profile.location || '' });
      summary.savedSearchCreated = true;
    }
  } catch {}

  return { success: true, queries, ...summary };
};

/**
 * Lighter-weight sync used on passive mount/profile-refresh so the backend's
 * active search queries always match the currently loaded profile, without
 * re-seeding preferences or creating duplicate saved searches.
 */
export const syncProfileQueriesToBackend = async (profile) => {
  if (!profile) return { success: false };
  try {
    return await pushQueriesToBackend(profile);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

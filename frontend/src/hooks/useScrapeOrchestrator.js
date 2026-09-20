import { useState, useEffect, useCallback, useRef } from 'react';
import { buildQueriesFromProfile, triggerProfileScrape } from '../services/jobQueryService';
import { applyIndustryTheme } from '../services/industryThemeService';

/**
 * Hook to orchestrate candidate opportunity scraping telemetry, progress updates,
 * and onboarding discovery triggers while strictly enforcing anti-double-dipping safeguards.
 *
 * @param {Object} params
 * @param {Object|null} params.activeProfile - The currently active user candidate profile.
 * @param {Object|null} params.currentUser - Authenticated Google / session user object.
 * @param {Object|null} params.billingStatus - Platform tier subscription details for theme styling.
 * @param {Function} params.refetch - Callback to reload local jobs repository.
 * @returns {Object} Scraper telemetry state, status message, and discovery triggering functions.
 */
export function useScrapeOrchestrator({
  activeProfile = null,
  currentUser = null,
  billingStatus = null,
  refetch = null,
} = {}) {
  const [scrapeProgress, setScrapeProgress] = useState({
    isActive: false,
    percent: 0,
    stage: '',
    elapsedSec: 0,
    totalDiscovered: 0,
  });

  const [profileScrapeStatus, setProfileScrapeStatus] = useState(null); // null | 'loading' | 'done' | 'error'
  const [profileScrapeMsg, setProfileScrapeMsg] = useState('');

  /**
   * Dispatches discovery scraping for the given profile and coordinates real-time progress.
   */
  const triggerDiscoveryScrape = useCallback(async (targetProfile, options = {}) => {
    if (!targetProfile) return;
    const industry = targetProfile.industry || 'Technology & IT';
    const queries = buildQueriesFromProfile(targetProfile);
    const primaryQuery = targetProfile.targetTitles?.[0] || queries[0]?.term || industry;

    setScrapeProgress({
      isActive: true,
      percent: 5,
      stage: `Connecting to gateways for ${primaryQuery}...`,
      elapsedSec: 0,
      totalDiscovered: 0,
    });
    setProfileScrapeStatus('loading');
    setProfileScrapeMsg(`🔄 Ingestion Active: Scanning ${industry} opportunities...`);

    const startTime = Date.now();
    const timer = setInterval(() => {
      setScrapeProgress(prev => ({ ...prev, elapsedSec: Math.round((Date.now() - startTime) / 1000) }));
    }, 1000);

    try {
      const ttlHours = options.force ? 0.0 : 12.0;
      const result = await triggerProfileScrape(targetProfile, { ttl_hours: ttlHours, force: Boolean(options.force) });
      if (!result.success) throw new Error(result.error || 'Refresh failed');
      clearInterval(timer);
      applyIndustryTheme(industry, billingStatus);
      if (typeof refetch === 'function') {
        refetch();
      }
      const stats = result.cacheStats || {};
      const fromDb = Boolean(stats.satisfied_from_db && stats.satisfied_from_db.length > 0);
      setScrapeProgress({
        isActive: false,
        percent: 100,
        stage: fromDb ? 'Database Index Match' : stats.cache_hit ? 'Index already fresh' : 'Discovery Complete!',
        elapsedSec: Math.round((Date.now() - startTime) / 1000),
        totalDiscovered: stats.total_jobs || (result.jobs ? result.jobs.length : 0),
      });
      setProfileScrapeStatus('done');
      setProfileScrapeMsg(`✅ ${fromDb ? `Instant match: Loaded ${industry} opportunities from database` : stats.cache_hit ? 'Using the fresh indexed roles' : `Updated index with ${industry} opportunities`}`);
      setTimeout(() => {
        setScrapeProgress(prev => ({ ...prev, percent: 0, stage: '' }));
        setProfileScrapeStatus(null);
      }, 6000);
    } catch (error) {
      clearInterval(timer);
      setScrapeProgress(prev => ({ ...prev, isActive: false, percent: 100, stage: 'Index unchanged' }));
      setProfileScrapeStatus('error');
      setProfileScrapeMsg(`Refresh unavailable: ${error.message}`);
    }
  }, [refetch, billingStatus]);

  // When a new user logs in or completes onboarding, auto-scrape personalized roles immediately.
  // We maintain an immutable ref flag alongside sessionStorage cleanup to prevent concurrent
  // double-dipping scrapes across React strict mode remounts.
  const initialScrapeTriggeredRef = useRef(false);
  useEffect(() => {
    if (initialScrapeTriggeredRef.current) return;
    const isSessionTrigger = typeof window !== 'undefined' && sessionStorage.getItem('trigger_initial_scrape') === 'true';
    const shouldScrape = currentUser?.isNewUser || isSessionTrigger;
    if (shouldScrape && activeProfile) {
      initialScrapeTriggeredRef.current = true;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('trigger_initial_scrape');
      }
      triggerDiscoveryScrape(activeProfile, { force: false });
    }
  }, [currentUser?.isNewUser, activeProfile, triggerDiscoveryScrape]);

  return {
    scrapeProgress,
    setScrapeProgress,
    profileScrapeStatus,
    setProfileScrapeStatus,
    profileScrapeMsg,
    setProfileScrapeMsg,
    triggerDiscoveryScrape,
  };
}

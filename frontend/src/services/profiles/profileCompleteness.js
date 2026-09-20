/**
 * profileCompleteness.js
 * Industry-agnostic profile completeness calculation and actionable improvement items.
 */

/**
 * Calculates a profile completeness score (0 - 100%) and actionable improvement items.
 * Completely industry-agnostic, supporting any career path (healthcare, nursing, trades, finance, IT, etc.).
 *
 * @param {Object} profile Candidate profile object
 * @returns {{ score: number, isComplete: boolean, improvements: Array, atsDensity: string }}
 */
export function calculateProfileCompleteness(profile = {}) {
  let score = 0;
  const improvements = [];

  // 1. Identity & Name (15 pts)
  if (profile.name && profile.name.trim().length > 1) {
    score += 15;
  } else {
    improvements.push({
      id: 'name',
      category: 'Identity',
      title: 'Add your candidate name',
      description: 'Needed for personalized cover letters, outreach, and applications.',
      points: 15,
      actionLabel: 'Add Name (+15%)'
    });
  }

  // 2. Industry & Seniority (15 pts)
  if (profile.industry && profile.industry.trim().length > 1) {
    score += 15;
  } else {
    improvements.push({
      id: 'industry',
      category: 'Targeting',
      title: 'Select your target industry',
      description: 'Calibrates search scrapers and ATS matching algorithms to your domain.',
      points: 15,
      actionLabel: 'Select Industry (+15%)'
    });
  }

  // 3. Target Role Titles (15 pts)
  const titles = Array.isArray(profile.targetTitles) && profile.targetTitles.length > 0
    ? profile.targetTitles
    : profile.title ? [profile.title] : [];
  if (titles.length > 0) {
    score += 15;
  } else {
    improvements.push({
      id: 'titles',
      category: 'Role Targeting',
      title: 'Define target job titles',
      description: 'Prioritizes high-conviction job opportunities in your search feed.',
      points: 15,
      actionLabel: 'Add Target Roles (+15%)'
    });
  }

  // 4. Core Skills & Keywords (15 pts)
  const skills = Array.isArray(profile.coreSkills) ? profile.coreSkills : [];
  if (skills.length >= 6) {
    score += 15;
  } else if (skills.length > 0) {
    score += 8;
    improvements.push({
      id: 'skills',
      category: 'ATS Keywords',
      title: `Add more core skills (${skills.length}/6 added)`,
      description: 'Increases ATS match accuracy and unlocks higher fit scoring tiers.',
      points: 7,
      actionLabel: 'Expand Skills (+7%)'
    });
  } else {
    improvements.push({
      id: 'skills',
      category: 'ATS Keywords',
      title: 'Add core skills and competencies',
      description: 'Essential for matching job descriptions and keywords.',
      points: 15,
      actionLabel: 'Add Core Skills (+15%)'
    });
  }

  // 5. Location & Commute (15 pts)
  if (profile.location && profile.location.trim().length > 1) {
    score += 15;
  } else {
    improvements.push({
      id: 'location',
      category: 'Location',
      title: 'Specify preferred location or suburb',
      description: 'Calculates commute radiuses and uncovers nearby roles.',
      points: 15,
      actionLabel: 'Set Location (+15%)'
    });
  }

  // 6. Resume / Work History (15 pts)
  const hasHistory = Boolean(
    (profile.workHistorySummary && profile.workHistorySummary.trim().length > 10) ||
    (profile.fullWorkExperienceText && profile.fullWorkExperienceText.trim().length > 30) ||
    (profile.summary && profile.summary.trim().length > 20)
  );
  if (hasHistory) {
    score += 15;
  } else {
    improvements.push({
      id: 'resume',
      category: 'Experience',
      title: 'Add work experience or upload resume',
      description: 'Unlocks STAR achievement extraction and tailored application synthesis.',
      points: 15,
      actionLabel: 'Add Experience (+15%)'
    });
  }

  // 7. AI Key / Reasoning Engine (10 pts)
  let hasAiKey = false;
  try {
    const rawConfig = typeof window !== 'undefined' ? localStorage.getItem('job_dashboard_llm_config') : null;
    if (rawConfig) {
      const parsedConfig = JSON.parse(rawConfig);
      hasAiKey = Boolean(parsedConfig.apiKey && parsedConfig.apiKey.length > 3);
    }
  } catch {}
  if (hasAiKey) {
    score += 10;
  } else {
    improvements.push({
      id: 'aiEngine',
      category: 'AI Engine',
      title: 'Connect AI Reasoning Key (Optional)',
      description: 'Powers automated document tuning, bespoke cover letters, and interview coaching.',
      points: 10,
      actionLabel: 'Connect AI Key (+10%)'
    });
  }

  return {
    score: Math.min(100, score),
    isComplete: score >= 100,
    improvements,
    atsDensity: skills.length >= 8 ? 'Optimal' : skills.length >= 4 ? 'Good' : 'Low'
  };
}

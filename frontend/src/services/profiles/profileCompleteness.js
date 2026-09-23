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
  const name = profile.name || profile.full_name || profile.candidateName || profile.candidate_name;
  if (name && String(name).trim().length > 1) {
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
  const industry = profile.industry || profile.targetIndustry || profile.domain;
  if (industry && String(industry).trim().length > 1) {
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
  const rawTitles = profile.targetTitles || profile.target_titles || profile.targetRoles || profile.target_roles || [];
  const titles = Array.isArray(rawTitles) && rawTitles.length > 0
    ? rawTitles
    : profile.title ? [profile.title] : [];
  if (titles.length >= 1) {
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

  // 4. Core Skills & Keywords (20 pts)
  const rawSkills = profile.coreSkills || profile.core_skills || profile.skills || [];
  const skills = Array.isArray(rawSkills)
    ? rawSkills.filter(Boolean)
    : (typeof rawSkills === 'string' ? rawSkills.split(',').map(s => s.trim()).filter(Boolean) : []);
  if (skills.length >= 3) {
    score += 20;
  } else if (skills.length > 0) {
    score += 10;
    improvements.push({
      id: 'skills',
      category: 'ATS Keywords',
      title: `Add 1-2 more core skills (${skills.length}/3 added)`,
      description: 'Increases ATS match accuracy and unlocks higher fit scoring tiers.',
      points: 10,
      actionLabel: 'Expand Skills (+10%)'
    });
  } else {
    improvements.push({
      id: 'skills',
      category: 'ATS Keywords',
      title: 'Add core skills and competencies',
      description: 'Essential for matching job descriptions and keywords.',
      points: 20,
      actionLabel: 'Add Core Skills (+20%)'
    });
  }

  // 5. Location & Commute (15 pts)
  const loc = profile.location || profile.locationPreference || profile.location_preference || profile.suburb || profile.city;
  if (loc && String(loc).trim().length > 1) {
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

  // 6. Resume / Work History (20 pts)
  const historySummary = profile.workHistorySummary || profile.work_history_summary || profile.summary || '';
  const historyText = profile.fullWorkExperienceText || profile.full_work_experience_text || profile.workExperience || profile.experience || '';
  const hasProjects = Array.isArray(profile.projects) && profile.projects.length > 0;
  const hasHistory = Boolean(
    (historySummary && historySummary.trim().length > 10) ||
    (historyText && historyText.trim().length > 30) ||
    hasProjects
  );
  if (hasHistory) {
    score += 20;
  } else {
    improvements.push({
      id: 'resume',
      category: 'Experience',
      title: 'Add work experience or upload resume',
      description: 'Unlocks STAR achievement extraction and tailored application synthesis.',
      points: 20,
      actionLabel: 'Add Experience (+20%)'
    });
  }

  return {
    score: Math.min(100, score),
    isComplete: score >= 100,
    improvements,
    atsDensity: skills.length >= 8 ? 'Optimal' : skills.length >= 4 ? 'Good' : 'Low'
  };
}

/**
 * scoringEngine.js
 * Client-Side Dynamic ATS Match Scoring & Distance Engine
 * Computes live match score, matched keywords, and commute distance for ANY candidate profile.
 */

const MELBOURNE_SUBURB_COORDINATES = {
  'melbourne': { lat: -37.8136, lon: 144.9631 },
  'cbd': { lat: -37.8136, lon: 144.9631 },
  'richmond': { lat: -37.8230, lon: 144.9980 },
  'cremorne': { lat: -37.8280, lon: 144.9940 },
  'southbank': { lat: -37.8253, lon: 144.9631 },
  'docklands': { lat: -37.8180, lon: 144.9450 },
  'south melbourne': { lat: -37.8330, lon: 144.9580 },
  'port melbourne': { lat: -37.8400, lon: 144.9300 },
  'st kilda': { lat: -37.8640, lon: 144.9820 },
  'balaclava': { lat: -37.8680, lon: 144.9940 },
  'prahran': { lat: -37.8510, lon: 144.9980 },
  'windsor': { lat: -37.8550, lon: 144.9920 },
  'south yarra': { lat: -37.8400, lon: 144.9900 },
  'toorak': { lat: -37.8410, lon: 145.0160 },
  'armadale': { lat: -37.8560, lon: 145.0190 },
  'malvern': { lat: -37.8600, lon: 145.0340 },
  'caulfield': { lat: -37.8770, lon: 145.0250 },
  'elsternwick': { lat: -37.8830, lon: 145.0030 },
  'elwood': { lat: -37.8820, lon: 144.9860 },
  'brighton': { lat: -37.9060, lon: 144.9920 },
  'bentleigh': { lat: -37.9170, lon: 145.0340 },
  'clayton': { lat: -37.9150, lon: 145.1200 },
  'dandenong': { lat: -37.9810, lon: 145.2150 },
  'box hill': { lat: -37.8180, lon: 145.1230 },
  'ringwood': { lat: -37.8140, lon: 145.2280 },
  'footscray': { lat: -37.8010, lon: 144.9030 },
  'brunswick': { lat: -37.7740, lon: 144.9600 },
  'carlton': { lat: -37.8010, lon: 144.9670 },
  'fitzroy': { lat: -37.8010, lon: 144.9780 },
  'collingwood': { lat: -37.8010, lon: 144.9880 },
  'hawthorn': { lat: -37.8220, lon: 145.0350 },
  'camberwell': { lat: -37.8280, lon: 145.0580 },
  'geelong': { lat: -38.1499, lon: 144.3617 }
};

/**
 * Approximate distance between two suburb coordinates (Haversine formula)
 */
export const calculateCandidateDistanceKm = (jobLocationStr = '', candidateLocationStr = '') => {
  const jobLoc = (jobLocationStr || '').toLowerCase();
  const candLoc = (candidateLocationStr || '').toLowerCase();

  let jobCoords = null;
  for (const [suburb, coords] of Object.entries(MELBOURNE_SUBURB_COORDINATES)) {
    if (jobLoc.includes(suburb)) {
      jobCoords = coords;
      break;
    }
  }

  let candCoords = null;
  for (const [suburb, coords] of Object.entries(MELBOURNE_SUBURB_COORDINATES)) {
    if (candLoc.includes(suburb)) {
      candCoords = coords;
      break;
    }
  }

  if (!candCoords) {
    candCoords = MELBOURNE_SUBURB_COORDINATES['melbourne'];
  }

  if (!jobCoords) {
    // If job is CBD or general Melbourne
    if (jobLoc.includes('melbourne') || jobLoc.includes('vic')) {
      jobCoords = MELBOURNE_SUBURB_COORDINATES['cbd'];
    } else {
      return 15; // default fallback km
    }
  }

  const R = 6371; // Earth radius in km
  const dLat = (jobCoords.lat - candCoords.lat) * (Math.PI / 180);
  const dLon = (jobCoords.lon - candCoords.lon) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(candCoords.lat * (Math.PI / 180)) * Math.cos(jobCoords.lat * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = Math.round(R * c);

  return distance;
};

/**
 * Calculate dynamic ATS Match Score, Matched Keywords, and Quality Audit for a candidate profile
 */
export const calculateCandidateJobMatch = (job, profile) => {
  if (!job || !profile) {
    return {
      score: job?.score || 85,
      matchedSkills: job?.tags || [],
      missingSkills: [],
      matchTier: 'High Fit'
    };
  }

  const jobText = `${job.title || ''} ${job.company || ''} ${job.notes || ''} ${job.description || ''} ${job.why || ''}`.toLowerCase();
  const jobTitleLower = (job.title || '').toLowerCase();

  // 1. Core Skills Match
  const candidateSkills = profile.coreSkills || [];
  const matchedSkills = [];

  candidateSkills.forEach(skill => {
    const sLower = skill.toLowerCase();
    if (jobText.includes(sLower)) {
      matchedSkills.push(skill);
    }
  });

  // 2. Target Titles Match
  const targetTitles = profile.targetTitles || [profile.title || ''];
  let titleMatchScore = 0;
  targetTitles.forEach(tt => {
    const ttWords = tt.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    let matchCount = 0;
    ttWords.forEach(w => {
      if (jobTitleLower.includes(w)) matchCount++;
    });
    const ratio = matchCount / Math.max(1, ttWords.length);
    if (ratio > titleMatchScore) titleMatchScore = ratio;
  });

  // 3. Proximity bonus
  const distanceKm = calculateCandidateDistanceKm(job.location, profile.location);
  let distanceBonus = 0;
  if (distanceKm <= 5) distanceBonus = 8;
  else if (distanceKm <= 12) distanceBonus = 5;
  else if (distanceKm <= 25) distanceBonus = 2;

  // 4. Calculate Final Composite ATS Score (Normalized between 55% and 98%)
  const skillRatio = matchedSkills.length / Math.max(4, Math.min(candidateSkills.length, 10));
  let calculatedScore = Math.round(
    (titleMatchScore * 45) +
    (skillRatio * 45) +
    distanceBonus +
    10 // base baseline
  );

  // Bounds
  if (calculatedScore > 98) calculatedScore = 98;
  if (calculatedScore < 50) calculatedScore = 50;

  // If job is in candidate's top title match and has skills, boost to 90%+
  if (titleMatchScore >= 0.7 && matchedSkills.length >= 2) {
    calculatedScore = Math.max(90, calculatedScore);
  }

  // Tier classification
  let matchTier = 'Good Fit';
  if (calculatedScore >= 90) matchTier = 'Top Fit ⭐';
  else if (calculatedScore >= 80) matchTier = 'High Fit';
  else if (calculatedScore >= 70) matchTier = 'Moderate Fit';
  else matchTier = 'Exploratory / Wild Card';

  return {
    score: calculatedScore,
    matchedSkills: matchedSkills.length > 0 ? matchedSkills : (job.tags || []).slice(0, 3),
    distanceKm: distanceKm,
    matchTier: matchTier
  };
};

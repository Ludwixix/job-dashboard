/**
 * @file scoringTuningService.js
 * @description Provides client-side dynamic multi-factor scoring matrix recalculation
 * and weight normalization for CAREER.AGENT opportunities.
 */

export const DEFAULT_SCORING_WEIGHTS = {
  semantic_density: 0.40,
  title_alignment: 0.25,
  recency: 0.15,
  star_impact: 0.15,
  clearances: 0.05
};

/**
 * Normalizes an arbitrary set of numeric weights so they sum to 1.0.
 * Falls back to DEFAULT_SCORING_WEIGHTS if the sum is zero or invalid.
 *
 * @param {Object} weights - Map of dimension keys to numeric weights.
 * @returns {Object} Normalized weights summing to 1.0.
 */
export function normalizeWeights(weights = {}) {
  const keys = Object.keys(DEFAULT_SCORING_WEIGHTS);
  const raw = {};
  let sum = 0;

  keys.forEach(k => {
    const val = Number(weights[k]);
    const cleanVal = isNaN(val) || val < 0 ? 0 : val;
    raw[k] = cleanVal;
    sum += cleanVal;
  });

  if (sum <= 0) {
    return { ...DEFAULT_SCORING_WEIGHTS };
  }

  const normalized = {};
  keys.forEach(k => {
    normalized[k] = raw[k] / sum;
  });

  return normalized;
}

/**
 * Recalculates match scores and sorts jobs descending based on custom dimension weights.
 *
 * @param {Array<Object>} jobs - List of opportunity objects.
 * @param {Object} customWeights - Dimension weights.
 * @returns {Array<Object>} Re-scored and sorted job opportunities.
 */
export function recalculateJobScores(jobs = [], customWeights = {}) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return [];
  }

  const weights = normalizeWeights(customWeights);

  const updatedJobs = jobs.map(job => {
    const breakdown = job.score_breakdown || {};

    // Extract dimension scores (defaulting sensibly if breakdown is missing)
    const baseScore = Number(job.score || job.matchScore || 70);
    const semantic = Number(breakdown.semantic_density ?? baseScore);
    const title = Number(breakdown.title_alignment ?? baseScore);
    const recency = Number(breakdown.recency ?? baseScore);
    const star = Number(breakdown.star_impact ?? baseScore);
    const clearances = Number(breakdown.clearances ?? 80);

    const weightedScore = Math.round(
      semantic * weights.semantic_density +
      title * weights.title_alignment +
      recency * weights.recency +
      star * weights.star_impact +
      clearances * weights.clearances
    );

    return {
      ...job,
      score: weightedScore,
      matchScore: weightedScore,
      applied_weights: { ...weights }
    };
  });

  // Sort descending by calculated score
  return updatedJobs.sort((a, b) => b.score - a.score);
}

/**
 * Asynchronously re-scores jobs, utilizing a dedicated Web Worker when supported
 * or falling back synchronously to recalculateJobScores.
 *
 * @param {Array<Object>} jobs - List of opportunity objects.
 * @param {Object} customWeights - Dimension weights.
 * @returns {Promise<Array<Object>>} Re-scored and sorted jobs.
 */
export async function recalculateJobScoresAsync(jobs = [], customWeights = {}) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return [];
  }

  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    try {
      return await new Promise((resolve) => {
        const worker = new Worker(
          new URL('../workers/scoreWorker.js', import.meta.url),
          { type: 'module' }
        );
        worker.onmessage = (e) => {
          worker.terminate();
          resolve(e.data?.jobs || []);
        };
        worker.onerror = () => {
          worker.terminate();
          resolve(recalculateJobScores(jobs, customWeights));
        };
        worker.postMessage({ jobs, weights: customWeights });
      });
    } catch {
      return recalculateJobScores(jobs, customWeights);
    }
  }

  return recalculateJobScores(jobs, customWeights);
}



/**
 * @file scoreWorker.js
 * @description Dedicated Web Worker to re-score and sort 11,400+ job opportunities off the main UI thread.
 */

self.onmessage = (e) => {
  const { jobs, weights } = e.data || {};
  if (!Array.isArray(jobs) || jobs.length === 0) {
    self.postMessage({ success: true, jobs: [] });
    return;
  }

  // Normalize weights
  const defaultWeights = {
    semantic_density: 0.40,
    title_alignment: 0.25,
    recency: 0.15,
    star_impact: 0.15,
    clearances: 0.05
  };

  const keys = Object.keys(defaultWeights);
  const raw = {};
  let sum = 0;
  keys.forEach(k => {
    const val = Number(weights?.[k]);
    const cleanVal = isNaN(val) || val < 0 ? 0 : val;
    raw[k] = cleanVal;
    sum += cleanVal;
  });

  const normalized = {};
  if (sum <= 0) {
    Object.assign(normalized, defaultWeights);
  } else {
    keys.forEach(k => {
      normalized[k] = raw[k] / sum;
    });
  }

  const updatedJobs = jobs.map(job => {
    const breakdown = job.score_breakdown || {};
    const baseScore = Number(job.score || job.matchScore || 70);
    const semantic = Number(breakdown.semantic_density ?? baseScore);
    const title = Number(breakdown.title_alignment ?? baseScore);
    const recency = Number(breakdown.recency ?? baseScore);
    const star = Number(breakdown.star_impact ?? baseScore);
    const clearances = Number(breakdown.clearances ?? 80);

    const weightedScore = Math.round(
      semantic * normalized.semantic_density +
      title * normalized.title_alignment +
      recency * normalized.recency +
      star * normalized.star_impact +
      clearances * normalized.clearances
    );

    return {
      ...job,
      score: weightedScore,
      matchScore: weightedScore,
      applied_weights: { ...normalized }
    };
  });

  updatedJobs.sort((a, b) => b.score - a.score);

  self.postMessage({ success: true, jobs: updatedJobs });
};

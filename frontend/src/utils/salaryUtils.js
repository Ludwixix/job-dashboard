/**
 * salaryUtils.js
 * Numerical salary parsing, boundary extraction, and threshold matching.
 *
 * Why: Job postings express remuneration in diverse, non-standard formats:
 * - Annual full figures: "$140,000 - $170,000 + Super", "$150,000 p.a."
 * - Shorthand figures: "$120k - $140k", "$135k"
 * - Hourly contractor rates: "$75 - $95 / hr", "$85 per hour"
 * - Daily contractor rates: "$800 - $1,100 per day"
 * - Structured backend fields: salary_min, salary_max
 *
 * Naive substring matching (e.g. `salary.includes('100')`) catastrophically fails
 * for high-value roles ($140,000, $150k, $180k+) or incorrectly matches low wages
 * ($45,100). This module normalizes values into comparable annual numbers.
 */

/**
 * Normalizes and extracts numeric min and max salary bounds from a job record.
 * 
 * Why: Allows comparing candidate compensation floors and applying threshold filters
 * regardless of whether the provider emitted structured floats, hourly contract rates,
 * or raw Australian text strings.
 *
 * @param {Object} job - Job ad or candidate match record
 * @returns {{ min: number|null, max: number|null, isAnnual: boolean, raw: string }}
 */
export const parseSalaryNumeric = (job) => {
  if (!job) {
    return { min: null, max: null, isAnnual: true, raw: '' };
  }

  // 1. Prefer structured numbers if already parsed by ingestion pipeline
  const minNum = typeof job.salary_min === 'number' && !isNaN(job.salary_min) ? job.salary_min : null;
  const maxNum = typeof job.salary_max === 'number' && !isNaN(job.salary_max) ? job.salary_max : null;

  const rawText = String(job.salary || job.salary_bracket?.raw_text || '').trim();

  if (minNum !== null || maxNum !== null) {
    return {
      min: minNum ?? maxNum,
      max: maxNum ?? minNum,
      isAnnual: true,
      raw: rawText
    };
  }

  if (!rawText) {
    return { min: null, max: null, isAnnual: true, raw: '' };
  }

  const lower = rawText.toLowerCase();

  // 2. Identify rate cadence to convert to annual baseline
  const isHourly = /(?:\/\s*hr|\bhourly\b|\bhour\b|\bp[\.\/]?h\b)/i.test(lower);
  const isDaily = /(?:\/\s*day|\bper\s+day\b|\bdaily\b|\bp[\.\/]?d\b)/i.test(lower);

  // Multiplier to approximate full-time annual equivalent
  // Standard AU work year: ~1,950 hours or ~230 contract days
  const multiplier = isHourly ? 1950 : isDaily ? 230 : 1;

  // 3. Match numeric patterns ($120k, $120,000, 140000, 75.50)
  // Extract all numbers that represent money amounts
  const matches = [];
  const regex = /\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|m)?/gi;
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    const rawVal = match[1].replace(/,/g, '');
    let val = parseFloat(rawVal);
    if (isNaN(val)) continue;

    const suffix = (match[2] || '').toLowerCase();
    if (suffix === 'k') {
      val *= 1000;
    } else if (suffix === 'm') {
      val *= 1000000;
    } else if (!isHourly && !isDaily && val < 500 && !rawVal.includes('.')) {
      // Treat naked 2-3 digit annual numbers as thousands (e.g. "$120 - $140")
      val *= 1000;
    }

    matches.push(val * multiplier);
  }

  if (matches.length === 0) {
    return { min: null, max: null, isAnnual: !isHourly && !isDaily, raw: rawText };
  }

  const sorted = matches.sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  return {
    min,
    max,
    isAnnual: !isHourly && !isDaily,
    raw: rawText
  };
};

/**
 * Checks whether a job ad satisfies a target minimum salary filter.
 *
 * Why: Provides instantaneous, accurate filtering in the UI without excluding
 * valid roles that exceed the bracket.
 *
 * @param {Object} job - Target job record
 * @param {string} filterOption - 'All' | '70k+' | '100k+' | '130k+' | '150k+'
 * @returns {boolean} True if the job meets or exceeds the threshold (or if filter is 'All')
 */
export const matchesSalaryThreshold = (job, filterOption) => {
  if (!filterOption || filterOption === 'All') return true;

  const parsed = parseSalaryNumeric(job);

  // If no remuneration is disclosed, exclude from positive salary thresholds
  if (parsed.min === null && parsed.max === null) {
    return false;
  }

  const effectiveSalary = parsed.max ?? parsed.min;
  if (effectiveSalary === null) return false;

  switch (filterOption) {
    case '150k+':
      return effectiveSalary >= 150000;
    case '130k+':
      return effectiveSalary >= 130000;
    case '100k+':
      return effectiveSalary >= 100000;
    case '70k+':
      return effectiveSalary >= 70000;
    default:
      return true;
  }
};

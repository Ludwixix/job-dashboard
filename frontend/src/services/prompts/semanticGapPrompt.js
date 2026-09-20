/**
 * semanticGapPrompt.js
 * Domain prompts and system instructions for ATS semantic gap analysis,
 * conceptual capability matching, and neural density diagnostics.
 */

/**
 * Builds system and user prompts for semantic keyword and capability gap analysis.
 *
 * @param {Object} job - Target job entity.
 * @param {Object} profile - Candidate profile record.
 * @returns {{systemPrompt: string, userPrompt: string}}
 */
export const buildSemanticGapPrompt = (job, profile = {}) => {
  const candidateName = profile?.name || 'Candidate';
  const role = job?.title || 'Target Role';
  const company = job?.company || 'Target Employer';

  const systemPrompt = `You are a Principal Talent Acquisition Architect and ATS Intelligence Analyst.
Analyze the target job description against the candidate's verified profile to perform a high-precision Semantic Gap Analysis.
Your analysis must evaluate conceptual density, domain-specific requirements, and identify missing capabilities.
Output JSON conforming to the schema:
{
  "semantic_density_score": 85,
  "diagnostic_summary": "Summary of alignment and gaps.",
  "recommended_action": "pursue_high_conviction | pursue_with_tailoring | caution_low_alignment",
  "matched_competencies": ["Skill 1", "Skill 2"],
  "missing_competencies": ["Skill 3", "Skill 4"],
  "anchored_achievements": []
}`;

  const userPrompt = `TARGET OPPORTUNITY:
Role: ${role}
Company: ${company}
Description:
${job?.description || job?.notes || 'Enterprise deliverables and technical responsibilities.'}

CANDIDATE:
Name: ${candidateName}
Title: ${profile?.title || 'Professional'}
Core Skills: ${(profile?.coreSkills || []).join(', ')}
Work History Summary: ${profile?.workHistorySummary || profile?.fullWorkExperienceText || ''}

Evaluate semantic density and return actionable gap diagnostics.`;

  return { systemPrompt, userPrompt };
};

/**
 * Heuristic client-side fallback generator for semantic gap analysis.
 *
 * @param {Object} job
 * @param {Object} profile
 * @param {Function} extractKeywordsFn
 * @returns {Object} Semantic gap analysis diagnostic object
 */
export const buildFallbackSemanticDiagnostic = (job, profile = {}, extractKeywordsFn) => {
  const keywords = extractKeywordsFn ? extractKeywordsFn(job?.description || job?.notes || '') : [];
  const matched = Array.isArray(keywords) ? keywords.filter(k => k.matched).map(k => k.group || k) : [];
  const missing = Array.isArray(keywords) ? keywords.filter(k => !k.matched).map(k => k.group || k) : [];
  const densityScore = Math.min(100, Math.max(30, Math.round((matched.length / (keywords.length || 1)) * 100)));

  return {
    job_id: job?.id || 'job_target',
    job_title: job?.title || 'Target Role',
    company: job?.company || 'Target Employer',
    candidate_name: profile?.name || 'Candidate',
    semantic_density_score: densityScore,
    diagnostic_summary: densityScore >= 75
      ? `Strong semantic alignment (${densityScore}%) for ${job?.title || 'this role'}. Core competencies verified.`
      : `Moderate semantic alignment (${densityScore}%). Tailoring recommended for missing capabilities: ${missing.slice(0, 3).join(', ')}.`,
    recommended_action: densityScore >= 75 ? 'pursue_high_conviction' : 'pursue_with_tailoring',
    matched_competencies: matched,
    missing_competencies: missing,
    anchored_achievements: [],
    localization: 'en-AU'
  };
};

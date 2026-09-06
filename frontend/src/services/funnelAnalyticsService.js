/**
 * Multi-Sector Application Analytics & Pipeline Velocity Service
 * Computes lifecycle stage transitions, velocity/cycle times, stalled alerts,
 * and benchmarks against Australian industry standards.
 */

import { getApiBase } from './dataService';

export const AU_SECTOR_BENCHMARKS = {
  technology: {
    sector_label: 'Technology & Engineering',
    apply_to_interview_pct: 12.0,
    interview_to_offer_pct: 22.0,
    overall_yield_pct: 2.6,
    avg_days_to_interview: 14,
    avg_cycle_days: 28,
    market_summary: 'High screening volume, technical take-home/coding rounds, standard 28-day hiring loop.',
  },
  healthcare: {
    sector_label: 'Healthcare & Nursing',
    apply_to_interview_pct: 28.0,
    interview_to_offer_pct: 45.0,
    overall_yield_pct: 12.6,
    avg_days_to_interview: 8,
    avg_cycle_days: 18,
    market_summary: 'Credential-driven fast recruitment with high vacancy pressure and rapid interviews.',
  },
  finance: {
    sector_label: 'Banking, Finance & Accounting',
    apply_to_interview_pct: 15.0,
    interview_to_offer_pct: 24.0,
    overall_yield_pct: 3.6,
    avg_days_to_interview: 16,
    avg_cycle_days: 32,
    market_summary: 'Multi-stage partner/MD reviews, background checks, and conservative cadence.',
  },
  trades: {
    sector_label: 'Trades, Construction & Logistics',
    apply_to_interview_pct: 35.0,
    interview_to_offer_pct: 52.0,
    overall_yield_pct: 18.2,
    avg_days_to_interview: 5,
    avg_cycle_days: 12,
    market_summary: 'Immediate site ticket verification, trial days, direct superintendent phone screens.',
  },
  legal: {
    sector_label: 'Legal & Professional Services',
    apply_to_interview_pct: 18.0,
    interview_to_offer_pct: 28.0,
    overall_yield_pct: 5.0,
    avg_days_to_interview: 18,
    avg_cycle_days: 35,
    market_summary: 'Structured partner interviews, writing sample audits, compliance clearances.',
  },
};

export const STAGE_CONFIGS = [
  { id: 'sourced', label: 'Sourced / Discovered', icon: 'Compass', color: 'blue', desc: 'Identified opportunities' },
  { id: 'shortlisted', label: 'Shortlisted', icon: 'Bookmark', color: 'indigo', desc: 'Saved for evaluation' },
  { id: 'applied', label: 'Applied', icon: 'Send', color: 'cyan', desc: 'Application submitted' },
  { id: 'interviewing', label: 'Interviewing', icon: 'Calendar', color: 'purple', desc: 'Active interview rounds' },
  { id: 'offer', label: 'Offer Received', icon: 'Award', color: 'emerald', desc: 'Formal offer extended' },
  { id: 'accepted', label: 'Accepted / Hired', icon: 'CheckCircle2', color: 'green', desc: 'Offer finalized' },
];

export function formatConversionPct(val) {
  if (val === null || val === undefined || isNaN(val)) return '0.0%';
  return `${Number(val).toFixed(1)}%`;
}

export function formatDays(val) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return `${Math.round(val)}d`;
}

export function getHealthBadgeClass(badge) {
  switch (badge) {
    case 'emerald':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'cyan':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    case 'amber':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'rose':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

export function getStageColor(stageId) {
  switch (stageId) {
    case 'sourced':
      return 'text-blue-400 bg-blue-500/15 border-blue-500/30';
    case 'shortlisted':
      return 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30';
    case 'applied':
      return 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30';
    case 'interviewing':
      return 'text-purple-400 bg-purple-500/15 border-purple-500/30';
    case 'offer':
      return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    case 'accepted':
      return 'text-green-400 bg-green-500/15 border-green-500/30';
    default:
      return 'text-slate-400 bg-slate-500/15 border-slate-500/30';
  }
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Pure client-side calculation fallback for offline resilience or local preview.
 */
export function computeClientFunnelAnalytics(jobs = [], sector = 'technology', now = new Date()) {
  const sectorKey = (sector || 'technology').toLowerCase();
  const benchmark = AU_SECTOR_BENCHMARKS[sectorKey] || AU_SECTOR_BENCHMARKS.technology;

  const totalJobs = jobs.length;
  let activePipelineCount = 0;
  let rejectedCount = 0;

  const shortlistedJobs = [];
  const appliedJobs = [];
  const interviewingJobs = [];
  const offerJobs = [];
  const acceptedJobs = [];

  for (const job of jobs) {
    const status = String(job.status || 'new').toLowerCase().trim();

    const isAccepted = status === 'accepted' || status === 'hired';
    const isOffer = isAccepted || status === 'offer' || status === 'offered';
    const isInterview = isOffer || ['interviewing', 'interview', 'screening', 'technical_interview', 'final_interview'].includes(status);
    const isApplied = isInterview || ['applied', 'submitted', 'in_review', 'rejected'].includes(status);
    const isShortlisted = isApplied || ['saved', 'shortlist', 'shortlisted'].includes(status);

    if (status === 'rejected') rejectedCount += 1;
    if (isShortlisted) shortlistedJobs.push(job);
    if (isApplied) appliedJobs.push(job);
    if (isInterview) interviewingJobs.push(job);
    if (isOffer) offerJobs.push(job);
    if (isAccepted) acceptedJobs.push(job);

    if (['saved', 'shortlisted', 'applied', 'interviewing', 'offer'].includes(status)) {
      activePipelineCount += 1;
    }
  }

  const stageCounts = {
    sourced: totalJobs,
    shortlisted: shortlistedJobs.length,
    applied: appliedJobs.length,
    interviewing: interviewingJobs.length,
    offer: offerJobs.length,
    accepted: acceptedJobs.length,
  };

  const conversionRates = {
    sourced_to_shortlist_pct: stageCounts.sourced > 0 ? Number(((stageCounts.shortlisted / stageCounts.sourced) * 100).toFixed(1)) : 0,
    shortlist_to_apply_pct: stageCounts.shortlisted > 0 ? Number(((stageCounts.applied / stageCounts.shortlisted) * 100).toFixed(1)) : 0,
    apply_to_interview_pct: stageCounts.applied > 0 ? Number(((stageCounts.interviewing / stageCounts.applied) * 100).toFixed(1)) : 0,
    interview_to_offer_pct: stageCounts.interviewing > 0 ? Number(((stageCounts.offer / stageCounts.interviewing) * 100).toFixed(1)) : 0,
    offer_to_accepted_pct: stageCounts.offer > 0 ? Number(((stageCounts.accepted / stageCounts.offer) * 100).toFixed(1)) : 0,
    overall_yield_pct: stageCounts.sourced > 0 ? Number(((stageCounts.accepted / stageCounts.sourced) * 100).toFixed(1)) : 0,
  };

  // Stalled applications
  const stalled = [];
  for (const job of jobs) {
    const status = String(job.status || 'new').toLowerCase().trim();
    if (!['applied', 'interviewing', 'shortlisted', 'saved'].includes(status)) continue;

    const appliedDt = parseDate(job.applied_date || job.date_applied);
    const updatedDt = parseDate(job.updated_at || job.last_updated);
    const shortlistedDt = parseDate(job.date_shortlisted || job.date_added);

    if (status === 'applied') {
      const refDt = appliedDt || updatedDt;
      if (refDt) {
        const days = Math.max(0, Math.floor((now.getTime() - refDt.getTime()) / (1000 * 60 * 60 * 24)));
        if (days >= 14) {
          stalled.push({
            id: job.id,
            title: job.title || 'Unknown Role',
            company: job.company || 'Unknown Employer',
            stage: 'applied',
            days_in_stage: days,
            threshold_days: 14,
            severity: days >= 24 ? 'critical' : 'warning',
            action_recommendation: `Application pending for ${days} days without response. Send a polite 14-day check-in email.`,
          });
        }
      }
    } else if (['interviewing', 'interview'].includes(status)) {
      const refDt = updatedDt || parseDate(job.interview_date) || appliedDt;
      if (refDt) {
        const days = Math.max(0, Math.floor((now.getTime() - refDt.getTime()) / (1000 * 60 * 60 * 24)));
        if (days >= 21) {
          stalled.push({
            id: job.id,
            title: job.title || 'Unknown Role',
            company: job.company || 'Unknown Employer',
            stage: 'interviewing',
            days_in_stage: days,
            threshold_days: 21,
            severity: days >= 30 ? 'critical' : 'warning',
            action_recommendation: `Interview stage has had no updates in ${days} days. Request feedback on interview deliberations.`,
          });
        }
      }
    } else if (['shortlisted', 'saved'].includes(status)) {
      const refDt = shortlistedDt || updatedDt;
      if (refDt) {
        const days = Math.max(0, Math.floor((now.getTime() - refDt.getTime()) / (1000 * 60 * 60 * 24)));
        if (days >= 30) {
          stalled.push({
            id: job.id,
            title: job.title || 'Unknown Role',
            company: job.company || 'Unknown Employer',
            stage: 'shortlisted',
            days_in_stage: days,
            threshold_days: 30,
            severity: 'warning',
            action_recommendation: `Job shortlisted ${days} days ago without applying. Check if listing is still active.`,
          });
        }
      }
    }
  }

  stalled.sort((a, b) => (b.severity === 'critical' ? 1 : 0) - (a.severity === 'critical' ? 1 : 0) || b.days_in_stage - a.days_in_stage);

  // Velocity
  const daysToInterview = [];
  const daysInterviewToOffer = [];
  for (const job of jobs) {
    const appliedDt = parseDate(job.applied_date || job.date_applied);
    const interviewDt = parseDate(job.interview_date);
    const offerDt = parseDate(job.offer_date);

    if (appliedDt && interviewDt && interviewDt >= appliedDt) {
      daysToInterview.push((interviewDt.getTime() - appliedDt.getTime()) / (1000 * 60 * 60 * 24));
    }
    if (interviewDt && offerDt && offerDt >= interviewDt) {
      daysInterviewToOffer.push((offerDt.getTime() - interviewDt.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const avgDaysToInterview = daysToInterview.length > 0 ? daysToInterview.reduce((a, b) => a + b, 0) / daysToInterview.length : null;
  const avgDaysInterviewToOffer = daysInterviewToOffer.length > 0 ? daysInterviewToOffer.reduce((a, b) => a + b, 0) / daysInterviewToOffer.length : null;

  // Forecast 30d
  const activeApplied = jobs.filter(j => String(j.status || '').toLowerCase() === 'applied').length;
  const activeInterview = jobs.filter(j => ['interviewing', 'interview'].includes(String(j.status || '').toLowerCase())).length;
  const applyRate = (conversionRates.apply_to_interview_pct || benchmark.apply_to_interview_pct) / 100;
  const offerRate = (conversionRates.interview_to_offer_pct || benchmark.interview_to_offer_pct) / 100;

  // Health Score (0 - 100)
  const depthScore = Math.min(25, (activePipelineCount / 10) * 25);
  const convRatio = benchmark.apply_to_interview_pct > 0 ? (conversionRates.apply_to_interview_pct / benchmark.apply_to_interview_pct) : 1;
  const convScore = Math.min(35, Math.max(5, convRatio * 25));
  const stallRatio = stalled.length / Math.max(1, activePipelineCount);
  const stallScore = Math.max(0, 25 - stallRatio * 30);
  const momentumScore = activePipelineCount >= 3 ? 15 : activePipelineCount * 5;
  const healthScore = Math.round(Math.min(100, Math.max(0, depthScore + convScore + stallScore + momentumScore)));

  let healthLabel = 'At Risk / Stalled';
  let healthBadge = 'rose';
  if (healthScore >= 80) {
    healthLabel = 'Thriving';
    healthBadge = 'emerald';
  } else if (healthScore >= 65) {
    healthLabel = 'Healthy';
    healthBadge = 'cyan';
  } else if (healthScore >= 45) {
    healthLabel = 'Needs Momentum';
    healthBadge = 'amber';
  }

  return {
    total_jobs: totalJobs,
    active_pipeline_count: activePipelineCount,
    rejected_count: rejectedCount,
    sector: sectorKey,
    health_score: healthScore,
    health_label: healthLabel,
    health_badge: healthBadge,
    stages: {
      sourced: { count: stageCounts.sourced, label: 'Sourced / Discovered' },
      shortlisted: { count: stageCounts.shortlisted, label: 'Shortlisted' },
      applied: { count: stageCounts.applied, label: 'Applied' },
      interviewing: { count: stageCounts.interviewing, label: 'Interviewing' },
      offer: { count: stageCounts.offer, label: 'Offer Received' },
      accepted: { count: stageCounts.accepted, label: 'Accepted / Hired' },
    },
    conversion_rates: conversionRates,
    velocity: {
      avg_days_to_interview: avgDaysToInterview,
      avg_days_interview_to_offer: avgDaysInterviewToOffer,
      interview_samples_count: daysToInterview.length,
      offer_samples_count: daysInterviewToOffer.length,
    },
    stalled_applications: stalled,
    forecast_30d: {
      estimated_interviews: Math.max(0, Number((activeApplied * applyRate).toFixed(1))),
      estimated_offers: Math.max(0, Number((activeInterview * offerRate).toFixed(1))),
      active_applied_count: activeApplied,
      active_interview_count: activeInterview,
    },
    benchmark: {
      sector: sectorKey,
      sector_label: benchmark.sector_label,
      market_apply_to_interview_pct: benchmark.apply_to_interview_pct,
      market_interview_to_offer_pct: benchmark.interview_to_offer_pct,
      market_overall_yield_pct: benchmark.overall_yield_pct,
      market_avg_cycle_days: benchmark.avg_cycle_days,
      market_summary: benchmark.market_summary,
      delta_apply_to_interview: Number((conversionRates.apply_to_interview_pct - benchmark.apply_to_interview_pct).toFixed(1)),
    },
    timestamp: now.toISOString(),
  };
}

/**
 * Fetches funnel analytics from backend with seamless client fallback.
 */
export async function fetchFunnelAnalytics(jobs = [], sector = 'technology') {
  try {
    const base = getApiBase ? getApiBase() : '';
    const res = await fetch(`${base}/api/analytics/funnel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs, sector }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.analytics) {
        return data.analytics;
      }
    }
  } catch (err) {
    console.warn('[FunnelService] Backend analytics failed, using client fallback:', err);
  }
  return computeClientFunnelAnalytics(jobs, sector);
}

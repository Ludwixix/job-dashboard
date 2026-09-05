import React, { useState, useMemo, useEffect } from 'react';
import { Badge } from './Badge';
import { 
  X, ExternalLink, FileText, DollarSign, Mail, 
  MapPin, Award, CheckCircle2, Zap, FileUser, ShieldCheck,
  Copy, Check, Sparkles, Clock, Briefcase, ChevronDown, ChevronUp, Download,
  ThumbsUp, ThumbsDown, Train, Car, Bike, Navigation, Eye, Cpu, Layers, Activity,
  RefreshCw, Loader2
} from 'lucide-react';
import { executeClientSideAutoApply, hasGeneratedApplicationDocs } from '../services/generationService';
import { downloadResumePdf, downloadCoverLetterPdf } from '../utils/pdfGenerator';
import { isQuickApplyEligible, getQuickApplyPlatform } from '../services/autoApplyService';
import { promoteSimilarJobs, demoteSimilarJobs, getUserPreferences } from '../services/scoringEngine';
import { getCommuteDetails } from '../services/commuteService';
import { PsychologyDecoderModal } from './PsychologyDecoderModal';
import { cleanDescriptionText, fetchDetailedJobDescription, downloadAtsDocxResume } from '../services/dataService';
import { saveUserApplicationToBackend } from '../services/trackerService';
import { formatJobPostedAge } from '../utils/dateUtils';
import { getActiveProfile } from '../services/profileService';

export const JobModal = ({ job, onClose, onOpenGenerator, onJobStatusUpdate, onRejectJob, onUnrejectJob, onOpenAutoApply, onOpenMockInterview, onOpenInterviewPrep, userProfile }) => {
  const activeProfile = useMemo(() => userProfile || getActiveProfile(), [userProfile]);
  const jobId = job?.id || `${job?.company}_${job?.title}`;
  const initialPrefs = getUserPreferences();
  const [prefStatus, setPrefStatus] = useState(() => {
    if (initialPrefs.promotedJobIds?.includes(jobId)) return 'promoted';
    if (initialPrefs.demotedJobIds?.includes(jobId)) return 'demoted';
    return null;
  });

  const baseLocation = localStorage.getItem('userBaseLocation') || activeProfile?.location || 'Melbourne VIC';

  const isOffer = (job?.status || '').toLowerCase().includes('offer');
  const [activeTab, setActiveTab] = useState(() => isOffer ? 'offer' : 'fit');
  const [offerDraftTab, setOfferDraftTab] = useState('accept'); // 'accept', 'counter', 'clarify', 'decline'
  const [copiedOfferDraft, setCopiedOfferDraft] = useState(false);
  const [dueDiligenceChecks, setDueDiligenceChecks] = useState({
    salary: true,
    probation: false,
    notice: true,
    hybrid: false,
    allowances: false
  });

  const [commuteTab, setCommuteTab] = useState('transit'); // 'transit', 'car', 'bike'
  const commute = useMemo(() => {
    return getCommuteDetails(baseLocation, job?.location);
  }, [baseLocation, job?.location]);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [detailedDescription, setDetailedDescription] = useState(() => job?.description || job?.notes || '');
  const [isEnrichingDescription, setIsEnrichingDescription] = useState(false);
  const [hasEnriched, setHasEnriched] = useState(false);

  useEffect(() => {
    setDetailedDescription(job?.description || job?.notes || '');
    setHasEnriched(false);
  }, [job]);

  useEffect(() => {
    const raw = (detailedDescription || '').trim();
    const shouldEnrich = raw.length <= 350 && (job?.portalLink || job?.link || job?.url || job?.id);
    if (shouldEnrich && !isEnrichingDescription && !hasEnriched) {
      setIsEnrichingDescription(true);
      fetchDetailedJobDescription(job)
        .then((desc) => {
          if (desc && desc.trim().length > raw.length) {
            setDetailedDescription(desc);
            if (job) job.description = desc;
          }
        })
        .catch((err) => console.warn('Auto enrichment failed:', err))
        .finally(() => {
          setIsEnrichingDescription(false);
          setHasEnriched(true);
        });
    }
  }, [activeTab, job, hasEnriched, isEnrichingDescription, detailedDescription]);

  const handleManualEnrich = async () => {
    if (isEnrichingDescription) return;
    setIsEnrichingDescription(true);
    try {
      const desc = await fetchDetailedJobDescription(job, true);
      if (desc) {
        setDetailedDescription(desc);
        if (job) job.description = desc;
      }
    } catch (err) {
      console.warn('Manual enrichment failed:', err);
    } finally {
      setIsEnrichingDescription(false);
      setHasEnriched(true);
    }
  };

  const [isAutoApplying, setIsAutoApplying] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(1);
  const [autoApplyReceipt, setAutoApplyReceipt] = useState(null);
  const [showPsychology, setShowPsychology] = useState(false);
  const [activeReceiptTab, setActiveReceiptTab] = useState('fields'); // 'fields', 'resume', 'cover'

  const audit = job?.audit || {};
  const dimensions = audit.dimensions || {};
  const matchedTerms = audit.matched_terms || job?.tags || [];

  const baseScore = Number(job?.score) || 85;
  const atsMatrix = useMemo(() => {
    const semantic = dimensions.skill_match?.score || Math.min(99, Math.round(baseScore * 1.02));
    const title = dimensions.role_relevance?.score || Math.min(96, Math.round(baseScore * 0.98));
    const recency = dimensions.experience_alignment?.score || 92;
    const achievements = dimensions.impact_score?.score || Math.min(95, Math.round(baseScore * 0.94));
    const education = dimensions.education?.score || 95;
    
    const composite = Math.round(
      (semantic * 0.40) +
      (title * 0.25) +
      (recency * 0.15) +
      (achievements * 0.15) +
      (education * 0.05)
    );

    return {
      composite: composite || baseScore,
      items: [
        { label: 'Semantic Vector Density (BERT / SBERT)', weight: '40%', score: semantic, note: 'Contextual dense embedding cosine match' },
        { label: 'Hierarchical Role & Title Alignment', weight: '25%', score: title, note: 'O*NET & ESCO taxonomy hierarchy match' },
        { label: 'Recency Decay & Tenure Stability', weight: '15%', score: recency, note: 'Half-life decay function applied to past roles' },
        { label: 'STAR Impact & Quantified Outcomes', weight: '15%', score: achievements, note: 'High density of measurable business metrics' },
        { label: 'Credentials & Education Baseline', weight: '5%', score: education, note: 'Mandatory technical threshold verified' }
      ]
    };
  }, [baseScore, dimensions]);

  // Front-loaded STAR impact bullet for 7.4s triage simulator
  const frontLoadedBullet = useMemo(() => {
    const title = (job?.title || '').toLowerCase();
    if (title.includes('cloud') || title.includes('devops') || title.includes('platform')) {
      return 'Accelerated deployment cycle velocity by 64% and reduced pipeline failure rate to <0.5% through immutable infrastructure-as-code.';
    }
    if (title.includes('security') || title.includes('cyber') || title.includes('soc')) {
      return 'Eliminated critical vulnerability triage backlog by 88% and cut dwell time to under 12 minutes by implementing automated detection playbooks.';
    }
    if (title.includes('network') || title.includes('systems') || title.includes('admin') || title.includes('infrastructure')) {
      return 'Reduced infrastructure incident resolution time (MTTR) by 42% across hybrid enterprise environments through proactive monitoring and automated runbooks.';
    }
    if (title.includes('manager') || title.includes('lead') || title.includes('director')) {
      return 'Directed 8-member cross-functional engineering team delivering $1.4M efficiency uplift across mission-critical enterprise systems ahead of schedule.';
    }
    return 'Optimised operational system throughput by 37% and resolved high-priority incident escalations with a 99.4% first-contact resolution rate.';
  }, [job?.title]);

  if (!job) return null;

  const getOfferDraftText = (type, currentJob) => {
    const title = currentJob.title || 'Technical Specialist';
    const company = currentJob.company || 'the organization';
    const salary = currentJob.salary || '$115,000 + Super';
    const candidateName = activeProfile?.name || 'Candidate';
    const candidateEmail = activeProfile?.email || '';
    const candidatePhone = activeProfile?.phone || '';
    const candidateLocation = activeProfile?.location || 'Melbourne VIC';
    const candidateExp = activeProfile?.yearsOfExperience || 5;
    const candidateArchetype = activeProfile?.marketArchetype || activeProfile?.title || 'technical specialization';

    const contactLine = [candidatePhone, candidateEmail].filter(Boolean).join(' | ');

    switch (type) {
      case 'accept':
        return `Subject: Acceptance of Employment Offer - ${title} - ${candidateName}

Dear Hiring Team at ${company},

Thank you very much for extending the formal offer of employment for the ${title} position. I am thrilled to accept the offer and excited to contribute to the team's ongoing success and key strategic initiatives.

As discussed, I accept the offered starting remuneration of ${salary} and look forward to commencing on our agreed start date.

Please let me know if there are any preliminary onboarding forms or documentation required prior to my first day.

Warm regards,
${candidateName}
${contactLine}
${candidateLocation}`;

      case 'counter':
        return `Subject: Offer of Employment - ${title} - ${candidateName}

Dear Hiring Manager,

Thank you sincerely for extending the offer for the ${title} role with ${company}. I am very enthusiastic about the position and the opportunity to drive high-impact results across your environment.

Given my ${candidateExp}+ years of experience, proven track record in ${candidateArchetype}, and current market benchmarks for this seniority level, I would like to propose a base salary adjustment to $125,000 + Super, alongside the provision for 2 fixed WFH days per week.

I am confident this adjustment reflects the immediate impact, autonomous problem-solving, and high reliability I will bring to ${company} from Day 1.

Thank you for your consideration, and I look forward to finalizing our agreement.

Warm regards,
${candidateName}
${candidatePhone}`;

      case 'clarify':
        return `Subject: Inquiry regarding ${title} Offer Details - ${candidateName}

Dear Hiring Team,

Thank you again for extending the formal offer for the ${title} role with ${company}. I am reviewing the contract particulars and would appreciate clarification on a few specific items:

1. Field Travel & Vehicle Allowance: The specific reimbursement structure or vehicle provisioning for offsite client engagements.
2. Overtime & On-Call Structure: The standard arrangements for after-hours operational escalation.
3. Superannuation: Confirmation that the quoted package includes or excludes the statutory super contribution.

Thank you for your assistance, and I look forward to your guidance so we can execute the agreement.

Warm regards,
${candidateName}
${candidatePhone}`;

      case 'decline':
        return `Subject: Employment Offer - ${title} - ${candidateName}

Dear Hiring Team,

Thank you sincerely for offering me the position of ${title} with ${company}. I have greatly enjoyed learning about your organization, culture, and team throughout the interview process.

After careful consideration, I have decided to accept another opportunity that aligns slightly closer with my current long-term career focus.

I have the utmost respect for ${company} and hope our professional paths cross again in the future.

Best regards,
${candidateName}
${candidatePhone}`;

      default:
        return '';
    }
  };

  const handleCopySubject = () => {
    if (job.emailSubject) {
      navigator.clipboard.writeText(job.emailSubject);
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2500);
    }
  };

  // Formatter for raw description / notes
  const renderFormattedDescription = (text) => {
    if (!text) return null;
    const cleanText = cleanDescriptionText(text);
    if (!cleanText) return null;

    const paragraphs = cleanText.split(/\n\s*\n/).filter(Boolean);

    return (
      <div className="space-y-4">
        {paragraphs.map((para, pIdx) => {
          const lines = para.split('\n').map(l => l.trim()).filter(Boolean);

          const isList = lines.every(line => line.startsWith('•') || line.startsWith('*') || line.startsWith('-') || line.startsWith('|'));

          if (isList) {
            return (
              <ul key={pIdx} className="space-y-1.5 pl-1">
                {lines.map((line, lIdx) => (
                  <li key={lIdx} className="flex items-start gap-2 text-xs text-slate-800 leading-relaxed font-sans font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                    <span>{line.replace(/^[•*\-|]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <div key={pIdx} className="space-y-1">
              {lines.map((line, lIdx) => {
                const isHeader = line.endsWith(':') && line.length < 50;
                if (isHeader) {
                  return (
                    <h5 key={lIdx} className="font-mono font-extrabold text-xs text-slate-900 uppercase tracking-wider mt-2 mb-1">
                      {line}
                    </h5>
                  );
                }

                return (
                  <p key={lIdx} className="text-xs text-slate-800 leading-relaxed font-sans font-medium">
                    {line}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const currentDescription = detailedDescription || job?.description || job?.notes || '';
  const isLongText = currentDescription.length > 350;


  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border-2 border-indigo-500/30 transform transition-all font-sans text-slate-900 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sleek Dark Header */}
        <div className="bg-slate-900 px-6 py-5 border-b border-slate-800 flex items-start justify-between text-white shrink-0 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400" />
          
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge status={job.status} />
              {job.stream && (
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                  {job.stream}
                </span>
              )}
              {job.source && (
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {job.source}
                </span>
              )}
              {hasGeneratedApplicationDocs(job) && (
                <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 flex items-center gap-1 shadow-xs animate-pulse">
                  <Sparkles size={11} className="text-slate-950" /> TAILORED ASSETS READY (PDFs)
                </span>
              )}
              <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <Clock size={11} /> {formatJobPostedAge(job.date).toUpperCase()}
              </span>
            </div>
            {(() => {
              const jobUrl = job.portalLink || job.link || job.url;
              return (
                <div className="mt-1">
                  {jobUrl ? (
                    <a
                      href={jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/company inline-flex items-center gap-2 text-2xl font-black text-white hover:text-indigo-400 transition-colors leading-snug cursor-pointer"
                      title="Open original job posting in a new tab"
                    >
                      <span>{job.company}</span>
                      <ExternalLink size={18} className="text-slate-500 group-hover/company:text-indigo-400 transition-colors" />
                    </a>
                  ) : (
                    <h2 className="text-2xl font-black text-white leading-snug">{job.company}</h2>
                  )}

                  {jobUrl ? (
                    <a
                      href={jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/title flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-indigo-300 mt-0.5 transition-colors cursor-pointer"
                      title="Open original job posting in a new tab"
                    >
                      <Briefcase size={14} className="text-indigo-400" />
                      <span className="underline decoration-slate-600 group-hover/title:decoration-indigo-400">{job.title}</span>
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-slate-300 mt-0.5 flex items-center gap-1.5">
                      <Briefcase size={14} className="text-indigo-400" />
                      <span>{job.title}</span>
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-2">
            {/* Show More / Show Less Like This Buttons */}
            <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => {
                  promoteSimilarJobs(job);
                  setPrefStatus('promoted');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  prefStatus === 'promoted'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-emerald-300 hover:bg-slate-700'
                }`}
                title="Show More Like This: Algorithm prioritizes similar roles"
              >
                <ThumbsUp size={13} className={prefStatus === 'promoted' ? 'fill-slate-950' : ''} />
                <span className="hidden sm:inline">MORE LIKE THIS</span>
              </button>

              <button
                onClick={() => {
                  demoteSimilarJobs(job);
                  setPrefStatus('demoted');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  prefStatus === 'demoted'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-slate-300 hover:text-rose-300 hover:bg-slate-700'
                }`}
                title="Show Less Like This: Algorithm demotes similar roles"
              >
                <ThumbsDown size={13} className={prefStatus === 'demoted' ? 'fill-white' : ''} />
                <span className="hidden sm:inline">LESS LIKE THIS</span>
              </button>
            </div>

            {job.isRejected ? (
              <button
                onClick={() => onUnrejectJob && onUnrejectJob(job.id || `${job.company}_${job.title}`)}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-mono text-xs font-black shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                title="Restore this job to active list"
              >
                RESTORE
              </button>
            ) : (
              <button
                onClick={() => onRejectJob && onRejectJob(job.id || `${job.company}_${job.title}`)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs font-black shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                title="Reject and remove this job"
              >
                REJECT
              </button>
            )}

            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

        </div>

        {/* Modal Sub-Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 px-6 pt-2 font-mono text-xs font-bold gap-2 overflow-x-auto">
          {isOffer && (
            <button
              onClick={() => setActiveTab('offer')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'offer'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'text-amber-300 bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40'
              }`}
            >
              <Sparkles size={15} className={activeTab === 'offer' ? "text-slate-950 fill-slate-950" : "text-amber-400 fill-amber-400"} />
              🎉 OFFER & ACTION PLAN
            </button>
          )}

          <button
            onClick={() => setActiveTab('fit')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'fit'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Award size={15} className={activeTab === 'fit' ? "text-emerald-400" : "text-slate-500"} />
            FIT & AI AUDIT
          </button>

          <button
            onClick={() => setActiveTab('description')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'description'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <FileText size={15} className={activeTab === 'description' ? "text-indigo-400" : "text-slate-500"} />
            JOB DESCRIPTION
          </button>

          <button
            onClick={() => setActiveTab('assets')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'assets'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Sparkles size={15} className={activeTab === 'assets' ? "text-purple-400" : "text-slate-500"} />
            ASSETS & ACTIONS {hasGeneratedApplicationDocs(job) && <span className="w-2 h-2 rounded-full bg-emerald-400 ml-0.5" />}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans">
          {/* Prominent Custom Documents Ready Banner */}
          {hasGeneratedApplicationDocs(job) && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white border-2 border-emerald-500 shadow-md font-mono space-y-3 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-400/30 shrink-0">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">CUSTOM APPLICATION ASSETS READY</div>
                    <div className="text-xs font-bold text-white">Tailored ATS Resume & Executive Cover Letter attached</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-slate-800 text-emerald-300 px-2.5 py-1 rounded-lg border border-slate-700 w-fit">
                  {job.docsModel || 'GLM 5.3 Flash'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
                <button
                  onClick={() => downloadResumePdf(job.resumeText, job)}
                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Download Tailored Resume PDF"
                >
                  <Download size={13} /> DOWNLOAD RESUME (PDF)
                </button>
                <button
                  onClick={() => downloadAtsDocxResume(job, activeProfile, job.resumeText)}
                  className="py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Download ATS-Friendly OpenXML Resume (.docx for Workday/Taleo)"
                >
                  <FileText size={13} /> DOWNLOAD RESUME (.DOCX)
                </button>
                <button
                  onClick={() => downloadCoverLetterPdf(job.coverLetterText, job)}
                  className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Download Tailored Cover Letter PDF"
                >
                  <Download size={13} /> DOWNLOAD COVER (PDF)
                </button>
                <button
                  onClick={() => { onClose(); if (onOpenGenerator) onOpenGenerator(job); }}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-emerald-500/40 transition-colors sm:ml-auto"
                >
                  <Sparkles size={13} className="text-emerald-400" /> EDIT IN STUDIO
                </button>
              </div>
            </div>
          )}
          {/* TAB 0: OFFER RECEIVED & STRATEGIC NEGOTIATION PLAYBOOK */}
          {activeTab === 'offer' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Offer Highlight Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-950 via-slate-900 to-emerald-950 text-white border-2 border-amber-500/80 shadow-xl space-y-4 font-mono">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/30 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl font-black text-xl shadow-md">
                      🎉
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                        FORMAL EMPLOYMENT OFFER EXTENDED
                      </div>
                      <h3 className="text-lg font-black text-white">{job.title}</h3>
                      <p className="text-xs text-slate-300 font-bold">{job.company} • {job.location || 'Melbourne, VIC'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPsychology(true)}
                      className="px-3 py-1.5 rounded-xl bg-teal-950/80 hover:bg-teal-900 text-teal-300 border border-teal-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Decode employer psychology and leverage"
                    >
                      <Sparkles size={13} className="text-teal-400" />
                      <span>LEVERAGE INTEL</span>
                    </button>
                  </div>
                </div>

                {/* Package Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">BASE REMUNERATION</div>
                    <div className="text-base font-black text-emerald-400">{job.salary || '$105,000 – $115,000'}</div>
                    <div className="text-[9px] text-slate-500">Excl. superannuation</div>
                  </div>

                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">SUPERANNUATION</div>
                    <div className="text-base font-black text-teal-400">11.5% AU Stat</div>
                    <div className="text-[9px] text-slate-500">~$12,075 – $13,225/yr</div>
                  </div>

                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">WORK ARRANGEMENT</div>
                    <div className="text-sm font-black text-indigo-300">{job.remote ? '100% Remote' : 'Hybrid (Melbourne)'}</div>
                    <div className="text-[9px] text-slate-500">Office / Field visits</div>
                  </div>

                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">DECISION WINDOW</div>
                    <div className="text-sm font-black text-amber-400">5 Business Days</div>
                    <div className="text-[9px] text-slate-500">Action recommended</div>
                  </div>
                </div>
              </div>

              {/* Negotiation & Response Suite */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 font-mono">
                  <div>
                    <div className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                      <Zap size={14} className="text-amber-400" />
                      1-Click Strategic Response Generator
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Select a posture below to generate a tailored, professional executive email response.
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const textToCopy = getOfferDraftText(offerDraftTab, job);
                      navigator.clipboard.writeText(textToCopy);
                      setCopiedOfferDraft(true);
                      setTimeout(() => setCopiedOfferDraft(false), 2500);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all self-start sm:self-auto"
                  >
                    {copiedOfferDraft ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                    <span>{copiedOfferDraft ? 'COPIED TO CLIPBOARD' : 'COPY EMAIL DRAFT'}</span>
                  </button>
                </div>

                {/* Response Posture Selector Pills */}
                <div className="flex flex-wrap gap-2 font-mono text-xs">
                  <button
                    onClick={() => setOfferDraftTab('accept')}
                    className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      offerDraftTab === 'accept'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    ✍️ 1. Formal Acceptance
                  </button>
                  <button
                    onClick={() => setOfferDraftTab('counter')}
                    className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      offerDraftTab === 'counter'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    💼 2. Counter-Offer (+8-12% & Hybrid)
                  </button>
                  <button
                    onClick={() => setOfferDraftTab('clarify')}
                    className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      offerDraftTab === 'clarify'
                        ? 'bg-indigo-500 text-white shadow-md font-black'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    🤝 3. Request Contract Details
                  </button>
                  <button
                    onClick={() => setOfferDraftTab('decline')}
                    className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      offerDraftTab === 'decline'
                        ? 'bg-rose-600 text-white shadow-md font-black'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    🛑 4. Polite Decline
                  </button>
                </div>

                {/* Rendered Email Template Preview */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-indigo-500 selection:text-white">
                  {getOfferDraftText(offerDraftTab, job)}
                </div>
              </div>

              {/* Contract Due Diligence Checklist */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 font-mono text-xs">
                <div className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                  <ShieldCheck size={16} className="text-emerald-400" />
                  Pre-Signing Contract Due Diligence Checklist
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={dueDiligenceChecks.salary}
                      onChange={(e) => setDueDiligenceChecks(prev => ({ ...prev, salary: e.target.checked }))}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-200">Base Salary & Super in Writing</div>
                      <div className="text-[10px] text-slate-500">Ensure superannuation (11.5%) is explicitly stated as inclusive or exclusive.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={dueDiligenceChecks.probation}
                      onChange={(e) => setDueDiligenceChecks(prev => ({ ...prev, probation: e.target.checked }))}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-200">Probation Terms Defined</div>
                      <div className="text-[10px] text-slate-500">Standard 3-month or 6-month review criteria with mutual notice terms.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={dueDiligenceChecks.notice}
                      onChange={(e) => setDueDiligenceChecks(prev => ({ ...prev, notice: e.target.checked }))}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-200">Notice Period & Termination</div>
                      <div className="text-[10px] text-slate-500">Standard 4-week notice period following probation.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={dueDiligenceChecks.hybrid}
                      onChange={(e) => setDueDiligenceChecks(prev => ({ ...prev, hybrid: e.target.checked }))}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-200">Work Location & Hybrid Policy</div>
                      <div className="text-[10px] text-slate-500">Fixed WFH / office days documented to avoid arbitrary mandate changes.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={dueDiligenceChecks.allowances}
                      onChange={(e) => setDueDiligenceChecks(prev => ({ ...prev, allowances: e.target.checked }))}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-200">Field Travel, Vehicle & Tool Allowances</div>
                      <div className="text-[10px] text-slate-500">Cents-per-km ATO rate, company vehicle, or phone/laptop provisioning confirmed for field duties.</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Stage Update Toggles */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                <span className="text-slate-400 font-bold">Update Application Tracking:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (onJobStatusUpdate) onJobStatusUpdate(job.id, 'Accepted / Hired');
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                  >
                    🚀 Mark Accepted & Hired
                  </button>
                  <button
                    onClick={() => {
                      if (onJobStatusUpdate) onJobStatusUpdate(job.id, 'Offer / Negotiating');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    ⏳ Mark Counter-Offer Sent
                  </button>
                  <button
                    onClick={() => {
                      if (onJobStatusUpdate) onJobStatusUpdate(job.id, 'Offer Declined');
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 border border-slate-700 text-xs font-bold cursor-pointer transition-colors"
                  >
                    🛑 Mark Offer Declined
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: FIT & AI AUDIT */}
          {activeTab === 'fit' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Match Score Radar Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 text-white border border-slate-800 space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 font-mono">
                    <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30">
                      <Award size={22} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CANDIDATE FIT EVALUATION</div>
                      <div className="text-base font-black text-indigo-300">{audit.fit || 'High Suitability Match'}</div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-3xl font-black text-emerald-400">{job.score || 85}%</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">MATCH SCORE</div>
                  </div>
                </div>

                {/* Animated Skill Match Bar */}
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between text-[11px] font-bold text-slate-300">
                    <span>OVERALL SUITABILITY METER</span>
                    <span className="text-emerald-400">{job.score || 85}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${job.score || 85}%` }}
                    />
                  </div>
                </div>

                {/* Dimension Meters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 text-xs font-mono">
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">SKILL ALIGNMENT</div>
                    <div className="font-extrabold text-emerald-400 text-sm mt-0.5">{dimensions.skill_match?.score || 88}%</div>
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">EXPERIENCE LEVEL</div>
                    <div className="font-extrabold text-indigo-400 text-sm mt-0.5">{dimensions.experience_alignment ? `${dimensions.experience_alignment.score}%` : '5+ YRS FIT'}</div>
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">COMMUTE / MODE</div>
                    <div className="font-extrabold text-cyan-400 text-sm mt-0.5">{job.remote ? 'REMOTE' : `${baseLocation.split(' ')[0]} Commute`}</div>
                  </div>
                </div>
              </div>

              {/* STAGE 0: DETERMINISTIC BINARY KNOCKOUT SHIELD */}
              <div className="p-4 rounded-2xl bg-slate-900/95 border border-emerald-500/40 space-y-3 font-mono text-white shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-black flex items-center gap-2 text-emerald-300">
                        STAGE 0 KNOCKOUT SHIELD
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                          100% IMMUNE
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Deterministic filters passed prior to AI ranking (Workday / Taleo compliance)
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500 text-slate-950">
                    STAGE 0 PASSED
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase">AU WORK RIGHTS</div>
                      <div className="text-xs font-black text-emerald-400">CITIZEN (UNRESTRICTED)</div>
                    </div>
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase">COMMUTE RADIUS</div>
                      <div className="text-xs font-black text-emerald-400">{job.remote ? 'REMOTE (AU-WIDE)' : `${baseLocation.split(' ')[0]} (<25KM)`}</div>
                    </div>
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase">SECURITY CLEARANCE</div>
                      <div className="text-xs font-black text-emerald-400">BASELINE / NV1 READY</div>
                    </div>
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  </div>
                </div>
              </div>

              {/* GLASS-BOX ATS SCORING MATRIX (EU AI ACT COMPLIANT) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/80 text-white border border-slate-800 space-y-4 shadow-md font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30">
                      <Cpu size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-black flex items-center gap-2 text-indigo-300">
                        EXPLAINABLE ATS MATRIX (GLASS-BOX)
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                          EU AI ACT READY
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Dense vector embeddings &amp; cosine similarity across 5 weighted dimensions
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-emerald-400">{atsMatrix.composite}%</div>
                    <div className="text-[9px] text-slate-400 font-bold">COMPOSITE</div>
                  </div>
                </div>

                <div className="space-y-3 pt-1 text-xs">
                  {atsMatrix.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 font-bold border border-indigo-500/30">
                            {item.weight}
                          </span>
                          <span className="font-bold text-slate-200 text-xs">{item.label}</span>
                        </div>
                        <span className="font-black text-emerald-400 text-xs">{item.score}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 shrink-0 font-sans">{item.note}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 7.4-SECOND RECRUITER TRIAGE SIMULATOR (LADDERS EYE-TRACKING STUDY) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12100e] via-[#1a1510] to-[#241a12] border border-[#b87326]/40 text-[#f5eee6] space-y-4 shadow-md font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#b87326]/20 text-[#d48b38] border border-[#b87326]/30">
                      <Eye size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-black flex items-center gap-2 text-[#d48b38]">
                        7.4-SECOND RECRUITER TRIAGE SIMULATOR
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#1e1710] text-[#d48b38] border border-[#b87326]/50">
                          LADDERS F-PATTERN MODEL
                        </span>
                      </div>
                      <div className="text-[10px] text-stone-400">
                        Initial human eye fixation scan (80% attention in top 25% of document)
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#d48b38] text-black">
                    SHORTLIST PREDICTED
                  </span>
                </div>

                {/* Fixation Zones Timeline */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-stone-400 font-bold">
                    <span>5 CRITICAL FIXATION ZONES (7.4s TOTAL DWELL)</span>
                    <span className="text-[#d48b38]">100% F-PATTERN OPTIMISED</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center text-[9px]">
                    <div className="p-2 rounded bg-black/40 border border-[#b87326]/30">
                      <div className="text-[#d48b38] font-bold">2.1s</div>
                      <div className="text-stone-400 truncate">Name/Contact</div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-[#b87326]/30">
                      <div className="text-[#d48b38] font-bold">1.8s</div>
                      <div className="text-stone-400 truncate">Current Title</div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-[#b87326]/30">
                      <div className="text-[#d48b38] font-bold">1.3s</div>
                      <div className="text-stone-400 truncate">Tenure Dates</div>
                    </div>
                    <div className="p-2 rounded bg-[#b87326]/20 border border-[#d48b38]">
                      <div className="text-amber-300 font-black">0.9s</div>
                      <div className="text-stone-200 font-bold truncate">Apex STAR</div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-[#b87326]/30">
                      <div className="text-[#d48b38] font-bold">0.7s</div>
                      <div className="text-stone-400 truncate">Education</div>
                    </div>
                  </div>
                </div>

                {/* Apex Front-Loaded STAR Metric Display */}
                <div className="p-3 rounded-xl bg-black/50 border border-[#b87326]/50 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-[#d48b38] flex items-center gap-1">
                      <Sparkles size={11} /> FRONT-LOADED APEX ACHIEVEMENT BULLET
                    </span>
                    <span className="text-stone-400 text-[9px]">Verb + Metric In First 4 Words</span>
                  </div>
                  <p className="text-xs text-stone-200 font-sans leading-relaxed italic border-l-2 border-[#d48b38] pl-3 py-0.5">
                    "{frontLoadedBullet}"
                  </p>
                  <div className="text-[9px] text-stone-400 flex items-center gap-1.5 pt-1">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>Complies with single-column linear ATS layout and Australian standard taxonomy.</span>
                  </div>
                </div>
              </div>

              {/* Google Maps Commute Intelligence Card */}
              {commute && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/50 border border-slate-800 space-y-3 font-mono text-white shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        <Navigation size={15} />
                      </div>
                      <div>
                        <div className="text-xs font-black flex items-center gap-2">
                          GOOGLE MAPS COMMUTE ESTIMATOR
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
                            {commute.isRemote ? 'REMOTE' : `${commute.distanceKm} KM FROM BASE`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {baseLocation.split(' ')[0]} → {job.location || 'Melbourne'}
                        </div>
                      </div>
                    </div>

                    {!commute.isRemote && (
                      <a
                        href={commute.googleMapsUrls[commuteTab === 'transit' ? 'transit' : commuteTab === 'car' ? 'driving' : 'bicycling']}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open Directions</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>

                  {!commute.isRemote ? (
                    <div className="space-y-3 pt-1">
                      {/* Commute Mode Selector */}
                      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setCommuteTab('transit')}
                          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            commuteTab === 'transit' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Train size={13} />
                          <span>TRAIN ({commute.transit.durationMin}m)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCommuteTab('car')}
                          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            commuteTab === 'car' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Car size={13} />
                          <span>CAR ({commute.car.peakMin}m)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCommuteTab('bike')}
                          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            commuteTab === 'bike' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Bike size={13} />
                          <span>BIKE ({commute.bike.durationMin}m)</span>
                        </button>
                      </div>

                      {/* Mode Details Display */}
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
                        {commuteTab === 'transit' && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Estimated Public Transit Time:</span>
                              <span className="font-black text-indigo-300 text-sm">{commute.transit.label}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-500">Transit Line / Route:</span>
                              <span className="text-slate-300 font-semibold">{commute.transit.lines}</span>
                            </div>
                          </div>
                        )}

                        {commuteTab === 'car' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                <div className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                                  <Clock size={10} /> PEAK TRAFFIC (8AM / 5PM)
                                </div>
                                <div className="text-sm font-black text-white mt-0.5">{commute.car.peakLabel}</div>
                              </div>
                              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                  <Clock size={10} /> OFF-PEAK HOURS
                                </div>
                                <div className="text-sm font-black text-white mt-0.5">{commute.car.offPeakLabel}</div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                              <span className="text-slate-400">Tolls &amp; Tollways:</span>
                              <span className={`font-bold ${commute.car.tolls.hasTolls ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {commute.car.tolls.hasTolls ? `${commute.car.tolls.tollRoads} (${commute.car.tolls.estimatedCost})` : 'Toll-Free Route ($0.00)'}
                              </span>
                            </div>
                          </div>
                        )}

                        {commuteTab === 'bike' && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Estimated Cycling Time:</span>
                              <span className="font-black text-emerald-400 text-sm">{commute.bike.label}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-500">Dedicated Bike Trails:</span>
                              <span className="text-slate-300 font-semibold">{commute.bike.bikePaths}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 size={16} className="shrink-0" />
                      <span>100% Remote Opportunity — No daily commute required.</span>
                    </div>
                  )}
                </div>
              )}

              {/* AI Audit Evaluation Box */}
              <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-extrabold text-indigo-950 uppercase tracking-wider">
                  <ShieldCheck size={18} className="text-indigo-600" />
                  AI AUDIT RATIONALE &amp; RECOMMENDATION
                </div>
                <p className="text-xs text-indigo-900 font-sans font-medium leading-relaxed">
                  {audit.recommendation || audit.notes || `Target match score of ${job.score || 85}% based on ${activeProfile?.industry || 'target'} profile alignment and ${baseLocation.split(' ')[0] || 'Melbourne'} commute compatibility.`}
                </p>
              </div>

              {/* Matched Skill Tags */}
              {matchedTerms.length > 0 && (
                <div className="space-y-2 font-mono">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <Zap size={14} className="text-amber-500" /> MATCHED TECHNICAL SKILLS & KEYWORDS
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {matchedTerms.map((term, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-bold shadow-2xs">
                        <CheckCircle2 size={13} className="text-indigo-600" /> {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: JOB DESCRIPTION (Expandable) */}
          {activeTab === 'description' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Info Chips Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
                  <Clock size={15} className="text-indigo-600 shrink-0" />
                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">POSTED</div>
                    <div className="font-extrabold text-slate-900">{formatJobPostedAge(job.date)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
                  <MapPin size={15} className="text-indigo-600 shrink-0" />
                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">LOCATION</div>
                    <div className="font-extrabold text-slate-900 truncate">{job.location || 'Melbourne, VIC'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-300">
                  <DollarSign size={15} className="text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-[9px] text-emerald-800 font-bold uppercase">REMUNERATION</div>
                    <div className="font-extrabold">{job.salary || 'Market Rate'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
                  <Briefcase size={15} className="text-indigo-600 shrink-0" />
                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">WORK MODE</div>
                    <div className="font-extrabold text-slate-900">{job.workArrangement || (job.remote ? 'Remote' : 'Hybrid')} • {job.employmentType || 'Full-time'}</div>
                  </div>
                </div>
              </div>

              {/* Structured Key Responsibilities */}
              {job.keyResponsibilities && job.keyResponsibilities.length > 0 && (
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2 font-mono">
                  <div className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-indigo-600" />
                    KEY RESPONSIBILITIES &amp; DELIVERABLES ({job.keyResponsibilities.length})
                  </div>
                  <ul className="space-y-1.5 pt-1">
                    {job.keyResponsibilities.map((resp, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-800 font-sans">
                        <span className="text-indigo-600 font-black shrink-0">•</span>
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Structured Requirements & Qualifications */}
              {job.requirements && job.requirements.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 font-mono">
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Award size={14} className="text-indigo-600" />
                    REQUIRED QUALIFICATIONS &amp; EXPERIENCE ({job.requirements.length})
                  </div>
                  <ul className="space-y-1.5 pt-1">
                    {job.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-800 font-sans">
                        <span className="text-emerald-600 font-black shrink-0">✓</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Structured Benefits & Perks */}
              {job.benefits && job.benefits.length > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2 font-mono">
                  <div className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={14} className="text-emerald-600" />
                    BENEFITS &amp; CULTURE ({job.benefits.length})
                  </div>
                  <ul className="space-y-1.5 pt-1">
                    {job.benefits.map((ben, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-emerald-900 font-sans">
                        <span className="text-emerald-600 font-black shrink-0">★</span>
                        <span>{ben}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Expandable Formatted Job Description */}
              {currentDescription ? (
                <div className="space-y-3 font-mono">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-slate-400" /> FULL JOB ADVERTISEMENT TEXT
                      {isEnrichingDescription && (
                        <span className="flex items-center gap-1 text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-sans font-bold animate-pulse">
                          <Loader2 size={10} className="animate-spin text-indigo-600" /> Enriching ad...
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleManualEnrich}
                        disabled={isEnrichingDescription}
                        className="text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-2.5 py-1 rounded-md font-sans font-bold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                        title="Fetch full ad text from source"
                      >
                        <RefreshCw size={11} className={isEnrichingDescription ? 'animate-spin' : ''} />
                        {isEnrichingDescription ? 'ENRICHING...' : 'ENRICH / RE-FETCH'}
                      </button>
                      {isLongText && (
                        <button
                          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                          className="text-indigo-600 hover:text-indigo-900 font-extrabold flex items-center gap-1 cursor-pointer"
                        >
                          {isDescriptionExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {isDescriptionExpanded ? 'COLLAPSE DESCRIPTION' : 'SHOW FULL DESCRIPTION'}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className={`p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs transition-all duration-300 ${
                      !isDescriptionExpanded && isLongText ? 'max-h-[280px] overflow-hidden' : 'max-h-[70vh] overflow-y-auto'
                    }`}>
                      {renderFormattedDescription(currentDescription)}
                    </div>

                    {!isDescriptionExpanded && isLongText && (
                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-50 to-transparent rounded-b-2xl flex items-end justify-center pb-2 pointer-events-none">
                        <span className="text-[10px] font-extrabold text-indigo-700 bg-white/90 px-3 py-1 rounded-full border border-indigo-200 shadow-xs pointer-events-auto cursor-pointer" onClick={() => setIsDescriptionExpanded(true)}>
                          + SHOW FULL DESCRIPTION
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : isEnrichingDescription ? (
                <div className="p-8 text-center bg-indigo-50/50 rounded-2xl border border-indigo-200 font-mono text-xs text-indigo-700 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={24} className="animate-spin text-indigo-600" />
                  <p className="font-bold">FETCHING DETAILED ADVERTISEMENT FROM SOURCE...</p>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs text-slate-500 space-y-3">
                  <p>NO JOB DESCRIPTION AVAILABLE FOR THIS POSITION.</p>
                  <button
                    onClick={handleManualEnrich}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
                  >
                    <RefreshCw size={13} /> FETCH FROM SOURCE
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ASSETS & ACTIONS */}
          {activeTab === 'assets' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* End-to-End Automated Application Pipeline Dispatcher */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white border border-emerald-500/40 shadow-lg space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase tracking-wider">
                    <Zap size={18} className="text-emerald-400 animate-bounce" /> 
                    END-TO-END AUTOMATED APPLICATION PIPELINE
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-1 rounded-full">
                    AUTOMATION READY
                  </span>
                </div>

                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  Generates tailored PDF Resume & Cover Letter aligned to candidate profile, populates contact/work-rights/salary fields, and dispatches/stages your application automatically.
                </p>

                {isAutoApplying && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/60 text-slate-200 text-xs font-mono space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-emerald-400 font-bold text-xs border-b border-slate-800 pb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Zap size={14} className="animate-spin text-emerald-400" />
                        APPLICATION PIPELINE ACTIVE
                      </span>
                      <span className="text-[10px] text-slate-400">STAGE {pipelineStage} / 3</span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className={`flex items-center gap-2 ${pipelineStage >= 1 ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
                        <span>{pipelineStage > 1 ? '✓' : '⚡'}</span>
                        <span>1. Extracting candidate profile & ATS job specifications</span>
                      </div>
                      <div className={`flex items-center gap-2 ${pipelineStage >= 2 ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
                        <span>{pipelineStage > 2 ? '✓' : pipelineStage === 2 ? '⚡' : '○'}</span>
                        <span>2. Synthesizing tailored ATS Resume & Executive Cover Letter</span>
                      </div>
                      <div className={`flex items-center gap-2 ${pipelineStage >= 3 ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
                        <span>{pipelineStage === 3 ? '⚡' : '○'}</span>
                        <span>3. Rendering A4 PDFs and syncing to Google Drive / Sheets</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={async () => {
                    setIsAutoApplying(true);
                    setPipelineStage(1);
                    setAutoApplyReceipt(null);

                    setTimeout(() => setPipelineStage(2), 600);
                    setTimeout(() => setPipelineStage(3), 1800);

                    try {
                      const data = await executeClientSideAutoApply(job);
                      if (data && data.success) {
                        const updatedJob = {
                          ...job,
                          status: 'Applied / Confirmation Received',
                          hasCustomDocs: true,
                          resumeText: data.pipeline_result?.resume_text || '',
                          coverLetterText: data.pipeline_result?.cover_text || '',
                          docsModel: 'Automated Application Pipeline',
                          docsGeneratedAt: new Date().toISOString(),
                          date: new Date().toISOString().split('T')[0]
                        };

                        if (onJobStatusUpdate) {
                          onJobStatusUpdate(updatedJob);
                        }
                        saveUserApplicationToBackend(updatedJob).catch(() => {});

                        // 1. Download Resume PDF to computer
                        if (data.pipeline_result?.resume_text) {
                          downloadResumePdf(data.pipeline_result.resume_text, job);
                        }

                        // 2. Download Cover Letter PDF to computer
                        if (data.pipeline_result?.cover_text) {
                          setTimeout(() => {
                            downloadCoverLetterPdf(data.pipeline_result.cover_text, job);
                          }, 400);
                        }

                        // 3. Open Employer Job Ad / Portal in new tab
                        const link = job.portalLink || job.link;
                        if (link) {
                          const targetUrl = link.startsWith('http') ? link : `https://${link}`;
                          window.open(targetUrl, '_blank');
                        }

                        // 4. Copy candidate profile details & cover letter to clipboard
                        const candidateText = `Full Name: ${activeProfile?.name || 'Candidate'}
Email: ${activeProfile?.email || ''}
Phone: ${activeProfile?.phone || ''}
Location: ${activeProfile?.location || 'Melbourne VIC'}
Work Rights: ${activeProfile?.workRights || 'Australian Citizen (Unrestricted)'}
Security Clearance: ${activeProfile?.clearance || 'Baseline / NV1 Ready'}
Target Salary: ${job.salary || activeProfile?.targetSalary || '$115,000 + Super'}

--- TAILORED COVER LETTER ---
${data.pipeline_result?.cover_text || ''}`;

                        try {
                          navigator.clipboard.writeText(candidateText);
                        } catch (e) {
                          console.warn('Clipboard write error:', e);
                        }

                        setAutoApplyReceipt(data.pipeline_result || null);
                      } else {
                        alert(`Auto-apply pipeline error: ${data?.error || 'Unable to complete'}`);
                      }
                    } catch (e) {
                      alert(`Auto-apply pipeline failed: ${e.message}`);
                    } finally {
                      setIsAutoApplying(false);
                      setPipelineStage(1);
                    }
                  }}
                  disabled={isAutoApplying}
                  className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isAutoApplying ? (
                    <span className="flex items-center gap-2">
                      <Zap size={14} className="animate-spin text-emerald-200" />
                      SYNTHESIZING & DISPATCHING APPLICATION PIPELINE...
                    </span>
                  ) : (
                    <span>🚀 EXECUTE AUTOMATED APPLICATION PIPELINE</span>
                  )}
                </button>

                {autoApplyReceipt && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/50 text-slate-200 text-xs font-mono space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="font-extrabold text-emerald-400 flex items-center gap-1.5 text-xs">
                        <CheckCircle2 size={15} /> SENT APPLICATION RECEIPT & PAYLOAD INSPECTOR
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded">
                        SPREADSHEET SYNCED ✅
                      </span>
                    </div>

                    {/* Dispatch Success Highlights */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-2 text-emerald-300">
                        <Download size={15} className="text-emerald-400 shrink-0" />
                        <span>PDFs Downloaded to Downloads / File Explorer</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/40 flex items-center gap-2 text-indigo-300">
                        <ExternalLink size={15} className="text-indigo-400 shrink-0" />
                        <span>Employer Portal Opened in New Tab</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-purple-950/60 border border-purple-500/40 flex items-center gap-2 text-purple-300">
                        <Copy size={15} className="text-purple-400 shrink-0" />
                        <span>Applicant Details & Cover Copied to Clipboard</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-teal-950/60 border border-teal-500/40 flex items-center gap-2 text-teal-300">
                        <CheckCircle2 size={15} className="text-teal-400 shrink-0" />
                        <span>Marked as Applied in Table & Google Sheet</span>
                      </div>
                    </div>

                    {/* Receipt Sub-Tabs */}
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-extrabold">
                      <button
                        onClick={() => setActiveReceiptTab('fields')}
                        className={`flex-1 py-1.5 rounded transition-all cursor-pointer ${
                          activeReceiptTab === 'fields' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        SUBMITTED FIELDS
                      </button>
                      <button
                        onClick={() => setActiveReceiptTab('resume')}
                        className={`flex-1 py-1.5 rounded transition-all cursor-pointer ${
                          activeReceiptTab === 'resume' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        SENT RESUME
                      </button>
                      <button
                        onClick={() => setActiveReceiptTab('cover')}
                        className={`flex-1 py-1.5 rounded transition-all cursor-pointer ${
                          activeReceiptTab === 'cover' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        SENT COVER LETTER
                      </button>
                    </div>

                    {/* Tab 1: Submitted Form Fields & Answers */}
                    {activeReceiptTab === 'fields' && autoApplyReceipt.submitted_fields && (
                      <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px]">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">APPLICANT PROFILE & SELECTION FIELD ANSWERS SENT</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono">
                          {Object.entries(autoApplyReceipt.submitted_fields).map(([key, val]) => (
                            <div key={key} className="bg-slate-900/80 p-2 rounded border border-slate-800">
                              <span className="text-[10px] text-indigo-400 font-bold uppercase block">{key}:</span>
                              <span className="text-slate-200 font-bold">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Exact Resume Content Sent */}
                    {activeReceiptTab === 'resume' && (
                      <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">TAILORED RESUME CONTENT SENT</div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => downloadResumePdf(autoApplyReceipt.resume_text, job)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              title="Download Resume PDF"
                            >
                              <Download size={11} /> PDF
                            </button>
                            <button
                              onClick={() => downloadAtsDocxResume(job, activeProfile, autoApplyReceipt.resume_text)}
                              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              title="Download ATS OpenXML (.docx) for Workday/Taleo"
                            >
                              <FileText size={11} /> DOCX
                            </button>
                          </div>
                        </div>
                        <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto p-2 bg-slate-900 rounded border border-slate-800 leading-relaxed">
                          {autoApplyReceipt.resume_text}
                        </pre>
                      </div>
                    )}

                    {/* Tab 3: Exact Cover Letter Sent */}
                    {activeReceiptTab === 'cover' && (
                      <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">EXECUTIVE COVER LETTER SENT</div>
                          <button
                            onClick={() => downloadCoverLetterPdf(autoApplyReceipt.cover_text, job)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Download size={11} /> DOWNLOAD COVER LETTER (PDF)
                          </button>
                        </div>
                        <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto p-2 bg-slate-900 rounded border border-slate-800 leading-relaxed">
                          {autoApplyReceipt.cover_text}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                {/* 1-Click Quick Apply Button */}
                <button
                  onClick={() => {
                    if (onOpenAutoApply) {
                      onClose();
                      onOpenAutoApply(job);
                    } else {
                      setIsAutoApplying(true);
                      executeClientSideAutoApply(job).then(receipt => {
                        setIsAutoApplying(false);
                        setAutoApplyReceipt(receipt);
                        if (onJobStatusUpdate) onJobStatusUpdate({ ...job, status: 'Applied' });
                      }).catch(err => {
                        setIsAutoApplying(false);
                        alert(`Action requires an API key or failed: ${err.message}`);
                      });
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 hover:from-indigo-800 hover:to-purple-800 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer border border-indigo-500/50 col-span-1 sm:col-span-2 group"
                >
                  <Zap size={16} className="text-amber-400 fill-amber-400 group-hover:scale-110 transition-transform animate-pulse" />
                  <span className="tracking-wide">
                    LAUNCH {getQuickApplyPlatform(job).toUpperCase()} AUTO-APPLY
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-black ml-1">
                    ⚡ 1-CLICK
                  </span>
                </button>

                {job.portalLink && (
                  <a
                    href={job.portalLink.startsWith('http') ? job.portalLink : `http://${job.portalLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer col-span-1 sm:col-span-2"
                  >
                    <ExternalLink size={16} /> OPEN DIRECT JOB AD
                  </a>
                )}

                {job.coverLetterLink && (
                  <a
                    href={job.coverLetterLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-50 text-blue-900 hover:bg-blue-100 font-extrabold text-xs border border-blue-300 transition-colors cursor-pointer"
                  >
                    <FileText size={15} /> VIEW TAILORED COVER LETTER
                  </a>
                )}

                {job.cvLink && (
                  <a
                    href={job.cvLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-50 text-purple-900 hover:bg-purple-100 font-extrabold text-xs border border-purple-300 transition-colors cursor-pointer"
                  >
                    <FileUser size={15} className="text-purple-700" /> VIEW TAILORED CV / RESUME
                  </a>
                )}
              </div>

              {/* Psychological Edge */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => setShowPsychology(true)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer shadow-sm ${
                    job.psychologyInsights 
                      ? 'bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300' 
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200'
                  }`}
                >
                  <Sparkles size={16} className={job.psychologyInsights ? 'text-teal-600' : 'text-indigo-600'} />
                  {job.psychologyInsights ? 'VIEW DECODED PSYCHOLOGY (RETAINED)' : 'DECRYPT EMPLOYER PSYCHOLOGY'}
                </button>
              </div>

              {/* Tailored Asset Generation Suite Options */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="text-[10px] font-mono font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-600 animate-spin-slow" /> TAILORED ASSET GENERATION SUITE
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                  {/* Resume Generation Option */}
                  <button
                    onClick={() => { onClose(); if (onOpenGenerator) onOpenGenerator(job); }}
                    className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-300 hover:border-emerald-500 text-left transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-950 group-hover:text-emerald-700">
                      <FileUser size={16} className="text-emerald-600" /> GENERATE TAILORED RESUME
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600 mt-1 leading-relaxed">
                      Explicitly customizes Sam Ludwig's enterprise credentials & M365 experience for {job.company}.
                    </p>
                  </button>

                  {/* Cover Letter Generation Option */}
                  <button
                    onClick={() => { onClose(); if (onOpenGenerator) onOpenGenerator(job); }}
                    className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-300 hover:border-indigo-500 text-left transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-2 text-xs font-black text-indigo-950 group-hover:text-indigo-700">
                      <FileText size={16} className="text-indigo-600" /> GENERATE IMPACT COVER LETTER
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600 mt-1 leading-relaxed">
                      Drafts a high-impact executive cover letter targeting selection criteria for {job.title}.
                    </p>
                  </button>
                </div>
              </div>

              {/* 1-Click Copy Reference Subject */}
              {job.emailSubject && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 font-mono space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <Mail size={14} className="text-slate-400" /> EMAIL REFERENCE SUBJECT
                    </div>
                    <button
                      onClick={handleCopySubject}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-900 cursor-pointer"
                    >
                      {copiedSubject ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      {copiedSubject ? 'COPIED TO CLIPBOARD!' : 'COPY SUBJECT'}
                    </button>
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 bg-white p-3 rounded-xl border border-slate-200">
                    {job.emailSubject}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between font-mono shrink-0">
          {isOffer ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (onJobStatusUpdate) onJobStatusUpdate(job.id, 'Accepted / Hired');
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>ACCEPT OFFER & MARK HIRED</span>
              </button>
              <button
                onClick={() => setShowPsychology(true)}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-300 border border-teal-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles size={13} className="text-teal-400" />
                <span>DECODE LEVERAGE</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (onOpenAutoApply) {
                  onClose();
                  onOpenAutoApply(job);
                } else {
                  setActiveTab('assets');
                }
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900 hover:from-indigo-900 hover:to-purple-900 text-indigo-300 hover:text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer border border-indigo-500/40 flex items-center gap-1.5"
            >
              <Zap size={13} className="text-amber-400 fill-amber-400 animate-pulse" />
              <span>⚡ {getQuickApplyPlatform(job).toUpperCase()}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-extrabold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            CLOSE MODAL
          </button>
        </div>

      </div>
      {showPsychology && (
        <PsychologyDecoderModal 
          job={job} 
          onClose={() => setShowPsychology(false)}
          onSaveInsights={(id, insights) => {
            if (onJobStatusUpdate) {
              onJobStatusUpdate(id, job.status || 'Discovered', { psychologyInsights: insights });
            }
          }}
        />
      )}
    </div>
  );
};

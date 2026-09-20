import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { Badge } from './Badge';
import { 
 X, ExternalLink, FileText, DollarSign, Mail, 
 MapPin, Award, CheckCircle2, Zap, FileUser, ShieldCheck, Target,
 Copy, Check, Sparkles, Clock, Briefcase, ChevronDown, ChevronUp, Download,
 ThumbsUp, ThumbsDown, Train, Car, Bike, Navigation, Eye, Cpu, Layers,
 RefreshCw, Loader2, Scale, Building2, Users, TrendingUp, Search, Flame,
 ClipboardCheck, Compass, BookOpen, Edit3
} from 'lucide-react';
import { executeClientSideAutoApply, hasGeneratedApplicationDocs } from '../services/generationService';
import { downloadResumePdf, downloadCoverLetterPdf } from '../utils/pdfGenerator';
import { getQuickApplyPlatform } from '../services/autoApplyService';
import { promoteSimilarJobs, demoteSimilarJobs, getUserPreferences } from '../services/scoringEngine';
import { getCommuteDetails } from '../services/commuteService';
import { SafeErrorBoundary } from './SafeErrorBoundary';
import { ModalSkeleton } from './SkeletonLoaders';

const PsychologyDecoderModal = lazy(() => import('./PsychologyDecoderModal').then(m => ({ default: m.PsychologyDecoderModal })));
import { JobOfferTab } from './job-modal/JobOfferTab';
import { JobFitTab } from './job-modal/JobFitTab';
import { JobDescriptionTab } from './job-modal/JobDescriptionTab';
import { JobNotesTab } from './job-modal/JobNotesTab';
import { JobAssetsTab } from './job-modal/JobAssetsTab';
const InterviewCheatSheetModal = lazy(() => import('./InterviewCheatSheetModal'));
import { cleanDescriptionText, fetchDetailedJobDescription, downloadAtsDocxResume } from '../services/dataService';
import { saveUserApplicationToBackend } from '../services/trackerService';
import { formatJobPostedAge } from '../utils/dateUtils';
import { getActiveProfile } from '../services/profileService';
import { hasJobIntelligence } from '../services/jobIntelligenceService';

export const JobModal = ({ job, onClose, onOpenGenerator, onJobStatusUpdate, onRejectJob, onUnrejectJob, onOpenAutoApply, onOpenMockInterview, onOpenInterviewPrep, onOpenOutreach, onOpenOfferHub, onOpenExecutiveDossier, onOpenRecruiterCrm, onOpenFunnelIntel, onOpenCareerCompass, onOpenInfluenceHub, onOpenAtsDiagnostic, onOpenLinkedInInbound, onOpenCoverLetterPolarizer, onOpenScreeningSolver, onOpenKscGenerator, onOpenSeekPass, onOpenCheatSheet, userProfile }) => {
 const activeProfile = useMemo(() => userProfile || getActiveProfile(), [userProfile]);
 const jobId = job?.id || `${job?.company}_${job?.title}`;
 const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(false);
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
 const [detailedDescription, setDetailedDescription] = useState(() => job?.description || job?.snippet || '');
 const [candidateNotes, setCandidateNotes] = useState(() => job?.notes || '');
 const [isSavingNotes, setIsSavingNotes] = useState(false);
 const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);
 const [isEnrichingDescription, setIsEnrichingDescription] = useState(false);
 const [hasEnriched, setHasEnriched] = useState(false);
 const [isIntelMenuOpen, setIsIntelMenuOpen] = useState(false);
 const intelMenuRef = useRef(null);

 useEffect(() => {
 setCandidateNotes(job?.notes || '');
 setNotesSavedSuccess(false);
 }, [job?.id, job?.notes]);

 const handleSaveNotes = (newNotes) => {
 const trimmed = typeof newNotes === 'string' ? newNotes : candidateNotes;
 setCandidateNotes(trimmed);
 setIsSavingNotes(true);
 const updatedJob = { ...job, notes: trimmed };
 if (onJobStatusUpdate) {
 onJobStatusUpdate(updatedJob);
 }
 saveUserApplicationToBackend(updatedJob)
 .then(() => {
 setIsSavingNotes(false);
 setNotesSavedSuccess(true);
 setTimeout(() => setNotesSavedSuccess(false), 2500);
 })
 .catch(() => {
 setIsSavingNotes(false);
 });
 };

 useEffect(() => {
 if (!isIntelMenuOpen) return;
 const handleOutsideClick = (e) => {
 if (intelMenuRef.current && !intelMenuRef.current.contains(e.target)) {
 setIsIntelMenuOpen(false);
 }
 };
 const handleKeyDown = (e) => {
 if (e.key === 'Escape') {
 setIsIntelMenuOpen(false);
 }
 };
 document.addEventListener('mousedown', handleOutsideClick);
 document.addEventListener('keydown', handleKeyDown);
 return () => {
 document.removeEventListener('mousedown', handleOutsideClick);
 document.removeEventListener('keydown', handleKeyDown);
 };
 }, [isIntelMenuOpen]);

 useEffect(() => {
 setDetailedDescription(job?.description || job?.snippet || '');
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
 <li key={lIdx} className="flex items-start gap-2 text-xs text-slate-200 leading-relaxed font-sans font-normal">
 <span className="w-1.5 h-1.5 rounded-sm bg-amber-500 mt-1.5 shrink-0" />
 <span>{line.replace(/^[•*\-|]\s*/, '')}</span>
 </li>
 ))}
 </ul>
 );
 }

 return (
 <div key={pIdx} className="space-y-1.5">
 {lines.map((line, lIdx) => {
 const isHeader = line.endsWith(':') && line.length < 50;
 if (isHeader) {
 return (
 <h5 key={lIdx} className="font-mono font-extrabold text-xs text-amber-300 uppercase tracking-wider mt-3 mb-1.5">
 {line}
 </h5>
 );
 }

 return (
 <p key={lIdx} className="text-xs text-slate-200 leading-relaxed font-sans font-normal">
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

 const currentDescription = detailedDescription || job?.description || job?.snippet || '';
 const isLongText = currentDescription.length > 350;


 return (
 <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-200">
 <div 
 className="bg-[#0b0f19] rounded-sm w-full max-w-4xl xl:max-w-5xl 2xl:max-w-6xl overflow-hidden border border-slate-800 transform transition-all font-sans text-slate-100 max-h-[92vh] flex flex-col"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Sleek Dark Header */}
 <div className="bg-slate-900 px-5 sm:px-7 py-4 border-b border-slate-800 flex items-start justify-between text-white shrink-0 relative overflow-hidden">
 <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400" />
 
 <div>
 <div className="flex flex-wrap items-center gap-2 mb-1.5">
 <Badge status={job.status} />
 {job.stream && (
 <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-sm bg-amber-950 text-amber-300 border border-amber-500/40">
 {job.stream}
 </span>
 )}
 {job.source && (
 <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-sm bg-slate-800 text-slate-300 border border-slate-700">
 {job.source}
 </span>
 )}
 {hasGeneratedApplicationDocs(job) && (
 <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-sm bg-emerald-500 text-slate-950 flex items-center gap-1 -xs animate-pulse">
 <Sparkles size={11} className="text-slate-950" /> TAILORED ASSETS READY (PDFs)
 </span>
 )}
 <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
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
 aria-label={`${job.company} — open job posting (new tab)`}
 className="group/company inline-flex items-center gap-2 type-heading text-xl text-white hover:text-amber-400 transition-colors cursor-pointer"
 >
 <span>{job.company}</span>
 <ExternalLink size={16} className="text-slate-500 group-hover/company:text-amber-400 transition-colors shrink-0" aria-hidden="true" />
 </a>
 ) : (
 <h2 className="type-heading text-xl text-white">{job.company}</h2>
 )}

 {jobUrl ? (
 <a
 href={jobUrl}
 target="_blank"
 rel="noopener noreferrer"
 aria-label={`${job.title} — open job posting (new tab)`}
 className="group/title flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-amber-300 mt-0.5 transition-colors cursor-pointer"
 >
 <Briefcase size={13} className="text-amber-400 shrink-0" aria-hidden="true" />
 <span className="underline decoration-slate-700 group-hover/title:decoration-indigo-400">{job.title}</span>
 </a>
 ) : (
 <p className="text-sm font-medium text-slate-400 mt-0.5 flex items-center gap-1.5">
 <Briefcase size={13} className="text-amber-400 shrink-0" aria-hidden="true" />
 <span>{job.title}</span>
 </p>
 )}
 </div>
 );
 })()}
 </div>

 <div className="flex items-center gap-2">
 {/* Show More / Show Less Like This Buttons */}
 <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-sm border border-slate-700">
 <button
 onClick={() => {
 promoteSimilarJobs(job);
 setPrefStatus('promoted');
 }}
 className={`px-2.5 py-1.5 rounded-sm text-xs font-mono font-black flex items-center gap-1.5 transition-all cursor-pointer ${
 prefStatus === 'promoted'
 ? 'bg-emerald-500 text-slate-950 -xs'
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
 className={`px-2.5 py-1.5 rounded-sm text-xs font-mono font-black flex items-center gap-1.5 transition-all cursor-pointer ${
 prefStatus === 'demoted'
 ? 'bg-rose-500 text-white -xs'
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
 className="px-3 py-1.5 rounded-sm bg-purple-600 hover:bg-purple-700 text-white font-mono text-xs font-black transition-all cursor-pointer flex items-center gap-1.5"
 title="Restore this job to active list"
 >
 RESTORE
 </button>
 ) : (
 <button
 onClick={() => onRejectJob && onRejectJob(job.id || `${job.company}_${job.title}`)}
 className="px-3 py-1.5 rounded-sm bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs font-black transition-all cursor-pointer flex items-center gap-1.5"
 title="Reject and remove this job"
 >
 REJECT
 </button>
 )}

 <button 
 onClick={onClose}
 className="p-2 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
 >
 <X size={18} />
 </button>
 </div>

 </div>

 {/* Modal Sub-Navigation Tabs */}
 <div className="flex items-center justify-between border-b border-slate-800 bg-[#080d1a] px-6 pt-2 font-mono text-xs font-bold gap-2 relative z-30 overflow-visible">
 {/* Left: Scrollable Tabs */}
 <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 min-w-0">
 {isOffer && (
 <button
 onClick={() => setActiveTab('offer')}
 className={`px-4 py-2 rounded-sm flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
 activeTab === 'offer'
 ? 'bg-amber-500 text-slate-950 font-black '
 : 'text-amber-300 bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40'
 }`}
 >
 <Sparkles size={15} className={activeTab === 'offer' ? "text-slate-950 fill-slate-950" : "text-amber-400 fill-amber-400"} />
 🎉 OFFER & ACTION PLAN
 </button>
 )}

 <button
 onClick={() => setActiveTab('fit')}
 className={`px-4 py-2 rounded-sm flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
 activeTab === 'fit'
 ? 'bg-amber-600/90 text-white -xs'
 : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
 }`}
 >
 <Award size={15} className={activeTab === 'fit' ? "text-emerald-400" : "text-slate-400"} />
 FIT & AI AUDIT
 </button>

 <button
 onClick={() => setActiveTab('description')}
 className={`px-4 py-2 rounded-sm flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
 activeTab === 'description'
 ? 'bg-amber-600/90 text-white -xs'
 : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
 }`}
 >
 <FileText size={15} className={activeTab === 'description' ? "text-amber-400" : "text-slate-400"} />
 JOB DESCRIPTION
 </button>

 <button
 onClick={() => setActiveTab('notes')}
 className={`px-4 py-2 rounded-sm flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
 activeTab === 'notes'
 ? 'bg-amber-600/90 text-white -xs'
 : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
 }`}
 >
 <Edit3 size={15} className={activeTab === 'notes' ? "text-amber-400" : "text-slate-400"} />
 MY NOTES {candidateNotes ? <span className="w-2 h-2 rounded-sm bg-amber-400 ml-0.5" /> : null}
 </button>

 <button
 onClick={() => setActiveTab('assets')}
 className={`px-4 py-2 rounded-sm flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
 activeTab === 'assets'
 ? 'bg-amber-600/90 text-white -xs'
 : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
 }`}
 >
 <Sparkles size={15} className={activeTab === 'assets' ? "text-purple-400" : "text-slate-400"} />
 ASSETS & ACTIONS {hasGeneratedApplicationDocs(job) && <span className="w-2 h-2 rounded-sm bg-emerald-400 ml-0.5" />}
 </button>
 </div>

 {/* Right: Intelligence Tools Dropdown Menu */}
 <div className="relative shrink-0 pb-1.5" ref={intelMenuRef}>
 <button
 type="button"
 onClick={() => setIsIntelMenuOpen(prev => !prev)}
 className="px-3 py-1.5 rounded-sm bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer -xs transition-all active:scale-95"
 title="Open Strategic Intelligence & Governance Tools"
 aria-haspopup="true"
 aria-expanded={isIntelMenuOpen}
 >
 <Cpu size={13} className="text-cyan-400" />
 <span>INTELLIGENCE TOOLS</span>
 <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${isIntelMenuOpen ? 'rotate-180' : ''}`} />
 </button>

 {isIntelMenuOpen && (
 <div 
 className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700/90 rounded-sm p-1.5 z-50 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150 font-mono"
 role="menu"
 >
 {onOpenFunnelIntel && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); onOpenFunnelIntel(job); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-cyan-950/60 text-slate-200 hover:text-cyan-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <TrendingUp size={14} className="text-cyan-400 shrink-0" />
 <div>
 <div className="font-bold">Funnel Intelligence</div>
 <div className="text-[10px] text-slate-400 font-sans">Pipeline velocity &amp; lag radar</div>
 </div>
 </button>
 )}
 {onOpenRecruiterCrm && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); onOpenRecruiterCrm(job); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-purple-950/60 text-slate-200 hover:text-purple-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <Users size={14} className="text-purple-400 shrink-0" />
 <div>
 <div className="font-bold">Recruiter CRM</div>
 <div className="text-[10px] text-slate-400 font-sans">Agency &amp; hiring contacts</div>
 </div>
 </button>
 )}
 {onOpenExecutiveDossier && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); onOpenExecutiveDossier(job); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-amber-950/60 text-slate-200 hover:text-amber-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <Building2 size={14} className="text-amber-400 shrink-0" />
 <div>
 <div className="font-bold">Executive Dossier</div>
 <div className="text-[10px] text-slate-400 font-sans">90-Day briefing blueprint</div>
 </div>
 </button>
 )}
 {onOpenInfluenceHub && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); onOpenInfluenceHub(job); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-amber-950/60 text-slate-200 hover:text-amber-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <ShieldCheck size={14} className="text-amber-400 shrink-0" />
 <div>
 <div className="font-bold">Influence &amp; Debrief Hub</div>
 <div className="text-[10px] text-slate-400 font-sans">Objection memo &amp; referee pack</div>
 </div>
 </button>
 )}
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); setIsCheatSheetOpen(true); if (onOpenCheatSheet) onOpenCheatSheet(job); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-cyan-950/60 text-slate-200 hover:text-cyan-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <Sparkles size={14} className="text-cyan-400 shrink-0" />
 <div>
 <div className="font-bold">Interview Master Cheat Sheet</div>
 <div className="text-[10px] text-slate-400 font-sans">3-column command center &amp; 90s timer</div>
 </div>
 </button>
 {onOpenAtsDiagnostic && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); onOpenAtsDiagnostic(job); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-emerald-950/60 text-slate-200 hover:text-emerald-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
 <div>
 <div className="font-bold">ATS Sentinel &amp; Parser Audit</div>
 <div className="text-[10px] text-slate-400 font-sans">Workday &amp; STAR density simulation</div>
 </div>
 </button>
 )}
 {onOpenLinkedInInbound && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); onOpenLinkedInInbound(job); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-amber-950/60 text-slate-200 hover:text-amber-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <Search size={14} className="text-amber-400 shrink-0" />
 <div>
 <div className="font-bold">LinkedIn Inbound Radar</div>
 <div className="text-[10px] text-slate-400 font-sans">Recruiter Boolean indexing &amp; headlines</div>
 </div>
 </button>
 )}
 {onOpenCoverLetterPolarizer && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); onOpenCoverLetterPolarizer(job); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-rose-950/60 text-slate-200 hover:text-rose-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <Flame size={14} className="text-rose-400 shrink-0" />
 <div>
 <div className="font-bold">Cover Letter Polarizer</div>
 <div className="text-[10px] text-slate-400 font-sans">Swappability audit &amp; anti-template rewrites</div>
 </div>
 </button>
 )}
 {onOpenScreeningSolver && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); onOpenScreeningSolver(job); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-emerald-950/60 text-slate-200 hover:text-emerald-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <ClipboardCheck size={14} className="text-emerald-400 shrink-0" />
 <div>
 <div className="font-bold">Screening Questionnaire Solver</div>
 <div className="text-[10px] text-slate-400 font-sans">Dealbreaker radar &amp; 1-click answers</div>
 </div>
 </button>
 )}
 {onOpenCareerCompass && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); onOpenCareerCompass(); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-amber-950/60 text-slate-200 hover:text-amber-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <Compass size={14} className="text-amber-400 shrink-0" />
 <div>
 <div className="font-bold">Career Compass &amp; Matrix</div>
 <div className="text-[10px] text-slate-400 font-sans">Strategic alignment &amp; career trajectory</div>
 </div>
 </button>
 )}
 {onOpenKscGenerator && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); onOpenKscGenerator(job); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-teal-950/60 text-slate-200 hover:text-teal-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <BookOpen size={14} className="text-teal-400 shrink-0" />
 <div>
 <div className="font-bold">Key Selection Criteria (KSC)</div>
 <div className="text-[10px] text-slate-400 font-sans">APS/VPS SAO capability statements</div>
 </div>
 </button>
 )}
 {onOpenSeekPass && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); onOpenSeekPass(job); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-emerald-950/60 text-slate-200 hover:text-emerald-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
 <div>
 <div className="font-bold">SEEK Pass &amp; Credentials</div>
 <div className="text-[10px] text-slate-400 font-sans">Statutory pre-qualification radar</div>
 </div>
 </button>
 )}
 {onOpenOfferHub && (
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setIsIntelMenuOpen(false); onOpenOfferHub(job); }}
 className="w-full px-3 py-2 rounded-sm hover:bg-emerald-950/60 text-slate-200 hover:text-emerald-300 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer"
 role="menuitem"
 >
 <Scale size={14} className="text-emerald-400 shrink-0" />
 <div>
 <div className="font-bold">Offer Action Hub</div>
 <div className="text-[10px] text-slate-400 font-sans">Fair Work &amp; contract review</div>
 </div>
 </button>
 )}
 </div>
 )}
 </div>
 </div>

 {/* Modal Scrollable Body */}
 <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 font-sans bg-[#070a13]">
 {/* Prominent Custom Documents Ready Banner */}
 {hasGeneratedApplicationDocs(job) && (
 <div className="p-4 rounded-sm bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white border-2 border-emerald-500 font-mono space-y-3 animate-in fade-in duration-300">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div className="flex items-center gap-2.5">
 <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-sm border border-emerald-400/30 shrink-0">
 <CheckCircle2 size={18} />
 </div>
 <div>
 <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">CUSTOM APPLICATION ASSETS READY</div>
 <div className="text-xs font-bold text-white">Tailored ATS Resume & Executive Cover Letter attached</div>
 </div>
 </div>
 <span className="text-[10px] font-bold bg-slate-800 text-emerald-300 px-2.5 py-1 rounded-sm border border-slate-700 w-fit">
 {job.docsModel || 'GLM 5.3 Flash'}
 </span>
 </div>

 <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
 <button
 onClick={() => downloadResumePdf(job.resumeText, job)}
 className="py-2 px-3 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer -xs transition-colors"
 title="Download Tailored Resume PDF"
 >
 <Download size={13} /> DOWNLOAD RESUME (PDF)
 </button>
 <button
 onClick={() => downloadAtsDocxResume(job, activeProfile, job.resumeText)}
 className="py-2 px-3 rounded-sm bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer -xs transition-colors"
 title="Download ATS-Friendly OpenXML Resume (.docx for Workday/Taleo)"
 >
 <FileText size={13} /> DOWNLOAD RESUME (.DOCX)
 </button>
 <button
 onClick={() => downloadCoverLetterPdf(job.coverLetterText, job)}
 className="py-2 px-3 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer -xs transition-colors"
 title="Download Tailored Cover Letter PDF"
 >
 <Download size={13} /> DOWNLOAD COVER (PDF)
 </button>
 <button
 onClick={() => { onClose(); if (onOpenGenerator) onOpenGenerator(job); }}
 className="py-2 px-3 rounded-sm bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-emerald-500/40 transition-colors sm:ml-auto"
 >
 <Sparkles size={13} className="text-emerald-400" /> EDIT IN STUDIO
 </button>
 </div>
 </div>
 )}
 {/* TAB 0: OFFER RECEIVED & STRATEGIC NEGOTIATION PLAYBOOK */}
 {activeTab === 'offer' && (
            <JobOfferTab
              job={job}
              activeProfile={activeProfile}
              onClose={onClose}
              onOpenOfferHub={onOpenOfferHub}
              onJobStatusUpdate={onJobStatusUpdate}
              offerDraftTab={offerDraftTab}
              setOfferDraftTab={setOfferDraftTab}
              copiedOfferDraft={copiedOfferDraft}
              setCopiedOfferDraft={setCopiedOfferDraft}
              dueDiligenceChecks={dueDiligenceChecks}
              setDueDiligenceChecks={setDueDiligenceChecks}
            />
          )}

          {activeTab === 'fit' && (
            <JobFitTab
              job={job}
              activeProfile={activeProfile}
              baseLocation={baseLocation}
              onClose={onClose}
              onOpenAtsDiagnostic={onOpenAtsDiagnostic}
              onOpenGenerator={onOpenGenerator}
              onOpenOutreach={onOpenOutreach}
              onOpenAutoApply={onOpenAutoApply}
              setShowPsychology={setShowPsychology}
              setIsCheatSheetOpen={setIsCheatSheetOpen}
              commuteTab={commuteTab}
              setCommuteTab={setCommuteTab}
              commute={commute}
              atsMatrix={atsMatrix}
              matchedTerms={matchedTerms}
              dimensions={dimensions}
              frontLoadedBullet={frontLoadedBullet}
            />
          )}

          {activeTab === 'description' && (
            <JobDescriptionTab
              job={job}
              currentDescription={currentDescription}
              isLongText={isLongText}
              isDescriptionExpanded={isDescriptionExpanded}
              setIsDescriptionExpanded={setIsDescriptionExpanded}
              isEnrichingDescription={isEnrichingDescription}
              handleManualEnrich={handleManualEnrich}
              renderFormattedDescription={renderFormattedDescription}
            />
          )}

          {activeTab === 'notes' && (
            <JobNotesTab
              job={job}
              candidateNotes={candidateNotes}
              setCandidateNotes={setCandidateNotes}
              isSavingNotes={isSavingNotes}
              notesSavedSuccess={notesSavedSuccess}
              handleSaveNotes={handleSaveNotes}
            />
          )}

          {activeTab === 'assets' && (
            <JobAssetsTab
              job={job}
              activeProfile={activeProfile}
              onClose={onClose}
              onOpenAutoApply={onOpenAutoApply}
              onOpenGenerator={onOpenGenerator}
              onOpenOutreach={onOpenOutreach}
              onOpenMockInterview={onOpenMockInterview}
              onOpenInterviewPrep={onOpenInterviewPrep}
              onOpenInfluenceHub={onOpenInfluenceHub}
              onOpenAtsDiagnostic={onOpenAtsDiagnostic}
              onOpenCareerCompass={onOpenCareerCompass}
              onOpenCheatSheet={onOpenCheatSheet}
              onOpenCoverLetterPolarizer={onOpenCoverLetterPolarizer}
              onOpenExecutiveDossier={onOpenExecutiveDossier}
              onOpenKscGenerator={onOpenKscGenerator}
              onOpenLinkedInInbound={onOpenLinkedInInbound}
              onOpenRecruiterCrm={onOpenRecruiterCrm}
              onOpenScreeningSolver={onOpenScreeningSolver}
              onOpenSeekPass={onOpenSeekPass}
              setShowPsychology={setShowPsychology}
              copiedSubject={copiedSubject}
              setCopiedSubject={setCopiedSubject}
              handleCopySubject={handleCopySubject}
            />
          )}
 </div>

 {/* Footer */}
 <div className="bg-[#080d1a] px-6 py-3.5 border-t border-slate-800 flex items-center justify-between font-mono shrink-0">
 {isOffer ? (
 <div className="flex items-center gap-2">
 <button
 onClick={() => {
 if (onJobStatusUpdate) onJobStatusUpdate(job.id, 'Accepted / Hired');
 onClose();
 }}
 className="px-4 py-2 rounded-sm bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs transition-all cursor-pointer flex items-center gap-1.5"
 >
 <CheckCircle2 size={14} />
 <span>ACCEPT OFFER & MARK HIRED</span>
 </button>
 <button
 onClick={() => setShowPsychology(true)}
 className="px-3 py-2 rounded-sm bg-slate-900 hover:bg-slate-800 text-teal-300 border border-teal-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
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
 className="px-4 py-2 rounded-sm bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900 hover:from-indigo-900 hover:to-purple-900 text-amber-300 hover:text-white font-extrabold text-xs -xs transition-all cursor-pointer border border-amber-500/40 flex items-center gap-1.5"
 >
 <Zap size={13} className="text-amber-400 fill-amber-400 animate-pulse" />
 <span>⚡ {getQuickApplyPlatform(job).toUpperCase()}</span>
 </button>
 )}

 <button
 onClick={onClose}
 className="px-5 py-2 rounded-sm bg-slate-800/90 border border-slate-700 text-slate-200 font-extrabold text-xs hover:bg-slate-700 transition-colors cursor-pointer"
 >
 CLOSE MODAL
 </button>
 </div>

 </div>
 {showPsychology && (
 <SafeErrorBoundary sectionName="Psychology Decoder" onClose={() => setShowPsychology(false)}>
 <Suspense fallback={<ModalSkeleton />}>
 <PsychologyDecoderModal 
 job={job} 
 onClose={() => setShowPsychology(false)}
 onSaveInsights={(id, insights) => {
 if (onJobStatusUpdate) {
 onJobStatusUpdate(id, job.status || 'Discovered', { psychologyInsights: insights });
 }
 }}
 />
 </Suspense>
 </SafeErrorBoundary>
 )}
 {isCheatSheetOpen && (
 <SafeErrorBoundary sectionName="Interview Cheat Sheet" onClose={() => setIsCheatSheetOpen(false)}>
 <Suspense fallback={<ModalSkeleton />}>
 <InterviewCheatSheetModal
 isOpen={isCheatSheetOpen}
 onClose={() => setIsCheatSheetOpen(false)}
 job={job}
 userProfile={activeProfile}
 />
 </Suspense>
 </SafeErrorBoundary>
 )}
 </div>
 );
};

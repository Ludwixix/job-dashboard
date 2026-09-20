import React, { useState, useMemo, useEffect } from 'react';
import { 
 Sparkles, ShieldCheck, User, Mail, Lock, Briefcase, MapPin, 
 DollarSign, Upload, FileText, CheckCircle2, ArrowRight, ArrowLeft, 
 Zap, Building2, Tag, RefreshCw, AlertCircle, Plus, X, HeartPulse, 
 TrendingUp, Megaphone, HardHat, Users, Scale, Server, GraduationCap, Check,
  ShoppingBag, Truck, Palette, Compass, Key, Sliders, Award, Target, HelpCircle, Info, ChevronRight,
  Cpu, ExternalLink, Eye, EyeOff, Loader2
} from 'lucide-react';
import { 
  loginWithEmail, registerWithEmail, completeOnboarding, loginWithDemoPersona,
  verifyEmail, resendVerificationCode, validatePasswordStrength 
} from '../services/authService';
import { parseResumeWithAI, parseResumeTextClientSide, DEFAULT_PROFILES, saveProfile, saveProfileToBackend } from '../services/profileService';
import { loginWithBrowserPasskey, isPasskeySupported, storeBrowserCredentials } from '../services/passkeyService';
import { loginWithGoogle } from '../services/googleAuthService';
import { GooglePromptModal } from './GooglePromptModal';
import { applyIndustryTheme, getIndustryTheme } from '../services/industryThemeService';
import { runProfileOnboardingPipeline } from '../services/profileOnboardingPipeline';
import { pushQueriesToBackend } from '../services/jobQueryService';
import { getActiveApiKey, getActiveModel } from '../services/generationService';
import { extractTextFromFile, extractTextFromPastedPdfString } from '../utils/documentParser';
import { PROVIDERS, getLlmConfig, saveLlmConfig, testLlmConnection } from '../services/llmConfig';

import { StepAuthEmail, StepAuthIdentity } from './onboarding/StepAuth';
import { StepAiConfig } from './onboarding/StepAiConfig';
import { StepIndustry } from './onboarding/StepIndustry';
import { StepRolesSkills } from './onboarding/StepRolesSkills';
import { StepPreferences } from './onboarding/StepPreferences';
import { StepReviewLaunch } from './onboarding/StepReviewLaunch';

export const SENIORITY_OPTIONS = [
 { id: 'Junior', label: 'Junior / Entry', exp: '0–2 Yrs', desc: 'Focus on growth, mentorship & core fundamentals' },
 { id: 'Mid-Level', label: 'Mid-Level', exp: '2–5 Yrs', desc: 'Autonomous delivery, solid production mastery' },
 { id: 'Senior', label: 'Senior Specialist', exp: '5–8 Yrs', desc: 'Deep technical ownership, architectural guidance' },
 { id: 'Lead', label: 'Lead & Staff', exp: '8–12 Yrs', desc: 'Strategic roadmap, team leadership, player-coach' },
 { id: 'Director', label: 'Director & Exec', exp: '12+ Yrs', desc: 'Executive vision, organizational hiring & P&L' }
];

const INDUSTRY_OPTIONS = [
 { 
 id: 'Technology & IT', 
 name: 'Technology, Cloud & Software', 
 icon: Server, 
 tag: 'CYBER INDIGO',
 defaultTitles: ['Senior Systems Engineer', 'Cloud Infrastructure Engineer', 'M365 Engineer', 'Full Stack Developer', 'DevOps Engineer', 'IT Operations Lead'],
 defaultSkills: ['Microsoft 365', 'Azure', 'PowerShell', 'Active Directory', 'AWS', 'CI/CD', 'React', 'Docker']
 },
 { 
 id: 'Healthcare & Medical', 
 name: 'Healthcare, Nursing & Medical', 
 icon: HeartPulse, 
 tag: 'CLINICAL EMERALD',
 defaultTitles: ['Clinical Nurse Specialist', 'Registered Nurse', 'Associate Nurse Unit Manager', 'Clinical Care Coordinator', 'Physiotherapist', 'Hospital Administrator'],
 defaultSkills: ['AHPRA Registered Nurse', 'Acute Patient Assessment', 'Emergency Triage', 'Clinical Governance', 'Medication Administration', 'EMR / Cerner']
 },
 { 
 id: 'Finance & Accounting', 
 name: 'Finance, Banking & Accounting', 
 icon: TrendingUp, 
 tag: 'FINANCIAL GOLD',
 defaultTitles: ['Senior Financial Analyst', 'FP&A Manager', 'Management Accountant', 'Finance Business Partner', 'Commercial Analyst', 'Credit Risk Analyst'],
 defaultSkills: ['CPA / CA Qualified', 'Financial Modeling (3-Statement)', 'FP&A & Budgeting', 'Variance Analysis', 'SAP ERP', 'Power BI / Advanced Excel']
 },
 { 
 id: 'Marketing & Sales', 
 name: 'Sales, Marketing & Growth', 
 icon: Megaphone, 
 tag: 'DYNAMIC ROSE',
 defaultTitles: ['Digital Marketing Manager', 'Growth Lead', 'Head of Performance Marketing', 'Account Executive', 'Brand Strategist', 'Campaign Manager'],
 defaultSkills: ['Performance Marketing', 'Google Ads / Meta Ads', 'SEO / SEM Strategy', 'HubSpot / Marketo', 'Growth Funnel Optimization', 'Google Analytics 4']
 },
 { 
 id: 'Construction & Trades', 
 name: 'Construction, Trades & Built Environment', 
 icon: HardHat, 
 tag: 'INDUSTRIAL ORANGE',
 defaultTitles: ['Construction Project Manager', 'Site Engineer', 'Civil Project Manager', 'Contracts Administrator', 'Site Manager', 'Estimator'],
 defaultSkills: ['Tier 1 Commercial Delivery', 'Project Scheduling (MS Project/Primavera)', 'Procore', 'Contract Admin (AS4000/AS2124)', 'Site WHS Compliance', 'White Card']
 },
 { 
 id: 'Education', 
 name: 'Education, Teaching & Training', 
 icon: GraduationCap, 
 tag: 'ACADEMIC SKY',
 defaultTitles: ['Learning & Development Specialist', 'Academic Coordinator', 'Instructional Designer', 'Senior Educator', 'Curriculum Lead', 'Education Consultant'],
 defaultSkills: ['Curriculum Design', 'Instructional Design (Articulate 360)', 'LMS Administration (Canvas/Moodle)', 'Adult Learning Theory', 'Workshop Facilitation', 'VIT Registration']
 },
 { 
 id: 'Legal', 
 name: 'Legal, Compliance & Governance', 
 icon: Scale, 
 tag: 'JURIS PURPLE',
 defaultTitles: ['Senior Legal Counsel', 'Corporate Lawyer', 'Compliance Manager', 'Contracts Specialist', 'Legal Operations Lead', 'Paralegal'],
 defaultSkills: ['Contract Drafting & Negotiation', 'Regulatory Compliance', 'Commercial Law', 'Corporate Governance', 'Privacy / Privacy Act', 'Legal Risk Assessment']
 },
 { 
 id: 'HR & People', 
 name: 'Human Resources & People Operations', 
 icon: Users, 
 tag: 'PEOPLE MAGENTA',
 defaultTitles: ['People & Culture Manager', 'HR Business Partner', 'Talent Acquisition Lead', 'HR Operations Specialist', 'Employee Relations Lead', 'Remuneration Specialist'],
 defaultSkills: ['Talent Acquisition', 'HR Strategy', 'Employee Relations (Fair Work Act)', 'HRIS (Workday/BambooHR)', 'Performance Management', 'Culture & Engagement']
 },
 { 
 id: 'Retail & Hospitality', 
 name: 'Retail, Hospitality & Customer Ops', 
 icon: ShoppingBag, 
 tag: 'VIBRANT LIME',
 defaultTitles: ['Retail Operations Manager', 'Area Store Manager', 'Hospitality General Manager', 'Visual Merchandiser', 'Supply & Inventory Planner', 'Customer Experience Lead'],
 defaultSkills: ['Store Operations & P&L', 'Inventory Management', 'Team Leadership & Rostering', 'Visual Merchandising', 'Customer Experience (NPS)', 'Point of Sale (POS)']
 },
 { 
 id: 'Engineering', 
 name: 'Engineering, Hardware & Systems', 
 icon: Compass, 
 tag: 'PRECISION CYAN',
 defaultTitles: ['Senior Mechanical Engineer', 'Electrical Engineer', 'Civil Structural Engineer', 'Project Engineering Lead', 'BIM Coordinator', 'Systems Reliability Engineer'],
 defaultSkills: ['AutoCAD / Revit', 'SolidWorks', 'Engineers Australia (CPEng)', 'Finite Element Analysis (FEA)', 'Engineering Project Delivery', 'Quality Assurance (ISO 9001)']
 },
 { 
 id: 'Logistics & Supply Chain', 
 name: 'Logistics, Supply Chain & Transport', 
 icon: Truck, 
 tag: 'LOGISTICS BRONZE',
 defaultTitles: ['Supply Chain Manager', 'Logistics Operations Lead', 'Warehouse Manager', 'Procurement Specialist', 'Freight Coordinator', 'Demand Planner'],
 defaultSkills: ['Supply Chain Optimization', 'Warehouse Management Systems (WMS)', 'Procurement & Vendor Negotiation', 'Freight & Customs Compliance', 'Demand Forecasting', 'SAP / ERP']
 },
 { 
 id: 'Creative & Design', 
 name: 'Creative, Design & Media', 
 icon: Palette, 
 tag: 'CREATIVE FUCHSIA',
 defaultTitles: ['Senior Product Designer (UI/UX)', 'Creative Director', 'Brand Designer', 'Motion Graphics Specialist', 'Art Director', 'Content Producer'],
 defaultSkills: ['Figma / UI/UX Design', 'Design Systems', 'Adobe Creative Cloud', 'Prototyping & User Testing', 'Motion Graphics (After Effects)', 'Brand Identity']
 }
];

const PRESET_SUBURBS = [
 'Balaclava VIC 3183', 'Melbourne CBD VIC 3000', 'Richmond VIC 3121', 
 'South Yarra VIC 3141', 'St Kilda VIC 3182', 'Parkville VIC 3052', 
 'Hawthorn VIC 3122', 'Docklands VIC 3008', 'Carlton VIC 3053'
];

const WORK_MODE_OPTIONS = [
 { id: 'Any / Flexible', label: 'Any / Flexible', desc: 'Open to Remote, Hybrid, or On-site roles' },
 { id: 'Hybrid (1-3 days WFH)', label: 'Hybrid (WFH 2-3 Days)', desc: 'Balanced commute and home office flexibility' },
 { id: 'Remote Only', label: '100% Remote / WFH', desc: 'Exclusively remote positions across Australia' },
 { id: 'On-site / Office', label: 'On-site / In-Office', desc: 'Direct on-site or field-based presence' }
];

const WORK_RIGHTS_OPTIONS = [
 'Australian Citizen (Unrestricted)',
 'Permanent Resident (PR)',
 'New Zealand Citizen',
 'Temporary Work Visa (Subclass 482 / 485)',
 'Student / Graduate Visa (With Work Rights)'
];

const CLEARANCE_OPTIONS = [
 'Citizen / Standard Police Check',
 'Baseline Security Clearance Ready / Active',
 'NV1 (Negative Vetting 1) Ready / Active',
 'NV2 (Negative Vetting 2) Ready / Active',
 'Working With Children Check (WWCC) Cleared',
 'White Card / Industry Specific Cleared'
];

const ONBOARDING_DRAFT_KEY = 'job_dashboard_onboarding_draft';

export const OnboardingFlow = ({ onComplete, initialUser = null, onSignOut = null }) => {
  const [currentUser, setCurrentUser] = useState(initialUser);

  // Restore draft if saved previously for seamless continuation across page reloads/browser restarts
  const savedDraft = useMemo(() => {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (initialUser?.email && parsed?.profileData?.email && parsed.profileData.email.toLowerCase() !== initialUser.email.toLowerCase()) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [initialUser?.email]);

  const [isVerifyingEmail, setIsVerifyingEmail] = useState(() => {
    if (initialUser) {
      return !initialUser.email_verified;
    }
    return false;
  });

  const [step, setStep] = useState(() => {
    if (savedDraft?.step && (!initialUser || initialUser.email_verified || savedDraft.step > 1)) {
      // Step 2 used to be a mandatory AI setup screen. Migrate old drafts to
      // the first real profile step now that built-in AI is the default.
      return savedDraft.step === 2 ? 3 : savedDraft.step;
    }
    if (initialUser) {
      return initialUser.email_verified ? 3 : 1;
    }
    return 1;
  });

  const [authMode, setAuthMode] = useState('login'); // 'login', 'signup'
  
  // Step 1 Auth state
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Email Verification state
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendStatus, setResendStatus] = useState('');

  // Step 2 AI Intelligence Engine state
  const initialLlmConfig = useMemo(() => getLlmConfig(), []);
  const [llmProvider, setLlmProvider] = useState(() => savedDraft?.llmProvider || initialLlmConfig.provider || 'openrouter');
  const [llmModel, setLlmModel] = useState(() => savedDraft?.llmModel || initialLlmConfig.model || 'anthropic/claude-3.7-sonnet');
  const [llmApiKey, setLlmApiKey] = useState(() => savedDraft?.llmApiKey || initialLlmConfig.apiKey || '');
  const [llmEndpoint, setLlmEndpoint] = useState(() => initialLlmConfig.endpoint || '');
  const [aiEngineMode, setAiEngineMode] = useState(() => savedDraft?.aiEngineMode || (initialLlmConfig.apiKey ? 'byo' : 'builtin'));
  const [showApiKey, setShowApiKey] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState(null);
  const [llmError, setLlmError] = useState('');

  // Step 3-5 Profile Builder state — blank canvas by default, or restored from draft
  const [profileData, setProfileData] = useState(() => ({
    id: savedDraft?.profileData?.id || initialUser?.id || initialUser?.profileId || `profile_${Date.now()}`,
    name: savedDraft?.profileData?.name || initialUser?.name || '',
    email: savedDraft?.profileData?.email || initialUser?.email || '',
    phone: savedDraft?.profileData?.phone || initialUser?.phone || '',
    title: savedDraft?.profileData?.title || initialUser?.title || '',
    industry: savedDraft?.profileData?.industry || initialUser?.industry || '',
    seniorityLevel: savedDraft?.profileData?.seniorityLevel || initialUser?.seniorityLevel || '',
    location: savedDraft?.profileData?.location || initialUser?.location || '',
    suburb: savedDraft?.profileData?.suburb || initialUser?.suburb || '',
    workMode: savedDraft?.profileData?.workMode || initialUser?.workMode || 'Any / Flexible',
    targetSalary: savedDraft?.profileData?.targetSalary || initialUser?.targetSalary || '',
    workRights: savedDraft?.profileData?.workRights || initialUser?.workRights || '',
    clearance: savedDraft?.profileData?.clearance || initialUser?.clearance || '',
    targetTitles: savedDraft?.profileData?.targetTitles || initialUser?.targetTitles || [],
    coreSkills: savedDraft?.profileData?.coreSkills || initialUser?.coreSkills || [],
    certifications: savedDraft?.profileData?.certifications || initialUser?.certifications || [],
    workHistorySummary: savedDraft?.profileData?.workHistorySummary || initialUser?.workHistorySummary || '',
    fullWorkExperienceText: savedDraft?.profileData?.fullWorkExperienceText || initialUser?.fullWorkExperienceText || '',
    email_verified: Boolean(savedDraft?.profileData?.email_verified || initialUser?.email_verified)
  }));

  // Countdown timer for resend code
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Auth password strength in signup mode
  const signupPwdStrength = useMemo(() => {
    return validatePasswordStrength(authPassword);
  }, [authPassword]);

  // Handle 6-digit email verification submission
  const handleVerifyEmail = async (e) => {
    if (e) e.preventDefault();
    setVerifyError('');
    const code = verificationCode.trim();
    if (!code || code.length < 6) {
      setVerifyError('Please enter the complete 6-digit verification code.');
      return;
    }

    const emailToVerify = profileData.email || currentUser?.email || authEmail;
    setIsVerifying(true);
    try {
      await verifyEmail(code, emailToVerify);
      setVerifySuccess(true);
      setCurrentUser(prev => ({ ...prev, email_verified: true }));
      setProfileData(prev => ({ ...prev, email_verified: true }));
      setTimeout(() => {
        setIsVerifyingEmail(false);
        setStep(3);
      }, 700);
    } catch (err) {
      setVerifyError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0) return;
    setVerifyError('');
    setResendStatus('Sending new verification code...');
    const emailToResend = profileData.email || currentUser?.email || authEmail;
    try {
      const data = await resendVerificationCode(emailToResend);
      setResendCountdown(30);
      setResendStatus('A new 6-digit verification code was dispatched to your email.');
      if (data?.verification_code_preview) {
        setCurrentUser(prev => ({ ...prev, verificationCodePreview: data.verification_code_preview }));
      }
    } catch (err) {
      setVerifyError(err.message || 'Failed to resend code.');
      setResendStatus('');
    }
  };

  // Step 3 Resume Parsing state
  const [resumeText, setResumeText] = useState(() => savedDraft?.resumeText || '');
  const [isParsing, setIsParsing] = useState(false);
  const [parseSuccessMsg, setParseSuccessMsg] = useState('');
  const [newTitleInput, setNewTitleInput] = useState('');
  const [newSkillInput, setNewSkillInput] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState('');

  // Live active industry theme styling
  const activeIndustryTheme = useMemo(() => {
    return getIndustryTheme(profileData.industry);
  }, [profileData.industry]);

  useEffect(() => {
    applyIndustryTheme(profileData.industry);
  }, [profileData.industry]);

  // Auto-save onboarding draft to localStorage to ensure complete persistence across tab closures/reloads
  useEffect(() => {
    const handler = setTimeout(() => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({
            profileData,
            step,
            resumeText,
            llmProvider,
            llmModel,
            llmApiKey,
            aiEngineMode,
            updatedAt: Date.now()
          }));
        }
      } catch (err) {
        console.warn('Failed to auto-save onboarding draft:', err);
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [profileData, step, resumeText, llmProvider, llmModel, llmApiKey, aiEngineMode]);

  // Incrementally persist partial profile to candidate profile storage on step progression
  useEffect(() => {
    if (step >= 2 && profileData && typeof saveProfile === 'function') {
      try {
        saveProfile(profileData, { syncToBackend: true });
      } catch (err) {
        console.warn('Non-blocking incremental profile save error:', err);
      }
    }
  }, [step]);

  // Bespoke Setup Readiness & Profile Completeness Score (0 to 100%)
  const readinessAnalysis = useMemo(() => {
    let score = 0;
    const improvements = [];

    // 1. Candidate Identity & Name (15 pts)
    if (profileData.name && profileData.name.trim().length >= 2) {
      score += 15;
    } else {
      improvements.push({
        id: 'name',
        category: 'Identity',
        title: 'Add your candidate name',
        description: 'Personalizes your portal, tailored applications, and ATS document headers.',
        points: 15,
        stepTarget: 1,
        actionLabel: 'Add Full Name (+15%)'
      });
    }

    // 2. Industry Sector & Career Stage (15 pts)
    if (profileData.industry && profileData.seniorityLevel) {
      score += 15;
    } else {
      improvements.push({
        id: 'industry',
        category: 'Sector & Seniority',
        title: 'Choose your industry & seniority stage',
        description: 'Calibrates scraper gateway filters and contextual dashboard theme.',
        points: 15,
        stepTarget: 3,
        actionLabel: 'Select Industry (+15%)'
      });
    }

    // 3. Target Job Titles (15 pts)
    if (profileData.targetTitles?.length >= 2) {
      score += 15;
    } else {
      const missing = Math.max(1, 2 - (profileData.targetTitles?.length || 0));
      improvements.push({
        id: 'targetTitles',
        category: 'Search Queries',
        title: `Configure ${missing} more target role title${missing > 1 ? 's' : ''}`,
        description: 'Directly drives automated job gateway queries across Seek, Indeed & Adzuna.',
        points: 15,
        stepTarget: 4,
        actionLabel: 'Add Target Roles (+15%)'
      });
    }

    // 4. Core Skills & ATS Keywords (20 pts)
    if (profileData.coreSkills?.length >= 6) {
      score += 20;
    } else if (profileData.coreSkills?.length >= 3) {
      score += 10;
      improvements.push({
        id: 'coreSkills',
        category: 'ATS Optimization',
        title: 'Add 3+ domain skills or tools',
        description: 'Expands semantic match coverage to unlock 85%+ high-fit candidate tiers.',
        points: 10,
        stepTarget: 4,
        actionLabel: 'Add Skills (+10%)'
      });
    } else {
      improvements.push({
        id: 'coreSkills',
        category: 'ATS Optimization',
        title: 'Add 4+ core domain skills',
        description: 'Required by recruiter ATS algorithmic filters to rank your profile.',
        points: 20,
        stepTarget: 4,
        actionLabel: 'Add Core Skills (+20%)'
      });
    }

    // 5. Commute Location & Base (10 pts)
    if (profileData.location && profileData.location.trim().length >= 3) {
      score += 10;
    } else {
      improvements.push({
        id: 'location',
        category: 'Commute & Pay',
        title: 'Set your primary commute suburb',
        description: 'Enables transit time filtering and proximity scoring from your home base.',
        points: 10,
        stepTarget: 5,
        actionLabel: 'Set Commute Suburb (+10%)'
      });
    }

    // 6. Resume Text or Work History (15 pts)
    const hasWorkExperience = Boolean(
      (profileData.fullWorkExperienceText && profileData.fullWorkExperienceText.trim().length >= 40) ||
      (profileData.workHistorySummary && profileData.workHistorySummary.trim().length >= 30) ||
      (resumeText && resumeText.trim().length >= 40)
    );
    if (hasWorkExperience) {
      score += 15;
    } else {
      improvements.push({
        id: 'resume',
        category: 'Experience & History',
        title: 'Upload resume or paste work experience',
        description: 'Unlocks automated STAR achievement extraction and tailored application synthesis.',
        points: 15,
        stepTarget: 4,
        actionLabel: 'Upload Resume / History (+15%)'
      });
    }

    // 7. AI Reasoning Engine (built-in by default; personal key is optional)
    const hasApiKey = Boolean(llmApiKey && llmApiKey.trim().length > 3);
    const hasAiEngine = aiEngineMode === 'builtin' || hasApiKey;
    if (hasAiEngine) {
      score += 10;
    } else {
      improvements.push({
        id: 'aiEngine',
        category: 'AI Synthesis',
        title: 'Connect AI Reasoning Engine (API Key)',
        description: 'Powers 1-click tailored cover letters, document tuning, and interactive voice interview practice.',
        points: 10,
        stepTarget: 2,
        actionLabel: 'Configure AI Key (+10%)'
      });
    }

    return {
      score: Math.min(100, score),
      missingItems: improvements.map((i) => i.title),
      improvements,
      atsDensity: (profileData.coreSkills?.length || 0) >= 8 ? 'Optimal' : (profileData.coreSkills?.length || 0) >= 4 ? 'Good' : 'Low',
      isComplete: score >= 100
    };
  }, [profileData, llmApiKey, resumeText]);

  const readinessScore = readinessAnalysis.score;

  // STEP 1: AUTH HANDLERS
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (authMode === 'signup') {
      const strength = validatePasswordStrength(authPassword);
      if (!strength.isComplex) {
        setAuthError('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
        return;
      }
    }

    setAuthLoading(true);

    try {
      let sessionUser;
      if (authMode === 'signup') {
        sessionUser = await registerWithEmail(authName, authEmail, authPassword);
        storeBrowserCredentials(authEmail, authPassword, authName);
      } else {
        sessionUser = await loginWithEmail(authEmail, authPassword);
        storeBrowserCredentials(authEmail, authPassword, sessionUser.name);
      }

      setCurrentUser(sessionUser);
      setProfileData(prev => ({
        ...prev,
        id: sessionUser.id || sessionUser.profileId || prev.id,
        name: sessionUser.name || prev.name,
        email: sessionUser.email || prev.email,
        email_verified: Boolean(sessionUser.email_verified)
      }));

      // If returning user already completed onboarding, finish immediately
      if (sessionUser.onboardingCompleted) {
        if (onComplete) onComplete(sessionUser);
        return;
      }

      if (!sessionUser.email_verified) {
        setIsVerifyingEmail(true);
        setStep(1);
        return;
      }

      setStep(3);
    } catch (err) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

 const [showGooglePrompt, setShowGooglePrompt] = useState(false);

 const handleGoogleLogin = () => {
 setShowGooglePrompt(true);
 };

 const handlePasskeyLogin = async () => {
 setAuthError('');
 setAuthLoading(true);
 try {
 const user = await loginWithBrowserPasskey();
 if (onComplete) onComplete(user);
 } catch (err) {
 setAuthError(err.message || 'Passkey authentication was not completed.');
 } finally {
 setAuthLoading(false);
 }
 };

 const handleSelectDemoPersona = (presetId) => {
 const { session, profile } = loginWithDemoPersona(presetId);
 if (onComplete) onComplete(session, profile);
 };

  // STEP 2: AI ENGINE CONFIGURATION HANDLERS
  const handleSelectProvider = (provId) => {
    setLlmProvider(provId);
    const meta = PROVIDERS[provId] || PROVIDERS.openrouter;
    setLlmModel(meta.defaultModel || (meta.models?.[0]?.id) || '');
    setLlmEndpoint(meta.defaultEndpoint || '');
    setLlmTestResult(null);
    setLlmError('');
  };

  const handleTestLlm = async () => {
    if (!llmApiKey.trim()) {
      setLlmError('Please enter your API key before testing the connection.');
      return;
    }
    setLlmTesting(true);
    setLlmError('');
    setLlmTestResult(null);
    try {
      const res = await testLlmConnection({
        provider: llmProvider,
        model: llmModel,
        apiKey: llmApiKey.trim(),
        endpoint: llmEndpoint
      });
      setLlmTestResult(res);
    } catch (err) {
      setLlmError(err.message || 'Connection test failed.');
    } finally {
      setLlmTesting(false);
    }
  };

  const handleSaveLlmAndContinue = () => {
    const cleanKey = aiEngineMode === 'builtin' ? '' : llmApiKey.trim();
    saveLlmConfig({
      provider: aiEngineMode === 'builtin' ? 'openrouter' : llmProvider,
      model: aiEngineMode === 'builtin' ? 'anthropic/claude-3.7-sonnet' : llmModel,
      apiKey: cleanKey,
      endpoint: aiEngineMode === 'builtin' ? '' : llmEndpoint
    });
    setLlmError('');
    setStep(3); // Advance to profile setup
  };

  const handleSkipLlm = () => {
    saveLlmConfig({
      provider: llmProvider,
      model: llmModel,
      apiKey: llmApiKey.trim(),
      endpoint: llmEndpoint
    });
    setLlmError('');
    setStep(3); // Advance to Step 3: Industry
  };

  // STEP 3: INDUSTRY SELECTION
  const handleSelectIndustry = (ind) => {
    setProfileData(prev => ({
      ...prev,
      industry: ind.id,
      targetTitles: [...ind.defaultTitles.slice(0, 3)],
      coreSkills: [...new Set([...prev.coreSkills, ...ind.defaultSkills.slice(0, 5)])],
      title: ind.defaultTitles[0] || prev.title
    }));
  };

  // STEP 4: RESUME UPLOAD & PARSING
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseSuccessMsg('');
    try {
      const text = await extractTextFromFile(file);
      setResumeText(text);
      await handleParseResumeText(text, profileData);
    } catch (err) {
      console.warn('PDF.js extractTextFromFile error, attempting fallback reader:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const fallbackText = event.target?.result || '';
        setResumeText(fallbackText);
        handleParseResumeText(fallbackText, profileData);
      };
      reader.readAsText(file);
    } finally {
      setIsParsing(false);
    }
  };

  const handleParseResumeText = async (textToParse = resumeText, currentProfile = profileData) => {
    if (!textToParse.trim()) return;

    let cleanText = textToParse;
    if (cleanText.trim().startsWith('%PDF')) {
      try {
        cleanText = await extractTextFromPastedPdfString(cleanText);
        setResumeText(cleanText);
      } catch (err) {
        console.warn('Pasted PDF extraction error:', err);
      }
    }

    setIsParsing(true);
    setParseSuccessMsg('');
    try {
      const apiKey = getActiveApiKey();
      const model = getActiveModel();
      const parsed = await parseResumeWithAI(cleanText, apiKey, model, currentProfile.industry);

      if (parsed) {
        setProfileData(prev => {
          const effectiveIndustry = prev.industry || parsed.industry || 'Healthcare & Medical';
          
          // Guard: if candidate selected non-IT industry in Step 3, do NOT allow IT engineer titles to clobber
          let titles = parsed.targetTitles?.length ? parsed.targetTitles : prev.targetTitles;
          if (effectiveIndustry !== 'Technology & IT') {
            const hasItTitles = titles.some(t => /systems|devops|cloud|infrastructure|software|linux|m365/i.test(t));
            if (hasItTitles) {
              titles = prev.targetTitles?.length ? prev.targetTitles : [prev.title || parsed.title || 'Specialist'];
            }
          }
          let title = parsed.title || prev.title;
          if (effectiveIndustry !== 'Technology & IT' && /systems|devops|cloud|infrastructure|software/i.test(title)) {
            title = prev.title || titles[0] || 'Specialist';
          }

          return {
            ...prev,
            name: parsed.name && parsed.name !== 'Candidate' ? parsed.name : prev.name,
            title: title,
            industry: effectiveIndustry,
            email: parsed.email || prev.email,
            phone: parsed.phone || prev.phone,
            location: parsed.location || prev.location,
            suburb: parsed.suburb || prev.suburb,
            workRights: parsed.workRights || prev.workRights,
            clearance: parsed.clearance || prev.clearance,
            targetSalary: parsed.targetSalary || prev.targetSalary,
            targetTitles: titles,
            coreSkills: [...new Set([...(prev.coreSkills || []), ...(parsed.coreSkills || [])])],
            certifications: [...new Set([...(prev.certifications || []), ...(parsed.certifications || [])])],
            workHistorySummary: parsed.workHistorySummary || prev.workHistorySummary,
            fullWorkExperienceText: parsed.fullWorkExperienceText || cleanText
          };
        });
        setParseSuccessMsg('✨ Resume Successfully Analyzed! Your titles, skills and experience are calibrated.');
      }
    } catch {
      const clientParsed = parseResumeTextClientSide(cleanText, currentProfile);
      setProfileData(prev => ({ 
        ...prev, 
        ...clientParsed, 
        id: prev.id,
        name: clientParsed.name && clientParsed.name !== 'Candidate' ? clientParsed.name : prev.name,
        email: clientParsed.email || prev.email,
        fullWorkExperienceText: cleanText 
      }));
      setParseSuccessMsg('✅ Resume text analyzed & skills extracted.');
    } finally {
      setIsParsing(false);
    }
  };

 const handleAddSkill = (skillToAdd = newSkillInput) => {
 const trimmed = (skillToAdd || '').trim();
 if (trimmed && !profileData.coreSkills.includes(trimmed)) {
 setProfileData(prev => ({ ...prev, coreSkills: [...prev.coreSkills, trimmed] }));
 setNewSkillInput('');
 }
 };

 const handleRemoveSkill = (skill) => {
 setProfileData(prev => ({ ...prev, coreSkills: prev.coreSkills.filter(s => s !== skill) }));
 };

 const handleAddTitle = (titleToAdd = newTitleInput) => {
 const trimmed = (titleToAdd || '').trim();
 if (trimmed && !profileData.targetTitles.includes(trimmed)) {
 setProfileData(prev => ({ ...prev, targetTitles: [...prev.targetTitles, trimmed] }));
 setNewTitleInput('');
 }
 };

 const handleRemoveTitle = (title) => {
 setProfileData(prev => ({ ...prev, targetTitles: prev.targetTitles.filter(t => t !== title) }));
 };

 // FINAL COMPLETION & PIPELINE HAND-OFF
  const handleFinalSubmit = async () => {
    setIsLaunching(true);
    setLaunchMessage('Saving candidate profile to secure database...');
    const titles = profileData.targetTitles?.length ? profileData.targetTitles : (profileData.targetRoles || []);
    const seniority = profileData.seniorityLevel || profileData.seniority || 'Senior';
    const loc = profileData.location || profileData.locationPreference || '';
    const finalProfileData = {
      ...profileData,
      targetTitles: titles,
      targetRoles: [...titles],
      seniorityLevel: seniority,
      seniority: seniority,
      location: loc,
      locationPreference: loc,
      fullWorkExperienceText: profileData.fullWorkExperienceText || resumeText
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      }
      const { session, profile } = completeOnboarding(finalProfileData);
      setLaunchMessage('Pushing personalized search criteria to scrapers...');
      await saveProfileToBackend(profile);
      await pushQueriesToBackend(profile).catch(() => {});
      setLaunchMessage('Seeding recommendation weights & active theme...');
      await runProfileOnboardingPipeline(profile);
      sessionStorage.setItem('trigger_initial_scrape', 'true');
      setLaunchMessage('Ready! Welcome to your personalized dashboard.');
      setTimeout(() => {
        if (onComplete) onComplete(session, profile);
      }, 350);
    } catch (err) {
      console.error('Error during final onboarding handoff:', err);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('profile_needs_backend_sync', 'true');
      }
      sessionStorage.setItem('trigger_initial_scrape', 'true');
      const { session, profile } = completeOnboarding(finalProfileData);
      if (onComplete) onComplete(session, profile);
    } finally {
      setIsLaunching(false);
    }
  };

 const currentIndustryObj = useMemo(() => {
 return INDUSTRY_OPTIONS.find(i => i.id === profileData.industry) || INDUSTRY_OPTIONS[0];
 }, [profileData.industry]);

 return (
 <div className="min-h-screen bg-slate-950 industry-ambient-bg text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-amber-500 selection:text-white relative overflow-hidden">
 {/* Top Guided Header */}
 <header className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 border-b border-slate-800/80 font-mono gap-4">
 <div className="flex items-center gap-3">
 <div className="p-2.5 rounded-sm bg-gradient-to-br from-indigo-600 to-purple-600 text-white border border-amber-400/30">
 <Zap size={20} className="animate-pulse" />
 </div>
 <div>
 <div className="text-sm font-black tracking-widest text-white uppercase flex items-center gap-2">
 JOB SEEKER MATRIX // SETUP
              <span className={`text-[10px] px-2 py-0.5 rounded-sm font-mono font-bold border transition-colors ${
                readinessScore === 100
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                  : readinessScore >= 70
                  ? 'bg-amber-950 text-amber-300 border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}>
                {readinessScore}% COMPLETE
              </span>
            </div>
            <div className="text-[10px] text-slate-400">HAND-IN-HAND BESPOKE MATCHING & APPLICATION ONBOARDING</div>
          </div>
        </div>

        {/* Step Indicators with labels */}
        <div className="flex items-center gap-1.5 text-xs font-bold w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { num: 1, displayNum: 1, label: isVerifyingEmail ? 'Verify Email' : 'Identity' },
            { num: 3, displayNum: 2, label: 'Profile' },
            { num: 4, displayNum: 3, label: 'Skills & Experience' },
            { num: 5, displayNum: 4, label: 'Preferences' },
            { num: 6, displayNum: 5, label: 'Launch' }
          ].map((s) => {
            const isClickable = !isVerifyingEmail || s.num === 1;
            return (
              <div
                key={s.num}
                onClick={() => {
                  if (s.num === 1 && isVerifyingEmail) return;
                  if (isClickable) {
                    setStep(s.num);
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono transition-all ${
                  isClickable ? 'cursor-pointer hover:bg-slate-800' : 'cursor-not-allowed opacity-60'
                } ${
                  step === s.num
                    ? 'bg-amber-600 text-white font-black border border-amber-400'
                    : step > s.num
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
                title={`Go to Step ${s.num}: ${s.label}`}
              >
                <span>{step > s.num ? '✓' : s.displayNum}</span>
                <span className="hidden md:inline">{s.label}</span>
              </div>
            );
          })}
        </div>
      </header>

  {/* Main Wizard Container */}
  <main className="max-w-3xl mx-auto w-full my-auto py-6">
  <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-sm p-6 sm:p-10 space-y-8 animate-in fade-in zoom-in-95 duration-200">
  
  {/* STEP 1A: EMAIL VERIFICATION */}
  {step === 1 && isVerifyingEmail && (
            <StepAuthEmail
              profileData={profileData}
              currentUser={currentUser}
              initialUser={initialUser}
              authEmail={authEmail}
              handleVerifyEmail={handleVerifyEmail}
              verificationCode={verificationCode}
              setVerificationCode={setVerificationCode}
              isVerifying={isVerifying}
              verifyError={verifyError}
              verifySuccess={verifySuccess}
              resendStatus={resendStatus}
              handleResendCode={handleResendCode}
              resendCountdown={resendCountdown}
              setIsVerifyingEmail={setIsVerifyingEmail}
              setStep={setStep}
              onSignOut={onSignOut}
            />
          )}

          {step === 1 && !isVerifyingEmail && (
            <StepAuthIdentity
              authMode={authMode}
              setAuthMode={setAuthMode}
              authName={authName}
              setAuthName={setAuthName}
              authEmail={authEmail}
              setAuthEmail={setAuthEmail}
              authPassword={authPassword}
              setAuthPassword={setAuthPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              signupPwdStrength={signupPwdStrength}
              authError={authError}
              setShowGooglePrompt={setShowGooglePrompt}
              authLoading={authLoading}
              handleAuthSubmit={handleAuthSubmit}
              handlePasskeyAuth={handlePasskeyLogin}
              isPasskeySupported={isPasskeySupported}
              handleSelectDemoPersona={handleSelectDemoPersona}
            />
          )}

          {step === 2 && (
            <StepAiConfig
              aiEngineMode={aiEngineMode}
              setAiEngineMode={setAiEngineMode}
              llmProvider={llmProvider}
              setLlmProvider={setLlmProvider}
              llmModel={llmModel}
              setLlmModel={setLlmModel}
              llmApiKey={llmApiKey}
              setLlmApiKey={setLlmApiKey}
              llmEndpoint={llmEndpoint}
              setLlmEndpoint={setLlmEndpoint}
              showApiKey={showApiKey}
              setShowApiKey={setShowApiKey}
              llmTesting={llmTesting}
              llmTestResult={llmTestResult}
              llmError={llmError}
              setLlmError={setLlmError}
              setLlmTestResult={setLlmTestResult}
              handleTestLlm={handleTestLlm}
              handleSaveLlmAndContinue={handleSaveLlmAndContinue}
              handleSelectProvider={handleSelectProvider}
              handleSkipLlm={handleSkipLlm}
              setStep={setStep}
            />
          )}

          {step === 3 && (
            <StepIndustry
              profileData={profileData}
              setProfileData={setProfileData}
              INDUSTRY_OPTIONS={INDUSTRY_OPTIONS}
              SENIORITY_OPTIONS={SENIORITY_OPTIONS}
              handleSelectIndustry={handleSelectIndustry}
              setStep={setStep}
            />
          )}

          {step === 4 && (
            <StepRolesSkills
              profileData={profileData}
              readinessAnalysis={readinessAnalysis}
              currentIndustryObj={currentIndustryObj}
              setProfileData={setProfileData}
              newTitleInput={newTitleInput}
              setNewTitleInput={setNewTitleInput}
              newSkillInput={newSkillInput}
              setNewSkillInput={setNewSkillInput}
              handleFileUpload={handleFileUpload}
              handleParseResumeText={handleParseResumeText}
              handleAddTitle={handleAddTitle}
              handleRemoveTitle={handleRemoveTitle}
              handleAddSkill={handleAddSkill}
              handleRemoveSkill={handleRemoveSkill}
              resumeText={resumeText}
              setResumeText={setResumeText}
              isParsing={isParsing}
              parseSuccessMsg={parseSuccessMsg}
              setStep={setStep}
            />
          )}

          {step === 5 && (
            <StepPreferences
              profileData={profileData}
              setProfileData={setProfileData}
              PRESET_SUBURBS={PRESET_SUBURBS}
              WORK_MODE_OPTIONS={WORK_MODE_OPTIONS}
              WORK_RIGHTS_OPTIONS={WORK_RIGHTS_OPTIONS}
              CLEARANCE_OPTIONS={CLEARANCE_OPTIONS}
              setStep={setStep}
            />
          )}

          {step === 6 && (
            <StepReviewLaunch
              readinessAnalysis={readinessAnalysis}
              readinessScore={readinessScore}
              profileData={profileData}
              aiEngineMode={aiEngineMode}
              llmProvider={llmProvider}
              llmModel={llmModel}
              setStep={setStep}
              isLaunching={isLaunching}
              launchMessage={launchMessage}
              handleFinalSubmit={handleFinalSubmit}
            />
          )}
        </div>
      </main>

 {/* Google Sign-In & Gmail Sync Modal Prompt */}
 <GooglePromptModal
 isOpen={showGooglePrompt}
 onClose={() => setShowGooglePrompt(false)}
 onAuthenticated={(session, profile) => {
 if (onComplete) onComplete(session, profile);
 }}
 />

 {/* Bottom Footer */}
 <footer className="text-center font-mono text-[11px] text-slate-500 py-4">
 Autonomous Job Seeker Matrix • Hand-in-Hand Bespoke Candidate Matching Platform
 </footer>
 </div>
 );
};

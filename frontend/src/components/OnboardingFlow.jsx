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
import { parseResumeWithAI, parseResumeTextClientSide, DEFAULT_PROFILES, saveProfileToBackend } from '../services/profileService';
import { loginWithBrowserPasskey, isPasskeySupported, storeBrowserCredentials } from '../services/passkeyService';
import { loginWithGoogle } from '../services/googleAuthService';
import { GooglePromptModal } from './GooglePromptModal';
import { applyIndustryTheme, getIndustryTheme } from '../services/industryThemeService';
import { runProfileOnboardingPipeline } from '../services/profileOnboardingPipeline';
import { getActiveApiKey, getActiveModel } from '../services/generationService';
import { extractTextFromFile, extractTextFromPastedPdfString } from '../utils/documentParser';
import { PROVIDERS, getLlmConfig, saveLlmConfig, testLlmConnection } from '../services/llmConfig';

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

export const OnboardingFlow = ({ onComplete, initialUser = null, onSignOut = null }) => {
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(() => {
    if (initialUser) {
      return !initialUser.email_verified;
    }
    return false;
  });
  const [step, setStep] = useState(() => {
    if (initialUser) {
      return initialUser.email_verified ? 2 : 1;
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
  const [llmProvider, setLlmProvider] = useState(() => initialLlmConfig.provider || 'openrouter');
  const [llmModel, setLlmModel] = useState(() => initialLlmConfig.model || 'anthropic/claude-3.7-sonnet');
  const [llmApiKey, setLlmApiKey] = useState(() => initialLlmConfig.apiKey || '');
  const [llmEndpoint, setLlmEndpoint] = useState(() => initialLlmConfig.endpoint || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState(null);
  const [llmError, setLlmError] = useState('');

  // Step 3-5 Profile Builder state
  const [profileData, setProfileData] = useState(() => ({
    id: initialUser?.id || initialUser?.profileId || `profile_${Date.now()}`,
    name: initialUser?.name || '',
    email: initialUser?.email || '',
    phone: initialUser?.phone || '0400 000 000',
    title: initialUser?.title || '',
    industry: initialUser?.industry || 'Technology & IT',
    seniorityLevel: initialUser?.seniorityLevel || 'Senior',
    location: initialUser?.location || 'Balaclava VIC 3183',
    suburb: initialUser?.suburb || 'Balaclava',
    workMode: initialUser?.workMode || 'Any / Flexible',
    targetSalary: initialUser?.targetSalary || '$130,000 + Super',
    workRights: initialUser?.workRights || 'Australian Citizen (Unrestricted)',
    clearance: initialUser?.clearance || 'Citizen / Standard Police Check',
    targetTitles: initialUser?.targetTitles || ['Senior Systems Engineer', 'Cloud Infrastructure Engineer', 'M365 Engineer'],
    coreSkills: initialUser?.coreSkills || ['Microsoft 365', 'Azure', 'PowerShell', 'Active Directory'],
    certifications: initialUser?.certifications || [],
    workHistorySummary: initialUser?.workHistorySummary || '',
    fullWorkExperienceText: initialUser?.fullWorkExperienceText || '',
    email_verified: Boolean(initialUser?.email_verified)
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
        setStep(2);
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
  const [resumeText, setResumeText] = useState('');
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

  // Bespoke Setup Readiness Score (0 to 100%) & AI Career Coach Insights
  const readinessAnalysis = useMemo(() => {
    let score = 0;
    const missingItems = [];
    if (profileData.name && profileData.name.trim().length >= 2) {
      score += 15;
    } else {
      missingItems.push('Enter your name');
    }
    if (profileData.email) score += 10;
    if (profileData.industry) score += 15;
    if (profileData.seniorityLevel) score += 10;
    if (profileData.targetTitles?.length >= 2) {
      score += 20;
    } else {
      missingItems.push('Add at least 2 target titles');
    }
    if (profileData.coreSkills?.length >= 6) {
      score += 20;
    } else if (profileData.coreSkills?.length >= 3) {
      score += 10;
      missingItems.push('Add 3 more domain skills for ATS optimization');
    } else {
      missingItems.push('Add skills to reach ATS threshold');
    }
    if (profileData.location) score += 10;
    return {
      score: Math.min(100, score),
      missingItems,
      atsDensity: (profileData.coreSkills?.length || 0) >= 8 ? 'Optimal' : (profileData.coreSkills?.length || 0) >= 4 ? 'Good' : 'Low'
    };
  }, [profileData]);

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

      setStep(2);
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
    const cleanKey = llmApiKey.trim();
    const meta = PROVIDERS[llmProvider] || PROVIDERS.openrouter;
    if (meta.requiresKey && !cleanKey) {
      setLlmError(`An API key is required for ${meta.name} to generate tailored applications and unlock the site.`);
      return;
    }
    saveLlmConfig({
      provider: llmProvider,
      model: llmModel,
      apiKey: cleanKey,
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
      await handleParseResumeText(text);
    } catch (err) {
      console.warn('PDF.js extractTextFromFile error, attempting fallback reader:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const fallbackText = event.target?.result || '';
        setResumeText(fallbackText);
        handleParseResumeText(fallbackText);
      };
      reader.readAsText(file);
    } finally {
      setIsParsing(false);
    }
  };

  const handleParseResumeText = async (textToParse = resumeText) => {
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
      const parsed = await parseResumeWithAI(cleanText, apiKey, model);

      if (parsed) {
        setProfileData(prev => ({
          ...prev,
          name: parsed.name || prev.name,
          title: parsed.title || prev.title,
          email: parsed.email || prev.email,
          phone: parsed.phone || prev.phone,
          location: parsed.location || prev.location,
          suburb: parsed.suburb || prev.suburb,
          workRights: parsed.workRights || prev.workRights,
          clearance: parsed.clearance || prev.clearance,
          targetSalary: parsed.targetSalary || prev.targetSalary,
          targetTitles: parsed.targetTitles?.length ? parsed.targetTitles : prev.targetTitles,
          coreSkills: parsed.coreSkills?.length ? parsed.coreSkills : prev.coreSkills,
          certifications: parsed.certifications || prev.certifications,
          workHistorySummary: parsed.workHistorySummary || prev.workHistorySummary,
          fullWorkExperienceText: parsed.fullWorkExperienceText || cleanText
        }));
        setParseSuccessMsg('✨ AI Resume Successfully Extracted! Your titles, skills and metrics are loaded.');
      }
    } catch {
      const clientParsed = parseResumeTextClientSide(cleanText);
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
 try {
 const { session, profile } = completeOnboarding(profileData);
 setLaunchMessage('Pushing personalized search criteria to scrapers...');
 await saveProfileToBackend(profile);
 setLaunchMessage('Seeding recommendation weights & active theme...');
 await runProfileOnboardingPipeline(profile);
 sessionStorage.setItem('trigger_initial_scrape', 'true');
 setLaunchMessage('Ready! Welcome to your personalized dashboard.');
 setTimeout(() => {
 if (onComplete) onComplete(session, profile);
 }, 350);
 } catch (err) {
 console.error('Error during final onboarding handoff:', err);
 sessionStorage.setItem('trigger_initial_scrape', 'true');
 const { session, profile } = completeOnboarding(profileData);
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
 <span className="text-[10px] px-2 py-0.5 rounded-sm bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
 {readinessScore}% BESPOKE
 </span>
 </div>
 <div className="text-[10px] text-slate-400">HAND-IN-HAND BESPOKE MATCHING & APPLICATION ONBOARDING</div>
 </div>
 </div>

  {/* Step Indicators with labels */}
  <div className="flex items-center gap-1.5 text-xs font-bold w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
  {[
    { num: 1, label: isVerifyingEmail ? 'Verify Email' : 'Identity' },
    { num: 2, label: 'AI Engine' },
    { num: 3, label: 'Industry' },
    { num: 4, label: 'Skills & Experience' },
    { num: 5, label: 'Location & Work' },
    { num: 6, label: 'Launch' }
  ].map((s) => (
    <div
      key={s.num}
      onClick={() => {
        if (s.num === 1 && isVerifyingEmail) return;
        if (s.num > 2 && !llmApiKey.trim()) {
          setLlmError('Please configure your AI API key first.');
          setStep(2);
          return;
        }
        if (step > s.num) {
          setStep(s.num);
        }
      }}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono transition-all ${
        step > s.num ? 'cursor-pointer hover:bg-slate-800' : ''
      } ${
        step === s.num
          ? 'bg-amber-600 text-white font-black border border-amber-400'
          : step > s.num
          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
          : 'bg-slate-900 text-slate-500 border border-slate-800'
      }`}
    >
      <span>{step > s.num ? '✓' : s.num}</span>
      <span className="hidden md:inline">{s.label}</span>
    </div>
  ))}
  </div>
  </header>

  {/* Main Wizard Container */}
  <main className="max-w-3xl mx-auto w-full my-auto py-6">
  <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-sm p-6 sm:p-10 space-y-8 animate-in fade-in zoom-in-95 duration-200">
  
  {/* STEP 1A: EMAIL VERIFICATION */}
  {step === 1 && isVerifyingEmail && (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
          <ShieldCheck size={14} /> STEP 1 OF 6 // EMAIL VERIFICATION
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          Verify Your Email Address
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
          We've sent a 6-digit verification code to <span className="text-amber-400 font-bold">{profileData.email || currentUser?.email || authEmail}</span>. Enter it below to activate your candidate profile.
        </p>
      </div>

      <form onSubmit={handleVerifyEmail} className="space-y-5 max-w-md mx-auto font-mono text-xs">
        {/* Development preview banner */}
        {(currentUser?.verificationCodePreview || initialUser?.verificationCodePreview) && (
          <div className="p-3 rounded-sm bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/80 text-amber-300 font-bold">DEV CODE</span>
              <span className="font-mono font-black tracking-widest text-amber-300">
                {currentUser?.verificationCodePreview || initialUser?.verificationCodePreview}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setVerificationCode(currentUser?.verificationCodePreview || initialUser?.verificationCodePreview)}
              className="text-[10px] text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer"
            >
              Auto-fill
            </button>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-300 tracking-widest uppercase block text-center">
            6-DIGIT VERIFICATION CODE
          </label>
          <input
            type="text"
            maxLength={6}
            autoFocus
            value={verificationCode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setVerificationCode(val);
              if (verifyError) setVerifyError('');
            }}
            placeholder="000000"
            className="w-full text-center text-2xl font-black tracking-[0.5em] p-3.5 rounded-sm bg-slate-950 border border-slate-700 focus:border-amber-500 text-amber-400 focus:outline-none placeholder-slate-700 transition-colors"
          />
        </div>

        {verifyError && (
          <div className="p-3 rounded-sm bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-400 shrink-0" />
            <span>{verifyError}</span>
          </div>
        )}

        {verifySuccess && (
          <div className="p-3 rounded-sm bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>✓ Email verified! Preparing your setup wizard...</span>
          </div>
        )}

        {resendStatus && (
          <div className="p-2 rounded-sm bg-slate-800/80 text-slate-300 text-[11px] text-center">
            {resendStatus}
          </div>
        )}

        <button
          type="submit"
          disabled={isVerifying || verificationCode.length < 6 || verifySuccess}
          className="w-full py-3.5 px-4 rounded-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black text-sm tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {isVerifying ? (
            <>
              <RefreshCw size={15} className="animate-spin text-amber-200" />
              <span>VERIFYING CODE...</span>
            </>
          ) : (
            <>
              <span>CONFIRM &amp; PROCEED TO SETUP</span>
              <ArrowRight size={15} />
            </>
          )}
        </button>

        <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resendCountdown > 0 || isVerifying}
            className="text-amber-400 hover:text-amber-300 disabled:text-slate-600 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : "Didn't receive code? Resend"}
          </button>

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </div>
      </form>
    </div>
  )}

  {/* STEP 1B: AUTHENTICATION / ACCESS */}
  {step === 1 && !isVerifyingEmail && (
  <div className="space-y-6">
  <div className="text-center space-y-2">
  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
  <ShieldCheck size={14} /> STEP 1 OF 6 // YOUR CANDIDATE IDENTITY
  </div>
  <h1 className="text-2xl sm:text-3xl font-black text-white">
  Welcome to Your Bespoke Job Agent
  </h1>
  <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
  Let's configure your autonomous job discovery engine so every job match, commute calculation, and generated cover letter fits your exact profile.
  </p>
  </div>

  {/* Email / Password Form */}
  <form onSubmit={handleAuthSubmit} className="space-y-4 max-w-md mx-auto font-mono text-xs">
  {authMode === 'signup' && (
  <div className="space-y-1.5">
  <label className="text-slate-300 font-bold flex items-center gap-1.5">
  <User size={13} className="text-amber-400" /> FULL NAME
  </label>
  <input
  type="text"
  required
  value={authName}
  onChange={(e) => setAuthName(e.target.value)}
  placeholder="e.g. Sam Ludwig"
  className="w-full p-3 rounded-sm bg-slate-950 border border-slate-800 text-white focus:border-amber-500 focus:outline-none placeholder-slate-600 font-sans text-sm"
  />
  </div>
  )}

  <div className="space-y-1.5">
  <label className="text-slate-300 font-bold flex items-center gap-1.5">
  <Mail size={13} className="text-amber-400" /> EMAIL ADDRESS
  </label>
  <input
  type="email"
  required
  value={authEmail}
  onChange={(e) => setAuthEmail(e.target.value)}
  placeholder="e.g. user@gmail.com"
  className="w-full p-3 rounded-sm bg-slate-950 border border-slate-800 text-white focus:border-amber-500 focus:outline-none placeholder-slate-600 font-sans text-sm"
  />
  </div>

  <div className="space-y-1.5">
  <label className="text-slate-300 font-bold flex items-center gap-1.5">
  <Lock size={13} className="text-amber-400" /> PASSWORD
  </label>
  <input
  type="password"
  required
  value={authPassword}
  onChange={(e) => setAuthPassword(e.target.value)}
  placeholder="Min. 8 chars, 1 upper, 1 special"
  className="w-full p-3 rounded-sm bg-slate-950 border border-slate-800 text-white focus:border-amber-500 focus:outline-none placeholder-slate-600 font-sans text-sm"
  />
  </div>

  {/* Real-time Password Complexity Meter & Checklist for Signup */}
  {authMode === 'signup' && authPassword.length > 0 && (
    <div className="p-3 bg-slate-950 border border-slate-800 rounded-sm space-y-2.5 text-[11px] font-mono">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">
          PASSWORD STRENGTH:
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${
          signupPwdStrength.isComplex ? 'text-emerald-400' :
          signupPwdStrength.score >= 3 ? 'text-amber-400' : 'text-rose-400'
        }`}>
          {signupPwdStrength.strengthLabel} ({signupPwdStrength.score}/5)
        </span>
      </div>

      {/* 5-segment Strength Bar */}
      <div className="grid grid-cols-5 gap-1.5 h-1">
        {[1, 2, 3, 4, 5].map((idx) => {
          let barColor = 'bg-slate-800';
          if (idx <= signupPwdStrength.score) {
            if (signupPwdStrength.score === 5) barColor = 'bg-emerald-500';
            else if (signupPwdStrength.score >= 3) barColor = 'bg-amber-500';
            else barColor = 'bg-rose-500';
          }
          return (
            <div key={idx} className={`h-full rounded-sm transition-all duration-300 ${barColor}`} />
          );
        })}
      </div>

      {/* Requirements Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[10px]">
        <div className={`flex items-center gap-1.5 ${signupPwdStrength.rules.minLength ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          <span>{signupPwdStrength.rules.minLength ? '✓' : '•'}</span>
          <span>8+ characters</span>
        </div>
        <div className={`flex items-center gap-1.5 ${signupPwdStrength.rules.hasUpper ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          <span>{signupPwdStrength.rules.hasUpper ? '✓' : '•'}</span>
          <span>1 uppercase (A-Z)</span>
        </div>
        <div className={`flex items-center gap-1.5 ${signupPwdStrength.rules.hasLower ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          <span>{signupPwdStrength.rules.hasLower ? '✓' : '•'}</span>
          <span>1 lowercase (a-z)</span>
        </div>
        <div className={`flex items-center gap-1.5 ${signupPwdStrength.rules.hasDigit ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          <span>{signupPwdStrength.rules.hasDigit ? '✓' : '•'}</span>
          <span>1 number (0-9)</span>
        </div>
        <div className={`flex items-center gap-1.5 col-span-1 sm:col-span-2 ${signupPwdStrength.rules.hasSpecial ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          <span>{signupPwdStrength.rules.hasSpecial ? '✓' : '•'}</span>
          <span>1 special symbol (!@#$%^&*...)</span>
        </div>
      </div>
    </div>
  )}

 {authError && (
 <div className="p-3 rounded-sm bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
 <AlertCircle size={15} className="text-rose-400 shrink-0" />
 <span>{authError}</span>
 </div>
 )}

 {/* 1-Click Google Sign In with Auto Gmail Scan */}
 <button
 type="button"
 onClick={handleGoogleLogin}
 disabled={authLoading}
 className="w-full py-3.5 px-4 rounded-sm bg-white hover:bg-slate-100 text-slate-900 font-black text-xs border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50 relative overflow-hidden group"
 title="1-Click Google Login: Auto-provisions account and scans Gmail for application history"
 >
 <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
 <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
 <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.29 21.36 7.37 24 12 24z"/>
 <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.98 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
 <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.29 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
 </svg>
 <span className="tracking-wide">SIGN IN WITH GOOGLE (AUTO-SETUP & GMAIL SYNC)</span>
 </button>

 <div className="flex items-center gap-3 my-2">
 <div className="flex-1 h-px bg-slate-800" />
 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">OR EMAIL & PASSKEY</span>
 <div className="flex-1 h-px bg-slate-800" />
 </div>

 <button
 type="submit"
 disabled={authLoading}
 className="w-full py-3.5 px-4 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
 >
 {authLoading ? <RefreshCw size={16} className="animate-spin text-amber-200" /> : <ArrowRight size={16} />}
 <span>{authMode === 'signup' ? 'CREATE ACCOUNT & START SETUP' : 'SIGN IN & CONTINUE'}</span>
 </button>

 {/* Passkey / Stored Browser Creds Button */}
 <button
 type="button"
 onClick={handlePasskeyLogin}
 disabled={authLoading}
 className="w-full py-3 px-4 rounded-sm bg-slate-950 hover:bg-slate-800 border border-emerald-500/50 text-emerald-300 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
 title="Authenticate using stored browser password manager, Touch ID, Face ID, Windows Hello, or Passkey"
 >
 <Key size={14} className="text-emerald-400" />
 <span>🔑 SIGN IN WITH PASSKEY / BROWSER CREDS</span>
 </button>

 <div className="text-center pt-1 text-slate-400 text-xs">
 {authMode === 'login' ? (
 <span>
 Don't have an account?{' '}
 <button type="button" onClick={() => setAuthMode('signup')} className="text-amber-400 hover:underline font-bold cursor-pointer">
 Sign Up Free
 </button>
 </span>
 ) : (
 <span>
 Already have an account?{' '}
 <button type="button" onClick={() => setAuthMode('login')} className="text-amber-400 hover:underline font-bold cursor-pointer">
 Sign In
 </button>
 </span>
 )}
 </div>
 </form>

 {/* 1-Click Sam Ludwig Profile Quick-Launch */}
 <div className="pt-6 border-t border-slate-800 space-y-3 font-mono">
 <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
 ⚡ OR QUICK-LAUNCH WITH SAM LUDWIG PROFILE:
 </div>
 <div className="flex justify-center">
 {DEFAULT_PROFILES.map(preset => (
 <button
 key={preset.id}
 onClick={() => handleSelectDemoPersona(preset.id)}
 className="w-full sm:max-w-md p-3.5 rounded-sm bg-slate-950 hover:bg-slate-800 border border-amber-500/40 hover:border-amber-400 transition-all text-left flex items-center gap-3 cursor-pointer group "
 >
 <div className="w-10 h-10 rounded-sm bg-amber-600/30 text-amber-300 font-black text-sm flex items-center justify-center shrink-0 border border-amber-400/50 group-hover:bg-amber-600 group-hover:text-white transition-colors">
 SL
 </div>
 <div className="min-w-0 flex-1">
 <div className="font-black text-white text-sm group-hover:text-amber-300 flex items-center gap-1.5">
 {preset.name}
 <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/40 font-mono">ORIGINAL PROFILE</span>
 </div>
 <div className="text-[11px] text-slate-400 truncate">{preset.title}</div>
 </div>
 <ArrowRight size={16} className="text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
 </button>
 ))}
 </div>
 </div>
 </div>
 )}

  {/* STEP 2: AI INTELLIGENCE ENGINE & CREDENTIALS */}
  {step === 2 && (
    <div className="space-y-6 animate-in fade-in duration-200 font-mono text-xs">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
          <Cpu size={14} /> STEP 2 OF 6 // AI INTELLIGENCE ENGINE & CREDENTIALS
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-sans">
          Configure Your Career AI Engine
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto font-sans">
          An API key is required to power ATS match scoring, custom executive cover letters, and live interview simulation.
        </p>
      </div>

      {/* Provider Selection Grid */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
          1. Select AI Provider
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {['openrouter', 'openai', 'gemini', 'anthropic', 'deepseek', 'groq'].map((pKey) => {
            const meta = PROVIDERS[pKey];
            if (!meta) return null;
            const isSelected = llmProvider === pKey;
            return (
              <button
                key={pKey}
                type="button"
                onClick={() => handleSelectProvider(pKey)}
                className={`p-3.5 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-sm text-white font-sans">{meta.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-slate-800 text-amber-400 border border-slate-700">
                    {meta.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 font-sans">
                  {meta.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Model Selection & API Key Inputs */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-sm p-5 space-y-4">
        {/* Model Dropdown */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
            2. Primary Reasoning Model
          </label>
          <select
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            className="w-full p-2.5 rounded-sm bg-slate-900 border border-slate-700 text-slate-100 font-sans text-xs focus:border-amber-500 focus:outline-none cursor-pointer"
          >
            {(PROVIDERS[llmProvider]?.models || []).map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100">
                {m.name} {m.description ? `— ${m.description}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* API Key Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              3. {PROVIDERS[llmProvider]?.name || 'Provider'} API Key <span className="text-rose-400">*</span>
            </label>
            {PROVIDERS[llmProvider]?.keyUrl && (
              <a
                href={PROVIDERS[llmProvider].keyUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 underline font-sans"
              >
                Get {PROVIDERS[llmProvider].name} Key <ExternalLink size={11} />
              </a>
            )}
          </div>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={llmApiKey}
              onChange={(e) => {
                setLlmApiKey(e.target.value);
                setLlmError('');
                setLlmTestResult(null);
              }}
              placeholder={PROVIDERS[llmProvider]?.keyPlaceholder || 'Paste your API key here...'}
              className="w-full p-2.5 pr-20 rounded-sm bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:border-amber-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1 font-sans cursor-pointer"
            >
              {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{showApiKey ? 'Hide' : 'Show'}</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-sans">
            🔒 Stored securely in your browser session. Required for ATS scoring and application generation.
          </p>
        </div>

        {/* Test Connection Button & Status */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestLlm}
            disabled={llmTesting || !llmApiKey.trim()}
            className="px-3.5 py-2 rounded-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 text-xs"
          >
            {llmTesting ? <Loader2 size={13} className="animate-spin text-amber-400" /> : <Zap size={13} className="text-amber-400" />}
            <span>{llmTesting ? 'Testing Model Handshake...' : 'Test Connection'}</span>
          </button>

          {llmTestResult && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-sans">
              <CheckCircle2 size={14} />
              <span>{llmTestResult.message || `Connected in ${llmTestResult.latencyMs}ms!`}</span>
            </div>
          )}

          {llmError && (
            <div className="flex items-center gap-1.5 text-rose-400 text-xs font-sans">
              <AlertCircle size={14} />
              <span>{llmError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800 font-mono text-xs">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="px-4 py-2.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <button
          type="button"
          onClick={handleSaveLlmAndContinue}
          disabled={!llmApiKey.trim()}
          className="px-6 py-2.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-black transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-amber-600/20"
        >
          Save & Continue to Industry <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )}

  {/* STEP 3: CHOOSE INDUSTRY */}
  {step === 3 && (
<div className="space-y-6">
 <div className="text-center space-y-2">
 <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
 <Building2 size={14} /> STEP 3 OF 6 // TARGET SECTOR & INDUSTRY
 </div>
 <h1 className="text-2xl sm:text-3xl font-black text-white">
 What Industry Do You Specialize In?
 </h1>
 <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto">
 Selecting your industry primes our scraping engine and shifts your entire workspace color scheme to match your domain.
 </p>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
 {INDUSTRY_OPTIONS.map((ind) => {
 const Icon = ind.icon;
 const isSelected = profileData.industry === ind.id;
 const indTheme = getIndustryTheme(ind.id);

 return (
 <button
 key={ind.id}
 onClick={() => handleSelectIndustry(ind)}
 className={`p-4 rounded-sm border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer group ${
 isSelected 
 ? 'bg-slate-900 border-2 ' 
 : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:border-slate-700'
 }`}
 style={{
 borderColor: isSelected ? indTheme.accent : undefined,
 boxShadow: isSelected ? `0 0 20px ${indTheme.glow}` : undefined
 }}
 >
 <div className="flex items-center justify-between">
 <div 
 className="p-2.5 rounded-sm transition-colors"
 style={{
 backgroundColor: isSelected ? indTheme.badgeBg : 'rgba(15, 23, 42, 0.8)',
 color: indTheme.light
 }}
 >
 <Icon size={20} />
 </div>
 {isSelected && <Check size={18} style={{ color: indTheme.light }} />}
 </div>
 <div>
 <div className={`font-black text-sm ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
 {ind.name}
 </div>
 <div className="text-[10px] text-slate-400 mt-1 truncate">
 {ind.defaultTitles.slice(0, 2).join(', ')}
 </div>
 </div>
 </button>
 );
 })}
 </div>

 {/* Seniority Level Calibration */}
 <div className="space-y-2.5 pt-4 border-t border-slate-800 font-mono text-xs">
 <div className="flex items-center justify-between">
 <label className="text-slate-300 font-bold flex items-center gap-1.5">
 <Award size={14} className="text-amber-400" /> CAREER SENIORITY STAGE:
 </label>
 <span className="text-[10px] text-amber-400 font-bold">
 Active: {SENIORITY_OPTIONS.find(s => s.id === profileData.seniorityLevel)?.label || 'Senior'}
 </span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2">
 {SENIORITY_OPTIONS.map((sen) => {
 const isSelected = profileData.seniorityLevel === sen.id;
 return (
 <button
 key={sen.id}
 type="button"
 onClick={() => setProfileData(prev => ({ ...prev, seniorityLevel: sen.id }))}
 className={`p-2.5 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between ${
 isSelected
 ? 'bg-amber-950/90 border-amber-400 text-white '
 : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
 }`}
 >
 <div className="font-black text-xs">{sen.label}</div>
 <div className="text-[10px] text-slate-400 mt-0.5">{sen.exp}</div>
 </button>
 );
 })}
 </div>
 </div>

 {/* Hand-Holding Coach Guidance Box */}
 <div className="p-3.5 rounded-sm bg-amber-950/40 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200 font-mono">
 <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <div className="font-bold text-white text-[11px] uppercase tracking-wide">
 💡 Why This Matters: Targeted Query Calibration
 </div>
 <p className="text-[11px] text-slate-300 leading-relaxed">
 Selecting your industry and seniority primes our search engines (Seek, LinkedIn, Adzuna) to crawl roles matching your exact career tier. This eliminates entry-level noise and guarantees every job in your feed matches your compensation expectations.
 </p>
 </div>
 </div>

 <div className="flex items-center justify-between pt-4 border-t border-slate-800 font-mono text-xs">
 <button
 onClick={() => setStep(2)}
 className="px-4 py-2.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
 >
 <ArrowLeft size={14} /> Back
 </button>
 <button
 onClick={() => setStep(4)}
 className="px-6 py-2.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-black transition-colors cursor-pointer flex items-center gap-1.5"
 >
 Continue to Roles & Skills <ArrowRight size={14} />
 </button>
 </div>
 </div>
 )}

 {/* STEP 4: ROLES, SKILLS & RESUME */}
 {step === 4 && (
 <div className="space-y-6">
 <div className="text-center space-y-2">
 <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black industry-accent-badge">
 <Target size={14} /> STEP 4 OF 6 // TARGET ROLES & CORE SKILLS
 </div>
 <h1 className="text-2xl sm:text-3xl font-black text-white">
 Target Roles & Technical Skills
 </h1>
 <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto">
 Provide your target titles and domain tools. Upload your resume for 1-click automatic extraction.
 </p>
 </div>

 {/* Upload Dropzone */}
 <div className="border-2 border-dashed border-slate-700 hover:border-amber-400 rounded-sm p-5 text-center transition-all bg-slate-950/40 font-mono">
 <input
 type="file"
 id="onboard-resume-input"
 accept=".txt,.md,.rtf,.pdf"
 onChange={handleFileUpload}
 className="hidden"
 />
 <label
 htmlFor="onboard-resume-input"
 className="cursor-pointer flex flex-col items-center justify-center space-y-2"
 >
 <div className="p-3 bg-amber-600/20 text-amber-400 rounded-sm border border-amber-400/30">
 <Upload size={22} />
 </div>
 <div className="text-xs font-bold text-white">
 1-Click Auto-Fill: Drop Resume (.pdf, .txt, .md) or <span className="text-amber-400 underline">Browse</span>
 </div>
 <div className="text-[10px] text-slate-500">
 Automatically fills your titles, skills, and quantified career achievements
 </div>
 </label>
 </div>

 {parseSuccessMsg && (
 <div className="p-3 rounded-sm bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-mono flex items-center gap-2">
 <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
 <span>{parseSuccessMsg}</span>
 </div>
 )}

 {/* Target Job Titles Selector */}
 <div className="space-y-2 font-mono text-xs">
 <div className="flex items-center justify-between">
 <label className="text-slate-300 font-bold flex items-center gap-1.5">
 <Briefcase size={13} className="text-amber-400" /> TARGET JOB TITLES ({profileData.targetTitles.length}):
 </label>
 <span className="text-[10px] text-slate-500">Click to remove</span>
 </div>

 <div className="flex flex-wrap gap-1.5 p-3 rounded-sm bg-slate-950 border border-slate-800 min-h-[46px]">
 {profileData.targetTitles.map(t => (
 <span
 key={t}
 className="px-2.5 py-1 rounded-sm bg-amber-950 text-amber-200 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1.5 -xs"
 >
 {t}
 <button type="button" onClick={() => handleRemoveTitle(t)} className="hover:text-rose-400 cursor-pointer font-black">×</button>
 </span>
 ))}
 <div className="flex items-center gap-1">
 <input
 type="text"
 value={newTitleInput}
 onChange={(e) => setNewTitleInput(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTitle())}
 placeholder="+ Add custom title..."
 className="bg-transparent border-none text-[11px] text-slate-300 focus:outline-none px-2 py-0.5"
 />
 {newTitleInput && (
 <button type="button" onClick={() => handleAddTitle()} className="text-emerald-400 font-bold text-xs cursor-pointer">+</button>
 )}
 </div>
 </div>

 {/* Quick Industry Suggestions */}
 <div className="flex items-center gap-1.5 flex-wrap pt-1">
 <span className="text-[10px] text-slate-500 uppercase font-bold">SUGGESTED FOR {profileData.industry}:</span>
 {currentIndustryObj.defaultTitles.filter(t => !profileData.targetTitles.includes(t)).slice(0, 4).map(t => (
 <button
 key={t}
 type="button"
 onClick={() => handleAddTitle(t)}
 className="px-2 py-0.5 rounded-sm bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 hover:text-white transition-colors cursor-pointer font-bold"
 >
 + {t}
 </button>
 ))}
 </div>
 </div>

 {/* Core Skills Selector */}
 <div className="space-y-2 font-mono text-xs">
 <div className="flex items-center justify-between">
 <label className="text-slate-300 font-bold flex items-center gap-1.5">
 <Tag size={13} className="text-emerald-400" /> CORE SKILLS & DOMAIN TOOLS ({profileData.coreSkills.length}):
 </label>
 <span className="text-[10px] text-slate-500">Essential for ATS score match</span>
 </div>

 <div className="flex flex-wrap gap-1.5 p-3 rounded-sm bg-slate-950 border border-slate-800 min-h-[46px]">
 {profileData.coreSkills.map(skill => (
 <span
 key={skill}
 className="px-2.5 py-1 rounded-sm bg-emerald-950/80 text-emerald-200 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1.5 -xs"
 >
 {skill}
 <button type="button" onClick={() => handleRemoveSkill(skill)} className="hover:text-rose-400 cursor-pointer font-black">×</button>
 </span>
 ))}
 <div className="flex items-center gap-1">
 <input
 type="text"
 value={newSkillInput}
 onChange={(e) => setNewSkillInput(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
 placeholder="+ Add skill..."
 className="bg-transparent border-none text-[11px] text-slate-300 focus:outline-none px-2 py-0.5"
 />
 {newSkillInput && (
 <button type="button" onClick={() => handleAddSkill()} className="text-emerald-400 font-bold text-xs cursor-pointer">+</button>
 )}
 </div>
 </div>

 {/* Quick Industry Skill Suggestions */}
 <div className="flex items-center gap-1.5 flex-wrap pt-1">
 <span className="text-[10px] text-slate-500 uppercase font-bold">DOMAIN SKILLS:</span>
 {currentIndustryObj.defaultSkills.filter(s => !profileData.coreSkills.includes(s)).slice(0, 5).map(s => (
 <button
 key={s}
 type="button"
 onClick={() => handleAddSkill(s)}
 className="px-2 py-0.5 rounded-sm bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-emerald-400 hover:text-white transition-colors cursor-pointer font-bold"
 >
 + {s}
 </button>
 ))}
 </div>
 </div>

 {/* ATS Keyword Strength Bar */}
 <div className="p-3.5 rounded-sm bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
 <div className="flex items-center justify-between text-[11px]">
 <span className="text-slate-400 font-bold flex items-center gap-1.5">
 <Target size={13} className="text-amber-400" /> ATS KEYWORD DENSITY:
 </span>
 <span className={`font-black uppercase text-xs ${
 readinessAnalysis.atsDensity === 'Optimal' ? 'text-emerald-400' :
 readinessAnalysis.atsDensity === 'Good' ? 'text-amber-400' : 'text-rose-400'
 }`}>
 {readinessAnalysis.atsDensity} ({profileData.coreSkills.length} SKILLS)
 </span>
 </div>
 <div className="w-full h-1.5 bg-slate-900 rounded-sm overflow-hidden">
 <div
 className={`h-full transition-all duration-300 ${
 readinessAnalysis.atsDensity === 'Optimal' ? 'bg-emerald-500' :
 readinessAnalysis.atsDensity === 'Good' ? 'bg-amber-500' : 'bg-rose-500'
 }`}
 style={{ width: `${Math.min(100, (profileData.coreSkills.length / 8) * 100)}%` }}
 />
 </div>
 <div className="text-[10px] text-slate-400">
 {readinessAnalysis.atsDensity === 'Optimal'
 ? '✨ Optimal! High semantic coverage across modern ATS candidate screeners.'
 : readinessAnalysis.atsDensity === 'Good'
 ? '⚡ Good foundation. Add 2+ specialized tools or cloud certifications to unlock 90%+ match tiers.'
 : '⚠️ Warning: Add at least 4 core skills so the auto-scoring engine can match job descriptions.'}
 </div>
 </div>

 {/* Hand-Holding Coach Guidance Box */}
 <div className="p-3.5 rounded-sm bg-amber-950/40 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200 font-mono">
 <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <div className="font-bold text-white text-[11px] uppercase tracking-wide">
 💡 Why This Matters: ATS Screening & Recommendation Engine
 </div>
 <p className="text-[11px] text-slate-300 leading-relaxed">
 98% of tier-1 recruiters filter applicants using strict keyword matching algorithms. Our local scoring engine cross-references these tags against live job postings to surface roles where you are statistically in the top 10% of applicants.
 </p>
 </div>
 </div>

 {/* Paste Text Fallback */}
 <div className="space-y-1.5 font-mono text-xs pt-2 border-t border-slate-800">
 <div className="flex items-center justify-between text-slate-400">
 <span>OR PASTE WORK HISTORY / RESUME TEXT:</span>
 {resumeText && (
 <button
 type="button"
 onClick={() => handleParseResumeText()}
 disabled={isParsing}
 className="text-amber-400 hover:text-amber-300 font-black cursor-pointer flex items-center gap-1 text-[11px]"
 >
 {isParsing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
 <span>RE-ANALYZE WITH AI</span>
 </button>
 )}
 </div>
 <textarea
 rows={3}
 value={resumeText}
 onChange={(e) => setResumeText(e.target.value)}
 placeholder="Paste work experience, past positions, metrics (e.g. 99.9% uptime, 40% time savings)..."
 className="w-full p-3 rounded-sm bg-slate-950 border border-slate-800 text-slate-200 font-sans text-xs focus:border-amber-500 focus:outline-none"
 />
 </div>

 <div className="flex items-center justify-between pt-4 border-t border-slate-800 font-mono text-xs">
 <button
 onClick={() => setStep(3)}
 className="px-4 py-2.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
 >
 <ArrowLeft size={14} /> Back
 </button>
 <button
 onClick={() => setStep(5)}
 className="px-6 py-2.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-black transition-colors cursor-pointer flex items-center gap-1.5"
 >
 Continue to Location & Preferences <ArrowRight size={14} />
 </button>
 </div>
 </div>
 )}

 {/* STEP 5: LOCATION, WORK STYLE & COMPENSATION */}
 {step === 5 && (
 <div className="space-y-6 font-mono text-xs">
 <div className="text-center space-y-2">
 <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black industry-accent-badge">
 <MapPin size={14} /> STEP 5 OF 6 // LOCATION, WORK STYLE & COMPENSATION
 </div>
 <h1 className="text-2xl sm:text-3xl font-black text-white">
 Location & Work Style Preferences
 </h1>
 <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto">
 Configure your commute baseline and target pay to ensure roles meet your practical day-to-day requirements.
 </p>
 </div>

 {/* Work Mode Selection */}
 <div className="space-y-2">
 <label className="text-slate-300 font-bold flex items-center gap-1.5">
 <Sliders size={13} className="text-amber-400" /> PREFERRED WORK MODE:
 </label>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {WORK_MODE_OPTIONS.map(mode => (
 <button
 key={mode.id}
 type="button"
 onClick={() => setProfileData({ ...profileData, workMode: mode.id })}
 className={`p-3 rounded-sm border text-left transition-all cursor-pointer ${
 profileData.workMode === mode.id
 ? 'bg-amber-950/80 border-amber-500 text-white '
 : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
 }`}
 >
 <div className="font-bold text-xs">{mode.label}</div>
 <div className="text-[10px] text-slate-400 mt-0.5">{mode.desc}</div>
 </button>
 ))}
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
 {/* Location & Suburb */}
 <div className="space-y-1.5">
 <label className="text-emerald-400 font-bold flex items-center gap-1.5">
 <MapPin size={13} /> PRIMARY SUBURB / COMMUTE BASE
 </label>
 <input
 type="text"
 value={profileData.location}
 onChange={(e) => {
 const loc = e.target.value;
 const sub = loc.split(',')[0].replace(/(VIC|NSW|QLD|WA|SA|TAS|ACT|NT|\d+)/gi, '').trim();
 setProfileData({ ...profileData, location: loc, suburb: sub || 'Melbourne' });
 }}
 placeholder="e.g. Balaclava VIC 3183"
 className="w-full p-3 rounded-sm bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold focus:border-emerald-400 focus:outline-none"
 />
 </div>

 {/* Salary Target */}
 <div className="space-y-1.5">
 <label className="text-emerald-400 font-bold flex items-center gap-1.5">
 <DollarSign size={13} /> TARGET COMPENSATION / SALARY
 </label>
 <input
 type="text"
 value={profileData.targetSalary}
 onChange={(e) => setProfileData({ ...profileData, targetSalary: e.target.value })}
 placeholder="e.g. $125,000 + Super"
 className="w-full p-3 rounded-sm bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold focus:border-emerald-400 focus:outline-none"
 />
 </div>
 </div>

 {/* Quick Suburb Presets */}
 <div className="space-y-2">
 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
 QUICK BASELINE PRESETS:
 </div>
 <div className="flex flex-wrap gap-1.5">
 {PRESET_SUBURBS.map(sub => (
 <button
 key={sub}
 type="button"
 onClick={() => {
 const cleanSub = sub.split(' ')[0];
 setProfileData(prev => ({ ...prev, location: sub, suburb: cleanSub }));
 }}
 className={`px-2.5 py-1 rounded-sm text-[11px] font-bold border transition-colors cursor-pointer ${
 profileData.location === sub
 ? 'bg-emerald-600 text-white border-emerald-400'
 : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
 }`}
 >
 {sub.split(' ')[0]}
 </button>
 ))}
 </div>
 </div>

 {/* Work Rights & Security Clearance */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
 <div className="space-y-1.5">
 <label className="text-slate-300 font-bold flex items-center gap-1.5">
 <ShieldCheck size={13} className="text-amber-400" /> WORK RIGHTS / CITIZENSHIP
 </label>
 <select
 value={profileData.workRights}
 onChange={(e) => setProfileData({ ...profileData, workRights: e.target.value })}
 className="w-full p-3 rounded-sm bg-slate-950 border border-slate-800 text-slate-200 focus:border-amber-500 focus:outline-none"
 >
 {WORK_RIGHTS_OPTIONS.map(opt => (
 <option key={opt} value={opt}>{opt}</option>
 ))}
 </select>
 </div>

 <div className="space-y-1.5">
 <label className="text-slate-300 font-bold flex items-center gap-1.5">
 <Award size={13} className="text-amber-400" /> SECURITY CLEARANCE / CHECKS
 </label>
 <select
 value={profileData.clearance}
 onChange={(e) => setProfileData({ ...profileData, clearance: e.target.value })}
 className="w-full p-3 rounded-sm bg-slate-950 border border-slate-800 text-slate-200 focus:border-amber-500 focus:outline-none"
 >
 {CLEARANCE_OPTIONS.map(opt => (
 <option key={opt} value={opt}>{opt}</option>
 ))}
 </select>
 </div>
 </div>

 {/* Hand-Holding Coach Guidance Box */}
 <div className="p-3.5 rounded-sm bg-amber-950/40 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200 font-mono">
 <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <div className="font-bold text-white text-[11px] uppercase tracking-wide">
 💡 Why This Matters: Commute Distance & Lifestyle Boundaries
 </div>
 <p className="text-[11px] text-slate-300 leading-relaxed">
 Our platform computes door-to-door transit times and distance from your home base. Establishing your commute baseline and target pay ensures our Auto-Pilot filters out unsustainable commutes and roles that don't meet your salary floor.
 </p>
 </div>
 </div>

 <div className="flex items-center justify-between pt-4 border-t border-slate-800 font-mono text-xs">
 <button
 onClick={() => setStep(4)}
 className="px-4 py-2.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
 >
 <ArrowLeft size={14} /> Back
 </button>
 <button
 onClick={() => setStep(6)}
 className="px-6 py-2.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-black transition-colors cursor-pointer flex items-center gap-1.5"
 >
 Review Bespoke Blueprint <ArrowRight size={14} />
 </button>
 </div>
 </div>
 )}

 {/* STEP 6: REVIEW & LAUNCH */}
 {step === 6 && (
 <div className="space-y-6">
 <div className="text-center space-y-2">
 <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
 <CheckCircle2 size={14} /> STEP 6 OF 6 // BESPOKE BLUEPRINT READY
 </div>
 <h1 className="text-2xl sm:text-3xl font-black text-white">
 Your Bespoke Candidate Matrix is Configured!
 </h1>
 <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto">
 Every job match score, commute radius, and auto-generated application is now calibrated specifically to your career goals.
 </p>
 </div>

 {/* Bespoke Blueprint Summary Card */}
 <div className="p-6 rounded-sm bg-slate-950 border-2 border-amber-500/50 space-y-5 font-mono text-xs industry-glow-">
 <div className="flex items-center justify-between flex-wrap gap-3">
 <div className="flex items-center gap-3">
 <div className="w-14 h-14 rounded-sm bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-black text-xl flex items-center justify-center border border-amber-400/40">
 {profileData.name?.[0] || 'C'}
 </div>
 <div>
 <div className="text-lg font-black text-white">{profileData.name || 'Candidate'}</div>
 <div className="text-xs text-amber-400 font-bold">{profileData.title || profileData.targetTitles[0]}</div>
 <div className="text-[10px] text-slate-400">{profileData.email}</div>
 </div>
 </div>
 <div className="text-right">
 <span className="px-3.5 py-1.5 rounded-sm bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold text-xs inline-flex items-center gap-1.5 -xs">
 <Sparkles size={13} className="text-amber-400" />
 {readinessScore}% BESPOKE FIT
 </span>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-slate-800 text-[11px] text-slate-300">
 <div className="p-2.5 rounded-sm bg-slate-900/80 border border-slate-800">
 <div className="text-[9px] text-slate-500 uppercase font-bold">AI ENGINE</div>
 <div className="font-bold text-amber-400 truncate mt-0.5">{PROVIDERS[llmProvider]?.name || 'Configured'} ({llmModel.split('/').pop()})</div>
 </div>
 <div className="p-2.5 rounded-sm bg-slate-900/80 border border-slate-800">
 <div className="text-[9px] text-slate-500 uppercase font-bold">INDUSTRY</div>
 <div className="font-bold text-white truncate mt-0.5">{profileData.industry}</div>
 </div>
 <div className="p-2.5 rounded-sm bg-slate-900/80 border border-slate-800">
 <div className="text-[9px] text-slate-500 uppercase font-bold">COMMUTE BASE</div>
 <div className="font-bold text-white truncate mt-0.5">{profileData.location}</div>
 </div>
 <div className="p-2.5 rounded-sm bg-slate-900/80 border border-slate-800">
 <div className="text-[9px] text-slate-500 uppercase font-bold">WORK STYLE</div>
 <div className="font-bold text-white truncate mt-0.5">{profileData.workMode}</div>
 </div>
 <div className="p-2.5 rounded-sm bg-slate-900/80 border border-slate-800">
 <div className="text-[9px] text-slate-500 uppercase font-bold">TARGET PAY</div>
 <div className="font-bold text-white truncate mt-0.5">{profileData.targetSalary}</div>
 </div>
 </div>

 {/* Target Titles & Skills */}
 <div className="space-y-3 pt-2">
 <div>
 <div className="text-[10px] text-slate-400 uppercase font-bold mb-1.5">ACTIVE SEARCH QUERIES:</div>
 <div className="flex flex-wrap gap-1.5">
 {profileData.targetTitles.map(t => (
 <span key={t} className="px-2.5 py-1 rounded-sm bg-amber-950/90 text-amber-200 border border-amber-500/40 text-[11px] font-bold">
 🎯 {t}
 </span>
 ))}
 </div>
 </div>

 <div>
 <div className="text-[10px] text-slate-400 uppercase font-bold mb-1.5">TOP MATCHED SKILLS ({profileData.coreSkills.length}):</div>
 <div className="flex flex-wrap gap-1.5">
 {profileData.coreSkills.slice(0, 10).map(s => (
 <span key={s} className="px-2.5 py-0.5 rounded-sm bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
 {s}
 </span>
 ))}
 </div>
 </div>
 </div>
 </div>

 {/* Readiness Optimization Tips if not 100% */}
 {readinessAnalysis.missingItems.length > 0 && (
 <div className="p-3.5 rounded-sm bg-amber-950/30 border border-amber-500/40 text-xs font-mono space-y-2">
 <div className="text-amber-300 font-bold flex items-center gap-1.5 text-[11px]">
 <Sparkles size={13} className="text-amber-400" /> RECOMMENDED ACTIONS TO REACH 100% CANDIDATE POWER:
 </div>
 <ul className="text-slate-300 text-[11px] space-y-1 pl-4 list-disc">
 {readinessAnalysis.missingItems.map((tip, idx) => (
 <li key={idx}>{tip}</li>
 ))}
 </ul>
 </div>
 )}

 {/* Launch & Back Action Buttons */}
 <div className="space-y-3">
 <button
 onClick={handleFinalSubmit}
 disabled={isLaunching}
 className="w-full py-4 px-6 rounded-sm bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-mono font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-75"
 >
 {isLaunching ? (
 <RefreshCw size={18} className="animate-spin text-white" />
 ) : (
 <Zap size={20} className="animate-bounce text-amber-300" />
 )}
 <span>{isLaunching ? (launchMessage || 'CALIBRATING PROFILE & SCRAPERS...') : '⚡ LAUNCH MY BESPOKE JOB MATRIX'}</span>
 </button>

 <div className="text-center">
 <button
 type="button"
 onClick={() => setStep(5)}
 disabled={isLaunching}
 className="text-slate-400 hover:text-white font-mono text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
 >
 ← Back to edit preferences
 </button>
 </div>
 </div>
 </div>
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

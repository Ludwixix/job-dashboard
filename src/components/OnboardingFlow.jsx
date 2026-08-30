import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, ShieldCheck, User, Mail, Lock, Briefcase, MapPin, 
  DollarSign, Upload, FileText, CheckCircle2, ArrowRight, ArrowLeft, 
  Zap, Building2, Tag, RefreshCw, AlertCircle, Plus, X, HeartPulse, 
  TrendingUp, Megaphone, HardHat, Users, Scale, Server, GraduationCap, Check,
  ShoppingBag, Truck, Palette, Compass, Key, Sliders, Award, Target, HelpCircle, Info, ChevronRight
} from 'lucide-react';
import { loginWithEmail, registerWithEmail, completeOnboarding, loginWithDemoPersona } from '../services/authService';
import { parseResumeWithAI, parseResumeTextClientSide, DEFAULT_PROFILES } from '../services/profileService';
import { loginWithBrowserPasskey, isPasskeySupported, storeBrowserCredentials } from '../services/passkeyService';
import { loginWithGoogle } from '../services/googleAuthService';
import { applyIndustryTheme, getIndustryTheme } from '../services/industryThemeService';

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

export const OnboardingFlow = ({ onComplete }) => {
  const [step, setStep] = useState(1); // 1: Auth, 2: Industry, 3: Roles & Skills, 4: Location & Work Style, 5: Review & Launch
  const [authMode, setAuthMode] = useState('login'); // 'login', 'signup'
  
  // Step 1 Auth state
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Step 2-4 Profile Builder state
  const [profileData, setProfileData] = useState({
    id: `profile_${Date.now()}`,
    name: '',
    email: '',
    phone: '0400 000 000',
    title: '',
    industry: 'Technology & IT',
    location: 'Balaclava VIC 3183',
    suburb: 'Balaclava',
    workMode: 'Any / Flexible',
    targetSalary: '$120,000 + Super',
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: 'Citizen / Standard Police Check',
    targetTitles: ['Senior Systems Engineer', 'Cloud Infrastructure Engineer', 'M365 Engineer'],
    coreSkills: ['Microsoft 365', 'Azure', 'PowerShell', 'Active Directory'],
    certifications: [],
    workHistorySummary: '',
    fullWorkExperienceText: ''
  });

  // Step 3 Resume Parsing state
  const [resumeText, setResumeText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseSuccessMsg, setParseSuccessMsg] = useState('');
  const [newTitleInput, setNewTitleInput] = useState('');
  const [newSkillInput, setNewSkillInput] = useState('');

  // Live active industry theme styling
  const activeIndustryTheme = useMemo(() => {
    return getIndustryTheme(profileData.industry);
  }, [profileData.industry]);

  useEffect(() => {
    applyIndustryTheme(profileData.industry);
  }, [profileData.industry]);

  // Bespoke Setup Readiness Score (0 to 100%)
  const readinessScore = useMemo(() => {
    let score = 0;
    if (profileData.name) score += 15;
    if (profileData.email) score += 10;
    if (profileData.industry) score += 15;
    if (profileData.targetTitles?.length >= 2) score += 20;
    if (profileData.coreSkills?.length >= 4) score += 20;
    if (profileData.location) score += 10;
    if (profileData.targetSalary) score += 10;
    return Math.min(100, score);
  }, [profileData]);

  // STEP 1: AUTH HANDLERS
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
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

      setProfileData(prev => ({
        ...prev,
        name: sessionUser.name || prev.name,
        email: sessionUser.email || prev.email
      }));

      // If returning user already completed onboarding, finish immediately
      if (sessionUser.onboardingCompleted) {
        if (onComplete) onComplete(sessionUser);
        return;
      }

      setStep(2);
    } catch (err) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const [googleSyncStatus, setGoogleSyncStatus] = useState('');

  const handleGoogleLogin = async () => {
    setAuthError('');
    setAuthLoading(true);
    setGoogleSyncStatus('Connecting with Google Identity...');
    try {
      const result = await loginWithGoogle({
        autoScanGmail: true,
        onStatusUpdate: (status) => setGoogleSyncStatus(status)
      });
      
      setProfileData(prev => ({
        ...prev,
        name: result.user.name || prev.name,
        email: result.user.email || prev.email
      }));

      if (onComplete) {
        onComplete(result.session, result.profile);
      } else {
        setStep(2);
      }
    } catch (err) {
      setAuthError(err.message || 'Google Sign-In failed.');
    } finally {
      setAuthLoading(false);
      setGoogleSyncStatus('');
    }
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

  // STEP 2: INDUSTRY SELECTION
  const handleSelectIndustry = (ind) => {
    setProfileData(prev => ({
      ...prev,
      industry: ind.id,
      targetTitles: [...ind.defaultTitles.slice(0, 3)],
      coreSkills: [...new Set([...prev.coreSkills, ...ind.defaultSkills.slice(0, 5)])],
      title: ind.defaultTitles[0] || prev.title
    }));
    setStep(3);
  };

  // STEP 3: RESUME UPLOAD & PARSING
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result || '';
      setResumeText(text);
      handleParseResumeText(text);
    };
    reader.readAsText(file);
  };

  const handleParseResumeText = async (textToParse = resumeText) => {
    if (!textToParse.trim()) return;

    setIsParsing(true);
    setParseSuccessMsg('');
    try {
      const apiKey = getActiveApiKey();
      const model = getActiveModel();
      const parsed = await parseResumeWithAI(textToParse, apiKey, model);

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
          fullWorkExperienceText: parsed.fullWorkExperienceText || textToParse
        }));
        setParseSuccessMsg('✨ AI Resume Successfully Extracted! Your titles, skills and metrics are loaded.');
      }
    } catch {
      const clientParsed = parseResumeTextClientSide(textToParse);
      setProfileData(prev => ({ ...prev, ...clientParsed, fullWorkExperienceText: textToParse }));
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

  // FINAL COMPLETION
  const handleFinalSubmit = () => {
    const { session, profile } = completeOnboarding(profileData);
    if (onComplete) onComplete(session, profile);
  };

  const currentIndustryObj = useMemo(() => {
    return INDUSTRY_OPTIONS.find(i => i.id === profileData.industry) || INDUSTRY_OPTIONS[0];
  }, [profileData.industry]);

  return (
    <div className="min-h-screen bg-slate-950 industry-ambient-bg text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Top Guided Header */}
      <header className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 border-b border-slate-800/80 font-mono gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg border border-indigo-400/30">
            <Zap size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-black tracking-widest text-white uppercase flex items-center gap-2">
              JOB SEEKER MATRIX // SETUP
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                {readinessScore}% BESPOKE
              </span>
            </div>
            <div className="text-[10px] text-slate-400">HAND-IN-HAND BESPOKE MATCHING & APPLICATION ONBOARDING</div>
          </div>
        </div>

        {/* Step Indicators with labels */}
        <div className="flex items-center gap-1.5 text-xs font-bold w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { num: 1, label: 'Identity' },
            { num: 2, label: 'Industry' },
            { num: 3, label: 'Skills & Experience' },
            { num: 4, label: 'Location & Work' },
            { num: 5, label: 'Launch' }
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => step > s.num && setStep(s.num)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono transition-all ${
                step > s.num ? 'cursor-pointer hover:bg-slate-800' : ''
              } ${
                step === s.num
                  ? 'bg-indigo-600 text-white font-black shadow-md border border-indigo-400'
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
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 animate-in fade-in zoom-in-95 duration-200">
          
          {/* STEP 1: AUTHENTICATION / ACCESS */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <ShieldCheck size={14} /> STEP 1 OF 5 // YOUR CANDIDATE IDENTITY
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
                      <User size={13} className="text-indigo-400" /> FULL NAME
                    </label>
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="e.g. Sam Ludwig"
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none placeholder-slate-600 font-sans text-sm"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Mail size={13} className="text-indigo-400" /> EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="e.g. user@gmail.com"
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none placeholder-slate-600 font-sans text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Lock size={13} className="text-indigo-400" /> PASSWORD
                  </label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none placeholder-slate-600 font-sans text-sm"
                  />
                </div>

                {authError && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="text-rose-400 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {googleSyncStatus && (
                  <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 text-xs flex items-center gap-2 animate-pulse">
                    <RefreshCw size={14} className="animate-spin text-indigo-400 shrink-0" />
                    <span>{googleSyncStatus}</span>
                  </div>
                )}

                {/* 1-Click Google Sign In with Auto Gmail Scan */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-black text-xs shadow-xl border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50 relative overflow-hidden group"
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
                  className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {authLoading ? <RefreshCw size={16} className="animate-spin text-indigo-200" /> : <ArrowRight size={16} />}
                  <span>{authMode === 'signup' ? 'CREATE ACCOUNT & START SETUP' : 'SIGN IN & CONTINUE'}</span>
                </button>

                {/* Passkey / Stored Browser Creds Button */}
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={authLoading}
                  className="w-full py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-emerald-500/50 text-emerald-300 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                  title="Authenticate using stored browser password manager, Touch ID, Face ID, Windows Hello, or Passkey"
                >
                  <Key size={14} className="text-emerald-400" />
                  <span>🔑 SIGN IN WITH PASSKEY / BROWSER CREDS</span>
                </button>

                <div className="text-center pt-1 text-slate-400 text-xs">
                  {authMode === 'login' ? (
                    <span>
                      Don't have an account?{' '}
                      <button type="button" onClick={() => setAuthMode('signup')} className="text-indigo-400 hover:underline font-bold cursor-pointer">
                        Sign Up Free
                      </button>
                    </span>
                  ) : (
                    <span>
                      Already have an account?{' '}
                      <button type="button" onClick={() => setAuthMode('login')} className="text-indigo-400 hover:underline font-bold cursor-pointer">
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
                      className="w-full sm:max-w-md p-3.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-indigo-500/40 hover:border-indigo-400 transition-all text-left flex items-center gap-3 cursor-pointer group shadow-md"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-300 font-black text-sm flex items-center justify-center shrink-0 border border-indigo-400/50 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        SL
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-white text-sm group-hover:text-indigo-300 flex items-center gap-1.5">
                          {preset.name}
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40 font-mono">ORIGINAL PROFILE</span>
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

          {/* STEP 2: CHOOSE INDUSTRY */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <Building2 size={14} /> STEP 2 OF 5 // TARGET SECTOR & INDUSTRY
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
                      className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer group ${
                        isSelected 
                          ? 'bg-slate-900 border-2 shadow-xl' 
                          : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                      style={{
                        borderColor: isSelected ? indTheme.accent : undefined,
                        boxShadow: isSelected ? `0 0 20px ${indTheme.glow}` : undefined
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="p-2.5 rounded-xl transition-colors"
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

              <div className="flex items-center justify-between pt-4 border-t border-slate-800 font-mono text-xs">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  Continue to Roles & Skills <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: ROLES, SKILLS & RESUME */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black industry-accent-badge">
                  <Target size={14} /> STEP 3 OF 5 // TARGET ROLES & CORE SKILLS
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  Target Roles & Technical Skills
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto">
                  Provide your target titles and domain tools. Upload your resume for 1-click automatic extraction.
                </p>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-700 hover:border-indigo-400 rounded-2xl p-5 text-center transition-all bg-slate-950/40 font-mono">
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
                  <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-400/30">
                    <Upload size={22} />
                  </div>
                  <div className="text-xs font-bold text-white">
                    1-Click Auto-Fill: Drop Resume (.pdf, .txt, .md) or <span className="text-indigo-400 underline">Browse</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Automatically fills your titles, skills, and quantified career achievements
                  </div>
                </label>
              </div>

              {parseSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>{parseSuccessMsg}</span>
                </div>
              )}

              {/* Target Job Titles Selector */}
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Briefcase size={13} className="text-indigo-400" /> TARGET JOB TITLES ({profileData.targetTitles.length}):
                  </label>
                  <span className="text-[10px] text-slate-500">Click to remove</span>
                </div>

                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 min-h-[46px]">
                  {profileData.targetTitles.map(t => (
                    <span
                      key={t}
                      className="px-2.5 py-1 rounded-xl bg-indigo-950 text-indigo-200 border border-indigo-500/40 text-[11px] font-bold flex items-center gap-1.5 shadow-xs"
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
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 hover:text-white transition-colors cursor-pointer font-bold"
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

                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 min-h-[46px]">
                  {profileData.coreSkills.map(skill => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-xl bg-emerald-950/80 text-emerald-200 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1.5 shadow-xs"
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
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-emerald-400 hover:text-white transition-colors cursor-pointer font-bold"
                    >
                      + {s}
                    </button>
                  ))}
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
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-sans text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800 font-mono text-xs">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  Continue to Location & Preferences <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: LOCATION, WORK STYLE & COMPENSATION */}
          {step === 4 && (
            <div className="space-y-6 font-mono text-xs">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black industry-accent-badge">
                  <MapPin size={14} /> STEP 4 OF 5 // LOCATION, WORK STYLE & COMPENSATION
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
                  <Sliders size={13} className="text-indigo-400" /> PREFERRED WORK MODE:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {WORK_MODE_OPTIONS.map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setProfileData({ ...profileData, workMode: mode.id })}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        profileData.workMode === mode.id
                          ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-md'
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
                    className="w-full p-3 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold focus:border-emerald-400 focus:outline-none"
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
                    className="w-full p-3 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold focus:border-emerald-400 focus:outline-none"
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
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
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
                    <ShieldCheck size={13} className="text-indigo-400" /> WORK RIGHTS / CITIZENSHIP
                  </label>
                  <select
                    value={profileData.workRights}
                    onChange={(e) => setProfileData({ ...profileData, workRights: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {WORK_RIGHTS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Award size={13} className="text-indigo-400" /> SECURITY CLEARANCE / CHECKS
                  </label>
                  <select
                    value={profileData.clearance}
                    onChange={(e) => setProfileData({ ...profileData, clearance: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {CLEARANCE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800 font-mono text-xs">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={() => setStep(5)}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  Review Bespoke Blueprint <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & LAUNCH */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 size={14} /> STEP 5 OF 5 // BESPOKE BLUEPRINT READY
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  Your Bespoke Candidate Matrix is Configured!
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto">
                  Every job match score, commute radius, and auto-generated application is now calibrated specifically to your career goals.
                </p>
              </div>

              {/* Bespoke Blueprint Summary Card */}
              <div className="p-6 rounded-3xl bg-slate-950 border-2 border-indigo-500/50 space-y-5 font-mono text-xs shadow-2xl industry-glow-shadow">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-black text-xl flex items-center justify-center shadow-lg border border-indigo-400/40">
                      {profileData.name?.[0] || 'C'}
                    </div>
                    <div>
                      <div className="text-lg font-black text-white">{profileData.name || 'Candidate'}</div>
                      <div className="text-xs text-indigo-400 font-bold">{profileData.title || profileData.targetTitles[0]}</div>
                      <div className="text-[10px] text-slate-400">{profileData.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-3.5 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold text-xs inline-flex items-center gap-1.5 shadow-xs">
                      <Sparkles size={13} className="text-amber-400" />
                      {readinessScore}% BESPOKE FIT
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-[11px] text-slate-300">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">INDUSTRY</div>
                    <div className="font-bold text-white truncate mt-0.5">{profileData.industry}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">COMMUTE BASE</div>
                    <div className="font-bold text-white truncate mt-0.5">{profileData.location}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">WORK STYLE</div>
                    <div className="font-bold text-white truncate mt-0.5">{profileData.workMode}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
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
                        <span key={t} className="px-2.5 py-1 rounded-lg bg-indigo-950/90 text-indigo-200 border border-indigo-500/40 text-[11px] font-bold">
                          🎯 {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1.5">TOP MATCHED SKILLS ({profileData.coreSkills.length}):</div>
                    <div className="flex flex-wrap gap-1.5">
                      {profileData.coreSkills.slice(0, 10).map(s => (
                        <span key={s} className="px-2.5 py-0.5 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Launch & Back Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleFinalSubmit}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-mono font-black text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2.5"
                >
                  <Zap size={20} className="animate-bounce text-amber-300" />
                  <span>⚡ LAUNCH MY BESPOKE JOB MATRIX</span>
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="text-slate-400 hover:text-white font-mono text-xs font-bold transition-colors cursor-pointer"
                  >
                    ← Back to edit preferences
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="text-center font-mono text-[11px] text-slate-500 py-4">
        Autonomous Job Seeker Matrix • Hand-in-Hand Bespoke Candidate Matching Platform
      </footer>
    </div>
  );
};

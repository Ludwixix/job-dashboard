import React, { useState } from 'react';
import { 
  Sparkles, ShieldCheck, User, Mail, Lock, Briefcase, MapPin, 
  DollarSign, Upload, FileText, CheckCircle2, ArrowRight, ArrowLeft, 
  Zap, Building2, Tag, RefreshCw, AlertCircle, Plus, X, HeartPulse, 
  TrendingUp, Megaphone, HardHat, Users, Scale, Server, GraduationCap, Check
} from 'lucide-react';
import { loginWithEmail, registerWithEmail, completeOnboarding, loginWithDemoPersona } from '../services/authService';
import { parseResumeWithAI, parseResumeTextClientSide, DEFAULT_PROFILES } from '../services/profileService';
import { getActiveApiKey, getActiveModel } from '../services/generationService';

const INDUSTRY_OPTIONS = [
  { id: 'Healthcare & Medical', name: 'Healthcare & Medical', icon: HeartPulse, color: 'from-rose-500/20 to-pink-500/10 border-rose-500/40 text-rose-300', defaultTitles: ['Clinical Nurse Specialist', 'Associate Nurse Unit Manager', 'Registered Nurse', 'Physiotherapist'] },
  { id: 'Finance & Accounting', name: 'Finance, Banking & Accounting', icon: TrendingUp, color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/40 text-emerald-300', defaultTitles: ['Senior Financial Analyst', 'FP&A Manager', 'Management Accountant', 'Credit Risk Analyst'] },
  { id: 'Marketing & Sales', name: 'Sales, Marketing & Growth', icon: Megaphone, color: 'from-amber-500/20 to-orange-500/10 border-amber-500/40 text-amber-300', defaultTitles: ['Digital Marketing Manager', 'Growth Lead', 'Account Executive', 'Brand Strategist'] },
  { id: 'Construction & Trades', name: 'Construction, Trades & Engineering', icon: HardHat, color: 'from-orange-500/20 to-yellow-500/10 border-orange-500/40 text-orange-300', defaultTitles: ['Construction Project Manager', 'Site Engineer', 'Licensed Electrician', 'Civil Project Engineer'] },
  { id: 'HR & Operations', name: 'Human Resources & People Ops', icon: Users, color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/40 text-purple-300', defaultTitles: ['People & Culture Manager', 'HR Business Partner', 'Talent Acquisition Lead', 'Operations Specialist'] },
  { id: 'Legal & Governance', name: 'Legal, Compliance & Governance', icon: Scale, color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/40 text-blue-300', defaultTitles: ['Senior Legal Counsel', 'Corporate Lawyer', 'Compliance Manager', 'Contracts Specialist'] },
  { id: 'Technology & IT', name: 'Technology, Cloud & Software', icon: Server, color: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/40 text-cyan-300', defaultTitles: ['Senior Systems Engineer', 'Full Stack Developer', 'Cloud / DevOps Engineer', 'Data Analyst'] },
  { id: 'Education & Training', name: 'Education & Training', icon: GraduationCap, color: 'from-indigo-500/20 to-purple-500/10 border-indigo-500/40 text-indigo-300', defaultTitles: ['Learning & Development Specialist', 'Academic Coordinator', 'Instructional Designer', 'Senior Educator'] },
  { id: 'General & Professional', name: 'General Professional / Other', icon: Briefcase, color: 'from-slate-500/20 to-slate-500/10 border-slate-500/40 text-slate-300', defaultTitles: ['Project Coordinator', 'Executive Assistant', 'Operations Analyst', 'Customer Success Manager'] }
];

const PRESET_SUBURBS = [
  'Melbourne CBD VIC 3000', 'Richmond VIC 3121', 'Balaclava VIC 3183',
  'Parkville VIC 3052', 'South Yarra VIC 3141', 'Hawthorn VIC 3122',
  'Docklands VIC 3008', 'St Kilda VIC 3182', 'Carlton VIC 3053'
];

export const OnboardingFlow = ({ onComplete }) => {
  const [step, setStep] = useState(1); // 1: Auth, 2: Industry, 3: Resume/Skills, 4: Location/Salary, 5: Launch
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
    location: 'Melbourne CBD, VIC 3000',
    suburb: 'Melbourne CBD',
    targetSalary: '$120,000 + Super',
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: 'Citizen / Standard',
    targetTitles: ['Senior Systems Engineer', 'Cloud Infrastructure Engineer'],
    coreSkills: ['Microsoft 365', 'Azure', 'PowerShell', 'Active Directory'],
    certifications: [],
    workHistorySummary: '',
    fullWorkExperienceText: ''
  });

  // Step 3 Resume Parsing state
  const [resumeText, setResumeText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [newTitleInput, setNewTitleInput] = useState('');
  const [newSkillInput, setNewSkillInput] = useState('');

  // STEP 1: AUTH HANDLERS
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      let sessionUser;
      if (authMode === 'signup') {
        sessionUser = await registerWithEmail(authName, authEmail, authPassword);
      } else {
        sessionUser = await loginWithEmail(authEmail, authPassword);
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

  const handleSelectDemoPersona = (presetId) => {
    const { session, profile } = loginWithDemoPersona(presetId);
    if (onComplete) onComplete(session, profile);
  };

  // STEP 2: INDUSTRY SELECTION
  const handleSelectIndustry = (ind) => {
    setProfileData(prev => ({
      ...prev,
      industry: ind.id,
      targetTitles: [...ind.defaultTitles],
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
      }
    } catch {
      const clientParsed = parseResumeTextClientSide(textToParse);
      setProfileData(prev => ({ ...prev, ...clientParsed, fullWorkExperienceText: textToParse }));
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddSkill = () => {
    if (newSkillInput.trim() && !profileData.coreSkills.includes(newSkillInput.trim())) {
      setProfileData(prev => ({ ...prev, coreSkills: [...prev.coreSkills, newSkillInput.trim()] }));
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (skill) => {
    setProfileData(prev => ({ ...prev, coreSkills: prev.coreSkills.filter(s => s !== skill) }));
  };

  const handleAddTitle = () => {
    if (newTitleInput.trim() && !profileData.targetTitles.includes(newTitleInput.trim())) {
      setProfileData(prev => ({ ...prev, targetTitles: [...prev.targetTitles, newTitleInput.trim()] }));
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800/80 font-mono">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-lg border border-indigo-400/30">
            <Zap size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-black tracking-widest text-white uppercase">AUTONOMOUS JOB SEEKER MATRIX</div>
            <div className="text-[10px] text-slate-400">V2.0 MULTI-INDUSTRY ONBOARDING & PROFILE ENGINE</div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-bold">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                step === s
                  ? 'bg-indigo-600 text-white font-black shadow-md border border-indigo-400'
                  : step > s
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-600 border border-slate-800'
              }`}
            >
              {step > s ? '✓' : s}
            </div>
          ))}
        </div>
      </header>

      {/* Main Wizard Container */}
      <main className="max-w-3xl mx-auto w-full my-auto py-8">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 animate-in fade-in zoom-in-95 duration-200">
          
          {/* STEP 1: AUTHENTICATION / ACCESS */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <ShieldCheck size={14} /> STEP 1 OF 5 // SIGN IN & IDENTITY
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  Welcome to Job Seeker Matrix
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
                  Sign in or create your candidate account to personalize live match scores, tailored resumes, and direct employer submissions.
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
                      placeholder="e.g. Emma Watson"
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

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {authLoading ? <RefreshCw size={16} className="animate-spin text-indigo-200" /> : <ArrowRight size={16} />}
                  <span>{authMode === 'signup' ? 'CREATE ACCOUNT & CONTINUE' : 'SIGN IN & BUILD PROFILE'}</span>
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

              {/* 1-Click Demo Personas Selector */}
              <div className="pt-6 border-t border-slate-800 space-y-3 font-mono">
                <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  ⚡ OR QUICK-TEST WITH A PRE-CONFIGURED INDUSTRY PERSONA:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {DEFAULT_PROFILES.slice(0, 6).map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectDemoPersona(preset.id)}
                      className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 transition-all text-left flex items-start gap-2.5 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-300 font-black text-xs flex items-center justify-center shrink-0 border border-indigo-400/30 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {preset.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white text-xs truncate group-hover:text-indigo-300">{preset.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{preset.title.split('&')[0]}</div>
                      </div>
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
                  <Building2 size={14} /> STEP 2 OF 5 // INDUSTRY & FIELD
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  Select Your Target Industry
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
                  What industry sector are you looking for roles in?
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {INDUSTRY_OPTIONS.map((ind) => {
                  const Icon = ind.icon;
                  const isSelected = profileData.industry === ind.id;

                  return (
                    <button
                      key={ind.id}
                      onClick={() => handleSelectIndustry(ind)}
                      className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer group ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-xl' 
                          : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-900 text-indigo-400 border border-slate-800'}`}>
                          <Icon size={20} />
                        </div>
                        {isSelected && <Check size={16} className="text-white" />}
                      </div>
                      <div>
                        <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                          {ind.name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
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
                  Continue <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: RESUME UPLOAD & AI PARSE */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <Upload size={14} /> STEP 3 OF 5 // RESUME & SKILLS
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  Add Your Resume or Experience
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
                  Upload your resume or paste your work history for automatic 1-click AI skill extraction and ATS matching.
                </p>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-700 hover:border-indigo-400 rounded-2xl p-6 text-center transition-all bg-slate-950/40 font-mono">
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
                    <Upload size={24} />
                  </div>
                  <div className="text-xs font-bold text-white">
                    Drop Resume (.pdf, .txt, .md, .rtf) or <span className="text-indigo-400 underline">Browse File</span>
                  </div>
                </label>
              </div>

              {/* Or Paste Text Area */}
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span>OR PASTE RESUME / WORK HISTORY TEXT:</span>
                  <button
                    type="button"
                    onClick={() => handleParseResumeText()}
                    disabled={isParsing || !resumeText.trim()}
                    className="text-amber-400 hover:text-amber-300 font-black cursor-pointer flex items-center gap-1"
                  >
                    {isParsing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    <span>AI EXTRACT</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste work experience, past positions, degrees, and core tools..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-sans text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Extracted Core Skills Tag Cloud */}
              <div className="space-y-2 font-mono text-xs">
                <label className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Tag size={13} className="text-emerald-400" /> CORE TECHNICAL & DOMAIN SKILLS:
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 min-h-[50px]">
                  {profileData.coreSkills.map(skill => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-500/40 text-[11px] font-bold flex items-center gap-1.5"
                    >
                      {skill}
                      <button type="button" onClick={() => handleRemoveSkill(skill)} className="hover:text-rose-400 cursor-pointer">×</button>
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
                      <button type="button" onClick={handleAddSkill} className="text-emerald-400 font-bold text-xs cursor-pointer">+</button>
                    )}
                  </div>
                </div>
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
                  Continue <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: LOCATION & COMPENSATION TARGET */}
          {step === 4 && (
            <div className="space-y-6 font-mono text-xs">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <MapPin size={14} /> STEP 4 OF 5 // LOCATION & TARGETS
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  Location & Compensation
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
                  Set your commute radius and target salary to fine-tune matching algorithms.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    placeholder="e.g. Richmond VIC 3121"
                    className="w-full p-3 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold focus:border-emerald-400 focus:outline-none"
                  />
                </div>

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
                  QUICK LOCATION PRESETS:
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
                  Review & Launch <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & LAUNCH */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 size={14} /> STEP 5 OF 5 // READY TO LAUNCH
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  Your Personalized Seeker Matrix is Ready!
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
                  Your candidate profile and dynamic ATS match engine are configured and ready.
                </p>
              </div>

              {/* Profile Summary Card */}
              <div className="p-5 rounded-3xl bg-slate-950 border border-indigo-500/40 space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                      {profileData.name?.[0] || 'C'}
                    </div>
                    <div>
                      <div className="text-base font-black text-white">{profileData.name || 'Candidate'}</div>
                      <div className="text-xs text-indigo-400 font-bold">{profileData.title || profileData.industry}</div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold text-xs">
                    95% ATS MATCH
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-3 border-t border-slate-800 text-slate-300">
                  <div><strong>Industry:</strong> {profileData.industry}</div>
                  <div><strong>Commute:</strong> {profileData.location}</div>
                  <div><strong>Target:</strong> {profileData.targetSalary}</div>
                  <div><strong>Work Rights:</strong> {profileData.workRights}</div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">MATCHED SKILLS:</div>
                  <div className="flex flex-wrap gap-1">
                    {profileData.coreSkills.slice(0, 8).map(s => (
                      <span key={s} className="px-2 py-0.5 rounded-lg bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Launch Button */}
              <button
                onClick={handleFinalSubmit}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-mono font-black text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Zap size={18} className="animate-bounce text-amber-300" />
                <span>⚡ LAUNCH MY JOB SEEKER MATRIX</span>
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="text-center font-mono text-[11px] text-slate-500 py-4">
        Autonomous Job Seeker Matrix • Multi-Industry AI Sourcing & Personalization Platform
      </footer>
    </div>
  );
};

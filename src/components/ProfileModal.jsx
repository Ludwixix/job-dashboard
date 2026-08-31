import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Sparkles, Upload, FileText, CheckCircle2, 
  MapPin, DollarSign, Briefcase, Mail, Phone, ShieldCheck, 
  Trash2, Plus, Tag, RefreshCw, AlertCircle, Award, Target,
  Compass, Zap, Brain, MessageSquare, ChevronRight, Layers, FileCode
} from 'lucide-react';
import { 
  parseResumeWithAI, 
  parseResumeTextClientSide, 
  saveProfile, 
  getActiveProfile,
  deleteProfile, 
  DEFAULT_PROFILES 
} from '../services/profileService';
import { getActiveApiKey, getActiveModel, setActiveApiKey } from '../services/generationService';
import { extractTextFromFile, extractTextFromPastedPdfString } from '../utils/documentParser';

const INDUSTRY_OPTIONS = [
  'Technology & IT',
  'Healthcare & Nursing',
  'Finance & Accounting',
  'Construction & Engineering',
  'Sales, Marketing & Comms',
  'Trades & Services',
  'Education & Training',
  'Executive & Management',
  'Hospitality & Tourism',
  'Legal & Compliance',
  'Mining, Energy & Resources',
  'Government & Defence'
];

const SENIORITY_OPTIONS = [
  'Entry / Graduate',
  'Mid-Level',
  'Senior',
  'Senior / Lead',
  'Principal / Architect',
  'Manager / Lead',
  'Executive / Director'
];

export const ProfileModal = ({ profile, isOpen, onClose, onProfileSaved, initialTab = 'upload' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [resumeText, setResumeText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiKey, setApiKey] = useState(() => getActiveApiKey());

  // Form State
  const [formData, setFormData] = useState(() => {
    const current = getActiveProfile() || profile || {};
    return {
      id: current.id || 'sam_ludwig',
      name: current.name || '',
      title: current.title || '',
      industry: current.industry || 'Technology & IT',
      seniorityLevel: current.seniorityLevel || 'Senior',
      yearsOfExperience: current.yearsOfExperience || 8,
      marketArchetype: current.marketArchetype || current.market_archetype || 'Enterprise Systems & Cloud Specialist',
      email: current.email || '',
      phone: current.phone || '',
      location: current.location || 'Melbourne, VIC',
      suburb: current.suburb || 'Melbourne',
      workRights: current.workRights || current.work_rights || 'Australian Citizen (Unrestricted)',
      clearance: current.clearance || 'Australian Citizen (Baseline / NV1 Eligible)',
      targetSalary: current.targetSalary || current.target_salary || '$135,000 - $160,000 + Super',
      keyStrengths: current.keyStrengths?.length ? [...current.keyStrengths] : (current.key_strengths?.length ? [...current.key_strengths] : []),
      managementStyle: current.managementStyle || 'Collaborative / Outcome-Driven',
      targetTitles: current.targetTitles?.length ? [...current.targetTitles] : (current.target_titles?.length ? [...current.target_titles] : ['Systems Engineer']),
      coreSkills: current.coreSkills?.length ? [...current.coreSkills] : (current.core_skills?.length ? [...current.core_skills] : ['Microsoft 365', 'Azure', 'PowerShell']),
      certifications: current.certifications?.length ? [...current.certifications] : [],
      interviewTalkingPoints: current.interviewTalkingPoints?.length ? [...current.interviewTalkingPoints] : [],
      workHistorySummary: current.workHistorySummary || '',
      fullWorkExperienceText: current.fullWorkExperienceText || ''
    };
  });

  const [newTitleInput, setNewTitleInput] = useState('');
  const [newSkillInput, setNewSkillInput] = useState('');
  const [newCertInput, setNewCertInput] = useState('');
  const [newStrengthInput, setNewStrengthInput] = useState('');
  const [newTalkingPointInput, setNewTalkingPointInput] = useState('');

  // Synchronize active profile data whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const active = getActiveProfile() || profile;
      if (active) {
        setFormData({
          id: active.id || 'sam_ludwig',
          name: active.name || '',
          title: active.title || '',
          industry: active.industry || 'Technology & IT',
          seniorityLevel: active.seniorityLevel || 'Senior',
          yearsOfExperience: active.yearsOfExperience || 8,
          marketArchetype: active.marketArchetype || active.market_archetype || 'Enterprise Systems & Cloud Specialist',
          email: active.email || '',
          phone: active.phone || '',
          location: active.location || 'Melbourne, VIC',
          suburb: active.suburb || 'Melbourne',
          workRights: active.workRights || active.work_rights || 'Australian Citizen (Unrestricted)',
          clearance: active.clearance || 'Australian Citizen (Baseline / NV1 Eligible)',
          targetSalary: active.targetSalary || active.target_salary || '$135,000 - $160,000 + Super',
          keyStrengths: active.keyStrengths?.length ? [...active.keyStrengths] : (active.key_strengths?.length ? [...active.key_strengths] : []),
          managementStyle: active.managementStyle || 'Collaborative / Outcome-Driven',
          targetTitles: active.targetTitles?.length ? [...active.targetTitles] : (active.target_titles?.length ? [...active.target_titles] : ['Systems Engineer']),
          coreSkills: active.coreSkills?.length ? [...active.coreSkills] : (active.core_skills?.length ? [...active.core_skills] : ['Microsoft 365', 'Azure', 'PowerShell']),
          certifications: active.certifications?.length ? [...active.certifications] : [],
          interviewTalkingPoints: active.interviewTalkingPoints?.length ? [...active.interviewTalkingPoints] : [],
          workHistorySummary: active.workHistorySummary || '',
          fullWorkExperienceText: active.fullWorkExperienceText || ''
        });
      }
      setSaveSuccess(false);
      setParseError('');
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  // Handle Resume File Upload (PDF, Word, Text, Markdown)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseError('');
    try {
      const text = await extractTextFromFile(file);
      if (!text || !text.trim()) {
        throw new Error('Could not extract readable text from the uploaded document.');
      }
      setResumeText(text);
      await handleParseResume(text);
    } catch (err) {
      console.error('Document extraction error:', err);
      setParseError(`Error parsing ${file.name}: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  // Handle AI / Client-Side Resume Parsing
  const handleParseResume = async (textToParse = resumeText) => {
    let cleanText = (textToParse || '').trim();
    if (!cleanText) {
      setParseError('Please paste your resume text or upload a resume file (PDF, Word, Text, Markdown).');
      return;
    }

    // Auto-detect & recover raw PDF stream binary text if pasted directly
    if (cleanText.startsWith('%PDF')) {
      try {
        cleanText = await extractTextFromPastedPdfString(cleanText);
        setResumeText(cleanText);
      } catch (e) {
        console.warn('PDF stream extraction fallback:', e);
      }
    }

    setIsParsing(true);
    setParseError('');

    try {
      const currentApiKey = getActiveApiKey();
      const currentModel = getActiveModel();
      const parsed = await parseResumeWithAI(cleanText, currentApiKey, currentModel);

      if (parsed) {
        const newProfile = {
          ...formData,
          name: parsed.name || formData.name,
          title: parsed.title || formData.title,
          industry: parsed.industry || formData.industry,
          seniorityLevel: parsed.seniorityLevel || formData.seniorityLevel,
          yearsOfExperience: parsed.yearsOfExperience || formData.yearsOfExperience,
          marketArchetype: parsed.marketArchetype || formData.marketArchetype,
          email: parsed.email || formData.email,
          phone: parsed.phone || formData.phone,
          location: parsed.location || formData.location,
          suburb: parsed.suburb || formData.suburb,
          workRights: parsed.workRights || formData.workRights,
          clearance: parsed.clearance || formData.clearance,
          targetSalary: parsed.targetSalary || formData.targetSalary,
          keyStrengths: parsed.keyStrengths?.length ? parsed.keyStrengths : formData.keyStrengths,
          managementStyle: parsed.managementStyle || formData.managementStyle,
          targetTitles: parsed.targetTitles?.length ? parsed.targetTitles : formData.targetTitles,
          coreSkills: parsed.coreSkills?.length ? parsed.coreSkills : formData.coreSkills,
          certifications: parsed.certifications?.length ? parsed.certifications : formData.certifications,
          interviewTalkingPoints: parsed.interviewTalkingPoints?.length ? parsed.interviewTalkingPoints : formData.interviewTalkingPoints,
          workHistorySummary: parsed.workHistorySummary || formData.workHistorySummary,
          fullWorkExperienceText: parsed.fullWorkExperienceText || cleanText
        };
        setFormData(newProfile);
        saveProfile(newProfile);
        setActiveTab('edit');
      }
    } catch (e) {
      console.warn('Parsing fallback:', e);
      const clientParsed = parseResumeTextClientSide(cleanText);
      const newProfile = { ...formData, ...clientParsed, fullWorkExperienceText: cleanText };
      setFormData(newProfile);
      saveProfile(newProfile);
      setActiveTab('edit');
    } finally {
      setIsParsing(false);
    }
  };

  // Tag Handlers
  const handleAddTitle = () => {
    if (newTitleInput.trim() && !formData.targetTitles.includes(newTitleInput.trim())) {
      setFormData(prev => ({
        ...prev,
        targetTitles: [...prev.targetTitles, newTitleInput.trim()]
      }));
      setNewTitleInput('');
    }
  };

  const handleRemoveTitle = (t) => {
    setFormData(prev => ({
      ...prev,
      targetTitles: prev.targetTitles.filter(item => item !== t)
    }));
  };

  const handleAddSkill = () => {
    if (newSkillInput.trim() && !formData.coreSkills.includes(newSkillInput.trim())) {
      setFormData(prev => ({
        ...prev,
        coreSkills: [...prev.coreSkills, newSkillInput.trim()]
      }));
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (s) => {
    setFormData(prev => ({
      ...prev,
      coreSkills: prev.coreSkills.filter(item => item !== s)
    }));
  };

  const handleAddCert = () => {
    if (newCertInput.trim() && !formData.certifications.includes(newCertInput.trim())) {
      setFormData(prev => ({
        ...prev,
        certifications: [...prev.certifications, newCertInput.trim()]
      }));
      setNewCertInput('');
    }
  };

  const handleRemoveCert = (c) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter(item => item !== c)
    }));
  };

  const handleAddStrength = () => {
    if (newStrengthInput.trim() && !formData.keyStrengths.includes(newStrengthInput.trim())) {
      setFormData(prev => ({
        ...prev,
        keyStrengths: [...prev.keyStrengths, newStrengthInput.trim()]
      }));
      setNewStrengthInput('');
    }
  };

  const handleRemoveStrength = (str) => {
    setFormData(prev => ({
      ...prev,
      keyStrengths: prev.keyStrengths.filter(item => item !== str)
    }));
  };

  const handleAddTalkingPoint = () => {
    if (newTalkingPointInput.trim() && !formData.interviewTalkingPoints.includes(newTalkingPointInput.trim())) {
      setFormData(prev => ({
        ...prev,
        interviewTalkingPoints: [...prev.interviewTalkingPoints, newTalkingPointInput.trim()]
      }));
      setNewTalkingPointInput('');
    }
  };

  const handleRemoveTalkingPoint = (tp) => {
    setFormData(prev => ({
      ...prev,
      interviewTalkingPoints: prev.interviewTalkingPoints.filter(item => item !== tp)
    }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Please enter a candidate name.');
      return;
    }

    setActiveApiKey(apiKey);
    const saved = saveProfile(formData);
    setSaveSuccess(true);
    if (onProfileSaved) {
      onProfileSaved(saved);
    }
    setTimeout(() => {
      onClose();
    }, 450);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to reset profile for "${formData.name}"?`)) {
      deleteProfile(formData.id);
      if (onProfileSaved) {
        onProfileSaved(DEFAULT_PROFILES);
      }
      onClose();
    }
  };

  const isDefaultProfile = DEFAULT_PROFILES.some(p => p.id === formData.id);

  return (
    <AnimatePresence>
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-slate-900 rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-700/60 flex flex-col max-h-[92vh] relative text-slate-100"
      >
        {/* Header Strip */}
        <div className="relative bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 font-mono">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/15 border border-teal-400/30 rounded-2xl">
              <Brain size={20} className="text-teal-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white leading-tight flex items-center gap-2">
                Candidate Intelligence Profile
                {formData.industry && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800/80 font-mono">
                    {formData.industry}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {formData.marketArchetype || 'Intelligent Multi-Persona Resume Deductions'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-6 border-b border-slate-800 bg-slate-950/60 font-mono text-xs gap-4 shrink-0">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 flex items-center gap-2 border-b-2 font-bold transition-colors cursor-pointer ${
              activeTab === 'upload' ? 'border-teal-400 text-teal-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles size={14} className="text-teal-400" />
            1. AI RESUME INGEST & DEDUCTIONS
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`py-3 flex items-center gap-2 border-b-2 font-bold transition-colors cursor-pointer ${
              activeTab === 'edit' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User size={14} className="text-cyan-400" />
            2. SYNTHESIZED CHARACTERISTICS & TRAITS
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`py-3 flex items-center gap-2 border-b-2 font-bold transition-colors cursor-pointer ${
              activeTab === 'api' ? 'border-indigo-400 text-indigo-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck size={14} className="text-indigo-400" />
            3. API & ENGINE SETTINGS
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-900/60">
          
          {/* TAB 1: UPLOAD & PARSE */}
          {activeTab === 'upload' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-950/40 via-cyan-950/20 to-slate-900 border border-teal-500/30 space-y-2">
                <div className="text-teal-300 font-extrabold flex items-center gap-2 text-sm font-mono uppercase">
                  <Brain size={16} /> Autonomous Profile Synthesis
                </div>
                <p className="text-slate-300 text-xs leading-relaxed font-sans">
                  Paste your resume or career record below. The LLM engine will deep-read between the lines to extract your true seniority, market positioning, competitive superpowers, STAR interview talking points, and targeted salary benchmarks.
                </p>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-700/80 hover:border-teal-500/60 rounded-2xl p-6 text-center transition-colors bg-slate-950/40">
                <input
                  type="file"
                  id="resume-file-input"
                  accept=".pdf,.docx,.doc,.txt,.md,.json,.rtf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="resume-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                    <Upload size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-200 font-mono">Upload PDF, Word (.docx), or Text Resume File</span>
                  <span className="text-[10px] text-slate-400">Supports PDF, DOCX, TXT, Markdown • Or paste text directly below</span>
                </label>
              </div>

              {/* Raw Textarea */}
              <div className="space-y-2 font-mono">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <FileText size={13} className="text-teal-400" /> PASTE RESUME TEXT (OR LINKEDIN PROFILE / PDF STREAM)
                  </label>
                  <span className="text-[10px] text-slate-500">{resumeText.length} characters</span>
                </div>
                <textarea
                  rows={8}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste complete resume text here (e.g. Work experience, skills, certifications, key achievements)..."
                  className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono leading-relaxed focus:border-teal-500 focus:outline-none transition-colors placeholder-slate-600"
                />
              </div>

              {parseError && (
                <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-400 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={() => handleParseResume()}
                disabled={isParsing || !resumeText.trim()}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 disabled:opacity-50 text-white font-black text-xs shadow-lg transition-all cursor-pointer font-mono tracking-wider uppercase flex items-center justify-center gap-2"
              >
                {isParsing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin text-teal-200" />
                    <span>SYNTHESIZING CANDIDATE INTELLIGENCE...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="text-amber-300" />
                    <span>EXTRACT, DEDUCE & POPULATE PROFILE</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: EDIT SYNTHESIZED PROFILE */}
          {activeTab === 'edit' && (
            <div className="space-y-6 font-mono text-xs">
              
              {/* Executive Summary Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">Executive Positioning Archetype</span>
                    <h3 className="text-sm font-black text-white mt-0.5">{formData.marketArchetype || `${formData.seniorityLevel} ${formData.industry} Specialist`}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Upload a new resume file or paste new text"
                    >
                      <Upload size={11} className="text-teal-400" /> Re-Upload / Ingest
                    </button>
                    <span className="px-2.5 py-1 rounded-lg bg-teal-950 text-teal-300 border border-teal-800 text-[10px] font-bold">
                      {formData.seniorityLevel} ({formData.yearsOfExperience} Yrs Exp)
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                      {formData.targetSalary}
                    </span>
                  </div>
                </div>

                {/* Key Superpowers */}
                {formData.keyStrengths?.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Zap size={12} className="text-amber-400" /> Competitive Superpowers:
                    </span>
                    <ul className="space-y-1">
                      {formData.keyStrengths.map((str, i) => (
                        <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                          <span className="text-teal-400 font-bold mt-0.5">•</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Primary Profile Attributes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <User size={12} /> FULL CANDIDATE NAME
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-teal-500 focus:outline-none text-xs"
                    placeholder="e.g. Sam Ludwig"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Briefcase size={12} /> PRIMARY MARKET TITLE
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-teal-500 focus:outline-none text-xs"
                    placeholder="e.g. Senior Systems Engineer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Mail size={12} /> EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-teal-500 focus:outline-none text-xs"
                    placeholder="e.g. candidate@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Phone size={12} /> PHONE NUMBER
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-teal-500 focus:outline-none text-xs"
                    placeholder="e.g. 0405 993 245"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <MapPin size={12} /> PRIMARY LOCATION BASE
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value, suburb: e.target.value.split(' ')[0] })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-teal-500 focus:outline-none text-xs"
                    placeholder="e.g. Balaclava VIC 3183"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <DollarSign size={12} /> TARGET SALARY BENCHMARK
                  </label>
                  <input
                    type="text"
                    value={formData.targetSalary}
                    onChange={(e) => setFormData({ ...formData, targetSalary: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-teal-500 focus:outline-none text-xs"
                    placeholder="e.g. $140,000 - $165,000 + Super"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Compass size={12} /> PRIMARY INDUSTRY DOMAIN
                  </label>
                  <select
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-teal-500 focus:outline-none text-xs cursor-pointer"
                  >
                    {INDUSTRY_OPTIONS.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Award size={12} /> SENIORITY LEVEL
                  </label>
                  <select
                    value={formData.seniorityLevel}
                    onChange={(e) => setFormData({ ...formData, seniorityLevel: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-teal-500 focus:outline-none text-xs cursor-pointer"
                  >
                    {SENIORITY_OPTIONS.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <ShieldCheck size={12} /> CITIZENSHIP & WORK RIGHTS
                  </label>
                  <input
                    type="text"
                    value={formData.workRights}
                    onChange={(e) => setFormData({ ...formData, workRights: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-teal-500 focus:outline-none text-xs"
                    placeholder="e.g. Australian Citizen (Unrestricted)"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <ShieldCheck size={12} /> SECURITY CLEARANCE ELIGIBILITY
                  </label>
                  <input
                    type="text"
                    value={formData.clearance}
                    onChange={(e) => setFormData({ ...formData, clearance: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-teal-500 focus:outline-none text-xs"
                    placeholder="e.g. Australian Citizen (Baseline / NV1 Eligible)"
                  />
                </div>
              </div>

              {/* Target Job Titles Tag Editor */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                  <Target size={13} /> TARGET JOB TITLES (Auto-matches scraping feeds & telemetry)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 min-h-[44px]">
                  {formData.targetTitles.map((t, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-950/80 border border-teal-500/40 text-teal-300 text-[11px] font-bold">
                      {t}
                      <button onClick={() => handleRemoveTitle(t)} className="text-slate-400 hover:text-white cursor-pointer ml-1">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTitleInput}
                    onChange={(e) => setNewTitleInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTitle())}
                    placeholder="Add target title (e.g. Cloud Architect)..."
                    className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-teal-500 focus:outline-none text-xs"
                  />
                  <button
                    onClick={handleAddTitle}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>

              {/* Core Skills Tag Editor */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                  <Tag size={13} /> CORE TECHNICAL & PROFESSIONAL SKILLS (ATS Algorithm Scoring)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 min-h-[44px]">
                  {formData.coreSkills.map((s, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold">
                      {s}
                      <button onClick={() => handleRemoveSkill(s)} className="text-slate-400 hover:text-white cursor-pointer ml-1">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                    placeholder="Add skill (e.g. React, Azure, Python, PowerShell)..."
                    className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 focus:outline-none text-xs"
                  />
                  <button
                    onClick={handleAddSkill}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>

              {/* Verified Certifications Tag Editor */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                  <Award size={13} /> VERIFIED CERTIFICATIONS & ACCREDITATIONS
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 min-h-[44px]">
                  {formData.certifications?.map((c, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                      {c}
                      <button onClick={() => handleRemoveCert(c)} className="text-slate-400 hover:text-white cursor-pointer ml-1">×</button>
                    </span>
                  ))}
                  {(!formData.certifications || formData.certifications.length === 0) && (
                    <span className="text-slate-500 text-[11px] italic py-1">No certifications listed yet</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCertInput}
                    onChange={(e) => setNewCertInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCert())}
                    placeholder="Add certification (e.g. AWS Solutions Architect, AZ-104, ITIL, CPA)..."
                    className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-amber-500 focus:outline-none text-xs"
                  />
                  <button
                    onClick={handleAddCert}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>

              {/* Competitive Superpowers Tag Editor */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                  <Zap size={13} className="text-amber-400" /> COMPETITIVE SUPERPOWERS & STRENGTHS
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 min-h-[44px]">
                  {formData.keyStrengths?.map((str, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold">
                      {str}
                      <button onClick={() => handleRemoveStrength(str)} className="text-slate-400 hover:text-white cursor-pointer ml-1">×</button>
                    </span>
                  ))}
                  {(!formData.keyStrengths || formData.keyStrengths.length === 0) && (
                    <span className="text-slate-500 text-[11px] italic py-1">No superpowers listed yet</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newStrengthInput}
                    onChange={(e) => setNewStrengthInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddStrength())}
                    placeholder="Add superpower (e.g. Complex Zero-Downtime Cloud Migrations)..."
                    className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-indigo-500 focus:outline-none text-xs"
                  />
                  <button
                    onClick={handleAddStrength}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>

              {/* STAR Interview Talking Points Editor */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-emerald-400" /> STAR INTERVIEW TALKING POINTS & METRICS
                </label>
                <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 min-h-[44px]">
                  {formData.interviewTalkingPoints?.map((tp, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-200">
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-400 font-black">•</span>
                        <span>{tp}</span>
                      </div>
                      <button onClick={() => handleRemoveTalkingPoint(tp)} className="text-slate-500 hover:text-rose-400 cursor-pointer shrink-0">×</button>
                    </div>
                  ))}
                  {(!formData.interviewTalkingPoints || formData.interviewTalkingPoints.length === 0) && (
                    <span className="text-slate-500 text-[11px] italic py-1 block">No talking points added yet</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTalkingPointInput}
                    onChange={(e) => setNewTalkingPointInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTalkingPoint())}
                    placeholder="Add STAR talking point (e.g. Reduced Azure infrastructure costs by $120k/yr via RI automated provisioning)..."
                    className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-emerald-500 focus:outline-none text-xs"
                  />
                  <button
                    onClick={handleAddTalkingPoint}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>

              {/* Full Work Experience Text */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <FileText size={13} className="text-teal-400" /> DETAILED WORK HISTORY & ACCOMPLISHMENTS (Fed directly to AI Document Generator)
                </label>
                <textarea
                  rows={6}
                  value={formData.fullWorkExperienceText}
                  onChange={(e) => setFormData({ ...formData, fullWorkExperienceText: e.target.value })}
                  placeholder="Detailed work experience history with metrics..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs leading-relaxed focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 3: API SETTINGS */}
          {activeTab === 'api' && (
            <div className="space-y-6 font-mono text-xs max-w-xl mx-auto pt-4">
              <div className="p-5 rounded-2xl bg-teal-950/20 border border-teal-500/30 space-y-3">
                <div className="text-teal-300 font-extrabold flex items-center gap-2 text-sm">
                  <ShieldCheck size={18} className="text-teal-400" />
                  OPENROUTER API ENGINE INTEGRATION
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Your OpenRouter API key powers the intelligent candidate matching, deep resume characterization, and bespoke document generation. It is stored securely in your browser's local storage and remains completely confidential.
                </p>
                <div className="space-y-2 pt-2">
                  <label className="text-[11px] font-bold text-slate-300">
                    OPENROUTER API KEY
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:border-teal-500 focus:outline-none transition-colors"
                    placeholder="sk-or-v1-..."
                  />
                  {apiKey && (
                    <p className="text-teal-400 text-[10px] flex items-center gap-1.5 mt-2">
                      <CheckCircle2 size={12} /> Key is active and ready
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
          <div>
            {!isDefaultProfile && formData.id && (
              <button
                onClick={handleDelete}
                className="text-rose-400 hover:text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} /> Reset Profile
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} /> SAVE & ACTIVATE PROFILE
            </button>
          </div>
        </div>
      </motion.div>
    </div>
    </AnimatePresence>
  );
};

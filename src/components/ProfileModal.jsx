import React, { useState } from 'react';
import { 
  X, User, Sparkles, Upload, FileText, CheckCircle2, 
  MapPin, DollarSign, Briefcase, Mail, Phone, ShieldCheck, 
  Trash2, Plus, Tag, RefreshCw, AlertCircle
} from 'lucide-react';
import { parseResumeWithAI, parseResumeTextClientSide, saveProfile, deleteProfile, DEFAULT_PROFILES } from '../services/profileService';
import { getActiveApiKey, getActiveModel } from '../services/generationService';

export const ProfileModal = ({ profile, isOpen, onClose, onProfileSaved }) => {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'edit'
  const [resumeText, setResumeText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  // Form State
  const [formData, setFormData] = useState(() => ({
    id: profile?.id || '',
    name: profile?.name || '',
    title: profile?.title || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    location: profile?.location || 'Melbourne, VIC',
    suburb: profile?.suburb || 'Melbourne',
    workRights: profile?.workRights || 'Australian Citizen (Unrestricted)',
    clearance: profile?.clearance || 'Citizen / Standard',
    targetSalary: profile?.targetSalary || '$115,000 + Super',
    targetTitles: profile?.targetTitles ? [...profile.targetTitles] : ['Systems Engineer'],
    coreSkills: profile?.coreSkills ? [...profile.coreSkills] : ['Microsoft 365', 'Azure', 'PowerShell'],
    certifications: profile?.certifications ? [...profile.certifications] : [],
    workHistorySummary: profile?.workHistorySummary || '',
    fullWorkExperienceText: profile?.fullWorkExperienceText || ''
  }));

  const [newTitleInput, setNewTitleInput] = useState('');
  const [newSkillInput, setNewSkillInput] = useState('');

  if (!isOpen) return null;

  // Handle Resume File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result || '';
      setResumeText(text);
      handleParseResume(text);
    };
    reader.readAsText(file);
  };

  // Handle AI / Client-Side Resume Parsing
  const handleParseResume = async (textToParse = resumeText) => {
    if (!textToParse.trim()) {
      setParseError('Please paste your resume text or upload a resume file first.');
      return;
    }

    setIsParsing(true);
    setParseError('');

    try {
      const apiKey = getActiveApiKey();
      const model = getActiveModel();
      const parsed = await parseResumeWithAI(textToParse, apiKey, model);

      if (parsed) {
        setFormData(prev => ({
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
        setActiveTab('edit');
      }
    } catch (e) {
      console.warn('Parsing error:', e);
      // Fallback
      const clientParsed = parseResumeTextClientSide(textToParse);
      setFormData(prev => ({ ...prev, ...clientParsed }));
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

  const handleRemoveTitle = (titleToRemove) => {
    setFormData(prev => ({
      ...prev,
      targetTitles: prev.targetTitles.filter(t => t !== titleToRemove)
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

  const handleRemoveSkill = (skillToRemove) => {
    setFormData(prev => ({
      ...prev,
      coreSkills: prev.coreSkills.filter(s => s !== skillToRemove)
    }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Please enter a candidate name.');
      return;
    }

    const saved = saveProfile(formData);
    if (onProfileSaved) {
      onProfileSaved(saved);
    }
    onClose();
  };

  const handleDelete = () => {
    if (formData.id && confirm(`Delete profile "${formData.name}"?`)) {
      deleteProfile(formData.id);
      if (onProfileSaved) {
        onProfileSaved(null);
      }
      onClose();
    }
  };

  const isDefaultProfile = ['sam_ludwig', 'alex_chen_dev', 'sarah_miller_data'].includes(formData.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
              <User size={22} />
            </div>
            <div>
              <div className="text-[10px] font-mono font-black text-indigo-400 uppercase tracking-widest">
                PERSONALIZATION ENGINE
              </div>
              <h2 className="text-xl font-black text-white">
                {formData.name || 'Candidate Profile & Experience'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2 font-mono text-xs font-bold gap-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Upload size={14} /> 1-CLICK RESUME UPLOAD & PARSE
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText size={14} /> PROFILE DETAILS & SKILLS
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-200">
          {/* TAB 1: UPLOAD & AUTO-PARSE */}
          {activeTab === 'upload' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/40 font-mono text-xs space-y-2">
                <div className="text-indigo-300 font-extrabold flex items-center gap-2 text-sm">
                  <Sparkles size={16} className="text-amber-300" />
                  AUTOMATIC CANDIDATE CUSTOMIZATION
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Upload your resume or paste your work history. Our parsing engine will automatically extract your contact details, core skills, target titles, and career metrics to personalize the job match scores, commute distances, and tailored PDF generators.
                </p>
              </div>

              {/* Drag and Drop File Upload Area */}
              <div className="border-2 border-dashed border-slate-700 hover:border-indigo-400 rounded-2xl p-6 text-center transition-all bg-slate-950/40 font-mono">
                <input
                  type="file"
                  id="resume-file-input"
                  accept=".txt,.md,.rtf,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="resume-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-400/30">
                    <Upload size={24} />
                  </div>
                  <div className="text-xs font-bold text-white">
                    Drop your Resume File here, or <span className="text-indigo-400 underline">Browse</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Supports .txt, .pdf, .md, .rtf text documents
                  </div>
                </label>
              </div>

              {/* Raw Text Paste Area */}
              <div className="space-y-2 font-mono">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>OR PASTE RESUME / WORK EXPERIENCE TEXT DIRECTLY:</span>
                  <span className="text-[10px] text-slate-500">{resumeText.length} characters</span>
                </label>
                <textarea
                  rows={8}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your full resume text here (experience, skills, contact info)..."
                  className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {parseError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-400 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              <button
                onClick={() => handleParseResume()}
                disabled={isParsing || !resumeText.trim()}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-mono font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <RefreshCw size={15} className="animate-spin text-amber-300" />
                    <span>AI EXTRACTING CANDIDATE PROFILE (0–3s)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} className="text-amber-300" />
                    <span>⚡ EXTRACT & AUTOFLL PROFILE</span>
                  </>
                )}
              </button>

              {/* Multi-Industry Preset Candidates Quick Loader */}
              <div className="pt-3 border-t border-slate-800 space-y-2 font-mono text-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag size={12} className="text-indigo-400" /> OR LOAD A TEST CANDIDATE ACROSS MAJOR INDUSTRIES:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DEFAULT_PROFILES.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setFormData({
                          id: preset.id,
                          name: preset.name,
                          title: preset.title,
                          email: preset.email,
                          phone: preset.phone,
                          location: preset.location,
                          suburb: preset.suburb,
                          workRights: preset.workRights,
                          clearance: preset.clearance,
                          targetSalary: preset.targetSalary,
                          industry: preset.industry || 'Technology & IT',
                          targetTitles: [...preset.targetTitles],
                          coreSkills: [...preset.coreSkills],
                          certifications: preset.certifications ? [...preset.certifications] : [],
                          workHistorySummary: preset.workHistorySummary,
                          fullWorkExperienceText: preset.fullWorkExperienceText
                        });
                        setResumeText(preset.fullWorkExperienceText || '');
                        setActiveTab('edit');
                      }}
                      className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 transition-colors text-left flex items-start gap-2.5 cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-300 font-black text-xs flex items-center justify-center shrink-0 border border-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {preset.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white text-[11px] truncate group-hover:text-indigo-300">{preset.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{preset.title}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT PROFILE FIELDS */}
          {activeTab === 'edit' && (
            <div className="space-y-5 font-mono text-xs">
              {/* Basic Contact Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <User size={13} /> FULL NAME
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. Emma Watson"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                    <Tag size={13} /> INDUSTRY / SECTOR
                  </label>
                  <select
                    value={formData.industry || 'Technology & IT'}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-indigo-500/50 text-indigo-300 font-bold focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="Healthcare & Medical">🏥 Healthcare & Medical</option>
                    <option value="Finance & Accounting">📈 Finance, Accounting & Banking</option>
                    <option value="Marketing & Sales">📣 Marketing, Sales & Growth</option>
                    <option value="Construction & Trades">🏗️ Construction, Trades & Engineering</option>
                    <option value="HR & Operations">👥 Human Resources & People Ops</option>
                    <option value="Legal & Governance">⚖️ Legal, Governance & Compliance</option>
                    <option value="Technology & IT">💻 Technology, Software & IT</option>
                    <option value="Education & Training">🎓 Education & Training</option>
                    <option value="Hospitality & Retail">🛍️ Hospitality, Retail & Customer Service</option>
                    <option value="General & Professional">🌐 General Professional / Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                    <Briefcase size={13} /> PRIMARY JOB TITLE
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. Clinical Nurse Specialist"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <Mail size={13} /> EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. sam.ludwig@gmail.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <Phone size={13} /> MOBILE PHONE
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. 0405 993 245"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <MapPin size={13} /> LOCATION & COMMUTE BASE (SUBURB / POSTCODE)
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => {
                      const loc = e.target.value;
                      const sub = loc.split(',')[0].replace(/(VIC|NSW|QLD|WA|SA|TAS|ACT|NT|\d+)/gi, '').trim();
                      setFormData({ ...formData, location: loc, suburb: sub || 'Melbourne' });
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-emerald-500/50 text-emerald-300 font-bold focus:border-emerald-400 focus:outline-none"
                    placeholder="e.g. Balaclava VIC 3183"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <DollarSign size={13} /> TARGET COMPENSATION / SALARY
                  </label>
                  <input
                    type="text"
                    value={formData.targetSalary}
                    onChange={(e) => setFormData({ ...formData, targetSalary: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-emerald-500/50 text-emerald-300 font-bold focus:border-emerald-400 focus:outline-none"
                    placeholder="e.g. $115,000 + Super"
                  />
                </div>
              </div>

              {/* Work Rights & Clearance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck size={13} /> WORK RIGHTS
                  </label>
                  <input
                    type="text"
                    value={formData.workRights}
                    onChange={(e) => setFormData({ ...formData, workRights: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. Australian Citizen (Unrestricted)"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck size={13} /> SECURITY CLEARANCE
                  </label>
                  <input
                    type="text"
                    value={formData.clearance}
                    onChange={(e) => setFormData({ ...formData, clearance: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. Baseline / NV1 Ready"
                  />
                </div>
              </div>

              {/* Target Job Titles Tag Editor */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                  <Tag size={13} /> TARGET JOB TITLES (Used for ATS matching & recommendations)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 min-h-[44px]">
                  {formData.targetTitles.map((t, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold">
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
                    placeholder="Add target title (e.g. Cloud Engineer)..."
                    className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-indigo-500 focus:outline-none text-xs"
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
                <label className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                  <Tag size={13} /> CORE TECHNICAL & PROFESSIONAL SKILLS (ATS Keyword Matching)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 min-h-[44px]">
                  {formData.coreSkills.map((s, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[11px] font-bold">
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
                    placeholder="Add skill (e.g. React, Azure, Python, SQL)..."
                    className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-purple-500 focus:outline-none text-xs"
                  />
                  <button
                    onClick={handleAddSkill}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>

              {/* Full Work Experience Text */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <FileText size={13} /> DETAILED WORK HISTORY & ACCOMPLISHMENTS (Injected into AI Resume Generator)
                </label>
                <textarea
                  rows={6}
                  value={formData.fullWorkExperienceText}
                  onChange={(e) => setFormData({ ...formData, fullWorkExperienceText: e.target.value })}
                  placeholder="Detailed work experience history with metrics..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs leading-relaxed focus:border-indigo-500 focus:outline-none"
                />
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
                <Trash2 size={14} /> Delete Custom Profile
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
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} /> SAVE & ACTIVATE PROFILE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo, useCallback } from 'react';
import { 
  FileText, Download, CheckCircle2, AlertTriangle, 
  Sparkles, X, Sliders, RefreshCw 
} from 'lucide-react';
import { 
  ATS_TEMPLATES, 
  formatAtsResume, 
  computeAtsReadinessScore, 
  exportVectorPdf 
} from '../services/pdfTemplateService';

/**
 * Real-Time Visual ATS PDF Studio component.
 * Allows candidates to edit profile content, switch between ATS layouts, inspect live ATS readiness scores,
 * and download a vector PDF.
 */
export const PdfPreviewModal = ({ isOpen, onClose, initialProfile = {} }) => {
  const [templateId, setTemplateId] = useState(ATS_TEMPLATES.MODERN_EXECUTIVE);
  const [name, setName] = useState(initialProfile.name || 'Candidate Name');
  const [title, setTitle] = useState(initialProfile.title || 'Principal Systems Architect');
  const [email, setEmail] = useState(initialProfile.email || 'candidate@example.com.au');
  const [phone, setPhone] = useState(initialProfile.phone || '+61 400 000 000');
  const [location, setLocation] = useState(initialProfile.location || 'Sydney, Australia');
  const [summary, setSummary] = useState(
    initialProfile.summary || 
    'Senior engineering lead with extensive track record delivering scalable distributed systems and cloud platforms in Australia.'
  );
  const [skillsText, setSkillsText] = useState(
    Array.isArray(initialProfile.skills) 
      ? initialProfile.skills.join(', ') 
      : 'Go, Python, Kubernetes, AWS, PostgreSQL, Terraform, Distributed Systems'
  );
  const [experienceBullets, setExperienceBullets] = useState(
    initialProfile.experience && initialProfile.experience[0]?.bullets
      ? initialProfile.experience[0].bullets.join('\n')
      : 'Architected high-throughput message bus handling 4.5M events daily with 99.99% availability.\nSpearheaded cloud migration initiative delivering $240,000 annual compute savings.'
  );

  // Formatted ATS document
  const atsDoc = useMemo(() => {
    const profile = {
      name,
      title,
      email,
      phone,
      location,
      summary,
      skills: skillsText.split(',').map(s => s.trim()).filter(Boolean),
      experience: [
        {
          role: title,
          company: 'Career Milestone Track',
          dates: '2022 - Present',
          bullets: experienceBullets.split('\n').map(b => b.replace(/^•\s*/, '').trim()).filter(Boolean)
        }
      ],
      education: initialProfile.education || 'Bachelor of Computer Science / Information Technology',
      clearances: initialProfile.clearances || 'Australian Baseline / NV1 Security Clearance'
    };

    return formatAtsResume({ profile, templateId });
  }, [name, title, email, phone, location, summary, skillsText, experienceBullets, templateId, initialProfile]);

  // Real-time ATS readiness evaluation
  const atsAnalysis = useMemo(() => {
    return computeAtsReadinessScore(atsDoc.plainText);
  }, [atsDoc.plainText]);

  const handleExport = useCallback(() => {
    exportVectorPdf(atsDoc);
  }, [atsDoc]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div 
        className="bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100 font-sans"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Real-Time Visual ATS PDF Studio</h2>
              <p className="text-xs text-slate-400 font-mono">Australian ATS Compliant Vector Layout Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
            >
              <Download size={14} /> Export Vector PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Studio"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Studio Body: Split-Pane Editor & Live Preview */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Pane: Content Editor */}
          <div className="lg:col-span-5 p-5 border-r border-slate-800 overflow-y-auto space-y-4 bg-slate-900/50 text-xs">
            {/* Template Selector */}
            <div>
              <label className="block text-slate-400 uppercase font-mono font-semibold text-[11px] mb-1.5">
                ATS Layout Template
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-slate-200 text-xs focus:border-amber-400 outline-none"
              >
                <option value={ATS_TEMPLATES.MODERN_EXECUTIVE}>Modern Executive (Corporate & Scale-Up)</option>
                <option value={ATS_TEMPLATES.TECHNICAL_SPECIALIST}>Technical Specialist (Skills Matrix & STAR Metrics)</option>
                <option value={ATS_TEMPLATES.APS_PUBLIC_SECTOR}>Australian Public Service (Capability Criteria)</option>
              </select>
            </div>

            {/* Candidate Identity */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-mono text-[10px] uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:border-amber-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-mono text-[10px] uppercase mb-1">Professional Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:border-amber-400 outline-none"
                />
              </div>
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-400 font-mono text-[10px] uppercase mb-1">Email</label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:border-amber-400 outline-none text-[11px]"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-mono text-[10px] uppercase mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:border-amber-400 outline-none text-[11px]"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-mono text-[10px] uppercase mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:border-amber-400 outline-none text-[11px]"
                />
              </div>
            </div>

            {/* Executive Summary */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-400 font-mono text-[10px] uppercase">Professional Summary</label>
                <span className="text-[10px] text-slate-500 font-mono">{summary.length} chars</span>
              </div>
              <textarea
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 focus:border-amber-400 outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Skills */}
            <div>
              <label className="block text-slate-400 font-mono text-[10px] uppercase mb-1">
                Core Competencies & Technologies (Comma-Separated)
              </label>
              <textarea
                rows={2}
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 focus:border-amber-400 outline-none resize-none"
              />
            </div>

            {/* STAR Achievements */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-400 font-mono text-[10px] uppercase">
                  STAR Achievements & Outcomes (One Per Line)
                </label>
                <span className="text-[10px] text-amber-400 font-mono">Quantified metrics recommended</span>
              </div>
              <textarea
                rows={4}
                value={experienceBullets}
                onChange={(e) => setExperienceBullets(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 focus:border-amber-400 outline-none resize-none font-mono text-[11px] leading-relaxed"
              />
            </div>
          </div>

          {/* Right Pane: Visual ATS Preview & Readiness Analysis */}
          <div className="lg:col-span-7 p-6 overflow-y-auto flex flex-col bg-slate-950/60">
            {/* ATS Readiness Banner */}
            <div className="mb-4 p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider font-mono text-white">
                    ATS Readiness Rating
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-[11px] font-mono text-slate-400">
                  <span className={atsAnalysis.breakdown.contactComplete ? 'text-emerald-400' : 'text-slate-500'}>
                    ✓ Contact
                  </span>
                  <span className={atsAnalysis.breakdown.standardHeaders ? 'text-emerald-400' : 'text-slate-500'}>
                    ✓ Headings
                  </span>
                  <span className="text-amber-300 font-semibold">
                    {atsAnalysis.breakdown.actionVerbs} Action Verbs
                  </span>
                  <span className="text-emerald-300 font-semibold">
                    {atsAnalysis.breakdown.metrics} Metrics
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className={`text-2xl font-black font-mono ${
                  atsAnalysis.score >= 80 ? 'text-emerald-400' : atsAnalysis.score >= 60 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {atsAnalysis.score}%
                </span>
              </div>
            </div>

            {/* Document Canvas (A4 simulation) */}
            <div className="flex-1 bg-white text-slate-900 rounded-lg shadow-xl p-8 font-sans text-xs border border-slate-300 select-text min-h-[500px]">
              {/* Header */}
              <div className="border-b-2 border-slate-300 pb-3 mb-4">
                <h1 className="text-xl font-bold tracking-tight text-slate-950 uppercase">{atsDoc.name}</h1>
                <p className="text-slate-700 font-semibold text-xs mt-0.5">{atsDoc.title}</p>
                <p className="text-slate-500 text-[10px] mt-1 font-mono">{atsDoc.contactLine}</p>
              </div>

              {/* Sections */}
              <div className="space-y-4">
                {atsDoc.sections.map((sec, idx) => (
                  <div key={idx}>
                    <h2 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 mb-1.5 font-mono">
                      {sec.title}
                    </h2>
                    <div className="text-[11px] text-slate-700 whitespace-pre-line leading-relaxed">
                      {sec.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfPreviewModal;


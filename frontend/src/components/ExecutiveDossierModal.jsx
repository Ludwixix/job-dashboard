import React, { useState, useMemo } from 'react';
import {
  Building2,
  Briefcase,
  ShieldCheck,
  Calendar,
  HelpCircle,
  AlertTriangle,
  Copy,
  Check,
  Printer,
  X,
  Layers,
  Users,
  Compass,
  CheckCircle2,
  TrendingUp,
  FileText
} from 'lucide-react';
import {
  generateExecutiveDossier,
  copyDossierToClipboard
} from '../services/dossierService';

export const ExecutiveDossierModal = ({ isOpen, onClose, job, profile }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'leadership' | 'roadmap' | 'questions'
  const [copied, setCopied] = useState(false);
  const [copiedQuestionIdx, setCopiedQuestionIdx] = useState(null);

  const dossier = useMemo(() => {
    if (!job) return null;
    return generateExecutiveDossier(job, profile);
  }, [job, profile]);

  if (!isOpen || !job || !dossier) return null;

  const handleCopyFullBriefing = async () => {
    const success = await copyDossierToClipboard(dossier);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyQuestion = (text, idx) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedQuestionIdx(idx);
      setTimeout(() => setCopiedQuestionIdx(null), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const sectorBadgeColor = {
    healthcare: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    finance: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    trades: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
    legal: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    technology: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    general: 'bg-slate-500/10 text-slate-300 border-slate-500/30'
  }[dossier.sector] || 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';

  const scaleBadgeColor = {
    asx_enterprise: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    public_sector: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    growth_startup: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    mid_market: 'bg-blue-500/10 text-blue-300 border-blue-500/30'
  }[dossier.enterprise_scale] || 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl rounded-2xl bg-slate-900/95 border border-slate-700/60 shadow-2xl shadow-cyan-950/40 text-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Top Header Bar */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800 bg-slate-950/60 relative">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-600/30 to-indigo-600/20 border border-cyan-500/30 text-cyan-300 shadow-inner">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/50">
                  EXECUTIVE BRIEFING SUITE
                </span>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${sectorBadgeColor}`}>
                  {dossier.sector.toUpperCase()}
                </span>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${scaleBadgeColor}`}>
                  {dossier.organization_profile.enterprise_scale_label}
                </span>
                <span className="text-xs text-slate-400">
                  • {dossier.organization_profile.headcount_bracket}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
                {dossier.company_name}
                <span className="text-slate-500 font-normal text-base sm:text-lg">/</span>
                <span className="text-cyan-200 text-base sm:text-lg font-semibold truncate max-w-md">
                  {dossier.target_role}
                </span>
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Compass className="w-3.5 h-3.5 text-slate-400" />
                <span>Operating Model: <strong className="text-slate-300 font-medium">{dossier.organization_profile.operating_model}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Location: <strong className="text-slate-300 font-medium">{dossier.location}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyFullBriefing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition shadow-sm"
              title="Copy entire briefing to clipboard (Markdown)"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{copied ? 'COPIED' : 'COPY BRIEFING'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/80 text-xs font-semibold transition"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>PRINT / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Rail */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/40 px-5 gap-2 overflow-x-auto">
          {[
            { id: 'overview', label: '1. STRATEGIC OVERVIEW & PAIN POINTS', icon: Layers },
            { id: 'leadership', label: '2. LEADERSHIP & STAKEHOLDERS', icon: Users },
            { id: 'roadmap', label: '3. FIRST 90 DAYS BLUEPRINT', icon: Calendar },
            { id: 'questions', label: '4. REVERSE QUESTIONS & DILIGENCE', icon: HelpCircle }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-3 border-b-2 text-xs font-bold tracking-wide transition whitespace-nowrap ${
                  isActive
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          
          {/* TAB 1: STRATEGIC OVERVIEW & PAIN POINTS */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Primary Callout: Why This Role Was Funded */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-slate-900 border border-cyan-500/30 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-cyan-300 uppercase">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span>Why This Role Was Funded (Executive Rationale)</span>
                </div>
                <p className="mt-2 text-base text-slate-100 font-medium leading-relaxed">
                  "{dossier.strategic_pain_points.why_role_was_funded}"
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Pace:</span>
                  <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-300 border border-slate-700/60">
                    {dossier.scale_meta.pace}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="font-semibold text-slate-300">Governance:</span>
                  <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-300 border border-slate-700/60">
                    {dossier.scale_meta.governance_style}
                  </span>
                </div>
              </div>

              {/* Acute Core Challenges */}
              <div>
                <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Acute Organizational Challenges & Bottlenecks</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dossier.strategic_pain_points.core_challenges.map((challenge, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 transition flex items-start gap-3"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-center mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-slate-200 text-xs leading-relaxed font-normal">
                        {challenge}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Governance, Regulations & Competitors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <h4 className="text-xs font-mono font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Regulatory & Compliance Frameworks</span>
                  </h4>
                  <ul className="space-y-2">
                    {dossier.organization_profile.compliance_frameworks.map((framework, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span>{framework}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <h4 className="text-xs font-mono font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <span>Market & Competitor Landscape</span>
                  </h4>
                  <p className="text-xs text-slate-400 mb-3">
                    Key Australian peers and benchmark competitors across this sector:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {dossier.organization_profile.competitors.map((comp, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/80 shadow-sm"
                      >
                        {comp}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <h5 className="text-[11px] font-mono text-slate-400 uppercase mb-1">Strategic Opportunities:</h5>
                    <ul className="space-y-1">
                      {dossier.strategic_pain_points.strategic_opportunities.map((opp, i) => (
                        <li key={i} className="text-[11px] text-slate-300 leading-snug">
                          • {opp}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: LEADERSHIP & STAKEHOLDERS */}
          {activeTab === 'leadership' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Hierarchy Callout */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Target Reporting Hierarchy</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-cyan-200">
                  {dossier.leadership_stakeholders.reporting_hierarchy}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  <strong className="text-slate-300">Hiring Mandate:</strong> {dossier.leadership_stakeholders.hiring_manager_mandate}
                </p>
              </div>

              {/* Key Executive Decision Makers */}
              <div>
                <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase mb-3">
                  Key Executive Decision Makers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {dossier.leadership_stakeholders.key_executives.map((exec, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between hover:border-cyan-500/40 transition shadow-sm"
                    >
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-900/60 inline-block mb-2">
                          Decision Maker {idx + 1}
                        </span>
                        <h4 className="font-bold text-sm text-white leading-tight">
                          {exec.role}
                        </h4>
                        <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                          {exec.focus}
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Stakeholder Weight</span>
                        <span className="font-semibold text-cyan-300">{idx === 0 ? 'Executive' : idx === 1 ? 'Direct Manager' : 'Operational'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stakeholder Pressures & Cultural Expectations */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                    Executive Stakeholder Pressures
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    The incoming hire will operate under immediate pressure regarding: <em>"{dossier.leadership_stakeholders.stakeholder_pressures}"</em>. Candidates should emphasize predictability, transparent status communication, and low-friction stakeholder alignment.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: FIRST 90 DAYS BLUEPRINT */}
          {activeTab === 'roadmap' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span>First 90 Days Strategic Execution Blueprint</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Proactive 3-phase strategic roadmap demonstrating executive self-direction and immediate value generation.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'days_1_30', badge: 'PHASE 1', color: 'border-cyan-500/40 bg-cyan-950/10' },
                  { key: 'days_31_60', badge: 'PHASE 2', color: 'border-indigo-500/40 bg-indigo-950/10' },
                  { key: 'days_61_90', badge: 'PHASE 3', color: 'border-emerald-500/40 bg-emerald-950/10' }
                ].map(({ key, badge, color }) => {
                  const phase = dossier.first_90_days[key];
                  if (!phase) return null;
                  return (
                    <div
                      key={key}
                      className={`p-5 rounded-2xl border ${color} shadow-sm transition hover:border-slate-600`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                            {badge}
                          </span>
                          <h4 className="font-bold text-sm sm:text-base text-white">
                            {phase.phase}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          <span>Measurable Outcome</span>
                        </div>
                      </div>

                      <p className="mt-3 text-xs italic text-slate-300 font-medium">
                        "{phase.focus}"
                      </p>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Key Actions */}
                        <div>
                          <h5 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2">
                            Key Strategic Actions:
                          </h5>
                          <ul className="space-y-1.5">
                            {phase.key_actions.map((act, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                <span className="text-cyan-400 font-bold">•</span>
                                <span className="leading-snug">{act}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Deliverables & Metrics */}
                        <div className="space-y-3 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
                          <div>
                            <h5 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                              Deliverables / Work Products:
                            </h5>
                            <ul className="space-y-1">
                              {phase.deliverables.map((del, i) => (
                                <li key={i} className="flex items-center gap-2 text-xs font-medium text-slate-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                  <span>{del}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {phase.success_metrics && (
                            <div className="pt-2 border-t border-slate-800">
                              <h5 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1">
                                Success Metrics:
                              </h5>
                              <div className="flex flex-wrap gap-1.5">
                                {phase.success_metrics.map((met, i) => (
                                  <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/50">
                                    {met}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: REVERSE QUESTIONS & DILIGENCE */}
          {activeTab === 'questions' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Reverse Questions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-cyan-400" />
                      <span>High-Stakes C-Suite Reverse Questions</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Strategic questions designed to flip the interview dynamic and demonstrate peer-level strategic foresight.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {dossier.reverse_interview_questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-cyan-500/40 transition flex items-start justify-between gap-4 group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center justify-center mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed">
                            "{q}"
                          </p>
                          <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase mt-1 inline-block">
                            TARGET AUDIENCE: {idx === 0 ? 'HIRING EXECUTIVE' : idx === 1 ? 'DEPARTMENT LEAD' : idx === 2 ? 'OPERATIONS / TECH' : 'EXECUTIVE BOARD'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopyQuestion(q, idx)}
                        className="flex-shrink-0 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition"
                        title="Copy question to clipboard"
                      >
                        {copiedQuestionIdx === idx ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-400 group-hover:text-cyan-300" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Due Diligence & Risk Signals */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-amber-500/30">
                <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider text-amber-300 uppercase mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Due Diligence & Risk Signals (What to Probe Before Signing)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {dossier.risk_and_cultural_audit.diligence_flags.map((flag, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-amber-400 font-bold">⚠️</span>
                      <span className="leading-snug">{flag}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Debt & Legacy Risk: </span>
                    <strong className="text-slate-200">{dossier.risk_and_cultural_audit.debt_risk_assessment}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Budget Stability: </span>
                    <strong className="text-emerald-300">{dossier.risk_and_cultural_audit.budget_stability}</strong>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Candidate Grounding: <strong className="text-slate-200">{dossier.candidate_context.name}</strong> ({dossier.sector})</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyFullBriefing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY FULL BRIEFING'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
            >
              DONE
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExecutiveDossierModal;


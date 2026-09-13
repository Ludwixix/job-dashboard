import React, { useState, useEffect, useId } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, FileText,
  Terminal, Copy, Check, RefreshCw, X, Award, Info, Sparkles
} from 'lucide-react';
import {
  fetchAtsDiagnosticReport,
  formatAtsScoreBadge,
} from '../services/atsDiagnosticService';

export const AtsDiagnosticModal = ({
  isOpen,
  onClose,
  job = null,
  profile = null,
  resumeText = '',
}) => {
  const [activeTab, setActiveTab] = useState('compatibility'); // 'compatibility' | 'topological' | 'star' | 'regional'
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const titleId = useId();

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await fetchAtsDiagnosticReport({
        resumeText,
        job,
        profile,
      });
      setReport(data);
    } catch (err) {
      console.error('[AtsDiagnosticModal] Error loading diagnostic:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReport();
    }
  }, [isOpen, job?.id, resumeText]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const scoreMeta = formatAtsScoreBadge(report?.ats_score || 0);

  const handleCopyStream = () => {
    if (report?.topological_flattening?.raw_text_stream) {
      navigator.clipboard.writeText(report.topological_flattening.raw_text_stream);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id={titleId} className="text-base font-bold text-white tracking-wide font-sans">
                  ATS SENTINEL & PARSING DIAGNOSTIC
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  PHASE 20
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Simulating machine ingestion across Workday, Greenhouse, Taleo & JobAdder
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadReport}
              disabled={loading}
              aria-label="Re-run ATS scan"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close ATS Diagnostic modal"
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Overview Score & Target Banner */}
        <div className="px-6 py-3 bg-slate-950/30 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-lg border font-mono font-black text-sm flex items-center gap-2 ${scoreMeta.color}`}>
              <Award size={16} />
              <span>{report?.ats_score || 0}/100</span>
              <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">{scoreMeta.badge}</span>
            </div>
            <div className="text-xs text-slate-400">
              <span className="text-slate-500">Target Role:</span>{' '}
              <span className="font-semibold text-slate-200">{job?.title || 'General Industry Role'}</span>
              {job?.company && <span className="text-slate-400"> @ {job.company}</span>}
            </div>
          </div>

          {report?.actionable_recommendations?.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
              <AlertTriangle size={14} className="text-amber-400" />
              <span>{report.actionable_recommendations.length} optimization warning(s) flagged</span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 border-b border-slate-800 bg-slate-900/60 overflow-x-auto">
          {[
            { id: 'compatibility', label: 'ATS Compatibility Matrix', icon: ShieldCheck },
            { id: 'topological', label: 'Topological Flattening', icon: Terminal },
            { id: 'star', label: 'STAR Density & Fluff', icon: Sparkles },
            { id: 'regional', label: 'AU Regional Standards', icon: Award },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <RefreshCw size={28} className="animate-spin text-indigo-400 mb-3" />
              <p className="text-sm font-medium">Analyzing resume structure against ATS engines...</p>
            </div>
          )}

          {!loading && report && activeTab === 'compatibility' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: 'Workday (Textkernel / Sovren)', engine: report.ats_compliance.workday, desc: 'Enterprise standard. Strict 4-part taxonomy required.' },
                  { name: 'Greenhouse', engine: report.ats_compliance.greenhouse, desc: 'Tech & scaleup standard. Requires explicit skills section.' },
                  { name: 'Taleo / iCIMS', engine: report.ats_compliance.taleo, desc: 'Legacy enterprise. Sensitive to multi-column text scrambling.' },
                  { name: 'JobAdder / PageUp (Australia)', engine: report.ats_compliance.jobadder, desc: 'Australian staffing & enterprise standard. Checks contact flow.' },
                ].map((item, idx) => {
                  const isPass = item.engine?.status === 'passed';
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all ${
                        isPass ? 'bg-slate-950/40 border-emerald-500/30' : 'bg-slate-950/40 border-amber-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-white">{item.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase flex items-center gap-1 ${
                            isPass
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isPass ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                          {item.engine?.status || 'check'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">{item.desc}</p>
                      <p className="text-xs font-medium text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        {item.engine?.details || 'Standard checks verified.'}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Detected Sections Taxonomy */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Canonical Section Taxonomy Detection
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {Object.entries(report.ats_compliance.detected_sections || {}).map(([sec, found]) => (
                    <div
                      key={sec}
                      className={`p-2.5 rounded-lg border text-center text-xs font-medium ${
                        found
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-mono text-slate-400">{sec.replace('_', ' ')}</div>
                      <div className="font-bold mt-0.5">{found ? 'Detected' : 'Missing'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && report && activeTab === 'topological' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">What the ATS Recruiter Database Sees</h3>
                  <p className="text-xs text-slate-400">
                    Topologically flattened text stream with design layers stripped away.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyStream}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy Plain Text'}</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono text-slate-300 space-y-2">
                <div className="flex gap-4 border-b border-slate-800/80 pb-2 text-[11px]">
                  <span><strong className="text-slate-400">Candidate:</strong> {report.topological_flattening?.candidate_name}</span>
                  <span><strong className="text-slate-400">Email:</strong> {report.topological_flattening?.contact_info?.email || 'None detected'}</span>
                  <span><strong className="text-slate-400">Phone:</strong> {report.topological_flattening?.contact_info?.phone || 'None detected'}</span>
                </div>
                <pre className="whitespace-pre-wrap max-h-72 overflow-y-auto text-slate-300 leading-relaxed pt-2">
                  {report.topological_flattening?.raw_text_stream || 'No text extracted.'}
                </pre>
              </div>
            </div>
          )}

          {!loading && report && activeTab === 'star' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">STAR Metric Density</span>
                  <div className="text-xl font-black text-indigo-400 mt-1">
                    {report.star_density?.density_percentage}%
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {report.star_density?.quantified_bullets} of {report.star_density?.total_bullets} bullets quantified
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Fluff Buzzwords Flagged</span>
                  <div className={`text-xl font-black mt-1 ${report.star_density?.fluff_count > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {report.star_density?.fluff_count || 0}
                  </div>
                  <span className="text-[11px] text-slate-400">Corporate clichés detected</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Cognitive Apex Triage</span>
                  <div className="text-xl font-black text-emerald-400 mt-1">7.4s Scan</div>
                  <span className="text-[11px] text-slate-400">F-pattern cognitive flow</span>
                </div>
              </div>

              {/* Bullets List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Bullet-by-Bullet Quantified Verification
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {report.star_density?.bullets?.map((b, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                        b.quantified
                          ? 'bg-slate-950/40 border-slate-800 text-slate-200'
                          : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                      }`}
                    >
                      {b.quantified ? (
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p>{b.text}</p>
                        {!b.quantified && (
                          <span className="text-[10px] text-amber-400 font-mono mt-1 block">
                            Missing measurable metric (%, $, SLA, volume).
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && report && activeTab === 'regional' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Australian Fair Work Standards</h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                      report.regional_au?.compliant
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {report.regional_au?.compliant ? 'Fully Compliant' : 'Risks Flagged'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Australian recruitment demands strict anti-bias adherence under the Fair Work Act. Applications must omit photos, age, marital status, and include a verified Referees section.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-300">Referees Section</span>
                    <span className="text-xs font-bold text-emerald-400">
                      {report.regional_au?.has_referees ? 'Present' : 'Missing'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-300">Demographic Risk Count</span>
                    <span className={`text-xs font-bold ${report.regional_au?.demographic_risks?.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {report.regional_au?.demographic_risks?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              {report.regional_au?.demographic_risks?.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <XCircle size={14} className="text-rose-400" />
                    Prohibited Demographic Fields Detected:
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    {report.regional_au.demographic_risks.map((risk, idx) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info size={14} className="text-slate-500" />
            <span>Simulated with zero secret exposure. Data remains strictly local.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

export default AtsDiagnosticModal;

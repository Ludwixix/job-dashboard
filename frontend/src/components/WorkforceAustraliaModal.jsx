import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Award,
  FileText,
  Download,
  Copy,
  Check,
  TrendingUp,
  X,
  Sliders,
  Sparkles
} from 'lucide-react';
import { 
  calculatePBASPoints, 
  formatPortalSubmissionText, 
  generateWorkforceCsvString,
  getWorkforceSettings,
  saveWorkforceSettings
} from '../services/workforceAustraliaService';
import { downloadWorkforceEvidencePdf } from '../utils/workforceEvidenceExporter';
import { getActiveProfile } from '../services/profileService';

export default function WorkforceAustraliaModal({
  isOpen,
  onClose,
  jobs = []
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedId, setCopiedId] = useState(null);
  const [settings, setSettings] = useState(() => getWorkforceSettings());
  const [cycleOffset, setCycleOffset] = useState(0);

  const profile = useMemo(() => getActiveProfile(), []);

  const refDate = useMemo(() => {
    const d = new Date();
    if (cycleOffset !== 0) {
      d.setMonth(d.getMonth() + cycleOffset);
    }
    return d;
  }, [cycleOffset]);

  const pbas = useMemo(() => {
    return calculatePBASPoints(jobs, {
      cycleStartDay: settings.cycleStartDay,
      pointsTarget: settings.pointsTarget,
      referenceDate: refDate
    });
  }, [jobs, settings, refDate]);

  if (!isOpen) return null;

  const handleCopyText = (item) => {
    const text = formatPortalSubmissionText(item);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportPdf = () => {
    downloadWorkforceEvidencePdf(pbas, profile, settings);
  };

  const handleExportCsv = () => {
    const csvContent = generateWorkforceCsvString(pbas.items, settings);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Workforce_Australia_Audit_${pbas.cycle?.label?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Evidence'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdateSettings = (updates) => {
    const saved = saveWorkforceSettings(updates);
    setSettings(saved);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden font-sans text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Award size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">Workforce Australia Hub</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  PBAS Points Streamliner
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {pbas.cycle?.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setCycleOffset(0)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  cycleOffset === 0 ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Current Cycle
              </button>
              <button
                type="button"
                onClick={() => setCycleOffset(-1)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  cycleOffset === -1 ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Last Cycle
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 border-b border-slate-800 bg-slate-950/40 text-xs font-mono">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp size={14} /> 1. PBAS OVERVIEW & LEDGER
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`py-3 px-3 border-b-2 font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Copy size={14} /> 2. PORTAL FAST-ENTRY ({pbas.totalEvidenceItems})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-3 border-b-2 font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders size={14} /> 3. CYCLE CONFIG
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-900/60">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                      Monthly Mutual Obligations Progress
                    </span>
                    <div className="flex items-baseline gap-3 mt-1">
                      <span className="text-3xl font-black text-white font-mono">
                        {pbas.totalPoints}
                        <span className="text-base font-normal text-slate-400"> / {pbas.pointsTarget} pts</span>
                      </span>
                      <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                        pbas.isMet 
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                          : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      }`}>
                        {pbas.isMet ? 'TARGET MET ✓' : `${pbas.pointsRemaining} pts needed`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      onClick={handleExportPdf}
                      disabled={pbas.totalEvidenceItems === 0}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all shadow-md cursor-pointer disabled:opacity-40"
                    >
                      <Download size={14} /> Download PDF Report
                    </button>
                    <button
                      onClick={handleExportCsv}
                      disabled={pbas.totalEvidenceItems === 0}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs transition-all border border-slate-700 cursor-pointer disabled:opacity-40"
                    >
                      <FileText size={14} /> CSV Audit Log
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pbas.isMet ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, pbas.percentage)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>Applications: {pbas.applicationCount} (5 pts each = {pbas.applicationCount * 5} pts)</span>
                    <span>Interviews: {pbas.interviewCount} (20 pts each = {pbas.interviewCount * 20} pts)</span>
                  </div>
                </div>
              </div>

              {/* Evidence Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <FileText size={14} className="text-amber-400" /> Evidence Audit Ledger ({pbas.totalEvidenceItems})
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Official proof of job hunt activities
                  </span>
                </div>

                {pbas.items.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-center space-y-2">
                    <p className="text-xs font-mono text-slate-400">No applications or interviews recorded in this cycle.</p>
                    <p className="text-[11px] text-slate-500 font-sans">
                      Apply for roles in the tracker or move jobs to Applied/Interviewing to automatically log points.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-md">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Date</th>
                          <th className="py-2.5 px-3 font-semibold">Employer</th>
                          <th className="py-2.5 px-3 font-semibold">Position</th>
                          <th className="py-2.5 px-3 font-semibold">Activity</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Points</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {pbas.items.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{item.formattedDate}</td>
                            <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">{item.company}</td>
                            <td className="py-2.5 px-3 text-slate-300">{item.title}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.type.includes('Interview')
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              }`}>
                                {item.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-amber-400">+{item.pointsAwarded}</td>
                            <td className="py-2.5 px-3 text-slate-400 capitalize">{item.status}</td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleCopyText(item)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] transition-colors cursor-pointer"
                                title="Copy details for Workforce Australia portal"
                              >
                                {copiedId === item.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                {copiedId === item.id ? 'Copied' : 'Copy'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PORTAL FAST-ENTRY TRANSCRIBER */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles size={14} /> Workforce Australia Fast-Entry Transcriber
                </span>
                <p className="text-[11px] text-slate-400 font-sans">
                  Clicking "Copy for Portal Form" puts the pre-formatted Employer, Position, Application Method, and Date onto your clipboard, ready to paste straight into the myGov / Workforce Australia submission form.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pbas.items.map((item, idx) => (
                  <div key={item.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 shadow-md flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                          Item #{idx + 1} • {item.formattedDate}
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-400">
                          +{item.pointsAwarded} pts
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{item.company}</h4>
                        <p className="text-xs text-slate-400">{item.title}</p>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 space-y-0.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                        <div><span className="text-slate-500">Channel:</span> {item.channel}</div>
                        <div><span className="text-slate-500">Status:</span> {item.status}</div>
                        {item.evidenceUrl && (
                          <div className="truncate"><span className="text-slate-500">URL:</span> {item.evidenceUrl}</div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleCopyText(item)}
                      className={`w-full py-2 px-3 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        copiedId === item.id
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                      }`}
                    >
                      {copiedId === item.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      {copiedId === item.id ? 'Copied to Clipboard!' : 'Copy for Portal Form'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SETTINGS & CONFIG */}
          {activeTab === 'settings' && (
            <div className="space-y-4 max-w-xl font-mono text-xs">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sliders size={14} className="text-amber-400" /> Mutual Obligations Parameters
                </span>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-300 font-bold block mb-1">
                      Monthly PBAS Points Target
                    </label>
                    <input
                      type="number"
                      min="20"
                      max="200"
                      step="5"
                      value={settings.pointsTarget}
                      onChange={(e) => handleUpdateSettings({ pointsTarget: parseInt(e.target.value || '100', 10) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Standard requirement is 100 points/month.</span>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-300 font-bold block mb-1">
                      Cycle Cut-Off / Start Day of Month
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={settings.cycleStartDay}
                      onChange={(e) => handleUpdateSettings({ cycleStartDay: parseInt(e.target.value || '1', 10) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Use 1 for 1st–End of Month, or your employment provider reporting cycle start date (e.g. 15th).
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-300 font-bold block mb-1">
                      Jobseeker ID (JSID)
                    </label>
                    <input
                      type="text"
                      value={settings.jobseekerId}
                      onChange={(e) => handleUpdateSettings({ jobseekerId: e.target.value })}
                      placeholder="e.g. JS12345678"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-300 font-bold block mb-1">
                      Employment Provider Name
                    </label>
                    <input
                      type="text"
                      value={settings.providerName}
                      onChange={(e) => handleUpdateSettings({ providerName: e.target.value })}
                      placeholder="e.g. APM Employment Services"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

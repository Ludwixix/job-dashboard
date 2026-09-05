import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  TrendingUp, 
  ShieldAlert, 
  CheckCircle2, 
  Copy, 
  Mail, 
  Scale, 
  FileText, 
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { 
  evaluateOfferCompensation, 
  generateCounterOfferProposal, 
  auditContractClauses,
  detectSector,
  detectSeniorityTier,
  STATUTORY_SUPER_RATE
} from '../services/offerService';
import { getActiveProfile } from '../services/profileService';

const SAMPLE_RISKY_CONTRACT = `TERMS OF EMPLOYMENT OFFER
1. Remuneration: Base salary shall be paid monthly in arrears. The salary is all-inclusive and in full satisfaction of all hours worked, and the employee may be required to work reasonable additional hours with no overtime penalty or additional remuneration.
2. Restraint of Trade: For a restraint period of 12 months following termination, the employee shall not engage with, be employed by, or consult for any competitor within a 50 km radius.
3. Intellectual Property: All intellectual property created at any time, whether during or outside working hours, shall belong exclusively to the company.
4. Termination: The employee shall provide 8 weeks notice before resigning, while the company may terminate with 1 week notice.`;

export function OfferActionHubModal({ isOpen, onClose, job }) {
  const [activeTab, setActiveTab] = useState('benchmark'); // 'benchmark' | 'negotiation' | 'contract'
  const activeProfile = getActiveProfile();

  // Benchmark Form State
  const initialSalary = useMemo(() => {
    if (!job?.salary) return 130000;
    const match = job.salary.match(/\$?(\d{2,3}),?(\d{3})/);
    if (match) return parseInt(`${match[1]}${match[2]}`, 10);
    return 130000;
  }, [job]);

  const [baseSalary, setBaseSalary] = useState(initialSalary);
  const [superIncluded, setSuperIncluded] = useState(false);
  const [selectedSeniority, setSelectedSeniority] = useState(() => detectSeniorityTier(job?.title || ''));
  const [selectedSector, setSelectedSector] = useState(() => detectSector(`${job?.title || ''} ${activeProfile?.industry || ''}`));

  // Negotiation Form State
  const [posture, setPosture] = useState('collaborative'); // 'collaborative' | 'assertive' | 'benefits_focused'
  const [targetSalary, setTargetSalary] = useState(() => Math.round(initialSalary * 1.10));
  const [copied, setCopied] = useState(false);

  // Contract Risk Scanner State
  const [contractText, setContractText] = useState('');
  const [contractAnalysis, setContractAnalysis] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Sync initial salary when job changes
  useEffect(() => {
    if (job) {
      setBaseSalary(initialSalary);
      setTargetSalary(Math.round(initialSalary * 1.10));
      setSelectedSeniority(detectSeniorityTier(job?.title || ''));
      setSelectedSector(detectSector(`${job?.title || ''} ${activeProfile?.industry || ''}`));
    }
  }, [job, initialSalary, activeProfile?.industry]);

  // Evaluate Compensation Benchmark
  const benchmarkResult = useMemo(() => {
    return evaluateOfferCompensation(
      {
        baseSalary,
        superIncluded,
        sector: selectedSector,
        title: job?.title || ''
      },
      job || {},
      activeProfile
    );
  }, [baseSalary, superIncluded, selectedSector, job, activeProfile]);

  // Generate Counter-Offer Email
  const counterProposal = useMemo(() => {
    return generateCounterOfferProposal(
      {
        baseSalary,
        targetSalary,
        sector: selectedSector,
        title: job?.title || '',
        company: job?.company || '',
        contactEmail: job?.contactEmail || ''
      },
      job || {},
      posture,
      activeProfile
    );
  }, [baseSalary, targetSalary, selectedSector, job, posture, activeProfile]);

  // Trigger contract scan
  const handleScanContract = async (textToScan = contractText) => {
    setIsScanning(true);
    try {
      const res = await auditContractClauses(textToScan);
      setContractAnalysis(res);
    } finally {
      setIsScanning(false);
    }
  };

  const handleLoadSample = () => {
    setContractText(SAMPLE_RISKY_CONTRACT);
    handleScanContract(SAMPLE_RISKY_CONTRACT);
  };

  const handleCopy = () => {
    if (counterProposal?.body) {
      navigator.clipboard.writeText(counterProposal.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-cyan-950/40 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">OFFER ACTION HUB</h2>
                <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                  {selectedSector} Track
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Compensation benchmarking, counter-offer strategy & Fair Work contract audit for <span className="text-slate-200 font-medium">{job?.title || 'Target Role'}</span> at <span className="text-slate-200 font-medium">{job?.company || 'Employer'}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6">
          <button
            onClick={() => setActiveTab('benchmark')}
            className={`flex items-center gap-2 py-3 px-4 font-mono text-xs font-semibold tracking-wider transition border-b-2 ${
              activeTab === 'benchmark'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            1. COMPENSATION BENCHMARK
          </button>
          <button
            onClick={() => setActiveTab('negotiation')}
            className={`flex items-center gap-2 py-3 px-4 font-mono text-xs font-semibold tracking-wider transition border-b-2 ${
              activeTab === 'negotiation'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            2. COUNTER-OFFER ENGINE
          </button>
          <button
            onClick={() => setActiveTab('contract')}
            className={`flex items-center gap-2 py-3 px-4 font-mono text-xs font-semibold tracking-wider transition border-b-2 ${
              activeTab === 'contract'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            3. CONTRACT RISK SCANNER
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: COMPENSATION BENCHMARK */}
          {activeTab === 'benchmark' && (
            <div className="space-y-6">
              {/* Controls Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
                    Offered Base Salary (AUD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">$</span>
                    <input 
                      type="number"
                      value={baseSalary}
                      onChange={e => setBaseSalary(Number(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
                    Package Structure
                  </label>
                  <div className="flex items-center h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                      <input 
                        type="checkbox"
                        checked={superIncluded}
                        onChange={e => setSuperIncluded(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-800"
                      />
                      <span>Includes 11.5% Super (TRP)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
                    Seniority Bracket
                  </label>
                  <select
                    value={selectedSeniority}
                    onChange={e => setSelectedSeniority(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  >
                    <option value="junior">Junior / Graduate</option>
                    <option value="mid">Mid-Level Professional</option>
                    <option value="senior">Senior Specialist</option>
                    <option value="lead">Lead / Manager / Principal</option>
                  </select>
                </div>
              </div>

              {/* Percentile Positioning Card */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs font-mono text-slate-400 uppercase">Market Distribution</span>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>{benchmarkResult.percentile}th Percentile</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold border ${
                        benchmarkResult.percentile >= 75
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : benchmarkResult.percentile >= 50
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {benchmarkResult.verdict}
                      </span>
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-slate-400 uppercase">Total Package (TRP)</span>
                    <p className="text-lg font-bold text-cyan-300 font-mono">
                      ${benchmarkResult.trp.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Visual Percentile Bar */}
                <div className="space-y-2">
                  <div className="relative h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        benchmarkResult.percentile >= 75 ? 'bg-emerald-400' :
                        benchmarkResult.percentile >= 50 ? 'bg-cyan-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, benchmarkResult.percentile))}%` }}
                    />
                    {/* Median marker */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/40 z-10" title="50th Percentile Median" />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-1">
                    <span>Entry (P10): ${benchmarkResult.marketBands.p10.toLocaleString()}</span>
                    <span>Median (P50): ${benchmarkResult.marketBands.p50.toLocaleString()}</span>
                    <span>Top Quartile (P75): ${benchmarkResult.marketBands.p75.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Australian Tax & Take-Home Estimator */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">Gross Annual Base</span>
                  <p className="text-lg font-bold text-white font-mono mt-1">
                    ${benchmarkResult.actualBase.toLocaleString()}
                  </p>
                  <span className="text-[10px] text-slate-400">+ ${benchmarkResult.superAmount.toLocaleString()} Super</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">Estimated ATO Tax</span>
                  <p className="text-lg font-bold text-rose-400 font-mono mt-1">
                    -${benchmarkResult.tax.totalTax.toLocaleString()}
                  </p>
                  <span className="text-[10px] text-slate-400">{benchmarkResult.tax.effectiveRate}% effective tax rate</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">Net Take-Home (Monthly)</span>
                  <p className="text-lg font-bold text-emerald-400 font-mono mt-1">
                    ${benchmarkResult.tax.netMonthly.toLocaleString()}
                  </p>
                  <span className="text-[10px] text-slate-400">Paid into bank account</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">Net Fortnightly Pay</span>
                  <p className="text-lg font-bold text-cyan-300 font-mono mt-1">
                    ${benchmarkResult.tax.netFortnightly.toLocaleString()}
                  </p>
                  <span className="text-[10px] text-slate-400">Standard pay cycle</span>
                </div>
              </div>

              {/* Strategic Next Step CTA */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">Ready to formulate a counter-offer?</h4>
                    <p className="text-xs text-slate-300">Generate a professional, evidence-backed counter proposal tailored to {job?.company || 'the employer'}.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('negotiation')}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
                >
                  NEGOTIATE OFFER <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: COUNTER-OFFER ENGINE */}
          {activeTab === 'negotiation' && (
            <div className="space-y-6">
              {/* Posture Switcher & Target Salary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
                    Negotiation Posture
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'collaborative', label: 'Collaborative', desc: 'Balanced / Win-Win' },
                      { id: 'assertive', label: 'Assertive', desc: 'Top Market Push' },
                      { id: 'benefits_focused', label: 'Perks & WFH', desc: 'Flexibility & CPD' }
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPosture(item.id)}
                        className={`p-2 rounded-lg text-left border transition ${
                          posture === item.id
                            ? 'bg-cyan-500/15 border-cyan-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold font-mono">{item.label}</div>
                        <div className="text-[10px] text-slate-400">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
                    Target Base Counter (AUD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">$</span>
                    <input 
                      type="number"
                      value={targetSalary}
                      onChange={e => setTargetSalary(Number(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Uplift: +${(targetSalary - baseSalary).toLocaleString()} ({Math.round(((targetSalary - baseSalary) / (baseSalary || 1)) * 100)}%)
                  </span>
                </div>
              </div>

              {/* Generated Proposal Email */}
              <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-mono text-slate-300 font-semibold">{counterProposal.subject}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition flex items-center gap-1.5 font-mono"
                    >
                      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'COPIED' : 'COPY'}
                    </button>
                    <a
                      href={counterProposal.mailtoUrl}
                      className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" /> OPEN EMAIL
                    </a>
                  </div>
                </div>

                <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto p-3 bg-slate-900 rounded-lg border border-slate-800">
                  {counterProposal.body}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: CONTRACT RISK SCANNER */}
          {activeTab === 'contract' && (
            <div className="space-y-6">
              {/* Text Input Area */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-400 uppercase">
                    Paste Offer Letter or Contract Clauses
                  </label>
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="text-xs text-cyan-400 hover:text-cyan-300 underline font-mono"
                  >
                    Load Sample Restrictive Contract
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={contractText}
                  onChange={e => setContractText(e.target.value)}
                  placeholder="Paste restraint of trade, working hours, intellectual property, or termination clauses here..."
                  className="w-full p-3 bg-slate-950/70 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-400 resize-none leading-relaxed"
                />
                <button
                  type="button"
                  onClick={() => handleScanContract()}
                  disabled={isScanning || !contractText.trim()}
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4" />
                  {isScanning ? 'SCANNING AGAINST FAIR WORK STANDARDS...' : 'SCAN CONTRACT CLAUSES'}
                </button>
              </div>

              {/* Analysis Results */}
              {contractAnalysis && (
                <div className="space-y-4">
                  {/* Safety Score Header */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-slate-400 uppercase">Contract Safety Score</span>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span>{contractAnalysis.contractSafetyScore}/100</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold border ${
                          contractAnalysis.contractSafetyScore >= 85
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : contractAnalysis.contractSafetyScore >= 65
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                          {contractAnalysis.riskRating}
                        </span>
                      </h3>
                    </div>
                    <div className="text-right text-xs font-mono text-slate-400">
                      <div>{contractAnalysis.highRiskCount} High Risk</div>
                      <div>{contractAnalysis.mediumRiskCount} Medium Risk</div>
                    </div>
                  </div>

                  {/* Flags List */}
                  {contractAnalysis.flags?.length === 0 ? (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 font-mono">
                      <CheckCircle2 className="w-4 h-4" />
                      Zero high-risk covenants detected. Contract adheres to standard Fair Work benchmarks.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contractAnalysis.flags.map((flag, idx) => (
                        <div 
                          key={idx}
                          className={`p-4 rounded-xl border space-y-2 ${
                            flag.severity === 'high' 
                              ? 'bg-rose-950/20 border-rose-500/30 text-slate-200'
                              : 'bg-amber-950/20 border-amber-500/30 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold flex items-center gap-2 text-white">
                              <AlertTriangle className={`w-3.5 h-3.5 ${flag.severity === 'high' ? 'text-rose-400' : 'text-amber-400'}`} />
                              {flag.title}
                            </span>
                            <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                              flag.severity === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {flag.severity} RISK
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{flag.description}</p>
                          <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-[11px] font-mono space-y-1 text-slate-400">
                            <div><span className="text-cyan-400 font-semibold">Fair Work Guidance:</span> {flag.fairWorkGuidance || flag.fair_work_guidance}</div>
                            <div><span className="text-emerald-400 font-semibold">Recommended Counter:</span> {flag.recommendedCounter || flag.recommended_counter}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Australian Fair Work Act & NES Guidance</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}

export default OfferActionHubModal;

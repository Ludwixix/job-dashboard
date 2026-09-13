import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Zap,
  Sparkles,
  Layers,
  Terminal,
  FileText,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import {
  auditLinkedInProfile,
  testBooleanQuery,
  fetchJobInboundOptimization,
  formatInboundScoreBadge,
} from '../services/inboundSourcingService';
import { getActiveProfile } from '../services/profileService';

export const LinkedInInboundModal = ({ isOpen, onClose, job = null }) => {
  const [activeTab, setActiveTab] = useState('sandbox'); // 'sandbox' | 'headlines' | 'about' | 'arsenal'
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Profile and Job State
  const activeProfile = useMemo(() => getActiveProfile() || {}, []);
  const targetTitle = useMemo(() => job?.title || activeProfile.title || 'Senior Systems & Cloud Engineer', [job, activeProfile]);
  const coreSkills = useMemo(() => activeProfile.coreSkills || ['Azure', 'Terraform', 'PowerShell', 'Intune'], [activeProfile]);

  // Optimization data
  const [headlines, setHeadlines] = useState([]);
  const [aboutIndex, setAboutIndex] = useState('');
  const [queries, setQueries] = useState([]);
  const [auditResult, setAuditResult] = useState(null);

  // Sandbox State
  const [customQuery, setCustomQuery] = useState('');
  const [customText, setCustomText] = useState('');
  const [evalResult, setEvalResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Load Optimization Data on Open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadOptimizationData = async () => {
      setLoading(true);
      try {
        const data = await fetchJobInboundOptimization(job?.id, targetTitle, coreSkills);
        if (!isMounted) return;

        setHeadlines(data.headlines || []);
        setAboutIndex(data.aboutIndex || '');
        setQueries(data.queries || []);

        const initialHeadline = activeProfile.headline || (data.headlines?.[0] || '');
        const initialAbout = activeProfile.about || (data.aboutIndex || '');
        const defaultProfileText = `${initialHeadline} ${initialAbout} ${coreSkills.join(' ')}`;
        setCustomText(defaultProfileText);

        if (data.queries?.length > 0) {
          setCustomQuery(data.queries[0].query);
        }

        const auditData = await auditLinkedInProfile({
          headline: initialHeadline,
          about: initialAbout,
          targetRole: targetTitle,
          coreSkills,
        });

        if (isMounted) {
          setAuditResult(auditData.audit);
        }
      } catch (err) {
        console.warn('[LinkedInInboundModal] Failed to load inbound data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadOptimizationData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, job?.id, targetTitle, coreSkills, activeProfile]);

  // Run Boolean evaluation whenever custom query or text changes in Sandbox
  useEffect(() => {
    if (!customQuery || !isOpen) return;
    let isMounted = true;

    const runEval = async () => {
      setIsEvaluating(true);
      try {
        const res = await testBooleanQuery({ query: customQuery, text: customText });
        if (isMounted) {
          setEvalResult(res);
        }
      } catch (err) {
        console.warn('[LinkedInInboundModal] Evaluation error:', err);
      } finally {
        if (isMounted) setIsEvaluating(false);
      }
    };

    const timer = setTimeout(runEval, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [customQuery, customText, isOpen]);

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSelectQueryForSandbox = (queryStr) => {
    setCustomQuery(queryStr);
    setActiveTab('sandbox');
  };

  if (!isOpen) return null;

  const score = auditResult?.inbound_visibility_score || 85;
  const scoreBadge = formatInboundScoreBadge(score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="LinkedIn Inbound Sourcing Radar"
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 animate-in fade-in duration-200"
      >
        {/* Top Gradient Border */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold tracking-wider uppercase text-blue-400">
                  Phase 21: Inbound Sourcing Radar
                </span>
                <span className="text-slate-600">•</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-medium border flex items-center gap-1.5 ${scoreBadge.colorClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${scoreBadge.dotClass}`} />
                  {score}% Indexability
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-100 font-sans mt-0.5">
                LinkedIn Recruiter Boolean Indexing Hub
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`flex items-center gap-2 py-3 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'sandbox'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Recruiter Query Sandbox
          </button>

          <button
            onClick={() => setActiveTab('headlines')}
            className={`flex items-center gap-2 py-3 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'headlines'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Headline Sourcing Synthesizer
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 py-3 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'about'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Keyword "About" Index
          </button>

          <button
            onClick={() => setActiveTab('arsenal')}
            className={`flex items-center gap-2 py-3 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'arsenal'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            Recruiter Query Arsenal ({queries.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto max-h-[65vh] space-y-6">
          {/* TAB 1: SANDBOX & LIVE TESTER */}
          {activeTab === 'sandbox' && (
            <div className="space-y-5">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="recruiter-boolean-query" className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-blue-400" />
                    Recruiter Boolean Search String
                  </label>
                  {evalResult && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase flex items-center gap-1.5 ${
                        evalResult.is_match
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {evalResult.is_match ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {evalResult.is_match ? 'Candidate Matches Query' : 'Query Filters Out Candidate'}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    id="recruiter-boolean-query"
                    type="text"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    placeholder='e.g. ("Cloud Engineer" OR "Systems Engineer") AND (Azure OR AWS) NOT Junior'
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                {evalResult?.has_curly_quotes_warning && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Typographic curly quotes (“ ”) detected! Real LinkedIn search parsers break on curly quotes. We normalized them to straight quotes (") for testing.
                    </span>
                  </div>
                )}
              </div>

              {/* Matched / Missing Terms Telemetry */}
              {evalResult && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800">
                    <span className="text-xs font-mono font-medium text-emerald-400 uppercase tracking-wider block mb-2">
                      Matched Terms ({evalResult.matched_terms?.length || 0})
                    </span>
                    {evalResult.matched_terms?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {evalResult.matched_terms.map((term) => (
                          <span
                            key={term}
                            className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No search terms matched in candidate text.</span>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800">
                    <span className="text-xs font-mono font-medium text-rose-400 uppercase tracking-wider block mb-2">
                      Missing Terms ({evalResult.missing_terms?.length || 0})
                    </span>
                    {evalResult.missing_terms?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {evalResult.missing_terms.map((term) => (
                          <span
                            key={term}
                            className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Zero missing required terms!</span>
                    )}
                  </div>
                </div>
              )}

              {/* Target Candidate Text for Testing */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="candidate-index-text" className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                    Candidate Profile Text (Headline, About, Skills)
                  </label>
                  <span className="text-xs text-slate-500 font-mono">
                    {customText.length} characters
                  </span>
                </div>
                <textarea
                  id="candidate-index-text"
                  rows={5}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Paste candidate LinkedIn Headline and About text here to verify Boolean indexability..."
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>
          )}

          {/* TAB 2: HEADLINES */}
          {activeTab === 'headlines' && (
            <div className="space-y-6">
              {/* Audit Summary Card */}
              {auditResult && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-blue-400 uppercase tracking-wider font-semibold">
                      Headline Indexability Audit
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {auditResult.headline_character_count} / {auditResult.headline_character_limit} Chars
                    </span>
                  </div>

                  {auditResult.strengths?.length > 0 && (
                    <div className="space-y-1">
                      {auditResult.strengths.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-emerald-400">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {auditResult.recommendations?.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {auditResult.recommendations.map((r, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-amber-300">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pre-generated Headlines */}
              <div className="space-y-3">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                  3 High-Converting Boolean-Friendly Headlines
                </span>

                {headlines.map((headline, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 hover:border-blue-500/30 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <span className="text-xs font-mono text-blue-400/80 font-medium">
                          Option {idx + 1}: {idx === 0 ? 'Exact Title & Core Stack' : idx === 1 ? 'Dual-Title Sourcing Index' : 'Enterprise Scale & Moat'}
                        </span>
                        <p className="text-sm font-sans text-slate-200 leading-relaxed font-medium">
                          {headline}
                        </p>
                        <span className="text-xs font-mono text-slate-500 block">
                          {headline.length} / 220 characters
                        </span>
                      </div>

                      <button
                        onClick={() => handleCopy(headline, `headline-${idx}`)}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        {copiedKey === `headline-${idx}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === `headline-${idx}` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: KEYWORD ABOUT INDEX */}
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 font-sans">
                    Keyword-Rich LinkedIn "About" Index
                  </h3>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Engineered to trigger Boolean AND/OR queries in LinkedIn Recruiter while maintaining human readability.
                  </p>
                </div>

                <button
                  onClick={() => handleCopy(aboutIndex, 'about-index')}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
                >
                  {copiedKey === 'about-index' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'about-index' ? 'Copied About Section' : 'Copy About Section'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {aboutIndex}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: RECRUITER ARSENAL */}
          {activeTab === 'arsenal' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-200 font-sans">
                  Target Role Recruiter Boolean Search Strings
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  The exact Boolean queries internal talent acquisition and agency headhunters run on LinkedIn Recruiter to source candidates for this role.
                </p>
              </div>

              <div className="space-y-3">
                {queries.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-semibold text-blue-400">
                        {q.strategy}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectQueryForSandbox(q.query)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
                        >
                          Test in Sandbox
                        </button>
                        <button
                          onClick={() => handleCopy(q.query, `query-${idx}`)}
                          className="px-2.5 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-mono flex items-center gap-1 transition-colors"
                        >
                          {copiedKey === `query-${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedKey === `query-${idx}` ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 font-sans">
                      {q.description}
                    </p>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-sky-300 overflow-x-auto">
                      {q.query}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Adheres to LinkedIn Recruiter Boolean Parsing Spec</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium font-sans transition-colors"
          >
            Close Radar
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkedInInboundModal;

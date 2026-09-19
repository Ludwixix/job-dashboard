import React, { useState, useEffect } from 'react';
import { 
  X, Check, Sparkles, Zap, Shield, Key, ArrowRight, 
  ExternalLink, Clock, HelpCircle, CheckCircle2 
} from 'lucide-react';
import { createCheckoutSession, openCustomerPortal, getCachedBillingStatus } from '../services/billingService';

export const PricingModal = ({ 
  isOpen, 
  onClose, 
  onOpenKeyModal, 
  reason = 'upgrade' 
}) => {
  const [billingStatus, setBillingStatus] = useState(() => getCachedBillingStatus());
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleStatusUpdate = (e) => {
      if (e.detail) setBillingStatus(e.detail);
    };
    window.addEventListener('billing-status-updated', handleStatusUpdate);
    return () => window.removeEventListener('billing-status-updated', handleStatusUpdate);
  }, []);

  if (!isOpen) return null;

  const handleCheckout = async (planId) => {
    setLoadingPlan(planId);
    setErrorMessage('');
    try {
      const res = await createCheckoutSession(planId);
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        throw new Error('No checkout URL received.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMessage(err.message || 'Unable to initiate checkout. Please try again.');
      setLoadingPlan(null);
    }
  };

  const handlePortal = async () => {
    try {
      const res = await openCustomerPortal();
      if (res.portal_url) {
        window.location.href = res.portal_url;
      }
    } catch (err) {
      setErrorMessage(err.message || 'Unable to open billing portal.');
    }
  };

  const isPro = billingStatus?.is_active && billingStatus?.plan_tier === 'pro_monthly';
  const isPass = billingStatus?.is_active && billingStatus?.plan_tier === 'pass_3mo';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-wide uppercase">
                Career Studio Intelligence Plans
              </h2>
              <p className="text-xs text-slate-400">
                Bespoke high-conviction application synthesis and interview coaching for every profession.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Notice banner if triggered by trial exhaustion */}
        {reason === 'trial_exhausted' && (
          <div className="bg-amber-950/40 border-b border-amber-800/40 px-6 py-3 flex items-center gap-3 text-amber-200 text-xs">
            <Clock size={16} className="text-amber-400 shrink-0" />
            <span>
              <strong>Free Trial Limit Reached:</strong> Upgrade to Pro or activate a 3-Month Pass to continue generating unlimited bespoke resumes, cover letters, and interview cockpits with built-in AI.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-950/50 border-b border-rose-800 px-6 py-2.5 text-rose-300 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Free Tier (BYO Key) */}
            <div className="flex flex-col justify-between p-5 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Developer & Free</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">BYO KEY</span>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">$0</div>
                  <div className="text-xs text-slate-500">Free forever • Zero platform fee</div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Bring your own personal OpenRouter, OpenAI, Claude, or Gemini API key, or use free open-weights models.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>Unmetered document generation with your personal API key</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>Full nationwide job search across all industries</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>Complete application tracker & profile score engine</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>Community free models (Meta Llama 3.3 70B Free)</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => {
                    onClose();
                    onOpenKeyModal?.();
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                >
                  <Key size={14} />
                  <span>Configure Personal Key</span>
                </button>
              </div>
            </div>

            {/* Card 2: Pro Subscription (Recommended) */}
            <div className="relative flex flex-col justify-between p-6 rounded-xl border-2 border-emerald-500/70 bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/20 shadow-xl ring-1 ring-emerald-500/20">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest shadow-md">
                MOST POPULAR • ZERO SETUP
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Pro Job Hunter</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/50">
                    BUILT-IN AI
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-white">$19</span>
                    <span className="text-xs font-semibold text-slate-400">AUD / month</span>
                  </div>
                  <div className="text-xs text-emerald-400 font-medium mt-0.5">Zero API keys • Cancel anytime</div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Engineered for professionals who want instant, world-class job applications without dealing with API keys or developer accounts.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-200 pt-2 border-t border-slate-800">
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>No API key required:</strong> Built-in Claude 3.7 Sonnet & GPT-4o</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>Tailored single-column ATS Resumes & anti-template Cover Letters</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>5-Minute Master Interview Cockpit with spoken pitch scripts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>Key Selection Criteria (KSC) & portal questionnaire solver</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>500,000 monthly tokens (~60 tailored job applications)</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6">
                {isPro ? (
                  <button
                    onClick={handlePortal}
                    className="w-full py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 border border-emerald-500/40 cursor-pointer transition-colors"
                  >
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    <span>Manage Active Subscription</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckout('pro_monthly')}
                    disabled={loadingPlan === 'pro_monthly'}
                    className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50 tracking-wider uppercase"
                  >
                    {loadingPlan === 'pro_monthly' ? (
                      <span>Redirecting to Checkout…</span>
                    ) : (
                      <>
                        <span>Start Pro Plan</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Card 3: 3-Month Career Pass */}
            <div className="flex flex-col justify-between p-5 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Career Pass</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/40">
                    ONE-OFF PASS
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-white">$49</span>
                    <span className="text-xs font-semibold text-slate-400">AUD / 90 days</span>
                  </div>
                  <div className="text-xs text-slate-500">Fixed duration • No recurring charges</div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ideal for a standard 90-day job hunt cycle. All Pro features without worrying about recurring subscription charges after you get hired.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                    <span>Everything in Pro with full Claude 3.7 & GPT-4o access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                    <span>1,500,000 total tokens for the full 90-day search</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                    <span>Automatic expiration: Zero cancellation required</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                    <span>Saves $8 AUD compared to 3 months of monthly Pro</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6">
                {isPass ? (
                  <div className="py-2.5 text-center text-xs font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 rounded-lg">
                    Pass Active
                  </div>
                ) : (
                  <button
                    onClick={() => handleCheckout('pass_3mo')}
                    disabled={loadingPlan === 'pass_3mo'}
                    className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loadingPlan === 'pass_3mo' ? (
                      <span>Redirecting to Checkout…</span>
                    ) : (
                      <>
                        <span>Get 3-Month Pass</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Guarantee & Transparency Footnote */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-emerald-400 shrink-0" />
              <span>Payments secured by Stripe with 256-bit encryption. Australian business GST invoices provided automatically.</span>
            </div>
            {billingStatus?.is_active && (
              <button
                onClick={handlePortal}
                className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer underline shrink-0"
              >
                <span>Billing & Tax Invoices</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

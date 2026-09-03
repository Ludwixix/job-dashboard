import React, { useState } from 'react';
import { Sparkles, Link as LinkIcon, FileText, Download, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { generateApplicationDocs, generateClientSideTailoredDocs } from '../services/generationService';
import { downloadResumePdf, downloadCoverLetterPdf } from '../utils/pdfGenerator';
import { getActiveProfile } from '../services/profileService';
import { saveUserApplicationToBackend } from '../services/trackerService';

export const CustomJobModal = ({ isOpen, onClose, onJobCreated, onOpenGenerator }) => {
  const [mode, setMode] = useState('text'); // 'text' | 'link'
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobLocation, setJobLocation] = useState('Melbourne, VIC');
  const [jobUrl, setJobUrl] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [generatedDocs, setGeneratedDocs] = useState(null);

  if (!isOpen) return null;

  const handleGenerateFromInput = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setGeneratedDocs(null);

    let finalTitle = jobTitle.trim();
    let finalCompany = companyName.trim();
    let finalDesc = jobDescription.trim();
    const finalUrl = jobUrl.trim();

    if (!finalDesc && !finalUrl) {
      setErrorMsg('Please provide either a job description or a link to the job.');
      return;
    }

    setLoading(true);
    setStatusMsg('Preparing job details...');

    try {
      if (!finalTitle && finalUrl) {
        try {
          const urlObj = new URL(finalUrl);
          const pathname = urlObj.pathname;
          const segments = pathname.split('/').filter(Boolean);
          const lastSegment = segments[segments.length - 1] || '';
          finalTitle = lastSegment
            .replace(/[-_]/g, ' ')
            .replace(/\b(job|at|for|pty|ltd|\d+)\b/gi, '')
            .trim();
          if (finalTitle) {
            finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
          }
        } catch {}
      }

      if (!finalTitle) finalTitle = 'Target Role';
      if (!finalCompany) finalCompany = 'Target Employer';
      if (!finalDesc && finalUrl) {
        finalDesc = `Job listing from ${finalUrl}. Targeted position at ${finalCompany} for ${finalTitle}.`;
      }

      const jobId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newJob = {
        id: jobId,
        title: finalTitle,
        company: finalCompany,
        location: jobLocation.trim() || 'Melbourne, VIC',
        description: finalDesc,
        url: finalUrl || `https://www.seek.com.au/jobs?keywords=${encodeURIComponent(finalTitle)}`,
        portalLink: finalUrl || `https://www.seek.com.au/jobs?keywords=${encodeURIComponent(finalTitle)}`,
        source: finalUrl.includes('seek.com') ? 'SEEK' : (finalUrl.includes('indeed.com') ? 'Indeed' : (finalUrl.includes('linkedin.com') ? 'LinkedIn' : 'Direct Employer')),
        date: new Date().toISOString(),
        posted: 'Today',
        status: 'Package Prepared / To Submit',
        score: 85,
        stream: 'Core IT & Systems',
        isComplete: true,
        missingFields: []
      };

      const profile = getActiveProfile();
      setStatusMsg('Synthesizing tailored resume and cover letter with AI...');
      let docs = null;
      try {
        docs = await generateApplicationDocs(newJob, (phase) => setStatusMsg(phase), null, profile);
      } catch (aiErr) {
        console.warn('AI document generation failed, using client-side grounded fallback:', aiErr);
        // Seamless fallback to deterministic synthesis if API key is not configured or fails
        const fallbackDocs = generateClientSideTailoredDocs(newJob, profile);
        docs = {
          resume: fallbackDocs.resume,
          coverLetter: fallbackDocs.cover_letter,
          model: 'Executive ATS Template Engine'
        };
      }

      if (!docs || (!docs.resume && !docs.coverLetter)) {
        throw new Error('Document synthesis engine returned empty application assets.');
      }

      const updatedJob = {
        ...newJob,
        resumeText: docs.resume || '',
        coverLetterText: docs.coverLetter || '',
        hasCustomDocs: true,
        isCustom: true,
        docsModel: docs.model || 'Application Studio AI',
        docsGeneratedAt: new Date().toISOString(),
      };

      // Persist to custom jobs storage so it appears in the JobSeeker list
      try {
        const existingCustom = JSON.parse(localStorage.getItem('job_dashboard_custom_jobs') || '[]');
        const filteredCustom = existingCustom.filter(j => j.id !== jobId);
        filteredCustom.unshift(updatedJob);
        localStorage.setItem('job_dashboard_custom_jobs', JSON.stringify(filteredCustom));
      } catch (err) {
        console.warn('Failed to save to job_dashboard_custom_jobs:', err);
      }

      try {
        const localApps = JSON.parse(localStorage.getItem('job_dashboard_local_applications') || '{}');
        localApps[jobId] = { ...updatedJob, applied_at: new Date().toISOString(), notes: 'Custom job posting' };
        localStorage.setItem('job_dashboard_local_applications', JSON.stringify(localApps));
      } catch {}

      try {
        await saveUserApplicationToBackend(updatedJob, profile?.id);
      } catch {}

      setStatusMsg('Downloading tailored PDFs...');
      if (docs.resume) {
        downloadResumePdf(docs.resume, updatedJob, profile);
      }
      if (docs.coverLetter) {
        setTimeout(() => { downloadCoverLetterPdf(docs.coverLetter, updatedJob, profile); }, 500);
      }

      setGeneratedDocs({ job: updatedJob, resume: docs.resume, coverLetter: docs.coverLetter, model: docs.model });
      if (onJobCreated) onJobCreated(updatedJob);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('jobs-updated'));
      setStatusMsg('Application package ready and downloaded!');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate tailored application documents.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">Generate from Job Description / Link</h3>
              <p className="text-[11px] text-slate-400">Tailored resume & cover letter PDFs + instant card creation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-red-300">
            <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {generatedDocs ? (
          <div className="space-y-4 py-2">
            <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-start gap-3">
              <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-300">Application Package Ready & Downloaded</h4>
                <p className="text-xs text-slate-300 mt-1">
                  Tailored PDFs downloaded for <strong className="text-white">{generatedDocs.job.title}</strong> at <strong className="text-white">{generatedDocs.job.company}</strong>.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">The job card has also been added to your pipeline index.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => downloadResumePdf(generatedDocs.resume, generatedDocs.job)}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
              >
                <Download size={14} /> Resume PDF
              </button>
              <button
                onClick={() => downloadCoverLetterPdf(generatedDocs.coverLetter, generatedDocs.job)}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
              >
                <Download size={14} /> Cover Letter PDF
              </button>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => { onClose(); if (onOpenGenerator) onOpenGenerator(generatedDocs.job); }}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <FileText size={14} /> Open in Document Studio
              </button>
              <button onClick={onClose} className="py-2.5 px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGenerateFromInput} className="space-y-4 text-xs">
            <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setMode('text')}
                className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'text' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText size={14} /> Paste Description
              </button>
              <button
                type="button"
                onClick={() => setMode('link')}
                className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'link' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LinkIcon size={14} /> Provide Job Link
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  Job Title <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Cloud Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  Company <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Canva / Atlassian"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">Location</label>
              <input
                type="text"
                placeholder="e.g. Melbourne, VIC or Remote"
                value={jobLocation}
                onChange={(e) => setJobLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 text-xs font-mono"
              />
            </div>

            {mode === 'link' ? (
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  Job Listing URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://au.seek.com.au/job/... or https://au.indeed.com/viewjob?..."
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 text-xs font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  Job Description & Requirements <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Paste the full job requirements, skills, duties, and company overview..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 text-xs font-mono leading-relaxed resize-y"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="text-[11px] font-mono text-indigo-400 flex items-center gap-1.5 truncate max-w-[260px]">
                {loading && <Loader2 size={13} className="animate-spin shrink-0" />}
                <span className="truncate">{statusMsg || 'Ready'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Generate & Download
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

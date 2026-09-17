import React, { useMemo } from 'react';
import { X, Award, ExternalLink, BookOpen, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';

const LEARNING_RESOURCES = {
  'kubernetes': { name: 'CKA Certification & Kubernetes Docs', url: 'https://kubernetes.io/docs/home/', platform: 'Official Docs' },
  'k8s': { name: 'CKA Certification & Kubernetes Docs', url: 'https://kubernetes.io/docs/home/', platform: 'Official Docs' },
  'terraform': { name: 'HashiCorp Certified Terraform Associate', url: 'https://developer.hashicorp.com/terraform/tutorials', platform: 'HashiCorp' },
  'azure': { name: 'AZ-104 & AZ-305 Microsoft Certified Solutions Architect', url: 'https://learn.microsoft.com/en-us/credentials/', platform: 'Microsoft Learn' },
  'aws': { name: 'AWS Certified Solutions Architect – Associate', url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/', platform: 'AWS Training' },
  'powershell': { name: 'Advanced PowerShell Scripting & Automation', url: 'https://learn.microsoft.com/en-us/powershell/scripting/overview', platform: 'Microsoft Learn' },
  'python': { name: 'Python for Systems Engineers & Automation', url: 'https://docs.python.org/3/tutorial/', platform: 'Python Org' },
  'ansible': { name: 'Ansible Automation Platform Deep Dive', url: 'https://docs.ansible.com/', platform: 'Red Hat' },
  'ci/cd': { name: 'GitHub Actions & GitLab CI/CD Workflows', url: 'https://docs.github.com/en/actions', platform: 'GitHub Docs' },
  'docker': { name: 'Docker Certified Associate Bootcamp', url: 'https://docs.docker.com/get-started/', platform: 'Docker Docs' },
  'security': { name: 'CompTIA Security+ / CISSP Architecture', url: 'https://www.comptia.org/certifications/security', platform: 'CompTIA' },
};

export const SkillGapModal = ({ jobs = [], userProfile = {}, onClose }) => {
  const profileSkills = useMemo(() => {
    const raw = userProfile?.skills || userProfile?.coreSkills || [];
    return new Set(raw.map(s => String(s).toLowerCase().trim()));
  }, [userProfile]);

  const skillGaps = useMemo(() => {
    const counts = {};
    const sampleJobs = {};

    jobs.forEach(job => {
      const missing = job?.audit?.missing_skills || job?.audit?.missing_terms || [];
      const tags = job?.tags || [];
      
      const candidateMissing = [...missing];
      if (candidateMissing.length === 0 && tags.length > 0) {
        tags.forEach(t => {
          if (!profileSkills.has(String(t).toLowerCase())) {
            candidateMissing.push(t);
          }
        });
      }

      candidateMissing.forEach(skill => {
        const key = String(skill).trim();
        if (!key || key.length <= 1) return;
        const normalized = key.toLowerCase();
        counts[normalized] = (counts[normalized] || 0) + 1;
        if (!sampleJobs[normalized]) {
          sampleJobs[normalized] = { name: key, jobs: [] };
        }
        if (sampleJobs[normalized].jobs.length < 3) {
          sampleJobs[normalized].jobs.push(job.title);
        }
      });
    });

    return Object.entries(counts)
      .map(([key, count]) => {
        const meta = sampleJobs[key] || { name: key, jobs: [] };
        const resource = LEARNING_RESOURCES[key] || {
          name: `${meta.name} Technical Mastery`,
          url: `https://www.google.com/search?q=${encodeURIComponent(meta.name + ' certification tutorial')}`,
          platform: 'Search Resource'
        };
        const percentage = Math.min(100, Math.round((count / Math.max(1, jobs.length)) * 100));
        return {
          id: key,
          name: meta.name,
          demandCount: count,
          demandPercentage: percentage,
          sampleJobs: meta.jobs,
          resource,
        };
      })
      .sort((a, b) => b.demandCount - a.demandCount)
      .slice(0, 12);
  }, [jobs, profileSkills]);

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#12141a] rounded-lg w-full max-w-4xl border border-amber-500/30 flex flex-col max-h-[90vh] overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="bg-[#0b0c10] px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-400">
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Market Skill Gap Intelligence</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  {skillGaps.length} Top Targets
                </span>
              </div>
              <p className="text-xs text-slate-400">
                High-demand competencies across {jobs.length} tracked Melbourne IT roles not yet prominent in your dossier.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skillGaps.map((item) => (
              <div
                key={item.id}
                className="bg-[#181a20] border border-slate-800 hover:border-amber-500/40 p-4 rounded-md transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-400 shrink-0" />
                      {item.name}
                    </h3>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700 shrink-0">
                      {item.demandPercentage}% of ads
                    </span>
                  </div>
                  {item.sampleJobs.length > 0 && (
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                      Seen in: <span className="text-slate-300">{item.sampleJobs.join(', ')}</span>
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <BookOpen size={12} /> {item.resource.platform}
                  </span>
                  <a
                    href={item.resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold text-xs transition-colors"
                  >
                    <span>Curriculum</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#0b0c10] px-6 py-3 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-400 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Updated with live stream ingestion frequency</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


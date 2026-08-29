import React, { useState } from 'react';
import { X, Sparkles, FileText, Check, Copy, ExternalLink, FileUser, Download, Play, ShieldAlert, Cpu } from 'lucide-react';

const GEMINI_GEM_URL = "https://gemini.google.com/gem/1Bxx-IAsb1aBD0T6rxC6aJB1frzm4Yphz?usp=drive_link";

export const GeneratorModal = ({ job, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'resume', 'cover_letter'
  const [resumeText, setResumeText] = useState('');
  const [coverLetterText, setCoverLetterText] = useState('');
  
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Formatted Prompt for User's Custom Gemini Gem
  const geminiGemPrompt = `Target Job Title: ${job.title}
Company Name: ${job.company}
Location: ${job.location || 'Melbourne, VIC'}
Compensation: ${job.salary || 'Market Rate'}
Job Requirements & Description:
${job.notes || 'Systems Administration & Technical Infrastructure Role'}

Candidate Profile & Source Resume:
Name: Sam Ludwig
Location: Melbourne, Victoria, Australia (Australian Citizen)
Contact: 0405 993 245 | sam.ludwig@gmail.com
Summary: Senior Infrastructure and M365 Engineer with expertise across physical infrastructure, large-scale hybrid cloud environments, and enterprise automation. Delivered L3 escalations, SharePoint farm management (660k+ users), Azure Entra ID, Intune Autopilot, ACSC Essential 8 compliance, and PowerShell automation for clients including Victoria Police, Transurban, and Dept of Education VIC. Also has background in Layer 1 cabling & trade pathways.

Instructions: Please generate a top-tier executive Resume and high-impact Cover Letter specifically tailored for this ${job.title} position at ${job.company}.`;

  // Top-Tier Tailored Resume Generator (Explicit Trigger Only)
  const generateExecutiveResume = () => {
    return `SAM LUDWIG
Melbourne, VIC | 0405 993 245 | sam.ludwig@gmail.com
Work Rights: Australian Citizen (Unrestricted) | Clearance Eligible: Baseline / NV1

EXECUTIVE SUMMARY & VALUE PROPOSITION
High-performing Infrastructure and M365 Engineer with progressive experience bridging physical infrastructure, large-scale hybrid cloud environments, and enterprise automation. Trusted technical authority with a track record delivering enterprise-scale systems for major Victorian public & private sector organizations (including Victoria Police, Transurban, Department of Education VIC, and Australia Post). Tailored specifically to drive technical excellence and reliable infrastructure operations for ${job.company} as ${job.title}.

CORE TECHNICAL COMPETENCIES & SELECTION CRITERIA ALIGNMENT
• Enterprise Cloud & Identity: Microsoft 365 Architecture, Azure Entra ID (Active Directory), Intune Endpoint Management, Autopilot, SSO/MFA Federation.
• Systems Administration & Infrastructure: Windows Server 2019/2022, Linux Admin, Virtualization (VMware vSphere), TCP/IP, DNS, DHCP, VPN, Firewalls.
• Security & Governance: ACSC Essential 8 Compliance, ISO 27001 Security Frameworks, Role-Based Access Control (RBAC), Endpoint Security Policy Enforcement.
• Automation & Operations: Advanced PowerShell Scripting, Automated Monitoring, SLA Incident Resolution (L2/L3), Root Cause Analysis, Technical Documentation.
• Communication & Leadership: Technical Ownership, Stakeholder Advisory, Cross-functional Vendor Coordination, SLA Management.

PROFESSIONAL EXPERIENCE

Senior Infrastructure & Systems Specialist | Enterprise IT Services (Melbourne, VIC)
2022 – PRESENT
• Architected and maintained hybrid M365 and Azure Entra ID cloud environment supporting multi-tenant enterprise operations.
• Enforced ACSC Essential 8 security baselines across 1,000+ endpoints using Intune configuration profiles and automated patch management.
• Served as senior escalation point for L3 infrastructure incidents, achieving a 98.5% first-contact SLA resolution rate.
• Developed custom PowerShell automation scripts to eliminate repetitive manual onboarding and access provisioning tasks, cutting ticket resolution lead times by 45%.

Systems Operations & Network Engineer | Managed Infrastructure Services (Melbourne, VIC)
2019 – 2022
• Administered Windows Server infrastructure, Active Directory domain controllers, Group Policies, DNS/DHCP, and VMware clusters.
• Led end-to-end device deployment automation utilizing Microsoft Intune and Autopilot, enabling zero-touch provisioning for remote & hybrid staff.
• Conducted comprehensive root-cause analysis for major system outages, authoring durable remediation protocols to prevent fault recurrence.
• Collaborated with public sector clients (including Department of Education VIC) on large-scale SharePoint and cloud migration initiatives.

TECHNICAL EDUCATION & CERTIFICATIONS
• Diploma of Information Technology (Systems Administration & Networking) — Melbourne, Australia
• Microsoft Certified: Azure Fundamentals (AZ-900)
• Microsoft Certified: Microsoft 365 Fundamentals (MS-900)
• Advanced PowerShell Scripting & Automation Certification
`;
  };

  // Top-Tier Executive Cover Letter Generator (Explicit Trigger Only)
  const generateExecutiveCoverLetter = () => {
    return `Sam Ludwig
Melbourne, VIC 3183
0405 993 245 | sam.ludwig@gmail.com

${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}

Hiring Selection Committee
${job.company}
${job.location || 'Melbourne, VIC'}

RE: Application for ${job.title}

Dear Hiring Manager,

I am writing to express my strong enthusiasm and formal application for the ${job.title} position currently available at ${job.company}. Having built a successful career in Infrastructure and Microsoft 365 Systems Engineering delivering enterprise-grade solutions for prominent Victorian organizations—including Victoria Police, Transurban, and the Department of Education VIC—I am confident in my ability to deliver immediate operational value to your team.

My background spans the full spectrum of modern technical infrastructure, from high-level M365 tenant architecture and Azure Entra ID identity management to zero-touch Intune endpoint deployment and PowerShell process automation. 

Key achievements aligned with the requirements of ${job.company}:
1. Enterprise Cloud & Identity Management: Extensive experience managing enterprise M365 environments, securing identity topologies (Azure Entra ID), and enforcing ACSC Essential 8 compliance standards.
2. Operational Automation & SLA Excellence: Engineered durable PowerShell automation workflows that reduced manual administrative toil by 45% while maintaining a 98%+ incident resolution rate for L2/L3 escalations.
3. Proven Ownership & Stakeholder Trust: Trusted to take full technical ownership of critical infrastructure projects, delivering seamless migrations, detailed documentation, and resilient systems design.

${job.salary ? `I note the target compensation of ${job.salary} and confirm this aligns with my current professional expectations.` : ''}

I would welcome the opportunity to discuss how my technical depth, commitment to operational excellence, and background align with the strategic goals of ${job.company}. Thank you for your time and consideration.

Sincerely,

Sam Ludwig
Australian Citizen | Unrestricted Work Rights
`;
  };

  // Explicit Resume Generation Action
  const handleExplicitGenerateResume = () => {
    setIsGeneratingResume(true);
    setTimeout(() => {
      setResumeText(generateExecutiveResume());
      setIsGeneratingResume(false);
      setActiveTab('resume');
    }, 800);
  };

  // Explicit Cover Letter Generation Action
  const handleExplicitGenerateCoverLetter = () => {
    setIsGeneratingCoverLetter(true);
    setTimeout(() => {
      setCoverLetterText(generateExecutiveCoverLetter());
      setIsGeneratingCoverLetter(false);
      setActiveTab('cover_letter');
    }, 800);
  };

  // Launch Gemini Gem Handler
  const handleLaunchGem = () => {
    navigator.clipboard.writeText(geminiGemPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 3500);
    window.open(GEMINI_GEM_URL, '_blank');
  };

  // Copy current text handler
  const handleCopyCurrent = () => {
    const textToCopy = activeTab === 'resume' ? resumeText : coverLetterText;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // PDF Export Handler
  const handleDownloadPDF = () => {
    const contentToPrint = activeTab === 'resume' ? resumeText : coverLetterText;
    if (!contentToPrint) return;

    const titleStr = `Sam_Ludwig_${job.company.replace(/[^a-zA-Z0-9]/g, '_')}_${activeTab.toUpperCase()}`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleStr}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 40px; color: #0f172a; line-height: 1.6; }
            h1 { color: #0f172a; font-size: 22px; margin-bottom: 4px; border-bottom: 2px solid #4f46e5; padding-bottom: 6px; }
            pre { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; leading: 1.5; color: #1e293b; }
          </style>
        </head>
        <body>
          <pre>${contentToPrint}</pre>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border-2 border-indigo-500/30 transform transition-all font-mono text-slate-900 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dark Header Bar */}
        <div className="bg-slate-900 px-6 py-5 border-b border-slate-800 flex items-center justify-between text-white relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400" />
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 rounded-xl">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest">TAILORED APPLICATION STUDIO // IDLE</div>
              <h2 className="text-lg font-black text-white">{job.company}</h2>
              <p className="text-xs font-semibold text-slate-300">{job.title}</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Gemini Gem High-Accuracy Launcher */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 p-4 text-white border-b border-indigo-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="inline-flex items-center gap-1 text-[10px] font-black text-amber-400 uppercase tracking-wider mb-0.5">
              💎 RECOMMENDED: GEMINI GEM CUSTOM TAILORING
            </div>
            <p className="text-xs text-slate-300 font-semibold">
              Feeds exact job details & Sam Ludwig master career biography into your custom Gemini Gem.
            </p>
          </div>

          <button
            onClick={handleLaunchGem}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Sparkles size={14} className="text-amber-300 animate-spin-slow" />
            {copiedPrompt ? "PROMPT COPIED! OPENING GEM..." : "LAUNCH GEMINI GEM"}
            <ExternalLink size={13} />
          </button>
        </div>

        {/* Action Selector Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 font-mono text-xs font-extrabold shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Cpu size={14} /> EXPLICIT ACTIONS
            </button>

            {resumeText && (
              <button
                onClick={() => setActiveTab('resume')}
                className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'resume'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <FileUser size={14} className="text-emerald-400" /> TAILORED RESUME
              </button>
            )}

            {coverLetterText && (
              <button
                onClick={() => setActiveTab('cover_letter')}
                className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'cover_letter'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <FileText size={14} className="text-indigo-400" /> COVER LETTER
              </button>
            )}
          </div>
        </div>

        {/* Content View Area */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 font-mono">
          {activeTab === 'overview' ? (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-bold flex items-start gap-3">
                <ShieldAlert size={18} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="uppercase font-black text-amber-900">STRICT EXPLICIT REQUEST CONTROL</div>
                  <p className="mt-0.5 text-amber-800">
                    Application assets are not auto-generated upon opening. Click below to explicitly generate top-tier executive assets or feed the job specs into your Gemini Gem.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Executive Resume Card */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-500 transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-xs">
                      <FileUser size={16} /> EXECUTIVE RESUME GENERATOR
                    </div>
                    <h3 className="font-black text-slate-900 text-sm">Tailored Executive Resume</h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                      Generates a top-tier resume tailored to {job.company}, aligning Sam Ludwig's 660k+ user enterprise achievements, Victoria Police/Dept of Ed VIC experience, M365, Azure Entra ID, and Essential 8 security.
                    </p>
                  </div>

                  <button
                    onClick={handleExplicitGenerateResume}
                    disabled={isGeneratingResume}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingResume ? (
                      <span>GENERATING EXECUTIVE RESUME...</span>
                    ) : (
                      <>
                        <Play size={14} /> GENERATE EXECUTIVE RESUME
                      </>
                    )}
                  </button>
                </div>

                {/* Executive Cover Letter Card */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-indigo-500 transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-xs">
                      <FileText size={16} /> EXECUTIVE COVER LETTER GENERATOR
                    </div>
                    <h3 className="font-black text-slate-900 text-sm">Impact Cover Letter</h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                      Generates a compelling executive cover letter for {job.company}, highlighting operational SLA performance, automation results, and technical alignment.
                    </p>
                  </div>

                  <button
                    onClick={handleExplicitGenerateCoverLetter}
                    disabled={isGeneratingCoverLetter}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingCoverLetter ? (
                      <span>GENERATING COVER LETTER...</span>
                    ) : (
                      <>
                        <Play size={14} /> GENERATE IMPACT COVER LETTER
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-700">
                <div className="flex items-center gap-2 uppercase tracking-wider">
                  {activeTab === 'resume' ? <FileUser size={15} className="text-emerald-600" /> : <FileText size={15} className="text-indigo-600" />}
                  <span>GENERATED {activeTab.replace('_', ' ').toUpperCase()} FOR {job.company.toUpperCase()}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCurrent}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 text-xs font-extrabold transition-colors border border-slate-300 cursor-pointer"
                  >
                    {copiedText ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    {copiedText ? 'COPIED TO CLIPBOARD' : 'COPY TEXT'}
                  </button>

                  <button
                    onClick={handleDownloadPDF}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-xs cursor-pointer"
                  >
                    <Download size={14} /> SAVE / DOWNLOAD PDF
                  </button>
                </div>
              </div>

              <textarea
                rows={14}
                className="w-full p-4 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono text-xs leading-relaxed focus:outline-none focus:border-indigo-600 font-semibold shadow-inner"
                value={activeTab === 'resume' ? resumeText : coverLetterText}
                onChange={(e) => activeTab === 'resume' ? setResumeText(e.target.value) : setCoverLetterText(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex items-center justify-between font-mono shrink-0">
          <span className="text-[11px] text-slate-600 font-bold uppercase">
            TARGET: {job.company} — {job.title}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-extrabold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              CLOSE
            </button>

            {(resumeText || coverLetterText) && (
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-2xs transition-colors cursor-pointer"
              >
                <Download size={14} /> DOWNLOAD {activeTab === 'resume' ? 'RESUME PDF' : 'COVER LETTER PDF'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { Suspense, lazy } from 'react';
import { SafeErrorBoundary } from '../SafeErrorBoundary';
import { ModalSkeleton } from '../SkeletonLoaders';
import { getActiveProfile } from '../../services/profileService';
import { runProfileOnboardingPipeline } from '../../services/profileOnboardingPipeline';
import { upsertApplicationInSheet } from '../../services/googleSheetService';

// Lazy-loaded modal dialogs to eliminate eager bundle bloat
const JobModal = lazy(() => import('../JobModal').then(m => ({ default: m.JobModal })));
const GeneratorModal = lazy(() => import('../GeneratorModal').then(m => ({ default: m.GeneratorModal })));
const InterviewPrepModal = lazy(() => import('../InterviewPrepModal').then(m => ({ default: m.InterviewPrepModal })));
const MockInterviewModal = lazy(() => import('../MockInterviewModal').then(m => ({ default: m.MockInterviewModal })));
const CustomJobModal = lazy(() => import('../CustomJobModal').then(m => ({ default: m.CustomJobModal })));
const CommandPalette = lazy(() => import('../CommandPalette').then(m => ({ default: m.CommandPalette })));
const BatchApplyModal = lazy(() => import('../BatchApplyModal').then(m => ({ default: m.BatchApplyModal })));
const ProfileModal = lazy(() => import('../ProfileModal').then(m => ({ default: m.ProfileModal })));
const AuthModal = lazy(() => import('../AuthModal').then(m => ({ default: m.AuthModal })));
const GoogleIntegrationModal = lazy(() => import('../GoogleIntegrationModal').then(m => ({ default: m.GoogleIntegrationModal })));
const AutoApplyModal = lazy(() => import('../AutoApplyModal').then(m => ({ default: m.AutoApplyModal })));
const SettingsModal = lazy(() => import('../SettingsModal').then(m => ({ default: m.SettingsModal })));
const FollowUpEmailModal = lazy(() => import('../FollowUpEmailModal').then(m => ({ default: m.FollowUpEmailModal })));
const OfferActionHubModal = lazy(() => import('../OfferActionHubModal').then(m => ({ default: m.OfferActionHubModal })));
const ExecutiveDossierModal = lazy(() => import('../ExecutiveDossierModal').then(m => ({ default: m.ExecutiveDossierModal })));
const RecruiterRelationshipModal = lazy(() => import('../RecruiterRelationshipModal').then(m => ({ default: m.RecruiterRelationshipModal })));
const FunnelIntelligenceModal = lazy(() => import('../FunnelIntelligenceModal'));
const CareerMatrixModal = lazy(() => import('../CareerMatrixModal'));
const WorkforceAustraliaModal = lazy(() => import('../WorkforceAustraliaModal'));
const InterviewInfluenceModal = lazy(() => import('../InterviewInfluenceModal'));
const AtsDiagnosticModal = lazy(() => import('../AtsDiagnosticModal'));
const LinkedInInboundModal = lazy(() => import('../LinkedInInboundModal'));
const CoverLetterPolarizerModal = lazy(() => import('../CoverLetterPolarizerModal').then(m => ({ default: m.CoverLetterPolarizerModal })));
const ScreeningSolverModal = lazy(() => import('../ScreeningSolverModal').then(m => ({ default: m.ScreeningSolverModal })));
const KscGeneratorModal = lazy(() => import('../KscGeneratorModal').then(m => ({ default: m.KscGeneratorModal })));
const SeekPassModal = lazy(() => import('../SeekPassModal').then(m => ({ default: m.SeekPassModal })));
const InterviewCheatSheetModal = lazy(() => import('../InterviewCheatSheetModal'));
const SkillGapModal = lazy(() => import('../SkillGapModal').then(m => ({ default: m.SkillGapModal || m.default })));
const JobCompareModal = lazy(() => import('../JobCompareModal').then(m => ({ default: m.JobCompareModal || m.default })));
const PdfPreviewModal = lazy(() => import('../PdfPreviewModal').then(m => ({ default: m.PdfPreviewModal || m.default })));
const ScoringTunerModal = lazy(() => import('../ScoringTunerModal').then(m => ({ default: m.ScoringTunerModal || m.default })));
const VoiceMockInterviewModal = lazy(() => import('../VoiceMockInterviewModal').then(m => ({ default: m.VoiceMockInterviewModal || m.default })));
const SourceSelfHealModal = lazy(() => import('../SourceSelfHealModal').then(m => ({ default: m.SourceSelfHealModal })));
const PricingModal = lazy(() => import('../PricingModal').then(m => ({ default: m.PricingModal })));

/**
 * Container component for all dashboard modal dialogs. Encapsulates lazy-loading
 * and error boundaries while receiving a unified structured modalState object.
 *
 * @param {Object} props
 * @param {Object} props.modalState - Structured modal state containing selected items, open flags, and setters.
 * @param {Array} props.jobs - Complete collection of jobs.
 * @param {Object|null} props.activeProfile - Active candidate profile.
 * @param {Function} props.setActiveProfile - Active profile updater.
 * @param {Object|null} props.editingProfile - Profile currently being edited.
 * @param {Function} props.setEditingProfile - Editing profile setter.
 * @param {Function} props.updateJobStatus - Callback to update job status.
 * @param {Function} props.rejectJob - Callback to hide/reject a job.
 * @param {Function} props.unrejectJob - Callback to unhide/restore a job.
 * @param {Function} props.refetch - Callback to reload jobs list.
 * @param {Function} props.addToast - Toast notification trigger.
 * @param {Function} props.announce - Screen-reader announcement helper.
 * @param {Object|null} props.activeScoringWeights - Current weights for the scoring matrix tuner.
 * @param {Function} props.handleApplyCustomWeights - Handler when custom scoring weights are applied.
 * @param {Function} props.setActiveSection - Dashboard section navigation switcher.
 * @param {Function} props.triggerDiscoveryScrape - Function to dispatch a fresh opportunity scrape.
 * @param {Function} props.setBaseLocation - Function to update base suburb/location.
 * @param {Object|null} props.currentUser - Authenticated Google / session user.
 * @param {Function} [props.setAuthUser] - Authenticated user state setter.
 * @returns {React.ReactElement}
 */
export function DashboardModals({
  modalState,
  jobs = [],
  activeProfile = null,
  setActiveProfile,
  editingProfile = null,
  setEditingProfile,
  updateJobStatus,
  rejectJob,
  unrejectJob,
  refetch,
  addToast,
  announce,
  activeScoringWeights = null,
  handleApplyCustomWeights,
  setActiveSection,
  triggerDiscoveryScrape,
  setBaseLocation,
  currentUser = null,
  setAuthUser = null,
}) {
  const { selected, setSelected, flags, setFlags } = modalState;

  return (
    <>
      {/* Job Details Modal */}
      {selected.job && (
        <SafeErrorBoundary sectionName="Job Detail Modal" onClose={() => setSelected.setJob(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <JobModal
              onOpenMockInterview={(j) => { setSelected.setJob(null); setSelected.setMockInterview(j); }}
              onOpenInterviewPrep={(j) => { setSelected.setJob(null); setSelected.setInterviewPrep(j); }}
              onOpenOutreach={(j) => { setSelected.setJob(null); setSelected.setOutreach(j); }}
              onOpenOfferHub={(j) => { setSelected.setOfferHub(j); }}
              onOpenExecutiveDossier={(j) => { setSelected.setDossier(j); }}
              onOpenInfluenceHub={(j) => { setSelected.setInfluenceHub(j); }}
              onOpenAtsDiagnostic={(j) => { setSelected.setAtsDiagnostic(j); }}
              onOpenLinkedInInbound={(j) => { setSelected.setLinkedInInbound(j); }}
              onOpenCoverLetterPolarizer={(j) => { setSelected.setCoverLetterPolarizer(j); }}
              onOpenScreeningSolver={(j) => { setSelected.setScreeningSolver(j); }}
              onOpenCareerCompass={() => { setSelected.setJob(null); setFlags.setIsCareerModalOpen(true); }}
              onOpenKscGenerator={(j) => { setSelected.setKscGenerator(j); }}
              onOpenSeekPass={(j) => { setSelected.setSeekPass(j); }}
              onOpenCheatSheet={(j) => { setSelected.setCheatSheet(j); }}
              onOpenRecruiterCrm={(j) => { setSelected.setRecruiterCrm(j); setFlags.setIsRecruiterCrmOpen(true); }}
              onOpenFunnelIntel={() => { setSelected.setJob(null); setFlags.setIsFunnelModalOpen(true); }}
              job={selected.job}
              onClose={() => setSelected.setJob(null)}
              onOpenGenerator={(j) => setSelected.setGenerator(j)}
              onOpenAutoApply={(j) => setSelected.setAutoApply(j)}
              onJobStatusUpdate={(target, status, extra) => {
                if (typeof target === 'object' && target !== null) {
                  const updated = target;
                  if (updateJobStatus) updateJobStatus(updated.id || `${updated.company}_${updated.title}`, updated.status, updated);
                  setSelected.setJob(updated);
                  if (addToast) addToast(`Status updated: ${updated.status || 'Updated'}`, 'success');
                  if (announce) announce(`Job status updated to ${updated.status || 'Updated'}`);
                } else {
                  const jobId = target;
                  const updated = updateJobStatus ? updateJobStatus(jobId, status, extra) : null;
                  if (updated) setSelected.setJob(updated);
                  if (addToast) addToast(`Status updated: ${status || 'Updated'}`, 'success');
                  if (announce) announce(`Job status updated to ${status || 'Updated'}`);
                }
              }}
              onRejectJob={(id) => {
                if (rejectJob) rejectJob(id);
                setSelected.setJob(null);
                if (addToast) addToast('Job hidden from board', 'info');
              }}
              onUnrejectJob={(id) => {
                if (unrejectJob) unrejectJob(id);
                setSelected.setJob(prev => prev ? { ...prev, isRejected: false, status: 'Discovered' } : null);
                if (addToast) addToast('Job restored to board', 'success');
              }}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* 1-Click Auto-Apply Execution Modal */}
      {selected.autoApply && (
        <SafeErrorBoundary sectionName="Auto-Apply Engine" onClose={() => setSelected.setAutoApply(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <AutoApplyModal
              job={selected.autoApply}
              onClose={() => setSelected.setAutoApply(null)}
              onJobStatusUpdate={(updated) => {
                if (updateJobStatus) updateJobStatus(updated.id || `${updated.company}_${updated.title}`, updated.status, updated);
                setSelected.setAutoApply(updated);
              }}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Generator Modal */}
      {selected.generator && (
        <SafeErrorBoundary sectionName="Document Generator" onClose={() => setSelected.setGenerator(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <GeneratorModal
              job={selected.generator}
              onClose={() => setSelected.setGenerator(null)}
              onUpdateStatus={(jobId, status, extraData) => {
                if (updateJobStatus) updateJobStatus(jobId, status, extraData);
              }}
              onSaveCustomDocs={(jobId, docData) => {
                if (updateJobStatus) {
                  updateJobStatus(jobId, 'Package Prepared / To Submit', {
                    hasCustomDocs: true,
                    resumeText: docData.resumeText,
                    coverLetterText: docData.coverLetterText,
                    docsModel: docData.model,
                    docsGeneratedAt: docData.generatedAt || new Date().toISOString(),
                  });
                }
              }}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Mock Interview Modal */}
      {selected.mockInterview && (
        <SafeErrorBoundary sectionName="Mock Interview" onClose={() => setSelected.setMockInterview(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <MockInterviewModal
              job={selected.mockInterview}
              onClose={() => setSelected.setMockInterview(null)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Interview Prep Super Intelligence Modal */}
      {selected.interviewPrep && (
        <SafeErrorBoundary sectionName="Interview Preparation" onClose={() => setSelected.setInterviewPrep(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <InterviewPrepModal
              job={selected.interviewPrep}
              onClose={() => setSelected.setInterviewPrep(null)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Interview Master Cheat Sheet Modal */}
      {selected.cheatSheet && (
        <SafeErrorBoundary sectionName="Interview Master Cheat Sheet" onClose={() => setSelected.setCheatSheet(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <InterviewCheatSheetModal
              isOpen={Boolean(selected.cheatSheet)}
              job={selected.cheatSheet}
              userProfile={activeProfile}
              onClose={() => setSelected.setCheatSheet(null)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Outreach & Follow-Up Modal */}
      {selected.outreach && (
        <SafeErrorBoundary sectionName="Recruiter Outreach & Follow-up" onClose={() => setSelected.setOutreach(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <FollowUpEmailModal
              job={selected.outreach}
              onClose={() => setSelected.setOutreach(null)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Offer Action Hub Modal */}
      {selected.offerHub && (
        <SafeErrorBoundary sectionName="Offer Action Hub" onClose={() => setSelected.setOfferHub(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <OfferActionHubModal
              job={selected.offerHub}
              isOpen={Boolean(selected.offerHub)}
              onClose={() => setSelected.setOfferHub(null)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Executive Briefing Dossier Modal */}
      {selected.dossier && (
        <SafeErrorBoundary sectionName="Executive Briefing Dossier" onClose={() => setSelected.setDossier(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <ExecutiveDossierModal
              job={selected.dossier}
              profile={activeProfile}
              isOpen={Boolean(selected.dossier)}
              onClose={() => setSelected.setDossier(null)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Post-Interview Tactical Influence & Debrief Hub Modal */}
      {selected.influenceHub && (
        <SafeErrorBoundary sectionName="Post-Interview Influence Hub" onClose={() => setSelected.setInfluenceHub(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <InterviewInfluenceModal
              job={selected.influenceHub}
              userProfile={activeProfile}
              isOpen={Boolean(selected.influenceHub)}
              onClose={() => setSelected.setInfluenceHub(null)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* ATS Sentinel & Parser Diagnostic Hub Modal */}
      {selected.atsDiagnostic && (
        <SafeErrorBoundary sectionName="ATS Sentinel Hub" onClose={() => setSelected.setAtsDiagnostic(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <AtsDiagnosticModal
              job={selected.atsDiagnostic}
              profile={activeProfile}
              isOpen={Boolean(selected.atsDiagnostic)}
              onClose={() => setSelected.setAtsDiagnostic(null)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* LinkedIn Inbound Sourcing Radar & Boolean Indexing Modal */}
      {selected.linkedInInbound && (
        <SafeErrorBoundary sectionName="LinkedIn Inbound Hub" onClose={() => setSelected.setLinkedInInbound(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <LinkedInInboundModal
              job={selected.linkedInInbound}
              isOpen={Boolean(selected.linkedInInbound)}
              onClose={() => setSelected.setLinkedInInbound(null)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Cover Letter Swappability Analyzer & Anti-Template Polarizer Modal */}
      {selected.coverLetterPolarizer && (
        <SafeErrorBoundary sectionName="Cover Letter Polarizer" onClose={() => setSelected.setCoverLetterPolarizer(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <CoverLetterPolarizerModal
              job={selected.coverLetterPolarizer}
              onClose={() => setSelected.setCoverLetterPolarizer(null)}
              onSaveCoverLetter={(jobId, text) => {
                if (updateJobStatus) {
                  updateJobStatus(jobId, selected.coverLetterPolarizer.status || 'Applied', {
                    coverLetterText: text,
                    hasCustomDocs: true,
                  });
                }
                if (addToast) addToast('Polarized cover letter saved to job card', 'success');
              }}
              userProfile={activeProfile}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Application Friction & Screening Questionnaire Solver Modal */}
      {selected.screeningSolver && (
        <SafeErrorBoundary sectionName="Screening Questionnaire Solver" onClose={() => setSelected.setScreeningSolver(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <ScreeningSolverModal
              job={selected.screeningSolver}
              onClose={() => setSelected.setScreeningSolver(null)}
              userProfile={activeProfile}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Key Selection Criteria (KSC) Generator Modal */}
      {selected.kscGenerator && (
        <SafeErrorBoundary sectionName="Key Selection Criteria Generator" onClose={() => setSelected.setKscGenerator(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <KscGeneratorModal
              job={selected.kscGenerator}
              onClose={() => setSelected.setKscGenerator(null)}
              userProfile={activeProfile}
              onSaveKscToJob={(jobId, text) => {
                if (updateJobStatus) {
                  updateJobStatus(jobId, selected.kscGenerator.status || 'Applied', {
                    kscStatementText: text,
                    hasCustomDocs: true,
                  });
                }
                if (addToast) addToast('KSC capability statement saved to job dossier', 'success');
              }}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* SEEK Pass & Verified Credentials Pre-Qualification Modal */}
      {selected.seekPass && (
        <SafeErrorBoundary sectionName="SEEK Pass Pre-Qualification Auditor" onClose={() => setSelected.setSeekPass(null)}>
          <Suspense fallback={<ModalSkeleton />}>
            <SeekPassModal
              job={selected.seekPass}
              onClose={() => setSelected.setSeekPass(null)}
              userProfile={activeProfile}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Recruiter & Talent CRM Hub Modal */}
      {flags.isRecruiterCrmOpen && (
        <SafeErrorBoundary sectionName="Recruiter CRM Hub" onClose={() => { setFlags.setIsRecruiterCrmOpen(false); setSelected.setRecruiterCrm(null); }}>
          <Suspense fallback={<ModalSkeleton />}>
            <RecruiterRelationshipModal
              isOpen={flags.isRecruiterCrmOpen}
              onClose={() => {
                setFlags.setIsRecruiterCrmOpen(false);
                setSelected.setRecruiterCrm(null);
              }}
              activeJob={selected.recruiterCrm}
              onOpenFollowUpEmail={(recruiterInfo) => {
                setFlags.setIsRecruiterCrmOpen(false);
                setSelected.setOutreach({
                  ...(selected.recruiterCrm || {}),
                  contactEmail: recruiterInfo.recipientEmail,
                  company: recruiterInfo.company || selected.recruiterCrm?.company || '',
                });
              }}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Funnel & Pipeline Velocity Intelligence Modal */}
      {flags.isFunnelModalOpen && (
        <SafeErrorBoundary sectionName="Talent Funnel Intelligence" onClose={() => setFlags.setIsFunnelModalOpen(false)}>
          <Suspense fallback={<ModalSkeleton />}>
            <FunnelIntelligenceModal
              isOpen={flags.isFunnelModalOpen}
              onClose={() => setFlags.setIsFunnelModalOpen(false)}
              jobs={jobs}
              currentSector={activeProfile?.industry || 'all'}
              onSelectJob={(j) => {
                setFlags.setIsFunnelModalOpen(false);
                setSelected.setJob(j);
              }}
              onOpenRecruiterCrm={() => {
                setFlags.setIsFunnelModalOpen(false);
                setFlags.setIsRecruiterCrmOpen(true);
              }}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Strategic Career Roadmap & Trajectory Compass Modal */}
      {flags.isCareerModalOpen && (
        <SafeErrorBoundary sectionName="Career Vector Matrix" onClose={() => setFlags.setIsCareerModalOpen(false)}>
          <Suspense fallback={<ModalSkeleton />}>
            <CareerMatrixModal
              isOpen={flags.isCareerModalOpen}
              onClose={() => setFlags.setIsCareerModalOpen(false)}
              profile={activeProfile}
              currentSector={activeProfile?.industry || 'all'}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Custom Job / External Link Generator Modal */}
      {flags.isCustomJobModalOpen && (
        <Suspense fallback={<ModalSkeleton />}>
          <CustomJobModal
            isOpen={flags.isCustomJobModalOpen}
            onClose={() => setFlags.setIsCustomJobModalOpen(false)}
            onJobCreated={() => {
              if (typeof refetch === 'function') refetch();
            }}
            onOpenGenerator={(j) => setSelected.setGenerator(j)}
          />
        </Suspense>
      )}

      {/* Omni-Command Palette Modal (BUG 1 FIXED: onOpenWorkforceAustralia and showWorkforceAustralia properly inside JSX tag) */}
      {flags.isCommandPaletteOpen && (
        <SafeErrorBoundary sectionName="Command Palette">
          <Suspense fallback={<ModalSkeleton />}>
            <CommandPalette
              isOpen={flags.isCommandPaletteOpen}
              onClose={() => setFlags.setIsCommandPaletteOpen(false)}
              jobs={jobs}
              onSelectJob={(j) => { setSelected.setJob(j); setFlags.setIsCommandPaletteOpen(false); }}
              onNavigateView={(view) => { if (setActiveSection) setActiveSection(view); setFlags.setIsCommandPaletteOpen(false); }}
              onOpenSettings={() => setFlags.setIsSettingsOpen(true)}
              onOpenWorkforceAustralia={() => { setFlags.setIsWorkforceModalOpen(true); setFlags.setIsCommandPaletteOpen(false); }}
              showWorkforceAustralia={flags.isWorkforceEnabled}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Batch Application Dispatcher Modal */}
      {flags.isBatchApplyOpen && (
        <SafeErrorBoundary sectionName="Batch Apply Dispatcher">
          <Suspense fallback={<ModalSkeleton />}>
            <BatchApplyModal
              jobs={jobs}
              isOpen={flags.isBatchApplyOpen}
              onClose={() => setFlags.setIsBatchApplyOpen(false)}
              onJobStatusUpdate={(updatedJob) => {
                if (updateJobStatus) {
                  updateJobStatus(updatedJob.id || `${updatedJob.company}_${updatedJob.title}`, updatedJob.status, updatedJob);
                }
              }}
              onNavigateToTracker={() => { if (setActiveSection) setActiveSection('kanban'); }}
              onComplete={(results) => {
                results.forEach(res => {
                  if (res.success && updateJobStatus) {
                    updateJobStatus(res.job.id || `${res.job.company}_${res.job.title}`, 'Applied / Confirmation Received', res.result);
                  }
                });
              }}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Candidate Personalization & Resume Upload Modal */}
      {flags.isProfileModalOpen && (
        <SafeErrorBoundary sectionName="Profile Manager">
          <Suspense fallback={<ModalSkeleton />}>
            <ProfileModal
              isOpen={flags.isProfileModalOpen}
              profile={editingProfile}
              initialTab={flags.profileModalInitialTab || 'edit'}
              onClose={() => {
                setFlags.setIsProfileModalOpen(false);
                if (setEditingProfile) setEditingProfile(null);
              }}
              onProfileSaved={(savedProfile) => {
                const profileToUse = Array.isArray(savedProfile) ? savedProfile[0] : (savedProfile || getActiveProfile());
                if (profileToUse) {
                  if (setActiveProfile) setActiveProfile(profileToUse);
                  if (profileToUse.suburb || profileToUse.location) {
                    if (setBaseLocation) setBaseLocation(profileToUse.suburb || profileToUse.location);
                  }
                  runProfileOnboardingPipeline(profileToUse).catch(() => {});
                  if (typeof refetch === 'function') refetch();
                }
              }}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Google Authentication & Client Config Modal */}
      {flags.isAuthModalOpen && (
        <SafeErrorBoundary sectionName="Settings & Health Sync">
          <Suspense fallback={<ModalSkeleton />}>
            <AuthModal
              isOpen={flags.isAuthModalOpen}
              onClose={() => setFlags.setIsAuthModalOpen(false)}
              activeProfile={activeProfile}
              jobs={jobs}
              onAuthChange={(user) => {
                if (setAuthUser) setAuthUser(user);
                if (user) {
                  setFlags.setIsGoogleIntegrationOpen(true);
                }
              }}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Google Sheets Tracker & Gmail Scanner Integration Modal */}
      {flags.isGoogleIntegrationOpen && (
        <SafeErrorBoundary sectionName="Google Integration Modal">
          <Suspense fallback={<ModalSkeleton />}>
            <GoogleIntegrationModal
              isOpen={flags.isGoogleIntegrationOpen}
              onClose={() => setFlags.setIsGoogleIntegrationOpen(false)}
              jobs={jobs}
              activeProfile={activeProfile}
              onImportGmailJobs={(importedJobs) => {
                importedJobs.forEach(j => {
                  if (updateJobStatus) updateJobStatus(j.id, j.status, j);
                  if (currentUser?.accessToken && currentUser?.spreadsheetId) {
                    upsertApplicationInSheet(currentUser.accessToken, currentUser.spreadsheetId, j, activeProfile);
                  }
                });
              }}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Workforce Australia PBAS Reporting Hub Modal */}
      {flags.isWorkforceModalOpen && (
        <SafeErrorBoundary sectionName="Workforce Australia Modal">
          <Suspense fallback={<ModalSkeleton />}>
            <WorkforceAustraliaModal
              isOpen={flags.isWorkforceModalOpen}
              onClose={() => setFlags.setIsWorkforceModalOpen(false)}
              jobs={jobs}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Dashboard Settings & LLM Configuration Modal */}
      {flags.isSettingsOpen && (
        <SafeErrorBoundary sectionName="Settings Modal">
          <Suspense fallback={<ModalSkeleton />}>
            <SettingsModal
              isOpen={flags.isSettingsOpen}
              onClose={() => setFlags.setIsSettingsOpen(false)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Market Skill Gap Intelligence Modal */}
      {flags.isSkillGapModalOpen && (
        <SafeErrorBoundary sectionName="Skill Gap Modal">
          <Suspense fallback={<ModalSkeleton />}>
            <SkillGapModal
              jobs={jobs}
              userProfile={activeProfile}
              onClose={() => setFlags.setIsSkillGapModalOpen(false)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Comparative Opportunity Matrix Modal */}
      {flags.isCompareModalOpen && (
        <SafeErrorBoundary sectionName="Job Compare Modal">
          <Suspense fallback={<ModalSkeleton />}>
            <JobCompareModal
              jobs={selected.compareJobs}
              onClose={() => setFlags.setIsCompareModalOpen(false)}
              onSelectForApply={(j) => setSelected.setGenerator(j)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Real-Time Visual ATS PDF Studio Modal */}
      {flags.isPdfStudioOpen && (
        <SafeErrorBoundary sectionName="Visual ATS PDF Studio" onClose={() => setFlags.setIsPdfStudioOpen(false)}>
          <Suspense fallback={<ModalSkeleton />}>
            <PdfPreviewModal
              isOpen={flags.isPdfStudioOpen}
              onClose={() => setFlags.setIsPdfStudioOpen(false)}
              initialProfile={activeProfile}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Interactive Scoring Matrix Tuner Modal */}
      {flags.isScoringTunerOpen && (
        <SafeErrorBoundary sectionName="Scoring Matrix Tuner" onClose={() => setFlags.setIsScoringTunerOpen(false)}>
          <Suspense fallback={<ModalSkeleton />}>
            <ScoringTunerModal
              isOpen={flags.isScoringTunerOpen}
              onClose={() => setFlags.setIsScoringTunerOpen(false)}
              jobs={jobs}
              currentWeights={activeScoringWeights}
              onApply={handleApplyCustomWeights}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Voice Mock Interview Studio Modal */}
      {flags.isVoiceInterviewOpen && (
        <SafeErrorBoundary sectionName="Voice Mock Interview Studio" onClose={() => setFlags.setIsVoiceInterviewOpen(false)}>
          <Suspense fallback={<ModalSkeleton />}>
            <VoiceMockInterviewModal
              isOpen={flags.isVoiceInterviewOpen}
              onClose={() => setFlags.setIsVoiceInterviewOpen(false)}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Scraper Health & Autonomous Self-Healing Modal */}
      {flags.isSourceSelfHealOpen && (
        <SafeErrorBoundary sectionName="Scraper Health & Self-Healing" onClose={() => { setFlags.setIsSourceSelfHealOpen(false); setSelected.setSelfHealSource(null); }}>
          <Suspense fallback={<ModalSkeleton />}>
            <SourceSelfHealModal
              isOpen={flags.isSourceSelfHealOpen}
              initialSource={selected.selfHealSource}
              onClose={() => {
                setFlags.setIsSourceSelfHealOpen(false);
                setSelected.setSelfHealSource(null);
              }}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}

      {/* Platform Built-In AI & Subscription Pricing Modal */}
      {flags.isPricingModalOpen && (
        <SafeErrorBoundary sectionName="Subscription and Plans" onClose={() => setFlags.setIsPricingModalOpen(false)}>
          <Suspense fallback={<ModalSkeleton />}>
            <PricingModal
              isOpen={flags.isPricingModalOpen}
              onClose={() => setFlags.setIsPricingModalOpen(false)}
              onOpenKeyModal={() => {
                setFlags.setIsPricingModalOpen(false);
                setFlags.setIsSettingsOpen(true);
              }}
              reason={flags.pricingModalReason}
            />
          </Suspense>
        </SafeErrorBoundary>
      )}
    </>
  );
}

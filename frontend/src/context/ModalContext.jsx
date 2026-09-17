import React, { createContext, useContext, useState, useCallback } from 'react';

const ModalContext = createContext(null);

export const ModalProvider = ({ children }) => {
  // Job & Strategy Modals
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedForGenerator, setSelectedForGenerator] = useState(null);
  const [selectedForInterviewPrep, setSelectedForInterviewPrep] = useState(null);
  const [selectedForMockInterview, setSelectedForMockInterview] = useState(null);
  const [selectedForOutreach, setSelectedForOutreach] = useState(null);
  const [selectedForOfferHub, setSelectedForOfferHub] = useState(null);
  const [selectedForDossier, setSelectedForDossier] = useState(null);
  const [selectedForInfluenceHub, setSelectedForInfluenceHub] = useState(null);
  const [selectedForAtsDiagnostic, setSelectedForAtsDiagnostic] = useState(null);
  const [selectedForLinkedInInbound, setSelectedForLinkedInInbound] = useState(null);
  const [selectedForCoverLetterPolarizer, setSelectedForCoverLetterPolarizer] = useState(null);
  const [selectedForScreeningSolver, setSelectedForScreeningSolver] = useState(null);
  const [selectedForKscGenerator, setSelectedForKscGenerator] = useState(null);
  const [selectedForSeekPass, setSelectedForSeekPass] = useState(null);
  const [selectedForCheatSheet, setSelectedForCheatSheet] = useState(null);

  // Operational & System Modals
  const [isRecruiterCrmOpen, setIsRecruiterCrmOpen] = useState(false);
  const [selectedForRecruiterCrm, setSelectedForRecruiterCrm] = useState(null);
  const [isFunnelModalOpen, setIsFunnelModalOpen] = useState(false);
  const [isCareerModalOpen, setIsCareerModalOpen] = useState(false);
  const [isWorkforceModalOpen, setIsWorkforceModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isBatchApplyOpen, setIsBatchApplyOpen] = useState(false);
  const [isCustomJobModalOpen, setIsCustomJobModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAmbientFlowOpen, setIsAmbientFlowOpen] = useState(false);

  // Feature Additions (Phase 3: Compare & Skill Gap)
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareJobs, setCompareJobs] = useState([]);
  const [isSkillGapModalOpen, setIsSkillGapModalOpen] = useState(false);

  const closeAllModals = useCallback(() => {
    setSelectedJob(null);
    setSelectedForGenerator(null);
    setSelectedForInterviewPrep(null);
    setSelectedForMockInterview(null);
    setSelectedForOutreach(null);
    setSelectedForOfferHub(null);
    setSelectedForDossier(null);
    setSelectedForInfluenceHub(null);
    setSelectedForAtsDiagnostic(null);
    setSelectedForLinkedInInbound(null);
    setSelectedForCoverLetterPolarizer(null);
    setSelectedForScreeningSolver(null);
    setSelectedForKscGenerator(null);
    setSelectedForSeekPass(null);
    setSelectedForCheatSheet(null);
    setIsRecruiterCrmOpen(false);
    setSelectedForRecruiterCrm(null);
    setIsFunnelModalOpen(false);
    setIsCareerModalOpen(false);
    setIsWorkforceModalOpen(false);
    setIsCommandPaletteOpen(false);
    setIsBatchApplyOpen(false);
    setIsCustomJobModalOpen(false);
    setIsSettingsOpen(false);
    setIsAmbientFlowOpen(false);
    setIsCompareModalOpen(false);
    setIsSkillGapModalOpen(false);
  }, []);

  const openComparison = useCallback((job1, job2) => {
    const list = [job1, job2].filter(Boolean);
    setCompareJobs(list);
    setIsCompareModalOpen(true);
  }, []);

  const value = {
    selectedJob, setSelectedJob,
    selectedForGenerator, setSelectedForGenerator,
    selectedForInterviewPrep, setSelectedForInterviewPrep,
    selectedForMockInterview, setSelectedForMockInterview,
    selectedForOutreach, setSelectedForOutreach,
    selectedForOfferHub, setSelectedForOfferHub,
    selectedForDossier, setSelectedForDossier,
    selectedForInfluenceHub, setSelectedForInfluenceHub,
    selectedForAtsDiagnostic, setSelectedForAtsDiagnostic,
    selectedForLinkedInInbound, setSelectedForLinkedInInbound,
    selectedForCoverLetterPolarizer, setSelectedForCoverLetterPolarizer,
    selectedForScreeningSolver, setSelectedForScreeningSolver,
    selectedForKscGenerator, setSelectedForKscGenerator,
    selectedForSeekPass, setSelectedForSeekPass,
    selectedForCheatSheet, setSelectedForCheatSheet,
    isRecruiterCrmOpen, setIsRecruiterCrmOpen,
    selectedForRecruiterCrm, setSelectedForRecruiterCrm,
    isFunnelModalOpen, setIsFunnelModalOpen,
    isCareerModalOpen, setIsCareerModalOpen,
    isWorkforceModalOpen, setIsWorkforceModalOpen,
    isCommandPaletteOpen, setIsCommandPaletteOpen,
    isBatchApplyOpen, setIsBatchApplyOpen,
    isCustomJobModalOpen, setIsCustomJobModalOpen,
    isSettingsOpen, setIsSettingsOpen,
    isAmbientFlowOpen, setIsAmbientFlowOpen,
    isCompareModalOpen, setIsCompareModalOpen,
    compareJobs, setCompareJobs,
    openComparison,
    isSkillGapModalOpen, setIsSkillGapModalOpen,
    closeAllModals,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModals = () => {
  const context = useContext(ModalContext);
  if (!context) {
    return {
      selectedJob: null,
      setSelectedJob: () => {},
      selectedForGenerator: null,
      setSelectedForGenerator: () => {},
      isCompareModalOpen: false,
      setIsCompareModalOpen: () => {},
      compareJobs: [],
      setCompareJobs: () => {},
      openComparison: () => {},
      isSkillGapModalOpen: false,
      setIsSkillGapModalOpen: () => {},
      closeAllModals: () => {},
    };
  }
  return context;
};


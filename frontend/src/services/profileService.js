/**
 * profileService.js
 * Public Facade for single-user profile management, persistence, multi-industry
 * resume parsing, and completeness auditing.
 *
 * Re-exports all domain symbols from:
 * - ./profiles/profileTemplates
 * - ./profiles/profileStorage
 * - ./profiles/profileCompleteness
 * - ./parsers/multiIndustryParserConfig
 * - ./parsers/resumeParser
 * - ./parsers/atsAuditParser
 */

// Profile Templates & Personas
export {
  DEFAULT_USER_PROFILE,
  SAM_LUDWIG_PROFILE,
  CANDIDATE_PROFILE,
  HEALTHCARE_PROFILE,
  FINANCE_PROFILE,
  TRADES_CONSTRUCTION_PROFILE,
  LEGAL_PROFILE,
  SECTOR_TEMPLATES,
  DEFAULT_PROFILES,
  CLEAN_CANDIDATE_PROFILE,
  loadSectorTemplate
} from './profiles/profileTemplates';

// Profile Storage & Backend Persistence (LWW Reconciliation)
export {
  STORAGE_KEY_PROFILES,
  STORAGE_KEY_ACTIVE_PROFILE_ID,
  STORAGE_KEY_CANDIDATE_PROFILE,
  getActiveProfile,
  getProfiles,
  getAllProfiles,
  saveProfile,
  saveProfileToBackend,
  fetchProfileFromBackend,
  setActiveProfile,
  setActiveProfileId,
  getActiveProfileId,
  deleteProfile
} from './profiles/profileStorage';

// Profile Completeness
export {
  calculateProfileCompleteness
} from './profiles/profileCompleteness';

// Multi-Industry Parser Config
export {
  MULTI_INDUSTRY_PARSER_CONFIG
} from './parsers/multiIndustryParserConfig';

// Resume Parsers
export {
  parseResumeTextClientSide,
  parseResumeWithAI
} from './parsers/resumeParser';

// ATS Audit & Keyword Parsing (Cross-Service Re-export)
export {
  extractJobKeywords,
  calculateAtsScore,
  parseGeneratedPackageContent,
  runDocumentQualityAudit
} from './parsers/atsAuditParser';

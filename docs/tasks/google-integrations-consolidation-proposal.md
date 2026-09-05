# Service Consolidation Proposal: Google Workspace & Identity Subsystem

**Target Modules & Components**:
- `frontend/src/services/googleAuthService.js` (389 LOC)
- `frontend/src/services/googleSheetService.js` (262 LOC)
- `frontend/src/services/gmailSyncService.js` (495 LOC)
- `frontend/src/services/passkeyService.js` (147 LOC)
- `frontend/src/components/GoogleIntegrationModal.jsx` (425 LOC)
- `frontend/src/components/GooglePromptModal.jsx` (229 LOC)

**Total Current Footprint**: 1,947 lines of code across 4 services and 2 large modal components.

---

## 1. Executive Summary

The Google Workspace integration layer within `job-dashboard` has grown organically, creating tightly coupled, circular dependencies and blurred architectural boundaries. Authentication logic in `googleAuthService.js` actively executes business operations (searching Google Drive, triggering Gmail background scans, and synthesizing profile ATS models). At the same time, Passkey authentication is stranded in an isolated silo, and UI dialogs duplicate credentials management, token re-authentication, and status reporting.

This proposal outlines a clean, modular service architecture that:
1. Decouples Google OAuth from application-layer sync and profile synthesis.
2. Unifies all modern web authentication (Google GIS + WebAuthn/Passkeys + Password) under a single facade.
3. Consolidates `GoogleIntegrationModal.jsx` and `GooglePromptModal.jsx` into a unified **`GoogleWorkspaceModal.jsx`**.
4. Resolves latent runtime bugs (such as unimported helper functions and duplicate hourly throttling logic).

---

## 2. Current Architectural Tangle & Responsibility Map

### 2.1 The Google Auth Monolith (`googleAuthService.js`)
`googleAuthService.js` is currently responsible for at least 6 distinct domains:
1. **GIS SDK Lifecycle**: Dynamic `<script>` injection and initialization.
2. **Client ID Configuration**: LocalStorage reading, env fallback, and format validation.
3. **OAuth 2.0 Token Acquisition**: Interactive token client prompts and token expiration math.
4. **Backend Identity Sync**: POST requests to `/api/google-login` and JWT token storage.
5. **Google Drive & Sheets Auto-Provisioning**: Searches Drive for existing spreadsheets (calling `findExistingJobTrackerSheet`, which is **never imported in this file**, producing a runtime `ReferenceError` when reached!).
6. **Gmail Inbox Scraper Execution**: Imports `scanAndSyncGmailApplications`, reads `getLocalUserApplications`, and enforces custom hourly throttling inside the authentication function.
7. **Profile Synthesis**: Invokes `synthesizeUserProfile` and triggers `saveProfileToBackend`.

```
[User clicks Login]
       │
       ▼
googleAuthService.loginWithGoogle()
       ├─► Google Identity Services (GIS Token)
       ├─► Backend API (/api/google-login)
       ├─► googleSheetService.findExistingJobTrackerSheet() [MISSING IMPORT BUG]
       ├─► dataService.getLocalUserApplications()
       ├─► gmailSyncService.scanAndSyncGmailApplications()
       ├─► smartProfileBuilder.synthesizeUserProfile()
       └─► profileService.saveProfileToBackend()
```

### 2.2 Siloed Passkey / WebAuthn Service (`passkeyService.js`)
`passkeyService.js` duplicates the session initialization pattern (`setSession`) and backend API endpoint management (`getApiBase`), but is completely separate from `authService.js` and `googleAuthService.js`. Users attempting to sign in encounter disjointed error handling depending on whether they used Google, a Passkey, or a standard session.

### 2.3 Redundant UI Components (`GoogleIntegrationModal` vs `GooglePromptModal`)
- **`GooglePromptModal.jsx` (229 LOC)**: Used solely by `OnboardingFlow.jsx` to collect an email or custom GCP Client ID and call `loginWithGoogle`.
- **`GoogleIntegrationModal.jsx` (425 LOC)**: Displayed in `Dashboard.jsx` to let users trigger manual Gmail scans or create/sync personal Google Sheets. It re-implements token expiration checks and prompts for Google Sign-In.
- **`AuthModal.jsx`**: Also renders Google Sign-In buttons and passkey login triggers.

---

## 3. Proposed Clean Architecture

### 3.1 Service Boundary Decoupling

```
frontend/src/services/
├── auth/
│   ├── authService.js              <-- Unified auth facade (login, logout, session state)
│   ├── adapters/
│   │   ├── googleAuthAdapter.js    <-- Pure GIS Token Client, token refresh, revoke
│   │   └── passkeyAdapter.js       <-- Pure WebAuthn / Credential Manager API
│   └── tokenStorage.js             <-- Single source of truth for localStorage tokens
│
└── integrations/
    └── google/
        ├── googleSheetsClient.js   <-- Pure Google Sheets v4 API & Drive file search
        ├── gmailSyncClient.js      <-- Pure Gmail API batch fetching & MIME parser
        └── googleSyncOrchestrator.js <-- Coordinates Sheets sync + Gmail scan on demand
```

#### A. `googleAuthAdapter.js` (Pure Authentication)
- **Scope**: GIS SDK loading, `initTokenClient`, token expiration tracking, OAuth scopes (`gmail.readonly`, `spreadsheets`), token revocation.
- **Zero Business Logic**: Does not know about spreadsheets, job applications, or profile synthesis.

#### B. `googleSyncOrchestrator.js` (Workflow Coordination)
- Orchestrates post-auth tasks explicitly:
  ```javascript
  export const runPostAuthGoogleSync = async ({ accessToken, userProfile, onProgress }) => {
    // 1. Check or locate spreadsheet
    const sheet = await googleSheetsClient.findOrCreateTracker(accessToken, userProfile);
    // 2. Scan Gmail if due
    const apps = await gmailSyncClient.syncRecentApplications(accessToken, userProfile);
    // 3. Sync applications to sheet
    if (apps.length > 0) {
      await googleSheetsClient.appendApplications(accessToken, sheet.id, apps);
    }
    return { sheet, apps };
  };
  ```

#### C. `passkeyAdapter.js` (Standardized Auth Provider)
- Plugs into `authService.loginWithProvider('passkey')` alongside `authService.loginWithProvider('google')`.
- Returns uniform `{ user, token }` payload.

### 3.2 Unified UI: Single `GoogleWorkspaceModal.jsx`

Consolidate `GoogleIntegrationModal.jsx` and `GooglePromptModal.jsx` into one modal with contextual modes:

```
┌────────────────────────────────────────────────────────────────────────┐
│  GOOGLE WORKSPACE & CANDIDATE DATA SYNC                           [X]  │
│  Connected Account: sam.ludwig@example.com (Token Active)             │
├────────────────────────────────────────────────────────────────────────┤
│  [Sheet Tracker Sync]              [Gmail Inbox Ingestion]             │
│                                                                        │
│  Spreadsheet Status: Connected     Last Gmail Scan: 14 mins ago        │
│  [View in Google Sheets ↗]         [Scan Inbox Now (3 New Found)]      │
│  [Re-sync All 42 Applications]     [View Parsed Applications]          │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  ⚙ Advanced: Custom GCP Client ID Configuration ▾                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Expected Impact & Metric Projections

| Layer / File | Current LOC | Proposed LOC | Net Reduction |
| :--- | :--- | :--- | :--- |
| **`googleAuthService.js`** | 389 LOC | ~140 LOC (`googleAuthAdapter.js`) | -249 LOC (-64%) |
| **`passkeyService.js`** | 147 LOC | ~90 LOC (`passkeyAdapter.js`) | -57 LOC (-39%) |
| **`googleSheetService.js`** | 262 LOC | ~190 LOC (`googleSheetsClient.js`) | -72 LOC (-27%) |
| **`gmailSyncService.js`** | 495 LOC | ~380 LOC (`gmailSyncClient.js`) | -115 LOC (-23%) |
| **Sync Coordinator** | 0 LOC (scattered) | ~110 LOC (`googleSyncOrchestrator.js`) | +110 LOC (new) |
| **Modals (`GoogleIntegration` + `GooglePrompt`)** | 654 LOC (425 + 229) | ~340 LOC (`GoogleWorkspaceModal.jsx`) | **-314 LOC (-48%)** |
| **TOTAL** | **1,947 LOC** | **~1,250 LOC** | **-697 LOC (-36%)** |

### Additional Benefits:
1. **Fixes Latent Runtime Bug**: Eliminates undeclared `findExistingJobTrackerSheet` reference error in `googleAuthService.js`.
2. **Deterministic Token Flow**: Eliminates competing token clients and unified expiration handling.
3. **Single Responsibility**: Scraper and sheet parsing tests can run in complete isolation from auth mock fixtures.
4. **Bundle Savings**: Consolidates modal chunks from two separate chunks (~23 kB combined) into one on-demand chunk.

---

## 5. Phased Implementation Roadmap

1. **Phase 4A: Extract Adapters**:
   - Create `src/services/auth/adapters/googleAuthAdapter.js` and `passkeyAdapter.js`.
   - Update `authService.js` to expose unified `login(provider, credentials)`.
2. **Phase 4B: Extract Google Workspace Clients**:
   - Clean up `googleSheetsClient.js` and `gmailSyncClient.js` to accept `accessToken` as pure parameters without auth side-effects.
   - Implement `googleSyncOrchestrator.js`.
3. **Phase 4C: Unified Modal**:
   - Build `GoogleWorkspaceModal.jsx` and replace usages in `Dashboard.jsx` and `OnboardingFlow.jsx`.
   - Delete obsolete `GooglePromptModal.jsx` and `GoogleIntegrationModal.jsx`.
4. **Phase 4D: Verification**:
   - Test GIS token request flow, simulated login fallback, sheets append, and Gmail inbox parser.

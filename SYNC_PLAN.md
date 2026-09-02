# Repository Synchronization Plan

> **Historical document.** This plan predates the current architecture, where
> `job-dashboard-react` (not `job-dashboard-site`) is the active frontend paired with this
> backend. The specific commits/state described below are long since resolved. Kept for
> historical reference only — see `README.md` for the current repo relationship.

## Current State Analysis

### job-dashboard-modular
- **Status**: Ahead of remote by 2 commits
- **Local commits not pushed**:
  1. `f262166` - "Add multi-model compare, weighted scoring, tracker sync, and layout fixes"
  2. `f08511f` - "Integrate resume guidelines and harden dashboard"
- **Dependencies on job-dashboard-site**:
  - `job_profile.json` (profile data)
  - `scrapers/jobs_seek.json` (SEEK cache)

### job-dashboard-site  
- **Status**: Up to date with remote
- **Recent commit**: `c8a2bca` - "feat(docs): PDF format resume/cover downloads + example-style generation"
- **Modified files**: Several application files and scrapers have local modifications

## Alignment Requirements

### 1. Push Local Changes
The `job-dashboard-modular` repository has 2 unpushed commits that should be pushed to GitHub.

### 2. Dependency Management
The modular repo depends on files from the site repo. This creates a coupling that should be addressed:

**Short-term solution**: Ensure referenced files exist and are up to date
**Long-term solution**: Consider copying essential dependencies into modular repo or creating a proper package dependency

### 3. Shared Configuration
Both repositories share:
- `Source of truth/` directory (career information)
- `Guidelines/` directory (document formatting rules)
- `data/Examples/` directory (resume examples)

## Synchronization Steps

### Step 1: Push Modular Repository Changes
```bash
cd /home/s/.openclaw/workspace/job-dashboard-modular
git push origin master
```

### Step 2: Verify Dependencies Exist
Check that all referenced files from job-dashboard-site are present:
- [x] `job_profile.json` exists (7779 bytes, Aug 23)
- [x] `scrapers/jobs_seek.json` exists (3315 bytes, Aug 25)

### Step 3: Consider Creating Symbolic Links or Copies
For development convenience, consider:
1. **Option A**: Create symbolic links in modular repo pointing to site repo files
2. **Option B**: Copy essential files into modular repo with documentation
3. **Option C**: Create a shared data directory outside both repos

### Step 4: Update Configuration References
The new `config.py` file references `job-dashboard-site` paths. Ensure these paths are correct and files exist.

## Recommendations

### Immediate Actions
1. Push the 2 local commits to GitHub
2. Document the dependency relationship in README
3. Add validation in run_server.py to check if dependent files exist

### Medium-term Improvements
1. Consider making job-dashboard-modular a proper Python package
2. Extract shared dependencies into a separate data module
3. Add CI checks to ensure synchronization

### Long-term Architecture
1. Evaluate if job-dashboard-site should be deprecated in favor of modular
2. Create proper data migration path from site to modular
3. Document the evolution path for users

## Risk Assessment

### Low Risk
- Pushing existing commits (already tested locally)
- File dependencies exist and are accessible

### Medium Risk  
- Future changes to site repo may break modular repo
- No versioning of shared data files

### High Risk
- Tight coupling between repositories
- No automated synchronization checks

## Verification Checklist

- [ ] Modular repo pushed to GitHub
- [ ] All tests pass in modular repo
- [ ] Server starts successfully with current dependencies
- [ ] Documentation updated to clarify relationship
- [ ] Backup of shared data files created
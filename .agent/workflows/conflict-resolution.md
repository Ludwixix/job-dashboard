# Conflict Resolution Workflow

## Trigger Conditions
This workflow MUST be followed whenever a `git merge`, `git rebase`, or `git cherry-pick` results in merge conflicts (e.g. conflict markers `<<<<<<<`, `=======`, `>>>>>>>` present in files).

## Ordered Steps

### 1. Fetch & Verify Base Branch
- Ensure your local tracking branches are up to date: `git fetch origin`
- Inspect current conflict status: `git status`

### 2. Identify Overlapping Changes
- List all conflicted files: `git diff --name-only --diff-filter=U`
- Inspect conflict markers in each file to understand changes from both branches.

### 3. Sequential Thinking Analysis
- Call the `sequential-thinking` MCP tool to analyze complex or multi-file overlapping diffs.
- Determine the intent behind both incoming changes and local changes.

### 4. Manually Resolve Conflicts
- Carefully edit conflicted files to combine improvements cleanly.
- Remove all conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).

### 5. Verify & Test
- Run full project lint and test suites:
  - `cd workspace/job-dashboard-site && python3 -m pytest tests/ -v`
  - `cd workspace/job-dashboard-modular && python3 -m pytest`
  - `cd workspace/job-dashboard-react && npm run lint`
- Ensure zero syntax errors or broken assertions remain.

### 6. Stage & Complete Merge/Rebase
- Stage resolved files: `git add <file1> <file2>`
- Complete merge or continue rebase: `git merge --continue` or `git rebase --continue`

## Stop / Escalate Conditions
- Stop immediately if business logic conflicts cannot be reconciled programmatically without breaking user data or requirements.
- Escalate to the user if schema migrations or breaking API contract changes conflict.


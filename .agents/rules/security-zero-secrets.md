---
name: security-zero-secrets
description: Mandatory Zero Secret Exposure policy for credentials and environment files
always_on: true
---

# Zero Secret Exposure Policy

## Absolute Invariants
1. **Never Read or Output Secrets**:
   - NEVER read, print, copy, commit, or paste the contents of: `workspace/OpenRouterAPI.txt`, `workspace/KEYS.md`, any `.env` file, `credentials/`, or any file matching secret/token/key/api/credential naming patterns.
   - If a command or tool attempts to display secret tokens or credentials in standard output or logs, sanitize or truncate it immediately.
2. **No Literal Secrets in Code or Config**:
   - NEVER write a literal secret into any file — including rules, workflows, skills, scripts, and MCP config.
   - MCP credentials use `${env:VAR}` references only; secrets live in environment variables or the user's credential store.
3. **No Guessing or Fabricating Credentials**:
   - If a task needs a credential that is not present in the environment, ask the user; never fabricate, synthesize, or guess one.
4. **Git Staging Audit**:
   - Review `git status` before every commit. Never run `git add -A` or `git add .` blindly. Refuse to stage any secret files.


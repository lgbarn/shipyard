---
description: "On-demand security audit — OWASP, secrets, dependencies, IaC security"
disable-model-invocation: true
argument-hint: "[scope] — directory, file pattern, diff range, or current (default: uncommitted changes)"
---

# /shipyard:audit - On-Demand Security Audit

You are executing an on-demand security audit. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Arguments

Extract from the command:
- `scope` (optional): What to audit. Accepts:
  - **No argument / "current"**: Audit uncommitted changes (`git diff` + `git diff --cached`)
  - **Diff range** (e.g., `main..HEAD`): Audit commits in range
  - **Directory path** (e.g., `src/`): Audit all files in directory
  - **"." or "all"**: Full codebase audit (changed files vs main branch)

If no scope and no uncommitted changes exist, default to full codebase audit against the main branch.

## Step 2: Detect Context

1. Check if `.shipyard/` exists (optional — this command works anywhere).
2. If `.shipyard/config.json` exists, read `model_routing.security_audit` for model selection.
3. Otherwise, use default model: **sonnet**.
4. Follow **Worktree Protocol** (see `docs/PROTOCOLS.md`) — detect worktree context.

</prerequisites>

<execution>

## Step 3: Gather Scope

Based on the scope argument, collect the code to audit:
- **Current**: `git diff` + `git diff --cached`
- **Range**: `git diff <range>`
- **Directory**: List all files in directory for analysis
- **Full codebase**: `git diff main...HEAD` or all tracked files

Also gather:
- Dependency manifests (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, etc.)
- IaC files if present (`.tf`, `Dockerfile`, `docker-compose.yml`, Ansible playbooks)
- Configuration files (`.env.example`, CI configs, etc.)

## Step 4: Build Agent Context

Assemble context per **Agent Context Protocol** (see `docs/PROTOCOLS.md`):
- The diff/file content collected in Step 3
- `.shipyard/PROJECT.md` (if exists)
- Dependency manifest contents
- Working directory, current branch, and worktree status

## Step 5: Dispatch Auditor

Dispatch an **auditor agent** (subagent_type: "shipyard:auditor") with:
- Follow **Model Routing Protocol** — resolve model from `model_routing.security_audit` (default: sonnet)
- max_turns: 15
- All context from Step 4
- Instruction: Perform comprehensive security analysis covering OWASP Top 10, secrets scanning, dependency audit, IaC security (if applicable), and configuration security

</execution>

<output>

## Step 6: Present Results

Display the audit report to the user.

**If CRITICAL findings exist:**
> "CRITICAL security findings detected. These should be fixed before shipping."

Offer follow-up:
> "Would you like me to:
> - Fix the critical findings now
> - Review the code for other issues (`/shipyard:review`)
> - Check for complexity issues (`/shipyard:simplify`)"

</output>

# Phase 4 Research: Token Optimization

**Date:** 2026-02-01
**Phase Goal:** Reduce session injection from ~6000 to ~2000 tokens. Enforce per-file budgets. Apply progressive disclosure across all Shipyard content.

---

## Executive Summary

Current session injection is **~6000 tokens** (19,266 characters, 2,694 words). This research identifies:
- **Primary bloat source:** Full `using-shipyard` SKILL.md (175 lines) is injected verbatim at every session start
- **Secondary bloat:** 1 SKILL.md file exceeds 500-line budget (634 lines)
- **Duplication:** 15+ instances of repeated instruction blocks across commands and agents
- **Recommended approach:** Progressive disclosure with skill summary (not full content) + extraction of 4 shared instruction modules

**Token reduction potential:** 65-70% reduction to ~2000-2200 tokens

---

## 1. Current Token Usage Analysis

### 1.1 Session Injection (state-read.sh output)

**Measurement (without .shipyard/ state in project):**
- **Characters:** 19,266
- **Words:** 2,694
- **Estimated tokens:** ~5,800-6,000 (using 0.75 tokens/word + overhead for markdown formatting)

**Composition breakdown:**
1. Preamble + state context: ~800 tokens
2. **Full `using-shipyard` SKILL.md injection:** ~4,500 tokens (175 lines, this is the bloat)
3. Command list + suggestions: ~700 tokens

**With .shipyard/ state (planning tier):**
- Adds ~500-800 tokens for STATE.md, PROJECT.md summary, ROADMAP.md first 80 lines
- **Total: ~6,500-6,800 tokens**

### 1.2 SKILL.md Files

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `shipyard-writing-skills/SKILL.md` | 634 | **EXCEEDS BUDGET** | Only file over 500-line limit |
| `shipyard-tdd/SKILL.md` | 376 | OK | 24% under budget |
| `git-workflow/SKILL.md` | 372 | OK | 26% under budget |
| `code-simplification/SKILL.md` | 309 | OK | 38% under budget |
| `shipyard-debugging/SKILL.md` | 301 | OK | 40% under budget |
| `shipyard-executing-plans/SKILL.md` | 202 | OK | 60% under budget |
| `parallel-dispatch/SKILL.md` | 181 | OK | 64% under budget |
| `using-shipyard/SKILL.md` | 175 | OK | 65% under budget (but fully injected!) |
| `shipyard-writing-plans/SKILL.md` | 144 | OK | 71% under budget |
| `shipyard-verification/SKILL.md` | 144 | OK | 71% under budget |
| `documentation/SKILL.md` | 136 | OK | 73% under budget |
| `infrastructure-validation/SKILL.md` | 104 | OK | 79% under budget |
| `security-audit/SKILL.md` | 72 | OK | 86% under budget |
| `shipyard-brainstorming/SKILL.md` | 56 | OK | 89% under budget |

**Total SKILL.md content:** 3,206 lines across 14 files
**Average:** 229 lines per skill
**Budget compliance:** 13/14 files under 500 lines (93% compliance)

### 1.3 Command Files

| File | Lines | Token Estimate | Notes |
|------|-------|----------------|-------|
| `build.md` | 292 | ~900 tokens | Largest command, detailed gates |
| `worktree.md` | 246 | ~750 tokens | Git worktree management |
| `ship.md` | 228 | ~700 tokens | Multi-stage delivery |
| `init.md` | 178 | ~550 tokens | Initialization workflow |
| `plan.md` | 171 | ~530 tokens | Planning workflow |
| `quick.md` | 123 | ~380 tokens | Quick task execution |
| `resume.md` | 103 | ~320 tokens | Session restoration |
| `recover.md` | 103 | ~320 tokens | State recovery |
| `rollback.md` | 98 | ~300 tokens | Checkpoint rollback |
| `issues.md` | 98 | ~300 tokens | Issue management |
| `status.md` | 95 | ~290 tokens | Progress dashboard |

**Total command content:** 1,735 lines
**Average:** 158 lines per command
**None of these are injected at session start** (only loaded on-demand)

### 1.4 Agent Files

| File | Lines | Token Estimate | Notes |
|------|-------|----------------|-------|
| `documenter.md` | 137 | ~420 tokens | Documentation generation |
| `simplifier.md` | 144 | ~440 tokens | Code simplification |
| `auditor.md` | 142 | ~430 tokens | Security auditing |
| `builder.md` | 110 | ~340 tokens | Implementation |
| `verifier.md` | 98 | ~300 tokens | Verification |
| `reviewer.md` | 93 | ~280 tokens | Code review |
| `architect.md` | 61 | ~190 tokens | Planning/design |
| `researcher.md` | 31 | ~95 tokens | Research |
| `mapper.md` | 26 | ~80 tokens | Codebase mapping |

**Total agent content:** 842 lines
**Average:** 94 lines per agent
**None of these are injected at session start** (only loaded when agents are dispatched)

---

## 2. Duplication Analysis

### 2.1 State File Reading Pattern

**Instances:** 5 files repeat this pattern

**Duplicated block (~15-20 lines each):**
```markdown
Read `.shipyard/STATE.md` to determine:
- **Current Phase** -- which phase was active
- **Current Position** -- what step we were on
- **Status** -- the last known status

Read `.shipyard/ROADMAP.md` and locate the target phase.
Read `.shipyard/PROJECT.md` for overall context.
```

**Files affected:**
- `commands/status.md` (line 22-28)
- `commands/resume.md` (line 22-27)
- `commands/plan.md` (line 20-23)
- `commands/build.md` (line 33-36)
- Several agent references

**Recommendation:** Extract to a shared "State Loading Protocol" reference module. Commands can say "Follow State Loading Protocol (see PROTOCOLS.md)" instead of duplicating.

### 2.2 Model Routing Configuration

**Instances:** 3 files repeat this pattern

**Duplicated block (~8-12 lines each):**
```markdown
Read `model_routing` from `.shipyard/config.json` for agent model selection:
- Researcher agent: `model_routing.planning` (default: sonnet)
- Architect agent: `model_routing.architecture` (default: opus)
- Verifier agent: `model_routing.validation` (default: haiku)
- Builder agents: `model_routing.building` (default: sonnet)
- Reviewer agents: `model_routing.review` (default: sonnet)
...
If `model_routing` is not present in config, use agent defaults.
```

**Files affected:**
- `commands/init.md` (line 90-125, full config structure)
- `commands/plan.md` (line 25-31)
- `commands/build.md` (line 22-29)

**Recommendation:** Extract to "Model Routing Protocol" reference. Commands can reference it instead of duplicating the full table.

### 2.3 Checkpoint Creation

**Instances:** 3 files repeat this pattern

**Duplicated block (~4-6 lines each):**
```markdown
Create a [pre-build/post-plan/post-build] checkpoint:

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/checkpoint.sh "checkpoint-name-here"
```
```

**Files affected:**
- `commands/plan.md` (line 141-147, post-plan)
- `commands/build.md` (line 47-53, pre-build; line 267-273, post-build)
- `commands/rollback.md` (references checkpoints)

**Recommendation:** Extract to "Checkpoint Protocol" reference with templated naming convention.

### 2.4 Working Directory / Worktree Awareness

**Instances:** 4 files repeat this pattern

**Duplicated block (~12-20 lines each):**
```markdown
Detect current working directory and worktree status:
- Run `git worktree list` to identify if operating in a worktree
- Record `$(pwd)` as the working directory
- Record `$(git branch --show-current)` as the current branch

**If a working directory path was provided:**
- All file operations should be relative to that directory
- Git operations operate on the worktree's branch
- The `.shipyard/` directory lives in the main working tree
```

**Files affected:**
- `commands/build.md` (line 17-20, detection; line 66-72, agent instructions)
- `commands/quick.md` (line 41-46)
- `agents/builder.md` (line 91-102, "Working Directory Awareness" section)
- `commands/worktree.md` (implicit throughout)

**Recommendation:** Extract to "Worktree Protocol" reference module.

### 2.5 IaC Validation References

**Instances:** 4 files reference the `shipyard:infrastructure-validation` skill

**Pattern:**
```markdown
Reference the `shipyard:infrastructure-validation` skill for [tool]-specific workflows.

When plan tasks involve IaC files (`.tf`, `.tfvars`, `.yml` Ansible, `Dockerfile`), follow additional validation steps.
```

**Files affected:**
- `agents/builder.md` (line 52-89, full IaC detection + validation protocol)
- `agents/verifier.md` (line 81-90, IaC validation checks)
- `agents/auditor.md` (line 54-58, IaC security reference)
- `agents/simplifier.md` (references IaC files)

**Recommendation:** The skill reference is correct (progressive disclosure), but the detection logic in `builder.md` (37 lines!) should be extracted to a shared "IaC Detection Protocol" so agents can reference it instead of duplicating.

### 2.6 ISSUES.md Tracking Pattern

**Instances:** 2 files repeat this pattern

**Duplicated block (~8-10 lines each):**
```markdown
When you find non-blocking issues:
- If `.shipyard/ISSUES.md` exists, append findings as new issues to the Open Issues table
- Auto-increment the ID from the highest existing ID
- Set source to "[agent-name]"
- Set severity: Important → medium, Suggestion → low
- Set date to current timestamp
```

**Files affected:**
- `agents/reviewer.md` (line 86-94)
- `commands/plan.md` (line 67, reference to ISSUES.md for architect agent)
- `commands/build.md` (line 292, reference to ISSUES.md for routing)
- `commands/ship.md` (line 228, reference to ISSUES.md for final check)

**Recommendation:** Extract to "Issue Tracking Protocol" reference. Agents and commands can say "Follow Issue Tracking Protocol for non-blocking findings."

### 2.7 Git Commit Convention

**Instances:** 2 files repeat this pattern

**Duplicated block (~10-12 lines each):**
```markdown
Use conventional commits:
- `feat(scope)`: New feature
- `fix(scope)`: Bug fix
- `refactor(scope)`: Code change that neither fixes a bug nor adds a feature
- `test(scope)`: Adding or updating tests
- `docs(scope)`: Documentation changes
- `chore(scope)`: Maintenance tasks
```

**Files affected:**
- `agents/builder.md` (line 40-50)
- `agents/builder.md` (line 83-89, IaC-specific commit prefixes)

**Recommendation:** Extract to "Commit Convention" reference (single file). Builder can reference it once.

---

## 3. Technology Options for Token Reduction

### 3.1 Option A: Progressive Disclosure (Recommended)

**Approach:**
- Session hook injects a **20-line summary** of available skills/commands instead of full `using-shipyard` SKILL.md
- Full skill content loaded on-demand via Skill tool when needed
- State content (STATE.md, PROJECT.md, ROADMAP.md) remains as-is (already progressive by tier)

**Pros:**
- Massive token reduction: ~4,500 tokens saved immediately
- Aligns with Claude Code's skill loading mechanism (skills are meant to be loaded on-demand)
- No loss of functionality: all content available when needed
- Simple to implement: replace lines 24-25 and 211 in `state-read.sh`

**Cons:**
- Requires one extra Skill tool invocation per session if user wants skill details
- Slight behavioral change: users won't see full skill list unless they ask

**Maturity:** Proven pattern. Progressive disclosure is used throughout Shipyard (ROADMAP.md first 80 lines, plans loaded on-demand, etc.)

**Token savings:** ~4,500 tokens

### 3.2 Option B: Compression (Not Recommended)

**Approach:**
- Aggressively compress all content (remove examples, shorten descriptions, use abbreviations)
- Keep injection structure the same

**Pros:**
- No behavioral changes
- Could save ~30-40% per file

**Cons:**
- Degrades readability and utility
- Requires rewriting every file
- Violates progressive disclosure principle (why inject compressed content when you can inject nothing and load full content on-demand?)

**Maturity:** Anti-pattern. Compression reduces value without solving root cause.

**Token savings:** ~2,000-2,500 tokens (but with significant quality loss)

**Verdict:** Not recommended.

### 3.3 Option C: Hybrid (Moderate Value)

**Approach:**
- Use progressive disclosure for skills (Option A)
- Extract shared protocol modules for commands/agents (reduces duplication)
- Keep state content as-is

**Pros:**
- Maximum token reduction without quality loss
- Improves maintainability (single source of truth for repeated patterns)
- Scales well: new commands/agents reference existing protocols

**Cons:**
- More implementation work (create 4-6 protocol modules)
- Commands become slightly less self-contained (must reference external protocols)

**Maturity:** Well-established pattern (DRY principle). Used in software documentation, API references, etc.

**Token savings:** ~5,000+ tokens (4,500 from skills + 500-800 from deduplication)

**Verdict:** Recommended as the full solution.

---

## 4. Recommended Approach

**Use Option C (Hybrid): Progressive Disclosure + Protocol Extraction**

This approach achieves the ~2000 token target while improving maintainability.

### 4.1 Implementation Plan

#### Step 1: Replace Full Skill Injection with Summary

**File:** `scripts/state-read.sh`

**Current (lines 24-25, 211):**
```bash
using_shipyard_content=$(cat "${PLUGIN_ROOT}/skills/using-shipyard/SKILL.md" 2>/dev/null || echo "Shipyard skill file not found.")
...
full_context="<EXTREMELY_IMPORTANT>\n...\n${using_shipyard_content}\n</EXTREMELY_IMPORTANT>"
```

**New:**
```bash
# Build compact skill/command summary (20 lines, ~500 tokens instead of 4500)
skill_summary="## Available Shipyard Skills

Use the Skill tool to load any of these:
- shipyard:using-shipyard - How to find and use skills
- shipyard:shipyard-tdd - TDD discipline
- shipyard:shipyard-debugging - Root cause investigation
- shipyard:shipyard-verification - Evidence before completion
- shipyard:shipyard-brainstorming - Requirements gathering
- shipyard:security-audit - Security analysis
- shipyard:code-simplification - Duplication and bloat detection
- shipyard:infrastructure-validation - Terraform/Ansible/Docker validation
- shipyard:parallel-dispatch - Concurrent agent dispatch
- shipyard:shipyard-writing-plans - Creating plans
- shipyard:shipyard-executing-plans - Executing plans
- shipyard:git-workflow - Branch management and worktrees
- shipyard:documentation - Documentation generation
- shipyard:shipyard-writing-skills - Creating new skills

For command details, use the Skill tool with 'shipyard:using-shipyard'."
```

**Token reduction:** ~4,000 tokens

#### Step 2: Create Protocol Reference Modules

**New file:** `.shipyard/PROTOCOLS.md` (or `docs/PROTOCOLS.md` in plugin root)

Contains 6 extracted protocol modules:
1. **State Loading Protocol** (~30 lines)
2. **Model Routing Protocol** (~40 lines, includes full config.json structure)
3. **Checkpoint Protocol** (~15 lines)
4. **Worktree Protocol** (~25 lines)
5. **IaC Detection Protocol** (~30 lines)
6. **Issue Tracking Protocol** (~20 lines)
7. **Commit Convention** (~15 lines)

**Total:** ~175 lines in a single reference file

**Commands/agents then reference this file:**
```markdown
## Step 1a: Load Model Routing

Follow Model Routing Protocol (see PROTOCOLS.md) to select agent models from `.shipyard/config.json`.
```

**Token savings:** Each command saves 8-20 lines of duplication. With 15 instances across 11 files, this saves ~150-300 lines total, or ~500-800 tokens.

#### Step 3: Trim `shipyard-writing-skills` SKILL.md

**Current:** 634 lines
**Target:** Under 500 lines (134 line reduction, ~400 token reduction)

**Trim strategy:**
1. Move verbose examples to a `skills/shipyard-writing-skills/EXAMPLES.md` file (reference it)
2. Compress the checklist sections (use tables instead of bulleted lists where possible)
3. Remove redundant explanations (the skill references other skills -- no need to repeat their content)

**Token reduction:** ~400 tokens

#### Step 4: Add Token Budget Comments

**Format:**
```markdown
---
name: skill-name
description: ...
---

<!-- TOKEN BUDGET: 400 lines / ~1200 tokens -->

# Skill Content
```

**Purpose:** Make budget enforcement visible. Future edits will see the budget and avoid bloat.

**Token impact:** Neutral (adds ~10 tokens per file, but enforces discipline)

---

## 5. Potential Risks and Mitigations

### Risk 1: Users Don't Discover Skills Without Full Injection

**Likelihood:** Medium
**Impact:** Medium (users may miss relevant skills)

**Mitigation:**
- The 20-line summary lists all 14 skills by name
- The summary instructs "use Skill tool to load"
- Trigger evaluation remains in place (file patterns, task markers, etc.)
- First-time users see the summary immediately and learn skills exist

**Residual risk:** Low. Summary is prominent and actionable.

### Risk 2: Commands Become Harder to Understand Without Inline Protocols

**Likelihood:** Low
**Impact:** Low (slight UX degradation)

**Mitigation:**
- PROTOCOLS.md is co-located in `.shipyard/` (easy to find)
- Each reference includes a parenthetical description: "Follow State Loading Protocol (see PROTOCOLS.md) -- reads STATE.md, ROADMAP.md, PROJECT.md"
- Protocol modules are self-contained and clearly titled

**Residual risk:** Very low. Commands become more concise, not less clear.

### Risk 3: Token Budget Becomes Outdated as Files Evolve

**Likelihood:** Medium
**Impact:** Low (cosmetic issue)

**Mitigation:**
- Add budget comments as machine-readable HTML comments at the top of each file
- Future editors see the budget and self-enforce
- Phase 6 (Developer Experience) can add a lint script to validate budgets: `scripts/validate-budgets.sh`

**Residual risk:** Low. Budget drift is non-breaking.

### Risk 4: Protocol Extraction Introduces Coupling

**Likelihood:** Low
**Impact:** Low

**Mitigation:**
- Protocols are **descriptive references**, not executable code -- no runtime coupling
- If a protocol changes, commands reference the updated version naturally
- Each protocol is independent (no protocol-to-protocol dependencies)

**Residual risk:** Very low. This is standard documentation practice.

### Risk 5: State-Read.sh Changes Break Existing Users

**Likelihood:** High (by design -- v2.0 is a clean break)
**Impact:** Medium (users on v1.x will see different session injection)

**Mitigation:**
- This is a major version bump (v1.x → v2.0), breaking changes are expected
- Document the change in CHANGELOG and migration guide
- The behavior is **strictly better**: less bloat, same functionality

**Residual risk:** Low. This is intentional design evolution.

---

## 6. Relevant Documentation Links

### Official Bash/Shell Scripting References
- Bash string length: https://www.gnu.org/software/bash/manual/html_node/Shell-Parameter-Expansion.html
- POSIX shell compatibility: https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html

### Token Estimation Guides
- OpenAI tokenizer (approximate for Claude): https://platform.openai.com/tokenizer
- General heuristic: 1 token ≈ 4 characters or 0.75 words for English text
- Markdown overhead: code blocks, formatting add ~10-15% token overhead

### Progressive Disclosure Pattern
- Nielsen Norman Group on progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- Principle: show essential info upfront, load details on-demand

### DRY Principle (Don't Repeat Yourself)
- The Pragmatic Programmer: https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/
- Avoiding duplication in documentation: single source of truth for shared patterns

### Claude Code Skill Loading Mechanism
- Skills are designed to be loaded on-demand via Skill tool
- Session injection should be minimal (system reminders, state, pointers to skills)
- Full skill content should only load when explicitly invoked

---

## 7. Implementation Considerations

### 7.1 Integration with Existing Codebase

**Files requiring modification:**
1. `scripts/state-read.sh` (lines 24-25, 211) -- replace full skill injection with summary
2. `skills/using-shipyard/SKILL.md` -- remains unchanged (loaded on-demand)
3. `skills/shipyard-writing-skills/SKILL.md` -- trim from 634 to <500 lines, move examples to separate file
4. Create `PROTOCOLS.md` (new file, ~175 lines)
5. Update 11 command/agent files to reference PROTOCOLS.md instead of duplicating content

**Total changes:** 15 files modified, 1 new file created

**Backward compatibility:** None required (v2.0 is a clean break from v1.x)

### 7.2 Migration Concerns

**User-facing changes:**
- Session start shows a 20-line skill summary instead of full `using-shipyard` content
- Users must invoke Skill tool to see full skill details (one extra step)

**Developer-facing changes:**
- Commands/agents now reference PROTOCOLS.md for shared patterns
- New budget enforcement (comments at top of each SKILL.md)

**Migration path:**
- No automated migration needed (session hook change is transparent)
- Document the change in v2.0 release notes

### 7.3 Performance Implications

**Token reduction impact:**
- Session start: 6000 → 2000 tokens (~67% reduction)
- Per-turn cost: minimal change (skills loaded on-demand, same as before)
- Overall session cost: ~4000 tokens saved per session

**Latency impact:**
- Session start: slightly faster (less content to process)
- Skill loading: unchanged (on-demand is already the pattern)

**Storage impact:**
- PROTOCOLS.md adds ~175 lines (~6KB) to the codebase
- Removing duplication saves ~150-300 lines across 11 files

**Net impact:** Positive across all metrics.

### 7.4 Testing Strategies

**Unit tests (Phase 2 test suite):**
- Add test case: measure `state-read.sh` output token count (must be <2500)
- Test: validate PROTOCOLS.md exists and is well-formed
- Test: confirm skill summary includes all 14 skills

**Integration tests:**
- End-to-end: `/shipyard:init → plan → build → ship` with token measurement at each stage
- Verify: Skill tool loads `using-shipyard` correctly when invoked
- Verify: commands reference PROTOCOLS.md and execute correctly

**Manual validation:**
- Human review: does the 20-line summary provide enough context for first-time users?
- Token count: measure actual output with `wc -w` and `wc -c` to confirm <2500 token estimate

**Regression testing:**
- Confirm existing commands still work after referencing PROTOCOLS.md
- Confirm agents dispatch correctly with protocol references

### 7.5 Budget Enforcement Mechanism

**Budget comment format:**
```markdown
<!-- TOKEN BUDGET: [line-count] lines / ~[token-count] tokens -->
```

**Placement:** Top of each SKILL.md, immediately after YAML frontmatter

**Validation script (future Phase 6):**
```bash
#!/usr/bin/env bash
# scripts/validate-budgets.sh
# Checks that all SKILL.md files comply with token budgets

for file in skills/*/SKILL.md; do
  actual_lines=$(wc -l < "$file" | tr -d ' ')
  budget_line=$(grep -m1 "TOKEN BUDGET:" "$file" || echo "")
  if [ -z "$budget_line" ]; then
    echo "WARNING: $file has no budget comment"
  else
    budget=$(echo "$budget_line" | sed -n 's/.*\([0-9]\{1,\}\) lines.*/\1/p')
    if [ "$actual_lines" -gt "$budget" ]; then
      echo "FAIL: $file exceeds budget ($actual_lines > $budget lines)"
    fi
  fi
done
```

**Enforcement strategy:**
- Phase 4: add budget comments manually
- Phase 6: add validation script to `test/run.sh`
- PR reviews: check budget compliance before merge

---

## 8. Detailed File Modification Plan

### 8.1 High-Priority Changes (Core Token Reduction)

#### File: `scripts/state-read.sh`

**Lines to modify:** 24-25, 211
**Current size:** 222 lines
**New size:** ~230 lines (adds 20-line summary, removes 2 lines, net +8)

**Changes:**
1. Remove line 24-25 (full skill file read)
2. Replace with 20-line skill summary (see Section 4.1, Step 1)
3. Update line 211 to inject skill summary instead of `using_shipyard_content`

**Token impact:** -4,000 tokens (from -4,500 skill content +500 summary)

#### File: `skills/shipyard-writing-skills/SKILL.md`

**Lines to modify:** Entire file
**Current size:** 634 lines
**Target size:** <500 lines (trim 134+ lines)

**Changes:**
1. Extract verbose examples (lines ~200-400) to `skills/shipyard-writing-skills/EXAMPLES.md`
2. Compress checklist sections (use tables instead of lists)
3. Remove redundant cross-references to other skills
4. Add budget comment at top: `<!-- TOKEN BUDGET: 480 lines / ~1440 tokens -->`

**Token impact:** -400 tokens

**Supporting file:** Create `skills/shipyard-writing-skills/EXAMPLES.md` (~150 lines, not injected)

#### File: `PROTOCOLS.md` (new)

**Location:** `.shipyard/PROTOCOLS.md` or `docs/PROTOCOLS.md`
**Size:** ~175 lines

**Content:** 7 protocol modules (see Section 4.1, Step 2)

**Token impact:** Neutral (this file is referenced, not injected)

### 8.2 Deduplication Changes (Commands)

#### File: `commands/plan.md`

**Lines to replace:**
- Line 25-31: Model routing → "Follow Model Routing Protocol (see PROTOCOLS.md)"
- Line 67: ISSUES.md reference → "Follow Issue Tracking Protocol (see PROTOCOLS.md)"
- Line 141-147: Checkpoint creation → "Follow Checkpoint Protocol (see PROTOCOLS.md) to create post-plan checkpoint"

**Token savings:** ~50 tokens

#### File: `commands/build.md`

**Lines to replace:**
- Line 17-20: Worktree detection → "Follow Worktree Protocol (see PROTOCOLS.md)"
- Line 22-29: Model routing → "Follow Model Routing Protocol (see PROTOCOLS.md)"
- Line 47-53: Pre-build checkpoint → "Follow Checkpoint Protocol (see PROTOCOLS.md)"
- Line 267-273: Post-build checkpoint → "Follow Checkpoint Protocol (see PROTOCOLS.md)"

**Token savings:** ~100 tokens

#### File: `commands/init.md`

**Lines to replace:**
- Line 90-125: Full config.json structure → "Follow Model Routing Protocol (see PROTOCOLS.md) for config structure and defaults"

**Token savings:** ~120 tokens

#### Files: `commands/status.md`, `commands/resume.md`, `commands/quick.md`

**Lines to replace:**
- State reading blocks → "Follow State Loading Protocol (see PROTOCOLS.md)"

**Token savings per file:** ~30 tokens
**Total:** ~90 tokens

### 8.3 Deduplication Changes (Agents)

#### File: `agents/builder.md`

**Lines to replace:**
- Line 40-50: Commit convention → "Follow Commit Convention (see PROTOCOLS.md)"
- Line 52-89: IaC detection + validation → "Follow IaC Detection Protocol (see PROTOCOLS.md) to identify IaC files. For validation steps, reference shipyard:infrastructure-validation skill."
- Line 91-102: Worktree awareness → "Follow Worktree Protocol (see PROTOCOLS.md)"

**Token savings:** ~150 tokens

#### File: `agents/reviewer.md`

**Lines to replace:**
- Line 86-94: Issue tracking → "Follow Issue Tracking Protocol (see PROTOCOLS.md)"

**Token savings:** ~30 tokens

#### Files: `agents/verifier.md`, `agents/auditor.md`

**Lines to replace:**
- IaC validation references → Consolidate to single skill reference

**Token savings per file:** ~20 tokens
**Total:** ~40 tokens

### 8.4 Budget Comments (All SKILL.md Files)

**Files to modify:** All 14 SKILL.md files

**Change:** Add budget comment immediately after YAML frontmatter

**Format:**
```markdown
---
name: skill-name
description: ...
---

<!-- TOKEN BUDGET: [line-count] lines / ~[token-count] tokens -->
```

**Token budget per file:**
- Default: 500 lines / ~1500 tokens
- Actual budget based on current size + 20% headroom

**Token impact:** +10 tokens per file × 14 files = +140 tokens (negligible)

---

## 9. Success Metrics

### 9.1 Quantitative Targets (from Phase 4 Success Criteria)

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Session injection size | ~6000 tokens | <2500 tokens | `bash scripts/state-read.sh \| jq -r '.hookSpecificOutput.additionalContext' \| wc -w` × 0.75 |
| SKILL.md files over 500 lines | 1 (634 lines) | 0 | `wc -l skills/*/SKILL.md \| grep -E '^ *[5-9][0-9]{2,}'` |
| `shipyard-writing-skills` line count | 634 lines | <500 lines | `wc -l skills/shipyard-writing-skills/SKILL.md` |
| Duplicated instruction blocks | 15+ instances | <5 instances | Manual audit + grep for patterns |
| Full skill injection at session start | Yes (175 lines) | No (20-line summary) | Review `state-read.sh` line 211 |

### 9.2 Qualitative Success Indicators

- [ ] Commands are more concise and easier to maintain
- [ ] New contributors can add commands without duplicating protocols
- [ ] Session start is noticeably faster (subjective, but measurable via token count)
- [ ] Skill discovery remains intuitive (user testing)
- [ ] No functionality regressions (all commands/skills work as before)

### 9.3 Validation Checklist

**Before considering Phase 4 complete:**

1. Run `bash scripts/state-read.sh` and measure output:
   - Character count: <8000 (currently 19,266)
   - Word count: <1000 (currently 2,694)
   - Estimated tokens: <2500 (currently ~6000)

2. Verify SKILL.md compliance:
   - All files <500 lines: `for f in skills/*/SKILL.md; do [ $(wc -l < "$f") -le 500 ] || echo "FAIL: $f"; done`
   - All files have budget comments: `grep -L "TOKEN BUDGET:" skills/*/SKILL.md`

3. Verify deduplication:
   - Model routing pattern appears ≤2 times across all files (once in PROTOCOLS.md, ≤1 legacy reference)
   - Checkpoint pattern appears ≤2 times
   - State loading pattern appears ≤2 times

4. Integration test:
   - Full workflow (`/shipyard:init → plan → build → ship`) completes without errors
   - Skill tool loads `using-shipyard` correctly when invoked
   - Commands execute correctly with PROTOCOLS.md references

5. Documentation:
   - PROTOCOLS.md exists and is complete
   - All budget comments are accurate
   - CHANGELOG documents the token optimization changes

---

## 10. Open Questions for Planning Phase

1. **PROTOCOLS.md location:** Should it live in `.shipyard/PROTOCOLS.md` (project-specific, created by init) or `docs/PROTOCOLS.md` (plugin-level, ships with npm package)?
   - **Recommendation:** `docs/PROTOCOLS.md` in plugin root. Protocols are framework-level, not project-specific.

2. **Skill summary placement:** Should the 20-line summary be inline in `state-read.sh` or extracted to a separate file (`skills/SUMMARY.md`)?
   - **Recommendation:** Inline in `state-read.sh`. It's small enough that extraction adds complexity without value.

3. **Budget validation:** Should Phase 4 include the validation script (`scripts/validate-budgets.sh`) or defer to Phase 6?
   - **Recommendation:** Phase 4 adds budget comments. Phase 6 adds validation script. Keeps Phase 4 focused on token reduction, not tooling.

4. **Examples extraction strategy:** For `shipyard-writing-skills`, should examples go in a separate `EXAMPLES.md` file or inline with collapse/expansion hints?
   - **Recommendation:** Separate `EXAMPLES.md` file. Cleaner separation, aligns with progressive disclosure.

5. **Breaking change communication:** How to notify users of the session injection change?
   - **Recommendation:** CHANGELOG entry + migration guide in CONTRIBUTING.md. No user action required (change is transparent).

---

## Conclusion

Phase 4 token optimization is achievable with a hybrid approach combining:
1. **Progressive disclosure:** Replace full skill injection with 20-line summary (~4000 token reduction)
2. **Protocol extraction:** Consolidate 15+ duplicated blocks into 7 protocol modules (~500-800 token reduction)
3. **SKILL.md trimming:** Reduce `shipyard-writing-skills` from 634 to <500 lines (~400 token reduction)
4. **Budget enforcement:** Add visible budget comments to prevent future bloat

**Total reduction:** ~4900-5200 tokens (65-70% reduction from current ~6000 tokens to target ~2000-2200 tokens)

**Primary risk:** Users may not discover skills without full injection at session start
**Mitigation:** 20-line summary lists all skills and instructs use of Skill tool

**Implementation complexity:** Low-moderate (15 file modifications, 1 new file)
**Testing burden:** Moderate (token measurement + integration tests)
**Maintenance benefit:** High (single source of truth for repeated patterns)

**Recommendation:** Proceed with full implementation. This approach meets all success criteria and improves long-term maintainability.

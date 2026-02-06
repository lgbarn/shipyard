# Shipyard Agent Guide

Complete reference for all Shipyard agents: their roles, model assignments, dispatch patterns, tool access, restrictions, and relationships.

For model routing configuration, see the [Model Routing Protocol](PROTOCOLS.md#model-routing-protocol).

---

## Agent Overview

| Agent | Default Model | Config Key | Dispatched By | Blocking? | Tool Access |
|-------|--------------|------------|---------------|-----------|-------------|
| **architect** | opus | `architecture` | init, plan, quick | No | Read-only + write plans |
| **builder** | sonnet | `building` | build, quick | Yes (blocks review) | Full (read, write, bash, git) |
| **reviewer** | sonnet | `review` | build | Yes (blocks progress) | Read-only |
| **verifier** | haiku | `validation` | plan, build, ship | Yes (gates shipping) | Read + bash (test commands) |
| **auditor** | sonnet | `security_audit` | build, ship | Yes (critical findings block) | Read-only |
| **simplifier** | sonnet | `simplification` | build | No (advisory) | Read-only |
| **documenter** | sonnet | `documentation` | build, ship | No (advisory) | Read + write docs |
| **researcher** | sonnet | `planning` | plan | No | Read + web search/fetch |
| **mapper** | sonnet | `mapping` | init | No | Read-only |
| **search-memory** | haiku | `memory` | memory-search, memory skill | No | MCP memory_search only |

All model assignments are configurable via `model_routing` in `.shipyard/config.json`. See [Model Selection Guidance](PROTOCOLS.md#model-selection-guidance) for when to upgrade or downgrade.

---

## Pipeline Lifecycle

```mermaid
graph LR
    subgraph init ["/shipyard:init"]
        M[mapper ×4] --> B[brainstorming]
        B --> A1[architect]
    end
    subgraph plan ["/shipyard:plan"]
        R[researcher] --> A2[architect]
        A2 --> V1[verifier]
    end
    subgraph build ["/shipyard:build"]
        BU[builder] --> RV[reviewer]
        RV -->|retry| BU
        RV --> V2[verifier]
        V2 --> AU[auditor]
        AU --> SI[simplifier]
        SI --> DO[documenter]
    end
    subgraph ship ["/shipyard:ship"]
        AU2[auditor] --> DO2[documenter]
        DO2 --> V3[verifier]
    end
    init --> plan --> build --> ship
```

---

## Individual Agent Details

### architect

- **Model:** opus (configurable via `model_routing.architecture`)
- **Dispatched by:** `/shipyard:init` (roadmap), `/shipyard:plan` (plans), `/shipyard:quick` (quick plans)
- **Recommended max_turns:** 15
- **Inputs:** PROJECT.md, ROADMAP.md, RESEARCH.md, CONTEXT-{N}.md, codebase docs
- **Outputs:** ROADMAP.md (init), PLAN-{W}.{P}.md (plan)
- **Restrictions:**
  - Maximum 3 tasks per plan
  - Maximum 7 phases per milestone
  - Every task must have a runnable `<verify>` command
  - Done criteria must be observable, not subjective
  - Wave dependency ordering required for parallel execution
- **Why opus:** System decomposition and dependency analysis require the strongest reasoning. Bad plans waste all downstream work.

### builder

- **Model:** sonnet (configurable via `model_routing.building`)
- **Dispatched by:** `/shipyard:build` (per-plan), `/shipyard:quick`
- **Recommended max_turns:** 30
- **Inputs:** PLAN.md, CONVENTIONS.md, prior wave SUMMARY.md files, CONTEXT-{N}.md
- **Outputs:** SUMMARY-{W}.{P}.md, git commits (one per task)
- **Restrictions:**
  - Must follow TDD protocol when `tdd="true"` (test fails before implementation)
  - Must run `<verify>` command for every task before marking done
  - Must not make architectural changes not in the plan
  - Must not combine tasks into a single commit
  - Must not skip tests or verification
  - Stops on `checkpoint:human-verify`, `checkpoint:decision`, `checkpoint:human-action`
  - IaC tasks require additional validation (terraform validate, ansible-lint, hadolint)
- **Fresh context:** Each plan gets a fresh builder agent to prevent context pollution.

### reviewer

- **Model:** sonnet (configurable via `model_routing.review`)
- **Dispatched by:** `/shipyard:build` (after each plan completes)
- **Recommended max_turns:** 15
- **Inputs:** PLAN.md (spec), SUMMARY.md (what was done), git diff (actual changes), CONTEXT-{N}.md
- **Outputs:** REVIEW-{W}.{P}.md
- **Restrictions:**
  - Strict two-stage protocol: Stage 1 (spec compliance) gates Stage 2 (code quality)
  - If Stage 1 fails, Stage 2 is not performed
  - Every PASS must include file path evidence
  - Every finding must include file path, line number, and specific remediation
  - Finding categories: Critical (blocks), Important (should fix), Suggestion (nice-to-have)
  - Non-blocking findings appended to `.shipyard/ISSUES.md`
- **Retry loop:** Critical findings trigger builder re-dispatch (max 2 retries).

### verifier

- **Model:** haiku (configurable via `model_routing.validation`)
- **Dispatched by:** `/shipyard:plan` (plan quality), `/shipyard:build` (phase completion), `/shipyard:ship` (final validation)
- **Recommended max_turns:** 15
- **Inputs:** ROADMAP.md (success criteria), PLAN.md files (must_haves), test outputs
- **Outputs:** VERIFICATION.md
- **Restrictions:**
  - Must never mark PASS without concrete evidence (test output, file path, command result)
  - Conservative bias: false FAIL > false PASS
  - Must check for regressions in previously passing phases
  - IaC verification requires running validation tools (terraform validate, ansible-lint)
  - MANUAL findings must describe exactly what a human should check
- **Why haiku:** Mechanical task — run commands, check output, compare to criteria. Speed matters more than deep reasoning.

### auditor

- **Model:** sonnet (configurable via `model_routing.security_audit`)
- **Dispatched by:** `/shipyard:build` (after verification), `/shipyard:ship` (mandatory, ignores config)
- **Recommended max_turns:** 15
- **Inputs:** Git diff of all phase changes, PROJECT.md, CONVENTIONS.md, dependency manifests
- **Outputs:** AUDIT-{N}.md
- **Restrictions:**
  - Critical findings block shipping — phase must not proceed to `/shipyard:ship`
  - Every finding must include file path, line number, and concrete remediation
  - Must reference standards (CWE, OWASP, CIS) where applicable
  - Analyzes 6 areas: code security, secrets, dependencies, IaC, Docker, configuration
  - Cross-task analysis is the unique value — checks component interactions, not individual files
- **Upgrade consideration:** For production codebases handling PII, financial data, or complex auth systems, consider `security_audit: "opus"`.

### simplifier

- **Model:** sonnet (configurable via `model_routing.simplification`)
- **Dispatched by:** `/shipyard:build` (after auditor, unless `--light`)
- **Recommended max_turns:** 10
- **Inputs:** Git diff of all phase changes, SUMMARY.md files, PROJECT.md
- **Outputs:** SIMPLIFICATION-{N}.md
- **Restrictions:**
  - Non-blocking — findings are advisory, user decides to implement/defer/dismiss
  - Rule of Three: 2 occurrences = note, 3+ = recommend extraction
  - Must include exact file paths and line numbers for every finding
  - Must not flag test utilities, public API surfaces, or intentionally redundant code
  - Deferred findings appended to `.shipyard/ISSUES.md`
- **Unique value:** Sees the cumulative effect of multiple isolated builder agents — catches duplication, dead code, and AI bloat patterns that per-task reviewers miss.

### documenter

- **Model:** sonnet (configurable via `model_routing.documentation`)
- **Dispatched by:** `/shipyard:build` (after simplifier, unless `--light`), `/shipyard:ship` (comprehensive)
- **Recommended max_turns:** 20
- **Inputs:** Git diff, SUMMARY.md files, PROJECT.md, CONVENTIONS.md, existing docs/
- **Outputs:** DOCUMENTATION-{N}.md (phase), docs/ directory (ship)
- **Restrictions:**
  - Non-blocking — findings are advisory
  - Must update existing docs rather than creating duplicates
  - Document "what" and "why", not "how" (unless logic is complex)
  - Public interfaces only — no over-documenting internal implementation
  - Prioritize examples over prose

### researcher

- **Model:** sonnet (configurable via `model_routing.planning`)
- **Dispatched by:** `/shipyard:plan` (before architect, unless `--skip-research`)
- **Recommended max_turns:** 15
- **Inputs:** STACK.md, ARCHITECTURE.md, ROADMAP.md, codebase (via Grep/Read)
- **Outputs:** RESEARCH.md
- **Restrictions:**
  - Must evaluate at least 3 distinct options for technology choices
  - Must cite sources (URLs) for every factual claim
  - Must check existing codebase before claiming compatibility
  - Must include Uncertainty Flags for inconclusive areas
  - Comparison matrix must use consistent criteria across all candidates
  - Uses WebSearch for breadth, WebFetch for depth, codebase tools for integration analysis

### mapper

- **Model:** sonnet (configurable via `model_routing.mapping`)
- **Dispatched by:** `/shipyard:init` (brownfield projects — 4 parallel instances)
- **Recommended max_turns:** 20
- **Inputs:** Entire codebase (read-only)
- **Outputs:** One of: STACK.md + INTEGRATIONS.md, ARCHITECTURE.md + STRUCTURE.md, CONVENTIONS.md + TESTING.md, or CONCERNS.md
- **Restrictions:**
  - Assigned one of 4 focus areas: technology, architecture, quality, concerns
  - Every finding must cite at least one file path as evidence
  - Must sample 2-3 files per module (no generalizing from single files)
  - Must flag uncertainty with `[Inferred]` marker
  - Each document must be independently useful
- **Parallel dispatch:** Init runs 4 mapper instances concurrently, each with a different focus area.

### search-memory

- **Model:** haiku (configurable via `model_routing.memory`)
- **Dispatched by:** `/shipyard:memory-search`, `memory` skill
- **Recommended max_turns:** 5
- **Inputs:** Search query (string or array of concepts)
- **Outputs:** Synthesized summary (200-1000 words) + source list
- **Tool access:** `mcp__plugin_shipyard_shipyard-memory__memory_search` only
- **Restrictions:**
  - Must synthesize, not dump raw results
  - Must include ALL sources with metadata (project, date, score, status)
  - Must not exceed 1000 words in summary
  - Supports date filtering (`after`, `before`) and project filtering
- **Why haiku:** Fast retrieval and summarization. Memory search is a bounded, mechanical task.

---

## Agent Communication

Agents **do not communicate directly** with each other. All information exchange happens through artifacts:

| Producer | Artifact | Consumer(s) |
|----------|----------|-------------|
| Mapper | STACK.md, ARCHITECTURE.md, etc. | Architect, Builder |
| Researcher | RESEARCH.md | Architect |
| Architect | ROADMAP.md, PLAN.md | Builder, Reviewer, Verifier |
| Builder | SUMMARY.md, git commits | Reviewer, Verifier, Auditor, Simplifier, Documenter |
| Reviewer | REVIEW.md | Builder (on retry), Orchestrator |
| Verifier | VERIFICATION.md | Orchestrator |
| Auditor | AUDIT.md | Orchestrator |
| Simplifier | SIMPLIFICATION.md | Orchestrator |
| Documenter | DOCUMENTATION.md, docs/ | Orchestrator |
| Search-Memory | Synthesis text | Orchestrator |

The **orchestrator** (the main Claude session) manages all agent dispatch and reads all artifacts. Each agent dispatch gets fresh context — no agent has memory of previous dispatches.

---

## Blocking vs Advisory

**Blocking agents** can halt pipeline progress:
- **builder** — must complete before reviewer runs
- **reviewer** — Critical findings trigger builder retry (max 2 cycles); persistent failures mark plan as `needs_attention`
- **verifier** — FAIL verdict prevents phase from being marked complete
- **auditor** — Critical findings block `/shipyard:ship`

**Advisory agents** produce reports but don't halt progress:
- **simplifier** — user decides: implement, defer, or dismiss
- **documenter** — user decides: generate, defer, or dismiss
- **researcher** — informs architect but doesn't gate planning
- **architect** — produces plans for user approval
- **mapper** — produces documentation for reference
- **search-memory** — returns synthesis for orchestrator use

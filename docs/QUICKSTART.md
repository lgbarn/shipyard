# Shipyard Quickstart

Shipyard is a Claude Code plugin for structured project execution. It helps you plan, build, review, and ship software systematically — with parallel agents, TDD, security audits, and quality gates. If you're new to Shipyard, start here.

## I Want To...

### Start a New Project or Feature
| Situation | Command |
|-----------|---------|
| Set up a new project | `/shipyard:init` |
| Explore requirements interactively | `/shipyard:brainstorm` |
| Plan a phase of work | `/shipyard:plan 1` |
| Build from a plan | `/shipyard:build` (execute plans with builder agents, review gates, and security audits) |
| Quick single task | `/shipyard:quick "add health check endpoint"` |
| Ship completed work | `/shipyard:ship` (verify and deliver — merge, PR, or preserve) |

### Review and Improve Code
| Situation | Command |
|-----------|---------|
| Review uncommitted changes | `/shipyard:review` |
| Review a branch | `/shipyard:review main..HEAD` |
| Review specific files | `/shipyard:review src/auth/` |
| Security audit on changes | `/shipyard:audit` |
| Security audit on codebase | `/shipyard:audit .` |
| Find duplication/complexity | `/shipyard:simplify src/` |

### Research and Understand
| Situation | Command |
|-----------|---------|
| Evaluate technology options | `/shipyard:research "Redis vs Memcached for caching"` |
| Understand a codebase | `/shipyard:map` |
| Map architecture patterns | `/shipyard:map architecture` |
| Find technical debt | `/shipyard:map concerns` |

### Document and Verify
| Situation | Command |
|-----------|---------|
| Generate docs for changes | `/shipyard:document` |
| Document a module | `/shipyard:document src/api/` |
| Run tests and check criteria | `/shipyard:verify` |
| Verify phase completion | `/shipyard:verify 3` |

### Manage State
| Situation | Command |
|-----------|---------|
| Check progress | `/shipyard:status` |
| Resume previous session | `/shipyard:resume` |
| View or change settings | `/shipyard:settings` |
| Set a single setting | `/shipyard:settings security_audit false` |
| Rollback to checkpoint | `/shipyard:rollback` |
| Recover from errors | `/shipyard:recover` |
| View deferred issues | `/shipyard:issues` |
| View past phase history | Read `.shipyard/HISTORY.md` or `/shipyard:status` |
| Isolate feature work | `/shipyard:worktree create feature-name` |
| Move codebase docs location | `/shipyard:move-docs` |

## Lifecycle vs On-Demand

**Lifecycle commands** (`init` → `brainstorm` → `plan` → `build` → `ship`) run the full pipeline with multiple agents, review gates, security audits, and state tracking. Use these for structured multi-phase work.

**On-demand commands** (`review`, `audit`, `simplify`, `document`, `research`, `verify`, `map`) dispatch a single agent for a focused task. Use these for quick analysis without the full pipeline.

| When to use... | Lifecycle | On-Demand |
|----------------|-----------|-----------|
| Multi-phase feature | Yes | |
| Quick code review | | Yes |
| Pre-commit security check | | Yes |
| New project setup | Yes | |
| Technology investigation | | Yes |
| Full build + review + audit | Yes | |
| Spot-check code quality | | Yes |

## Model Routing

Shipyard routes each agent to an appropriate model tier:

| Tier | Agents | Cost | Best For |
|------|--------|------|----------|
| **Opus** | architect | Highest | Complex decomposition, architecture decisions |
| **Sonnet** | builder, reviewer, auditor, simplifier, documenter, researcher, mapper | Medium | Implementation, review, analysis |
| **Haiku** | verifier | Lowest | Validation, mechanical checks |

**Override defaults** in `.shipyard/config.json`:
```json
{
  "model_routing": {
    "security_audit": "opus",
    "building": "haiku",
    "review": "haiku"
  }
}
```

Upgrade `security_audit` to opus for production systems with PII or financial data. Downgrade `building` and `review` to haiku for simple formatting or config tasks.

## Common Workflows

### New Project
```
/shipyard:init          → configure project preferences
/shipyard:brainstorm    → explore requirements, capture project definition
/shipyard:plan 1        → decompose phase 1 into tasks
/shipyard:build         → execute with agents + review gates
/shipyard:ship          → verify, audit, document, deliver
```

### Adding a Feature
```
/shipyard:research "best approach for X"    → explore options
/shipyard:quick "add feature X"             → plan + build in one step
/shipyard:review                            → review before pushing
```

### Fixing a Bug
```
/shipyard:quick "fix auth token expiry bug" → diagnose + fix + test
/shipyard:verify                            → confirm fix works
```

### Pre-Ship Review
```
/shipyard:review main..HEAD    → review all branch changes
/shipyard:audit main..HEAD     → security audit
/shipyard:simplify main..HEAD  → check for bloat
/shipyard:document             → update docs
```

### Understanding Legacy Code
```
/shipyard:map                  → technology stack
/shipyard:map architecture     → architecture patterns
/shipyard:map quality          → code quality and conventions
/shipyard:map concerns         → technical debt and risks
```

## Tips

- **Agents start fresh every time** — they have no memory of previous dispatches. Context is passed explicitly.
- **`/shipyard:quick` is underrated** — use it for small tasks instead of manual coding. You still get TDD, review, and atomic commits.
- **Review before audit** — fix functional bugs before running security analysis.
- **Most on-demand commands work without `/shipyard:init`** — review, audit, simplify, research, and map can run on any git repo. Phase-specific commands like `verify 3` require `.shipyard/` state.
- **`/shipyard:settings` for quick adjustments** — toggle security audit, change model routing, or adjust context tier without re-initializing.

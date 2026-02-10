# Feature Comparison

How Shipyard compares to other Claude Code project frameworks.

| Capability | Shipyard v3.0 | GSD v1.10.1 | Superpowers v3.6.2 |
|-----------|:---:|:---:|:---:|
| **Project Lifecycle** | | | |
| Init / requirements gathering | ✅ | ✅ | ✅ |
| Phase-based roadmap | ✅ | ✅ | ❌ |
| Research agents | ✅ (researcher + 4 mappers) | ✅ (4 parallel) | ❌ |
| Discussion / decision capture | ❌ | ✅ | ❌ |
| Structured planning (waves) | ✅ | ✅ | ✅ |
| Max 3 tasks per plan | ✅ | ✅ | ❌ |
| Quick task mode | ✅ | ✅ | ❌ |
| Progress dashboard | ✅ | ✅ | ❌ |
| Ship / deliver command | ✅ | ✅ | ❌ |
| **Execution** | | | |
| Fresh 200k context per agent | ✅ | ✅ | ✅ |
| Parallel wave execution | ✅ | ✅ | ✅ |
| TDD enforcement | ✅ (rigid skill) | ✅ (implicit) | ✅ (rigid skill) |
| Atomic commits per task | ✅ | ✅ | ✅ |
| IaC validation (Terraform, Ansible, Docker) | ✅ | ❌ | ❌ |
| **Quality Gates** | | | |
| Two-stage code review | ✅ (spec + quality) | ✅ (single-stage) | ✅ (spec + quality) |
| Security audit (OWASP, secrets, deps) | ✅ (dedicated agent) | ❌ | ❌ |
| Code simplification | ✅ (skill + agent) | ❌ | 🧪 (lab, experimental) |
| Documentation generation | ✅ (dedicated agent) | ❌ | ❌ |
| Phase verification | ✅ | ✅ | ❌ |
| Configurable gate toggles | ✅ (`--light`, config.json) | ❌ | ❌ |
| **Context & Models** | | | |
| Multi-model routing | ✅ (9 categories) | ✅ (profiles) | ❌ |
| Adaptive context loading | ✅ (5 tiers, plus auto) | ✅ (5 tiers, fork) | ✅ (<2k bootstrap) |
| Session resume / state persistence | ✅ | ✅ | ❌ |
| **Git & Recovery** | | | |
| Git worktree management | ✅ (command + agent context) | ❌ | ✅ (skill) |
| Rollback / checkpoints | ✅ | ✅ (fork) | ❌ |
| State recovery | ✅ | ✅ (fork) | ❌ |
| Issue tracking (cross-session) | ✅ | ✅ (todos) | ❌ |
| **Skills & Extensibility** | | | |
| Auto-activating skills | ✅ (16 skills) | ❌ | ✅ (15+ skills) |
| Deterministic skill triggers | ✅ (4 trigger types) | ❌ | ❌ (description-based) |
| Systematic debugging | ✅ | ✅ | ✅ (4-phase + escalation) |
| Verification before completion | ✅ | ✅ | ✅ |
| Brainstorming / design | ✅ | ✅ (discuss phase) | ✅ |
| Skill authoring guide | ✅ | ❌ | ✅ |
| Plugin marketplace | ❌ | ❌ | ✅ (7 plugins) |
| **Distribution** | | | |
| Install via CLI | ✅ (`lgbarn/shipyard`) | ✅ (`npx get-shit-done-cc`) | ✅ (marketplace) |
| Multi-runtime | ❌ (Claude Code) | ✅ (Claude + OpenCode + Gemini) | ❌ (Claude Code) |
| **Scale** | | | |
| Commands | 21 | 20+ | 3 |
| Skills | 16 | 0 | 15+ |
| Named agents | 9 | implicit | implicit |

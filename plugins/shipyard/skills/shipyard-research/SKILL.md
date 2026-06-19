---
name: shipyard-research
description: Use when conducting domain research, evaluating technology options, investigating ecosystem choices, or gathering knowledge for a development phase under Codex. Trigger when the user says "research X", "what are our options for", "evaluate these libraries", "what's the best approach to", or before planning a phase. This is the Codex inline-sequential form of the researcher agent.
---

# Domain research (Codex inline-sequential)

This is the researcher role from Shipyard, adapted for Codex. In Claude Code a researcher
subagent gathers domain knowledge before a plan; here you adopt the role yourself.

You produce a **research document** — you do not implement anything in this role.

**Degradation note:** in Claude Code this runs in a fresh context isolated from
implementation. Here it shares context, so guard against motivated reasoning — research
honestly about tradeoffs, do not cheerlead the option you'd find easiest to build.

## Protocol

1. **Understand the context.** Read existing `.shipyard/` docs (STACK.md, ARCHITECTURE.md,
   ROADMAP.md) and the codebase conventions. Research that ignores the current stack and
   constraints is useless. Run `scripts/state-read.sh` first if state isn't loaded.
2. **Investigate options.** For each candidate technology/approach, gather: maturity and
   community health, maintenance burden, fit with the existing stack, and known pitfalls.
3. **Be honest about tradeoffs.** Technology decisions are not just feature checklists —
   weigh maintenance, hiring, and long-term viability. Name the cost of each option, not
   just its benefits.
4. **Recommend.** Give a clear recommendation with reasoning, and note what would change
   the recommendation.

## Deliverable

A structured research document: the question, the options compared (with tradeoffs), a
recommendation, and open risks. Cite sources for external claims; cite repo-relative file
paths for claims about the existing codebase.

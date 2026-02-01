# Phase 5 Research: Lessons-Learned System

**Date:** 2026-02-01
**Scope:** Auto-capture discoveries during building/shipping and persist them for future sessions
**Dependencies:** Phase 3 (Reliability), Phase 4 (Token Optimization)

---

## 1. Technology Options

### 1.1 Lesson Storage Format

| Option | Pros | Cons | Maturity |
|--------|------|------|----------|
| **Append-only Markdown** | Human-readable, git-friendly, no tooling required, supports rich formatting | No structured querying, manual parsing needed | Proven (widely used) |
| **JSONL (JSON Lines)** | Machine-parseable, structured queries, easy extraction | Not human-friendly for review, requires jq for reading | Mature |
| **SQLite** | Full query support, relational structure, transactions | Overkill for append-only log, binary format not git-friendly | Mature but inappropriate |
| **YAML** | Structured but readable, supports comments | Complex merge conflicts, harder to append atomically | Mature but fragile |

### 1.2 CLAUDE.md Integration Approach

| Option | Pros | Cons | Maturity |
|--------|------|------|----------|
| **Direct append to CLAUDE.md** | Simple, one source of truth, immediately visible to Claude | Risk of duplication, manual deduplication needed | Common pattern |
| **Separate LESSONS.md + sync script** | Clean separation, can regenerate CLAUDE.md section, avoids duplication | More complexity, sync can fail or get stale | Less common |
| **No CLAUDE.md integration** | Simplest, no file conflicts | Lessons not available to Claude unless manually copied | N/A |
| **MCP server for lessons** | Queryable, structured access, no file editing | Requires MCP infrastructure, out of scope for Phase 5 | Emerging (not suitable) |

### 1.3 Lesson Capture Mechanism

| Option | Pros | Cons | Maturity |
|--------|------|------|----------|
| **Post-phase prompt in ship.md** | User-driven, explicit review, high quality | Only captures at ship time, may forget details | Common |
| **Auto-extract from SUMMARY.md** | Automated, captures builder discoveries | Requires NLP/parsing, may capture noise | Experimental |
| **Capture during build.md via builder** | Real-time capture, fresh context | High volume, requires filtering | Rare |
| **Hybrid: builder suggests + user reviews** | Best of both worlds, quality + automation | Most complex, two-stage workflow | Novel (recommended) |

---

## 2. Recommended Approach

### Storage Format: Append-Only Markdown (`.shipyard/LESSONS.md`)

**Rationale:** Human-readable, git-friendly, requires no additional tooling, supports rich formatting for examples and context. Structured enough for grep/sed extraction when needed.

**Structure:**
```markdown
# Shipyard Lessons Learned

## [YYYY-MM-DD] Phase N: {Phase Name}

### What Went Well
- {Bullet point}
- {Bullet point}

### Surprises / Discoveries
- {Pattern discovered}
- {Tool behavior learned}

### Pitfalls to Avoid
- {Anti-pattern encountered}
- {Gotcha discovered}

### Process Improvements
- {Workflow enhancement}
- {Efficiency gain}

---
```

**Why alternatives were not chosen:**
- JSONL: Not human-friendly for user review and editing
- SQLite: Overkill for append-only log, binary format conflicts with git
- YAML: Fragile for appending, complex merge conflicts

### CLAUDE.md Integration: Direct Append with Deduplication Check

**Rationale:** Simplest approach that provides immediate value. Append a "## Lessons Learned" section to project CLAUDE.md (if it exists) after user approves lessons. Before appending, check if section exists and merge instead of duplicate.

**Implementation:**
1. Check if `CLAUDE.md` exists in project root (not `.shipyard/`)
2. If exists, check for existing `## Lessons Learned` section
3. If section exists, append new lessons under the section (with date separator)
4. If section doesn't exist, create it at the end of CLAUDE.md
5. If CLAUDE.md doesn't exist, skip (only write to `.shipyard/LESSONS.md`)

**Why alternatives were not chosen:**
- Separate sync script: Added complexity, can get out of sync
- No integration: Misses opportunity to make lessons immediately useful to Claude
- MCP server: Out of scope, requires infrastructure not available in Phase 5

### Lesson Capture: Hybrid (Builder Suggestions + User Review)

**Rationale:** Combines automation (builder captures discoveries in SUMMARY.md) with quality control (user reviews and edits before persisting).

**Two-stage workflow:**

**Stage 1 - During Build (commands/build.md):**
- Builder agent documents "Issues Encountered" in SUMMARY.md (already exists)
- Explicitly prompt builder to note: unexpected behaviors, workarounds, edge cases discovered, assumptions proven wrong
- No automatic persistence — just capture in SUMMARY.md

**Stage 2 - During Ship (commands/ship.md):**
- Extract potential lessons from all SUMMARY.md files in the phase
- Present to user as structured prompts:
  - "What went well in this phase?"
  - "What surprised you or what did you learn?"
  - "What should future work avoid?"
  - "Any process improvements discovered?"
- Pre-populate from SUMMARY.md extracts as suggestions
- User reviews, edits, and approves
- Append to `.shipyard/LESSONS.md` and optionally to `CLAUDE.md`

**Why alternatives were not chosen:**
- Post-phase prompt only: Loses real-time discoveries from builder
- Auto-extract from SUMMARY.md: Too much noise, no quality filter
- Capture during build: Too high volume, disrupts build flow

---

## 3. Potential Risks and Mitigations

### Risk 1: Low Adoption (Users Skip Lessons Prompt)

**Risk:** Users may skip the lessons prompt to save time, reducing value.

**Mitigation:**
- Make prompt non-blocking but visible
- Pre-populate with SUMMARY.md extracts so users can quickly review/approve
- Allow "No lessons this phase" as a valid response
- Track adoption in usage analytics (future phase)

**Known limitation:** Cannot force users to provide lessons, can only make it easy.

### Risk 2: CLAUDE.md Merge Conflicts

**Risk:** If CLAUDE.md is actively edited by users, appending lessons may cause git conflicts.

**Mitigation:**
- Append at the end of the file (least likely to conflict)
- Use clear section marker (`## Lessons Learned`) for easy conflict resolution
- Document in skill that manual merge may be needed
- Consider offering "skip CLAUDE.md update" option if conflicts detected

**Known limitation:** Cannot prevent all merge conflicts, but can make them rare and easy to resolve.

### Risk 3: Lesson Quality Varies

**Risk:** Without guidance, lessons may be too generic ("tests are good") or too specific ("line 47 had a typo").

**Mitigation:**
- Provide examples in the skill of good vs. bad lessons
- Structure prompts to guide toward useful abstractions
- Pre-populate from SUMMARY.md to give concrete starting points
- Skill includes "quality standards" section with criteria

**Known limitation:** Quality depends on user engagement; system can guide but not enforce.

### Risk 4: Token Overhead in state-read.sh

**Risk:** Adding recent lessons to execution tier increases session token usage, conflicting with Phase 4 goals.

**Mitigation:**
- Limit to **5 most recent lessons** (from last 2-3 phases)
- Extract only headline (first line of each bullet)
- Truncate each lesson to max 80 characters
- Make it opt-in via context tier (execution tier only, not planning)
- Target: ~200 tokens for 5 recent lessons

**Measurement:** Phase 4 reduced session injection from ~6000 to ~2000 tokens. Adding 200 tokens keeps total under 2500 (acceptable).

### Risk 5: Stale or Outdated Lessons

**Risk:** Lessons from early phases may become irrelevant as project evolves.

**Mitigation:**
- Date-stamp all lessons
- Show only recent lessons in state-read.sh (not full history)
- Full history always available in `.shipyard/LESSONS.md`
- Consider "lesson pruning" in future phase (not Phase 5 scope)

**Known limitation:** No automatic staleness detection; manual review required.

---

## 4. Relevant Documentation Links

### Official Documentation
- [Markdown Best Practices](https://www.markdownguide.org/basic-syntax/) - Format conventions for LESSONS.md
- [Git Merge Strategies](https://git-scm.com/docs/merge-strategies) - Handling CLAUDE.md conflicts
- [Bash Heredoc Syntax](https://www.gnu.org/software/bash/manual/html_node/Redirections.html#Here-Documents) - For multi-line prompts in ship.md

### Project-Specific Documentation
- `/Users/lgbarn/Personal/shipyard/docs/PROTOCOLS.md` - State Loading, Commit Convention patterns to follow
- `/Users/lgbarn/Personal/shipyard/skills/documentation/SKILL.md` - Quality standards for lesson documentation
- `/Users/lgbarn/Personal/shipyard/skills/shipyard-writing-skills/SKILL.md` - Skill creation guidelines (this Phase creates a new skill)

### Key GitHub Issues / Discussions
- N/A (internal project, no public issues)

### Related Research
- Phase 1 RESEARCH.md - Input validation patterns to apply to lesson extraction
- Phase 4 Plan 1.1 - Token budget constraints for state-read.sh injection

---

## 5. Implementation Considerations

### 5.1 Integration Points with Existing Codebase

#### commands/build.md Integration

**Current behavior (lines 76-88):**
Builder produces SUMMARY.md with sections:
- Tasks Completed
- Files Modified
- Decisions Made
- **Issues Encountered** (already exists!)

**Modification needed:**
Add explicit instruction to builder agent to document in "Issues Encountered":
- Unexpected behaviors discovered
- Workarounds applied
- Edge cases found
- Assumptions proven wrong
- Things that were harder than expected

**Location:** After line 88 in builder instructions, add note:
> Document all discoveries thoroughly in the Issues Encountered section. These will seed lessons learned at ship time.

**Impact:** Low — this section already exists, just emphasizing its importance.

#### commands/ship.md Integration

**Current flow:**
1. Pre-Ship Verification (Step 1)
2. Run Test Suite (Step 2)
3. Security Audit (Step 2a)
4. Documentation Generation (Step 2b)
5. Determine Scope (Step 3)
6. **[NEW: Lessons Learned Capture]** <-- Insert here as Step 3a
7. Present Delivery Options (Step 4)
8. Execute Delivery (Step 5)
9. Archive Artifacts (Step 6)
10. Update Tasks & State (Step 7)
11. Commit Archive (Step 8)
12. Final Message (Step 9)

**New Step 3a: Capture Lessons Learned**

Insert after "Determine Scope" (Step 3) and before "Present Delivery Options" (Step 4).

**Rationale for placement:**
- After scope is determined (know what we're shipping)
- Before delivery options (while context is fresh)
- After all verification gates pass (only capture lessons for successful work)

**Implementation:**
```markdown
## Step 3a: Capture Lessons Learned

Invoke the `shipyard:lessons-learned` skill to guide this process.

1. Extract potential lessons from all SUMMARY.md files in the shipping scope:
   - Read all `.shipyard/phases/{N}/results/SUMMARY-*.md` files
   - Extract content from "Issues Encountered" and "Decisions Made" sections
   - Identify patterns: repeated issues, surprising discoveries, effective workarounds

2. Present structured prompts to user (use AskUserQuestion):
   > **Phase {N} is complete. Let's capture lessons learned.**
   >
   > These will be saved to `.shipyard/LESSONS.md` and optionally added to your project's `CLAUDE.md`.
   >
   > **What went well in this phase?**
   > {Pre-populated from positive findings in SUMMARY.md, or leave blank}
   >
   > **What surprised you or what did you learn?**
   > {Pre-populated from "Issues Encountered" sections}
   >
   > **What should future work avoid?**
   > {Pre-populated from workarounds and blockers}
   >
   > **Any process improvements discovered?**
   > {Leave blank unless user adds}
   >
   > Edit the above, or type "skip" to skip lesson capture.

3. If user types "skip", continue to Step 4.

4. If user provides lessons:
   a. Format as markdown section (see LESSONS.md structure)
   b. Append to `.shipyard/LESSONS.md` (create if doesn't exist)
   c. If `CLAUDE.md` exists in project root, offer to update it:
      - Check for existing `## Lessons Learned` section
      - If exists, append new lessons under that section
      - If not, create section at end of file
      - Show diff and ask: "Update CLAUDE.md with these lessons? (y/n)"
   d. Commit lessons: `shipyard(phase-{N}): capture lessons learned`

5. Continue to Step 4 (Present Delivery Options).
```

**Location:** Insert as new Step 3a in `/Users/lgbarn/Personal/shipyard/commands/ship.md`, between lines 143-145.

**Impact:** Medium — adds new step to ship flow, but non-blocking and skippable.

#### scripts/state-read.sh Integration

**Current execution tier context (lines 123-163):**
- Loads current phase plans (first 50 lines, max 3)
- Loads recent summaries (first 30 lines, max 3)

**Modification needed:**
After loading summaries (around line 163), add lessons loading:

```bash
# Load recent lessons (execution tier only, max 5)
if [ -f ".shipyard/LESSONS.md" ]; then
    lesson_snippet=$(grep -A 10 "^## \[" ".shipyard/LESSONS.md" 2>/dev/null | tail -60 | head -50 || echo "")
    if [ -n "$lesson_snippet" ]; then
        state_context="${state_context}\n### Recent Lessons Learned\n${lesson_snippet}\n"
    fi
fi
```

**Explanation:**
- `grep -A 10 "^## \["` finds lesson headers (date-stamped sections) plus next 10 lines
- `tail -60` takes last 60 lines (approximately last 5 lessons at ~12 lines each)
- `head -50` truncates to 50 lines max (token budget safety)
- Only shown in execution tier (not planning/minimal)

**Token impact:** ~200-250 tokens for 5 recent lessons (within Phase 4 budget).

**Location:** Insert after line 163 in `/Users/lgbarn/Personal/shipyard/scripts/state-read.sh`.

**Impact:** Low — execution tier already loads phase context, this is additive.

### 5.2 New Skill File Structure

**File:** `/Users/lgbarn/Personal/shipyard/skills/lessons-learned/SKILL.md`

**Required sections (based on skill conventions):**
1. Frontmatter (name, description)
2. Token budget comment
3. Overview (what is this skill)
4. When to Use
5. Lesson Quality Standards (what makes a good lesson)
6. Structured Prompts (the questions to ask)
7. LESSONS.md Format (example structure)
8. CLAUDE.md Integration (how to append)
9. Anti-Patterns (bad lessons to avoid)

**Token budget target:** 200 lines / ~600 tokens (well under 500-line limit from Phase 4).

**Frontmatter structure (following conventions):**
```yaml
---
name: lessons-learned
description: Use when capturing discoveries after phase completion, before shipping, or when reflecting on completed work to extract reusable patterns
---
```

**Style guide (from shipyard-writing-skills):**
- Use "Use when..." format for description
- Include triggers/symptoms, not process summary (CSO principle)
- Third person voice
- Concrete examples of good vs. bad lessons
- Flowchart only if decision is non-obvious (likely not needed here)

### 5.3 Migration Concerns

**No migration needed:**
- New files created (`.shipyard/LESSONS.md`)
- Existing files modified in backward-compatible ways
- No schema changes to STATE.md or config.json
- Old projects without LESSONS.md work fine (file is created on first ship)

**Forward compatibility:**
- LESSONS.md format is stable (append-only markdown)
- CLAUDE.md integration is optional (safe to skip)
- state-read.sh checks file existence before loading

### 5.4 Performance Implications

**Lesson capture (ship.md):**
- Reads all SUMMARY.md files in phase (typically 1-5 files, <10KB each)
- Grep/sed extraction is fast (<50ms)
- User interaction is blocking but intentional
- Total overhead: <100ms + user time

**Lesson display (state-read.sh):**
- Reads LESSONS.md once per session start
- Grep + tail + head pipeline: <10ms
- Adds ~200 tokens to execution tier context
- No measurable session startup delay

**CLAUDE.md update:**
- Optional, user-confirmed
- Single file append operation (<10ms)
- No impact on session performance

**Overall impact:** Negligible (<200ms total, mostly user interaction time).

### 5.5 Testing Strategy

**Unit tests (not in Phase 5 scope, but documented for future):**
- Test LESSONS.md format parsing (extract sections)
- Test CLAUDE.md section detection (finds existing section)
- Test lesson extraction from SUMMARY.md (filters noise)

**Integration tests (manual verification during Phase 5):**
1. Run full cycle: init → plan → build → ship
2. Verify lessons prompt appears after scope determination
3. Verify pre-population from SUMMARY.md works
4. Verify LESSONS.md is created with correct format
5. Verify CLAUDE.md update (if file exists)
6. Verify state-read.sh shows recent lessons in execution tier
7. Verify lessons persist across sessions (read from LESSONS.md)

**Edge cases to test:**
- Skip lessons (type "skip")
- No CLAUDE.md in project (lessons only in LESSONS.md)
- CLAUDE.md with existing Lessons Learned section (append, don't duplicate)
- Empty SUMMARY.md (no pre-population, user provides lessons manually)
- Very long lesson text (truncation in state-read.sh)

**Success criteria (from ROADMAP.md):**
1. After `/shipyard:ship`, user is prompted with captured lessons for review ✓
2. Approved lessons are appended to `.shipyard/LESSONS.md` with timestamp and phase ✓
3. If CLAUDE.md exists in project root, a "Lessons Learned" section is appended/updated ✓
4. Lessons from previous phases are visible in `state-read.sh` output (execution tier only, max 5 recent) ✓
5. Skill file under 200 lines ✓

---

## 6. File Modification Summary

### Files to Create (New)
- `/Users/lgbarn/Personal/shipyard/skills/lessons-learned/SKILL.md` (~200 lines)
- `.shipyard/LESSONS.md` in user projects (created at first ship)

### Files to Modify (Existing)
- `/Users/lgbarn/Personal/shipyard/commands/ship.md`
  - Insert Step 3a after line 143 (~30 lines added)
  - Renumber subsequent steps (4→4, 5→5, etc.)
  - Update final message to mention lessons if captured

- `/Users/lgbarn/Personal/shipyard/commands/build.md`
  - Add note after line 88 emphasizing "Issues Encountered" importance (~5 lines added)

- `/Users/lgbarn/Personal/shipyard/scripts/state-read.sh`
  - Add lesson loading after line 163 in execution tier (~10 lines added)

**Total lines added:** ~245 lines across 5 files (3 new, 2 modified).

**Risk assessment:** Low — all changes are additive (no removals), non-blocking (lessons prompt is skippable), and isolated (failures don't break core workflows).

---

## 7. Recommended Implementation Order

### Plan 1: Core Lesson Capture (ship.md + skill)
**Wave:** 1.1
**Scope:**
- Create `skills/lessons-learned/SKILL.md`
- Modify `commands/ship.md` Step 3a (capture and persist)
- Test: Full ship flow with lesson capture to LESSONS.md

**Rationale:** Core value delivery — users can capture lessons immediately.

### Plan 2: CLAUDE.md Integration
**Wave:** 1.2
**Scope:**
- Add CLAUDE.md detection and append logic to ship.md Step 3a
- Test: Append to CLAUDE.md with and without existing section

**Rationale:** Optional enhancement — builds on Plan 1.

### Plan 3: Display Recent Lessons (state-read.sh)
**Wave:** 1.3
**Scope:**
- Modify `scripts/state-read.sh` execution tier
- Test: Recent lessons appear in session context

**Rationale:** Completes feedback loop — lessons are captured and re-surfaced.

### Plan 4: Builder Emphasis (build.md)
**Wave:** 1.4 (optional)
**Scope:**
- Add note to `commands/build.md` emphasizing "Issues Encountered"
- Test: Verify builder includes more detail in SUMMARY.md

**Rationale:** Quality improvement — better input leads to better lessons.

**Dependencies:**
- Plan 1 has no dependencies (can start immediately)
- Plans 2-4 depend on Plan 1 (need SKILL.md and core flow)

**Total plans:** 4 (3 required, 1 optional)

---

## 8. Alternative Approaches Considered

### Alternative 1: Automatic Lesson Extraction (LLM-based)

**Approach:** Use Claude to automatically extract lessons from SUMMARY.md, REVIEW.md, and AUDIT.md files without user prompting.

**Pros:**
- Zero user effort
- Consistent format
- Can run on every phase automatically

**Cons:**
- Risk of low-quality lessons (noise)
- No user validation or context
- May miss subjective insights only humans know
- Requires additional LLM API calls (cost)

**Why rejected:** Quality and user agency. Lessons are most valuable when users reflect and confirm. Automation would trade quality for convenience.

### Alternative 2: Interactive Lesson Refinement Loop

**Approach:** Present lessons, let user edit, re-run extraction, repeat until user is satisfied.

**Pros:**
- Highest quality lessons
- User has full control
- Can iterate on phrasing

**Cons:**
- High friction (multi-turn interaction)
- Slows ship workflow
- Over-engineering for Phase 5 scope

**Why rejected:** Conflicts with "ship should be fast" principle. One-shot review is sufficient.

### Alternative 3: MCP Server for Structured Lessons

**Approach:** Store lessons in a structured database (SQLite or JSON), expose via MCP server for querying.

**Pros:**
- Full-text search
- Semantic queries ("show lessons about testing")
- Programmatic access

**Cons:**
- Requires MCP infrastructure (out of scope)
- Not human-readable
- Complex setup and maintenance

**Why rejected:** Over-engineering for Phase 5. Markdown file meets 80% of needs with 20% of complexity.

### Alternative 4: Per-Task Lesson Capture

**Approach:** Capture lessons after each task (in builder.md), not just at ship time.

**Pros:**
- Maximum granularity
- Fresh context (right after discovery)

**Cons:**
- High volume (too many lessons)
- Interrupts build flow
- Requires filtering/aggregation later

**Why rejected:** Too granular. Phase-level lessons provide the right abstraction level.

---

## 9. Known Limitations

### Limitation 1: No Cross-Project Lesson Sharing

**Description:** Lessons are scoped to a single project (`.shipyard/LESSONS.md`). No mechanism to share lessons across projects.

**Impact:** Users must manually copy lessons to personal CLAUDE.md or skill files if they want them available globally.

**Mitigation (future phase):** Consider `~/.shipyard/GLOBAL-LESSONS.md` or MCP server for cross-project lessons.

**Phase 5 stance:** Out of scope. Focus on per-project lessons first.

### Limitation 2: No Lesson Search or Query

**Description:** LESSONS.md is a flat file. No full-text search beyond grep. No semantic queries ("show lessons about security").

**Impact:** Users must manually read LESSONS.md to find relevant lessons.

**Mitigation (future phase):** MCP server with vector search, or integrate with existing search tools.

**Phase 5 stance:** Out of scope. Grep is sufficient for Phase 5.

### Limitation 3: Quality Depends on User Engagement

**Description:** If users skip the lessons prompt or provide low-quality input, the system provides no value.

**Impact:** Success depends on user discipline.

**Mitigation:** Make prompts easy (pre-populate from SUMMARY.md), provide examples in skill, show value (display recent lessons).

**Phase 5 stance:** Acceptable. System can guide but not force quality.

### Limitation 4: No Lesson Lifecycle Management

**Description:** No automatic pruning of stale lessons, no "mark as obsolete," no version tracking.

**Impact:** LESSONS.md grows indefinitely. Old lessons may become irrelevant.

**Mitigation (future phase):** Add pruning workflow or lesson versioning.

**Phase 5 stance:** Out of scope. Date stamps allow manual review.

### Limitation 5: CLAUDE.md Conflicts Possible

**Description:** If users manually edit CLAUDE.md while lessons are being appended, git conflicts are possible.

**Impact:** Users must manually resolve conflicts.

**Mitigation:** Append at end of file (least likely to conflict), clear section markers, document conflict resolution in skill.

**Phase 5 stance:** Acceptable risk. Conflicts are rare and easy to resolve.

---

## 10. Success Metrics

### Quantitative Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Skill file size | <200 lines | `wc -l skills/lessons-learned/SKILL.md` |
| Token overhead in state-read.sh | <250 tokens | Measure lesson snippet output, estimate ~4 chars/token |
| Lesson capture time | <2 minutes | Manual timing from prompt to commit |
| LESSONS.md file creation | 100% on first ship | Verify file exists after ship |
| Recent lessons displayed | Max 5, from last 2-3 phases | Count sections in state-read.sh output |

### Qualitative Metrics

| Metric | Success Criteria | Validation Method |
|--------|-----------------|-------------------|
| Lessons are actionable | Users can apply lessons to future work | Manual review of sample lessons |
| Prompts are clear | Users understand what to provide | User feedback during testing |
| CLAUDE.md integration works | Section is created/appended correctly | Test with and without existing section |
| Format is readable | Human can scan and understand quickly | Manual review of LESSONS.md |
| Skill is discoverable | Claude finds skill when reflecting on work | Test trigger conditions |

---

## 11. Open Questions for Planning Phase

### Question 1: Should lessons be tagged by category?

**Options:**
- A: No tags, just chronological (simplest)
- B: Add tags like `[Testing]`, `[Security]`, `[Performance]` (more structure)
- C: Use frontmatter YAML for tags (most structured)

**Recommendation:** A (no tags). Chronological is simplest. Tags can be added in future phase if needed.

### Question 2: Should CLAUDE.md integration be opt-in or opt-out?

**Options:**
- A: Always ask ("Update CLAUDE.md? y/n") — opt-in
- B: Always update if CLAUDE.md exists — opt-out
- C: Check config.json for `lessons_to_claude_md` setting

**Recommendation:** A (opt-in). Always ask. This gives users control and visibility.

### Question 3: Should builder automatically flag potential lessons in SUMMARY.md?

**Options:**
- A: No — builder just writes "Issues Encountered" normally
- B: Yes — add "Potential Lessons" subsection in SUMMARY.md
- C: Yes — but only if a workaround or discovery occurred

**Recommendation:** A (no change). "Issues Encountered" is already the right place. Don't over-complicate.

### Question 4: How to handle multi-phase milestones?

**Options:**
- A: Capture lessons per phase (as designed)
- B: Capture lessons per milestone (aggregate at ship time)
- C: Support both (user chooses)

**Recommendation:** A (per phase). Simplest. Milestones are collections of phases; lessons accumulate naturally.

---

## 12. References

### Shipyard Conventions (to follow)

| Convention | Source File | Application to Phase 5 |
|------------|-------------|------------------------|
| Skill frontmatter format | `skills/using-shipyard/SKILL.md` | lessons-learned SKILL.md must match |
| Token budget comments | `skills/*/SKILL.md` (Phase 4 added) | Add `<!-- TOKEN BUDGET: 200 lines / ~600 tokens -->` |
| "Use when..." description | `skills/shipyard-writing-skills/SKILL.md` | Description must start with "Use when..." |
| Markdown structure | `skills/documentation/SKILL.md` | Follow sections: Overview, When to Use, Quality Standards, etc. |
| Command step numbering | `commands/ship.md`, `commands/build.md` | Sequential, renumber if inserting |
| Commit convention | `docs/PROTOCOLS.md` | Use `shipyard(phase-N): {message}` |
| State tier loading | `scripts/state-read.sh` | Execution tier only, check file existence first |

### Related Issues

| Issue ID | Severity | Description | Impact on Phase 5 |
|----------|----------|-------------|-------------------|
| 19 (closed) | Low | TOKEN BUDGET comments in SKILL.md files are advisory only | Follow pattern, add budget comment to new skill |
| N/A | N/A | No open issues directly impact Phase 5 | N/A |

---

## 13. Conclusion

Phase 5 (Lessons-Learned System) is a **medium complexity** phase with **high value** and **low risk**. The recommended approach (append-only markdown + hybrid capture + optional CLAUDE.md integration) balances simplicity, user control, and immediate utility.

**Key strengths of this approach:**
- Human-readable format (markdown)
- Non-blocking workflow (skippable prompts)
- Dual storage (LESSONS.md for history, CLAUDE.md for immediate use)
- Token-efficient (fits Phase 4 budget)
- No new dependencies (pure bash + jq)

**Key risks mitigated:**
- Low adoption → pre-populate from SUMMARY.md, make easy
- Merge conflicts → append at end, clear markers
- Quality variance → examples and structure in skill
- Token overhead → limit to 5 recent lessons, execution tier only

**Implementation is straightforward:**
- 4 plans (3 required, 1 optional)
- ~245 lines of code/documentation added
- No schema changes, no migrations
- Manual testing sufficient (integration tests in Phase 7)

**Success criteria are measurable and achievable:**
- Skill file <200 lines (target: ~150)
- Lessons displayed (max 5, execution tier only)
- CLAUDE.md integration works (test both cases)
- Full ship flow includes lessons capture

**Ready to proceed to planning phase.**

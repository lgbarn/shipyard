---
name: shipyard-brainstorming
description: You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation. Also used during /shipyard:init for requirements gathering.
---

<!-- TOKEN BUDGET: 130 lines / ~390 tokens -->

# Brainstorming Ideas Into Designs

<activation>

## When to Use

- User wants to build, create, or add something new
- User says "let's build", "I want to add", "what if we..."
- Design discussion or feature exploration is happening
- During `/shipyard:init` for requirements gathering
- Before any creative work: creating features, building components, adding functionality, modifying behavior

</activation>

## Overview

Help turn ideas into fully formed designs through natural collaborative dialogue. Understand the project context, ask questions one at a time, then present the design in small sections (200-300 words) with validation after each.

**Shipyard integration:** This skill is the foundation of `/shipyard:init`. Brainstorming drives the requirements gathering phase before any plan is written.

<instructions>

## The Process

### Phase 1: Understanding the Idea
- Check out the current project state first (files, docs, recent commits)
- Ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible, but open-ended is fine too
- Only one question per message - if a topic needs more exploration, break it into multiple questions
- Focus on understanding: purpose, constraints, success criteria

**Multiple-choice question template:**
```
I see a few ways to handle [topic]:

A) [Option] -- [one-sentence trade-off]
B) [Option] -- [one-sentence trade-off]
C) [Option] -- [one-sentence trade-off]

I'd lean toward (A) because [reason]. Which feels right for your case?
```

### Phase 2: Exploring Approaches
- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

### Phase 3: Presenting the Design
- Once you believe you understand what you're building, present the design
- Break it into sections of 200-300 words
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

</instructions>

## After the Design

**Documentation:**
- Write the validated design to `docs/plans/YYYY-MM-DD-<topic>-design.md`
- Use elements-of-style:writing-clearly-and-concisely skill if available
- Commit the design document to git

**Implementation (if continuing):**
- Ask: "Ready to set up for implementation?"
- Use shipyard:git-workflow to create isolated workspace
- Use shipyard:shipyard-writing-plans to create detailed implementation plan

<rules>

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Cut any feature not essential to the core use case. If the user says "and maybe also...", push back: "Let's ship the core first and add that later if needed."
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Be flexible** - Go back and clarify when something doesn't make sense
- **No gold plating** - If the user describes a simple need, do not propose an enterprise architecture. Match the solution to the problem size.

</rules>

<examples>

## Examples

### Good: Collaborative single-question flow

```
User: I want to add notifications to my app.

Agent: Before we dive in, let me check what's here...
[reads project files]
Your app is a Flask REST API with a PostgreSQL database and no existing
notification system. What kind of notifications are we talking about?

A) Email notifications for important events (password reset, account changes)
B) In-app notifications (a notification bell in the UI)
C) Push notifications to mobile devices
D) Some combination -- tell me more

I'd lean toward (A) if this is your first pass, since it's the simplest
to add. Which direction?
```

### Bad: Dumping multiple questions at once

```
User: I want to add notifications to my app.

Agent: Great idea! What kind of notifications? Email, push, or in-app?
What events should trigger them? Do you need real-time delivery? What
about notification preferences? Should users be able to mute? What
about digest mode? Have you considered a message queue? What scale
are we talking about?
```

</examples>

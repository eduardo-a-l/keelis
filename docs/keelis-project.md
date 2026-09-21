# Keelis — Project Brainstorm

> A persistent AI workspace that can take a large objective and continuously transform it into completed work.

Instead of:

```text
User → Prompt → AI → Answer
```

Keelis becomes:

```text
                    USER
                      │
                      ↓
                   MISSION
                      │
                      ↓
                  PLANNER
                      │
                      ↓
                 TASK GRAPH
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
        AGENT       AGENT       AGENT
          │           │           │
          └───────────┼───────────┘
                      ↓
                   RESULTS
                      │
              ┌───────┴───────┐
              ↓               ↓
           SUCCESS          PROBLEM
              │               │
              ↓               ↓
          NEXT TASK       NEW TASK
              │               │
              └───────┬───────┘
                      ↓
                 TASK GRAPH
                      │
                      ↓
                  CONTINUE
```

Give it a meaningful objective, and it can turn that objective into tasks, work on them, remember its progress, and continue — without needing a new prompt for every small step.

---

## Naming

**Working name: Keelis**

- Rooted in "keel" — the backbone of a ship, built first, everything else is constructed on top of it. Maps onto the task graph as the foundation the rest of the system (agents, providers, memory) is built around.
- Coined word rather than a real English word, which makes it more distinctive and trademark-friendly, at the cost of not being self-explanatory — positioning/tagline needs to carry the meaning.
- Checked npm and general web search: no existing package or notable web presence under this exact name (unlike "Waystone," which collides with an existing npm scope and a very well-known Minecraft mod). Domain registration itself hasn't been checked directly — confirm before locking it in.

---

## Reference point: Arctic (usearctic.sh)

Arctic is an open-source, terminal-based, multi-provider AI coding agent focused on fast provider/account switching and real-time usage tracking across coding plans (Claude Code, Codex, Gemini CLI, Copilot, etc.) and 75+ API providers. It runs entirely locally, with no proxying of code.

Keelis is a different kind of thing: Arctic solves _which model you're talking to and how much you've spent_. Keelis is trying to solve _not needing to keep talking to it at all_ — an autonomous mission/task system rather than a better interface to prompting. The multi-provider piece (Section 7 below) is the one area of overlap; everything else — Missions, the living task graph, resource-aware pause/resume, multi-agent orchestration, persistent decision memory — is a different product thesis.

---

## Core Idea

An AI-powered development/workspace system that doesn't just answer prompts.

The user gives it a **large objective**, and the system turns that objective into a living set of tasks, works through them, learns what needs to be done next, and keeps progressing whenever resources are available.

The goal is something that can be left with a long-term mission rather than needing a new prompt for every small step.

---

## 1. Missions

Instead of individual prompts, the main unit is a **Mission**.

Example:

> Build a complete authentication system.

The AI analyzes the objective and creates a plan:

- Research existing project structure
- Design authentication architecture
- Create user model
- Implement registration
- Implement login
- Add session handling
- Add validation
- Write tests
- Review implementation
- Update documentation

A mission can contain hundreds of tasks and evolve over time.

---

## 2. Living Task Queue

Tasks aren't necessarily created entirely by the user.

The AI can:

- Create tasks
- Split large tasks into smaller tasks
- Reorder tasks
- Add dependencies
- Mark tasks complete
- Detect blocked tasks
- Create follow-up tasks
- Remove obsolete tasks
- Discover tasks that weren't known initially

Example:

```text
MISSION
│
├── Research
│
├── Architecture
│
├── Implementation
│   ├── Backend
│   │   ├── User model
│   │   ├── Registration
│   │   └── Login
│   │
│   └── Frontend
│       ├── Login UI
│       └── Session state
│
├── Testing
│
└── Review
```

The task list is **dynamic**, not a static checklist.

---

## 3. Tasks Can Create More Tasks

One of the core concepts.

While working on:

> Implement login

the AI discovers:

> The existing database layer doesn't support transactions.

Instead of ignoring the problem, it can create:

```text
NEW TASK
Add transaction support to database layer

Reason:
Required by login implementation.
```

This task can become a dependency of the original task.

The system essentially builds its own roadmap while working.

**Open risk to design around:** an agent discovering a problem and correctly inserting it as a blocking dependency — without duplicate tasks, infinite task-spawning loops, or scope creep — needs explicit guardrails (deduplication, spawn limits, a "does this actually block the parent task" check) rather than being left implicit.

---

## 4. Task Dependencies

Tasks should understand relationships.

```text
Database schema
       ↓
User model
       ↓
Authentication service
       ↓
Login endpoint
       ↓
Login UI
       ↓
Integration tests
```

A task shouldn't start if something it depends on hasn't been completed.

Possible states:

```text
QUEUED
READY
RUNNING
BLOCKED
WAITING
FAILED
COMPLETED
CANCELLED
```

This state machine is the core data model everything else in the system sits on top of — worth getting right early.

---

## 5. Automatic Continuation

The system should be designed around **continuation**.

If an agent finishes one task:

```text
Task #17 completed.

Next available task: #18
```

It can continue automatically.

If task #18 creates additional work:

```text
Task #19 created.
Task #20 created.

Next task: #19
```

The system keeps moving through the queue.

---

## 6. Usage / Resource Awareness

AI providers have limitations.

The system should understand that.

If the current provider reaches a usage limit:

```text
Agent paused.

Reason:
Provider usage limit reached.

Current task:
Implement authentication service.

Progress:
64%

Next action:
Implement token validation.
```

Instead of losing the state, the system saves everything.

When the provider becomes available again:

```text
Resources available.

Resuming task #42...
```

The system continues from where it stopped.

**This is Keelis's strongest differentiator against Arctic** — Arctic displays usage as a dashboard; Keelis's scheduler _acts_ on it (reroutes work, pauses/resumes state automatically).

---

## 7. Multiple Providers

The system shouldn't depend on one AI provider.

Possible providers:

- Gemini
- Claude
- OpenAI
- OpenRouter
- Local models
- Ollama
- Other compatible APIs

A provider abstraction allows the system to switch models without changing the rest of the application.

```text
                  AI SYSTEM
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
       Provider A  Provider B  Provider C
```

Eventually the system could choose a provider depending on the task.

---

## 8. Model / Provider Selection

Different tasks may benefit from different models.

```text
Planning       → reasoning model
Coding         → coding model
Quick task     → fast/cheap model
Documentation → fast model
Review         → reasoning model
```

The system could have configurable rules for this.

---

## 9. Multiple Specialized Agents

Instead of one AI doing everything:

```text
                    ORCHESTRATOR
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
    Architect          Coder            Tester
        │                │                │
        └────────────────┼────────────────┘
                         ↓
                      Reviewer
```

Possible agents:

- Planner
- Architect
- Researcher
- Coder
- Tester
- Reviewer
- Documentation
- Debugger
- Security reviewer

Agents could communicate through the task system rather than directly relying on huge conversations.

---

## 10. Agent Handoffs

Example:

```text
Architect
    ↓
creates implementation plan
    ↓
Coder
    ↓
implements
    ↓
Tester
    ↓
finds failure
    ↓
creates bug task
    ↓
Coder
    ↓
fixes
    ↓
Reviewer
```

This creates a continuous development loop.

---

## 11. Persistent Memory

The system should remember useful project information — not just conversation history.

Potential categories:

```text
Project Knowledge
Architecture Decisions
Important Constraints
Known Problems
Conventions
Previous Solutions
Research
Agent Notes
```

Example:

```text
Decision #31

The project uses PostgreSQL rather than SQLite.

Reason:
Concurrent writes are required.
```

Later:

> Why are we using PostgreSQL?

The system can retrieve the decision instead of rediscovering it.

---

## 12. Project Context

The AI should understand the project before modifying it.

Potential context sources:

- Files
- Git history
- Documentation
- Configuration
- Issues
- Previous tasks
- Previous decisions
- Tests
- Dependencies

Instead of dumping the entire project into every request, the system intelligently retrieves the relevant context.

---

## 13. Git Integration

Git should be a first-class part of the system.

Potential features:

```text
Create branch
Commit changes
Show diff
Review changes
Create checkpoint
Rollback task
Compare task states
```

Possible workflow:

```text
Task starts
    ↓
Create checkpoint
    ↓
AI modifies project
    ↓
Run tests
    ↓
Review diff
    ↓
Commit
```

If something goes wrong:

```text
Rollback task
```

---

## 14. Checkpoints

Long-running tasks should have recoverable states.

```text
Checkpoint #1
Before implementation

Checkpoint #2
Parser completed

Checkpoint #3
Tests added

Checkpoint #4
Review completed
```

This becomes especially useful when agents run autonomously.

---

## 15. Human Approval

The system shouldn't necessarily do everything automatically.

Different permission levels could exist:

```text
AUTO
Ask only when necessary

SUPERVISED
Ask before important actions

MANUAL
Never perform significant actions without approval
```

Examples of actions requiring approval:

- Delete files
- Install dependencies
- Push to remote
- Change configuration
- Execute dangerous commands
- Merge changes

---

## 16. "Continue" / Resume

The user should be able to simply say:

```text
continue
```

And the system understands:

- Current mission
- Current task
- Previous progress
- Blockers
- Next action
- Available providers
- Previous decisions

Then continues from the correct point.

---

## 17. Background Progress

Potential future feature:

```text
Mission #12
Status: RUNNING
```

The user can leave and come back later.

When they return:

```text
MISSION UPDATE

12 tasks completed
3 new tasks discovered
1 task failed
2 tasks waiting for approval

Current task:
Integration testing
```

---

## 18. Notifications

The system could notify the user when:

- A mission finishes
- Human approval is needed
- AI usage is exhausted
- Usage becomes available again
- A task fails
- The AI gets blocked
- A major decision needs confirmation

---

## 19. Research Mode

Some missions require research before coding.

```text
Research task
    ↓
Gather information
    ↓
Summarize findings
    ↓
Store knowledge
    ↓
Create implementation tasks
```

Research becomes part of the mission rather than something completely separate.

---

## 20. Self-Review

Before considering a mission complete:

```text
Implementation
      ↓
Tests
      ↓
Review
      ↓
Potential problems
      ↓
New tasks
      ↓
Fixes
      ↓
Review again
```

The system shouldn't simply assume that "the AI generated code" means the task is finished.

**This is the single most important piece to get right.** The most common failure mode of autonomous coding agents is confidently marking broken work complete — the entire system's credibility rests on this loop, not just on task orchestration working smoothly.

---

## 21. Task Priorities

Tasks could have:

```text
Critical
High
Normal
Low
```

But priority shouldn't be the only factor. The scheduler could consider:

```text
priority
dependencies
difficulty
estimated cost
available provider
required capabilities
blocked state
```

---

## 22. Cost / Usage Dashboard

Even when using free providers, usage matters.

```text
AI USAGE

Provider      Used       Remaining
Gemini        62%        38%
Provider B    21%        79%
Local         ∞           -

Current task:
#48 Implement tests

Estimated requests:
4
```

Eventually this could help the scheduler decide where to send tasks.

---

## 23. Task History

Every task should have a history.

```text
Task #42

Created:
09:12

Started:
09:18

Agent:
Coder

Attempts:
3

Files modified:
7

Tests:
14 passed
2 failed

Status:
Completed
```

This makes autonomous work understandable and auditable.

---

## 24. Explainability

The system should be able to answer:

> Why did you do this?

```text
I created task #51 because task #43
depends on functionality that doesn't currently exist.

I prioritized #51 because #43 is blocked by it.
```

This is important if the AI is making decisions autonomously.

---

## 25. Plugin System

Eventually the system could become extensible.

```text
plugins/
├── github
├── gitlab
├── discord
├── slack
├── database
├── browser
├── docker
└── custom-tools
```

Plugins could add:

- Tools
- Providers
- Agents
- Commands
- Integrations
- Notifications

---

## Long-Term Vision

The important concepts, in order:

**Mission → Planning → Dynamic Tasks → Agents → Tools → Memory → Validation → Continuation**

Everything else can grow around those pillars.

The first version doesn't need to be impressive. It just needs to prove one thing:

> Give it a meaningful objective, and it can turn that objective into a task, work on it, remember its progress, and continue.

---

## Phased Roadmap

### v1 — Prove the loop works at all

Goal: one agent, one mission, tasks that spawn tasks, and it survives a restart.

- Mission → Planner produces initial task list (flat is fine, don't build the tree UI yet)
- Task graph with dependencies + the state machine (Section 4) — get this data model right early, everything else sits on top of it
- Single agent, single provider (pick the one you use most)
- Tasks can create new tasks with a declared reason and attach as a dependency of the task that spawned them
- Basic self-review (Section 20): after a task is marked done, a second pass checks it against the original task description before it's allowed to flip to COMPLETED — even a crude version beats none
- Checkpointing: snapshot state (git commit or similar) before a task starts, so you can roll back
- "Continue": reload mission state, find next READY task, keep going

Cut everything else for v1 — no multi-agent, no multi-provider switching, no plugins, no dashboard, no notifications. If this loop can't reliably turn one real objective into working, reviewed code without babysitting every step, nothing downstream matters.

### v2 — Make it resilient and legible

Goal: it survives real-world interruption and you can trust why it did things.

- Usage/resource awareness (Section 6) — detect provider limits, pause with saved state, resume later. This is the real differentiator vs. Arctic — promote it here rather than leaving it buried
- Explainability log (Section 24) — every task creation/reprioritization/skip gets a one-line "why," queryable later
- Persistent decision memory (Section 11), separate from task history
- Multi-provider abstraction (Sections 7–8) — now it earns its place, since you already have a working single-provider loop to prove the abstraction against
- Human approval levels (Section 15) for anything destructive (deletes, installs, pushes)

### v3 — Scale it out

Goal: it's no longer one agent doing everything.

- Split into specialized agents (Planner/Coder/Tester/Reviewer) with handoffs through the task queue rather than shared context (Sections 9–10)
- Model selection per task type (Section 8)
- Background progress + notifications (Sections 17–18) — matters once missions run long enough unattended that leaving and coming back is a real workflow
- Cost dashboard (Section 22) informing scheduling, not just display

### Deferred indefinitely — revisit only if v1–v3 prove out and there's real demand

- Plugin system (Section 25) — premature until you know what actually needs to be pluggable
- Full git checkpoint/rollback UI, comparing task states (Sections 13–14 beyond the basic v1 checkpointing) — useful but not core to proving the thesis

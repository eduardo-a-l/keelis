# Roadmap

Full context and rationale live in [keelis-project.md](keelis-project.md).
This file tracks the phased, actionable version of that plan.

## v1 — Prove the loop works at all

Goal: one agent, one mission, tasks that spawn tasks, and it survives a restart.

- [x] Mission → Planner produces an initial flat task list
- [x] Task graph with dependencies and the state machine (`src/core`)
- [x] Single agent, single provider (agent is currently a stub that marks
      tasks complete without doing real work — real execution is next)
- [x] Tasks can create new tasks with a declared reason, attached as a
      dependency of the task that spawned them (`TaskGraph.spawnTask`,
      triggered by `SimpleAgent` when it reports a blocker)
- [x] Basic self-review: `SimpleReviewer` checks the work summary against
      the original task description before it flips to `COMPLETED`;
      rejected reviews retry up to a capped number of attempts, then
      `CANCELLED` rather than looping forever
- [ ] Checkpointing: snapshot state before a task starts, so it can be
      rolled back
- [x] `continue`: reload mission state, find the next `READY` task, keep going

No multi-agent, no multi-provider switching, no plugins, no dashboard, no
notifications until this loop is reliable without babysitting every step.

Remaining known gap: `SimpleAgent` reasons about a task and reports a
summary, but doesn't yet read/write files or run commands. Self-review and
retries operate on what the agent _says_ it did, which is real progress on
the orchestration loop but not yet real code execution.

## v2 — Make it resilient and legible

Goal: it survives real-world interruption and you can trust why it did things.

- [ ] Usage/resource awareness — detect provider limits, pause with saved
      state, resume later (this is the differentiator vs. Arctic).
      `RetryingProvider` (v1) already retries transient errors like 503s
      with backoff, but that's short-term resilience, not the same as
      detecting a hard usage cap and pausing until it resets
- [ ] Explainability log — every task creation/reprioritization/skip gets a
      one-line "why," queryable later
- [ ] Persistent decision memory, separate from task history
- [ ] Multi-provider abstraction
- [ ] Human approval levels for anything destructive (deletes, installs, pushes)

## v3 — Scale it out

Goal: it's no longer one agent doing everything.

- [ ] Specialized agents (Planner/Coder/Tester/Reviewer) with handoffs
      through the task queue
- [ ] Model selection per task type
- [ ] Background progress + notifications
- [ ] Cost dashboard informing scheduling, not just display

## Deferred indefinitely

Revisit only if v1–v3 prove out and there's real demand.

- Plugin system
- Full git checkpoint/rollback UI, comparing task states

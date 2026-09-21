# Roadmap

Full context and rationale live in [keelis-project.md](keelis-project.md).
This file tracks the phased, actionable version of that plan.

## v1 — Prove the loop works at all

Goal: one agent, one mission, tasks that spawn tasks, and it survives a restart.

- [ ] Mission → Planner produces an initial flat task list
- [ ] Task graph with dependencies and the state machine (`src/core`)
- [ ] Single agent, single provider
- [ ] Tasks can create new tasks with a declared reason, attached as a
      dependency of the task that spawned them
- [ ] Basic self-review: a second pass checks completed work against the
      original task description before it flips to `COMPLETED`
- [ ] Checkpointing: snapshot state before a task starts, so it can be
      rolled back
- [ ] `continue`: reload mission state, find the next `READY` task, keep going

No multi-agent, no multi-provider switching, no plugins, no dashboard, no
notifications until this loop is reliable without babysitting every step.

## v2 — Make it resilient and legible

Goal: it survives real-world interruption and you can trust why it did things.

- [ ] Usage/resource awareness — detect provider limits, pause with saved
      state, resume later (this is the differentiator vs. Arctic)
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

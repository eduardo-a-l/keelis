# Roadmap

Full context and rationale live in [keelis-project.md](keelis-project.md).
This file tracks the phased, actionable version of that plan.

## v1 — Prove the loop works at all

Goal: one agent, one mission, tasks that spawn tasks, and it survives a restart.

- [x] Mission → Planner produces an initial flat task list
- [x] Task graph with dependencies and the state machine (`src/core`)
- [x] Single agent, single provider — `CodingAgent` does real work via
      tool calls (`read_file`, `write_file`, `list_directory`, an
      allow-listed `run_command`) against `AnthropicProvider`'s native
      tool-use. Gemini has no `converse` adapter yet, so it still falls
      back to the older text-only `SimpleAgent` — a known, temporary
      asymmetry between providers, not by design long-term
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

Remaining known gaps:

- Only `AnthropicProvider` has a `converse`/tool-use adapter. A second
  adapter (Gemini) hasn't been written yet, so the "swap providers freely"
  promise is proven for the planner/reviewer's plain-text calls but not
  yet for the agent's tool-use loop.
- Self-review still asks the model to judge its own summary. Now that the
  agent can actually run commands, review could check something real (did
  the build pass, did tests pass) instead of just judging prose — that's
  the natural next step, not yet done.
- `KEELIS_PERMISSION` (AUTO/SUPERVISED/MANUAL) exists and gates
  `write_file`/`run_command` behind a yes/no prompt, but it's a blunt,
  global setting — no per-command nuance (e.g. `git status` vs `git push`
  are treated the same).
- No checkpointing yet: a rejected review just re-prompts the model on
  top of whatever it already wrote to disk, rather than reverting to a
  clean state first. This matters a lot more now that attempts touch
  real files.

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
- [x] Human approval levels — a basic version landed early in v1
      (`KEELIS_PERMISSION`: AUTO/SUPERVISED/MANUAL, gating `write_file`
      and `run_command`). Still needed for v2: per-command nuance rather
      than one blunt setting, and checkpointing so a denied/failed
      attempt can actually be rolled back, not just retried

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

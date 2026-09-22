<div align="center">
  <img src="assets/logo-readme.png" alt="Keelis" width="120" />
</div>

# Keelis

A persistent AI workspace that takes a large objective and continuously transforms it into completed work.

Instead of:

```
User → Prompt → AI → Answer
```

Keelis is:

```
User → Mission → Planner → Task Graph → Agents → Results → Continue
```

Give it a meaningful objective, and it turns that objective into tasks, works
through them, remembers its progress, and keeps going — without needing a new
prompt for every small step.

## Status

Early, pre-v1. See [docs/ROADMAP.md](docs/ROADMAP.md) for the phased plan and
[docs/keelis-project.md](docs/keelis-project.md) for the full design brainstorm.

The current goal (v1) is narrow on purpose: one agent, one provider, a
mission that produces tasks, tasks that can spawn tasks, a basic self-review
pass before anything is marked done, and a system that survives a restart.
Everything else in the design doc (multi-agent orchestration, multi-provider
routing, plugins, dashboards) is deferred until that loop is proven.

## Core concepts

- **Mission** — the large objective the user hands to the system.
- **Task graph** — a dynamic, dependency-aware set of tasks the planner
  produces and the system can extend while working.
- **Agent** — does the actual work on a task.
- **Self-review** — a task is not COMPLETED just because an agent produced
  output; it has to pass a review against the original task description.
- **Continuation** — the system can be resumed with a single "continue" and
  will reconstruct where it left off from persisted state.

## Project layout

```
src/
  core/       mission, task graph, state machine, planner interfaces
  providers/  AI provider abstraction (single provider for v1)
  agents/     agent implementations
  cli/        command-line entry point
docs/         design brainstorm and roadmap
tests/        unit tests
```

## Getting started

```bash
npm install
cp .env.example .env
# put your Anthropic and/or Gemini API key in .env
npm run build
node dist/cli/index.js start "Build a login page"
```

Keelis picks a provider each run: `KEELIS_PROVIDER=anthropic` or
`KEELIS_PROVIDER=gemini` forces one explicitly. With neither set, it uses
Anthropic if `ANTHROPIC_API_KEY` is present, otherwise Gemini if only
`GEMINI_API_KEY` is set. Gemini's `generateContent` API has a free tier,
which is handy for trying Keelis out without spending on API credits.

`start` plans a mission with the Anthropic provider, saves state to
`.keelis/<missionId>.json`, and runs every ready task. For each task,
`SimpleAgent` asks the provider to either complete the task and summarize
what it did, or report a blocker — in which case it spawns a new dependency
task via `TaskGraph.spawnTask` and the original task moves to `BLOCKED`
until that dependency completes. Once an attempt finishes, `SimpleReviewer`
judges the result summary against the task description before the task is
allowed to become `COMPLETED`; a rejected review sends the task back to
`READY` for another attempt, up to 3 attempts (configurable via
`MissionRunner`'s `maxAttempts`) before it's `CANCELLED`.

`SimpleAgent` does not yet touch the filesystem or run commands — it
reasons about the task and reports a summary, which is enough to prove the
plan → task-graph → self-review → continuation loop end to end. Real code
execution (reading/writing files, running commands) is the next major
piece.

```bash
node dist/cli/index.js continue <missionId>
```

reloads a mission's saved state and keeps working through any tasks that
are still ready.

## Scripts

| Command             | Purpose                           |
| ------------------- | --------------------------------- |
| `npm run dev`       | Run the CLI in watch mode         |
| `npm run build`     | Compile TypeScript to `dist/`     |
| `npm run typecheck` | Type-check without emitting       |
| `npm run lint`      | Lint the codebase                 |
| `npm run format`    | Format the codebase with Prettier |
| `npm test`          | Run the test suite                |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).

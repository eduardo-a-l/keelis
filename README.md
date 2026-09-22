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
# put your Anthropic API key in .env
npm run build
ANTHROPIC_API_KEY=... node dist/cli/index.js start "Build a login page"
```

`start` plans a mission with the Anthropic provider, saves state to
`.keelis/<missionId>.json`, and runs every ready task. The agent that runs
tasks is currently a stub — it marks a task `RUNNING` then `COMPLETED`
without doing real work, which is enough to prove the mission → plan →
task-graph → continuation loop end to end. Real task execution is next.

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

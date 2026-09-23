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
node --env-file=.env dist/cli/index.js start "Build a login page"
```

`--env-file` is a Node flag (20.6+), not a shell feature, so this works
the same way on Windows, macOS, and Linux. Don't try to load `.env` with
shell syntax like `export $(cat .env | xargs)` — that's bash-only and
silently does nothing on Windows.

Keelis picks a provider each run: `KEELIS_PROVIDER=anthropic` or
`KEELIS_PROVIDER=gemini` forces one explicitly. With neither set, it uses
Anthropic if `ANTHROPIC_API_KEY` is present, otherwise Gemini if only
`GEMINI_API_KEY` is set.

Every provider call is wrapped in `RetryingProvider`, which retries
transient errors (429, 500, 502, 503, 504) with exponential backoff — up
to 4 attempts, waiting 1s/2s/4s between them by default — before giving
up. This is common with free-tier APIs under load; a `503 UNAVAILABLE` is
usually just that and clears up within a few seconds.

Both providers default to a specific model string (see
`src/providers/anthropic.ts` / `gemini.ts`), which vendors periodically
retire or rename. If a run fails with a 404 or "model not found," set
`ANTHROPIC_MODEL` or `GEMINI_MODEL` in `.env` to whatever model string the
error message (or the provider's current docs) points you to — no code
change needed.

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

**Real tool use, on both providers.** Both `AnthropicProvider` and
`GeminiProvider` implement `ToolCapableProvider`, so `start`/`continue` use
`CodingAgent` regardless of which one you pick — including on Gemini's free
tier. `CodingAgent`
runs a bounded loop (`maxSteps`, default 8) of real tool calls — `read_file`,
`write_file`, `list_directory`, and an allow-listed `run_command` (`git`,
`npm`, `npx`, `node` by default) — against `KEELIS_WORKDIR` (defaults to the
current directory). Every tool call is path-checked so it can't escape that
directory. If the model calls `report_blocker` instead of finishing, that
becomes a real spawned task via `TaskGraph.spawnTask`, same as before.

`KEELIS_PERMISSION` controls what needs a yes/no prompt before it runs:

- `AUTO` — nothing is confirmed (still restricted to the command allow-list
  and the working directory)
- `SUPERVISED` (default) — `write_file` and `run_command` need
  confirmation; reads do not
- `MANUAL` — every tool call needs confirmation, including reads

Gemini 3-series models (the default) require echoing back a
`thoughtSignature` on each function-call part in the next request, or the
API returns a hard 400. `GeminiProvider` threads this through via
`ToolCall.providerMetadata` — an opaque, provider-specific field the
canonical schema carries but never interprets. When a tool call has no
real signature to echo (shouldn't normally happen in practice), it falls
back to Google's documented dummy value rather than failing outright.
`SimpleAgent` (the older, text-only, no-tools agent) still exists and is
used automatically for any future provider that doesn't implement
`ToolCapableProvider`.

```bash
node --env-file=.env dist/cli/index.js continue <missionId>
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

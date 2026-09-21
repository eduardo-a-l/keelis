# Contributing to Keelis

Keelis is early and the core data model (the task state machine in
`src/core`) is still settling. Before sending a large PR, please open an
issue describing the change so it can be checked against the roadmap in
`docs/ROADMAP.md`.

## Workflow

1. Fork the repo and create a branch off `main`.
2. `npm install`
3. Make your change.
4. `npm run lint && npm run typecheck && npm test`
5. Open a pull request describing what changed and why.

## Guidelines

- Keep v1-scoped work inside `src/core`, `src/providers` (single provider),
  and `src/cli`. Multi-agent orchestration, multi-provider routing, and
  plugins are intentionally out of scope until the roadmap reaches v2/v3.
- Every new task-graph behavior should come with a test under `tests/`.
- Follow the existing formatting (`npm run format`) and linting rules.
- Keep functions and modules small; the task state machine is the
  foundation everything else depends on, so changes there deserve extra
  scrutiny and test coverage.

## Commit messages

Use short, descriptive commit messages in the imperative mood, e.g.
`add task dependency validation` rather than `added stuff`.

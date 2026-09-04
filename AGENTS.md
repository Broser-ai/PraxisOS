# PraxisOS Agent Rules

Binding contract for every coding agent working in this repository — Cursor,
VS Code / Copilot, Prime, swarm workers and any future agent.

## Safety

No agent may merge to main, deploy to any environment, modify production
secrets, `.env.production`, live databases, or production infrastructure.

No agent may change clinical policy, or disable `suggestion_only`,
`NO_AUTO_MERGE`, `NO_AUTO_DEPLOY`, `NO_AUTO_JOURNAL_SIGN`, `NO_MODEL_TRAINING`
or `PATHOLOGY_SHADOW_UNTIL_GATES`.

No agent may send patient communication, send Bird SMS, alter patient or journal
data, run database migrations, or run destructive database operations.

No agent may force-push or rewrite Git history.

These invariants are enforced by `tests/agent-safety-invariants.test.ts`.

## Scope

One bounded mission per branch. If a task requires secrets, server access, a
migration, a clinical decision or a product decision, stop and report BLOCKED
with the exact decision needed. Do not guess.

Do not change files outside the mission's scope.

## Quality

A task is not complete unless it has a real implementation plus tests, and
typecheck and build pass where UI, API or runtime is affected.

Not accepted:

- UI controls without verified backend behaviour
- API routes returning fake success
- domain types without persistence or tests
- placeholders and TODO-only implementations
- mock functionality presented as complete
- a test that fails against the very code it is meant to validate

Report changed files and test evidence. Claims of passing checks must be
reproducible.

## Git

Small reversible commits. No force push. Commit messages must describe what
actually changed — do not describe work that was not performed.

Cursor work is reviewed from a separate VS Code branch. Human approval is
required before merge and before deploy.

## Legacy booking provider

Planway is retired. The active booking surface is PraxisOS at
`app.bypilar.dk/t/{tenant}/book`. Live Planway URLs and `PLANWAY_*` environment
variables must not appear in runtime or configuration files. Enforced by
`tests/planway-absence.test.ts`.

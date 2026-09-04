# PraxisOS Agent Rules

## Safety
No agent may merge, deploy, change production secrets, change clinical policy,
disable suggestion_only, disable NO_AUTO_MERGE, disable NO_AUTO_DEPLOY,
disable NO_AUTO_JOURNAL_SIGN, disable NO_MODEL_TRAINING, or disable
PATHOLOGY_SHADOW_UNTIL_GATES.

No agent may send patient communication, send SMS, alter patient/journal data,
run destructive database operations, or modify production infrastructure.

## Quality
A task is not complete unless it has real implementation, relevant tests,
typecheck, and build where UI/API/runtime is affected.

UI buttons without verified backend behavior, API routes returning fake success,
domain types without persistence/tests, placeholders, TODO-only implementations,
and mock functionality presented as complete are not accepted.

## Git
One task per branch. Small reversible commits. No force push.
Cursor work must be reviewed from a separate VS Code branch.
Human approval is required before merge and deploy.

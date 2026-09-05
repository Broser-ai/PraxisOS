# Governance + Planway final review · Session 6

**Branch:** `cursor/governance-planway-final-review-2c11`  
**Base:** `agent/planway-removal-and-governance-2c11` @ `47f3bdf`  
**Status:** FIXED (test-only) · NO MERGE · NO DEPLOY

## Checks

| Gate | Result |
|------|--------|
| Planway in active runtime/config | Absent (no live `planway.com` URLs, no `PLANWAY_*` env keys) |
| Governance rules | Present in `docs/vision/model-governance.md` (suggestions only, pinning, shadow first, no agent autonomy) |
| CI typecheck / tests / build | Present; YAML parses |
| Planway absence-test | Present; now also scans live Next config + root env/package files |
| Agent safety-test | Present; now also locks `suggestion_only` + `NO_AUTO_JOURNAL_SIGN` and CI script names |

## Defects found

1. `tests/planway-absence.test.ts` scanned `next.config.ts` / `next.config.js` but the live file is `next.config.mjs`, so the Next config was not guarded.
2. Root configuration (`.env*.example`, `package.json`, `vercel.json`) was outside the Planway scan set.
3. `tests/agent-safety-invariants.test.ts` did not assert `CLINICAL_POLICY.clinical_status === "suggestion_only"` or `NO_AUTO_JOURNAL_SIGN`.

## Defects fixed

- Extended the Planway scan list to include `next.config.mjs` / `.cjs`, `package.json`, `vercel.json`, and checked-in env examples.
- Added a regression that fails if those files drop out of the scan set.
- Locked `suggestion_only`, `NO_AUTO_JOURNAL_SIGN`, and CI `typecheck` / `test` / `build` in the agent-safety suite.

## Not changed

- No Planway, Hetzner, or deploy code.
- No CI YAML edit (scripts present; YAML valid).
- No `docs/vision/model-governance.md` edit (rules already present).
- Dispatcher, budget-guard, roles, execution-provider-registry, agents/runtime untouched.

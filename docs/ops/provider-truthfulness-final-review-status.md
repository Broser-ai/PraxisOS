# Provider truthfulness — final review (session 3)

NO MERGE / NO DEPLOY.

## Defect

`finishSimulated()` persisted `status: "completed"` on the opt-in simulated
fallback. Markers (`simulated`, `nonExecuting`, `notRealLlmResult`) were set,
but any consumer filtering on `status === "completed"` treated a no-model run
as finished work.

## Fix

Simulated fallback now uses the same terminal status as a real provider miss:

- missing config / `provider_unavailable` → `blocked`
- `provider_timeout` / `provider_error` → `failed`

Never `completed`, `success`, or `finished`. Real LLM success may still be
`completed`. No live provider calls in tests (fetch always stubbed).

## Checklist (regression in `tests/agents/failure-truthfulness.test.ts`)

- [x] missing provider config → blocked (not success)
- [x] timeout → `provider_timeout`
- [x] provider error → `provider_error`
- [x] simulated fallback never completed/success/finished
- [x] simulated fallback is non-executing (no fetch, no tool calls)
- [x] real provider success may still be completed
- [x] no false FINISH

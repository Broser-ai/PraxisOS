# ExecutionProvider contract (sandbox)

Fail-closed registry in `lib/prime/execution-provider-*`. Defaults are **unconfigured/disabled** (never `live_ready`). Only **mock** may be `sandbox_ready` without adapter/config evidence. Unknown, unconfigured, disabled, patient, and clinical scopes are blocked. Live always requires human approval. Env checks use key-name presence only — no secret values, no SDK execution.

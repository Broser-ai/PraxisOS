# PraxisOS · Coding ready (integrate tip)

**Verdict: YES — resume Broser programming on `cursor/integrate-all-superb-2c11`.**

This is **not** a claim that the foot scanner / clinical path is 100% PASS. Sandbox + live gate are green; residuals remain before production clinical sign-off.

## Green checks (2026-08-31)

| Check | Result |
|-------|--------|
| Branch | `cursor/integrate-all-superb-2c11` (clean tip) |
| `PRAXIS_SANDBOX_FORCE_LOCAL=1 npm run sandbox:verify` | **PASS** (`overall_exit=0`, path=`local-npm`) |
| `tsc --noEmit` | PASS |
| vitest | PASS — 16 files / 83 tests |
| `next build` | PASS |
| Live `GET /api/scan/config` | `ok: true`, **`liveReady: true`**, `blockers: []` |
| Live `llmReady` | true |

Do **not** merge to `main` on this signal alone.

## Residuals (still open — not coding blockers)

1. **Replicate billing** — resolve 402/429 before live GLB / Trellis clinical PASS
2. **Custom Roboflow** — train/deploy `praxisos-foot-*` v1 (currently undeployed; fail-soft to Universe)
3. **Formal DPA** — PDF / legal sign-off (do not invent)
4. **Plantar E2E** — clinical end-to-end sign-off on production path

## How to continue

```bash
git checkout cursor/integrate-all-superb-2c11
git pull origin cursor/integrate-all-superb-2c11
PRAXIS_SANDBOX_FORCE_LOCAL=1 npm run sandbox:verify   # before claiming green again
```

See also: [sandbox-verify.md](./sandbox-verify.md).

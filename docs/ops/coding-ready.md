# PraxisOS · Coding ready (agent stack + P0 secure clinical core)

**Verdict: YES — Broser programming on `main` after agent-stack merge; P0 in-repo slices land via PR #33+#34.**

Layers wired: **Prime RL · S-H · Swarm · Worktree · Meta AI harness** + **P0 secure clinical core** (auth guards, consent, audit, public booking kit, CI).  
**LoRA:** not shipped — see [lora-status.md](../vision/lora-status.md) (`NO_MODEL_TRAINING`).

This is **not** a claim that the foot scanner / clinical path is 100% PASS. Residuals remain before production clinical sign-off. **Merge + Hetzner cutover are manual Broser steps** — see [p0-operator-checklist-merge-cutover.md](./p0-operator-checklist-merge-cutover.md).

## Green checks (agent-stack + continue-dev)

| Check | Result |
|-------|--------|
| Merge order (agent stack) | PR #27 (Prime+docs) → #28 DoD wording → #26 research gap → setup glue |
| P0 merge order (pending Broser) | **#33** (F4–F10) → **#34** (F11–F84) → then cutover runbook |
| `npm run typecheck` | **PASS** |
| `npm test` (vitest) | **PASS** — ~500+ tests (PR #34 continue-dev) |
| `npx tsx scripts/awaken.ts` | smoke OK · daemon running · training=forbidden |
| Clinical gates | suggestion-only · shadow pathology · `NO_AUTO_MERGE` / `NO_AUTO_DEPLOY` |
| CI (F14/F84) | `.github/workflows/ci.yml` typecheck + vitest; verifies npm scripts exist |

## Setup path

Full runbook: **[agent-stack-setup.md](./agent-stack-setup.md)**

```bash
git checkout main && git pull origin main
npm install
npm run typecheck
npm test
# optional narrower:
npx vitest run tests/prime tests/swarm
npm run swarm:awaken          # autonom daemon (no auto-merge)
npm run harness:human-gate    # ranked spike only
```

Env flags: `PRAXIS_SWARM_ENABLED`, `SWARM_APPROVE_TOKEN`, `PRIME_APPROVE_TOKEN`, `SWARM_ALLOW_MAIN_MERGE`, `SWARM_INTERVAL_MS`, `AGENT_WORKER_SECRET` — listed in `.env.example`.

P0 / cutover env: see `.env.production.example` + [p0-db-cutover-runbook.md](./p0-db-cutover-runbook.md).

## Residuals (still open — not coding blockers for agent stack)

1. **Merge #33+#34 to main** — Michael only; no agent merge
2. **Hetzner DB cutover** — manual per cutover runbook (Broser)
3. **Captcha widget** — site keys not set; verify path exists (F42/F63)
4. **Replicate billing** — resolve 402/429 before live GLB / Trellis clinical PASS
5. **Custom Roboflow** — train/deploy `praxisos-foot-*` v1 (currently undeployed; fail-soft to Universe)
6. **Formal DPA** — PDF / legal sign-off (do not invent)
7. **Plantar E2E** — clinical end-to-end sign-off on production path
8. **LoRA** — external research only (Tinker); no in-repo trainer until Broser unlock

See also: [sandbox-verify.md](./sandbox-verify.md) · [swarm-worktree-runtime.md](../swarm-worktree-runtime.md) · [prime-agent-rl.md](../vision/prime-agent-rl.md) · [p0-secure-clinical-core-plan.md](./p0-secure-clinical-core-plan.md).

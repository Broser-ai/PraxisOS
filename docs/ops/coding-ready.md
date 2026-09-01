# PraxisOS · Coding ready (agent stack on main)

**Verdict: YES — Broser programming on `main` after agent-stack merge.**

Layers wired: **Prime RL · S-H · Swarm · Worktree · Meta AI harness**.  
**LoRA:** not shipped — see [lora-status.md](../vision/lora-status.md) (`NO_MODEL_TRAINING`).

This is **not** a claim that the foot scanner / clinical path is 100% PASS. Residuals remain before production clinical sign-off.

## Green checks (agent-stack merge)

| Check | Result |
|-------|--------|
| Merge order | PR #27 (Prime+docs) → #28 DoD wording → #26 research gap → setup glue |
| `npx tsc --noEmit` | **PASS** |
| `npx vitest run tests/prime tests/swarm` | **PASS** — 4 files / 20 tests |
| `npx tsx scripts/awaken.ts` | smoke OK · daemon running · training=forbidden |
| Clinical gates | suggestion-only · shadow pathology · `NO_AUTO_MERGE` / `NO_AUTO_DEPLOY` |

## Setup path

Full runbook: **[agent-stack-setup.md](./agent-stack-setup.md)**

```bash
git checkout main && git pull origin main
npm install
npm run typecheck
npx vitest run tests/prime tests/swarm
npm run swarm:awaken          # autonom daemon (no auto-merge)
npm run harness:human-gate    # ranked spike only
```

Env flags: `PRAXIS_SWARM_ENABLED`, `SWARM_APPROVE_TOKEN`, `PRIME_APPROVE_TOKEN`, `SWARM_ALLOW_MAIN_MERGE`, `SWARM_INTERVAL_MS`, `AGENT_WORKER_SECRET` — listed in `.env.example`.

## Residuals (still open — not coding blockers for agent stack)

1. **Replicate billing** — resolve 402/429 before live GLB / Trellis clinical PASS
2. **Custom Roboflow** — train/deploy `praxisos-foot-*` v1 (currently undeployed; fail-soft to Universe)
3. **Formal DPA** — PDF / legal sign-off (do not invent)
4. **Plantar E2E** — clinical end-to-end sign-off on production path
5. **LoRA** — external research only (Tinker); no in-repo trainer until Broser unlock

See also: [sandbox-verify.md](./sandbox-verify.md) · [swarm-worktree-runtime.md](../swarm-worktree-runtime.md) · [prime-agent-rl.md](../vision/prime-agent-rl.md).

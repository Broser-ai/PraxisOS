# Prime agent RL · S-H agents · Autonom

Production-safe scaffold for PraxisOS agent stack. **No Clerk Ethos port. No clinical threshold changes.**

## Existed vs built (this change)

| Layer | Status before | This PR |
|-------|---------------|---------|
| **S-H swarm** (`lib/swarm/*`) | Present — ARIA_META, ATLAS, LUNA, FELIX, FREJ, H_BRIDGE, worktrees, journals, NO_AUTO_* | Documented roles; `rl_eval` routing; FREJ already reads shadow/suggestion-only policy |
| **Autonom** (`lib/swarm/daemon.ts`) | Present — 24/7 agenda ticks / cron | Agenda item for Prime RLVR probe |
| **Prime RL** | **Missing** (`lib/learning` never existed; RLVR was research-only) | **Built** — `lib/prime/*` + specialist + MCP + swarm wire |
| Pathology / diagnosis autonomy | Shadow + suggestion-only | Unchanged — Prime cannot lift gates |

## Agent roles

| ID | Kind | Role |
|----|------|------|
| `ARIA_META` | S / meta | Routes tasks; never auto-merge |
| `ATLAS_CODE` | S | Savage worktree plans → human PR |
| `LUNA_RESEARCH` | S | Alphaxiv harvest (citations only) |
| `FELIX_IMPROVE` | S | Measurable improve proposals |
| `FREJ_GATE` | S | Compliance before approve |
| `PRIME_RL` | S | RLVR quiz rewards + education-only policy suggestions |
| `H_BRIDGE` | H | Clinic personas via LangGraph (ops pulse) |
| `AUTONOM` | Daemon | Recurring agenda (includes Prime probe) |
| `prime` (registry) | Specialist | Same RLVR surface as `PRIME_RL` |

See `SWARM_AGENT_ROLES` in `lib/swarm/types.ts`.

## Prime RL invariants

Locked in `PRIME_INVARIANTS`:

- `NO_MODEL_TRAINING` — no ProRL/Lite PPO fine-tune from this scaffold
- `NO_AUTONOMOUS_CLINICAL` — no diagnose/treat/triage autonomy
- `PATHOLOGY_SHADOW_UNTIL_GATES` — Prime cannot enable active pathology routing
- `AI_SUGGESTIONS_ONLY` / `HUMAN_ADJUDICATION_REQUIRED` / `CLASS_0_EDUCATION_ONLY`

## Surfaces

- **Core:** `lib/prime/` (quiz pack, reward, ledger, gates, policy, agent, swarm-bridge)
- **Specialist:** `agents/specialists/PRIME-rl.ts` · registry
- **Swarm:** task type `rl_eval` → `PRIME_RL` · daemon agenda
- **MCP:** `prime_rlvr_quiz`, `prime_status`
- **Ledger:** Prime ledger + shared `lib/agents/ledger` + audit

## Tests

- `tests/prime/rlvr.test.ts` — rewards, clinical gate, adjudication, swarm route
- Existing `tests/swarm/*` — invariants still apply

## Non-goals

- Model training / PPO
- Autonomous diagnosis or treatment
- Changing `SCAN_QUALITY_THRESHOLD` or other clinical thresholds
- Clerk Ethos port
- Aunome / fantasy singularity orchestrator

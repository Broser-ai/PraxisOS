# Broser acceptance · OOO 2026-09-03

**Approver:** Michael Ambrosius (Broser) — out of office  
**Order:** *approve the general build up for acceptance before fully implementation*  
**Intent:** Accept the foundation now. Do **not** start the remaining full P0 Secure Clinical Core implementation while Broser is away.

---

## Accepted onto `main`

| Item | PR | Branch | Scope accepted |
|------|----|--------|----------------|
| AI fodpleje arkitekt-briefing | #29 | `cursor/ai-fodpleje-arkitekt-briefing-2c11` | Architecture briefing for external review |
| P0 Secure Clinical Core **plan** | #30 | `cursor/p0-secure-clinical-core-plan-2c11` | Plan only — not full implementation |
| Prime Execution Control | #31 | `cursor/prime-execution-control-2c11` | Control plane (dispatcher/lease, missions, budget, DoD) — **subsumed by #32** |
| Secure journal API auth | #32 | `cursor/secure-journal-auth-mission-03bd` | First yellow-mission vertical slice (journal routes + `GET /api/auth/me`); includes PEC from #31 |

**Merge note:** `#32` is a strict descendant of `#31`. Merging `#32` brings Prime Execution Control; `#31` is closed as superseded (already on `main` via `#32`). Preferred order executed: **#29 → #30 → #32** (acceptance note merged with the batch).

This is **not** “full P0”. Journal auth is the accepted first implementation slice under the yellow mission (tests already verified on the PR branch).

---

## Explicitly paused until Broser returns

Do **not** proceed with the following without Broser:

1. **Full P0 Secure Clinical Core beyond journal** — plan items **F3–F10** remaining work outside the journal vertical slice: clients/bookings guards (F4), bird/scan/secrets/license/agents (F5), public booking kit hardening (F6), consent lib + gates (F7), audit align + durable emits (F8), additive DB compose/scripts (F9), cutover runbook + JSON→PG import (F10). Middleware/spoof hardening (F2) beyond what shipped with the journal slice stays paused unless a tiny follow-up is pre-approved.
2. **Patient AI / clinical suggestion expansion** — no new patient-facing AI features; keep suggestion-only / human-gated invariants.
3. **LoRA / model training** — still blocked by `PRIME_INVARIANTS.NO_MODEL_TRAINING`.
4. **Hetzner DB cutover / production unlock** — no self-host Postgres cutover, no env flip to production DB, no deploy-driven patient-path unlock without Broser.
5. **Red missions** — no red-tier PEC missions; yellow journal slice is the limit for this acceptance window.
6. **Destructive ops** — do **not** hard-delete Supabase; do **not** change `clinical_status`; do **not** deploy to Hetzner unless already automated and clearly safe.

Open drafts unrelated to this foundation batch (clinic-core, Bird, byPilar, sandbox, migrate gate, etc.) stay **open / unmerged** unless Broser revisits them.

---

## How to resume

1. Read this note + `docs/ops/p0-secure-clinical-core-plan.md` §F (implementation order).
2. Confirm `#29` / `#30` / `#32` (and PEC docs under `docs/ops/prime-execution-control*.md`) are on `main`.
3. Pick the next P0 slice after journal — typically remaining **F2** polish then **F4** (clients/bookings) — as a **new yellow (or Broser-approved) mission**, not a bulk F3–F10 sweep.
4. Re-open red missions / Hetzner cutover only with Broser present for secrets, SSH, and delete-gate decisions.
5. Keep GitHub updated: ready PRs with clear bodies; no silent main pushes of clinical scope while OOO acceptance is the only gate.

---

## Non-goals of this acceptance window

- No new large features  
- No Hetzner deploy beyond already-safe automation  
- No `clinical_status` changes  
- No Supabase hard-delete  

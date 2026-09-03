# P0 · Operator checklist · merge #33 + #34 + cutover

**Owner:** Michael Ambrosius (Broser) · **Manual** — no agent merges or deploys.
**Invariants:** `NO_AUTO_MERGE` · `NO_AUTO_DEPLOY` · `suggestion_only` ·
`NO_AUTO_JOURNAL_SIGN` · `NO_MODEL_TRAINING` · `PATHOLOGY_SHADOW`.

This checklist links **PR #33** (P0 F4–F10 execution slices) and **PR #34**
(continue-dev F11–F48) into the cutover path in `docs/ops/p0-db-cutover-runbook.md`.

---

## A. Merge order (GitHub — Michael only)

- [ ] Confirm CI green on **PR #33** (`cursor/p0-execution-slices-2c11` → `main`).
- [ ] Merge **#33** first (auth guards F4–F5, booking kit F6, consent F7, audit F8, DB infra F9, cutover runbook F10).
- [ ] Rebase/retarget **PR #34** onto updated `main` if needed (`cursor/continue-dev-slices-2c11`).
- [ ] Confirm CI green on **PR #34** (F11–F48 continue-dev).
- [ ] Merge **#34** second.
- [ ] Do **not** enable auto-merge; do **not** trigger host deploy from the PR UI.

## B. Pre-cutover on Hetzner (after both merges are on the branch you deploy from)

Follow `docs/ops/p0-db-cutover-runbook.md` §0–§2. Short form:

- [ ] SSH host; `docker compose ps` shows `praxisos_app`.
- [ ] Snapshot `/data` (`secrets.json`, `journal-store.json`).
- [ ] Fill `.env.production` secrets locally (session, DB, audit, worker, event) — **never commit**.
- [ ] Start `docker-compose.db.yml` + migrations (`scripts/db-init-selfhost.sh`).
- [ ] Dry-run then execute `scripts/migrate-memory-to-pg.ts` when ready.

## C. App env switch (still manual)

- [ ] Set `PRAXIS_DB=supabase-eu` (or `supabase-local`) + Supabase URL/keys.
- [ ] Set `PRAXIS_AUDIT_MODE=supabase` when audit_log is migrated.
- [ ] Set worker secrets (`AGENT_WORKER_SECRET`, cron) — F12 fail-closed in production.
- [ ] Optional captcha: `TURNSTILE_SECRET_KEY` or `HCAPTCHA_SECRET_KEY` + `CAPTCHA_PROVIDER` (F42). Without keys, prod fail-closed when captcha step-up is required (`CAPTCHA_FAIL_CLOSED` default on in production).
- [ ] Redeploy/restart app **only** after Michael verifies env (no agent deploy).

## D. Smoke after restart (F23–F40 + F41–F48)

### Auth / audit / public (F23–F40)

- [ ] `GET /api/health` → `ok: true`, `backend: "supabase"`, `dbMode != "mock"` (F16 fail-fast if misconfigured).
- [ ] Health `detail` has no JWT/key material (F26 redaction).
- [ ] by-Pilar public booking still 201 (F6 CORS/rate-limit).
- [ ] Staff login → `GET /api/auth/me` 200; journal list gated (F3/F4).
- [ ] Spoofed `x-praxis-tenant` alone → 401 (F11 middleware + guards).
- [ ] Signup rate-limit + audit events visible in memory/supabase (F25).
- [ ] Signup / login captcha step-up after repeated failures (F34/F37); with keys, F42 verifies Turnstile/hCaptcha.
- [ ] `GET /api/v1/scan/process` unauthenticated → 401 (F24).
- [ ] Public bird/scan config GET has no `*Hint` / `keyHint` (F33/F36).
- [ ] CVR/DAWA return 429 under burst (F32).
- [ ] Journal create/sign audits carry request context in supabase mode (F35).
- [ ] Tenant setup / license / scan process audits include request context (F23).
- [ ] License GET is tenant-scoped (F24).
- [ ] Agents approvals decide emits `approval.decided` with request context (F40).
- [ ] Lookup/voucher isolated rate-limit (F22); invalid email/short code → 400 (F48).

### Continue-dev F41–F48

- [ ] Research / swarm / orchestrator reject unauthenticated + spoofed headers (F41).
- [ ] Consent onboarding audit has request context (`auditLogWithContext`) (F43).
- [ ] Public GET bird/status, bird/config, scan/config return 429 under burst (F44).
- [ ] `POST /api/agents/run` emits `agent.run` audit with request context (F45).
- [ ] Prime missions use `requireTenantAccess` (F46).

## E. Explicit non-goals (do not do in this cutover)

- Patient AI product features / triage / LiveKit voice.
- Clinical policy changes.
- Auto-merge, auto-deploy, auto journal sign.
- Weakening `suggestion_only` mission policy.

## F. Rollback

If health 503 or booking broken: restore prior app image + `/data.pre-cutover.bak`,
set `PRAXIS_DB=mock` only as emergency (not for sustained prod). See cutover
runbook §Rollback.

---

*F27/F39/F47 · continue-dev PR #34 · F23–F48 smoke · suggestion_only · 2026-09-03*

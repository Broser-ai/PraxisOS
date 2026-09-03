# P0 · Operator checklist · merge #33 + #34 + cutover

**Owner:** Michael Ambrosius (Broser) · **Manual** — no agent merges or deploys.
**Invariants:** `NO_AUTO_MERGE` · `NO_AUTO_DEPLOY` · `suggestion_only` ·
`NO_AUTO_JOURNAL_SIGN` · `NO_MODEL_TRAINING` · `PATHOLOGY_SHADOW`.

This checklist links **PR #33** (P0 F4–F10 execution slices) and **PR #34**
(continue-dev F11–F64) into the cutover path in `docs/ops/p0-db-cutover-runbook.md`.

---

## A. Merge order (GitHub — Michael only)

- [ ] Confirm CI green on **PR #33** (`cursor/p0-execution-slices-2c11` → `main`).
- [ ] Merge **#33** first (auth guards F4–F5, booking kit F6, consent F7, audit F8, DB infra F9, cutover runbook F10).
- [ ] Rebase/retarget **PR #34** onto updated `main` if needed (`cursor/continue-dev-slices-2c11`).
- [ ] Confirm CI green on **PR #34** (F11–F64 continue-dev).
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
- [ ] Optional captcha: `TURNSTILE_SECRET_KEY` / `HCAPTCHA_SECRET_KEY` + matching `*_SITE_KEY` (or `NEXT_PUBLIC_*_SITE_KEY`) for widget (F42/F63). Without secrets, prod fail-closed when captcha step-up is required (`CAPTCHA_FAIL_CLOSED` default on in production). **UI widget is skipped until site keys are set** (F63).
- [ ] Optional public allowlists: `PRAXIS_BOOKING_CORS_ORIGINS`, `PRAXIS_MCP_ORIGINS` (F6/F59/F60).
- [ ] Redeploy/restart app **only** after Michael verifies env (no agent deploy).

## D. Smoke after restart (F23–F64)

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
- [ ] `GET /api/auth/me` emits `auth.me` audit (F50).
- [ ] Public services/availability return 429 under burst (F51).
- [ ] Cron swarm-tick unauthorized emits audit (F53).

### Continue-dev F49–F58 (F61 checklist coverage)

- [ ] CODE-MAP + `.env.example` document captcha + public RL surfaces (F49).
- [ ] `GET /api/auth/me` uses `sessionFromRequest` + `auth.me` audit (F50).
- [ ] Services / availability public GET 429 under burst (F51).
- [ ] Prime missions mutations emit audit with request context (F52).
- [ ] Cron swarm-tick success/unauthorized audits (F53).
- [ ] Logout emits `logout.success` with request context (F55).
- [ ] `GET /api/agents/status` emits `agent.status_viewed` (F56).
- [ ] Health GET generous rate-limit still returns 200 for monitors, 429 under flood (F57).

### Continue-dev F59–F64

- [ ] MCP `initialize` / `ping` / `tools/list` / GET discovery return 429 under burst (F59).
- [ ] Embed `/embed/v1/bypilar` still serves JS; ACAO only for allowlisted Origin; 429 under flood (F60).
- [ ] Booking POST emits `booking.created` audit; events/tick/workflows emit context audits (F62).
- [ ] Login/signup captcha widget absent until site keys configured (F63); placeholders in `.env.example`.
- [ ] Services/availability ACAO only for allowlisted Origin (F65).
- [ ] Swarm/tick + research harvest audits present (F66); MCP unauthorized audited (F67).
- [ ] Staff clients/bookings list omit ACAO `*` (F69); list-view audits (F70).
- [ ] CVR/DAWA omit ACAO `*` (F72); responses carry nosniff/referrer; embed/book stay frameable (F73).

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

*F27/F39/F47/F54/F61 · continue-dev PR #34 · F23–F64 smoke · suggestion_only · 2026-09-03*

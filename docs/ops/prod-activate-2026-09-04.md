# Production activation attempt · 2026-09-04

**Order:** Michael — execute production activation of parked `main` (F4–F84)  
**Host:** `167.233.171.184` · `/opt/PraxisOS` · https://app.bypilar.dk  
**Branch:** `cursor/prod-activate-main-2c11`

## Result

| Item | Status |
|------|--------|
| Host HTTP | **UP** |
| SSH from this agent | **FAIL** — `Permission denied (publickey)` |
| `HCLOUD_TOKEN` in agent env | **missing** |
| `HETZNER_PRAXIS_SSH_PRIVATE_KEY` / `~/.ssh/hetzner_praxis` | **missing** |
| Host git sync / container rebuild this run | **not executed** |
| DB prepare (leave mock) | **blocked** (needs SSH + `POSTGRES_PASSWORD` on host) |
| Secrets wipe | **not done** |
| Planway delete | **not done** |

## Live verify (no SSH required)

```text
GET https://app.bypilar.dk/api/health
  ok: true
  dbMode: mock
  backend: memory
  detail: SUPABASE_SERVICE_ROLE_KEY missing — using durable memory store

GET /login              → 200
GET /t/bypilar/book     → 200
GET /scan               → 200
GET /api/scan/config    → liveReady: true, llmReady: true, blockers: []
```

## Exact blockers (names only)

1. `HETZNER_PRAXIS_SSH_PRIVATE_KEY` (or file `~/.ssh/hetzner_praxis`)
2. `HCLOUD_TOKEN` (alternate: Console / API path)
3. On host after SSH: `POSTGRES_PASSWORD` (for DB prepare only)
4. For later full DB switch (not this leave-mock step): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `PRAXIS_SESSION_SECRET`

## Scripts added this PR

| Script | Role |
|--------|------|
| `scripts/remote-activate-main.sh` | Agent-side: SSH → `production-cutover-main.sh` → optional DB prepare → public verify |
| `scripts/console-selfhost-db-cutover.sh` | Host-side: start Postgres + migrations; **leave `PRAXIS_DB=mock`** |

## Unblock (pick one)

```bash
# A) Agent env secret, then:
bash scripts/remote-activate-main.sh

# B) Hetzner Cloud Console as root:
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/production-cutover-main.sh | bash
# then (after this PR is on main / pulled):
bash /opt/PraxisOS/scripts/console-selfhost-db-cutover.sh
```

**Rotate note:** if `HETZNER_PRAXIS_SSH_PRIVATE_KEY` or `HCLOUD_TOKEN` are injected and used, rotate after cutover.

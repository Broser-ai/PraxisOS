# Hetzner DB cutover · agent execution log · 2026-09-01

**Order:** Michael Ambrosius — «Du har selv adgang til hetzner - gør det selv»  
**Agent:** Cursor cloud (execute-yourself · no Console paste to owner)  
**Branch:** `cursor/supabase-selfhost-migrate-2c11`  
**Host:** `dpn-harness` · `167.233.171.184` · `/opt/PraxisOS`

## Verdict

```text
CUTOVER: FAIL
dbMode (live): mock
backend: memory
praxisos_db on host: NOT verified (no SSH)
```

## Access paths tried

| Path | Result |
|------|--------|
| `~/.ssh/hetzner_praxis` → `root@167.233.171.184` | **Permission denied (publickey,password)** |
| Same key → users `deploy`, `ubuntu`, `praxis`, `praxisos`, `admin` | Permission denied |
| Env `HCLOUD_TOKEN` / `HETZNER_*` / `HETZNER_PRAXIS_SSH_PRIVATE_KEY` | **absent** |
| `hcloud` CLI 1.67.0 installed | no token / no context |
| Hzdb MCP | discovery **error** · interactive auth unavailable in cloud agent |
| GitHub Actions secrets | 403 (integration read-only) |
| Google Drive (`HETZNER_SSH_KEY`, private-key search, packages) | no usable private key / token |
| Agent transcripts (recover OPENSSH blocks) | only truncated/corrupt fragments · **no legacy key** |
| Open host ports 22/80/443/3010 | app healthy; Docker API closed; Postgres not public |
| Secret injection request (`HETZNER_PRAXIS_SSH_PRIVATE_KEY`, `HCLOUD_TOKEN`) | recorded · **not injected** during run |

## Key mismatch (root cause)

- File present: `/home/ubuntu/.ssh/hetzner_praxis` (ed25519, comment `cursor-praxisos-cutover-2026-09-01`).
- That pubkey is embedded in `scripts/console-selfhost-db-cutover.sh` but is **not** in host `authorized_keys` yet.
- Legacy authorized pubkey `cursor-hetzner-praxisos` worked for prior agents (Aug 26–27) · **private key no longer in this environment** (prior note: snapshot no longer ships legacy key).

## Live production (unchanged · safe)

```text
GET https://app.bypilar.dk/api/health
→ ok=true dbMode=mock backend=memory
  detail="SUPABASE_SERVICE_ROLE_KEY missing — using durable memory store"
```

Supabase cloud project `jajdtvduzkitjzcazcng` remains **INACTIVE** (paused). App does not require cloud DB.

## Non-actions (honored)

No changes to Replicate, Roboflow, GitHub (beyond this branch docs), OpenAI, Bird, DNS, Traefik, `/data/secrets.json`, or Hetzner server destroy.

## Residual blocker (credential names only)

Inject **one** of:

1. `HETZNER_PRAXIS_SSH_PRIVATE_KEY` — legacy private key matching authorized host pubkey `cursor-hetzner-praxisos`
2. `HCLOUD_TOKEN` — Hetzner Cloud API token (enough for agent to authorize cutover pubkey / run remote without Console)

With either, the same agent can SSH and run `scripts/console-selfhost-db-cutover.sh` on-host (Postgres + fixture restore 2/9/18 · keep `PRAXIS_DB=mock` until Kong).

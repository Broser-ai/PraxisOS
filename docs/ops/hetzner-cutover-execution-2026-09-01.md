# Hetzner DB cutover · agent execution log · 2026-09-01

**Order:** Michael Ambrosius — Hetzner API token provided for Broser cutover  
**Agent:** Cursor cloud (execute-yourself · rescue key inject · no Console paste)  
**Branch:** `cursor/supabase-selfhost-migrate-2c11`  
**Host:** `dpn-harness` · `167.233.171.184` · `/opt/PraxisOS`

## Verdict

```text
CUTOVER: SUCCESS
dbMode (live): mock
backend: memory
praxisos_db: healthy
row counts: tenants=2 services=9 module_activations=18
```

## Access path used

| Step | Result |
|------|--------|
| `HCLOUD_TOKEN` (ephemeral env · last4 `QNvb`) | OK — `hcloud server list` |
| Create Hetzner SSH key `cursor-praxisos-cutover` | OK |
| `enable-rescue` + soft reboot (disk intact) | OK |
| Mount `/dev/sda1`, append cutover pubkey to `/root/.ssh/authorized_keys` | OK |
| `disable-rescue` + reboot to normal OS | OK |
| SSH `root@167.233.171.184` with `~/.ssh/hetzner_praxis` | OK |
| Run `scripts/console-selfhost-db-cutover.sh` | Partial — truncate stdin bug |
| Manual `docker exec -i` truncate + fixture restore | OK → 2/9/18 |
| Restore Traefik `acme.json` from overlay backup after rescue reboot | OK — LE cert for `app.bypilar.dk` |

**Non-actions honored:** no server rebuild/destroy, no volume wipe, no Replicate/Roboflow/GitHub/OpenAI/Bird/DNS changes, Supabase cloud left **paused** (`jajdtvduzkitjzcazcng`).

## Live production

```text
GET https://app.bypilar.dk/api/health
→ ok=true dbMode=mock backend=memory
  detail="SUPABASE_SERVICE_ROLE_KEY missing — using durable memory store"
```

Local: `praxisos_db` healthy · `PRAXIS_DB=mock` (cloud unused · self-host DB warm).

## Script fixes landed this run

1. Truncate step must use `docker exec -i` (heredoc otherwise never reaches `psql`).
2. Backup/restore Traefik `acme.json` around git checkout.

## Residual issues

1. **Rotate `HCLOUD_TOKEN`** — pasted in chat; treat as compromised.
2. Traefik ACME still fails when router SANs include `praxis.bypilar.dk` (NXDOMAIN). Rescue reboot triggered re-register and dropped `app.bypilar.dk` until overlay `acme.json` restore. Prefer fixing router domains later (out of DB-cutover scope) or keep ACME backup before any rescue/reboot.
3. App remains on `PRAXIS_DB=mock` until Kong/PostgREST self-host flip (`PRAXIS_FLIP_SELFHOST=1`).
4. Supabase project remains paused (not hard-deleted).

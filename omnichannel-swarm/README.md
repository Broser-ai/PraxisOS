# Omnichannel Swarm

Self-hosted omnichannel matrix for **Praxios**, **Cirkel**, and **DPN nails**.

| Layer | Tool | Status |
|---|---|---|
| Gateway / TLS | Traefik | Ready (`docker-compose.yml`) |
| CRM / Inbox | Erxes | Ready (`erxes/`) |
| Voice / WebRTC | Fonoster | Stub (`fonoster/`) |
| Marketing | Dittofeed | Stub (`dittofeed/`) |

## Quick start

```bash
cd omnichannel-swarm
chmod +x scripts/init-swarm.sh
./scripts/init-swarm.sh   # or: make init
# Edit .env and erxes/.env — set ACME_EMAIL + passwords
make start-gateway
make deploy-erxes
make status
```

## DNS

Point these hosts at the swarm node (A/AAAA):

- `traefik.praxios.dk`
- `crm.praxios.dk`, `crm.cirkel.dk`, `crm.dpnnails.dk`

## Data-flow (CRM)

```
Client browser
  → Traefik :443 (Let's Encrypt, Host rule)
  → erxes-gateway :3000
  → Mongo (docs) + Postgres (SQL) + Redis (queue/cache)
```

## Cursor

Open this folder (or the monorepo) in Cursor. Rules live in `.cursorrules`.

Example prompt:

> Generate Fonoster docker-compose on omni_net with Traefik Host `voice.praxios.dk`. Zero-cost WebRTC first; PSTN fallback only.

# PraxisOS på egen server (bypilar)

Alt kører på Hetzner `167.233.171.184` — klinik + Bird SMS + AI agent-worker.

## Database · Supabase → egen server

Se den fulde runbook: [`docs/ops/supabase-to-hetzner-migration.md`](docs/ops/supabase-to-hetzner-migration.md)

Kort: `docker-compose.db.yml` (Postgres 17 + pgvector, volume `praxis_pgdata`) + valgfri supabase/docker Kong-stack. App forbliver `PRAXIS_DB=mock` indtil cutover. Cloud-projektet slettes ikke.

## Hurtigst (anbefalet) · Hetzner Console

1. Gå til [Hetzner Cloud](https://console.hetzner.cloud/) → server `dpn-harness` → **Console**
2. Log ind som `root`
3. Indsæt **én** kommando:

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/production-cutover-main.sh | bash
```

Det: tilføjer Cursor SSH-nøgle, henter `main`, starter Docker (app + agent-worker). For DB-cutover: pull branchen med migration-runbook og følg docs ovenfor.

4. Sæt Bird-nøgle (hvis den mangler):

```bash
nano /opt/PraxisOS/.env.production
# BIRD_API_KEY=...
# BIRD_SMS_CHANNEL_ID=...
# OPENAI_API_KEY=...   # valgfri
docker compose -f /opt/PraxisOS/docker-compose.praxis.yml --env-file /opt/PraxisOS/.env.production up -d --build
```

## Manuel vej (SSH)

```bash
ssh root@167.233.171.184
# tilføj Cursor-nøgle hvis nødvendigt:
# echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAQ64x2uTpPE3JD8kXpo7T+XMKOpn+CzY3C/5aIvV6c5 cursor-hetzner-praxisos' >> ~/.ssh/authorized_keys

cd /opt/PraxisOS 2>/dev/null || git clone -b main https://github.com/Broser-ai/PraxisOS.git /opt/PraxisOS
cd /opt/PraxisOS && git fetch && git checkout main && git pull
bash scripts/deploy-hetzner.sh
# DB self-host: se docs/ops/supabase-to-hetzner-migration.md
```

### Nøgler i `.env.production`

```
BIRD_API_KEY=DIN_NØGLE_HER
BIRD_SMS_FROM=+4526325220
BIRD_WORKSPACE_ID=4ad3f57b-b826-4217-b068-77c9ac0f4f02
BIRD_SMS_CHANNEL_ID=…   # fra Bird → Channels → SMS → Manage (URL)
AGENT_WORKER_SECRET=…   # genereres automatisk af one-shot
PRAXIS_EVENT_SECRET=…   # genereres automatisk af one-shot
OPENAI_API_KEY=         # valgfri
```

## Åbn efter deploy

- Setup: http://167.233.171.184:3010/setup  
- **Agent-automation:** http://167.233.171.184:3010/admin/agents/automation  
- Bird UI: http://167.233.171.184:3010/admin/bird  
- Agent-chat: http://167.233.171.184:3010/agent  
- Klinik: http://167.233.171.184:3010/dashboard  

På automation-siden: tryk **«Kør alle workflows»**.

## DNS (valgfrit)

I GoDaddy: A-record `app` → `167.233.171.184`  
Derefter: http://app.bypilar.dk (når Traefik router er oppe)

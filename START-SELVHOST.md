# PraxisOS på egen server (bypilar)

Alt kører på Hetzner `167.233.171.184` — klinik + Bird SMS + AI agent-worker.

## Hurtigst (anbefalet) · Hetzner Console

1. Gå til [Hetzner Cloud](https://console.hetzner.cloud/) → server `dpn-harness` → **Console**
2. Log ind som `root`
3. Indsæt **én** kommando:

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/ai-agent-automation-2c11/scripts/hetzner-one-shot.sh | bash
```

Det: tilføjer Cursor SSH-nøgle, henter branchen, starter Docker (app + agent-worker).

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

cd /opt/PraxisOS 2>/dev/null || git clone -b cursor/ai-agent-automation-2c11 https://github.com/Broser-ai/PraxisOS.git /opt/PraxisOS
cd /opt/PraxisOS && git fetch && git checkout cursor/ai-agent-automation-2c11 && git pull
bash scripts/deploy-hetzner.sh
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
- **Swarm / Meta harness:** http://167.233.171.184:3010/admin/swarm  
- Bird UI: http://167.233.171.184:3010/admin/bird  
- Agent-chat: http://167.233.171.184:3010/agent  
- Klinik: http://167.233.171.184:3010/dashboard  

På automation-siden: tryk **«Kør alle workflows»**.

Agent-stack env (`PRAXIS_SWARM_ENABLED`, `SWARM_APPROVE_TOKEN`, …) og LoRA-status: [`docs/ops/agent-stack-setup.md`](docs/ops/agent-stack-setup.md). Compose starter `praxisos` + `agent-worker` (tick → Nexus/Autonom); ingen auto-merge/deploy.

## DNS (valgfrit)

I GoDaddy: A-record `app` → `167.233.171.184`  
Derefter: http://app.bypilar.dk (når Traefik router er oppe)

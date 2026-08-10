# PraxisOS på egen server (bypilar)

Alt kører på Hetzner `167.233.171.184` — klinik + Bird SMS + AI agent-worker.

## 1) SSH ind

```bash
ssh root@167.233.171.184
```

## 2) Hent koden

```bash
git clone -b cursor/ai-agent-automation-2c11 https://github.com/Broser-ai/PraxisOS.git /opt/PraxisOS
cd /opt/PraxisOS
```

(Hvis mappen findes allerede: `cd /opt/PraxisOS && git fetch && git checkout cursor/ai-agent-automation-2c11 && git pull`)

## 3) Nøgler (kun på serveren)

```bash
cp .env.production.example .env.production
nano .env.production
```

Sæt mindst:

```
BIRD_API_KEY=DIN_NØGLE_HER
BIRD_SMS_FROM=+4526325220
BIRD_WORKSPACE_ID=4ad3f57b-b826-4217-b068-77c9ac0f4f02
BIRD_SMS_CHANNEL_ID=…   # fra Bird → Channels → SMS → Manage (URL)
AGENT_WORKER_SECRET=vælg-en-hemmelighed
PRAXIS_EVENT_SECRET=vælg-en-hemmelighed
# Valgfri — uden denne kører agenterne stadig (dansk heuristik + tools):
OPENAI_API_KEY=
```

## 4) Deploy

```bash
bash scripts/deploy-hetzner.sh
```

Det starter to containere: `praxisos_app` (port 3010) og `praxisos_agent_worker` (ticker hvert minut).

## 5) Åbn

- Setup: http://167.233.171.184:3010/setup  
- **Agent-automation:** http://167.233.171.184:3010/admin/agents/automation  
- Bird UI: http://167.233.171.184:3010/admin/bird  
- Agent-chat: http://167.233.171.184:3010/agent  
- Klinik: http://167.233.171.184:3010/dashboard  

På automation-siden: tryk **«Kør alle workflows»** — så kører Aria, Sigrid, Magnus, Frej, Vega, Liv, Bjørn, Atlas m.fl. én gang.

## DNS (valgfrit)

I GoDaddy: A-record `app` → `167.233.171.184`  
Derefter: http://app.bypilar.dk (når Traefik router er oppe)

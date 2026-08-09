# PraxisOS på egen server (bypilar)

Alt kører på Hetzner `167.233.171.184` — klinik + Bird SMS.

## 1) SSH ind

```bash
ssh root@167.233.171.184
```

## 2) Hent koden

```bash
git clone -b cursor/selfhost-bird-setup-2c11 https://github.com/Broser-ai/PraxisOS.git /opt/PraxisOS
cd /opt/PraxisOS
```

(Hvis mappen findes allerede: `cd /opt/PraxisOS && git fetch && git checkout cursor/selfhost-bird-setup-2c11 && git pull`)

## 3) Bird-nøgle (kun på serveren)

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
```

## 4) Deploy

```bash
bash scripts/deploy-hetzner.sh
```

## 5) Åbn

- Setup: http://167.233.171.184:3010/setup  
- Bird UI: http://167.233.171.184:3010/admin/bird  
- Klinik: http://167.233.171.184:3010/dashboard  

## DNS (valgfrit)

I GoDaddy: A-record `app` → `167.233.171.184`  
Derefter: http://app.bypilar.dk (når Traefik router er oppe)

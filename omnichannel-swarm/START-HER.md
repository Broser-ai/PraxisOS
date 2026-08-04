# Start her (ikke-programmør)

Du behøver **ikke** at programmere. Du skal bare have en billig Ubuntu-server (VPS).

## 1) Køb en VPS

Anbefalet: Ubuntu 22.04 eller 24.04, mindst **4 GB RAM**, 2 vCPU, 40 GB disk.
Udbydere: Hetzner, DigitalOcean, Contabo — det vigtigste er at du får en **IP-adresse**.

## 2) Kør én kommando på serveren

Log ind via udbyderens “Console” / SSH, og indsæt hele linjen:

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/omnichannel-swarm-gateway-2c11/omnichannel-swarm/scripts/bootstrap-vps.sh | sudo bash
```

Scriptet installerer Docker, henter koden og starter systemet i demo-tilstand.

## 3) Åbn i browser

Når scriptet er færdigt, står der en IP. Åbn:

| Hvad | Adresse |
|------|---------|
| Traefik kontrolpanel | `http://DIN-IP:8080/dashboard/` |
| CRM (Erxes UI) | `http://DIN-IP:3001/` |
| Engage (Dittofeed) | `http://DIN-IP:3002/` |

## 4) Når dine domæner peger på serveren

Peg DNS for `crm.praxios.dk`, `voice.praxios.dk`, `engage.praxios.dk` til serverens IP. Så:

```bash
cd /opt/PraxisOS/omnichannel-swarm
DEPLOY_MODE=prod sudo bash scripts/bootstrap-vps.sh
```

## Vigtigt

Denne Cursor-cloud er **midlertidig** — den er ikke din rigtige server.
Klinik-appen (bookinger, SMS, MitID, MobilePay) ligger i PR #5 og er et andet system end denne omnichannel-stak.

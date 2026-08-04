# Omnichannel Swarm

Self-hosted omnichannel matrix for **Praxios**, **Cirkel**, and **DPN nails**.

| Layer | Tool | Path | Hosts |
|---|---|---|---|
| Gateway / TLS | Traefik | `./` | `traefik.praxios.dk` |
| CRM / Inbox | Erxes | `erxes/` | `crm.{praxios,cirkel,dpnnails}.dk` |
| Voice / WebRTC | Fonoster | `fonoster/` | `voice.{praxios,cirkel,dpnnails}.dk` |
| Marketing | Dittofeed | `dittofeed/` | `engage.{praxios,cirkel,dpnnails}.dk` |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for data-flows. Cursor rules: [`.cursorrules`](./.cursorrules).

**Ikke-programmør?** Læs [START-HER.md](./START-HER.md) — én kommando på en Ubuntu VPS.

## Demo (ingen DNS endnu)

```bash
cd omnichannel-swarm
make init
make deploy-demo
# Traefik http://SERVER:8888/dashboard/
# CRM     http://SERVER:3001/
# Engage  http://SERVER:3002/
```

Eller på en frisk VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/omnichannel-swarm-gateway-2c11/omnichannel-swarm/scripts/bootstrap-vps.sh | sudo bash
```

## Production deploy

```bash
cd omnichannel-swarm
make init
# REQUIRED edits:
#   .env                 → ACME_EMAIL, TRAEFIK_BASIC_AUTH
#   erxes/.env           → DB/JWT secrets
#   fonoster/.env        → HOST_PUBLIC_IP + rotate changeme.*
#   dittofeed/.env       → PASSWORD, SECRET_KEY (32+ bytes), DB passwords
make deploy-all
make doctor
```

DNS: point all hosts above (A/AAAA) to this node before Let's Encrypt can issue certs.  
Traefik image is pinned to **v3.6.13+** (required for Docker Engine 29).

## Makefile remote

| Target | Action |
|---|---|
| `make init` | `omni_net` + env skeletons + Fonoster keys |
| `make deploy-demo` | HTTP demo (no SSL) — first run |
| `make start-gateway` | Traefik up |
| `make deploy-erxes` | CRM stack |
| `make deploy-fonoster` | Voice stack |
| `make deploy-dittofeed` | Marketing stack |
| `make deploy-all` | Everything (prod TLS) |
| `make stop-all` | Tear down all stacks |
| `make doctor` | Sanity check |

## Zero-cost communications

Default path: **WebRTC / web-push / in-app / email** over data.  
Telecom/PSTN (Twilio etc.) is opt-in fallback only — leave those env vars empty.

# Omnichannel Swarm

Self-hosted omnichannel matrix for **Praxios**, **Cirkel**, and **DPN nails**.

| Layer | Tool | Path | Hosts |
|---|---|---|---|
| Gateway / TLS | Traefik | `./` | `traefik.praxios.dk` |
| CRM / Inbox | Erxes | `erxes/` | `crm.{praxios,cirkel,dpnnails}.dk` |
| Voice / WebRTC | Fonoster | `fonoster/` | `voice.{praxios,cirkel,dpnnails}.dk` |
| Marketing | Dittofeed | `dittofeed/` | `engage.{praxios,cirkel,dpnnails}.dk` |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for data-flows. Cursor rules: [`.cursorrules`](./.cursorrules).

## Complete deploy

```bash
cd omnichannel-swarm
make init
# REQUIRED edits:
#   .env                 → ACME_EMAIL, TRAEFIK_BASIC_AUTH
#   erxes/.env           → DB/JWT secrets
#   fonoster/.env        → HOST_PUBLIC_IP + rotate changeme.*
#   dittofeed/.env       → PASSWORD, SECRET_KEY, DB passwords
make deploy-all
make doctor
```

DNS: point all hosts above (A/AAAA) to this node before Let's Encrypt can issue certs.

## Makefile remote

| Target | Action |
|---|---|
| `make init` | `omni_net` + env skeletons + Fonoster keys |
| `make start-gateway` | Traefik up |
| `make deploy-erxes` | CRM stack |
| `make deploy-fonoster` | Voice stack |
| `make deploy-dittofeed` | Marketing stack |
| `make deploy-all` | Everything |
| `make stop-all` | Tear down all stacks |
| `make doctor` | Sanity check |

## Zero-cost communications

Default path: **WebRTC / web-push / in-app / email** over data.  
Telecom/PSTN (Twilio etc.) is opt-in fallback only — leave those env vars empty.

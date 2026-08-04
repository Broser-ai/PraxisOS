# Erxes Deployment Architecture & Rules

## 1. System Overview
Erxes (XOS) is the open-source omnichannel CRM and inbox. In this swarm it is the shared customer engagement surface for Praxios, Cirkel, and DPN nails (chat, email, social, tickets).

## 2. Infrastructure Requirements
Erxes `docker-compose.yml` MUST include:
- **MongoDB**: Primary document store for conversations, customers, and plugins.
- **PostgreSQL**: Relational data / plugin schemas as required by the Erxes release.
- **Redis**: Queues, pub/sub, and session/cache.

## 3. Networking & Traefik
- HTTP(S) UI/API go through Traefik on `omni_net`.
- Host rules (examples): `crm.praxios.dk`, `crm.cirkel.dk`, `crm.dpnnails.dk`.
- TLS via Let's Encrypt (required for secure cookies and inbox widgets).

## 4. Multi-Tenancy
- Prefer one Erxes deployment with brand separation via organizations/teams or dedicated brand hosts.
- Never hardcode credentials; use `erxes/.env` only.
- All services attach to external Docker network `omni_net`.

## 5. Zero-Cost Comms
- Prefer in-app / web-widget / email over PSTN SMS.
- Voice handoff goes to Fonoster (WebRTC); marketing journeys go to Dittofeed.

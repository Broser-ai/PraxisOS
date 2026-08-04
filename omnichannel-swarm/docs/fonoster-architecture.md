# Fonoster Deployment Architecture & Rules

## 1. System Overview
Fonoster is the open-source Twilio alternative. For this swarm, it handles 100% data-driven WebRTC voice calls and SIP routing to avoid PSTN costs.

## 2. Infrastructure Requirements
Fonoster requires the following backend services in its `docker-compose.yml`:
- **PostgreSQL**: Stores accounts, projects, and SIP credentials.
- **Redis**: Caching and quick SIP-routing lookups.
- **Routr**: The core SIP proxy (must be integrated or spun up alongside).

## 3. Port & Networking Rules (CRITICAL)
Unlike standard web apps, WebRTC and SIP require specific ports that Traefik cannot easily proxy via standard HTTP/HTTPS:
- **SIP Ports**: 5060 (TCP/UDP) must be exposed.
- **WebRTC RTP Media Ports**: A wide range (e.g., 10000-20000 UDP) must be exposed directly on the host to allow audio data to flow.
- API and Web endpoints (e.g., port 3000) go through Traefik (Host: `api.voice.praxios.dk`).

## 4. Multi-Tenancy
- Operated via "Projects" inside the single Fonoster instance.
- Praxios, Cirkel, and DPN nails get their own API keys and separate SIP domains (e.g., `sip.praxios.dk`).

# Dittofeed Deployment Architecture & Rules

## 1. System Overview
Dittofeed is an open-source omni-channel marketing automation platform. We use it to trigger Web-Push, In-App messages, and Emails (bypassing paid SMS).

## 2. Infrastructure Requirements
Dittofeed is a heavy-duty event processor. The `docker-compose.yml` MUST include:
- **PostgreSQL**: Stores user journeys, templates, and segment metadata.
- **ClickHouse**: Handles the massive ingestion of user events and analytics.
- **Temporal**: Workflow engine managing the state of customer journeys (requires its own DB schema).
- **Redis**: For caching and queue management.

## 3. Core Microservices
- `lite-api` or `dashboard`: The UI and API endpoints.
- `worker`: The Temporal workers executing the messaging tasks.

## 4. Multi-Tenancy & Traefik
- Workspaces: Use Dittofeed's native Workspace feature to separate Praxios, Cirkel, and DPN nails.
- Traefik routing: The dashboard and API must be routed via Traefik (e.g., `marketing.praxios.dk`), enforcing HTTPS for Web-Push to work (browsers block HTTP web-push).

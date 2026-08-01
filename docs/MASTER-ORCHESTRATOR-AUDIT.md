# Master Orchestrator · Analyse & forbedringer (2026-07-31)

## Diagnose · iteration 2

| Område | Før | Efter |
|---|---|---|
| Staff UI tenant | Hardcoded `bypilar` + fake `sk_test_ui` | `/api/auth/me` → session-tenant på bookings/klienter/swarm |
| API Bearer | Prefix-check (`sk_test_*`) | `verifyApiKey` · tenant + scope + revoke/mask |
| Tenant isolation | Session header ignored for mismatch | `authorizeTenantRequest` · mismatch → 403 (support undtaget) |
| Swarm durability | Kun `.swarm-data/` fil / process | + Supabase `swarm_snapshots` (migration 0004) |
| SSE cross-instance | Kun process EventEmitter | Remote hydrate poll hvert 20s i stream |
| Frej MDR | `class_iia` + `active` (inkonsistent) | `class_0` + `active`; MDR-tier er authoritative i gate |
| MCP auth | Enhver Bearer | Verificeret API-key mod tenant |

## Fuld zip-gennemgang

Se **[`docs/FULL-ZIP-AUDIT-2026-08-01.md`](./FULL-ZIP-AUDIT-2026-08-01.md)** — komplet REAL/STUB-kort, mangelliste, migration-rename, light-years port-plan.

## Stadig næste lag

1. Anvend migration 0004 i prod Supabase (`swarm_snapshots`)
2. Seed password hashes i Supabase `users` så DB-login virker (ikke kun memory)
3. Supabase Realtime channel i stedet for 20s poll (når snapshot-tabellen er live)
4. API-keys i DB (`api_keys.hashed_secret`) i stedet for seed-memory
5. Selective Lag B port fra zip/savage-sweep (scanner guardrails, FHIR mappers, learning claims)
6. MitID / Stripe / NemSMS / MedCom

## Kør

```bash
npm test
npm run awaken          # lokal 24/7
# UI: /admin/swarm  ·  /bookings  ·  /klienter
```

## Sikkerhedslås

- `NO_AUTO_MERGE` / `NO_AUTO_DEPLOY` uændret
- Approve kræver `SWARM_APPROVE_TOKEN` / `I-APPROVE-MERGE`
- `listApiKeys()` maskerer secrets før UI

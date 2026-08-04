# Agent Export · LATEST

## 0. Meta

| Field | Value |
|---|---|
| Direction | Cursor Cloud → human |
| Author agent | Cursor Cloud `bc-ec386d26-3f78-44d2-8785-64c5664b2c11` |
| UTC timestamp | 2026-08-04T17:03:00Z |
| Branch | `cursor/clinic-core-takeover-2c11` |

## 1. Mission

På plads først: SMS/NemSMS outbox, MitID OIDC scaffold, MobilePay payment intents — mock default, live-ready når keys findes. Ingen falske “sendt i prod”-claims.

## 3. Ændringskort

| Area | Paths | Status |
|---|---|---|
| SMS outbox | `lib/messaging/*`, cron drain, booking enqueue, admin NemSMS | done |
| MitID | `lib/mitid/oidc.ts`, `/api/auth/mitid/start|callback`, login wiring | done |
| MobilePay | `lib/payments/intents.ts`, intents API, PaymentStep | done |
| Schema | `supabase/migrations/0005_integrations.sql` | done |
| Tests | `tests/integrations.test.ts` (53 total) | done |

## 9. DONE / BLOCKED / NEXT

### DONE
- Outbox + mock deliver + booking confirm enqueue
- MitID mock OIDC + session cookie for staff
- Payment intent create/complete (mock MobilePay)
- Env knobs: `MESSAGING_MODE`, `MITID_MODE`, `PAYMENTS_MODE`

### BLOCKED (needs Michael / contracts)
- KOMBIT NemSMS keys → `MESSAGING_MODE=live`
- Signaturgruppen MitID client → `MITID_MODE=live`
- Vipps MobilePay merchant → `PAYMENTS_MODE=live`

### NEXT
1. Persist outbox/intents to Supabase when keys present
2. CPR↔account linking for MitID staff
3. Webhook endpoint for real MobilePay callbacks

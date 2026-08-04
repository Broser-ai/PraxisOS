# Agent Export · LATEST

## 0. Meta

| Field | Value |
|---|---|
| Direction | Cursor Cloud → (human / next agent) |
| Author agent | Cursor Cloud `bc-ec386d26-3f78-44d2-8785-64c5664b2c11` |
| Author human | Michael Ambrosius |
| UTC timestamp | 2026-08-04T15:11:00Z |
| Repo | https://github.com/Broser-ai/PraxisOS |

---

## 1. Mission

**Goal:** Overtage efter Claude Code (ingen reel clinic-kode leveret) — programmér clinic-core der er klar nu.

**Out of scope:** MitID, NemSMS send, Stripe, scanner/MDR, auto-merge.

**Prompt:**

```
Hvad er vi klar til at programmere? Jeg har fået lavet en rystende analyse at claude ikke har lavet noget som helst. så du skal overtage det hele
```

---

## 2. Git truth

| Field | Value |
|---|---|
| Base | `origin/cursor/swarm-savage-execution-2c11` |
| Work branch | `cursor/clinic-core-takeover-2c11` |
| Tests | 47/47 pass |

---

## 3. Ændringskort

| Path | Intent | Status |
|---|---|---|
| `lib/calendar.ts` | Konflikt + availability | done |
| `lib/data/repo.ts` | slot_conflict, getById, signup password | done |
| availability + bookings API | conflict-aware | done |
| klienter/bookings UI | Ny klient / Manuel booking | done |
| detail pages | repo + session tenant | done |
| signup | valgt password (min 8) | done |
| `tests/calendar.test.ts` | unit | done |

---

## 9. DONE / BLOCKED / NEXT

### DONE
- Takeover branch fra swarm (ikke den tomme gennemgang-branch)
- Booking-konflikter + staff create UI + detail fra repo + signup password

### BLOCKED
- Prod migration `0004` confirm
- Real MitID / NemSMS / payments

### NEXT
1. Message outbox (uden ekstern SMS)
2. Persist hashed API keys
3. Voucher redemption
4. Merge clinic-core når smoke OK

---

## 10. Acceptkriterier

- [x] Staff kan oprette klient via UI
- [x] Staff kan oprette manuel booking via UI
- [x] Dobbeltbooking afvises (409)
- [x] Availability skjuler optagne slots
- [x] Detail-sider læser fra repo (session-tenant)
- [x] Signup kræver eget password
- [x] Tests grønne

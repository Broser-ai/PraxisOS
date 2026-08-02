# Agent Export · 2026-08-02 · cursor-swarm-baseline

> Fyldt eksempel fra **Cursor Cloud** (ikke Claude Code).  
> Viser den dybde Claude Code skal matche ved næste handoff.  
> Live pegepind: kopiér også til `LATEST.md` når dette er aktiv handoff.

---

## 0. Meta

| Field | Value |
|---|---|
| Direction | Cursor Cloud → Claude Code |
| Author agent | Cursor Cloud `bc-ec386d26-3f78-44d2-8785-64c5664b2c11` |
| Author human | Michael Ambrosius |
| UTC timestamp | 2026-08-02T04:45:00Z |
| Related chat / session id | Cursor agent URL https://cursor.com/agents/bc-ec386d26-3f78-44d2-8785-64c5664b2c11 — **ikke** Claude Code session |
| Repo | https://github.com/Broser-ai/PraxisOS |

---

## 1. Mission

**Goal:** Etablere full-export protokol så Claude Code ↔ Cursor kan skifte med **hele** arbejdskonteksten (ikke kun setup-prompt).

**Out of scope:** Merge til `main`, prod deploy, Alphaxiv key setup, migration apply i prod.

**Prompt that started this work:**

```
Lad os prøve
(forudgående: handoff skal have ALT — prompt alene er ikke nok)
```

---

## 2. Git truth

| Field | Value |
|---|---|
| Remote | origin |
| Base branch | main |
| Work branch | `cursor/swarm-savage-execution-2c11` |
| HEAD SHA | `0580b17c4346fddadf2c2b5ef38c66134fa1633f` (før denne export-commit) |
| PR URL | https://github.com/Broser-ai/PraxisOS/pull/3 |
| Dirty working tree? | no (ved start af export-arbejde) |

```text
# Recent commits on branch (main..HEAD), truncated:
0580b17 docs: audit praxis-agent/AI-Team zip
dd5dba8 feat: extreme Alphaxiv chat audit + interactive deep-research connector
24d2eee feat: Alphaxiv deep-research connector + full chat audit
d68dd4c docs: full zip audit
… working core + S-H swarm …
```

```text
# git diff --stat main...HEAD (summary): 101 files, +21039 / -1465
# Key areas: lib/swarm/*, lib/alphaxiv/*, lib/data/repo.ts, middleware.ts,
# auth (session-token, password, request-auth), admin UI, migrations 0002–0004, tests
```

---

## 3. Ændringskort

| Path | Intent | Status |
|---|---|---|
| `docs/CLAUDE-CODE-EXPORT.md` | Protokol + reject-regler | done (denne runde) |
| `docs/exports/TEMPLATE.md` | Blank skabelon | done |
| `docs/exports/LATEST.md` | Aktiv handoff-pegepind | done |
| `scripts/claude-code-export.sh` | Auto git-sandhed | done |
| `lib/swarm/*` | S-H swarm, daemon, worktrees | done (tidligere) |
| `lib/alphaxiv/*` | Research connector | done (tidligere) |
| `lib/data/repo.ts` + auth stack | Working clinic core | done (tidligere) |
| `supabase/migrations/0004_swarm_state.sql` | Swarm snapshots | done kode; **ikke** verified applied i prod |

---

## 4. Session-spor

### Tried
- Fuldt zip-ingest + audits; Alphaxiv chat deep audit; swarm + research UI
- Afklaring: Cursor kan **ikke** styre Claude Code live-session — kun git/artefakter

### Failed
- `PraxisOS-AI-Team.zip` fandtes ikke i cloud env; nærmeste upload `praxis-agent_f39f.zip` auditeret i stedet

### Assumptions
- Claude Code og Cursor deler samme GitHub remote `Broser-ai/PraxisOS`
- PR #3 er det aktive samarbejdsspor indtil andet aftales
- Human (Michael) er gate for merge/deploy

### Skipped on purpose
- Wholesale merge af praxis-agent (Clerk-konflikt)
- Auto-merge / auto-deploy fra swarm

### Read but not modified
- `HANDOVER.md`, `docs/harness/*`, Alphaxiv chat ingest under `docs/ingest/`

---

## 5. Kommandoer

| Command | Exit | Notes |
|---|---|---|
| `npm test` | 0 | 44/44 passed (2026-08-02) |
| `git diff main...HEAD --stat` | 0 | 101 files |
| `gh pr view 3` | 0 | OPEN |

---

## 6. Miljø

| Name | Used? | Notes |
|---|---|---|
| `SUPABASE_URL` / service role | prod path | values not in export |
| `SESSION_SECRET` | required for signed cookies | |
| `ALPHAXIV_API_KEY` | optional Assistant | may be unset |
| `CRON_SECRET` | swarm tick | |

Migrations in **prod**: unknown from this agent — treat `0004_swarm_state` as **needs human confirm**.

---

## 7. Verifikation

| Check | Result | Evidence |
|---|---|---|
| `npm test` | PASS 44 | local vitest |
| `npm run build` | not run this turn | N/A |
| Smoke / manual | not run this turn | |
| CI on PR | unknown / check PR checks | |

**Not run:** full E2E against prod Supabase (no service role in this note).

---

## 8. Constraints

**Do not touch without explicit ask:**
- Prod secrets / Vercel env values
- Live patient data
- Force-push `main`

**Safety gates:**
- NO_AUTO_MERGE
- NO_AUTO_DEPLOY
- Human approve for prod

**Tenant / data rules:**
- Tenant isolation invariants remain (`tests/agent-orchestration/inv-1-tenant-isolation.test.ts`)

---

## 9. DONE / BLOCKED / NEXT

### DONE
- Working core auth + durable bookings/clients path
- S-H swarm (human-gated) + Alphaxiv connector + audits
- **Full export protocol + template + generator script**

### BLOCKED
- Prod confirm `0004_swarm_state` applied — needs Michael / Supabase
- Real `PraxisOS-AI-Team.zip` if distinct from praxis-agent — needs upload

### NEXT (ordered)
1. Claude Code: tag næste opgave, kør `npm run agent:export`, udfyld §3–§11, push
2. Cursor: læs `docs/exports/LATEST.md`, review diff, forbedre
3. Human: beslut merge PR #3 / migration / Alphaxiv key

---

## 10. Acceptkriterier

- [x] Protokol fil findes og beskriver reject-regler
- [x] TEMPLATE + LATEST + baseline eksempel
- [x] Script genererer git-sandhed
- [ ] Claude Code har brugt formatet mindst én gang (pending trial)
- [ ] Cursor har review’et en Claude Code export uden at gætte (pending trial)

---

## 11. Attachments

| Kind | Path or URL |
|---|---|
| Protocol | `docs/CLAUDE-CODE-EXPORT.md` |
| PR | https://github.com/Broser-ai/PraxisOS/pull/3 |
| Cursor run | https://cursor.com/agents/bc-ec386d26-3f78-44d2-8785-64c5664b2c11 |

# Agent Export · TEMPLATE

> Copy to `docs/exports/LATEST.md` and `docs/exports/YYYY-MM-DD-<slug>.md`.  
> Mark `N/A` only with a reason. Empty sections = REJECTED handoff.

---

## 0. Meta

| Field | Value |
|---|---|
| Direction | Claude Code → Cursor Cloud / Cursor Cloud → Claude Code |
| Author agent | |
| Author human | Michael Ambrosius |
| UTC timestamp | |
| Related chat / session id (if any) | |
| Repo | https://github.com/Broser-ai/PraxisOS |

---

## 1. Mission

**Goal:**

**Out of scope:**

**Prompt that started this work** (paste verbatim):

```
```

---

## 2. Git truth

| Field | Value |
|---|---|
| Remote | origin |
| Base branch | main |
| Work branch | |
| HEAD SHA | |
| PR URL | |
| Dirty working tree? | yes / no |

```bash
# paste: git log --oneline base..HEAD
```

```text
# paste: git diff --stat base...HEAD
```

---

## 3. Ændringskort

| Path | Intent | Status (done/wip/dead) |
|---|---|---|
| | | |

---

## 4. Session-spor

### Tried
-

### Failed (error + what you did next)
-

### Assumptions (must be true for this work to be valid)
-

### Skipped on purpose
-

### Read but not modified (decision context)
-

---

## 5. Kommandoer

| Command | Exit | Notes / key output |
|---|---|---|
| | | |

---

## 6. Miljø

| Name | Used? | Notes |
|---|---|---|
| `SUPABASE_URL` | | |
| `SUPABASE_SERVICE_ROLE_KEY` | | never paste value |
| `SESSION_SECRET` | | |
| `ALPHAXIV_API_KEY` | | |
| `CRON_SECRET` | | |
| Other | | |

Migrations applied in target env:

- [ ] `0001_…`
- [ ] `0002_…`
- [ ] `0003_…`
- [ ] `0004_…`
- [ ] N/A — reason:

---

## 7. Verifikation

| Check | Result | Evidence |
|---|---|---|
| `npm test` | | |
| `npm run build` | | |
| Smoke / manual | | |
| CI on PR | | |

**Not run (and why):**

---

## 8. Constraints

**Do not touch:**

-

**Safety gates still in force:**

- NO_AUTO_MERGE
- NO_AUTO_DEPLOY
- Human approve for prod

**Tenant / data rules:**

-

---

## 9. DONE / BLOCKED / NEXT

### DONE
-

### BLOCKED
- Item — blocker — owner

### NEXT (ordered)
1.

---

## 10. Acceptkriterier

- [ ]
- [ ]

---

## 11. Attachments

| Kind | Path or URL |
|---|---|
| Transcript / log | |
| Screenshot | |
| Other | |

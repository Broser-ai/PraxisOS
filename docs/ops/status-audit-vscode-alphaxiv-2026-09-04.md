# Status + audit — VS Code / Cursor agents → Alphaxiv

**Dato:** 2026-09-04 (UTC)  
**Live evidence window:** 2026-09-04T13:51:08Z → 13:52:35Z  
**Auditeret af:** Cursor cloud agent (`bc-a567e1be-e4bf-5ee4-b878-e86aeeb4a8bf`)  
**Repo:** `Broser-ai/PraxisOS`  
**`main` tip ved audit:** `623b0f956cab3fbbb9f6e6cef3b71adce275203e` — `docs(ops): align triage tip SHA to main HEAD`  
**Branch for denne regen:** `cursor/status-audit-regen-a8bf`  
**Index:** [`docs/ops/STATUS-AUDIT-LATEST.md`](./STATUS-AUDIT-LATEST.md)  
**Søskende (Alphaxiv dybde):** [`docs/ops/alphaxiv-status-audit-2026-09-04.md`](./alphaxiv-status-audit-2026-09-04.md)

---

## 1. Executive summary (løst / ikke løst)

| Spørgsmål | Dom | Evidens (fresh curl) |
|-----------|-----|----------------------|
| Har VS Code / Cursor-agenter *leveret* Planway→PraxisOS cutover i repo? | **Delvist / ja i draft-PRs** | Åbne draft PRs **#37–#44** (+ status-docs **#45/#46**). **Ikke merged til `main`.** |
| Er live Planway **customer booking** SOLVED? | **Ja — SOLVED** | Theme `1.3.0-planway-total-kill`; **0** `planway.com` på `/`, `/booking/`, `/behandlinger/`, `/udekoerende/`; iframe → HTTPS PraxisOS |
| Er substring `planway` helt væk fra live HTML? | **Nej — kun asset-version** | `?ver=1.3.0-planway-total-kill` på `style.css` / `main.js` (2 hits/side) — **ikke** bookinglink |
| Er `http://app.bypilar` (mixed content) væk? | **Ja** | 0 hits på alle checked sider |
| Er PraxisOS-booking UI live? | **Ja (UI)** | `/t/bypilar/book` **200**; CSP `frame-ancestors` inkl. `https://bypilar.dk`; embed script **200** |
| Er prod DB / health SOLVED? | **Nej — NOT solved** | `/api/health` **503** `db_config_invalid` · `PRAXIS_DB=mock` forbidden · `backend=memory` |
| Kan agenter deploye / flappe DB nu? | **Nej** | `HETZNER_PRAXIS_SSH_PRIVATE_KEY` = **MISSING**. `HCLOUD_TOKEN` = **MISSING**. |
| Alphaxiv? | **Research-ops ready; ikke clinical KB** | Se søskende-doc; Assistant kræver nøgle |

**Én-sætnings-dom:** Live WP-booking er PraxisOS-only (Planway.com væk) — **SOLVED** for kundebooking-fladen. Produktion er **ikke** færdig: health er rød på mock-DB, cutover-PRs er drafts, SSH mangler.

**Broser (Michael) — «har VS Code løst alt?»:**  
Nej. Planway-booking-cutover på live WP er løst. **Alt andet er ikke:** health 503, mock DB, overlappende draft-PRs, manglende agent-SSH.

---

## 2. Hvad VS Code / Cursor-agenter har leveret

### 2.1 Åbne Planway / byPilar / prod / audit-PRs (2026-09-04 ~13:52Z)

Alle nedenstående er **DRAFT** mod `main`, `mergeable=MERGEABLE` ifølge GitHub API.

| PR | Branch | Tip | Ahead | Files | Titel |
|----|--------|-----|------:|------:|-------|
| [#37](https://github.com/Broser-ai/PraxisOS/pull/37) | `cursor/bypilar-setup-visibility-2c11` | `6e18a29` | 1 | 12 | byPilar: surface full clinic OS without PraxisOS branding |
| [#38](https://github.com/Broser-ai/PraxisOS/pull/38) | `cursor/prod-activate-main-2c11` | `ce67277` | 1 | 4 | ops: remote activate main on Hetzner (scripts + runbook) |
| [#39](https://github.com/Broser-ai/PraxisOS/pull/39) | `cursor/prod-praxisos-booking-live-d635` | `f7a3cd4` | 1 | 13 | booking: PraxisOS-only live harden + Planway cutover docs |
| [#40](https://github.com/Broser-ai/PraxisOS/pull/40) | `cursor/planway-purge-booking-ux-2c11` | `8e91eaf` | 2 | 38 | byPilar: ALT væk fra Planway — booking ONLY via PraxisOS |
| [#41](https://github.com/Broser-ai/PraxisOS/pull/41) | `cursor/bypilar-planway-cutover-2c11` | `ecb0d0e` | 2 | 59 | byPilar WP: HTTPS PraxisOS embed + kill Planway CTAs |
| [#42](https://github.com/Broser-ai/PraxisOS/pull/42) | `cursor/planway-kill-praxisos-only-2c11` | `2b1c05d` | 8 | 43 | byPilar: kill Planway — PraxisOS booking only (theme + embed) |
| [#43](https://github.com/Broser-ai/PraxisOS/pull/43) | `cursor/planway-total-kill-live-2c11` | `6cbd5a6` | 10 | 45 | byPilar: Planway total kill — PraxisOS booking only (live-ready) |
| [#44](https://github.com/Broser-ai/PraxisOS/pull/44) | `cursor/planway-content-rewrite-2c11` | `e7ade61` | 8 | 44 | byPilar: Planway content rewrite — runtime + WP-CLI kill |
| [#45](https://github.com/Broser-ai/PraxisOS/pull/45) | `cursor/status-audit-vscode-alphaxiv-2c11` | `48e445b` | — | 1 | docs: status audit VS Code + Alphaxiv (ældre draft; **superseded by this regen**) |
| [#46](https://github.com/Broser-ai/PraxisOS/pull/46) | `cursor/alphaxiv-status-audit-2c11` | `4b0a5e4` | — | 1 | docs: Alphaxiv research status audit (ældre draft; **superseded by this regen**) |

### 2.2 Leverancer pr. PR (kort)

| PR | Indhold (væsentligt) |
|----|----------------------|
| **#37** | White-label klinik-login/setup, HTTPS embed-instruktioner, skjult PraxisOS-badge for bypilar, tests + `docs/ops/bypilar-where-is-praxisos.md` |
| **#38** | `scripts/remote-activate-main.sh`, `console-selfhost-db-cutover.sh`, prod-activate runbook — **kan ikke køres uden SSH** |
| **#39** | Traefik-safe `publicOrigin`, health/DB fail-fast hardening, WP service-ID alignment (`fod-std`/`fod-ext`/`fod-lux`/`mani`), smoke/cutover docs + tests |
| **#40** | Planway-purge i theme/embed/`lib/booking-urls.ts`, MU-plugin bridge, tests (stor overlap med #41–#44) |
| **#41** | WP theme cutover-pakke + `scripts/push-bypilar-theme-live.sh` |
| **#42** | Konsolideret kill + `hetzner-console-planway-kill.sh` |
| **#43** | Samme kill-stack + compose/TLS/gitignore-fixes (anbefalet «live-ready» kill-stack sammen med #42) |
| **#44** | Content-layer rewrite MU-plugin + `wp-cli-kill-planway.sh` + fixtures/tests (dækker legacy DB-HTML) |

### 2.3 Overlap (vigtigt for merge)

Fil-overlap mellem WP-tunge PRs er **meget højt**:

- `#40 ∩ #42/#43` ≈ 38 filer  
- `#42 ∩ #43` ≈ 43 filer  
- `#43 ∩ #44` ≈ 40 filer  

**Konklusion:** #40–#44 er parallelle generationer af samme cutover — **ikke** 5 uafhængige merges. Vælg én WP-vinder + additive unikke commits.

`#44` unikke filer (vs #43):  
`wordpress/mu-plugins/bypilar-planway-content-rewrite.php`, `scripts/wp-cli-kill-planway.sh`, `tests/planway-content-rewrite.test.ts`, `tests/fixtures/planway-udekoerende-legacy.html`.

### 2.4 Allerede på `main` (relevant kontekst)

Fra triage (`docs/ops/open-pr-triage-2026-09-04.md`): P0-slices / PEC / foundation er landet. Health fail-fast for `PRAXIS_DB=mock` i production findes **allerede på `main`** (`app/api/health/route.ts` + `lib/supabase.ts` `assertProductionDbConfig`) — og er **synligt live** (503).

**Ikke på `main`:** `scripts/push-bypilar-theme-live.sh`, `scripts/hetzner-console-planway-kill.sh`, WP kill-tema-ændringerne i PR-stacken.

---

## 3. Live verification evidence (FRESH)

**Tidspunkt:** 2026-09-04T13:51:08Z → 13:52:35Z  
**Metode:** `curl -sS -L` / `-I` / `-i` fra cloud-agent (ingen SSH).

### 3.1 bypilar.dk — Planway / app.bypilar markører

| Side | HTTP | `planway.com` | `planway` substr | `http://app` | `https://app.bypilar` | Fortolkning |
|------|-----:|--------------:|-----------------:|-------------:|----------------------:|-------------|
| `/` | 200 | **0** | 2 | **0** | ≥1 (embed+login) | Kun `ver=1.3.0-planway-total-kill` |
| `/booking/` | 200 | **0** | 2 | **0** | iframe + login + embed | HTTPS book |
| `/behandlinger/` | 200 | **0** | 2 | **0** | 2 | CTA → booking |
| `/udekoerende/` | 200 | **0** | 2 | **0** | 2 | CTA → booking |
| `/om-os/` | 200 | **0** | 2 | **0** | 2 | — |
| `/book/` | 200 | **0** | — | **0** | — | OK |
| `/bestil/`, `/kontakt/`, `/priser/` | 404 | 0 | — | 0 | — | Findes ikke |

**Theme / booking-bevis (`/` + `/booking/`):**

```text
# asset version (NOT a Planway booking URL)
style.css?ver=1.3.0-planway-total-kill
main.js?ver=1.3.0-planway-total-kill

# HTTPS PraxisOS
https://app.bypilar.dk/t/bypilar/book?embed=1   (iframe on /booking/)
https://app.bypilar.dk/embed/v1/bypilar?ver=1.3.0
https://app.bypilar.dk/login
data-praxis-book  (CTA)
```

**Verdict Planway customer booking:** **SOLVED** — 0 `planway.com`, theme kill-string live, PraxisOS HTTPS embed.

### 3.2 app.bypilar.dk — health + config + book headers

#### `GET /api/health` — 2026-09-04T13:51:13Z / recheck 13:52:35Z

```http
HTTP/2 503
content-type: application/json

{"ok":false,"error":"db_config_invalid","reason":"PRAXIS_DB=mock is forbidden in production (NODE_ENV=production). Set PRAXIS_DB=supabase-eu or supabase-local and configure SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.","dbMode":"mock","backend":"memory","region":"lokal","time":"2026-09-04T13:52:35.592Z"}
```

**Prod DB:** **NOT solved.**

#### `GET /api/scan/config` — 13:51:13Z

```http
HTTP/2 200
content-type: application/json

{"ok":true,"liveReady":true,"llmReady":true,"blockers":[],"notes":[],"providers":{"replicate":true,"roboflow":true,"openai":true},...}
```

#### `HEAD /t/bypilar/book` — 13:51:14Z

```http
HTTP/2 200
content-security-policy: frame-ancestors 'self' https://bypilar.dk https://www.bypilar.dk https://app.bypilar.dk http://localhost:* http://127.0.0.1:*
content-type: text/html; charset=utf-8
x-powered-by: Next.js
```

#### `HEAD /t/bypilar/book?embed=1` + `HEAD /embed/v1/bypilar` — 13:51:49–50Z

| Endpoint | HTTP | Content-Type | CSP frame-ancestors |
|----------|-----:|--------------|---------------------|
| `/t/bypilar/book?embed=1` | 200 | `text/html` | inkl. `https://bypilar.dk` |
| `/embed/v1/bypilar` | 200 | `application/javascript` | inkl. `https://bypilar.dk` |

### 3.3 Booking API probes (JSON vs HTML)

| Endpoint | HTTP | Body type | Note |
|----------|-----:|-----------|------|
| `GET /api/v1/bypilar/services` | **200** | **JSON** | Mock catalog: `gel-mani`, `nail-art`, `fod-med`, `fod-lux`, `fod-scan` |
| `GET /api/v1/bypilar/availability?serviceId=fod-std&date=2026-09-07` | **200** | **JSON** | Returns slots but **falls back service → `gel-mani`** (fod-std missing in live mock) |
| `GET /api/booking` | 404 | **HTML** (Next not-found) | Not a JSON API |
| `GET /api/bookings` | 404 | **HTML** | — |
| `GET /api/book` | 404 | **HTML** | — |
| `GET /api/v1/booking` | 404 | **HTML** | — |
| `GET /api/public/booking` | 404 | **HTML** | — |
| `GET /api/t/bypilar/booking` | 404 | **HTML** | — |
| `GET /api/slots` | 404 | **HTML** | — |
| `GET /api/availability` | 404 | **HTML** | — |

**Raw services snippet (13:51:48Z):**

```json
{"tenant":{"slug":"bypilar","name":"by Pilar","currency":"DKK",...},
 "services":[{"id":"gel-mani",...},{"id":"nail-art",...},{"id":"fod-med",...},{"id":"fod-lux",...},{"id":"fod-scan",...}]}
```

**Raw availability fallback (asked `fod-std`, got `gel-mani`):**

```json
{"service":{"id":"gel-mani","name":"Gel manicure","durationMin":45},"timezone":"Europe/Copenhagen","slots":[...]}
```

### 3.4 Secrets / deploy-forsøg fra denne agent

| Secret / script | Status |
|-----------------|--------|
| `HETZNER_PRAXIS_SSH_PRIVATE_KEY` | **MISSING** |
| `HCLOUD_TOKEN` | **MISSING** |
| `ALPHAXIV_API_KEY` | **MISSING** |
| `scripts/push-bypilar-theme-live.sh` (på `main`) | **findes ikke** (kun på PR-branches) |
| `scripts/hetzner-console-planway-kill.sh` (på `main`) | **findes ikke** |
| Kørt live push/kill/DB-flip fra denne agent? | **Nej** — blokeret |

---

## 4. Remaining blockers

1. **Prod DB stadig `mock`/`memory`** — health 503 indtil `PRAXIS_DB=supabase-eu|supabase-local` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (eller selfhost Kong-flip). Booking JSON APIs svarer stadig 200 på memory — **ikke** produktionsklar persistens.
2. **SSH / Hetzner Console-adgang til agenter** — uden nøgle kan agenter ikke re-deploye theme, WP-CLI kill, eller remote-activate `main`.
3. **Cutover-PRs #37–#44 er drafts og overlapper** — `main` mangler kill-scripts + WP-pakke.
4. **Service-ID mismatch** — live mock: `gel-mani`/`fod-med`…; PR #39 vil align’e `fod-std`/`fod-ext`/`fod-lux`/`mani`. Live availability for `fod-std` → forkert service.
5. **Versionsstreng `planway-total-kill`** — kosmetisk/forvirrende for greps; overvej rename til `praxisos-only`.
6. **Ældre åbne PRs** (#25 migrate, #11 WP stack, #8 Bird, #6 gateway, m.fl.) — infra/product; ikke dagens Planway-kill.

---

## 5. Alphaxiv handoff — checklist

### Alphaxiv skal *vide*

- Live WP booking er **PraxisOS HTTPS**, ikke Planway.com — greps på `planway` matcher stadig asset-version.
- Live app health er **bevidst rød** pga. mock-forbud i production (allerede på `main`).
- Parallel Cursor-agenter har produceret **8 overlappende draft-PRs (#37–#44)**; merge kræver menneskelig kuratering.
- Denne agent **kunne ikke** SSH’e eller flappe DB.
- Dybere Alphaxiv-connector-audit: søskende-doc (research-ops ready; Assistant needs key; not clinical KB).

### Alphaxiv / Broser bør *gøre* næste

- [ ] **Injicér** `HETZNER_PRAXIS_SSH_PRIVATE_KEY` (eller kør Hetzner Console som root).
- [ ] **Vælg WP-vinder-PR** (anbefaling: land #44-unikke ovenpå #43 *eller* squash #43+#44) + merge #39 + #38 + #37.
- [ ] Efter merge til `main`: kør Console one-liner / `push-bypilar-theme-live.sh` så tip og live theme er synkroniseret.
- [ ] **Flip DB** jf. `docs/ops/p0-db-cutover-runbook.md` — forlad mock; verificér `GET /api/health` → `ok:true`.
- [ ] Re-smoke: services IDs matcher WP; availability for rigtig service; POST booking (ikke kun GET).
- [ ] Luk/supersede duplicate drafts (#40/#41/#42 når vinder er landet).
- [ ] (Valgfrit) bump theme version væk fra ordet `planway` i `ver=`.
- [ ] Respektér kliniske invariants (se §7).

### Console one-liner (når Broser er på host — eksempel fra #44)

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/planway-content-rewrite-2c11/scripts/hetzner-console-planway-kill.sh | bash
```

(Efter merge: peg URL’en på `main`.)

---

## 6. Anbefalet merge-rækkefølge (open PRs #37–#44)

| Step | PR | Begrundelse |
|------|-----|-------------|
| 1 | **#39** | App-side harden (origin, health/docs, service-ID alignment) — lille overlap med WP-pakke |
| 2 | **#43** *eller* **#44** som WP-vinder | #43 = total-kill live-ready; #44 tilføjer content-rewrite + WP-CLI. **Foretræk:** merge #43, cherry-pick #44’s 4 unikke filer |
| 3 | **#38** | Remote activate / console DB helpers |
| 4 | **#37** | Setup/login white-label synlighed |
| — | **Close/supersede** #40, #41, #42 | Absorberet af #43/#44 |
| — | **Ikke auto-merge** #25/#11/#8/#6 | Infra; kræver SSH + menneskelig cutover-gate |

**Ikke anbefalet:** merge alle #40–#44 sekventielt — konfliktgaranti.

---

## 7. Risk / clinical invariants reminder

| Invariant | Betydning |
|-----------|-----------|
| `NO_AUTO_MERGE` | Ingen agent-automerge til `main` uden Broser |
| `NO_AUTO_DEPLOY` | Ingen autonom prod-deploy / secret-flip |
| `clinical_status = suggestion_only` | Kliniske anbefalinger er forslag, ikke ordrer |
| `NO_AUTO_JOURNAL_SIGN` | Journal signatur forbliver human-gated |
| `NO_MODEL_TRAINING` | Ingen træning på patientdata |
| `PATHOLOGY_SHADOW` | Pathology forbliver shadow / ikke auto-action |
| Class IIa features | Frozen uden CE — ikke «tænd» i prod som klinisk autonomi |

Booking cutover ≠ klinisk go-live: PraxisOS book UI på mock DB ≠ godkendt produktionspersistens.

---

## 8. Alphaxiv brief (EN)

**Verdict:** Cursor/VS Code agents delivered substantial Planway→PraxisOS cutover work as **draft PRs #37–#44** (heavily overlapping). Live `bypilar.dk` already serves theme **`1.3.0-planway-total-kill`** with **HTTPS PraxisOS** embeds and **zero** `planway.com` / `http://app.bypilar` booking links — **Planway customer booking = SOLVED**. That is **not** “everything solved”: `/api/health` is **503** (`PRAXIS_DB=mock` forbidden), booking JSON still serves **memory**, cutover scripts are **not on `main`**, and **`HETZNER_PRAXIS_SSH_PRIVATE_KEY` / `HCLOUD_TOKEN` are missing**. Alphaxiv connector is **research-ops ready** (stub + public search); **Assistant needs key**; **not** a clinical KB — see sibling audit.

**Do next:** (1) inject SSH or run Hetzner Console, (2) merge curated stack `#39 → #43(+#44 uniques) → #38 → #37`, supersede `#40–#42`, (3) flip off mock DB per cutover runbook, (4) re-smoke health + services/availability/POST with WP-aligned IDs, (5) keep clinical invariants.

**Evidence anchors (2026-09-04T13:51–13:52Z):** `main` = `623b0f9…`; theme `planway-total-kill`; health 503 mock; services 200 mock `[gel-mani, nail-art, fod-med, fod-lux, fod-scan]`; availability `fod-std` → `gel-mani`; naive `/api/booking*` paths return **HTML 404**.

---

## 9. Audit metadata

| Felt | Værdi |
|------|-------|
| Regen agent | `bc-a567e1be-e4bf-5ee4-b878-e86aeeb4a8bf` |
| `git fetch origin main` tip | `623b0f956cab3fbbb9f6e6cef3b71adce275203e` |
| Evidence window (UTC) | 2026-09-04T13:51:08Z → 13:52:35Z |
| SSH deploy forsøgt | Nej (secrets missing) |
| Live Planway booking claimed gone? | **Ja — SOLVED** (0 planway.com; kill theme live) |
| Live prod claimed healthy? | **Nej — health 503 / mock forbidden** |
| Supersedes | PR #45 / #46 earlier drafts |
| Doc path | `docs/ops/status-audit-vscode-alphaxiv-2026-09-04.md` |
| Index | `docs/ops/STATUS-AUDIT-LATEST.md` |

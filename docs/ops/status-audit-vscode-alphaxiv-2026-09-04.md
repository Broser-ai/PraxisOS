# Status + audit — VS Code / Cursor agents → Alphaxiv

**Dato:** 2026-09-04 (UTC)  
**Auditeret af:** Cursor cloud agent (`bc-2ac9c62b-7130-54bd-82c4-bc34bd6f4e32`)  
**Repo:** `Broser-ai/PraxisOS`  
**`main` tip ved audit:** `623b0f956cab3fbbb9f6e6cef3b71adce275203e` — `docs(ops): align triage tip SHA to main HEAD`  
**Branch for denne audit:** `cursor/status-audit-vscode-alphaxiv-2c11`

---

## 1. Executive summary (løst / ikke løst)

| Spørgsmål | Dom | Evidens |
|-----------|-----|---------|
| Har VS Code / Cursor-agenter *leveret* Planway→PraxisOS cutover i repo? | **Delvist / ja i draft-PRs** | Åbne draft PRs **#37–#44** med theme, embed, kill-scripts, tests, runbooks. **Ikke merged til `main`.** |
| Er live `bypilar.dk` fri for Planway-*booking*? | **Ja (funktionelt)** | Ingen `planway.com` / `planway.dk` / Planway-widget-URL. Booking iframe = `https://app.bypilar.dk/t/bypilar/book?embed=1`. CTA = `data-praxis-book`. |
| Er substring `planway` helt væk fra live HTML? | **Nej — kun asset-version** | Alle 4 sider har `ver=1.3.0-planway-total-kill` på `style.css` / `main.js`. Det er **kill-temaets versionsstreng**, ikke en Planway-bookinglink. |
| Er `http://app.bypilar` (mixed content) væk? | **Ja** | 0 hits på `/`, `/booking/`, `/behandlinger/`, `/udekoerende/`. |
| Er PraxisOS-booking live og sund? | **Delvist** | `/api/v1/bypilar/services` + `availability` → **HTTP 200** (mock/memory-katalog). `/api/health` → **HTTP 503** `dbMode=mock` forbudt i production. |
| Kan agenter deploye / flappe DB nu? | **Nej** | `HETZNER_PRAXIS_SSH_PRIVATE_KEY` = **MISSING**. `HCLOUD_TOKEN` = **MISSING**. Kill/push-scripts findes kun på PR-branches — ikke på `main`. |

**Én-sætnings-dom:** Repo-agenterne har *næsten* løst cutover-koden (overlappende draft-PRs), og live WordPress peger allerede på HTTPS PraxisOS — men produktion er **ikke** færdig: mock-DB fail-fast (health 503), cutover-PRs er ikke på `main`, og SSH/Console-adgang mangler stadig for agent-drevet deploy/DB-flip.

**Broser (Michael) — ærligt svar på «har VS Code løst alt?»:**  
Nej. VS Code/Cursor har løst **meget af repo-sporet** og live WP ser ud til at køre kill-temaet, men **alt er ikke løst**: health er rød, DB er mock, PRs er drafts, SSH-secrets mangler.

---

## 2. Hvad VS Code / Cursor-agenter har leveret

### 2.1 Åbne Planway / byPilar / prod-PRs (2026-09-04)

Alle nedenstående er **DRAFT** mod `main`, mergeable ifølge GitHub API.

| PR | Branch | Tip | Ahead | Files | Titel |
|----|--------|-----|-------|-------|-------|
| [#37](https://github.com/Broser-ai/PraxisOS/pull/37) | `cursor/bypilar-setup-visibility-2c11` | `6e18a29` | 1 | 12 | byPilar: surface full clinic OS without PraxisOS branding |
| [#38](https://github.com/Broser-ai/PraxisOS/pull/38) | `cursor/prod-activate-main-2c11` | `ce67277` | 1 | 4 | ops: remote activate main on Hetzner (scripts + runbook) |
| [#39](https://github.com/Broser-ai/PraxisOS/pull/39) | `cursor/prod-praxisos-booking-live-d635` | `f7a3cd4` | 1 | 13 | booking: PraxisOS-only live harden + Planway cutover docs |
| [#40](https://github.com/Broser-ai/PraxisOS/pull/40) | `cursor/planway-purge-booking-ux-2c11` | `8e91eaf` | 2 | 38 | byPilar: ALT væk fra Planway — booking ONLY via PraxisOS |
| [#41](https://github.com/Broser-ai/PraxisOS/pull/41) | `cursor/bypilar-planway-cutover-2c11` | `ecb0d0e` | 2 | 59 | byPilar WP: HTTPS PraxisOS embed + kill Planway CTAs |
| [#42](https://github.com/Broser-ai/PraxisOS/pull/42) | `cursor/planway-kill-praxisos-only-2c11` | `2b1c05d` | 8 | 43 | byPilar: kill Planway — PraxisOS booking only (theme + embed) |
| [#43](https://github.com/Broser-ai/PraxisOS/pull/43) | `cursor/planway-total-kill-live-2c11` | `6cbd5a6` | 10 | 45 | byPilar: Planway total kill — PraxisOS booking only (live-ready) |
| [#44](https://github.com/Broser-ai/PraxisOS/pull/44) | `cursor/planway-content-rewrite-2c11` | `e7ade61` | 8 | 44 | byPilar: Planway content rewrite — runtime + WP-CLI kill |

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

- `#40 ∩ #42/#43` = 38 filer  
- `#42 ∩ #43` = 43 filer  
- `#43 ∩ #44` = 40 filer  

**Konklusion:** #40–#44 er parallelle generationer af samme cutover — **ikke** 5 uafhængige merges. Vælg én WP-vinder + additive unikke commits.

`#44` unikke filer (vs #43):  
`wordpress/mu-plugins/bypilar-planway-content-rewrite.php`, `scripts/wp-cli-kill-planway.sh`, `tests/planway-content-rewrite.test.ts`, `tests/fixtures/planway-udekoerende-legacy.html`.

### 2.4 Allerede på `main` (relevant kontekst)

Fra tidligere triage (`docs/ops/open-pr-triage-2026-09-04.md`): P0-slices / PEC / foundation er landet. Health fail-fast for `PRAXIS_DB=mock` i production findes **allerede på `main`** (`app/api/health/route.ts` + `lib/supabase.ts` `assertProductionDbConfig`).

**Ikke på `main`:** `scripts/push-bypilar-theme-live.sh`, `scripts/hetzner-console-planway-kill.sh`, WP kill-tema-ændringerne i PR-stacken.

---

## 3. Live verification evidence

**Tidspunkt:** 2026-09-04T13:39–13:42Z  
**Metode:** `curl -sL` mod offentlige URL’er fra cloud-agent (ingen SSH).

### 3.1 bypilar.dk — Planway / app.bypilar markører

| Side | Raw `planway` count | Heraf `planway.com`/widget | `http://app.bypilar` | `https://app.bypilar` | Fortolkning |
|------|--------------------:|---------------------------:|---------------------:|----------------------:|-------------|
| `/` | 2 | **0** | **0** | 2 | Kun `ver=1.3.0-planway-total-kill` |
| `/booking/` | 2 | **0** | **0** | 4 | HTTPS book iframe + embed + login |
| `/behandlinger/` | 2 | **0** | **0** | 2 | CTA → `/booking/` + embed |
| `/udekoerende/` | 2 | **0** | **0** | 2 | CTA → `/booking/` + embed |

**Live booking-bevis (`/booking/`):**

- iframe `src="https://app.bypilar.dk/t/bypilar/book?embed=1"`
- knap `data-praxis-book` («Åbn booking»)
- staff: `https://app.bypilar.dk/login` («Kom i gang · Klinik»)
- theme assets: `pilar-theme` **`1.3.0-planway-total-kill`**
- `main.js` sætter `BOOK_ORIGIN = 'https://app.bypilar.dk'` og stripper `planway.com` / `http://app.bypilar.dk` i iframes

**Vigtigt:** Tidligere PR-bodies (#41/#42/#43) skrev «Not deployed». **Live HTML nu modsiger det for WP-fladen** — kill-temaet *ser* deployet ud. Repo-`main` har stadig ikke scriptene; deploy er sket uden for denne agents SSH (Console / manuel / anden agent).

### 3.2 app.bypilar.dk — health + booking smoke

| Endpoint | HTTP | Resultat |
|----------|-----:|----------|
| `GET /api/health` | **503** | `{"ok":false,"error":"db_config_invalid","reason":"PRAXIS_DB=mock is forbidden in production …","dbMode":"mock","backend":"memory","region":"lokal"}` |
| `GET /api/v1/bypilar/services` | **200** | Mock-katalog: `gel-mani`, `nail-art`, `fod-med`, `fod-lux`, `fod-scan` (bookUrl → `https://app.bypilar.dk/t/bypilar/book?service=…`) |
| `GET /api/v1/bypilar/availability?serviceId=fod-std&date=2026-09-07` | **200** | Returnerer slots, men **service falder tilbage til `gel-mani`** (fod-std findes ikke i live mock-katalog) |
| `GET /t/bypilar/book` | **200** | HTML booking UI |
| `GET /embed/v1/bypilar` | **200** | Embed-script |

### 3.3 Secrets / deploy-forsøg fra denne agent

| Secret / script | Status |
|-----------------|--------|
| `HETZNER_PRAXIS_SSH_PRIVATE_KEY` | **MISSING** |
| `HCLOUD_TOKEN` | **MISSING** |
| `scripts/push-bypilar-theme-live.sh` (på `main`) | **findes ikke** (kun på PR-branches) |
| `scripts/hetzner-console-planway-kill.sh` (på `main`) | **findes ikke** |
| Kørt live push/kill fra denne agent? | **Nej** — blokeret af manglende secrets + scripts ikke på tip |

---

## 4. Remaining blockers

1. **Prod DB stadig `mock`/`memory`** — health 503 indtil `PRAXIS_DB=supabase-eu|supabase-local` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (eller selfhost Kong-flip jf. cutover-runbook). Booking APIs svarer stadig 200 på memory — det er **ikke** produktionsklar persistens.
2. **SSH / Hetzner Console-adgang til agenter** — uden `HETZNER_PRAXIS_SSH_PRIVATE_KEY` (eller manuel Console one-liner) kan agenter ikke re-deploye theme, køre WP-CLI kill, eller remote-activate `main`.
3. **Cutover-PRs #37–#44 er drafts og overlapper** — `main` mangler kill-scripts + WP-pakke; risiko for konflikt hvis flere merges.
4. **Service-ID mismatch** — live mock har `gel-mani`/`fod-med`…; PR #39 vil align’e `fod-std`/`fod-ext`/`fod-lux`/`mani` til WP `data-praxis-book`. Live availability for `fod-std` falder tilbage til forkert service.
5. **Versionsstreng `planway-total-kill`** — kosmetisk/forvirrende i audits der greps på `planway`; overvej rename til `praxisos-only` i næste theme-bump.
6. **Ældre åbne PRs** (#25 migrate, #11 WP stack, #8 Bird selfhost, #6 gateway, m.fl.) — stadig infra/product; ikke del af dagens Planway-kill, men relevante for Alphaxiv-prioritering.

---

## 5. Alphaxiv handoff — checklist

### Alphaxiv skal *vide*

- Live WP booking er **PraxisOS HTTPS**, ikke Planway.com — men greps på `planway` vil stadig matche asset-version.
- Live app health er **bevidst rød** pga. mock-forbud i production (allerede på `main`).
- Parallel Cursor-agenter har produceret **8 overlappende draft-PRs**; merge kræver menneskelig kuratering.
- Denne agent **kunne ikke** SSH’e eller flappe DB.

### Alphaxiv / Broser bør *gøre* næste

- [ ] **Injicér** `HETZNER_PRAXIS_SSH_PRIVATE_KEY` (eller kør Hetzner Console som root).
- [ ] **Vælg WP-vinder-PR** (anbefaling nedenfor: land #44-unikke ovenpå #43 *eller* squash #43+#44) + merge #39 + #38 + #37 i rækkefølge.
- [ ] Efter merge til `main`: kør Console one-liner / `push-bypilar-theme-live.sh` så `main`-tip og live theme er synkroniseret.
- [ ] **Flip DB** jf. `docs/ops/p0-db-cutover-runbook.md` / `scripts/production-cutover-main.sh` — forlad mock; verificér `GET /api/health` → `ok:true`.
- [ ] Re-smoke: services IDs matcher WP (`fod-std` …); availability for den rigtige service; POST booking (ikke kun GET).
- [ ] Luk/supersede duplicate drafts (#40/#41/#42 når vinder er landet).
- [ ] (Valgfrit) bump theme version væk fra ordet `planway` i `ver=`.
- [ ] Respektér kliniske invariants (se §7) — ingen auto-merge/deploy, ingen journal-sign, pathology shadow.

### Console one-liner (når Broser er på host — eksempel fra #44)

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/planway-content-rewrite-2c11/scripts/hetzner-console-planway-kill.sh | bash
```

(Efter merge: peg URL’en på `main` i stedet for branch.)

---

## 6. Anbefalet merge-rækkefølge (open PRs #37–#44)

| Step | PR | Begrundelse |
|------|-----|-------------|
| 1 | **#39** | App-side harden (origin, health/docs, service-ID alignment) — lille, lav overlap med WP-pakke |
| 2 | **#43** *eller* **#44** som WP-vinder | #43 = total-kill live-ready stack; #44 tilføjer content-rewrite + WP-CLI. **Foretræk:** merge #43, cherry-pick #44’s 4 unikke filer — *eller* squash #44 ovenpå #43 tip |
| 3 | **#38** | Remote activate / console DB helpers (docs+scripts) |
| 4 | **#37** | Setup/login white-label synlighed (kan også før #39 hvis ønsket; overlap lille) |
| — | **Close/supersede** #40, #41, #42 | Absorberet af #43/#44 |
| — | **Ikke auto-merge** #25/#11/#8/#6 | Infra; kræver SSH + menneskelig cutover-gate |

**Ikke anbefalet:** merge alle #40–#44 sekventielt — konfliktgaranti.

---

## 7. Risk / clinical invariants reminder

Hard locks (må ikke brydes af Alphaxiv, VS Code, eller cloud-agenter):

| Invariant | Betydning |
|-----------|-----------|
| `NO_AUTO_MERGE` | Ingen agent-automerge til `main` uden Broser |
| `NO_AUTO_DEPLOY` | Ingen autonom prod-deploy / secret-flip |
| `clinical_status = suggestion_only` | Kliniske anbefalinger er forslag, ikke ordrer |
| `NO_AUTO_JOURNAL_SIGN` | Journal signatur forbliver human-gated |
| `NO_MODEL_TRAINING` | Ingen træning på patientdata |
| `PATHOLOGY_SHADOW` | Pathology forbliver shadow / ikke auto-action |
| Class IIa features | Frozen uden CE — ikke «tænd» i prod som klinisk autonomi |

Booking cutover må **ikke** forveksles med klinisk go-live: PraxisOS book UI på mock DB ≠ godkendt produktionspersistens.

---

## 8. Alphaxiv brief (EN)

**Verdict:** Cursor/VS Code agents delivered substantial Planway→PraxisOS cutover work as **draft PRs #37–#44** (heavily overlapping). Live `bypilar.dk` already serves the **`1.3.0-planway-total-kill`** theme with **HTTPS PraxisOS** embeds and **zero** `planway.com` / `http://app.bypilar` booking links. That is **not** the same as “everything solved”: `/api/health` is **503** (`PRAXIS_DB=mock` forbidden in production), booking APIs still answer from **memory**, cutover scripts are **not on `main`**, and **`HETZNER_PRAXIS_SSH_PRIVATE_KEY` / `HCLOUD_TOKEN` are missing** so this agent could not push or DB-flip.

**Do next:** (1) inject SSH or run Hetzner Console, (2) merge curated stack `#39 → #43(+#44 uniques) → #38 → #37`, supersede `#40–#42`, (3) flip off mock DB per cutover runbook, (4) re-smoke health + services/availability/POST with WP-aligned service IDs, (5) keep clinical invariants (`NO_AUTO_MERGE` / `NO_AUTO_DEPLOY` / `suggestion_only` / no journal auto-sign).

**Evidence anchors:** `main` = `623b0f9…`; live theme ver `planway-total-kill`; health 503 mock; services 200 mock catalog `[gel-mani, nail-art, fod-med, fod-lux, fod-scan]`.

---

## 9. Audit metadata

| Felt | Værdi |
|------|-------|
| `git fetch origin main` tip | `623b0f956cab3fbbb9f6e6cef3b71adce275203e` |
| SSH deploy forsøgt | Nej (secrets missing) |
| Live Planway booking claimed gone? | **Ja — curl beviser ingen planway.com; kun version substring** |
| Live prod claimed healthy? | **Nej — health 503** |
| Doc path | `docs/ops/status-audit-vscode-alphaxiv-2026-09-04.md` |

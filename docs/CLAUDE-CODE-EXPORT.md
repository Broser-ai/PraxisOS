# Claude Code ↔ Cursor Cloud · Full Export Protocol

**Regel:** En setup-prompt er **ikke** en handoff.  
Modtager-agenten (Cursor Cloud eller Claude Code) skal kunne fortsætte **uden at gætte**.

Hvis sektioner mangler → handoff er **REJECTED**. Udfyld eller markér eksplicit `N/A` + hvorfor.

---

## Hvornår

Brug ved **hver** agent-skift:

| Fra → Til | Fil der opdateres |
|---|---|
| Claude Code → Cursor | `docs/exports/LATEST.md` (overskriv) + kopi `docs/exports/YYYY-MM-DD-<slug>.md` |
| Cursor → Claude Code | samme |

Commit + push **før** den anden agent bedes tage over.

---

## Hurtig generering af git-sandhed

```bash
npm run agent:export
# eller:
bash scripts/claude-code-export.sh docs/exports/LATEST.md
```

Scriptet udfylder § Identity, § Git truth og en stub. **Du** udfylder resten (session-spor, antagelser, verify).

---

## Obligatoriske sektioner (checklist)

Kopiér skabelonen: [`docs/exports/TEMPLATE.md`](./exports/TEMPLATE.md)

- [ ] **0. Meta** — hvem, hvornår, retning (CC→Cursor / Cursor→CC)
- [ ] **1. Mission** — mål i 1–3 sætninger + out-of-scope
- [ ] **2. Git truth** — remote, base, branch, SHA, PR-URL, `git diff --stat`
- [ ] **3. Ændringskort** — filer rørt + hvorfor (ikke kun filnavne)
- [ ] **4. Session-spor** — forsøg, fejl, antagelser, spring-over, læst-men-ikke-ændret
- [ ] **5. Kommandoer** — præcis cmd + exit code + relevant output
- [ ] **6. Miljø** — env-var **navne** brugt (aldrig secrets), DB/migration-status
- [ ] **7. Verifikation** — hvad er grønt, hvad er **ikke** kørt
- [ ] **8. Constraints** — må ikke røres / safety gates
- [ ] **9. DONE / BLOCKED / NEXT** — tre lister, ingen prose-fyld
- [ ] **10. Acceptkriterier** — “færdig når …” checkboxes
- [ ] **11. Attachments** — paths til logs, screenshots, transcripts

---

## Minimumsdefinition af “ALT”

| Lag | Krav |
|---|---|
| Intention | Mission + acceptkriterier |
| Tilstand | Branch + SHA + full diffstat (+ PR) |
| Arbejde | Ændringskort + session-spor |
| Bevis | Kommandoer + test/CI-resultat |
| Grænser | Constraints + miljønavne |
| Videreførsel | DONE / BLOCKED / NEXT |

Manglende **tilstand** eller **bevis** = utilstrækkelig handoff, uanset hvor god prompten er.

---

## Modtager-protokol (Cursor Cloud)

1. Læs `docs/exports/LATEST.md` først — ikke chatten alene.  
2. `git fetch` + checkout den angivne branch/SHA.  
3. Afvis arbejde hvis §2/§5/§9 er tomme.  
4. Arbejd kun inden for §8 constraints.  
5. Afslut med **ny** export (overskriv `LATEST.md` + arkivkopi).

---

## Afsender-protokol (Claude Code)

Før du siger “færdig” eller beder Cursor tage over:

1. Kør `npm run agent:export`  
2. Udfyld §3–§11 manuelt  
3. `git add docs/exports && git commit && git push`  
4. Peg modtageren på **commit SHA** + `docs/exports/LATEST.md`

---

## Eksempel på fyldt export

Se [`docs/exports/2026-08-02-cursor-swarm-baseline.md`](./exports/2026-08-02-cursor-swarm-baseline.md) — baseline fra Cursor Cloud (ikke Claude Code), som viser forventet dybde.

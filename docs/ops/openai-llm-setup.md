# OpenAI / LLM-setup · PraxisOS (Broser)

**Status (produktion 2026-08-26):** `liveReady: true` (Replicate + Roboflow sat).  
`OPENAI_API_KEY` er **ikke** sat → `llmReady: false`. Live fod-scan virker uden OpenAI.

OpenAI er **valgfri** til live quality PASS. Nøglen bruges til rigtige LLM-agentsvar
(Bird/agent-automation). Uden nøgle falder agents tilbage til dansk template-svar.

Ingen Docker-rebuild. Nøgler gemmes i volume `/data/secrets.json` (`PRAXIS_DATA_DIR`).

## Hurtig status

```bash
curl -sS https://app.bypilar.dk/api/scan/config | jq '{liveReady,llmReady,blockers,notes,providers}'
# eller
curl -sS https://app.bypilar.dk/api/v1/scan/process | jq '{liveReady,llmReady,blockers,notes}'
```

| Felt | Betydning |
|------|-----------|
| `liveReady` | Replicate **og** Roboflow sat → live scan-pipeline klar |
| `llmReady` | `OPENAI_API_KEY` sat → LLM-agents kan kalde OpenAI |
| `blockers` | Mangler der blokerer **live scan** (ikke LLM) |
| `notes` | Soft hints (fx OpenAI mangler, men valgfri) |

## Sådan tilføjer Michael OpenAI-nøglen (uden rebuild)

### A · Broser UI (anbefalet)

1. Hent en API-nøgle fra [platform.openai.com/api-keys](https://platform.openai.com/api-keys) (`sk-…`).
2. Vælg én af siderne (begge skriver til samme `secrets.json`):
   - **https://app.bypilar.dk/scan** → feltet `OPENAI_API_KEY` (synligt også når live scan allerede er klar)
   - **https://app.bypilar.dk/admin/bird** → feltet `OPENAI_API_KEY · valgfri`
3. Indsæt nøglen → **Gem**.
4. Verificér:
   ```bash
   curl -sS https://app.bypilar.dk/api/scan/config | jq '.llmReady, .providers.openai, .providers.openaiHint'
   ```
   Forvent: `llmReady: true`, `openai: true`, hint ala `sk-…xxxx`.

### B · Direkte i `secrets.json` på Hetzner

```bash
ssh root@167.233.171.184
docker exec -it praxisos_app sh
# inde i containeren:
# rediger /data/secrets.json — tilføj "OPENAI_API_KEY": "sk-..."
# ingen restart nødvendig (cache opdateres ved næste writeSecrets / process restart
# hvis du kun redigerer fil manuelt: restart app-container én gang)
```

Anbefalet: brug UI (POST `/api/scan/config` eller `/api/bird/config`), så in-memory cache opdateres med det samme.

### C · Env i compose (kun hvis I bevidst vil pin'e)

Sæt `OPENAI_API_KEY` i host-env / compose — `resolveSecret` læser env først, derefter `secrets.json`.  
UI-flowet ovenfor er nok til daglig drift.

## Kode-steder

| Del | Fil |
|-----|-----|
| Læs/skriv secrets | `lib/secrets.ts` → `resolveSecret`, `writeSecrets`, `liveScanReady` |
| Scan readiness API | `GET/POST /api/scan/config` |
| Pipeline status | `GET /api/v1/scan/process` (`liveReady`, `llmReady`, `blockers`, `notes`) |
| Broser UI | `components/NexusProviderSetup.tsx` på `/scan` |
| Bird UI | `app/(internal)/admin/bird/page.tsx` |
| LLM-kald | `lib/agents/llm.ts` (`isLlmConfigured`, `chatCompletions`) |

`liveScanReady = replicate && roboflow` — OpenAI indgår **ikke** i `liveReady`.

## Manual E2E · live quality PASS (plantar foto)

Automatiseret fuld PASS kræver et ægte plantar-foto gennem Replicate + Roboflow
(tredjepart). Kør **ikke** patient-PHI uden samtykke. Checklist til Michael:

1. Bekræft readiness:
   ```bash
   curl -sS https://app.bypilar.dk/api/v1/scan/process | jq '{liveReady,llmReady,blockers,notes}'
   ```
   Forvent: `liveReady: true`, `blockers: []`.
2. Åbn **https://app.bypilar.dk/scan** (eller scan-start med booking).
3. Upload et skarpt plantar-foto (≥ ~80 KB, hele fodsålen synlig, jævn belysning).
4. Kør scan (`requireQuality` hvis UI har det).
5. Forvent i respons/UI:
   - `quality.pass === true`
   - `quality.score >= 70` (threshold uændret)
   - remote `meshUrl` (https, ikke procedural/placeholder)
   - fod detekteret
6. Ved HOLD: notér `quality.checks[]` (mesh_remote / foot_detected / image_resolution).
7. (Valgfrit) Efter OpenAI er sat: smoke-test en agent-chat/automation og bekræft at svaret ikke er ren fallback.

## Lokal syntetisk test (ingen PHI)

```bash
npm test -- tests/scan-quality.test.ts tests/roboflow-contracts.test.ts
```

Dækker quality-gate + Roboflow Zod-fixtures uden upload til tredjepart.

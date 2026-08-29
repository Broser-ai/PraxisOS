# PraxisOS · Sandbox-verifikation

Isoleret verifikationsmiljø — **ikke** Hetzner produktions-/patientsti.
Sandbox ≠ production unlock. Canary/shadow host-env røres ikke.

## Sandbox-type brugt i denne kørsel

| Forsøg | Status |
|--------|--------|
| Vercel Sandbox (`@vercel/sandbox`) | Utilgængelig (MCP `needsAuth`, ingen `VERCEL_TOKEN`/`OIDC`) |
| Docker Compose (`docker-compose.sandbox.yml`) | Docker ikke tilgængelig i Cloud Agent VM |
| **Fallback: lokal npm/vitest/tsc** | **Brugt** — mock/fixture env via `.env.sandbox` |

## Hurtig start

```bash
# 1) Mock env (ingen rigtige patientbilleder / ingen tredjeparts-upload)
cp .env.sandbox.example .env.sandbox

# 2) Kør fuld verifikation
npm run sandbox:verify
# eller: PRAXIS_SANDBOX_FORCE_LOCAL=1 bash ./scripts/sandbox-verify.sh

# 3) Valgfrit: Docker-sandbox (når Docker findes)
cp .env.sandbox.example .env.sandbox
npm run sandbox:up
# → http://127.0.0.1:3002  (PORT bind 0.0.0.0 inde i container)
```

Rapport skrives til `.sandbox-verify/` (gitignored).

## Hvad der skal være grønt

| Check | Kommando | Forventet |
|-------|----------|-----------|
| Typecheck | `npm run typecheck` / `tsc --noEmit` | exit 0 |
| Tests | `npm test` (vitest) | alle suites grønne |
| Lint | *(ingen `lint`-script i package.json)* | skip |
| Build | `npm run build` | exit 0 |

### Resultat (sandbox-verify branch)

Kørt med `PRAXIS_DB=mock`, `SCAN_QUALITY_THRESHOLD=70`, canary/shadow **OFF**:

| Check | Resultat |
|-------|----------|
| `tsc --noEmit` | **PASS** |
| `vitest run` | **PASS** — 16 files / **83 tests** |
| lint | skip (ikke defineret) |
| `next build` | **PASS** — 108 routes; standalone output |

Bemærkninger under build (ikke blockers):

- Next 16 middleware → proxy deprecation warning
- Turbopack NFT trace warning via `lib/journal.ts` (filesystem/path join)

## Sandbox-guards (bevidst)

- `PRAXIS_DB=mock` — ingen live Supabase patientdata
- `REPLICATE_API_TOKEN` / `ROBOFLOW_API_KEY` tomme — ingen patientbilleder til third parties
- `FOOT_VISION_CANARY_PERCENT=0`, `PRAXIS_ACTIVE_ROUTING_ENABLED=false`
- `PRAXIS_SHADOW_EVAL_ENABLED=false`
- `SCAN_QUALITY_THRESHOLD=70` uændret
- Landmarks forbliver non-deployable
- Ingen DPA/secrets opfundet eller committed

## Residuale produktions-gaps (uden for sandbox)

Disse er **kendte** og blokerer stadig fuld klinisk go-live — sandbox gør dem ikke væk:

1. **Replicate billing** — Trellis/mesh kræver betalt/gyldig Replicate-konto i prod
2. **Undeployed custom Roboflow-modeller** — Del Pilar Nexus custom endpoints / canary >0% kræver deploy + privacy-gate
3. **Formel DPA** — operationel Broser-accept ≠ formaliseret leverandør-DPA
4. **Plantar E2E** — fuld plantarfoto → quality → inferens → journal end-to-end på patientsti mangler stadig i prod
5. Hetzner live clinical flags / canary må **ikke** flips via denne sandbox-PR

## Relaterede filer

- `.env.sandbox.example` — mock fixture env
- `docker-compose.sandbox.yml` — isoleret compose (adskilt fra `docker-compose.praxis.yml`)
- `scripts/sandbox-verify.sh` — typecheck + vitest + build
- `docs/vision/*` — privacy unlock, shadow eval, model governance

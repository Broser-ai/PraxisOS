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

## Reality sync (F4–F84 · PR #33+#34)

P0 secure clinical core + continue-dev landede i-repo (auth guards, consent,
audit, booking kit, MCP/embed harden, CI, consent UX idempotency, journal
guard consistency). Sandbox forbliver mock — den erstatter **ikke** merge eller
Hetzner-cutover.

| Check | Resultat (fortsat udvikling · 2026-09-03) |
|-------|-------------------------------------------|
| `tsc --noEmit` / `npm run typecheck` | **PASS** |
| `vitest run` / `npm test` | **PASS** — **~500+ tests** (PR #34; was ~83 on early sandbox branch) |
| lint | skip (ikke defineret) |
| CI workflow | F14 + F84 script-existence gate |
| Operator path | [p0-operator-checklist-merge-cutover.md](./p0-operator-checklist-merge-cutover.md) |

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

1. **Merge #33+#34** — Michael only; agents do not merge
2. **Hetzner cutover** — `PRAXIS_DB` + migrations + memory import (manual Broser)
3. **Captcha site keys** — widget deferred until keys exist
4. **Replicate billing** — Trellis/mesh kræver betalt/gyldig Replicate-konto i prod
5. **Undeployed custom Roboflow-modeller** — Del Pilar Nexus custom endpoints / canary >0% kræver deploy + privacy-gate
6. **Formel DPA** — operationel Broser-accept ≠ formaliseret leverandør-DPA
7. **Plantar E2E** — fuld plantarfoto → quality → inferens → journal end-to-end på patientsti mangler stadig i prod
8. Hetzner live clinical flags / canary må **ikke** flips via denne sandbox-PR

## Relaterede filer

- `.env.sandbox.example` — mock fixture env
- `docker-compose.sandbox.yml` — isoleret compose (adskilt fra `docker-compose.praxis.yml`)
- `scripts/sandbox-verify.sh` — typecheck + vitest + build
- `docs/ops/coding-ready.md` — agent-stack + P0 coding readiness
- `docs/ops/p0-secure-clinical-core-plan.md` — F4–F84 slice table
- `docs/vision/*` — privacy unlock, shadow eval, model governance

# Audit · Praxis Agent / AI-Team zip (2026-08-01)

## Filstatus

| Fil | Status i cloud-env |
|---|---|
| `c:\Users\Ambro2\Downloads\PraxisOS-AI-Team.zip` | **Ikke uploadet** — findes ikke i workspace/uploads |
| `praxis-agent_f39f.zip` (allerede i uploads) | **Analyseret** — 79 KB · 51 filer · 2026-07-17 |

Hvis `PraxisOS-AI-Team.zip` er en **anden** fil end `praxis-agent`, upload den til agenten — ellers antages nedenstående at være det, du mener.

---

## 0 · Verdict

| Spørgsmål | Svar |
|---|---|
| Brugbar? | **Ja som blueprint + voice-scaffold** |
| Skal implementeres wholesale i PraxisOS? | **Nej** |
| Skal bruges selektivt? | **Ja** — som separat voice-worker spor / patterns |
| Production-ready i dag? | **Nej** (selv-erklæret Fase 0 scaffold · ~6 ugers roadmap) |
| Score som produkt | **38/100** |
| Score som design-doc | **82/100** |

**Anbefaling:** Behold PraxisOS clinic SaaS (`/workspace`) som kanonisk app. Behandl `praxis-agent` som **sidecar-idé** (intern stemme-agent). Port kun LiveKit/tool-mønstre ind i eksisterende `lib/voice/*` — ikke Clerk-fork, ikke parallel Next-app i samme repo uden bevidst monorepo-beslutning.

---

## 1 · Hvad zip’en er

Reverse-engineered Ethos (`agent.askethos.com`) → **Praxis Agent** scaffold:

- Next.js 15 web (Clerk auth, LiveKit token, VoiceRoom UI)
- Separat **LiveKit Agents worker** (Deepgram STT → Claude → Cartesia TTS)
- Tools: RAG search, SQL SELECT, Slack, reminders
- Blueprint: datamodel, deploy (Vercel + Railway), 6-ugers roadmap
- Dokumenter: `SYSTEM-BLUEPRINT.md`, `PRAXIS-AGENT-KOMPLET.md`

**Ikke-mål (deres egne):** ikke kunde-facing, ingen marketplace, intern medarbejder-agent.

---

## 2 · REAL vs STUB i koden

| Komponent | Status | Note |
|---|---|---|
| `SYSTEM-BLUEPRINT.md` / KOMPLET.md | **REAL docs** | Stærk arkitektur + Ethos RE |
| LiveKit token route | **REAL scaffold** | Clerk + AccessToken — kompilerbar |
| `VoiceRoom.tsx` | **REAL UI scaffold** | LiveKit React components |
| `worker/voice-agent.ts` | **REAL shape** | Pipeline wiring; API kan være outdated vs current `@livekit/agents` |
| `worker/tools` RAG `embed()` | **STUB/BROKEN** | Returnerer **zero-vector** — semantisk søgning virker ikke |
| `safe_query` / `match_documents` RPC | **Ikke i zip** | Kun kaldt — migrations mangler i zip |
| Conversations UI | **UI shell** | Minimal pages |
| Clerk middleware | **Scaffold** | Konflikter med Praxis HMAC-session model |
| Cartesia voice `da-DK-female-1` | **Risiko** | Kan være placeholder voice-id |
| shadcn `components/ui/` | **Tom** | Mappe uden primitives |
| Tests | **Ingen** | 0 testfiler |

Blueprint siger selv: **“Version 0.1 (blueprint, ikke deployed)”** · Fase 0 scaffold.

---

## 3 · Konflikt med nuværende PraxisOS

| Praxis Agent zip | PraxisOS workspace | Konflikt |
|---|---|---|
| Clerk auth | HMAC `praxis_session` + scrypt | **Hård** — ikke mix uden BFF-valg |
| Separat Next 15 app | Next 16 clinic app | **Fork** — ikke drop-in merge |
| Organization via Clerk | Multi-tenant slug (`bypilar`) | Mapping nødvendig |
| Intern stemme-agent | Clinic SaaS + S-H swarm + Alphaxiv | Forskellige jobs |
| PostHog/Sentry/Railway worker | Vercel cron swarm | OK som sidecar |
| SQL tool `safe_query` | Ingen RPC | Skal bygges + harden (SQL injection risk) |

---

## 4 · Alignment med Alphaxiv-chat / zip-prototype

| Chat/zip claim | Dette AI-team zip |
|---|---|
| Voice-plane LiveKit + Deepgram | **Matcher** blueprint |
| Medical ASR / SOAP scribe | **Ikke** — intern general agent, ikke klinisk scribe |
| S-H swarm / NINA | **Ikke** |
| Tool calling | **Ja** (Slack/RAG/SQL) — godt mønster |
| MDR / clinical | **Uden for scope** (intern) — godt |

---

## 5 · Skal vi implementere? Beslutningsmatrix

### Implementér / port (anbefalet)
1. **Voice pipeline pattern** → udvid `lib/voice/*` i PraxisOS (LiveKit token findes allerede delvist i zip-prototype).
2. **Tool-context pattern** (org-scoped, explicit accept for writes) → H-bridge / MCP tools.
3. **Conversation persistence schema** (messages + tool_calls) → ny migration efter swarm `0004`, hvis voice shippes.
4. **Observability events** (`voice.session_*`) → PostHog senere.

### Implementér ikke nu
1. Wholesale merge af `praxis-agent/` ind i monorepo root.
2. Clerk som erstatning for clinic staff auth.
3. Open SQL tool uden streng allowlist / read-only role.
4. Zero-vector RAG “som virker”.
5. Parallel Vercel-projekt før clinic-ops er stabil.

### Betinget “ja” (egen service)
Hvis målet er **intern AI-team stemme-agent** (Ethos-lignende):
- Deploy som **separat repo/service** `praxis-agent`
- Peg tools mod PraxisOS MCP / Supabase read APIs
- Hold clinic MDR-path isoleret
- Budget: ~6 uger + keys (LiveKit, Deepgram, Cartesia, Anthropic, Clerk)

---

## 6 · Risici

1. **Auth-split** forvirrer staff vs intern agent.  
2. **SQL tool** er farlig uden `safe_query` + org filter.  
3. **LiveKit Agents API drift** siden 2026-07-17 — worker skal re-verificeres.  
4. **Cost**: always-on voice worker + STT/TTS/LLM.  
5. **Scope creep**: Ethos marketplace features er eksplicit ikke-mål — hold dem ude.

---

## 7 · Anbefalet næste skridt (Michael)

1. **Bekræft:** Er `PraxisOS-AI-Team.zip` = denne `praxis-agent` zip? Hvis nej → upload den rigtige.  
2. Vælg spor:
   - **A)** Sidecar intern agent (separat deploy) — brug blueprint  
   - **B)** Kun port voice stubs ind i PraxisOS clinic (mindre)  
   - **C)** Drop for nu — fokus clinic-ops + Alphaxiv + Lag B scanner  
3. Hvis A/B: fix `embed()` + migrations før “MVP voice” kaldes færdig.

**Default anbefaling fra master-orchestrator:** **C nu, B senere** — clinic durable loop + swarm + Alphaxiv giver mere værdi end at starte en Clerk+LiveKit parallel app.

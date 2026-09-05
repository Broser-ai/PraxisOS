# Agent / provider capability inventory

**Scope:** code-only inventory (adapters, runtime call paths, config names).  
**Branch:** `cursor/provider-capability-inventory-2c11`  
**Rule:** Name alone in docs / prompts / `.env.example` ≠ active integration. Distinguishes *library installed* vs *adapter exists* vs *called at runtime* vs *Prime-controllable*.

**Legend — Found in code**

| Value | Meaning |
|-------|---------|
| **Adapter + runtime** | In-repo adapter and a reachable call path |
| **Library only** | Dependency present; no dedicated outbound provider adapter beyond that |
| **Framework (in-process)** | Orchestration library used in-process (not a remote “provider API”) |
| **Inbound surface** | PraxisOS exposes this; external clients call us |
| **Local tooling** | Git / process tooling, not a cloud AI vendor |
| **NOT FOUND** | No adapter and no runtime call path in app code |

**Prime control today** means: Prime Execution Control (`lib/prime/dispatcher.ts` → missions / workstreams / BudgetGuard) can start, budget, or attach that path without a separate Broser-only UI/API.

---

## Inventory table

| Provider/system | Found in code | Actual runtime call path | Required config name only | Sandbox/live status | Token/cost usage exposed | Callback/status exists | Can Prime control it today |
|-----------------|---------------|--------------------------|---------------------------|---------------------|--------------------------|------------------------|----------------------------|
| **OpenAI** | Adapter + runtime | `lib/agents/llm.ts` `chatCompletions` → `fetch({OPENAI_BASE_URL}/chat/completions)`; callers: `lib/agents/runtime.ts` `runAgent`, journal AI helpers, Bird/admin LLM readiness | `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`, `OPENAI_BASE_URL`) | Live when key resolved (`resolveSecret` / env / `/data/secrets.json`); else heuristic templates (`mode: "heuristic"`) | Yes — `usage` / `extractProviderUsage` → Prime `BudgetGuard` when `missionId` set | Yes — agent runs + `GET /api/agents/status` (`llm.configured`); no OpenAI webhook inbound | **Yes (partial)** — dispatcher `runAgent` with `missionId` wires BudgetGuard; does not configure keys |
| **Anthropic** | Adapter + runtime | `lib/llm-adapter.ts` `ChatAnthropic` → used by `lib/orchestrator.ts` / `POST /api/v1/[tenant]/orchestrator` and `lib/swarm/h-bridge.ts` | `ANTHROPIC_API_KEY`, `PRAXIS_LLM_MODE` (`stub`\|`live`), gate `AGENT_ORCHESTRATION_ENABLED=true` | Stub by default if key missing or `PRAXIS_LLM_MODE=stub`; live Claude only with key + non-stub mode | Yes — `usage_metadata` → `{prompt,completion}` on `LLMCallResult` (not wired into Prime BudgetGuard) | Yes — async run poll `GET /api/v1/[tenant]/orchestrator/runs/[runId]` | **No** — Prime tick uses OpenAI `runAgent`, not Anthropic orchestrator |
| **LangGraph** | Framework (in-process) | `lib/orchestrator.ts` `StateGraph` (`@langchain/langgraph`); LLM node calls Anthropic adapter above | Same as Anthropic + `AGENT_ORCHESTRATION_ENABLED` | In-process graph; LLM stub/live follows Anthropic adapter | Indirect via Anthropic adapter usage fields | Same orchestrator run poll URL | **No** — not on Prime dispatcher path |
| **Roboflow** | Adapter + runtime | `lib/scanner/roboflow-infer.ts` URL builder → `lib/scanner/alpha-pipeline.ts` (segment/pathology `fetch`); shadow/canary helpers under `lib/scanner/*` | `ROBOFLOW_API_KEY` (+ model/host pins: `ROBOFLOW_*`, shadow/privacy flags) | Live infer when key present; skip/demo notes when missing; custom canary gated by privacy/active-routing flags | **No** token/cost ledger in scanner path (predictions only) | Sync HTTP response only; config/status via `GET /api/scan/config` (`liveReady` / providers) — **no** inbound Roboflow webhook | **No** — scan pipeline / Broser scan config; outside Prime missions |
| **Replicate** | Adapter + runtime | `lib/scanner/trellis-mesh.ts` `runTrellisMeshPrediction` → `api.replicate.com` predictions (+ poll `urls.get`); entry from `alpha-pipeline` L3; TriView shadow may POST InstantMesh prediction | `REPLICATE_API_TOKEN` (+ `REPLICATE_MESH_MODEL`, `REPLICATE_MESH_VERSION`) | Live mesh when token present; anatomical demo-mesh when missing; TriView shadow optional | **No** cost ledger; prediction `status` / mesh URL only | Client-side poll of Replicate prediction GET URL; scan config `liveReady` — **no** inbound Replicate webhook | **No** — scan / shadow only |
| **Hugging Face** | NOT FOUND | — | — | — | — | — | **No** |
| **HeyGen** | NOT FOUND | — | — | — | — | — | **No** |
| **Tinker / Tinkerl** | NOT FOUND | — | — | Docs-only future LoRA research mentions; **no adapter assumed** | — | — | **No** |
| **Inkling** | NOT FOUND | — | — | Docs-only future LoRA research mentions; **no adapter assumed** | — | — | **No** |
| **Cursor** | NOT FOUND (as controllable provider) | No Cursor Cloud / Agent API client in app code. Mentions: branch prefix `cursor/*`, adjudication bot-name denylist, admin MCP *client config snippet*, ops note that desktop Roboflow MCP lives in Cursor plugin | — (IDE/host, not app secret) | N/A as runtime vendor | N/A | N/A | **No** — see note below |
| **VS Code / Copilot** | NOT FOUND | — | — | — | — | — | **No** |
| **Git worktree** | Local tooling + runtime | `lib/swarm/worktree-manager.ts` / `lib/worktree/manager.ts` (`git worktree add`…); Prime `attachBuilderWorktree`; swarm `worktree_exec`; MCP `list_swarm_worktrees` / `cleanup_swarm_worktrees` | Local git repo; swarm flags `PRAXIS_SWARM_ENABLED`, approve tokens for merge *intent* only | Always local FS/git; jobs tracked in swarm memory; **NO_AUTO_MERGE** | N/A (not token-billed) | Yes — `getSwarmWorktreeStatus`, swarm APIs, MCP list/cleanup | **Yes (partial)** — builder workstreams get worktrees; human still gates merge/PR |
| **MCP** | Inbound surface + runtime | PraxisOS MCP server `app/api/mcp/v1/route.ts` + `lib/mcp-tools.ts` / `lib/mcp-handlers.ts`; agents call tools via `executeMcpTool`. Outbound Cursor/Roboflow MCP = desktop IDE (docs), not app runtime | Tool calls: tenant API keys / auth; CORS `PRAXIS_MCP_ORIGINS` | Server always in tree; tools require auth (except initialize/ping) | N/A as vendor cost; agent ledger on tool calls | Yes — MCP discovery GET + JSON-RPC results; `swarm_status` / `prime_status` tools | **Partial** — Prime/swarm tools are *exposed on* MCP; Prime does not “drive” external MCP hosts |

---

## Layer notes (library vs adapter vs runtime vs Prime)

| System | `package.json` / install | Adapter module | Called at runtime | Prime-controllable |
|--------|--------------------------|----------------|-------------------|--------------------|
| OpenAI | No `openai` SDK (raw `fetch`) | `lib/agents/llm.ts` | Yes | Yes (via missions → `runAgent`) |
| Anthropic | `@anthropic-ai/sdk` + `@langchain/anthropic` (adapter uses LangChain wrapper; **no direct `@anthropic-ai/sdk` import**) | `lib/llm-adapter.ts` | Yes (orchestrator / H-bridge) | No |
| LangGraph | `@langchain/langgraph` | `lib/orchestrator.ts` | Yes when orchestration enabled | No |
| Roboflow | No npm SDK | `lib/scanner/roboflow-infer.ts` + pipeline | Yes (scan) | No |
| Replicate | No npm SDK | `lib/scanner/trellis-mesh.ts` | Yes (scan / TriView shadow) | No |
| HF / HeyGen / Tinker / Inkling / VS Code·Copilot | Absent | Absent | Absent | No |
| Cursor | N/A | Absent | Absent as provider API | No |
| Git worktree | system `git` | `lib/swarm/worktree-manager.ts` | Yes | Partial |
| MCP | In-repo HTTP JSON-RPC | `app/api/mcp/v1` | Yes (inbound) | Partial (expose only) |

---

## Why Prime cannot control Cursor (still true)

1. **No Cursor API adapter** — repo has no client for Cursor Cloud Agents, Background Agents, or desktop automation APIs.
2. **Cursor hosts the agent** — Cloud/desktop agents *operate on* PraxisOS (git, MCP client config, Roboflow plugin). That is outward IDE tooling, not an in-app provider Prime can dispatch.
3. **MCP direction is inverted** — `/admin/mcp` documents how Cursor should call *PraxisOS* tools; Prime does not spawn or steer Cursor sessions.
4. **Branch naming ≠ control plane** — `cursor/…-2c11` prefixes and bot-name denylists are conventions/safety filters, not a Cursor runtime integration.
5. **Desktop Roboflow MCP** (`docs/ops/roboflow-cursor-sot.md`) is authenticated in Michael’s Cursor desktop plugin — outside Prime mission/dispatcher scope and distinct from `ROBOFLOW_API_KEY` scan inference.

---

## Config name checklist (names only — not values)

| Config | Used by |
|--------|---------|
| `OPENAI_API_KEY` | Agents LLM, journal helpers, readiness UIs |
| `OPENAI_MODEL` / `OPENAI_BASE_URL` | OpenAI-compatible chat path |
| `ANTHROPIC_API_KEY` / `PRAXIS_LLM_MODE` | LangGraph LLM adapter |
| `AGENT_ORCHESTRATION_ENABLED` | Orchestrator feature gate |
| `REPLICATE_API_TOKEN` / `REPLICATE_MESH_*` | Trellis mesh |
| `ROBOFLOW_API_KEY` / `ROBOFLOW_*` / shadow & privacy flags | Scan + shadow routing |
| `PRAXIS_MCP_ORIGINS` | MCP CORS allowlist |
| `PRAXIS_SWARM_ENABLED` / `SWARM_*` / `PRIME_APPROVE_TOKEN` | Swarm / worktree / human gate |
| `AGENT_WORKER_SECRET` | Worker → `/api/agents/tick` (Prime dispatcher entry) |

**Not in `.env.example` but required for live Anthropic:** `ANTHROPIC_API_KEY`, `PRAXIS_LLM_MODE`, `AGENT_ORCHESTRATION_ENABLED` (documented in code / ops lists only).

---

## Explicit NOT FOUND (no assumptions)

- **Hugging Face** — skill text may mention HF save dirs for Roboflow custom weights; no HF Hub/inference adapter in app runtime.
- **HeyGen** — no code references.
- **Tinker / Tinkerl / Inkling** — only narrative LoRA research in docs (`docs/vision/lora-status.md`); **do not treat as integrated**.
- **VS Code / GitHub Copilot** — no adapter, extension bridge, or API usage in tree.

---

## Primary code anchors

| Area | Paths |
|------|-------|
| OpenAI agents | `lib/agents/llm.ts`, `lib/agents/runtime.ts` |
| Anthropic + LangGraph | `lib/llm-adapter.ts`, `lib/orchestrator.ts`, `lib/swarm/h-bridge.ts` |
| Prime control | `lib/prime/dispatcher.ts`, `lib/prime/budget-guard.ts`, `lib/prime/orchestrator.ts` |
| Scan providers | `lib/scanner/alpha-pipeline.ts`, `lib/scanner/roboflow-infer.ts`, `lib/scanner/trellis-mesh.ts` |
| Worktree | `lib/swarm/worktree-manager.ts`, `lib/worktree/manager.ts` |
| MCP | `app/api/mcp/v1/route.ts`, `lib/mcp-tools.ts` |
| Secrets shape | `.env.example`, `lib/secrets.ts` (names/booleans only) |

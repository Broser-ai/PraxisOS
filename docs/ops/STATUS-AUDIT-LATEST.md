# Status + audit — latest pointer

**Regenerated:** 2026-09-04T13:51–13:52Z (UTC)  
**Branch:** `cursor/status-audit-regen-a8bf`  
**Agent:** `bc-a567e1be-e4bf-5ee4-b878-e86aeeb4a8bf`  
**`main` tip:** `623b0f9` — `docs(ops): align triage tip SHA to main HEAD`

## Executive summary

Planway customer booking on live `bypilar.dk` is **SOLVED** (theme `1.3.0-planway-total-kill`, **0** `planway.com`, HTTPS PraxisOS iframe, no `http://app` mixed content). Production DB is **NOT solved** — `/api/health` returns **503** `db_config_invalid` / `PRAXIS_DB=mock` forbidden. Alphaxiv is **research-ops ready** (catalog + public search/metadata); Assistant needs `ALPHAXIV_API_KEY`; it is **not** a clinical knowledge base. Cutover PRs **#37–#44** remain overlapping drafts; SSH/`HCLOUD` secrets are still missing in agent env.

## Documents (this regen)

| Doc | Purpose |
|-----|---------|
| [status-audit-vscode-alphaxiv-2026-09-04.md](./status-audit-vscode-alphaxiv-2026-09-04.md) | Full VS Code/Cursor + byPilar live + open PRs #37–#46 + blockers + Alphaxiv handoff (EN) |
| [alphaxiv-status-audit-2026-09-04.md](./alphaxiv-status-audit-2026-09-04.md) | Deep Alphaxiv connector audit (code, API, env, safety, tests) |

## Related (already on `main`)

- [foundation-status-audit-2026-09-04.md](./foundation-status-audit-2026-09-04.md)
- [open-pr-triage-2026-09-04.md](./open-pr-triage-2026-09-04.md)
- [p0-db-cutover-runbook.md](./p0-db-cutover-runbook.md)

## Supersedes

This regen **supersedes** the earlier drafts on:

- PR [#45](https://github.com/Broser-ai/PraxisOS/pull/45) (`cursor/status-audit-vscode-alphaxiv-2c11`)
- PR [#46](https://github.com/Broser-ai/PraxisOS/pull/46) (`cursor/alphaxiv-status-audit-2c11`)

Those PRs may still be open; prefer this branch for the freshest curl evidence (~13:51Z+).

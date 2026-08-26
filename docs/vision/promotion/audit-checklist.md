# Audit checklist template

**Immutable audit-event required for every promotion or pin change.**

| Field | Value |
|-------|-------|
| Event type | `model.version.changed` (or documented equivalent) |
| Event ID | |
| Timestamp (UTC) | |
| Actor (named human) | Broser: _______________ |
| Model role | |
| From model ID | |
| To model ID | |
| From status | |
| To status | |
| Eval report link | |
| Model card version | |
| Rollback model ID | |
| `approved_for_active_routing` after change | must stay **false** unless gate-checklist fully signed |

## Pre-flight

- [ ] Pack complete: eval-report, model-card, rollback-plan, gate-checklist
- [ ] Privacy gate satisfied for any new data destination
- [ ] No agent-only approval (human signature present)
- [ ] Production thresholds / patient copy / retention **unchanged** unless separately approved

## Post-flight

- [ ] Registry change log row added
- [ ] Audit event persisted (immutable store / log sink)
- [ ] Smoke verification recorded

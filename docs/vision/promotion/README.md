# Promotion pack · Broser-only

Templates Broser must complete **before** any model or workflow may set
`approved_for_active_routing: true` or leave `shadow`/`disabled` for a clinical path.

**Binding policy:** `../model-governance.md`  
**Gates:** `../acceptance-criteria.md`  
**Registry SoT:** `../model-registry.md`

## Pack contents

| Template | Purpose |
|----------|---------|
| `eval-report.md` | Metrics, slices, failure modes |
| `model-card.md` | Versioned model card |
| `rollback-plan.md` | Exact previous model ID pin |
| `audit-checklist.md` | Immutable audit-event + approver |
| `gate-checklist.md` | Master gate tying governance + acceptance |

## Rules

1. Agents may draft filled copies in a PR — **must not** set
   `approved_for_active_routing: true` or change production pins/thresholds/copy/retention.
2. Named human approver (Broser) required on every promotion.
3. Incomplete pack → model stays `shadow` or `disabled`.
4. Landmarks (`praxisos`) additionally require `landmarks-training-brief.md`
   completion (trained + adjudicated) before any deployable path.

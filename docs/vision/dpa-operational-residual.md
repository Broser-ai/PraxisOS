# DPA residual · operational paperwork (not a legal PDF)

**Date:** 2026-08-27  
**Approver (operational):** Michael Ambrosius / Broser  
**Audit event:** `broser-unlock-2026-08-27`  
**Related:** `privacy-unlock-audit-2026-08-27.md`, `privacy-gate-broser-checklist.md`

> Agents must **not** forge a formal processor DPA PDF. This file is ops status only.

## Broser operational accept (marked)

| Item | Status |
|------|--------|
| Private Roboflow project path | **Accepted** (operational) |
| EU route documented | **Accepted** (operational) |
| DPA flag on host | `PRAXIS_VISION_DPA_SIGNED=true` |
| DPA status string | `PRAXIS_VISION_DPA_STATUS=broser_operational_accept_2026-08-27` |
| Residens-review | **Accepted** (operational) |
| Retention policy set | **Accepted** (unchanged policies; flag recorded) |
| Named human approver | Michael Ambrosius Broser |
| Formal DPA PDF on file | **Pending — lawyer** |

## Residual risk (explicit)

1. **No archived formal Art. 28/processor DPA PDF** with Roboflow (and any other custom vision processor). Operational unlock reduces process friction but does **not** replace counsel-signed paperwork.
2. Custom canary traffic (5%) may send clinical images to private Roboflow endpoints under operational accept — residual compliance risk until formal DPA is filed.
3. Audit sink on Hetzner defaults to in-memory (`PRAXIS_AUDIT_MODE` unset) — shadow/canary events are not durably archived unless Supabase audit mode is enabled.

## Next formal DPA step (lawyer)

1. Counsel drafts / reviews processor DPA covering Roboflow private workspace (and Replicate if in scope) for Art. 9-adjacent clinical images.
2. Broser signs; PDF archived in clinic compliance store (not invented by agents).
3. Ops updates `PRAXIS_VISION_DPA_STATUS` to a formal archive reference (e.g. filename + date) **after** the real PDF exists.
4. Optionally enable durable audit (`PRAXIS_AUDIT_MODE=supabase`) before expanding canary further.

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Broser (operational) | Michael Ambrosius / Broser | 2026-08-27 | Chat order «Kør alt og gør færdigt» — operational accept confirmed; formal PDF deferred to lawyer |
| Legal counsel | _TBD_ | — | Formal DPA PDF — human-only |

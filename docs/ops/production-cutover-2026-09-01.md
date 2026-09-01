# Production cutover · 2026-09-01

**Order:** Michael (Broser) — «flyt det til produktion nu - dvs. alm tilstand»  
**Agent:** Cursor cloud `bc-3c8f3691-3d90-5cef-a5ba-49f11a1dc901`  
**Target host:** Hetzner `167.233.171.184` · `/opt/PraxisOS` · https://app.bypilar.dk

## GitHub / alm tilstand (repo)

| Item | Result |
|------|--------|
| Branch tip (pre-merge) | `54489bb` `docs(ops): mark integrate tip coding-ready after green verify` |
| PR #21 | **MERGED** to `main` at `2026-09-01T09:41:51Z` |
| Merge commit | `7fa8ed87238685d0d96b8af8dc02b3a20c84d953` |
| `main` contains integrate tip | **yes** (`54489bb` ancestor of `7fa8ed8`) |

`gh pr merge 21 --merge` succeeded in this run (write path available despite usual read-only expectations).

## Host deploy status

| Item | Result |
|------|--------|
| SSH key `/home/ubuntu/.ssh/hetzner_praxis` in this agent env | **missing** at start (prior agents had it; snapshot/env no longer ships the legacy private key) |
| Cutover script on `main` | `bde72f0` (and branch `cursor/production-cutover-c901`) |
| Host code sync / container rebuild this run | **blocked pending SSH / Console one-liner** |
| Cutover script (console one-shot) | `scripts/production-cutover-main.sh` on `cursor/production-cutover-c901` — adds agent deploy pubkey, `git reset --hard origin/main`, rebuilds compose, **preserves** `.env.production` + Docker `/data` secrets volume |
| Secrets wipe | **not done** (script explicitly preserves) |

### Console one-liner (root on Hetzner Cloud Console)

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/production-cutover-main.sh | bash
```

After that (or after restoring legacy `hetzner_praxis` private key as secret `HETZNER_PRAXIS_SSH_PRIVATE_KEY`), agent can re-verify host SHA.

## Public verify (pre-host-sync, still live)

Taken before host git sync — clinical env from prior Broser unlocks remains live:

```text
GET https://app.bypilar.dk/scan          → HTTP 200
GET https://app.bypilar.dk/api/scan/config
  ok: true
  liveReady: true
  llmReady: true
  blockers: []
  providers: replicate + roboflow + openai present
```

### Expected clinical pins (last confirmed on host · prior agents)

From prior unlock/canary work (env-only restart; host may still be on older git branch until cutover runs):

- `SCAN_QUALITY_THRESHOLD=70` (unchanged; cutover script re-asserts 70)
- `FOOT_VISION_CANARY_PERCENT=5`
- Privacy / shadow / TriView / active-routing flags ON
- Landmarks remain **non-deployable** / not selected (no enablement in this cutover)
- `/data/secrets.json` must remain (Replicate / Roboflow / OpenAI / Bird)

## Explicit non-actions

- No fabricated formal DPA PDF
- Landmarks not enabled
- Threshold not lowered
- Secrets volume not wiped

## Residual risks

1. **Host git lag** — until cutover SSH/console runs, containers may still run pre-`main` tip (last known checkout was `cursor/trellis-canary-live-fix-694f` during Trellis pin work; later agents mostly env-restarted). Clinical readiness APIs already green.
2. **Replicate billing** — live Trellis mesh still billed per prediction.
3. **Undeployed custom Roboflow** — `praxisos-foot-*` / canary custom endpoints may 405 when version undeployed; Universe remains default ~95%.
4. **Formal DPA PDF** — still pending; operational accept `broser_operational_accept_2026-08-27` only.
5. **Plantar E2E** — Broser manual checklist not closed (`docs/vision/broser-plantar-e2e-checklist.md`).
6. **SSH key hygiene** — restore legacy key into Cloud Agent env secrets, or keep cutover pubkey authorized and rotate as needed.

## Next step to finish host cutover

1. Run the console one-liner above **or** inject `HETZNER_PRAXIS_SSH_PRIVATE_KEY`.
2. Confirm host `git rev-parse HEAD` == `7fa8ed8` (or later `main`).
3. Re-curl `/scan` + `/api/scan/config`; confirm `SCAN_QUALITY_THRESHOLD=70` on host env; landmarks still non-deployable.

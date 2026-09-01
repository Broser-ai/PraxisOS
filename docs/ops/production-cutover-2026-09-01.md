# Production cutover · 2026-09-01

**Order:** Michael (Broser) — «flyt det til produktion nu - dvs. alm tilstand»  
**Agents:** `bc-3c8f3691-3d90-5cef-a5ba-49f11a1dc901` (merge) · `bc-5fe41cfe-4d12-5ea9-9b02-d8924950220d` (SSH retry)  
**Target host:** Hetzner `167.233.171.184` · `/opt/PraxisOS` · https://app.bypilar.dk

## GitHub / alm tilstand (repo)

| Item | Result |
|------|--------|
| Integrate tip | `54489bb` (ancestor of `main`) |
| PR #21 | **MERGED** to `main` at `2026-09-01T09:41:51Z` |
| Merge commit | `7fa8ed87238685d0d96b8af8dc02b3a20c84d953` |
| `main` tip (verified this run) | **`a4255ac`** `ops: point production-cutover-main.sh comment at main URL` |
| Cutover script on `main` | **yes** — `https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/production-cutover-main.sh` (HTTP 200) |

## Host deploy status — **BLOCKED on SSH**

| Item | Result |
|------|--------|
| Agent private key path | `/home/ubuntu/.ssh/hetzner_praxis` **present** |
| Key identity | `ssh-ed25519` comment `cursor-praxisos-cutover-2026-09-01` · fingerprint `SHA256:FElypza+/1Hy8KIiScTNQzX4bpe/YowbdamigB8yfMc` |
| Matches cutover script `CURSOR_PUBKEY` | **yes** |
| `ssh -i … root@167.233.171.184` | **Permission denied (publickey,password)** — pubkey **not** in host `authorized_keys` yet |
| Legacy key (`cursor-hetzner-praxisos`) private material | **not** in this agent env |
| `HCLOUD_TOKEN` / Hetzner API | **absent** — cannot inject key / rescue without destroying or inventing credentials |
| Host `git rev-parse HEAD` | **unknown** (no SSH) — suspected lag vs `main` tip `a4255ac` |
| Container rebuild this run | **not run** |

### Michael — finish cutover (pick one)

**Preferred (no secrets needed):** Hetzner Cloud Console → server `167.233.171.184` → open root console (**do not rebuild/destroy**). Paste:

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/production-cutover-main.sh | bash
```

That script: authorizes agent + legacy deploy pubkeys → `git reset --hard origin/main` in `/opt/PraxisOS` → compose rebuild → **preserves** `.env.production` and Docker `/data/secrets.json`.

**Or** inject into Cloud Agent env (then re-run agent):

- `HETZNER_PRAXIS_SSH_PRIVATE_KEY` = legacy private key already trusted on the host, **or**
- `HCLOUD_TOKEN` = Hetzner Cloud API token for non-destructive rescue/key inject (no server destroy).

After console cutover (or key restore), agent can SSH-verify host SHA == `a4255ac` (or later `main`) and re-curl public endpoints.

## Public verify (live · host git SHA still unconfirmed)

```text
GET https://app.bypilar.dk/scan          → HTTP 200
GET http://167.233.171.184:3010/scan    → HTTP 200
GET https://app.bypilar.dk/api/scan/config
  ok: true
  liveReady: true
  llmReady: true
  blockers: []
  providers: replicate + roboflow + openai present
```

Clinical stack is already serving; only **code SHA alignment to `main`** is blocked on SSH/console.

### Expected clinical pins (last confirmed on host · prior agents)

- `SCAN_QUALITY_THRESHOLD=70` (cutover script re-asserts 70)
- `FOOT_VISION_CANARY_PERCENT=5`
- Privacy / shadow / TriView / active-routing flags ON
- Landmarks remain **non-deployable** / not selected
- `/data/secrets.json` must remain (Replicate / Roboflow / OpenAI / Bird)

## Explicit non-actions

- No fabricated formal DPA PDF
- Landmarks not enabled
- Threshold not lowered
- Secrets volume not wiped
- Server not destroyed / rebuilt

## Residual risks

1. **Host git lag** — until cutover SSH/console runs, containers may still run pre-`main` tip (last known checkout was `cursor/trellis-canary-live-fix-694f` during Trellis pin work; later agents mostly env-restarted). Clinical readiness APIs already green.
2. **Replicate billing** — live Trellis mesh still billed per prediction.
3. **Undeployed custom Roboflow** — `praxisos-foot-*` / canary custom endpoints may 405 when version undeployed; Universe remains default ~95%.
4. **Formal DPA PDF** — still pending; operational accept `broser_operational_accept_2026-08-27` only.
5. **Plantar E2E** — Broser manual checklist not closed (`docs/vision/broser-plantar-e2e-checklist.md`).
6. **SSH key hygiene** — after console one-liner, cutover pubkey is authorized; rotate/remove ephemeral keys as needed.

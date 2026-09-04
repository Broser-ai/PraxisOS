# byPilar · Planway → PraxisOS cutover (TOTAL KILL)

**Status (repo):** Planway er ude af byPilar-flader. Booking kører KUN via HTTPS klinik-OS.
**Status (live 2026-09-04 ~10:14 UTC):** `/booking/` peger på `app.bypilar.dk` men stadig `http://` iframe; `/udekoerende/` har stadig Planway-links. Theme/runtime + console script i denne branch retter det.

## Før / efter

| Flade | Før (Planway) | Efter (PraxisOS / white-label) |
| --- | --- | --- |
| Offentlig booking | `https://bypilar.planway.com` (+ iframe) | `https://app.bypilar.dk/t/bypilar/book?embed=1` |
| Site CTA | Links/embeds til Planway | `data-praxis-book` → HTTPS booking |
| Staff / dashboard | Planway admin | `https://app.bypilar.dk/login` («Kom i gang · Klinik») |
| Kundevendt brand | — | **by Pilar** — aldrig “PraxisOS” på bypilar.dk |

Planway-kontoen slettes **ikke** — kun alle indgange fra byPilar fjernes.

## Runtime safety (theme)

`wordpress/themes/pilar-theme/functions.php` rewrites Planway at render time:

- `the_content` / widget text
- nav menu link URLs/attributes
- full-page output buffer (page builders / leftovers)
- theme fragments via `pilar_part()`

Even if live DB still has Planway URLs, customers never see them after theme deploy.

## LIVE UNBLOCK — Broser Hetzner Console (one command)

SSH-agent secrets (`HETZNER_PRAXIS_SSH_PRIVATE_KEY` / `HCLOUD_TOKEN`) mangler i cloud agents. DNS `bypilar.dk` → `167.233.171.184` (Hetzner).

**På Hetzner Console (root), kør præcis:**

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/planway-total-kill-live-2c11/scripts/hetzner-console-planway-kill.sh | bash
```

Scriptet:

1. Tjekker `/opt/PraxisOS` ud på denne branch
2. Pusher `pilar-theme` + `praxisos-bridge.php` ind i live WP
3. Kører optional `wp search-replace` planway.com → PraxisOS book URLs
4. Verificerer **nul** planway på `/booking/` `/behandlinger/` `/udekoerende/` + HTTPS iframe

Hvis repo mangler på host først:

```bash
git clone https://github.com/Broser-ai/PraxisOS.git /opt/PraxisOS
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/planway-total-kill-live-2c11/scripts/hetzner-console-planway-kill.sh | bash
```

Agent pubkey (til `authorized_keys` hvis SSH ønskes senere):

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKo0tW+F3OGmrhuXhy5No7IXQj2rcre08kNc+LyYEdyT cursor-planway-cutover-57ae
```

Med SSH-secret i agent env:

```bash
bash scripts/push-bypilar-theme-live.sh
# eller fuldt console-flow lokalt efter checkout:
PRAXIS_BRANCH=cursor/planway-total-kill-live-2c11 bash scripts/hetzner-console-planway-kill.sh
```

## Verifikation

```bash
for p in /booking/ /behandlinger/ /udekoerende/; do
  echo "== $p =="
  curl -sL "https://bypilar.dk$p" | grep -i planway && echo FAIL || echo OK_no_planway
done
curl -sL https://bypilar.dk/booking/ | grep -F 'https://app.bypilar.dk/t/bypilar/book?embed=1' && echo OK_https
```

## Rollback

- Theme-filer: gendan forrige `wordpress/themes/pilar-theme` + `mu-plugins/praxisos-bridge.php`.
- Klinik-data i Planway påvirkes ikke.
- Standard er PraxisOS-only — genåbn ikke Planway uden eksplicit beslutning.

## Staff / kunde URL-guide

| Rolle | URL | Note |
| --- | --- | --- |
| Kunde booker | `https://bypilar.dk/booking/` eller `data-praxis-book` | White-label by Pilar |
| Direkte book | `https://app.bypilar.dk/t/bypilar/book` | Klinik-OS, by Pilar-brand |
| Staff login | `https://app.bypilar.dk/login` | «Kom i gang · Klinik» |
| Embed-script | `https://app.bypilar.dk/embed/v1/bypilar` | Modal for `data-praxis-book` |

**Hard rule:** byPilar ≠ PraxisOS-branding på kundevendte hosts.

## Related PRs (consolidate here)

Prefer this branch over overlapping #40 / #41 / #42 (`planway-purge` / `bypilar-planway-cutover` / `planway-kill`).

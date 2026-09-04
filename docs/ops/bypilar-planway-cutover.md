# byPilar · Planway → PraxisOS cutover

**Status:** Planway er ude af byPilar-flader. Booking kører KUN via eget klinik-OS.

## Før / efter

| Flade | Før (Planway) | Efter (PraxisOS / white-label) |
| --- | --- | --- |
| Offentlig booking | `https://bypilar.planway.com` (+ iframe) | `https://app.bypilar.dk/t/bypilar/book?embed=1` |
| Site CTA | Links/embeds til Planway | `data-praxis-book` → HTTPS booking |
| Staff / dashboard | Planway admin | `https://app.bypilar.dk` (login) |
| Kundevendt brand | — | **by Pilar** — aldrig “PraxisOS” på bypilar.dk |

Planway-kontoen slettes **ikke** — kun alle indgange fra byPilar fjernes.

## Blue/green (beskyt live booking)

1. Tilføj PraxisOS HTTPS-iframe + `data-praxis-book` (behold Planway midlertidigt hvis nødvendigt).
2. Verificér embed/knapper åbner `https://app.bypilar.dk/...`.
3. Fjern Planway-links/iframes/scripts.
4. Ryd mixed content (`http://` → `https://`).

## Live deploy (Hetzner)

DNS for `bypilar.dk` peger på Hetzner `167.233.171.184` (ikke Hostinger).

```bash
# Kræver HETZNER_PRAXIS_SSH_PRIVATE_KEY eller authorized agent-key
bash scripts/push-bypilar-theme-live.sh
# alternativ:
bash scripts/deploy-planway-cutover-wp.sh
```

Agent pubkey (til `authorized_keys` på Hetzner):

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKo0tW+F3OGmrhuXhy5No7IXQj2rcre08kNc+LyYEdyT cursor-planway-cutover-57ae
```

## Live status (agent snapshot 2026-09-04)

| Side | planway | http://app | https embed | data-praxis-book |
| --- | --- | --- | --- | --- |
| `/booking/` | 0 | 1 (mixed content) | 0 | 1 |
| `/` | 0 | 0 | 0 | 5 |
| `/behandlinger/` | 0 | 0 | 0 | 0 |
| `/udekoerende/` | 8 | 0 | 0 | 0 |
| `main.js` live | ingen `data-praxis-book` handler | | | |
| `/embed/v1/bypilar` live | `ORIGIN = https://0.0.0.0:3000` (broken) | | | |

Repo-fix er klar; **live kræver Hetzner SSH** (`push-bypilar-theme-live.sh`) + app-redeploy for embed ORIGIN.

## Verifikation

```bash
# Ingen Planway-referencer
curl -sL https://bypilar.dk/booking/ | grep -i planway && echo FAIL || echo OK_no_planway

# HTTPS clinic booking
curl -sL https://bypilar.dk/booking/ | grep -F 'https://app.bypilar.dk/t/bypilar/book?embed=1' && echo OK_https

# Øvrige sider
for p in / /behandlinger/ /udekoerende/; do
  echo "== $p =="
  curl -sL "https://bypilar.dk$p" | grep -i planway && echo FAIL || echo OK
done
```

## Rollback

- Theme-filer: gendan forrige `wordpress/themes/pilar-theme` + `mu-plugins/praxisos-bridge.php` via SSH/`scripts/wp.sh`.
- Nødvendigt midlertidigt Planway-link: kun efter eksplicit beslutning — standard er PraxisOS-only.
- Klinik-data i Planway påvirkes ikke af WordPress-cutover.

## Staff / kunde URL-guide

| Rolle | URL | Note |
| --- | --- | --- |
| Kunde booker | `https://bypilar.dk/booking/` eller knap `data-praxis-book` | White-label by Pilar |
| Direkte book | `https://app.bypilar.dk/t/bypilar/book` | Klinik-OS, by Pilar-brand |
| Staff login / dashboard | `https://app.bypilar.dk` | Fuldt klinik-OS |
| Embed-script | `https://app.bypilar.dk/embed/v1/bypilar` | Modal for `data-praxis-book` |

**Hard rule:** byPilar ≠ PraxisOS-branding på kundevendte hosts. Kliniske invariabler forbliver `suggestion_only` — ingen auto-merge af clinical policy.

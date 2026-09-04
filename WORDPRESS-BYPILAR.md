# by Pilar WordPress (Hetzner) · styret af Cursor

WordPress kører **på samme Hetzner** som klinik-OS (`app.bypilar.dk`). Cursor styrer via SSH + WP-CLI.

## Hvad der kører

| Ting | URL / kommando |
|------|----------------|
| WordPress | https://bypilar.dk |
| WP (intern port) | http://167.233.171.184:8088 |
| Klinik-OS (staff + booking) | https://app.bypilar.dk |
| WP-CLI | `bash scripts/wp.sh ...` |
| Deploy WP stack | `bash scripts/deploy-bypilar-wp.sh` |
| Planway-cutover deploy | `bash scripts/deploy-planway-cutover-wp.sh` |

## Booking (Planway er ude)

- Offentlig embed: `https://app.bypilar.dk/t/bypilar/book?embed=1`
- CTA: `data-praxis-book` (tema `js/main.js` + `/embed/v1/bypilar`)
- Cutover-runbook: `docs/ops/bypilar-planway-cutover.md`
- **White-label:** ingen “PraxisOS”-branding på bypilar.dk kundevendte sider
- Runtime rewrite i `functions.php` stripper Planway fra DB-content/menuer selv før wp-cli cleanup

### Live Planway-kill (Hetzner Console — når SSH mangler)

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/planway-total-kill-live-2c11/scripts/hetzner-console-planway-kill.sh | bash
```

## Cursor kan

- Ændre tema, sider, plugins (`scripts/wp.sh`)
- Opdatere mu-plugin `wordpress/mu-plugins/praxisos-bridge.php`
- Koble booking/scan/SMS til `app.bypilar.dk`

## DNS (GoDaddy)

```
A   @     → 167.233.171.184
A   www   → 167.233.171.184
A   app   → 167.233.171.184
```

```bash
bash scripts/wp.sh option update siteurl https://bypilar.dk
bash scripts/wp.sh option update home https://bypilar.dk
```

## Vigtigt

- `.env.bypilar-wp` ligger **kun på serveren** (ikke i Git).
- Klinik-OS forbliver på `app.bypilar.dk`.
- Planway-konto slettes ikke — kun indgange fra byPilar fjernes.

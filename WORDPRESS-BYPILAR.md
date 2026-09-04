# by Pilar WordPress (Hetzner) · styret af Cursor

WordPress kører **på samme Hetzner** som PraxisOS. Cursor styrer alt via SSH + WP-CLI.

> **Live note (2026-09):** DNS for `bypilar.dk` may still point at **Hostinger** while Hetzner WP is prepared. Theme source of truth: `wordpress/themes/pilar-theme/`. Planway cutover checklist: [`docs/ops/bypilar-planway-cutover.md`](docs/ops/bypilar-planway-cutover.md).

## Hvad der kører

| Ting | URL / kommando |
|------|----------------|
| WordPress (midlertidig port) | http://167.233.171.184:8088 |
| Efter DNS | https://bypilar.dk (Traefik) |
| PraxisOS klinik | https://app.bypilar.dk |
| Public booking | https://bypilar.dk/booking/ · https://app.bypilar.dk/t/bypilar/book |
| WP-CLI | `bash scripts/wp.sh ...` |
| Deploy | `bash scripts/deploy-bypilar-wp.sh` |

## Cursor kan

- Ændre tema, sider, plugins (`scripts/wp.sh`)
- Opdatere mu-plugin `wordpress/mu-plugins/praxisos-bridge.php` (booking-embed + agenter)
- Koble booking/scan/SMS til PraxisOS (`data-praxis-book` i `pilar-theme/js/main.js`)
- Importere Hostinger-backup (All-in-One / XML / DB)

## Booking cutover (Planway → PraxisOS)

1. Iframe på `/booking/`: **kun** `https://app.bypilar.dk/t/bypilar/book?embed=1` (aldrig `http://` eller Planway).
2. Alle book-knapper: `data-praxis-book` / `data-praxis-book="fod-std"` — **ikke** `bypilar.planway.com`.
3. Efter theme-upload: purge Hostinger/LiteSpeed cache.
4. Eksterne links (Google/IG/SMS): se checklist i `docs/ops/bypilar-planway-cutover.md`.

## Flyt fra Hostinger

1. På Hostinger: eksporter site (All-in-One WP Migration **eller** filer + SQL).
2. Læg filen på serveren, fx `/opt/PraxisOS/import/bypilar.wpress` eller `.zip` + `.sql`.
3. Sig til Cursor: **“importer Hostinger-backup”** — så kører vi import via WP-CLI/plugin.

## DNS (GoDaddy)

```
A   @     → 167.233.171.184
A   www   → 167.233.171.184
A   app   → 167.233.171.184   (PraxisOS — allerede sat)
```

Efter DNS:

```bash
bash scripts/wp.sh option update siteurl https://bypilar.dk
bash scripts/wp.sh option update home https://bypilar.dk
```

## Vigtigt

- `.env.bypilar-wp` ligger **kun på serveren** (ikke i Git) — passwords.
- PraxisOS forbliver på `https://app.bypilar.dk` / port 3010.
- Booking-knapper på WordPress bruger `data-praxis-book` (+ valgfrit `/embed/v1/bypilar`).
- Planway-konto slettes **ikke** i denne cutover — kun link-stop.

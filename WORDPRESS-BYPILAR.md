# by Pilar WordPress (Hetzner) · styret af Cursor

WordPress kører **på samme Hetzner** som PraxisOS. Cursor styrer alt via SSH + WP-CLI.

## Hvad der kører

| Ting | URL / kommando |
|------|----------------|
| WordPress (midlertidig port) | http://167.233.171.184:8088 |
| Efter DNS | http://bypilar.dk (Traefik) |
| PraxisOS klinik | http://app.bypilar.dk |
| WP-CLI | `bash scripts/wp.sh ...` |
| Deploy | `bash scripts/deploy-bypilar-wp.sh` |

## Cursor kan

- Ændre tema, sider, plugins (`scripts/wp.sh`)
- Opdatere mu-plugin `wordpress/mu-plugins/praxisos-bridge.php` (booking-embed + agenter)
- Koble booking/scan/SMS til PraxisOS
- Importere Hostinger-backup (All-in-One / XML / DB)

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
bash scripts/wp.sh option update siteurl http://bypilar.dk
bash scripts/wp.sh option update home http://bypilar.dk
```

## Vigtigt

- `.env.bypilar-wp` ligger **kun på serveren** (ikke i Git) — passwords.
- PraxisOS forbliver på `app.bypilar.dk` / port 3010.
- Booking-knapper på WordPress bruger embed: `/embed/v1/bypilar`.

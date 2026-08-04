# Dittofeed · Marketing automation

Lite stack on `omni_net` with Traefik:

- `engage.praxios.dk`
- `engage.cirkel.dk`
- `engage.dpnnails.dk`

Includes: `dittofeed-lite`, Postgres, ClickHouse, Temporal.

```bash
cd ..
make deploy-dittofeed
```

After first boot, set `BOOTSTRAP=false` in `.env` and recreate the lite service.

Prefer web-push / email / Telegram. SMS is optional.

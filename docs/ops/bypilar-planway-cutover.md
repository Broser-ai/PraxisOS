# by Pilar · Planway → PraxisOS booking cutover

**Status:** Theme cutover committed in `wordpress/themes/pilar-theme` + `wordpress/mu-plugins/praxisos-bridge.php`.  
**Do not** delete or cancel the Planway account yet — only stop linking to it.

## What changed in the theme

| Surface | Before | After |
|---------|--------|--------|
| `/booking/` iframe | `http://app.bypilar.dk/...` (mixed content) or Planway | `https://app.bypilar.dk/t/bypilar/book?embed=1` |
| Hero / popular / treatment CTAs | `https://bypilar.planway.com` | `data-praxis-book` (+ optional service id) |
| `js/main.js` | Nav/scroll only | Click handler → PraxisOS book URL (modal / popup) |
| Bridge default base | `http://app.bypilar.dk` | `https://app.bypilar.dk` |

Canonical public booking URLs:

- Site page: `https://bypilar.dk/booking/`
- Direct app: `https://app.bypilar.dk/t/bypilar/book`
- Embed (iframe): `https://app.bypilar.dk/t/bypilar/book?embed=1`
- With service: `https://app.bypilar.dk/t/bypilar/book?service=fod-std`

## Planway decommission checklist (stop linking only)

Replace every public/outbound link that points at `bypilar.planway.com` (or `planway.com/.../bypilar`) with `https://bypilar.dk/booking/` or `https://app.bypilar.dk/t/bypilar/book`.

- [ ] **Google Business Profile** — website + booking button / appointment link
- [ ] **Google Ads / search ads** (if any final URL = Planway)
- [ ] **Instagram** — bio link, story highlights, Linktree / Later / similar
- [ ] **Facebook** page — about/website + CTA button
- [ ] **SMS templates** (Bird / Planway reminders / clinic short codes) — confirmation & reminder URLs
- [ ] **Email signatures** and Mailchimp / newsletter CTAs
- [ ] **QR codes** (clinic card, window, receipts) — reprint if they encode Planway
- [ ] **Partner / directory listings** (Fodterapeut-forening, local Aarhus lists)
- [ ] **Apple Maps / other maps** booking fields
- [ ] **Staff onboarding docs** — remove “book via Planway” instructions
- [ ] **Verify** `site:bypilar.planway.com` and search for remaining brand mentions; leave account intact for historical bookings until ops confirms export done

### Optional later (not this cutover)

- Export Planway history if needed for accounting
- Pause Planway calendar / auto-replies so no new bookings land there
- Cancel Planway subscription only after 2–4 weeks of zero inbound Planway bookings

## Hostinger deploy steps (live `bypilar.dk`)

Live site still serves theme files from Hostinger (`Apache` · `pilar-theme`). Repo path: `wordpress/themes/pilar-theme/`.

### A · Prefer Hostinger MCP / File Manager

1. Hostinger hPanel → **Websites** → `bypilar.dk` → **File Manager** (or MCP `hosting_deployWordpressTheme`).
2. Upload / overwrite under `public_html/wp-content/themes/pilar-theme/`:
   - `js/main.js`
   - `functions.php` (cache-bust `1.0.2`)
   - `style.css` (Version `1.0.2`)
   - `parts/booking.phpfrag`
   - `parts/hjem.phpfrag`
   - `parts/behandlinger.phpfrag`
   - `parts/udekoerende.phpfrag`
3. If mu-plugin is installed on Hostinger: copy `wordpress/mu-plugins/praxisos-bridge.php` → `wp-content/mu-plugins/praxisos-bridge.php`.
4. Clear cache: LiteSpeed / Hostinger cache purge + hard-refresh.
5. Smoke-test:
   - `https://bypilar.dk/booking/` iframe `src` is **https** (not http)
   - Hero **Book Tid** opens PraxisOS modal / book URL (not Planway)
   - View-source contains **zero** `planway.com` strings
   - Mixed-content console warning gone on `/booking/`

### B · WP-CLI / SSH (if available)

```bash
# From repo root, after SSH into the Hostinger account or Hetzner WP container:
rsync -av wordpress/themes/pilar-theme/ \
  ~/domains/bypilar.dk/public_html/wp-content/themes/pilar-theme/
# or on Hetzner WP stack:
bash scripts/deploy-bypilar-wp.sh
```

### C · Manual page-builder check

If any page was edited in the WP editor (not only theme fragments), search content for `planway` and `http://app.bypilar` and replace.

## Constraints respected

- No clinical policy change
- Planway account **not** destroyed — links removed only
- No secrets committed (`.env.bypilar-wp` stays on server; example uses placeholders)

## Agent deploy status (2026-09-04)

| Layer | Status |
|-------|--------|
| Git theme (`wordpress/themes/pilar-theme/` + `wordpress/bypilar-theme/`) | HTTPS iframe + `data-praxis-book` (no Planway) |
| Live `https://bypilar.dk` | DNS → Hetzner `167.233.171.184`; booking iframe still **`http://`**; `/behandlinger/` + `/udekoerende/` still Planway; live `js/main.js` lacks PraxisOS handler |
| Hostinger WordPress MCP | `listWordPressInstallations` / `listWebsites` / `deployWordpressTheme` **time out**; no file-write path reached |
| Live push | Requires `HETZNER_PRAXIS_SSH_PRIVATE_KEY` → `bash scripts/push-bypilar-theme-live.sh` |

Exact live files to overwrite under `wp-content/themes/pilar-theme/`:

1. `parts/booking.phpfrag` — iframe `src="https://app.bypilar.dk/t/bypilar/book?embed=1"`
2. `parts/behandlinger.phpfrag` — replace Planway `<a href>` with `data-praxis-book` buttons
3. `parts/udekoerende.phpfrag` — same
4. `js/main.js` — PraxisOS click handler (`PRAXIS_BOOK_ORIGIN = https://app.bypilar.dk`)
5. `functions.php` + `style.css` — cache-bust `1.0.2`
6. Optional: `wp-content/mu-plugins/praxisos-bridge.php`


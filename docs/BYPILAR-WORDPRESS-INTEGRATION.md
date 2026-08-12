# byPilar.dk · WordPress / GoDaddy integration

## Kortlagt arkitektur

| Lag | Hvor | Rolle |
|-----|------|--------|
| PraxisOS | Next.js (`app.bypilar.dk`) | **Single source of truth** for behandlinger, priser, booking, klippekort |
| WordPress | `pilar-theme` + mu-plugin `praxisos-bridge.php` | Offentlig hjemmeside med eksisterende PILAR-layout |
| DNS | GoDaddy | `@` / `www` → Hetzner (mål). Historisk Hostinger-IP kan stadig finnes |

**`/t/bypilar` er ikke det samme som `bypilar.dk`.** Begge skal opdateres; de deler data via API/embed.

## Hvad der er implementeret i repo

1. **SoT:** `lib/bypilar-catalog.ts`
2. **API:** `GET /api/v1/bypilar/services` (kun aktive)
3. **Booking:** `/t/bypilar/book?service=fod-std` (+ add-ons)
4. **Klippekort:** `/t/bypilar/klippekort` via `BYPILAR_CLIP_PACKAGES`
5. **WordPress (Hetzner-styret stack i repo):**
   - `[praxis_services]` henter cards fra PraxisOS API
   - `[praxis_vouchers]` viser klippekort + link
   - `[praxis_book service="…"]` + embed-script
   - `/behandlinger/` bruger shortcodes (ikke hardcoded Planway-priser)
   - Forside CTA → PraxisOS booking

## Hvis WordPress stadig kører på GoDaddy/Hostinger (manuel)

Når Hetzner-WP ikke er den offentlige origin endnu:

1. **Side:** Behandlinger (slug `behandlinger`)
2. **Erstat hardcoded prisliste** med shortcode `[praxis_services]` (kræver mu-plugin)
3. **Eller** indsæt script + knapper:

```html
<script src="https://app.bypilar.dk/embed/v1/bypilar" defer></script>
<button data-praxis-book="fod-std">Book fodbehandling · 300 kr</button>
```

4. **Endpoint:** `GET https://app.bypilar.dk/api/v1/bypilar/services`
5. **Booking CTA:** `data-praxis-book="{id}"` eller link  
   `https://app.bypilar.dk/t/bypilar/book?service={id}`
6. **Design:** Bevar `pilar-theme` (Bodoni Moda / Karla, rose/cream) — ikke PraxisOS admin-look

### Fil/plugin der skal ændres (GoDaddy)

| Fil | Handling |
|-----|----------|
| `wp-content/mu-plugins/praxisos-bridge.php` | Upload fra dette repo |
| `wp-content/themes/pilar-theme/` | Synk tema fra repo |
| Side «Behandlinger» | Indhold: `[praxis_services]` + `[praxis_vouchers]` |
| Side «Book Tid» | PraxisOS iframe/embed i stedet for Planway |

## Review-punkter (ikke gættet)

- **Let massage** nævnes i Fodbehandling-tekst og som tilvalg uden pris → `chargeable: false`
- **Neglelak** tilvalg uden godkendt pris → `chargeable: false`
- **Varighed** mangler for flere ydelser → `durationMin` udeladt (vises «Efter aftale»)
- **Lak på tæer** som tilvalg: **49 kr** (godkendt)

## Verifikation

```bash
curl -s https://app.bypilar.dk/api/v1/bypilar/services | jq '.services[].name'
# Forvent: Fodbehandling, Udvidet…, Luksus…, Manicure, Lak på tæer, Aftagning…
# Må IKKE indeholde: Gel manicure, Nail art, Medicinsk fodpleje, Fod-scan
```

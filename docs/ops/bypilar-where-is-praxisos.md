# Where is PraxisOS? · by Pilar map for Michael

**Audience:** Michael (Broser) · by Pilar pilot  
**Rule:** On byPilar customer hosts, **by Pilar ≠ PraxisOS brand**. Customer-facing surfaces stay white-label. Staff login says **Klinik-login · Staff**, never “PraxisOS” on the clinic marketing host.  
**Policy:** `suggestion_only` · no Planway delete · no deploy from this doc (deploy agent owns host).

---

## Hosts

| Host | Role |
|------|------|
| `https://bypilar.dk` / `https://www.bypilar.dk` | WordPress **marketing** (customer website) |
| `https://app.bypilar.dk` | Clinic OS (Next.js) — `/` redirects to `/t/bypilar` |

Always use **HTTPS** in instructions and embed snippets.

---

## Customer (patient / marketing)

| What | Exact URL |
|------|-----------|
| Klinik-forside (white-label) | `https://app.bypilar.dk/t/bypilar` |
| Book tid | `https://app.bypilar.dk/t/bypilar/book` |
| Klippekort | `https://app.bypilar.dk/t/bypilar/klippekort` |
| Gavekort | `https://app.bypilar.dk/t/bypilar/gavekort` |
| Min side · portal | `https://app.bypilar.dk/t/bypilar/portal` |
| Bliv kunde | `https://app.bypilar.dk/t/bypilar/onboarding` |
| WordPress marketing | `https://bypilar.dk` |
| Embed script (WP `<head>`) | `https://app.bypilar.dk/embed/v1/bypilar` |

**WordPress one-liner (HTTPS):**

```html
<script src="https://app.bypilar.dk/embed/v1/bypilar" defer></script>
```

Buttons: `<button data-praxis-book>Book tid</button>`

---

## Staff (clinic OS after login)

| What | Exact URL |
|------|-----------|
| **Klinik-login · Staff** (from footer on `/t/bypilar`) | `https://app.bypilar.dk/login?next=/dashboard` |
| Overblik | `https://app.bypilar.dk/dashboard` |
| Kalender | `https://app.bypilar.dk/kalender` |
| Klienter | `https://app.bypilar.dk/klienter` |
| Journal | `https://app.bypilar.dk/journal` |
| Fod-scan | `https://app.bypilar.dk/scan` |
| Bookings | `https://app.bypilar.dk/bookings` |
| Indstillinger | `https://app.bypilar.dk/indstillinger` |

**Demo login:** `pilar@bypilar.dk` / `demo` → 2FA `123456`

**Discovery path:** `/t/bypilar` → footer **Klinik-login · Staff** → `/login` → `/dashboard` → sidebar.

---

## Admin / Broser

| What | Exact URL |
|------|-----------|
| Master review-hub (bookmark) | `https://app.bypilar.dk/review` |
| Setup navigator (whole map) | `https://app.bypilar.dk/setup` |
| Tenant clinic-setup | `https://app.bypilar.dk/t/bypilar/setup` |
| Admin · produktpakke | `https://app.bypilar.dk/admin/packaging` |
| Admin · staff | `https://app.bypilar.dk/admin/staff` |
| Admin · ydelser | `https://app.bypilar.dk/admin/services` |
| Admin · Bird SMS | `https://app.bypilar.dk/admin/bird` |
| Admin · agents | `https://app.bypilar.dk/admin/agents` |
| Integration · embed docs | `https://app.bypilar.dk/admin/integration/bypilar` |
| Tenants (Broser-only) | `https://app.bypilar.dk/admin/tenants` |
| Health | `https://app.bypilar.dk/admin/health` |

---

## Relative paths (any host with the app)

- Customer: `/t/bypilar`, `/t/bypilar/book`
- Staff entry: `/login?next=/dashboard`
- Clinic OS: `/dashboard` · `/kalender` · `/klienter` · `/journal` · `/scan` · `/admin/*`
- Hub: `/review` · `/setup`

---

## What Michael should *not* expect on byPilar marketing

- PraxisOS B2B landing / pricing / signup chrome on the customer site
- “Log ind i PraxisOS” wording on `/t/bypilar`
- Non-TLS embed URLs for app.bypilar.dk — use `https://` only

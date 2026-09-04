import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenants";
import { BYPILAR_APP_ORIGIN } from "@/lib/bypilar-host";

export default async function IntegrationGuide({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) notFound();

  // byPilar customer instructions always HTTPS. Other tenants use configured public URL.
  const configured = (process.env.PRAXIS_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const origin =
    t.slug === "bypilar"
      ? BYPILAR_APP_ORIGIN
      : configured.startsWith("https://")
        ? configured
        : configured || "http://127.0.0.1:3002";
  const embedSrc = `${origin}/embed/v1/${t.slug}`;
  const firstSvc = t.services[0]?.id ?? "fod-med";

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">
            Integration · {t.brand.name}
          </h1>
          <p className="mt-2 text-[14px] text-muted">
            Headless · {t.brand.name}s eget website bruger PraxisOS som backend. Tre integrations-niveauer.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/demo/bypilar-website`} target="_blank" className="btn btn-ghost">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            Se live demo →
          </Link>
          <Link href={`/t/${t.slug}`} target="_blank" className="btn btn-ghost">Hostet frontend →</Link>
        </div>
      </div>

      {/* Niveau 1 */}
      <Section number="1" title="Embed-snippet · 1 linje" minutes={2}>
        <P>Sæt denne i kundens <code>&lt;head&gt;</code>. Alle knapper med <code>data-praxis-book</code> åbner nu en booking-modal:</P>
        <Code>{`<script src="${embedSrc}" defer></script>

<!-- en knap til standard-flow: -->
<button data-praxis-book>Book tid</button>

<!-- direkte til specifik ydelse: -->
<button data-praxis-book="${firstSvc}">Book ${t.services[0]?.name.toLowerCase()}</button>

<!-- åbn i nyt vindue i stedet for modal: -->
<a data-praxis-book="${firstSvc}" data-praxis-mode="popup">Book i nyt vindue</a>`}</Code>
        <P><b>Det er det.</b> Ingen build-step, ingen API-keys, ingen kode-ændring i deres backend.</P>
      </Section>

      {/* Niveau 2 */}
      <Section number="2" title="Programmatisk · åbn fra deres egen JS" minutes={5}>
        <P>Når scriptet er loaded eksponeres <code>window.PraxisOS</code>:</P>
        <Code>{`// Åbn modal med en specifik ydelse
PraxisOS.open("fod-scan");

// Luk modal programmatisk
PraxisOS.close();

// Tenant-info
console.log(PraxisOS.tenant); // "${t.slug}"`}</Code>
      </Section>

      {/* Niveau 3 */}
      <Section number="3" title="Headless API · byg eget UI ovenpå" minutes={20}>
        <P>Hvis kunden vil bygge helt eget booking-flow direkte i deres egen design-system, kalder de API'et:</P>

        <SubH>Hent ydelser</SubH>
        <Code>{`GET ${origin}/api/v1/${t.slug}/services

→ {
  "tenant": { "slug": "${t.slug}", "name": "${t.brand.name}", "currency": "${t.currency}" },
  "services": [
    { "id": "${firstSvc}", "name": "${t.services[0]?.name}", "durationMin": ${t.services[0]?.durationMin}, "price": ${t.services[0]?.priceKr}, ... }
  ]
}`}</Code>

        <SubH>Hent ledige tider</SubH>
        <Code>{`GET ${origin}/api/v1/${t.slug}/availability?service=${firstSvc}&days=7

→ {
  "service": { "id": "${firstSvc}", "name": "${t.services[0]?.name}", "durationMin": ${t.services[0]?.durationMin} },
  "timezone": "${t.timezone}",
  "slots": [
    { "day": "2026-06-09", "times": ["09:00", "10:30", "12:00", ...] },
    { "day": "2026-06-10", "times": [...] }
  ]
}`}</Code>

        <SubH>Opret booking</SubH>
        <Code>{`POST ${origin}/api/v1/${t.slug}/bookings
Content-Type: application/json
Idempotency-Key: <uuid>   ← anbefales, sikrer at retry ikke skaber dubletter

{
  "serviceId": "${firstSvc}",
  "startsAt": "2026-06-12T14:00:00+02:00",
  "modality": "Klinik",
  "client": { "name": "Jane Doe", "email": "jane@example.com", "phone": "+45 12 34 56 78" }
}

→ 201 {
  "id": "bk_abc123",
  "status": "confirmed",
  "receiptUrl": "/r/bk_abc123",
  "aria": { "reminderScheduled": true, "message": "Bekræftelse sendt. SMS-påmindelse 24 t før." }
}`}</Code>
      </Section>

      <div className="card mt-3 p-5">
        <div className="kicker">License-gate</div>
        <P className="!mt-2">
          Kald til moduler kunden ikke har licens til returnerer <code>402 Payment Required</code> med
          upgrade-link. Bypilar har p.t. <b>{t.license.modules.length}</b> ud af 11 moduler aktiveret.
          Fod-scan-modulet (Physical AI) er klar som premium upsell — kræver kun toggle + hardware-bundle.
        </P>
      </div>
    </div>
  );
}

function Section({ number, title, minutes, children }: { number: string; title: string; minutes: number; children: React.ReactNode }) {
  return (
    <section className="card rise mt-4 p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-ink text-paper mono text-[13px]">{number}</div>
        <h2 className="display text-[20px] font-semibold leading-none">{title}</h2>
        <span className="chip ml-auto mono !text-[10.5px]">~{minutes} min</span>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`mt-3 text-[13.5px] leading-relaxed text-ink-soft ${className}`}>{children}</p>;
}

function SubH({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 kicker">{children}</div>;
}

function Code({ children }: { children: string }) {
  return (
    <pre className="scrollbar-thin mt-3 overflow-x-auto rounded-[10px] bg-ink p-4 text-paper">
      <code className="mono text-[12px] leading-relaxed">{children}</code>
    </pre>
  );
}

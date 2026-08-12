import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveServices, getTenant } from "@/lib/tenants";

export default async function TenantHome({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) notFound();
  const services = getActiveServices(t);

  return (
    <div className="mx-auto max-w-[1100px]">
      <section className="rise">
        <div className="kicker">{t.brand.tagline}</div>
        <h1 className="display mt-3 text-[44px] font-semibold leading-[1.05]" style={{ maxWidth: 720 }}>
          {t.brand.name} — fodpleje og <em style={{ color: "var(--brand-accent)" }}>forkælelse</em>,
          uden ventetid.
        </h1>
        <p className="mt-4 max-w-[620px] text-[15px] text-muted">
          {t.stats?.clients?.toLocaleString("da-DK")}+ tilfredse kunder · {t.stats?.rating}★ · {t.stats?.yearsOperating} år i {t.contact.address.split(",")[0]}.
        </p>
        <div className="mt-6 flex gap-2">
          <Link
            href={`/t/${t.slug}/book`}
            className="rounded-[10px] px-5 py-2.5 text-[14px] font-medium"
            style={{ background: "var(--brand-ink)", color: "var(--brand-paper)" }}
          >
            Book tid
          </Link>
          <Link
            href={`/t/${t.slug}/klippekort`}
            className="rounded-[10px] border border-line px-5 py-2.5 text-[14px] font-medium"
          >
            Klippekort
          </Link>
          <a
            href={`/api/v1/${t.slug}/services`}
            target="_blank"
            className="rounded-[10px] border border-line px-5 py-2.5 text-[14px] font-medium"
          >
            API · /v1/services
          </a>
        </div>
      </section>

      <section className="stagger mt-14 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <div key={s.id} className="rounded-[14px] border border-line bg-white/40 p-5 backdrop-blur">
            <div className="kicker">{s.category}</div>
            <h3 className="display mt-2 text-[20px] font-semibold leading-tight">{s.name}</h3>
            <p className="mt-2 text-[13px] text-muted">{s.shortDescription ?? s.description}</p>
            <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
              <div className="mono text-[12px] text-muted">
                {s.durationMin != null ? `${s.durationMin} min` : "Efter aftale"}
                {" · "}
                {s.modality.join(" · ")}
              </div>
              <div className="display text-[17px] font-semibold">{s.priceKr} kr</div>
            </div>
            <Link
              href={`/t/${t.slug}/book?service=${s.id}`}
              className="mt-4 inline-flex w-full items-center justify-center rounded-[10px] px-4 py-2 text-[13px] font-medium"
              style={{ background: "var(--brand-accent)", color: "var(--brand-paper)" }}
            >
              Book tid
            </Link>
          </div>
        ))}
      </section>

      <section className="mt-14 rounded-[14px] border border-line bg-white/40 p-6">
        <div className="kicker">PraxisOS · til udviklere</div>
        <h2 className="display mt-2 text-[22px] font-semibold">Headless API til {t.brand.name}</h2>
        <p className="mt-2 max-w-[620px] text-[13.5px] text-muted">
          {t.brand.name}s eget website kalder PraxisOS direkte. Embed en booking-knap, eller hent ydelser og
          ledige tider som JSON. CORS-åbnet for jeres domæner.
        </p>
        <div className="scrollbar-thin mt-3 overflow-x-auto rounded-[10px] bg-ink text-paper">
          <pre className="mono p-4 text-[12px] leading-relaxed"><code>{`# Hent ydelser
curl https://localhost:3001/api/v1/${t.slug}/services

# Hent ledige tider
curl "https://localhost:3001/api/v1/${t.slug}/availability?service=${services[0]?.id ?? "fod-std"}&days=5"

# Opret booking
curl -X POST https://localhost:3001/api/v1/${t.slug}/bookings \\
  -H "content-type: application/json" \\
  -H "idempotency-key: $(uuidgen)" \\
  -d '{
    "serviceId": "${services[0]?.id ?? "fod-std"}",
    "startsAt": "2026-06-12T14:00:00+02:00",
    "modality": "Klinik",
    "client": { "name": "Jane Doe", "email": "jane@example.com", "phone": "+45 12 34 56 78" }
  }'`}</code></pre>
        </div>
      </section>
    </div>
  );
}

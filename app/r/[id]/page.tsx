import { notFound } from "next/navigation";
import { getBooking } from "@/lib/bookings";
import { getTenant } from "@/lib/tenants";

export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = getBooking(id);
  if (!b) notFound();
  const t = getTenant(b.tenant);

  const d = new Date(b.startsAt);
  const date = d.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  const ends = new Date(d.getTime() + b.durationMin * 60_000).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen" style={{ background: t?.brand.paper ?? "#f7f3ec", color: t?.brand.ink ?? "#1b1a17" }}>
      <div className="mx-auto max-w-[640px] px-6 py-12 sm:py-20">
        {/* Logo / brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="grid h-10 w-10 place-items-center rounded-full text-[14px] font-semibold"
            style={{ background: t?.brand.ink ?? "#1b1a17", color: t?.brand.paper ?? "#f7f3ec" }}
          >
            {(t?.brand.name ?? "P").charAt(0)}
          </div>
          <div className="leading-tight">
            <div className="display text-[18px] font-semibold">{t?.brand.name}</div>
            <div className="text-[11px]" style={{ color: t?.brand.secondary }}>{t?.brand.tagline}</div>
          </div>
        </div>

        {/* Check-mark */}
        <div className="mt-10 grid h-14 w-14 place-items-center rounded-full" style={{ background: "color-mix(in srgb, var(--color-signal) 14%, transparent)", color: "var(--color-signal)" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10"/></svg>
        </div>
        <h1 className="display mt-5 text-[32px] font-semibold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          Tak — vi ses!
        </h1>
        <p className="mt-2.5 max-w-[440px] text-[14px]" style={{ color: t?.brand.secondary }}>
          Din booking er bekræftet. Du modtager en SMS-påmindelse 24 timer før din tid.
        </p>

        {/* Booking-detalje */}
        <div className="mt-8 overflow-hidden rounded-[14px] border border-line bg-white/40">
          <div className="px-6 py-5">
            <div className="kicker !text-[9.5px]">Booking</div>
            <div className="display mt-1.5 text-[22px] font-semibold">{b.service}</div>
            <div className="mt-1 text-[12.5px]" style={{ color: t?.brand.secondary }}>med {b.practitioner} · {b.modality}</div>
          </div>
          <div className="border-t border-line bg-paper-2/40 px-6 py-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
              <Row label="Dato" value={date} />
              <Row label="Tid" value={`${time} – ${ends}`} />
              <Row label="Varighed" value={`${b.durationMin} min`} />
              <Row label="Pris" value={`${b.priceKr} kr`} />
            </div>
          </div>
          <div className="border-t border-line px-6 py-4 text-[12px]" style={{ color: t?.brand.secondary }}>
            <span className="kicker !text-[9.5px]">Booking-id</span>
            <div className="mono mt-1 text-[13px]" style={{ color: t?.brand.ink }}>{b.id}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            className="flex-1 rounded-[10px] px-5 py-3 text-[13.5px] font-medium"
            style={{ background: t?.brand.ink ?? "#1b1a17", color: t?.brand.paper ?? "#f7f3ec" }}
          >
            Tilføj til kalender
          </button>
          <button
            className="rounded-[10px] border px-5 py-3 text-[13.5px] font-medium"
            style={{ borderColor: t?.brand.ink ?? "#1b1a17" }}
          >
            Ombook / aflys
          </button>
        </div>

        {/* Kontakt */}
        <div className="mt-10 border-t border-line pt-6 text-[12px]" style={{ color: t?.brand.secondary }}>
          <div>Spørgsmål? Kontakt {t?.brand.name}:</div>
          <div className="mt-1.5">{t?.contact.email} · {t?.contact.phone}</div>
          <div className="mt-1.5">{t?.contact.address}{t?.contact.cvr ? ` · CVR ${t.contact.cvr}` : ""}</div>
        </div>

        <div className="mt-8 text-center text-[10.5px]" style={{ color: t?.brand.secondary, opacity: 0.6 }}>
          ⚡ drevet af PraxisOS · EU-data · GDPR Art. 9
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="kicker !text-[9px]">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

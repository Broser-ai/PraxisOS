import Link from "next/link";
import { notFound } from "next/navigation";
import { findVoucherByCode } from "@/lib/vouchers";

export default async function VoucherDetail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const v = findVoucherByCode(decodeURIComponent(code));
  if (!v) notFound();

  const usedSessions = (v.sessionsTotal ?? 0) - (v.sessionsRemaining ?? 0);
  const usedKr = v.kind === "gift" ? ((v.originalBalanceOere ?? 0) - (v.balanceOere ?? 0)) / 100 : 0;
  const progressPct = v.kind === "clip"
    ? Math.round((usedSessions / (v.sessionsTotal ?? 1)) * 100)
    : Math.round((usedKr / (v.priceKr || 1)) * 100);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/vouchers" className="kicker hover:underline">← Vouchers</Link>
          <h1 className="display mt-2 text-[26px] font-semibold leading-tight">{v.kind === "clip" ? v.serviceName : "Gavekort"}</h1>
          <div className="mt-2 mono text-[14px] font-semibold">{v.code}</div>
        </div>
        <span className={`chip !py-1 ${
          v.status === "active" ? "!border-signal/40 text-signal" :
          v.status === "expired" ? "!border-clay/40 text-clay" : "text-muted"
        }`}>
          {v.status === "active" ? "Aktiv" : v.status === "expired" ? "Udløbet" : v.status}
        </span>
      </div>

      {/* Balance */}
      <section className="card rise mt-6 p-6" style={{ animationDelay: "0.06s" }}>
        <div className="flex items-end justify-between">
          <div>
            <div className="kicker">Aktuel saldo</div>
            <div className="display mt-1.5 text-[36px] font-semibold leading-none">
              {v.kind === "clip"
                ? <>{v.sessionsRemaining}<span className="ml-2 text-[16px] text-muted font-normal">af {v.sessionsTotal} sessioner</span></>
                : <>{((v.balanceOere ?? 0) / 100).toFixed(2)}<span className="ml-1 text-[16px] text-muted font-normal">kr</span></>
              }
            </div>
            <div className="mt-1 mono text-[11.5px] text-faint">
              {v.kind === "clip" ? `${usedSessions} brugt` : `${usedKr.toFixed(2)} kr brugt`} · af {v.kind === "clip" ? `${v.sessionsTotal} totalt` : `${(v.originalBalanceOere! / 100).toFixed(2)} kr oprindeligt`}
            </div>
          </div>
          <div className="text-right">
            <div className="kicker">Udløber</div>
            <div className="mt-1 mono text-[14px]">{new Date(v.expiresAt).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-paper-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
        </div>
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* Indløsningshistorik */}
        <section className="card rise p-5" style={{ animationDelay: "0.1s" }}>
          <h2 className="display text-[17px] font-semibold">Indløsninger</h2>
          {v.redemptions.length === 0 ? (
            <div className="mt-4 py-6 text-center text-[12.5px] text-faint">Ingen indløsninger endnu</div>
          ) : (
            <div className="mt-4 flex flex-col">
              {v.redemptions.map((r, i) => (
                <Link
                  key={i}
                  href={`/bookings/${r.bookingId}`}
                  className="grid grid-cols-[100px_1fr_auto] gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 hover:bg-paper-2 -mx-2 px-2 rounded-md"
                >
                  <span className="mono text-[11.5px] text-faint">
                    {new Date(r.at).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
                  </span>
                  <span className="text-[13px] font-medium">{r.serviceName}</span>
                  <span className="mono text-[12px]">
                    {r.sessionsUsed ? `−${r.sessionsUsed} session` : `−${((r.amountUsedOere ?? 0) / 100).toFixed(2)} kr`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Detalje */}
        <section className="card rise p-5" style={{ animationDelay: "0.14s" }}>
          <h2 className="display text-[17px] font-semibold">Detalje</h2>
          <div className="mt-4 flex flex-col gap-3 text-[12.5px]">
            <Row label="Køber">{v.buyer.name}<div className="text-faint">{v.buyer.email}</div></Row>
            {v.recipient && (
              <Row label="Modtager">{v.recipient.name}<div className="text-faint">{v.recipient.email}</div></Row>
            )}
            {v.message && (
              <Row label="Hilsen"><em className="text-ink-soft">«{v.message}»</em></Row>
            )}
            <Row label="Købt">{new Date(v.issuedAt).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}</Row>
            <Row label="Betalt">{v.priceKr.toLocaleString("da-DK")} kr</Row>
            {v.discountPct > 0 && <Row label="Rabat">−{v.discountPct}% · sparet {(v.faceValueKr - v.priceKr).toLocaleString("da-DK")} kr</Row>}
            <Row label="Moms">{v.vatRateBp === 0 ? "Momsfritaget · sundhedsydelse" : `${v.vatRateBp / 100}% · trækkes ved indløsning`}</Row>
          </div>
        </section>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-ghost">Send gen-mail med kode</button>
        <button className="btn btn-ghost">Print som PDF</button>
        <button className="btn btn-ghost text-clay">Annullér voucher</button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-2.5 first:border-t-0 first:pt-0">
      <div className="kicker !text-[9px]">{label}</div>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}

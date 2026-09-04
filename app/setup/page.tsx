import Link from "next/link";
import { headers } from "next/headers";
import { isBypilarHost } from "@/lib/bypilar-host";

const CLINIC_OS = [
  { href: "/dashboard", title: "Overblik", body: "Dagens bookinger, belægning og genveje." },
  { href: "/kalender", title: "Kalender", body: "Uge-/dagsplan for behandlere." },
  { href: "/klienter", title: "Klienter", body: "Klientkort, historik og kontakt." },
  { href: "/journal", title: "Journal", body: "Kliniske noter (suggestion_only · ingen auto-sign)." },
  { href: "/scan", title: "Fod-scan", body: "Nexus / Physical AI scan-flow." },
  { href: "/admin/packaging", title: "Admin", body: "Produktpakke, staff, ydelser, indstillinger." },
];

const OPS_STEPS = [
  {
    n: "01",
    title: "Server",
    body: "Hetzner kører Docker: app + agent-worker. Alt hostes hos dig.",
  },
  {
    n: "02",
    title: "Bird SMS",
    body: "SMS-kanal på +45 26 32 52 20. Nøgle sættes i .env.production.",
  },
  {
    n: "03",
    title: "AI-agenter",
    body: "12 workflows kører automatisk (booking, tilskud, recall, compliance…). OPENAI_API_KEY er valgfri.",
  },
  {
    n: "04",
    title: "Test",
    body: "Åbn /admin/agents/automation og tryk «Kør alle workflows». Test SMS under /admin/bird.",
  },
];

export default async function SetupPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const onBypilar = isBypilarHost(host);

  return (
    <main className="bg-grain min-h-screen">
      <div className="mx-auto max-w-[980px] px-5 py-12 md:py-16">
        <p className="kicker">{onBypilar ? "by Pilar · klinik-system" : "PraxisOS · selvhostet"}</p>
        <h1 className="display mt-3 max-w-[18ch] text-[42px] font-semibold leading-[0.95] md:text-[56px]">
          {onBypilar ? "Hele klinik-setuppet" : "bypilar på egen server"}
        </h1>
        <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted">
          {onBypilar
            ? "Efter Klinik-login kan du åbne hele programmet herfra — overblik, kalender, klienter, journal, scan og admin."
            : "Klinik-system + Bird SMS + automatiske AI-agenter. Ét Docker-setup på din Hetzner."}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login?next=/dashboard" className="btn btn-primary">
            Klinik-login · Staff
          </Link>
          <Link href="/dashboard" className="btn btn-ghost">
            Overblik
          </Link>
          <Link href="/t/bypilar" className="btn btn-ghost">
            Kunde-forside
          </Link>
          <Link href="/review" className="btn btn-ghost">
            Master-hub
          </Link>
        </div>

        <section className="mt-10">
          <div className="kicker mb-3">Klinik-OS · navigér efter login</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CLINIC_OS.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="card block p-5 transition-colors hover:border-ink/30"
              >
                <h2 className="display text-[20px] font-semibold">{m.title}</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{m.body}</p>
                <div className="mt-3 mono text-[11px] text-faint">{m.href}</div>
              </Link>
            ))}
          </div>
        </section>

        {!onBypilar && (
          <>
            <div className="mt-10 grid gap-3 md:grid-cols-2">
              {OPS_STEPS.map((s) => (
                <article key={s.n} className="card p-5">
                  <div className="mono text-[11px] text-faint">{s.n}</div>
                  <h2 className="display mt-1 text-[22px] font-semibold">{s.title}</h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.body}</p>
                </article>
              ))}
            </div>

            <section className="card mt-3 p-5">
              <div className="kicker">Deploy-kommando</div>
              <pre className="mt-3 overflow-x-auto rounded-[10px] bg-ink px-4 py-3 mono text-[12px] leading-relaxed text-paper">
{`ssh root@167.233.171.184
cd /opt/PraxisOS
# rediger .env.production · BIRD_API_KEY (+ valgfri OPENAI_API_KEY)
bash scripts/deploy-hetzner.sh`}
              </pre>
            </section>
          </>
        )}

        {onBypilar && (
          <section className="card mt-6 p-5">
            <div className="kicker">Hurtig sti for Michael</div>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] text-muted">
              <li>
                Åbn kunde-forsiden: <span className="mono text-ink">/t/bypilar</span>
              </li>
              <li>
                Footer → <strong>Klinik-login · Staff</strong> → <span className="mono text-ink">/login</span>
              </li>
              <li>
                Demo: <span className="mono text-ink">pilar@bypilar.dk</span> / <span className="mono text-ink">demo</span> → 2FA{" "}
                <span className="mono text-ink">123456</span>
              </li>
              <li>Land på overblik, brug sidebar til kalender · klienter · journal · scan · admin</li>
            </ol>
            <p className="mt-4 text-[12px] text-faint">
              Se også <span className="mono">docs/ops/bypilar-where-is-praxisos.md</span>
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

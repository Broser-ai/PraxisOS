import Link from "next/link";

const STEPS = [
  {
    n: "01",
    title: "Server",
    body: "Hetzner kører Docker: PraxisOS-app + agent-worker. Alt — inkl. Nexus-scan — hostes hos dig.",
  },
  {
    n: "02",
    title: "Bird SMS",
    body: "SMS-kanal på +45 26 32 52 20. Nøgle sættes via /admin/bird (ingen rebuild).",
  },
  {
    n: "03",
    title: "AI + Nexus",
    body: "Agenter + 4D fod-scan kører i samme app. Worker booter ARIA/LUNA automatisk hvert tick.",
  },
  {
    n: "04",
    title: "Test",
    body: "Åbn /scan og tryk «Kør Alpha-scan». Test SMS under /admin/bird. Workflows under /admin/agents/automation.",
  },
];

export default function SetupPage() {
  return (
    <main className="bg-grain min-h-screen">
      <div className="mx-auto max-w-[980px] px-5 py-12 md:py-16">
        <p className="kicker">PraxisOS · selvhostet</p>
        <h1 className="display mt-3 max-w-[16ch] text-[42px] font-semibold leading-[0.95] md:text-[56px]">
          bypilar på egen server
        </h1>
        <p className="mt-4 max-w-[48ch] text-[16px] leading-relaxed text-muted">
          Klinik-system + Bird SMS + AI-agenter + 4D fod-scan. Ét Docker-setup — intet at køre
          ved siden af.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/scan" className="btn btn-primary">
            Fod-scan · by Pilar
          </Link>
          <Link href="/t/bypilar/book" className="btn btn-ghost">
            Book tid
          </Link>
          <Link href="/admin/bird" className="btn btn-ghost">
            Bird SMS
          </Link>
          <Link href="/admin/agents/automation" className="btn btn-ghost">
            Agenter
          </Link>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {STEPS.map((s) => (
            <article key={s.n} className="card p-5">
              <div className="mono text-[11px] text-faint">{s.n}</div>
              <h2 className="display mt-1 text-[22px] font-semibold">{s.title}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.body}</p>
            </article>
          ))}
        </div>

        <section className="card mt-3 p-5">
          <div className="kicker">by Pilar · live</div>
          <p className="mt-2 text-[14px] text-muted">
            Klinik-OS:{" "}
            <a className="text-accent hover:underline" href="http://app.bypilar.dk">
              app.bypilar.dk
            </a>
            {" · "}
            Fod-scan:{" "}
            <a className="text-accent hover:underline" href="http://app.bypilar.dk/scan">
              /scan
            </a>
            {" · "}
            Booking:{" "}
            <a className="text-accent hover:underline" href="http://app.bypilar.dk/t/bypilar/book">
              /t/bypilar/book
            </a>
          </p>
          <div className="kicker mt-5">Deploy-kommando</div>
          <pre className="mt-3 overflow-x-auto rounded-[10px] bg-ink px-4 py-3 mono text-[12px] leading-relaxed text-paper">
{`ssh root@167.233.171.184
cd /opt/PraxisOS
bash scripts/deploy-hetzner.sh
# Åbn http://app.bypilar.dk/scan`}
          </pre>
        </section>
      </div>
    </main>
  );
}

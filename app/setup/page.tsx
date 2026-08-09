import Link from "next/link";

const STEPS = [
  {
    n: "01",
    title: "Server",
    body: "Hetzner kører Docker. PraxisOS + Bird SMS hostes hos dig — ikke hos Vercel.",
  },
  {
    n: "02",
    title: "Bird",
    body: "SMS-kanal på +45 26 32 52 20. Nøgle bypilar_PraxisOS-SMS sættes i .env.production.",
  },
  {
    n: "03",
    title: "Test",
    body: "Åbn /admin/bird og send en prøve-SMS til dig selv.",
  },
  {
    n: "04",
    title: "Klinik",
    body: "Bookinger, klienter og kalender i PraxisOS. WordPress senere til knap på bypilar.dk.",
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
          Ét setup: klinik-system + Bird SMS. Ingen Erxes-abonnementer. Alt kører på din Hetzner.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/admin/bird" className="btn btn-primary">
            Åbn Bird setup
          </Link>
          <Link href="/dashboard" className="btn btn-ghost">
            Gå til klinik
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
          <div className="kicker">Deploy-kommando</div>
          <pre className="mt-3 overflow-x-auto rounded-[10px] bg-ink px-4 py-3 mono text-[12px] leading-relaxed text-paper">
{`ssh root@167.233.171.184
cd /opt/PraxisOS
# rediger .env.production · indsæt BIRD_API_KEY
bash scripts/deploy-hetzner.sh`}
          </pre>
        </section>
      </div>
    </main>
  );
}

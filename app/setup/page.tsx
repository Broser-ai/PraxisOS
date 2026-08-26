import Link from "next/link";

const STEPS = [
  {
    n: "01",
    title: "Server",
    body: "Hetzner kører Docker: PraxisOS-app + agent-worker. Alt hostes hos dig.",
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

export default function SetupPage() {
  return (
    <main className="bg-grain min-h-screen">
      <div className="mx-auto max-w-[980px] px-5 py-12 md:py-16">
        <p className="kicker">PraxisOS · selvhostet</p>
        <h1 className="display mt-3 max-w-[16ch] text-[42px] font-semibold leading-[0.95] md:text-[56px]">
          bypilar på egen server
        </h1>
        <p className="mt-4 max-w-[48ch] text-[16px] leading-relaxed text-muted">
          Klinik-system + Bird SMS + automatiske AI-agenter. Ét Docker-setup på din Hetzner.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/admin/agents/automation" className="btn btn-primary">
            Agent-automation
          </Link>
          <Link href="/admin/bird" className="btn btn-ghost">
            Bird SMS
          </Link>
          <Link href="/dashboard" className="btn btn-ghost">
            Klinik
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
# rediger .env.production · BIRD_API_KEY (+ valgfri OPENAI_API_KEY)
bash scripts/deploy-hetzner.sh`}
          </pre>
        </section>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { listApiKeys, SCOPE_LABEL, webhookSubs, type ApiKeyScope } from "@/lib/api-keys";
import { listTenants } from "@/lib/tenants";

const ENDPOINTS = [
  { method: "GET",  path: "/api/v1/{tenant}/services",        desc: "Liste over ydelser med priser",            auth: false },
  { method: "GET",  path: "/api/v1/{tenant}/availability",    desc: "Ledige tider · ?service=X&days=7",         auth: false },
  { method: "POST", path: "/api/v1/{tenant}/bookings",        desc: "Opret booking",                            auth: false },
  { method: "GET",  path: "/api/v1/{tenant}/bookings/list",   desc: "Liste over bookings · ?limit=25",          auth: true },
  { method: "GET",  path: "/api/v1/{tenant}/clients",         desc: "Liste over klienter",                      auth: true },
  { method: "POST", path: "/api/v1/{tenant}/clients",         desc: "Opret klient",                             auth: true },
  { method: "GET",  path: "/api/v1/{tenant}/lookup",          desc: "Lookup klient · subsidies · vouchers",     auth: false },
  { method: "GET",  path: "/api/v1/{tenant}/voucher",         desc: "Validér voucher-kode",                     auth: false },
  { method: "POST", path: "/api/events",                      desc: "Intern event-bus · publish event",         auth: true },
  { method: "GET",  path: "/api/events",                      desc: "Læs eventlog · ?tenant=X&type=Y",          auth: true },
];

export default function ApiAdmin() {
  const tenants = listTenants();
  const [activeTenant, setActiveTenant] = useState(tenants[0].slug);
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const keys = listApiKeys(activeTenant);
  const hooks = webhookSubs.filter((w) => w.tenant === activeTenant);

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Universal API</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            REST API til at koble PraxisOS sammen med hvilket som helst system.
            Bearer-token auth · 600 req/min default · webhooks via HMAC.
          </p>
        </div>
        <button className="btn btn-primary">+ Ny API-key</button>
      </div>

      {/* Tenant-vælger */}
      <div className="rise mt-6 flex flex-wrap gap-2">
        {tenants.map((t) => (
          <button
            key={t.slug}
            onClick={() => setActiveTenant(t.slug)}
            className="flex items-center gap-2.5 rounded-[10px] border px-3 py-2"
            style={{
              borderColor: activeTenant === t.slug ? "var(--color-ink)" : "var(--color-line-2)",
              background: activeTenant === t.slug ? "var(--color-paper-2)" : "var(--color-card)",
            }}
          >
            <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold" style={{ background: t.brand.ink, color: t.brand.paper }}>
              {t.brand.name.charAt(0)}
            </span>
            <span className="text-[13px] font-medium">{t.brand.name}</span>
          </button>
        ))}
      </div>

      {/* API-keys */}
      <section className="card rise mt-3 overflow-hidden p-0" style={{ animationDelay: "0.06s" }}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="display text-[17px] font-semibold">API-keys · {keys.filter((k) => k.status === "active").length} aktive</h2>
          <span className="mono text-[11px] text-faint">Bearer-auth · rate-limit pr. key</span>
        </div>
        <div className="flex flex-col">
          {keys.map((k) => {
            const totalReq = k.recentUsage.reduce((s, u) => s + u.count, 0);
            const max = Math.max(...k.recentUsage.map((u) => u.count), 1);
            return (
              <div key={k.id} className="border-t border-line px-5 py-4 first:border-t-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold">{k.name}</span>
                      <span className={`chip !py-0 !text-[9.5px] ${k.status === "active" ? "!border-signal/40 text-signal" : "text-faint"}`}>{k.status}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="mono rounded-[6px] bg-paper-2 px-2 py-0.5 text-[11px]">{k.prefix}</code>
                      <button
                        onClick={() => setShowSecret(showSecret === k.id ? null : k.id)}
                        className="text-[10.5px] text-accent hover:underline"
                      >
                        {showSecret === k.id ? "Skjul secret" : "Vis secret"}
                      </button>
                    </div>
                    {showSecret === k.id && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <code className="mono rounded-[6px] border border-clay/40 bg-clay/[0.06] px-2 py-0.5 text-[11px] text-clay">{k.hashedSecret}</code>
                        <span className="text-[10px] text-faint">⚠ vises kun her — kopiér nu</span>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <span key={s} className="rounded-full border border-line-2 px-1.5 py-0 text-[9.5px] text-muted">{SCOPE_LABEL[s as ApiKeyScope]}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="mono text-[11px] text-faint">rate-limit</div>
                    <div className="mono text-[13px] font-semibold">{k.rateLimit}/min</div>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="rounded-[8px] border border-line-2 px-3 py-1 text-[11.5px] text-muted hover:bg-paper-2">Rediger</button>
                    {k.status === "active" && <button className="rounded-[8px] border border-clay/40 px-3 py-1 text-[11.5px] text-clay hover:bg-clay/[0.06]">Tilbagekald</button>}
                  </div>
                </div>

                {/* Usage chart */}
                <div className="mt-3">
                  <div className="flex items-end gap-1 h-12">
                    {k.recentUsage.map((u) => (
                      <div key={u.date} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                        <div className="w-full rounded-[3px]" style={{ height: `${(u.count / max) * 100}%`, background: "var(--color-accent)" }} />
                        <div className="mono text-[8px] text-faint">{u.date.slice(-2)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10.5px] text-faint">
                    <span>{totalReq.toLocaleString("da-DK")} req · 7 dage</span>
                    <span>seneste: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("da-DK") : "—"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Endpoints */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.1s" }}>
        <h2 className="display text-[17px] font-semibold">Endpoints</h2>
        <p className="mt-1 text-[12.5px] text-muted">{ENDPOINTS.length} endpoints · OpenAPI 3.1 spec tilgængelig på <code className="mono">/api/v1/openapi.json</code></p>
        <div className="mt-4 overflow-hidden rounded-[10px] border border-line">
          {ENDPOINTS.map((e, i) => (
            <div key={e.path} className={`grid grid-cols-[60px_1fr_auto] items-center gap-3 px-4 py-2.5 text-[12px] ${i > 0 ? "border-t border-line" : ""}`}>
              <span
                className="mono inline-block rounded-[5px] px-2 py-0.5 text-center text-[10.5px] font-semibold"
                style={{
                  background: e.method === "GET" ? "color-mix(in srgb, var(--color-signal) 14%, transparent)" : "color-mix(in srgb, var(--color-accent) 14%, transparent)",
                  color: e.method === "GET" ? "var(--color-signal)" : "var(--color-accent)",
                }}
              >
                {e.method}
              </span>
              <div>
                <code className="mono text-[12px]">{e.path}</code>
                <div className="text-[10.5px] text-faint">{e.desc}</div>
              </div>
              {e.auth ? (
                <span className="mono text-[10px] text-clay">🔒 auth</span>
              ) : (
                <span className="mono text-[10px] text-signal">åben</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Webhooks */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.14s" }}>
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] font-semibold">Webhook-abonnementer</h2>
          <button className="rounded-[8px] border border-line-2 px-3 py-1.5 text-[11.5px] hover:bg-paper-2">+ Tilføj webhook</button>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {hooks.map((w) => (
            <div key={w.id} className="rounded-[11px] border border-line bg-paper p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <code className="mono text-[12px] break-all">{w.url}</code>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {w.events.map((e) => (
                      <span key={e} className="mono rounded-[5px] bg-paper-2 px-1.5 py-0 text-[10px] text-muted">{e}</span>
                    ))}
                  </div>
                  <div className="mt-2 text-[10.5px] text-faint">
                    HMAC-secret: <code className="mono">{w.hmacSecret}</code>
                    {w.lastDeliveryAt && (
                      <span className="ml-3">
                        Seneste: <span className="mono">{new Date(w.lastDeliveryAt).toLocaleString("da-DK")}</span>
                        <span className={`ml-1.5 mono ${w.lastStatus === 200 ? "text-signal" : "text-clay"}`}>
                          → {w.lastStatus}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <span className={`chip !py-0 !text-[9.5px] ${w.active ? "!border-signal/40 text-signal" : "text-faint"}`}>{w.active ? "aktiv" : "pauseret"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Code-eksempler */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.18s" }}>
        <h2 className="display text-[17px] font-semibold">Quickstart</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <CodeBlock title="Hent ydelser (åben)" lang="curl">{`curl https://api.praxis.app/v1/${activeTenant}/services`}</CodeBlock>
          <CodeBlock title="Liste bookings (auth)" lang="curl">{`curl https://api.praxis.app/v1/${activeTenant}/bookings/list \\
  -H "Authorization: Bearer sk_live_..."`}</CodeBlock>
          <CodeBlock title="Opret klient (auth)" lang="curl">{`curl -X POST https://api.praxis.app/v1/${activeTenant}/clients \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "content-type: application/json" \\
  -d '{"name":"Jane Doe","email":"jane@example.com"}'`}</CodeBlock>
          <CodeBlock title="Node.js · SDK" lang="js">{`import { PraxisOS } from "@praxisos/sdk";

const client = new PraxisOS({
  tenant: "${activeTenant}",
  apiKey: process.env.PRAXIS_API_KEY,
});

const services = await client.services.list();
const booking = await client.bookings.create({
  serviceId: "fod-med",
  startsAt: "2026-06-12T14:00:00+02:00",
  client: { name: "Jane Doe", email: "jane@example.com" }
});`}</CodeBlock>
        </div>
      </section>
    </div>
  );
}

function CodeBlock({ title, lang, children }: { title: string; lang: string; children: string }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-ink">
      <div className="flex items-center justify-between border-b border-paper/10 px-3.5 py-1.5">
        <span className="text-[10.5px] font-medium text-paper">{title}</span>
        <span className="mono text-[9.5px] text-paper/40">{lang}</span>
      </div>
      <pre className="mono p-3.5 text-[10.5px] leading-relaxed text-paper overflow-x-auto"><code>{children}</code></pre>
    </div>
  );
}

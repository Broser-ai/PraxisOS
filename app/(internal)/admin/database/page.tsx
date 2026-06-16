"use client";

import Link from "next/link";
import { DB_MODE, DB_CONFIGS, MIGRATIONS, TABLES, currentConfig } from "@/lib/supabase";

export default function DatabaseAdmin() {
  const totalRows = TABLES.reduce((s, t) => s + t.rows, 0);
  const totalKb = TABLES.reduce((s, t) => s + t.sizeKb, 0);
  const rlsTables = TABLES.filter((t) => t.rls).length;

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">Database · Supabase EU</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            Postgres 15 · pgvector · Row-Level Security · region {currentConfig.region}
          </p>
        </div>
        <span className="chip mono !text-[11px]"
          style={{
            background: DB_MODE === "supabase-eu" ? "color-mix(in srgb, var(--color-signal) 14%, transparent)" :
                       DB_MODE === "supabase-local" ? "color-mix(in srgb, var(--color-accent) 14%, transparent)" :
                       "color-mix(in srgb, var(--color-amber) 14%, transparent)",
            color: DB_MODE === "supabase-eu" ? "var(--color-signal)" :
                   DB_MODE === "supabase-local" ? "var(--color-accent)" :
                   "var(--color-amber)",
          }}>
          ● {DB_MODE === "mock" ? "mock-mode" : DB_MODE === "supabase-local" ? "lokal Supabase" : "produktion · EU"}
        </span>
      </div>

      {/* Stats */}
      <div className="rise mt-6 grid grid-cols-2 gap-2 md:grid-cols-4" style={{ animationDelay: "0.04s" }}>
        <Stat label="Tabeller" value={TABLES.length.toString()} sub="18 ialt · 15 RLS" />
        <Stat label="Rækker" value={totalRows.toLocaleString("da-DK")} sub={`~${totalKb} KB total`} />
        <Stat label="RLS-aktive" value={`${rlsTables} / ${TABLES.length}`} sub="multi-tenant isolation" color="var(--color-signal)" />
        <Stat label="Migrations" value={`${MIGRATIONS.filter((m) => m.status === "ready").length} / ${MIGRATIONS.length}`} sub="ready/planned" />
      </div>

      {/* Setup-flow hvis mock */}
      {DB_MODE === "mock" && (
        <section className="card rise mt-3 p-5" style={{ animationDelay: "0.08s" }}>
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-amber/14 text-amber">!</span>
            <div className="flex-1">
              <h2 className="display text-[17px] font-semibold">Kører i mock-mode</h2>
              <p className="mt-1 text-[12.5px] text-muted">
                Al UI-data kommer fra in-memory mock i <code className="mono">lib/*.ts</code>. Schema er klar.
                Skift til Supabase ved at sætte <code className="mono">PRAXIS_DB=supabase-local</code> efter du har kørt Supabase CLI.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="rounded-[10px] border border-line bg-paper p-3">
                  <div className="kicker mb-1">1. Lokal Supabase</div>
                  <pre className="overflow-x-auto rounded bg-ink p-2 text-[10.5px] mono text-paper">{`npx supabase init
npx supabase start          # docker-compose op
npx supabase db reset       # kører migrations`}</pre>
                </div>
                <div className="rounded-[10px] border border-line bg-paper p-3">
                  <div className="kicker mb-1">2. Skift mode</div>
                  <pre className="overflow-x-auto rounded bg-ink p-2 text-[10.5px] mono text-paper">{`# .env.local
PRAXIS_DB=supabase-local
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJ...`}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Migrations */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.10s" }}>
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] font-semibold">Migrations</h2>
          <span className="mono text-[11px] text-faint">supabase/migrations/*.sql</span>
        </div>
        <div className="mt-4 flex flex-col">
          {MIGRATIONS.map((m) => (
            <div key={m.version} className="grid grid-cols-[80px_180px_1fr_100px] items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
              <span className="mono text-[11.5px] font-semibold">{m.version}</span>
              <span className="text-[12.5px] font-medium">{m.name}</span>
              <span className="text-[11.5px] text-muted">{m.description}</span>
              <span className={`mono text-[10.5px] text-right ${m.status === "ready" ? "text-signal" : "text-faint"}`}>
                ● {m.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Tables */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.14s" }}>
        <h2 className="display text-[17px] font-semibold">Tabeller</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-faint">
              <tr className="border-b border-line">
                <th className="kicker text-left pb-2 pr-3 font-normal">Tabel</th>
                <th className="kicker text-right pb-2 pr-3 font-normal">Rækker</th>
                <th className="kicker text-right pb-2 pr-3 font-normal">Størrelse</th>
                <th className="kicker text-left pb-2 pr-3 font-normal">RLS</th>
              </tr>
            </thead>
            <tbody>
              {TABLES.map((t) => (
                <tr key={t.name} className="border-b border-line/60 last:border-b-0">
                  <td className="py-2 pr-3 mono text-[11.5px] font-semibold">{t.name}</td>
                  <td className="py-2 pr-3 mono text-[11.5px] text-right">{t.rows.toLocaleString("da-DK")}</td>
                  <td className="py-2 pr-3 mono text-[11.5px] text-right text-muted">{t.sizeKb} KB</td>
                  <td className="py-2 pr-3">
                    {t.rls ? (
                      <span className="mono text-[10.5px] text-signal">● enabled · tenant_isolated</span>
                    ) : (
                      <span className="mono text-[10.5px] text-faint">○ shared</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* RLS visualization */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.18s" }}>
        <h2 className="display text-[17px] font-semibold">Row-Level Security · multi-tenant garanti</h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Hver tabel har en policy der binder rækker til den session-satte tenant. Cross-tenant leak er strukturelt umuligt.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="kicker mb-2">Session-context (sat før hver query)</div>
            <pre className="overflow-x-auto rounded-[8px] bg-ink p-3 text-[10.5px] mono text-paper leading-relaxed">
{`SET LOCAL app.tenant_id = 'a3f7-...-91c';
SET LOCAL app.role      = 'practitioner';

-- Alle queries herefter ser KUN denne tenants data`}
            </pre>
          </div>
          <div>
            <div className="kicker mb-2">RLS-policy (samme på alle tabeller)</div>
            <pre className="overflow-x-auto rounded-[8px] bg-ink p-3 text-[10.5px] mono text-paper leading-relaxed">
{`CREATE POLICY bookings_tenant_isolated
  ON bookings FOR ALL
  USING (tenant_id =
    current_setting('app.tenant_id')::uuid
  );`}
            </pre>
          </div>
        </div>
      </section>

      {/* Connection-modes */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.22s" }}>
        <h2 className="display text-[17px] font-semibold">3 connection-modes</h2>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
          {Object.values(DB_CONFIGS).map((c) => {
            const isActive = c.mode === DB_MODE;
            return (
              <div key={c.mode} className="card p-4"
                style={isActive ? { borderColor: "var(--color-ink)", background: "var(--color-paper-2)" } : {}}>
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold">{c.mode}</div>
                  {isActive && <span className="chip mono !text-[10px] !border-signal/40 text-signal">● aktiv</span>}
                </div>
                <div className="mt-2 mono text-[10.5px] text-faint break-all">{c.url}</div>
                <div className="mt-3 flex flex-col gap-1 text-[10.5px]">
                  <div className="flex justify-between"><span className="text-muted">Region</span><span>{c.region}</span></div>
                  <div className="flex justify-between"><span className="text-muted">RLS</span><span>{c.rlsEnabled ? "✓" : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Pool</span><span className="mono">{c.poolMin}-{c.poolMax}</span></div>
                  <div className="flex justify-between"><span className="text-muted">pgvector</span><span>{c.pgvector ? "✓" : "—"}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-3 rounded-[12px] border border-line bg-paper-2/60 p-5 text-[12.5px] text-ink-soft">
        <div className="kicker">Hvad sker der nu</div>
        <p className="mt-2 max-w-[760px]">
          Schema-filen <code className="mono">supabase/migrations/0001_initial_schema.sql</code> indeholder hele datamodellen.
          For at gå live:
          (1) <code className="mono">supabase init</code> + <code className="mono">supabase start</code> i projektet for at få lokal stack,
          (2) <code className="mono">supabase db reset</code> kører migrations,
          (3) sæt <code className="mono">PRAXIS_DB=supabase-local</code> i <code className="mono">.env.local</code>,
          (4) restart dev-serveren.
          Når det virker lokalt, <code className="mono">supabase link</code> + <code className="mono">supabase db push</code> → produktion i Frankfurt.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-3" style={color ? { borderColor: color, background: `color-mix(in srgb, ${color} 5%, var(--color-card))` } : {}}>
      <div className="kicker !text-[9px]">{label}</div>
      <div className="mt-1 display text-[22px] font-semibold leading-none" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="mono text-[10px] text-faint">{sub}</div>}
    </div>
  );
}

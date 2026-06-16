"use client";

import { useState } from "react";
import Link from "next/link";
import { MCP_TOOLS, TOOL_CATEGORIES } from "@/lib/mcp-tools";

const CLAUDE_CODE_CONFIG = `{
  "mcpServers": {
    "praxisos": {
      "type": "http",
      "url": "https://api.praxis.app/api/mcp/v1",
      "headers": {
        "Authorization": "Bearer sk_live_8f2a9c47bf24c3d18a47b2c1d59e8f47"
      }
    }
  }
}`;

const CURSOR_CONFIG = `{
  "mcp.servers": {
    "praxisos": {
      "url": "https://api.praxis.app/api/mcp/v1",
      "auth": { "bearer": "sk_live_..." }
    }
  }
}`;

const EXAMPLE_CALL = `curl -X POST https://api.praxis.app/api/mcp/v1 \\
  -H "Authorization: Bearer sk_live_8f2a9c47bf24c3d18a47b2c1d59e8f47" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "calculate_subsidy",
      "arguments": {
        "clientId": "per",
        "serviceId": "fod-med",
        "servicePriceKr": 495
      }
    }
  }'`;

export default function McpAdmin() {
  const [activeCategory, setActiveCategory] = useState<string>("bookings");
  const [selectedTool, setSelectedTool] = useState(MCP_TOOLS[0].name);

  const filtered = activeCategory === "all"
    ? MCP_TOOLS
    : MCP_TOOLS.filter((t) => t.category === activeCategory);
  const tool = MCP_TOOLS.find((t) => t.name === selectedTool);

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/tenants" className="kicker hover:underline">← Tenants</Link>
          <h1 className="display mt-2 text-[30px] font-semibold leading-none">MCP-server</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            PraxisOS eksponeret som Model Context Protocol-server · Claude Code, Cursor og andre agenter kan styre platformen direkte.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/mcp/v1" target="_blank" className="btn btn-ghost">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" /> manifest →
          </a>
          <a href="https://modelcontextprotocol.io/specification" target="_blank" className="btn btn-ghost">MCP spec ↗</a>
        </div>
      </div>

      {/* Stats */}
      <div className="rise mt-6 grid grid-cols-2 gap-2 md:grid-cols-4" style={{ animationDelay: "0.04s" }}>
        <Stat label="Tools" value={MCP_TOOLS.length.toString()} sub="JSON-RPC 2.0 over HTTP" />
        <Stat label="Resources" value="11" sub="2 tenants + 9 agenter" />
        <Stat label="Protocol" value="2024-11-05" sub="MCP-standard" mono />
        <Stat label="Auth" value="Bearer sk_live_" sub="api-key fra /admin/api" mono />
      </div>

      {/* Tilkobling */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.08s" }}>
        <h2 className="display text-[17px] font-semibold">Tilkobling fra Claude Code</h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Tilføj denne config til <code className="mono">~/.claude/mcp.json</code> (eller projekt-lokalt <code className="mono">.mcp.json</code>):
        </p>
        <pre className="scrollbar-thin mt-3 overflow-x-auto rounded-[10px] bg-ink p-4 text-paper text-[11.5px] mono leading-relaxed">
{CLAUDE_CODE_CONFIG}
        </pre>

        <h3 className="display mt-5 text-[14px] font-semibold">Fra Cursor</h3>
        <pre className="scrollbar-thin mt-2 overflow-x-auto rounded-[10px] bg-ink p-4 text-paper text-[11px] mono leading-relaxed">
{CURSOR_CONFIG}
        </pre>

        <h3 className="display mt-5 text-[14px] font-semibold">Test direkte med curl</h3>
        <pre className="scrollbar-thin mt-2 overflow-x-auto rounded-[10px] bg-ink p-4 text-paper text-[10.5px] mono leading-relaxed">
{EXAMPLE_CALL}
        </pre>
      </section>

      {/* Tools explorer */}
      <section className="card rise mt-3 overflow-hidden p-0" style={{ animationDelay: "0.12s" }}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="display text-[17px] font-semibold">{MCP_TOOLS.length} tools eksponeret</h2>
          <span className="mono text-[10.5px] text-faint">scopes håndhævet pr. tool</span>
        </div>

        {/* Category-tabs */}
        <div className="flex flex-wrap gap-1 border-b border-line bg-paper-2/40 px-5 py-2">
          <button
            onClick={() => setActiveCategory("all")}
            className="rounded-[6px] px-2.5 py-1 text-[11px]"
            style={{
              background: activeCategory === "all" ? "var(--color-ink)" : "transparent",
              color: activeCategory === "all" ? "var(--color-paper)" : "var(--color-muted)",
            }}
          >
            Alle ({MCP_TOOLS.length})
          </button>
          {TOOL_CATEGORIES.map((c) => {
            const count = MCP_TOOLS.filter((t) => t.category === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className="rounded-[6px] px-2.5 py-1 text-[11px]"
                style={{
                  background: activeCategory === c.id ? "var(--color-ink)" : "transparent",
                  color: activeCategory === c.id ? "var(--color-paper)" : "var(--color-muted)",
                }}
              >
                {c.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Tools-grid + detalje */}
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <div className="scrollbar-thin max-h-[600px] overflow-y-auto border-r border-line">
            {filtered.map((t) => (
              <button
                key={t.name}
                onClick={() => setSelectedTool(t.name)}
                className="flex w-full flex-col items-start gap-1 border-b border-line px-4 py-2.5 text-left transition-colors hover:bg-paper-2"
                style={selectedTool === t.name ? { background: "var(--color-paper-2)", borderLeft: "3px solid var(--color-ink)" } : {}}
              >
                <div className="flex items-center gap-2 w-full">
                  <code className="mono text-[11.5px] font-semibold">{t.name}</code>
                  <span
                    className="ml-auto rounded-full px-1.5 py-0 text-[9px] font-medium"
                    style={{
                      background: `color-mix(in srgb, ${TOOL_CATEGORIES.find((c) => c.id === t.category)?.color} 14%, transparent)`,
                      color: TOOL_CATEGORIES.find((c) => c.id === t.category)?.color,
                    }}
                  >
                    {t.category}
                  </span>
                </div>
                <div className="text-[10.5px] text-muted line-clamp-2">{t.description}</div>
              </button>
            ))}
          </div>

          {/* Detalje */}
          {tool && (
            <div className="p-5">
              <div className="flex items-center gap-2">
                <code className="mono text-[15px] font-semibold">{tool.name}</code>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: `color-mix(in srgb, ${TOOL_CATEGORIES.find((c) => c.id === tool.category)?.color} 14%, transparent)`,
                    color: TOOL_CATEGORIES.find((c) => c.id === tool.category)?.color,
                  }}
                >
                  {tool.category}
                </span>
                <span className="ml-auto mono text-[10px] text-faint">requires scope: {tool.requiresScope}</span>
              </div>

              <p className="mt-3 text-[13px] text-ink-soft">{tool.description}</p>

              <div className="mt-5">
                <div className="kicker mb-2">Input schema</div>
                <div className="flex flex-col gap-1.5">
                  {Object.entries(tool.inputSchema.properties).map(([k, v]) => {
                    const isRequired = tool.inputSchema.required?.includes(k);
                    return (
                      <div key={k} className="rounded-[8px] border border-line bg-paper p-2.5">
                        <div className="flex items-center gap-2">
                          <code className="mono text-[11.5px] font-semibold">{k}</code>
                          <span className="mono text-[9.5px] text-faint">{v.type}</span>
                          {isRequired && <span className="text-[9.5px] text-clay">påkrævet</span>}
                          {v.enum && (
                            <span className="ml-auto mono text-[9.5px] text-faint">
                              {v.enum.join(" | ")}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-muted">{v.description}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {tool.outputSample && (
                <div className="mt-5">
                  <div className="kicker mb-2">Output-eksempel</div>
                  <pre className="scrollbar-thin overflow-x-auto rounded-[8px] bg-ink p-3 text-paper text-[10.5px] mono leading-relaxed">
{JSON.stringify(tool.outputSample, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* JSON-RPC spec */}
      <section className="card rise mt-3 p-5" style={{ animationDelay: "0.16s" }}>
        <h2 className="display text-[17px] font-semibold">Supporterede JSON-RPC metoder</h2>
        <div className="mt-3 grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {[
            ["initialize", "Handshake · returnerer protocol version + capabilities"],
            ["tools/list", "Liste alle tilgængelige tools"],
            ["tools/call", "Eksekverer et tool med arguments"],
            ["resources/list", "Liste tenants + agenter som resources"],
            ["resources/read", "Hent en specifik resource (praxisos://tenant/X eller agent/X)"],
            ["prompts/list", "Liste prompts (tom indtil videre)"],
            ["ping", "Liveness-check"],
          ].map(([method, desc]) => (
            <div key={method} className="flex items-center gap-3 rounded-[8px] border border-line bg-paper p-2.5">
              <code className="mono text-[11.5px] font-semibold">{method}</code>
              <span className="text-[11px] text-muted">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Why-MCP */}
      <div className="mt-3 rounded-[12px] border border-line bg-paper-2/60 p-5 text-[13px] text-ink-soft">
        <div className="kicker">Hvad får du af at eksponere PraxisOS som MCP?</div>
        <ul className="mt-2 list-disc list-inside space-y-1 max-w-[860px]">
          <li>Claude Code og Cursor kan kalde booking-, journal-, tilskuds- og betalings-flowet direkte.</li>
          <li>3.-parts agenter kan automatisere arbejdsgange uden custom-integration.</li>
          <li>Hvert tool har scope-tjek + audit-log · ingen privileged operations uden Bearer-token.</li>
          <li>JSON-Schema validering på input · runtime-fejl returneres som JSON-RPC -32602.</li>
          <li>Resources lader agenter introspecte tenants og agent-teamet uden tools.</li>
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, mono }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div className="card p-3">
      <div className="kicker !text-[9px]">{label}</div>
      <div className={`mt-1 ${mono ? "mono" : ""} text-[14px] font-semibold`}>{value}</div>
      {sub && <div className="mono text-[10px] text-faint">{sub}</div>}
    </div>
  );
}

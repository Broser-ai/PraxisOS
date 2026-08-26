#!/usr/bin/env node
/**
 * PraxisOS agent worker — kalder /api/agents/tick hvert minut
 *
 * Env:
 *   PRAXIS_BASE_URL=http://praxisos:3000   (docker) eller http://127.0.0.1:3010
 *   AGENT_WORKER_SECRET=...               (skal matche app)
 *   AGENT_TICK_MS=60000
 *   AGENT_FORCE_FIRST_TICK=1              (kør alle workflows første gang)
 */
const base = (process.env.PRAXIS_BASE_URL || "http://127.0.0.1:3010").replace(/\/$/, "");
const secret = process.env.AGENT_WORKER_SECRET || process.env.PRAXIS_EVENT_SECRET || "";
const intervalMs = Math.max(15_000, Number(process.env.AGENT_TICK_MS || "60000") || 60_000);
let first = process.env.AGENT_FORCE_FIRST_TICK !== "0";

async function tick() {
  const force = first;
  first = false;
  const headers = { "Content-Type": "application/json" };
  if (secret) {
    headers["x-agent-worker-secret"] = secret;
  }
  try {
    const res = await fetch(`${base}/api/agents/tick`, {
      method: "POST",
      headers,
      body: JSON.stringify({ force, tenant: process.env.PRAXIS_DEFAULT_TENANT || "bypilar" }),
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    const ran = Array.isArray(body?.ran) ? body.ran.join(",") : "";
    console.log(
      `[agent-worker] ${new Date().toISOString()} status=${res.status} ran=[${ran}] ticks=${body?.stats?.ticks ?? "?"}`,
    );
  } catch (err) {
    console.error(`[agent-worker] tick failed:`, err?.message || err);
  }
}

console.log(`[agent-worker] starting · base=${base} · every ${intervalMs}ms`);
tick();
setInterval(tick, intervalMs);

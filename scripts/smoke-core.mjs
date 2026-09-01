#!/usr/bin/env node
/**
 * Smoke-test for working-core loop (memory backend).
 * Start the app first: `npm run dev` then `node scripts/smoke-core.mjs`
 */

const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const cookieJar = new Map();
function storeCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    cookieJar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}
function cookieHeader() {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  console.log("smoke against", BASE);

  const health = await req("/api/health");
  assert(health.status === 200, `health ${health.status}`);
  console.log("✓ health", health.json.backend, health.json.dbMode);

  const login = await req("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "pilar@bypilar.dk", password: "demo" }),
  });
  storeCookies(login);
  assert(login.status === 200 && login.json.success, `login ${login.status} ${JSON.stringify(login.json)}`);
  console.log("✓ login", login.json.tenant);

  const slug = `smoke${Date.now().toString(36)}`;
  const signup = await req("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      legalName: `Smoke Klinik ${slug}`,
      slug,
      email: `${slug}@example.com`,
      contactName: "Smoke Owner",
      cvr: "12345678",
      phone: "+45 12 34 56 78",
      plan: "practice",
    }),
  });
  assert(signup.status === 201 && signup.json.success, `signup ${signup.status} ${JSON.stringify(signup.json)}`);
  console.log("✓ signup", signup.json.tenant?.slug || slug, "backend", signup.json.backend);

  const booking = await req("/api/v1/bypilar/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      serviceId: "fod-med",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      client: {
        name: "Smoke Patient",
        email: `patient-${slug}@example.com`,
        phone: "+45 11 22 33 44",
      },
      modality: "Klinik",
    }),
  });
  assert(booking.status === 201 && booking.json.id, `booking ${booking.status} ${JSON.stringify(booking.json)}`);
  console.log("✓ booking created", booking.json.id, "backend", booking.json.backend);

  const list = await req("/api/v1/bypilar/bookings/list?limit=50", {
    headers: {
      authorization: "Bearer sk_test_smoke",
      cookie: cookieHeader(),
    },
  });
  assert(list.status === 200, `list ${list.status} ${JSON.stringify(list.json)}`);
  const found = (list.json.data || []).some((b) => b.id === booking.json.id);
  assert(found, "created booking not found in list");
  console.log("✓ booking list contains new booking");

  const client = await req("/api/v1/bypilar/clients", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer sk_test_smoke",
      cookie: cookieHeader(),
    },
    body: JSON.stringify({
      name: "Ny Klient Smoke",
      email: `cli-${slug}@example.com`,
      phone: "+45 55 66 77 88",
    }),
  });
  assert(client.status === 201 && client.json.id, `client ${client.status}`);
  console.log("✓ client created", client.json.id);

  const dash = await req("/dashboard", { headers: { cookie: cookieHeader() }, redirect: "manual" });
  assert(dash.status === 200 || dash.status === 307 || dash.status === 308 || dash.status === 302, `dashboard ${dash.status}`);
  // With cookie should not redirect to login (401/302 to login)
  const loc = dash.headers.get("location") || "";
  assert(!loc.includes("/login"), `dashboard redirected to login: ${loc}`);
  console.log("✓ dashboard reachable with session", dash.status);

  console.log("\nALL SMOKE CHECKS PASSED");
}

main().catch((err) => {
  console.error("\nSMOKE FAILED:", err.message);
  process.exit(1);
});

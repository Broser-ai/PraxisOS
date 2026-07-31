import { decodeSession, SESSION_COOKIE } from "@/lib/auth";
import { getTenant } from "@/lib/tenants";
import { getDaemonState } from "@/lib/swarm/daemon";
import { getSwarmBus } from "@/lib/swarm/events";
import { listJournals } from "@/lib/swarm/journal";

/**
 * GET /api/v1/{tenant}/swarm/stream — Server-Sent Events (real-time swarm feed)
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await ctx.params;
  if (!getTenant(tenant)) {
    return new Response(JSON.stringify({ error: "tenant_not_found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // Cookie may arrive via cookie header; EventSource sends cookies same-origin
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)praxis_session=([^;]+)/);
  const token = match?.[1] ? decodeURIComponent(match[1]) : "";
  const session = decodeSession(token);
  if (!session || session.tenant !== tenant) {
    // Also allow query access_token for tooling (signed session cookie value)
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const bus = getSwarmBus();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({
        type: "hello",
        at: new Date().toISOString(),
        daemon: getDaemonState(),
        recentJournals: listJournals({ limit: 5 }),
      });

      const onEvent = (ev: unknown) => send(ev);
      bus.on("swarm", onEvent);

      const heartbeat = setInterval(() => {
        send({
          type: "heartbeat",
          at: new Date().toISOString(),
          daemon: getDaemonState(),
        });
      }, 15_000);

      const close = () => {
        clearInterval(heartbeat);
        bus.off("swarm", onEvent);
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      // Abort when client disconnects
      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

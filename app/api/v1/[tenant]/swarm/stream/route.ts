import { getTenant } from "@/lib/tenants";
import { getDaemonState } from "@/lib/swarm/daemon";
import { getSwarmBus } from "@/lib/swarm/events";
import { listJournals } from "@/lib/swarm/journal";
import { ensureSwarmRemoteHydrated, getSwarmMemory } from "@/lib/swarm/memory";
import { jsonAuthFail, requireTenantAccess } from "@/lib/request-auth";

/**
 * GET /api/v1/{tenant}/swarm/stream — Server-Sent Events (real-time swarm feed)
 * Process-local bus + periodic remote hydrate for cross-instance journals.
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

  // F41 · requireTenantAccess (cookie via sessionFromRequest; EventSource same-origin)
  const auth = requireTenantAccess(req, tenant);
  if (!auth.ok) return jsonAuthFail(auth);

  await ensureSwarmRemoteHydrated();

  const encoder = new TextEncoder();
  const bus = getSwarmBus();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let lastJournalCount = getSwarmMemory().journals.length;

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

      // Cross-instance: re-hydrate and push journal delta when remote advanced
      const remotePoll = setInterval(() => {
        void (async () => {
          const mem = getSwarmMemory();
          mem.remoteHydrated = false;
          await ensureSwarmRemoteHydrated();
          const count = mem.journals.length;
          if (count > lastJournalCount) {
            const fresh = listJournals({ limit: count - lastJournalCount });
            for (const entry of fresh.reverse()) {
              send({ type: "journal", entry, source: "remote" });
            }
            lastJournalCount = count;
          }
        })();
      }, 20_000);

      const close = () => {
        clearInterval(heartbeat);
        clearInterval(remotePoll);
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

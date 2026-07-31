// H-bridge · clinical pulse through real clinic data + LangGraph orchestrator

import type { Role } from "@/lib/agents";
import {
  createBookingForTenant,
  listBookingsForTenant,
  listClientsForTenant,
} from "@/lib/data/repo";
import { createDefaultLLMCaller, createStubLLMCaller } from "@/lib/llm-adapter";
import { buildOrchestrator, isOrchestrationEnabled } from "@/lib/orchestrator";
import { writeJournal } from "@/lib/swarm/journal";
import type { SwarmTask } from "@/lib/swarm/types";

export async function runHBridge(
  task: SwarmTask,
  opts?: {
    actorRole?: Role;
    useLiveLlm?: boolean;
  },
): Promise<{ summary: string; status: "completed" | "failed"; steps: number }> {
  writeJournal({
    agent: "H_BRIDGE",
    kind: "action",
    taskId: task.id,
    content: `Clinic pulse for ${task.tenantSlug}: list → book → orchestrate`,
  });

  try {
    const existing = await listBookingsForTenant(task.tenantSlug, { limit: 5 });
    const clients = await listClientsForTenant(task.tenantSlug);

    const startsAt = new Date(Date.now() + 2 * 86400000);
    startsAt.setHours(10, 0, 0, 0);

    const booking = await createBookingForTenant(task.tenantSlug, {
      serviceId: "fod-med",
      startsAt: startsAt.toISOString(),
      client: {
        name: "Swarm Pulse Patient",
        email: `swarm-pulse-${task.id.slice(-6)}@praxis.local`,
        phone: "+45 70 00 00 00",
      },
      modality: "Klinik",
      notes: `Autonomous H-bridge pulse · task ${task.id}`,
      source: "aria",
    });

    if ("error" in booking) {
      writeJournal({
        agent: "H_BRIDGE",
        kind: "result",
        taskId: task.id,
        content: `Booking failed: ${booking.error}`,
      });
      return { summary: booking.error, status: "failed", steps: 0 };
    }

    writeJournal({
      agent: "H_BRIDGE",
      kind: "result",
      taskId: task.id,
      content: `Created booking ${booking.id} for ${booking.clientName} · priorBookings=${existing.length} clients=${clients.length}`,
      meta: { bookingId: booking.id, clientId: booking.clientId },
    });

    const useLive =
      opts?.useLiveLlm ??
      (isOrchestrationEnabled() && Boolean(process.env.ANTHROPIC_API_KEY));

    const orch = buildOrchestrator({
      llmCall: useLive ? createDefaultLLMCaller() : createStubLLMCaller(),
    });

    const result = await orch.invoke({
      tenantId: task.tenantSlug,
      tenantSlug: task.tenantSlug,
      actorRole: opts?.actorRole ?? "owner",
      origin: "booking",
      messages: [
        {
          role: "user",
          content: `Bekræft booking ${booking.id} for ${booking.clientName} · ${booking.service} · ${booking.startsAt}`,
        },
      ],
      tenantMdrStatus: "none",
    });

    const summary = [
      `booking=${booking.id}`,
      `orch=${result.status}`,
      `steps=${result.steps.length}`,
      result.error ? `err=${result.error.code}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    writeJournal({
      agent: "H_BRIDGE",
      kind: "result",
      taskId: task.id,
      content: summary,
      meta: {
        bookingId: booking.id,
        orchStatus: result.status,
        steps: result.steps.length,
      },
    });

    return {
      summary,
      status: result.status === "error" && !booking.id ? "failed" : "completed",
      steps: result.steps.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeJournal({
      agent: "H_BRIDGE",
      kind: "result",
      taskId: task.id,
      content: `H-bridge failed: ${message}`,
    });
    return { summary: message, status: "failed", steps: 0 };
  }
}

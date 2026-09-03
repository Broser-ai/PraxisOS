// Workflow definitions · event routing + cron schedules for all PraxisOS agents

import type { AgentId } from "@/lib/agents";
import type { PraxisEvent } from "@/lib/event-bus";
import { publishEvent, listEvents, subscribe } from "@/lib/event-bus";
import {
  createJob,
  updateJob,
  recordTick,
  listJobs,
  getAutomationStats,
} from "@/lib/agent-store";
import { runAgent } from "@/lib/agents/runtime";
import { listBookings } from "@/lib/bookings";
import { listClients } from "@/lib/clients";
import { ensureJournalForBooking, getJournalByBooking } from "@/lib/journal";

export type WorkflowSchedule = "hourly" | "daily" | "weekly" | "on_event" | "manual";

export type WorkflowDef = {
  id: string;
  name: string;
  description: string;
  agents: AgentId[];
  schedule: WorkflowSchedule;
  eventTypes?: string[];
  enabled: boolean;
  prompt: (ctx: { tenant: string; event?: PraxisEvent }) => string;
};

export const WORKFLOWS: WorkflowDef[] = [
  {
    id: "wf_booking_confirm",
    name: "Booking-bekræftelse",
    description: "Når booking oprettes: Aria bekræfter, Sigrid tjekker tilskud.",
    agents: ["aria", "sigrid"],
    schedule: "on_event",
    eventTypes: ["booking.created"],
    enabled: true,
    prompt: ({ tenant, event }) =>
      `Ny booking i ${tenant}: ${JSON.stringify(event?.data ?? {})}. Aria: forbered bekræftelsesbesked. Sigrid-spor: nævn relevant tilskud hvis muligt.`,
  },
  {
    id: "wf_booking_change",
    name: "Ombooking / aflysning",
    description: "Aria håndterer ændringer og notifikationer.",
    agents: ["aria"],
    schedule: "on_event",
    eventTypes: ["booking.rescheduled", "booking.cancelled"],
    enabled: true,
    prompt: ({ event }) =>
      `Booking ændret (${event?.type}): ${JSON.stringify(event?.data ?? {})}. Bekræft handling og foreslå næste skridt.`,
  },
  {
    id: "wf_reminder_t24",
    name: "Påmindelser · 24t",
    description: "Aria sender påmindelser for morgendagens confirmed bookinger.",
    agents: ["aria"],
    schedule: "hourly",
    enabled: true,
    prompt: ({ tenant }) => {
      const tomorrow = listBookings({ tenant, status: ["confirmed", "pending"] }).filter((b) => {
        const d = new Date(b.startsAt);
        const now = new Date();
        const diff = d.getTime() - now.getTime();
        return diff > 0 && diff < 30 * 3600_000;
      });
      return `Kør påmindelses-workflow for ${tenant}. Kommende tider (≤30t): ${tomorrow
        .map((b) => `${b.id} ${b.clientName} ${b.startsAt}`)
        .join("; ") || "ingen"}. Forbered SMS-tekster (send kun hvis Bird er sat op via tool).`;
    },
  },
  {
    id: "wf_journal_on_complete",
    name: "Journal · efter behandling",
    description: "Når booking completed: opret journalpost + Niels SOAP-udkast.",
    agents: ["niels"],
    schedule: "on_event",
    eventTypes: ["booking.completed"],
    enabled: true,
    prompt: ({ event, tenant }) => {
      const bookingId = String(event?.data?.bookingId ?? "");
      return `Booking completed i ${tenant}${bookingId ? ` (${bookingId})` : ""}. Sørg for journalpost + SOAP-udkast til godkendelse via draft_soap_note (clientId/bookingId fra event). Event: ${JSON.stringify(event?.data ?? {})}`;
    },
  },
  {
    id: "wf_post_visit",
    name: "Efter besøg",
    description: "Efter signeret journal / completed: Magnus review-udkast + Liv check-in.",
    agents: ["magnus", "liv"],
    schedule: "on_event",
    eventTypes: ["journal.note_signed"],
    enabled: true,
    prompt: ({ event }) =>
      `Journal signeret: ${JSON.stringify(event?.data ?? {})}. Magnus: review-forespørgsel (kræver approve). Liv: venlig check-in uden medicinske råd.`,
  },
  {
    id: "wf_subsidy_daily",
    name: "Tilskuds-gennemgang",
    description: "Sigrid scanner dagens bookinger for tilskudsmuligheder.",
    agents: ["sigrid"],
    schedule: "daily",
    enabled: true,
    prompt: ({ tenant }) => {
      const today = listBookings({ tenant }).filter((b) => {
        const d = new Date(b.startsAt);
        const n = new Date();
        return d.toDateString() === n.toDateString();
      });
      return `Daglig tilskuds-gennemgang ${tenant}. Dagens bookinger: ${today
        .map((b) => `${b.clientId}/${b.serviceId}`)
        .join(", ") || "ingen"}. Beregn bedste tilskud hvor muligt.`;
    },
  },
  {
    id: "wf_finance_daily",
    name: "Cash-flow & rykkere",
    description: "Vega overvåger ubetalte og foreslår venlige påmindelser.",
    agents: ["vega"],
    schedule: "daily",
    enabled: true,
    prompt: ({ tenant }) =>
      `Daglig finans-check for ${tenant}. Find ubetalte bookinger og foreslå venlige rykkere. Inkasso kun med approve.`,
  },
  {
    id: "wf_compliance_daily",
    name: "Compliance-scan",
    description: "Frej scanner audit-log for anomalies.",
    agents: ["frej"],
    schedule: "daily",
    enabled: true,
    prompt: ({ tenant }) =>
      `Kør compliance-scan for ${tenant}. Brug list_audit_events og rapporter kun reelle findings.`,
  },
  {
    id: "wf_coach_daily",
    name: "Patient-coach check-in",
    description: "Liv følger aktive forløb med blide beskeder.",
    agents: ["liv"],
    schedule: "daily",
    enabled: true,
    prompt: ({ tenant }) => {
      const active = listClients().filter((c) => c.forloeb?.status === "active");
      return `Coach-runde for ${tenant}. Aktive forløb: ${active
        .map((c) => c.id)
        .join(", ")}. Skriv check-in-udkast — ingen medicinske råd.`;
    },
  },
  {
    id: "wf_recall_weekly",
    name: "Recall & genbooking",
    description: "Magnus kører ugentlig recall til inaktive/afsluttede forløb.",
    agents: ["magnus"],
    schedule: "weekly",
    enabled: true,
    prompt: ({ tenant }) =>
      `Ugentlig recall for ${tenant}. Find kandidater til genbooking og lav marketing-udkast (kræver approve før SMS).`,
  },
  {
    id: "wf_field_daily",
    name: "Felt-rute",
    description: "Bjørn optimerer hjemmebesøgs-ruten.",
    agents: ["bjorn"],
    schedule: "daily",
    enabled: true,
    prompt: ({ tenant }) =>
      `Planlæg dagens hjemmebesøg for ${tenant}. List tider med modality Hjemmebesøg og foreslå rækkefølge.`,
  },
  {
    id: "wf_scribe_on_scan",
    name: "Scan → SOAP",
    description: "Når scan er færdig: Niels laver SOAP-udkast.",
    agents: ["niels"],
    schedule: "on_event",
    eventTypes: ["scan.completed", "ai.scribe_drafted"],
    enabled: true,
    prompt: ({ event }) =>
      `Scan/scribe trigger: ${JSON.stringify(event?.data ?? {})}. Lav SOAP-udkast der kræver behandler-godkendelse.`,
  },
  {
    id: "wf_platform_daily",
    name: "Platform-health",
    description: "Atlas foreslår read-only forbedringer.",
    agents: ["atlas"],
    schedule: "daily",
    enabled: true,
    prompt: ({ tenant }) =>
      `Platform-self-check for ${tenant}. Opsummer seneste events og foreslå forbedringer — ingen deploy uden approve.`,
  },
];

export function getWorkflow(id: string): WorkflowDef | undefined {
  return WORKFLOWS.find((w) => w.id === id);
}

export function listWorkflows(): WorkflowDef[] {
  return WORKFLOWS;
}

function dueBySchedule(schedule: Exclude<WorkflowSchedule, "on_event" | "manual">, lastRunAt: string | null, now = Date.now()): boolean {
  if (!lastRunAt) return true;
  const elapsed = now - Date.parse(lastRunAt);
  switch (schedule) {
    case "hourly":
      return elapsed >= 55 * 60_000;
    case "daily":
      return elapsed >= 23 * 3600_000;
    case "weekly":
      return elapsed >= 6.5 * 24 * 3600_000;
    default: {
      const _exhaustive: never = schedule;
      void _exhaustive;
      return false;
    }
  }
}

function lastJobAt(workflowId: string): string | null {
  const job = listJobs({ workflowId, limit: 1 })[0];
  return job?.finishedAt ?? job?.startedAt ?? null;
}

export async function runWorkflow(
  workflowId: string,
  opts?: { tenant?: string; event?: PraxisEvent; force?: boolean },
) {
  const wf = getWorkflow(workflowId);
  if (!wf) throw new Error(`unknown_workflow:${workflowId}`);
  if (!wf.enabled && !opts?.force) {
    return { skipped: true, reason: "disabled" as const };
  }

  const tenant = opts?.tenant ?? opts?.event?.tenant ?? "bypilar";
  const job = createJob({
    workflowId,
    tenant,
    status: "running",
    meta: { eventId: opts?.event?.id, eventType: opts?.event?.type },
  });
  updateJob(job.id, { startedAt: new Date().toISOString() });

  const prompt = wf.prompt({ tenant, event: opts?.event });
  const runIds: string[] = [];

  try {
    for (const agentId of wf.agents) {
      const result = await runAgent({
        agentId,
        message: prompt,
        tenant,
        trigger: opts?.event ? "event" : wf.schedule === "manual" ? "manual" : "workflow",
        workflowId: wf.id,
        eventId: opts?.event?.id,
        autoRoute: false,
      });
      runIds.push(result.run.id);
    }
    updateJob(job.id, {
      status: "completed",
      finishedAt: new Date().toISOString(),
      runIds,
    });
    await publishEvent({
      type: "workflow.completed",
      tenant,
      data: { workflowId: wf.id, jobId: job.id, runIds },
      source: "workflows",
    });
    return { skipped: false as const, jobId: job.id, runIds };
  } catch (err: any) {
    updateJob(job.id, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      runIds,
      error: err?.message || "workflow_failed",
    });
    return { skipped: false as const, jobId: job.id, runIds, error: err?.message };
  }
}

let dispatchDepth = 0;

export async function dispatchEventToWorkflows(event: PraxisEvent) {
  if (dispatchDepth > 0) {
    // Undgå rekursion: tool/workflow events under en kørende workflow starter ikke nye chains
    return [];
  }
  const matches = WORKFLOWS.filter(
    (w) => w.enabled && w.schedule === "on_event" && w.eventTypes?.some((t) => event.type === t || event.type.startsWith(t)),
  );
  const results = [];
  dispatchDepth += 1;
  try {
    // Side-effect: opret journalpost før Niels-workflow
    if (event.type === "booking.completed") {
      const bookingId = String(event.data?.bookingId ?? "");
      if (bookingId && !getJournalByBooking(bookingId)) {
        try {
          await ensureJournalForBooking(bookingId);
        } catch (err) {
          console.error("[workflows] ensureJournalForBooking", err);
        }
      }
    }
    for (const wf of matches) {
      results.push(await runWorkflow(wf.id, { event, tenant: event.tenant }));
    }
  } finally {
    dispatchDepth -= 1;
  }
  return results;
}

let subscribed = false;

/** Idempotent — wire event-bus → workflows once per process */
export function ensureWorkflowSubscription() {
  if (subscribed) return;
  subscribed = true;
  subscribe(async (event) => {
    if (event.type.startsWith("workflow.")) return; // avoid loops
    await dispatchEventToWorkflows(event);
  });
}

export async function tickAutomation(opts?: { tenant?: string; force?: boolean }) {
  ensureWorkflowSubscription();
  recordTick();
  const tenant = opts?.tenant ?? "bypilar";
  const ran: string[] = [];
  const skipped: string[] = [];

  for (const wf of WORKFLOWS) {
    if (!wf.enabled) {
      skipped.push(wf.id);
      continue;
    }
    if (wf.schedule === "on_event" || wf.schedule === "manual") {
      skipped.push(wf.id);
      continue;
    }
    const last = lastJobAt(wf.id);
    if (!opts?.force && !dueBySchedule(wf.schedule as "hourly" | "daily" | "weekly", last)) {
      skipped.push(wf.id);
      continue;
    }
    await runWorkflow(wf.id, { tenant, force: opts?.force });
    ran.push(wf.id);
  }

  // Prime Execution Control dispatcher — lease + controlled concurrency (max 4).
  // Failures are isolated per workstream and never abort clinic workflows.
  let missions: Awaited<ReturnType<typeof tickMissions>> | null = null;
  try {
    const { tickMissions } = await import("@/lib/prime/dispatcher");
    missions = await tickMissions({ tenantSlug: tenant, maxParallel: 4 });
    if (missions.claimed > 0) ran.push("wf_prime_missions");
  } catch (err) {
    console.error("[workflows] tickMissions", err);
  }

  return {
    ok: true,
    ran,
    skipped,
    missions,
    stats: getAutomationStats(),
    recentEvents: listEvents({ tenant, limit: 5 }),
  };
}

// PraxisOS agent runtime · LLM tool-loop + heuristic fallback

import { getAgent, routeMessage, type AgentId } from "@/lib/agents";
import { executeMcpTool } from "@/lib/mcp-handlers";
import {
  createRun,
  updateRun,
  type AgentRun,
  type AgentToolCall,
} from "@/lib/agent-store";
import { buildSystemPrompt, toolsForAgent } from "@/lib/agents/prompts";
import {
  chatCompletions,
  isLlmConfigured,
  llmModel,
  toOpenAiTools,
  type LlmMessage,
} from "@/lib/agents/llm";
import { listBookings } from "@/lib/bookings";
import { listClients, getClient } from "@/lib/clients";
import { calculateSubsidies, bestSubsidy } from "@/lib/subsidies";
import { listEvents } from "@/lib/event-bus";

export type RunAgentInput = {
  message: string;
  agentId?: AgentId | string;
  tenant?: string;
  trigger?: AgentRun["trigger"];
  workflowId?: string;
  eventId?: string;
  autoRoute?: boolean;
  maxToolRounds?: number;
};

export type RunAgentResult = {
  run: AgentRun;
  agentId: AgentId;
  reply: string;
  mode: "llm" | "heuristic";
};

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function heuristicReply(
  agentId: AgentId,
  message: string,
  tenant: string,
  runId: string,
  trigger: AgentRun["trigger"],
): Promise<{ reply: string; toolCalls: AgentToolCall[] }> {
  const agent = getAgent(agentId)!;
  const toolCalls: AgentToolCall[] = [];
  const lower = message.toLowerCase();
  const now = () => new Date().toISOString();
  const isChat = trigger === "chat" || trigger === "manual" || trigger === "mcp";

  const call = async (name: string, args: Record<string, unknown>) => {
    const at = now();
    const result = await executeMcpTool(name, args, { runId, agentId, tenant });
    toolCalls.push({ name, args, result: result.data, at });
    return result;
  };

  switch (agentId) {
    case "aria": {
      const wantsCreate =
        isChat &&
        (lower.includes("book en") ||
          lower.includes("book tid") ||
          lower.includes("book en tid") ||
          lower.startsWith("book") ||
          lower.includes("reserver"));
      if (wantsCreate) {
        const startsAt = new Date(Date.now() + 2 * 86400_000);
        startsAt.setHours(14, 0, 0, 0);
        const created = await call("create_booking", {
          tenant,
          serviceId: "fod-med",
          startsAt: startsAt.toISOString(),
          clientName: "Ny klient",
          clientEmail: "klient@example.dk",
          modality: "Klinik",
        });
        const id = (created.data as any)?.id ?? "—";
        return {
          reply: `${agent.greeting}\n\nJeg har reserveret **Medicinsk fodpleje** ${startsAt.toLocaleString("da-DK")} (booking ${id}). Bekræft hvis navn/telefon skal ændres.\n\n${agent.signature.replace("{clinic}", tenant)}`,
          toolCalls,
        };
      }
      if (isChat && (lower.includes("ombook") || lower.includes("aflys"))) {
        const upcoming = listBookings({ tenant, status: ["confirmed", "pending"] })[0];
        if (upcoming && lower.includes("aflys")) {
          await call("cancel_booking", { bookingId: upcoming.id, reason: "Patientønske via Aria" });
          return {
            reply: `Jeg har aflyst ${upcoming.clientName}'s tid (${upcoming.service}). Skal jeg foreslå en ny tid?\n\n${agent.signature.replace("{clinic}", tenant)}`,
            toolCalls,
          };
        }
        const list = await call("list_bookings", { tenant, status: "confirmed", limit: 5 });
        return {
          reply: `Jeg har hentet de næste bookinger (${(list.data as any)?.count ?? 0}). Sig booking-id + ny tid, så ombooker jeg.\n\n${agent.signature.replace("{clinic}", tenant)}`,
          toolCalls,
        };
      }
      const bookings = await call("list_bookings", { tenant, limit: 5 });
      if (!isChat) {
        return {
          reply: `Aria workflow-kørsel: ${(bookings.data as any)?.count ?? 0} bookinger synlige. Bekræftelses-/påmindelses-tekster er klar som udkast — SMS sendes når Bird er konfigureret.\n\n${agent.signature.replace("{clinic}", tenant)}`,
          toolCalls,
        };
      }
      return {
        reply: `${agent.greeting}\n\nJeg ser ${(bookings.data as any)?.count ?? 0} aktuelle tider. Sig hvad du vil booke, ombooke eller aflyse.\n\n${agent.signature.replace("{clinic}", tenant)}`,
        toolCalls,
      };
    }
    case "niels": {
      const client = listClients()[0];
      const draft = await call("draft_soap_note", {
        clientId: client?.id ?? "mette",
        transcript: message,
      });
      return {
        reply: `SOAP-udkast klar for ${client?.name ?? "patient"} — afventer din godkendelse (approval ${draft.approvalId ?? "—"}).\n\nS: ${(draft.data as any)?.S}\nO: ${(draft.data as any)?.O}\nA: ${(draft.data as any)?.A}\nP: ${(draft.data as any)?.P}\n\n${agent.signature.replace("{clinic}", tenant)}`,
        toolCalls,
      };
    }
    case "sigrid": {
      const clientId = lower.includes("per") ? "per" : "mette";
      const calc = await call("calculate_subsidy", {
        clientId,
        serviceId: "fod-med",
        servicePriceKr: 495,
      });
      const best = (calc.data as any)?.best;
      return {
        reply: best
          ? `Bedste tilskud for ${clientId}: **${best.schemeLabel}** · ${best.subsidyKr} kr (myndighed: ${best.authority}). Jeg kan klargøre indberetning til godkendelse.\n\n${agent.signature}`
          : `Jeg fandt ingen aktive tilskud for den valgte profil. Tjek medlemskab/diagnose.\n\n${agent.signature}`,
        toolCalls,
      };
    }
    case "magnus": {
      const inactive = listClients().filter((c) => c.lastVisit.includes("uge") || c.forloeb?.status === "done");
      return {
        reply: `Jeg har ${inactive.length || listClients().length} kandidater til recall/engagement. Marketing-SMS kræver din godkendelse før afsendelse.\n\n${agent.signature}`,
        toolCalls,
      };
    }
    case "frej": {
      const audit = await call("list_audit_events", { tenant });
      return {
        reply: `Compliance-scan: ${(audit.data as any)?.count ?? 0} events i loggen. Ingen kritiske anomalies i denne kørsel.\n\n${agent.signature}`,
        toolCalls,
      };
    }
    case "vega": {
      const unpaid = listBookings({ tenant }).filter((b) => !b.paid && b.status !== "cancelled");
      const sum = unpaid.reduce((s, b) => s + b.priceKr, 0);
      return {
        reply: `Cash-flow snapshot: ${unpaid.length} ubetalte bookinger · ca. ${sum} kr. Jeg sender kun venlige rykkere — inkasso kræver dig.\n\n${agent.signature}`,
        toolCalls,
      };
    }
    case "bjorn": {
      const home = listBookings({ tenant, status: ["confirmed", "pending"] }).filter((b) => b.modality === "Hjemmebesøg");
      return {
        reply: `Felt-rute i dag: ${home.length} hjemmebesøg. Jeg foreslår rækkefølge efter geografi/tid — bekræft før klienter får SMS.\n\n${agent.signature}`,
        toolCalls,
      };
    }
    case "liv": {
      const active = listClients().filter((c) => c.forloeb?.status === "active");
      return {
        reply: `Jeg følger ${active.length} aktive forløb. Check-in-beskeder er klar som udkast — ingen medicinske råd.\n\n${agent.signature}`,
        toolCalls,
      };
    }
    case "atlas": {
      const events = listEvents({ tenant, limit: 10 });
      return {
        reply: `Platform-health: ${events.length} seneste events. Forslag er read-only indtil CI er grøn + manuel approve.\n\n${agent.signature}`,
        toolCalls,
      };
    }
    default: {
      const _exhaustive: never = agentId;
      return { reply: `Ukendt agent: ${_exhaustive}`, toolCalls };
    }
  }
}

async function llmReply(
  agentId: AgentId,
  message: string,
  tenant: string,
  runId: string,
  maxToolRounds: number,
): Promise<{ reply: string; toolCalls: AgentToolCall[]; model: string }> {
  const agent = getAgent(agentId)!;
  const tools = toolsForAgent(agentId);
  const messages: LlmMessage[] = [
    { role: "system", content: buildSystemPrompt(agent, tenant) },
    { role: "user", content: message },
  ];
  const toolCalls: AgentToolCall[] = [];
  const oaTools = toOpenAiTools(tools);

  for (let round = 0; round < maxToolRounds; round++) {
    const res = await chatCompletions({ messages, tools: oaTools });
    if (!res.ok) {
      return {
        reply: `LLM-fejl: ${res.error}. Skifter til lokal heuristik.`,
        toolCalls,
        model: llmModel(),
      };
    }

    if (res.toolCalls.length === 0) {
      return {
        reply: res.content?.trim() || "(tomt svar)",
        toolCalls,
        model: res.model,
      };
    }

    messages.push({
      role: "assistant",
      content: res.content || "",
    } as LlmMessage);

    // Re-add tool_calls on assistant message for OpenAI format
    (messages[messages.length - 1] as any).tool_calls = res.toolCalls;

    for (const tc of res.toolCalls) {
      const args = parseArgs(tc.function.arguments);
      const at = new Date().toISOString();
      const result = await executeMcpTool(tc.function.name, args, { runId, agentId, tenant });
      toolCalls.push({
        name: tc.function.name,
        args,
        result: result.data,
        error: result.ok ? undefined : "tool_error",
        at,
      });
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result.data),
      });
    }
  }

  return {
    reply: "Jeg nåede tool-loftet — her er hvad jeg har indtil videre. Prøv igen for næste skridt.",
    toolCalls,
    model: llmModel(),
  };
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const tenant = input.tenant?.trim() || "bypilar";
  const routed =
    input.agentId && getAgent(input.agentId)
      ? { agent: input.agentId as AgentId, confidence: 1, reason: "explicit" }
      : input.autoRoute === false && input.agentId
        ? { agent: (input.agentId as AgentId) || "aria", confidence: 0.5, reason: "fallback" }
        : routeMessage(input.message);

  const agentId = (getAgent(routed.agent) ? routed.agent : "aria") as AgentId;
  const preferLlm = isLlmConfigured();

  const run = createRun({
    agentId,
    tenant,
    trigger: input.trigger ?? "chat",
    workflowId: input.workflowId,
    eventId: input.eventId,
    input: input.message,
    model: preferLlm ? llmModel() : "heuristic-da-v1",
    mode: preferLlm ? "llm" : "heuristic",
    status: "running",
  });

  try {
    let reply: string;
    let toolCalls: AgentToolCall[] = [];
    let mode: "llm" | "heuristic" = "heuristic";
    let model = "heuristic-da-v1";

    if (preferLlm) {
      const llm = await llmReply(agentId, input.message, tenant, run.id, input.maxToolRounds ?? 4);
      if (llm.reply.startsWith("LLM-fejl:")) {
        const h = await heuristicReply(agentId, input.message, tenant, run.id, input.trigger ?? "chat");
        reply = `${llm.reply}\n\n${h.reply}`;
        toolCalls = [...llm.toolCalls, ...h.toolCalls];
        mode = "heuristic";
      } else {
        reply = llm.reply;
        toolCalls = llm.toolCalls;
        mode = "llm";
        model = llm.model;
      }
    } else {
      const h = await heuristicReply(agentId, input.message, tenant, run.id, input.trigger ?? "chat");
      reply = h.reply;
      toolCalls = h.toolCalls;
    }

    const needsApproval = toolCalls.some((t) => {
      const r = t.result as any;
      return r && typeof r === "object" && (r.status === "draft_pending_approval" || r.requiresApproval || r.status === "pending_approval");
    });

    const updated =
      updateRun(run.id, {
        status: needsApproval ? "awaiting_approval" : "completed",
        output: reply,
        toolCalls,
        mode,
        model,
        finishedAt: new Date().toISOString(),
        requiresApproval: needsApproval,
      }) ?? run;

    return { run: updated, agentId, reply, mode };
  } catch (err: any) {
    const updated =
      updateRun(run.id, {
        status: "failed",
        error: err?.message || "agent_failed",
        finishedAt: new Date().toISOString(),
      }) ?? run;
    return {
      run: updated,
      agentId,
      reply: `Agent-fejl: ${err?.message || "ukendt"}`,
      mode: preferLlm ? "llm" : "heuristic",
    };
  }
}

/** Lightweight helpers used by workflows without full chat */
export function peekSubsidy(clientId: string, serviceId = "fod-med") {
  const all = calculateSubsidies({ clientId, serviceId, servicePriceKr: 495 });
  return bestSubsidy(all);
}

export function peekClient(clientId: string) {
  return getClient(clientId);
}

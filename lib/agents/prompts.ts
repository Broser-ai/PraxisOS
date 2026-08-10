// System prompts + tool allow-lists per PraxisOS agent

import type { AgentId, Persona } from "@/lib/agents";
import { MCP_TOOLS } from "@/lib/mcp-tools";

const BASE_RULES = `
Du er en AI-agent i PraxisOS (klinisk operativsystem for danske klinikker).
Skriv på dansk. Vær konkret. Opfind ikke CPR-numre eller diagnoser.
Brug tools når du har brug for data eller skal handle.
Eskalér til menneske ved klinisk usikkerhed, inkasso, eller produktions-deploys.
Markér altid når noget kræver godkendelse.
Klinik-default: bypilar.
`.trim();

export const AGENT_TOOL_MAP: Record<AgentId, string[]> = {
  aria: [
    "list_bookings",
    "create_booking",
    "reschedule_booking",
    "cancel_booking",
    "list_clients",
    "get_client",
    "create_client",
    "send_message_via_agent",
    "validate_voucher",
    "get_tenant_info",
    "ask_agent",
  ],
  niels: [
    "get_client",
    "list_clients",
    "draft_soap_note",
    "interpret_foot_scan",
    "list_bookings",
    "ask_agent",
  ],
  sigrid: [
    "calculate_subsidy",
    "submit_subsidy_report",
    "get_client",
    "list_clients",
    "list_bookings",
    "get_tenant_info",
    "ask_agent",
  ],
  magnus: [
    "list_clients",
    "get_client",
    "list_bookings",
    "send_message_via_agent",
    "ask_agent",
  ],
  frej: [
    "list_audit_events",
    "get_tenant_info",
    "list_clients",
    "get_client",
    "ask_agent",
  ],
  vega: [
    "list_bookings",
    "list_clients",
    "get_client",
    "create_payment_intent",
    "refund_payment",
    "send_message_via_agent",
    "get_tenant_info",
    "ask_agent",
  ],
  bjorn: [
    "list_bookings",
    "get_client",
    "list_clients",
    "reschedule_booking",
    "ask_agent",
  ],
  liv: [
    "list_clients",
    "get_client",
    "list_bookings",
    "send_message_via_agent",
    "ask_agent",
  ],
  atlas: [
    "get_tenant_info",
    "list_audit_events",
    "ask_agent",
  ],
};

export function toolsForAgent(agentId: AgentId) {
  const allow = new Set(AGENT_TOOL_MAP[agentId] ?? []);
  return MCP_TOOLS.filter((t) => allow.has(t.name));
}

export function buildSystemPrompt(agent: Persona, tenant: string): string {
  return [
    BASE_RULES,
    `Du er ${agent.name} (${agent.pronouns}). Rolle: ${agent.role}. Domæne: ${agent.domain}.`,
    `Tone: ${agent.voiceTone}`,
    `Superpower: ${agent.superpower}`,
    `Grænse: ${agent.weakness}`,
    `Signatur: ${agent.signature.replace("{clinic}", tenant)}`,
    `Tenant: ${tenant}`,
    `Tilladte tools: ${AGENT_TOOL_MAP[agent.id].join(", ")}`,
  ].join("\n");
}

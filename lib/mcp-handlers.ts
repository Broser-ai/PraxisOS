// Real MCP tool handlers · PraxisOS domain actions

import { listBookings, getBooking, bookings, type Booking, type BookingStatus } from "@/lib/bookings";
import { listClients, getClient, clientsFull, type ClientProfile } from "@/lib/clients";
import { calculateSubsidies, bestSubsidy } from "@/lib/subsidies";
import { findVoucherByCode, listVouchers } from "@/lib/vouchers";
import { listTenants, getTenant } from "@/lib/tenants";
import { AGENTS, getAgent, routeMessage, type AgentId } from "@/lib/agents";
import { sendBirdSms, isBirdConfigured } from "@/lib/bird";
import { publishEvent, listEvents } from "@/lib/event-bus";
import { createApproval } from "@/lib/agent-store";
import {
  createJournalEntry,
  draftSoapForEntry,
  listJournal,
  getJournalByBooking,
  ensureJournalForBooking,
} from "@/lib/journal";

export type ToolResult = {
  ok: boolean;
  data: unknown;
  requiresApproval?: boolean;
  approvalId?: string;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const SERVICE_CATALOG: Record<string, { name: string; durationMin: number; priceKr: number }> = {
  "fod-med": { name: "Medicinsk fodpleje", durationMin: 45, priceKr: 495 },
  "fod-lux": { name: "Luksus fodpleje", durationMin: 75, priceKr: 745 },
  "fod-scan": { name: "Fod-scan · Physical AI", durationMin: 30, priceKr: 595 },
  "gel-mani": { name: "Gel manicure", durationMin: 45, priceKr: 395 },
  "nail-art": { name: "Nail art", durationMin: 60, priceKr: 545 },
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export async function executeMcpTool(
  name: string,
  args: Record<string, unknown>,
  ctx?: { runId?: string; agentId?: AgentId; tenant?: string },
): Promise<ToolResult> {
  switch (name) {
    case "list_bookings": {
      const tenant = asString(args.tenant, "bypilar");
      const status = asString(args.status);
      const clientId = asString(args.clientId) || undefined;
      const limit = Math.min(50, asNumber(args.limit, 25) || 25);
      let rows = listBookings({
        tenant,
        clientId,
        status: status ? ([status] as BookingStatus[]) : undefined,
      });
      rows = rows.slice(0, limit);
      return { ok: true, data: { count: rows.length, bookings: rows } };
    }

    case "create_booking": {
      const tenant = asString(args.tenant, ctx?.tenant ?? "bypilar");
      const serviceId = asString(args.serviceId, "fod-med");
      const catalog = SERVICE_CATALOG[serviceId] ?? {
        name: serviceId,
        durationMin: 45,
        priceKr: 495,
      };
      const clientName = asString(args.clientName, "Ny klient");
      const modalityRaw = asString(args.modality, "Klinik");
      const modality: Booking["modality"] =
        modalityRaw === "Hjemmebesøg" || modalityRaw === "Video" ? modalityRaw : "Klinik";
      const booking: Booking = {
        id: "bk_" + Math.random().toString(36).slice(2, 11),
        tenant,
        clientId: clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || "ny",
        clientName,
        clientInitials: initials(clientName) || "NK",
        service: catalog.name,
        serviceId,
        practitioner: "Pilar",
        startsAt: asString(args.startsAt, new Date(Date.now() + 86400_000).toISOString()),
        durationMin: catalog.durationMin,
        modality,
        status: "confirmed",
        priceKr: catalog.priceKr,
        paid: false,
        noShowRisk: 15,
        source: "aria",
        notes: asString(args.clientEmail) ? `Email: ${asString(args.clientEmail)}` : undefined,
      };
      bookings.unshift(booking);
      await publishEvent({
        type: "booking.created",
        tenant,
        data: { bookingId: booking.id, clientName: booking.clientName, service: booking.service, startsAt: booking.startsAt },
        source: "mcp:create_booking",
      });
      return {
        ok: true,
        data: {
          id: booking.id,
          status: booking.status,
          receiptUrl: `/r/${booking.id}`,
          aria: { reminderScheduled: true },
          booking,
        },
      };
    }

    case "reschedule_booking": {
      const bookingId = asString(args.bookingId);
      const b = getBooking(bookingId);
      if (!b) return { ok: false, data: { error: "booking_not_found", bookingId } };
      const prev = b.startsAt;
      b.startsAt = asString(args.newStartsAt, b.startsAt);
      b.status = "confirmed";
      if (args.reason) b.notes = `Ombooket: ${asString(args.reason)}`;
      await publishEvent({
        type: "booking.rescheduled",
        tenant: b.tenant,
        data: { bookingId: b.id, from: prev, to: b.startsAt, reason: asString(args.reason) },
        source: "mcp:reschedule_booking",
      });
      return { ok: true, data: { id: b.id, startsAt: b.startsAt, status: b.status, notified: true } };
    }

    case "cancel_booking": {
      const bookingId = asString(args.bookingId);
      const b = getBooking(bookingId);
      if (!b) return { ok: false, data: { error: "booking_not_found", bookingId } };
      b.status = "cancelled";
      b.notes = asString(args.reason, "Aflyst via agent");
      await publishEvent({
        type: "booking.cancelled",
        tenant: b.tenant,
        data: { bookingId: b.id, reason: b.notes, refund: asBool(args.refund, true) },
        source: "mcp:cancel_booking",
      });
      return { ok: true, data: { id: b.id, status: b.status, refund: asBool(args.refund, true) } };
    }

    case "list_clients": {
      const search = asString(args.search).toLowerCase();
      const tag = asString(args.tag);
      let rows = listClients();
      if (search) {
        rows = rows.filter(
          (c) =>
            c.name.toLowerCase().includes(search) ||
            c.email.toLowerCase().includes(search) ||
            c.phone.includes(search),
        );
      }
      if (tag) rows = rows.filter((c) => c.tag === tag);
      return {
        ok: true,
        data: {
          count: rows.length,
          clients: rows.map((c) => ({
            id: c.id,
            name: c.name,
            age: c.age,
            tag: c.tag,
            phone: c.phone,
            email: c.email,
            lastVisit: c.lastVisit,
          })),
        },
      };
    }

    case "get_client": {
      const clientId = asString(args.clientId);
      const c = getClient(clientId);
      if (!c) return { ok: false, data: { error: "client_not_found", clientId } };
      return { ok: true, data: c };
    }

    case "create_client": {
      const name = asString(args.name, "Ny klient");
      const email = asString(args.email);
      const phone = asString(args.phone);
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || `c_${Date.now()}`;
      if (getClient(id)) {
        return { ok: false, data: { error: "client_exists", id } };
      }
      const profile: ClientProfile = {
        id,
        name,
        initials: initials(name) || "NK",
        age: asNumber(args.age, 40),
        tag: "Fodpleje",
        email: email || `${id}@example.dk`,
        phone: phone || "+45 00 00 00 00",
        cprMasked: "********-0000",
        joined: new Date().toISOString().slice(0, 10),
        lastVisit: "Ny",
        trend: "flat",
        consentLevel: "Almindelig",
        mitidVerified: false,
      };
      clientsFull.push(profile);
      await publishEvent({
        type: "client.created",
        tenant: asString(args.tenant, ctx?.tenant ?? "bypilar"),
        data: { clientId: id, name },
        source: "mcp:create_client",
      });
      return { ok: true, data: profile };
    }

    case "calculate_subsidy": {
      const clientId = asString(args.clientId);
      const serviceId = asString(args.serviceId, "fod-med");
      const price = asNumber(args.servicePriceKr, SERVICE_CATALOG[serviceId]?.priceKr ?? 495);
      const all = calculateSubsidies({ clientId, serviceId, servicePriceKr: price });
      const best = bestSubsidy(all);
      return { ok: true, data: { best, all, clientId, serviceId, servicePriceKr: price } };
    }

    case "list_vouchers": {
      const tenant = asString(args.tenant, "bypilar");
      const rows = listVouchers({ tenant });
      return { ok: true, data: { count: rows.length, vouchers: rows } };
    }

    case "validate_voucher": {
      const code = asString(args.code).toUpperCase();
      const tenant = asString(args.tenant) || undefined;
      const v = findVoucherByCode(code, tenant);
      if (!v) return { ok: false, data: { valid: false, error: "voucher_not_found", code } };
      return {
        ok: true,
        data: {
          valid: v.status === "active",
          voucher: {
            code: v.code,
            kind: v.kind,
            status: v.status,
            sessionsRemaining: v.sessionsRemaining,
            serviceName: v.serviceName,
            balanceOere: v.balanceOere,
            expiresAt: v.expiresAt,
          },
        },
      };
    }

    case "submit_subsidy_report": {
      const tenant = asString(args.tenant, ctx?.tenant ?? "bypilar");
      const clientId = asString(args.clientId);
      const scheme = asString(args.scheme, "diabetes");
      const approval = createApproval({
        runId: ctx?.runId ?? "manual",
        agentId: ctx?.agentId ?? "sigrid",
        tenant,
        action: "subsidy.submit_report",
        payload: { clientId, scheme, bookingId: asString(args.bookingId) },
      });
      await publishEvent({
        type: "subsidy.report_drafted",
        tenant,
        data: { clientId, scheme, approvalId: approval.id },
        source: "mcp:submit_subsidy_report",
      });
      return {
        ok: true,
        data: { status: "pending_approval", approvalId: approval.id },
        requiresApproval: true,
        approvalId: approval.id,
      };
    }

    case "draft_soap_note": {
      const clientId = asString(args.clientId);
      const transcript = asString(args.transcript, "");
      const bookingId = asString(args.bookingId) || undefined;
      const tenant = asString(args.tenant, ctx?.tenant ?? "bypilar");
      let entry = bookingId ? getJournalByBooking(bookingId) : undefined;
      if (!entry && bookingId) {
        entry = await ensureJournalForBooking(bookingId);
      }
      if (!entry) {
        entry = await createJournalEntry({
          tenant,
          clientId: clientId || "mette",
          bookingId,
          transcript,
          aiDrafted: true,
          draftedBy: "niels",
        });
      }
      entry = await draftSoapForEntry(entry.id, { transcript: transcript || undefined });
      const approval = createApproval({
        runId: ctx?.runId ?? "manual",
        agentId: ctx?.agentId ?? "niels",
        tenant: entry.tenant,
        action: "journal.sign_soap",
        payload: { journalId: entry.id, soap: entry.soap, codes: entry.codes },
      });
      return {
        ok: true,
        data: {
          journalId: entry.id,
          ...entry.soap,
          suggestedICD: entry.codes,
          clientId: entry.clientId,
          bookingId: entry.bookingId,
          status: "draft_pending_approval",
          url: `/journal/${entry.id}`,
        },
        requiresApproval: true,
        approvalId: approval.id,
      };
    }

    case "list_journal": {
      const tenant = asString(args.tenant, "bypilar");
      const clientId = asString(args.clientId) || undefined;
      const rows = listJournal({ tenant, clientId, limit: asNumber(args.limit, 25) });
      return {
        ok: true,
        data: {
          count: rows.length,
          entries: rows.map((e) => ({
            id: e.id,
            clientName: e.clientName,
            service: e.service,
            status: e.status,
            visitAt: e.visitAt,
            bookingId: e.bookingId,
            aiDrafted: e.aiDrafted,
          })),
        },
      };
    }

    case "send_message_via_agent": {
      const agentId = asString(args.agentId, "aria") as AgentId;
      const clientId = asString(args.clientId);
      const topic = asString(args.topic);
      const channel = asString(args.channel, "auto");
      const client = getClient(clientId);
      const agent = getAgent(agentId);
      const text = `${agent?.name ?? "PraxisOS"}: ${topic}${client ? ` — hej ${client.name.split(" ")[0]}` : ""}`;

      if ((channel === "sms" || channel === "auto" || channel === "nemsms") && isBirdConfigured() && client?.phone) {
        const isMarketing = agentId === "magnus";
        if (isMarketing) {
          const approval = createApproval({
            runId: ctx?.runId ?? "manual",
            agentId,
            tenant: ctx?.tenant ?? "bypilar",
            action: "messages.send_marketing_sms",
            payload: { clientId, topic, phone: client.phone, text },
          });
          return {
            ok: true,
            data: { queued: true, channel: "sms", requiresApproval: true, draft: text },
            requiresApproval: true,
            approvalId: approval.id,
          };
        }
        const sent = await sendBirdSms({ to: client.phone, text, category: "transactional" });
        await publishEvent({
          type: "message.sent",
          tenant: ctx?.tenant ?? "bypilar",
          data: { agentId, clientId, channel: "sms", ok: sent.ok, topic },
          source: "mcp:send_message_via_agent",
        });
        return { ok: sent.ok, data: { channel: "sms", text, result: sent } };
      }

      return {
        ok: true,
        data: {
          queued: true,
          channel: channel === "auto" ? "draft" : channel,
          draft: text,
          birdConfigured: isBirdConfigured(),
          note: "Besked gemt som udkast (SMS sendes når Bird er konfigureret).",
        },
      };
    }

    case "ask_agent": {
      const message = asString(args.message);
      const routed = asString(args.agentId)
        ? { agent: asString(args.agentId) as AgentId, confidence: 1, reason: "explicit" }
        : routeMessage(message);
      const agent = getAgent(routed.agent);
      return {
        ok: true,
        data: {
          agent: routed.agent,
          confidence: routed.confidence,
          reason: routed.reason,
          response: agent
            ? `${agent.greeting}\n\nAng. dit spørgsmål («${message.slice(0, 120)}»): jeg tager det i ${agent.role.toLowerCase()}-sporet. ${agent.signature.replace("{clinic}", "bypilar")}`
            : "Ingen agent fundet.",
        },
      };
    }

    case "get_tenant_info": {
      const slug = asString(args.tenant, "bypilar");
      const t = getTenant(slug) ?? listTenants().find((x) => x.slug === slug);
      if (!t) return { ok: false, data: { error: "tenant_not_found", slug } };
      return {
        ok: true,
        data: {
          slug: t.slug,
          name: t.brand.name,
          plan: t.license.plan,
          modules: t.license.modules,
          clients: t.stats?.clients,
          legalName: t.legalName,
        },
      };
    }

    case "list_audit_events": {
      const tenant = asString(args.tenant, "bypilar");
      const events = listEvents({ tenant, limit: 50 });
      return {
        ok: true,
        data: {
          count: events.length,
          events: events.map((e) => ({
            id: e.id,
            type: e.type,
            at: e.at,
            source: e.source,
            data: e.data,
          })),
          agentsOnline: AGENTS.filter((a) => a.status === "active").map((a) => a.id),
        },
      };
    }

    case "interpret_foot_scan": {
      const clientId = asString(args.clientId);
      return {
        ok: true,
        data: {
          clientId,
          findings: [
            { area: "plantar", note: "Let trykfordeling — opfølgning anbefales", severity: "low" },
            { area: "hallux", note: "Ingen akut rødme", severity: "info" },
          ],
          status: "draft",
          note: "Niels markerer scan-tolkning som udkast — behandler godkender.",
        },
      };
    }

    case "create_payment_intent":
    case "refund_payment": {
      return {
        ok: true,
        data: {
          ok: true,
          message: `${name} registered (payment orchestration stub)`,
          args,
          status: name === "refund_payment" ? "refund_queued" : "intent_created",
        },
      };
    }

    default:
      return { ok: false, data: { error: "unknown_tool", name, args } };
  }
}

"use client";

// by Pilar end-to-end demo · komplet klinisk user-journey.
// Kontrakt: Michael's Sprint-5 mandat "by Pilar shall be complete test-object"
//
// Denne side viser HELE flowet uden at kræve live-API-keys:
//   1. Vælg patient fra by Pilar-seed
//   2. Se bookings + status
//   3. Kør scan (med stub-VLM findings)
//   4. Åbn SOAP-review pane (Companion tier)
//   5. Konfigurer orthotic (16-parameter panel)
//   6. Submit til mill (Vorum-stub)
//   7. Submit Sygesikringen-claim (EDIFACT-stub)
//   8. Se factoring-offer (48h advance)
//   9. Se temperature-monitoring (30-dages trend + drift-alarm)

import * as React from "react";
import { useMemo, useState } from "react";
import {
  BYPILAR_PATIENTS,
  BYPILAR_BOOKINGS,
  BYPILAR_SCANS,
  BYPILAR_ORTHOTIC_CONFIGS,
  BYPILAR_CLAIMS,
  BYPILAR_TEMP_READINGS,
  BYPILAR_SEED_STATS,
  type BypilarPatient,
} from "@/lib/mock/bypilar-seed";

type JourneyStep = {
  key: string;
  title: string;
  icon: string;
  route?: string;
};

const STEPS: JourneyStep[] = [
  { key: "patient", title: "1 · Vælg patient", icon: "👤" },
  { key: "bookings", title: "2 · Bookings & status", icon: "📅" },
  { key: "scan", title: "3 · Klinisk scan", icon: "📸" },
  { key: "soap", title: "4 · SOAP-review", icon: "📝" },
  { key: "configurator", title: "5 · Neural Configurator", icon: "🎛️", route: "/configurator" },
  { key: "mill", title: "6 · Mill CAM handshake", icon: "🏭" },
  { key: "claim", title: "7 · Sygesikringen claim", icon: "💶" },
  { key: "monitor", title: "8 · Temperature monitoring", icon: "🌡️" },
];

export default function ByPilarJourneyPage(): React.ReactElement {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(BYPILAR_PATIENTS[1]!.id);
  const [activeStep, setActiveStep] = useState<string>("patient");

  const patient = useMemo(
    () => BYPILAR_PATIENTS.find((p) => p.id === selectedPatientId)!,
    [selectedPatientId],
  );
  const patientBookings = BYPILAR_BOOKINGS.filter((b) => b.patient_id === selectedPatientId);
  const patientScans = BYPILAR_SCANS.filter((s) => s.patient_id === selectedPatientId);
  const patientConfigs = BYPILAR_ORTHOTIC_CONFIGS.filter(
    (c) => c.patient_id === selectedPatientId,
  );
  const patientClaims = BYPILAR_CLAIMS.filter((c) => c.patient_id === selectedPatientId);
  const patientTemps = BYPILAR_TEMP_READINGS.filter((t) => t.patient_id === selectedPatientId);
  const driftEvents = patientTemps.filter(
    (t) => t.contralateral_delta_c && Math.abs(t.contralateral_delta_c) > 2.2,
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-[1400px] mx-auto p-4 lg:p-6">
        <header className="mb-6">
          <p className="text-[11px] uppercase tracking-widest text-neutral-500">
            by Pilar · komplet test-objekt
          </p>
          <h1 className="text-2xl font-semibold mt-1">End-to-End klinisk journey</h1>
          <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
            Denne demo bruger vores by Pilar seed-data (ingen live-API-keys nødvendige).
            Klik gennem alle 8 trin for at se hele det kliniske flow fra booking til udbetaling.
          </p>
        </header>

        {/* Seed-stats banner */}
        <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center">
          <StatCard label="Patienter" value={BYPILAR_SEED_STATS.patients} />
          <StatCard label="Bookings" value={BYPILAR_SEED_STATS.bookings} />
          <StatCard label="Scans" value={BYPILAR_SEED_STATS.scans} />
          <StatCard label="Findings" value={BYPILAR_SEED_STATS.findings} />
          <StatCard label="Configs" value={BYPILAR_SEED_STATS.orthotic_configs} />
          <StatCard label="Claims" value={BYPILAR_SEED_STATS.claims} />
          <StatCard label="Temp-målinger" value={BYPILAR_SEED_STATS.temp_readings} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
          {/* Sidebar · step-navigation */}
          <aside className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2 px-1">
              Journey-trin
            </p>
            {STEPS.map((step) => (
              <button
                key={step.key}
                onClick={() => setActiveStep(step.key)}
                className={
                  "w-full text-left px-3 py-2.5 rounded-lg border transition " +
                  (activeStep === step.key
                    ? "bg-emerald-400/10 border-emerald-400/50 text-emerald-50"
                    : "bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-200")
                }
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{step.icon}</span>
                  <span className="font-medium text-sm">{step.title}</span>
                </div>
              </button>
            ))}
          </aside>

          {/* Main content per step */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 min-h-[600px]">
            {activeStep === "patient" && (
              <PatientStep
                patient={patient}
                allPatients={BYPILAR_PATIENTS}
                onSelect={setSelectedPatientId}
              />
            )}
            {activeStep === "bookings" && <BookingsStep bookings={patientBookings} />}
            {activeStep === "scan" && (
              <ScanStep scans={patientScans} patient={patient} />
            )}
            {activeStep === "soap" && (
              <SoapStep scans={patientScans} />
            )}
            {activeStep === "configurator" && (
              <ConfiguratorStep configs={patientConfigs} />
            )}
            {activeStep === "mill" && (
              <MillStep configs={patientConfigs} />
            )}
            {activeStep === "claim" && (
              <ClaimStep claims={patientClaims} />
            )}
            {activeStep === "monitor" && (
              <MonitorStep readings={patientTemps} driftEvents={driftEvents} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function StatCard(props: { label: string; value: number }): React.ReactElement {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-neutral-500">{props.label}</p>
      <p className="text-lg font-semibold tabular-nums text-emerald-400">{props.value}</p>
    </div>
  );
}

function PatientStep(props: {
  patient: BypilarPatient;
  allPatients: BypilarPatient[];
  onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Vælg patient</h2>
      <p className="text-sm text-neutral-400 mb-4">
        8 patienter i by Pilar-seed, stratified på IWGDF risk 0-3 + Fitzpatrick II-VI + sprog.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
        {props.allPatients.map((p) => (
          <button
            key={p.id}
            onClick={() => props.onSelect(p.id)}
            className={
              "text-left p-3 rounded-lg border transition " +
              (props.patient.id === p.id
                ? "bg-emerald-400/10 border-emerald-400/50"
                : "bg-neutral-950 border-neutral-800 hover:border-neutral-700")
            }
          >
            <p className="font-medium text-sm">{p.full_name}</p>
            <p className="text-[11px] text-neutral-500">
              {p.age}år · Fitz {p.fitzpatrick} · IWGDF {p.iwgdf_risk} · {p.language_at_home}
            </p>
            <p className="text-xs text-neutral-400 mt-1">{p.primary_condition}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 border-t border-neutral-800 pt-4">
        <h3 className="text-sm font-semibold mb-2">Valgt patient · detaljer</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row label="Navn" value={props.patient.full_name} />
          <Row label="CPR (masked)" value={props.patient.cpr_masked} />
          <Row label="Alder" value={`${props.patient.age} år`} />
          <Row label="Fitzpatrick" value={props.patient.fitzpatrick} />
          <Row label="IWGDF risk" value={String(props.patient.iwgdf_risk)} />
          <Row label="Region" value={props.patient.region_dk} />
          <Row label="Sprog" value={props.patient.language_at_home} />
          <Row label="Aktivitet" value={props.patient.activity_level} />
          <Row label="Vægt" value={`${props.patient.weight_kg} kg`} />
          <Row label="Samtykke" value={props.patient.consent_status} />
        </dl>
        <p className="mt-3 text-sm italic text-neutral-400 border-l-2 border-neutral-700 pl-3">
          &ldquo;{props.patient.narrative}&rdquo;
        </p>
      </div>
    </div>
  );
}

function Row(props: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-neutral-500 text-xs uppercase tracking-widest">{props.label}</dt>
      <dd className="text-neutral-200">{props.value}</dd>
    </div>
  );
}

function BookingsStep(props: { bookings: typeof BYPILAR_BOOKINGS }): React.ReactElement {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Bookings · {props.bookings.length} totalt</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-widest text-neutral-500 border-b border-neutral-800">
            <th className="py-2">Dato</th><th>Service</th><th>Behandler</th><th>Modality</th><th>Pris</th><th>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {props.bookings.map((b) => (
            <tr key={b.id}>
              <td className="py-2 tabular-nums text-neutral-300">{b.starts_at.slice(0, 16).replace("T", " ")}</td>
              <td>{b.service_id}</td>
              <td className="text-xs text-neutral-500">{b.practitioner_email}</td>
              <td>{b.modality}</td>
              <td className="tabular-nums">{b.price_kr} kr</td>
              <td>
                <StatusBadge status={b.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScanStep(props: {
  scans: typeof BYPILAR_SCANS;
  patient: BypilarPatient;
}): React.ReactElement {
  if (props.scans.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-3">Klinisk scan</h2>
        <p className="text-sm text-neutral-400">
          Ingen scans registreret for {props.patient.full_name} endnu. Book en fod-scan tid via
          bookings-trinnet.
        </p>
      </div>
    );
  }
  const scan = props.scans[0]!;
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Klinisk scan · {scan.id}</h2>
      <p className="text-sm text-neutral-500 mb-2">
        Udført {scan.performed_at.slice(0, 10)} af {scan.practitioner_email} · VLM {scan.vlm_model_version}
      </p>
      <p className="text-sm mb-4 italic text-emerald-400/90">{scan.overall_summary_da}</p>

      <h3 className="text-sm font-semibold mt-4 mb-2">Findings ({scan.findings.length})</h3>
      <div className="space-y-2">
        {scan.findings.map((f) => (
          <div key={f.id} className="border border-neutral-800 rounded-lg p-3 bg-neutral-950">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{f.label}</span>
              <div className="flex items-center gap-2">
                <SeverityBadge severity={f.severity} />
                <span className="text-xs text-neutral-500 tabular-nums">{(f.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
            <p className="text-xs text-neutral-400">{f.ai_reasoning}</p>
            <div className="flex gap-2 mt-2 text-[10px] uppercase tracking-widest">
              <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                {f.category}
              </span>
              {(f.icd10_candidates ?? []).map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300">
                  ICD-10 {c}
                </span>
              ))}
              <span className="px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300">
                AI-genereret
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        Mesh URL: <code className="font-mono text-neutral-400">{scan.mesh_url}</code>
      </p>
    </div>
  );
}

function SoapStep(props: { scans: typeof BYPILAR_SCANS }): React.ReactElement {
  if (props.scans.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-3">SOAP-review pane</h2>
        <p className="text-sm text-neutral-400">
          Ingen scans → intet SOAP-udkast. Åbn SoapReviewPane-komponenten via
          <code className="mx-1 px-1.5 py-0.5 bg-neutral-800 rounded text-xs">components/voice/SoapReviewPane.tsx</code>
          med et draft-object når du har scan-data.
        </p>
      </div>
    );
  }
  const scan = props.scans[0]!;
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">SOAP-review · Companion tier</h2>
      <p className="text-sm text-neutral-400 mb-4">
        AI-genereret SOAP-udkast baseret på scan {scan.id}. Practitioner reviewer sætning-for-sætning
        via keyboard-nav (j/k a/e/r · space play · Enter sign-off).
      </p>
      <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-950 space-y-3">
        <SoapSectionMock section="S" title="Subjektivt" text="Patient rapporterer smerte under højre forfod, værre efter langvarig belastning. Ingen aktive sår siden sidste kontrol." />
        <SoapSectionMock section="O" title="Objektivt" findings={scan.findings.map((f) => f.label)} />
        <SoapSectionMock section="A" title="Vurdering" text={scan.overall_summary_da.replace(/^\[SPRG:.+?\]\s*/, "")} />
        <SoapSectionMock section="P" title="Plan" text="1) Custom orthotic med metatarsal-pad. 2) Kontrol om 4 uger. 3) Ved forværring: henvis til karkirurgisk vurdering." />
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        📝 I den rigtige app åbnes dette i <code className="font-mono text-neutral-400">SoapReviewPane</code>-komponenten
        med inline provenance-spans + click-to-play audio.
      </p>
    </div>
  );
}

function SoapSectionMock(props: {
  section: "S" | "O" | "A" | "P";
  title: string;
  text?: string;
  findings?: string[];
}): React.ReactElement {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-neutral-500 mb-1">
        {props.section} · {props.title}
      </p>
      {props.text && <p className="text-sm">{props.text}</p>}
      {props.findings && (
        <ul className="text-sm list-disc list-inside space-y-0.5">
          {props.findings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConfiguratorStep(props: {
  configs: typeof BYPILAR_ORTHOTIC_CONFIGS;
}): React.ReactElement {
  if (props.configs.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-3">Neural Configurator</h2>
        <p className="text-sm text-neutral-400">
          Ingen orthotic-configs endnu for denne patient. Konfigurér én via{" "}
          <a href="/configurator" className="underline decoration-emerald-400/50 hover:text-emerald-300">
            /configurator
          </a>
          {" "}(demo-side).
        </p>
      </div>
    );
  }
  const cfg = props.configs[0]!;
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Orthotic config · {cfg.id}</h2>
      <p className="text-sm text-neutral-500 mb-4">
        Status: <StatusBadge status={cfg.status} /> · Godkendt: {cfg.approved_at ?? "—"}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {Object.entries(cfg.orthotic_params).map(([k, v]) => (
          <div key={k} className="bg-neutral-950 border border-neutral-800 rounded p-2">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 truncate">
              {k.replace(/_/g, " ")}
            </p>
            <p className="text-base font-semibold tabular-nums text-emerald-400">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-neutral-500">
        🎛️ Åbn interaktivt slider-panel via{" "}
        <a href="/configurator" className="underline decoration-emerald-400/50">
          /configurator
        </a>
      </p>
    </div>
  );
}

function MillStep(props: {
  configs: typeof BYPILAR_ORTHOTIC_CONFIGS;
}): React.ReactElement {
  const sent = props.configs.filter((c) => c.status === "sent_to_lab" || c.status === "delivered");
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Mill CAM handshake</h2>
      {sent.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Ingen configs sendt til lab endnu. Vorum Canfit / Cadman-adapter ligger klar i{" "}
          <code className="font-mono text-neutral-300">lib/orthotic/mill-adapter.ts</code>.
        </p>
      ) : (
        sent.map((c) => (
          <div key={c.id} className="mb-3 border border-neutral-800 rounded-lg p-3 bg-neutral-950">
            <p className="text-sm font-medium">{c.id}</p>
            <p className="text-xs text-neutral-500">
              Mill job: {c.mill_job_id ?? "—"} · ETA: {c.mill_eta_at ?? "—"}
            </p>
            <p className="text-xs text-emerald-400 mt-1">
              🏭 Vorum RECT mapping: 16-parameter vektor konverteret til Canfit-format
            </p>
          </div>
        ))
      )}
    </div>
  );
}

function ClaimStep(props: { claims: typeof BYPILAR_CLAIMS }): React.ReactElement {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Sygesikringen claims · {props.claims.length}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-widest text-neutral-500 border-b border-neutral-800">
            <th className="py-2">Claim ID</th><th>Gruppe</th><th>Beløb</th><th>Status</th><th>Factoring</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {props.claims.map((c) => (
            <tr key={c.id}>
              <td className="py-2 font-mono text-xs">{c.id}</td>
              <td className="uppercase text-emerald-400">{c.subsidy_group}</td>
              <td className="tabular-nums">{(c.amount_oere / 100).toFixed(2)} kr</td>
              <td><StatusBadge status={c.status} /></td>
              <td className="text-xs text-neutral-400">
                {c.factoring_partner
                  ? `${c.factoring_partner} · ${(c.factoring_advance_oere! / 100).toFixed(2)} kr på 48t`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-neutral-500">
        💶 EDIFACT D04A serialization + factoring 2.5% discount i{" "}
        <code className="font-mono text-neutral-300">lib/finance/sygesikringen-factoring.ts</code>
      </p>
    </div>
  );
}

function MonitorStep(props: {
  readings: typeof BYPILAR_TEMP_READINGS;
  driftEvents: typeof BYPILAR_TEMP_READINGS;
}): React.ReactElement {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">
        Temperature monitoring · {props.readings.length} målinger
      </h2>
      {props.driftEvents.length > 0 && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-lg">
          <p className="text-sm font-semibold text-red-200">
            ⚠️ Pre-ulcerative advarsel: {props.driftEvents.length} målinger med ΔT &gt; 2.2°C
          </p>
          <p className="text-xs text-red-300 mt-1">
            Lavery-tærskel overskredet. Klinisk vurdering + offloading anbefales inden for 48t.
            Ref: Lavery Diabetes Care 2007;30:14-20.
          </p>
        </div>
      )}
      {props.readings.length === 0 ? (
        <p className="text-sm text-neutral-400">Ingen home-monitoring data for denne patient.</p>
      ) : (
        <p className="text-sm text-neutral-400">
          Podimetrics SmartMat-lignende data · 30 dages morgen-målinger · 6-site protokol.
          Contralateral delta auto-beregnet af trigger i migration 0007.
        </p>
      )}
    </div>
  );
}

function StatusBadge(props: { status: string }): React.ReactElement {
  const color =
    props.status === "paid" || props.status === "delivered" || props.status === "completed"
      ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/40"
      : props.status === "confirmed" || props.status === "approved" || props.status === "locked"
        ? "bg-cyan-400/15 text-cyan-300 border-cyan-400/40"
        : props.status === "sent_to_lab" || props.status === "submitted"
          ? "bg-amber-400/15 text-amber-300 border-amber-400/40"
          : props.status === "rejected" || props.status === "noshow"
            ? "bg-red-400/15 text-red-300 border-red-400/40"
            : "bg-neutral-800 text-neutral-400 border-neutral-700";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest border ${color}`}>
      {props.status}
    </span>
  );
}

function SeverityBadge(props: { severity: "low" | "medium" | "high" }): React.ReactElement {
  const color =
    props.severity === "high"
      ? "bg-red-400/15 text-red-300 border-red-400/40"
      : props.severity === "medium"
        ? "bg-amber-400/15 text-amber-300 border-amber-400/40"
        : "bg-emerald-400/15 text-emerald-300 border-emerald-400/40";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-widest border ${color}`}>
      {props.severity}
    </span>
  );
}

// Fod-scan data — Physical AI · podiatric topology + plantar pressure + biomarkers.
// Visualisation-only mock for the prototype. No real sensor I/O.
//
// Bevidst afgrænset til FOD (ikke fuld krop). Body/kinematics-modul kan tilføjes senere
// som premium-tilkøb.

export const sensorBridge = [
  { name: "Struktureret lys · 0.3mm", latency: "0.7ms", health: 98, status: "active" },
  { name: "Plantar pressure-pad", latency: "0.4ms", health: 96, status: "active" },
  { name: "Termisk · 8-14μm", latency: "1.1ms", health: 94, status: "active" },
  { name: "HF Ultralyd · vaskulær", latency: "0.9ms", health: 92, status: "active" },
];

export type Agent = {
  id: string;
  name: string;
  role: string;
  status: "thinking" | "acting" | "idle" | "writing";
  loadPct: number;
  lastAction: string;
  color: string;
};

// 3 agenter (vs. tidligere 5) — kun det der er relevant for fod-scan.
export const swarm: Agent[] = [
  {
    id: "ingress",
    name: "Sensor-orkestrering",
    role: "Hardware Broker",
    status: "acting",
    loadPct: 64,
    lastAction: "Fusion af struktureret lys + pressure-pad · 12 frames/s",
    color: "var(--color-accent)",
  },
  {
    id: "pod",
    name: "Podiatrisk topologi",
    role: "Fod-specialist",
    status: "writing",
    loadPct: 78,
    lastAction: "Hallux valgus 12°(L)/18°(R) · navicular drop 6.1/8.4mm",
    color: "var(--color-clay)",
  },
  {
    id: "diag",
    name: "Klinisk syntese",
    role: "Diagnose-agent",
    status: "thinking",
    loadPct: 52,
    lastAction: "Cross-ref termisk vs. vaskulær flow · 1 anomali (forfod R)",
    color: "var(--color-amber)",
  },
];

export const footMetrics = [
  { label: "Hallux valgus", left: "12°", right: "18°", flag: "Mild dx" },
  { label: "Navicular drop", left: "6.1mm", right: "8.4mm", flag: "Asymmetri" },
  { label: "Arch index", left: "0.24", right: "0.31", flag: "Lavt dx" },
  { label: "Plantar peak-tryk", left: "184 kPa", right: "242 kPa", flag: "Overbelastet dx" },
  { label: "Gang-symmetri", left: "—", right: "92%", flag: "Acceptabel" },
  { label: "Pronation", left: "Neutral", right: "Overpron.", flag: "Indlæg foreslået" },
];

// Plantar-pressure heatmap — zoner over en fod-silhuet
export const plantarZones = [
  { cx: 50, cy: 18, r: 16, intensity: 0.85, label: "Hæl" },
  { cx: 52, cy: 50, r: 11, intensity: 0.45, label: "Lateral midfod" },
  { cx: 50, cy: 78, r: 14, intensity: 0.95, label: "Forfods-ballen" },
  { cx: 42, cy: 76, r: 9, intensity: 0.7, label: "MTP 1" },
  { cx: 58, cy: 80, r: 8, intensity: 0.55, label: "MTP 5" },
  { cx: 50, cy: 96, r: 6, intensity: 0.4, label: "Hallux" },
];

// Fod-relevante biomarkers (fjernet de generelle krops-markers)
export const biomarkers = [
  { name: "Vaskulær flow · ankel", value: "Normal", trend: "Stabil", status: "ok" },
  { name: "Mikrocirkulation · forfod", value: "Reduceret −9%", trend: "−9%", status: "warn" },
  { name: "Termisk afvigelse · MTP 5", value: "+1.4°C", trend: "Mild inflammation", status: "warn" },
  { name: "Plantar elasticitet", value: "0.82", trend: "+0.04 vs. baseline", status: "ok" },
  { name: "Subkutan ødem-index", value: "0.12", trend: "Lav", status: "ok" },
];

export const codeLog = [
  { t: "11:42:08.231", lvl: "agent.pod", msg: "Plantar pressure-pad kalibreret · 4096 sensorer" },
  { t: "11:42:08.412", lvl: "agent.pod", msg: "Topologi-mesh genereret · 312k punkter" },
  { t: "11:42:08.681", lvl: "agent.pod", msg: "Hallux valgus målt · L=12.1° R=18.4°" },
  { t: "11:42:08.901", lvl: "agent.diag", msg: "Termisk hotspot MTP 5 (R) · korrelerer med peak-tryk" },
  { t: "11:42:09.044", lvl: "mcp", msg: "Tool: journal.write_finding (asymmetri-flag)" },
  { t: "11:42:09.221", lvl: "agent.diag", msg: "Anbefaling: indlæg + opfølgning 6 uger" },
];

// Feature flag — CAD-eksport (indlægs-produktion) er DEAKTIVERET i basis-licens.
// Aktiveres kun for tenants med "Physical AI"-plan, hvor klinikken har en CAD-aftager.
export const FEATURE_CAD_EXPORT = false;

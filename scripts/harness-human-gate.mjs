#!/usr/bin/env node
/**
 * Harness-HumanGate scaffold — LUNA → ranked spike → draft PR workflow.
 *
 * HARD-CODED: NO_AUTO_MERGE = true. This script never merges to main,
 * never deploys, and never enables active routing.
 *
 * Usage:
 *   node scripts/harness-human-gate.mjs
 *   node scripts/harness-human-gate.mjs --spike CaptureGate-Σ
 *
 * Output: prints a ranked spike draft note + next human steps.
 * Does not push, merge, or set privacy/shadow env flags.
 */

const NO_AUTO_MERGE = true;
const NO_AUTO_DEPLOY = true;
const NO_ACTIVE_ROUTING = true;

const SPIKES = [
  {
    id: "PrivacyUnlock-Σ",
    priority: 81.0,
    status: "blocked_on_broser_dpa",
    action: "Complete docs/vision/privacy-gate-broser-checklist.md — do not fake DPA",
  },
  {
    id: "CaptureGate-Σ",
    priority: 72.0,
    status: "implemented_shadow",
    action: "Review vision.capture_gate.shadow audits; threshold 70 untouched",
  },
  {
    id: "ShadowFlywheel",
    priority: 72.0,
    status: "flag_off_until_privacy",
    action: "Keep PRAXIS_SHADOW_EVAL_ENABLED=false until privacy gate PASS",
  },
  {
    id: "TriView-Lift",
    priority: 64.0,
    status: "scaffolded_flag_off",
    action: "Keep PRAXIS_TRIVIEW_SHADOW_ENABLED=false; live pin firtoz/trellis",
  },
  {
    id: "Harness-HumanGate",
    priority: 63.0,
    status: "this_script",
    action: "Draft PR only; humanApproveTask + SWARM_APPROVE_TOKEN required",
  },
];

function parseSpikeArg(argv) {
  const idx = argv.indexOf("--spike");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return null;
}

function main() {
  if (NO_AUTO_MERGE !== true || NO_AUTO_DEPLOY !== true || NO_ACTIVE_ROUTING !== true) {
    console.error("FATAL: invariants corrupted — refusing to run");
    process.exit(2);
  }

  const wanted = parseSpikeArg(process.argv.slice(2));
  const ranked = [...SPIKES].sort((a, b) => b.priority - a.priority);
  const focus = wanted
    ? ranked.find((s) => s.id.toLowerCase() === wanted.toLowerCase())
    : ranked.find((s) => s.status !== "blocked_on_broser_dpa") ?? ranked[0];

  const note = {
    workflow: "Harness-HumanGate",
    invariants: {
      NO_AUTO_MERGE,
      NO_AUTO_DEPLOY,
      approved_for_active_routing: false,
      SCAN_QUALITY_THRESHOLD: 70,
    },
    steps: [
      "1. LUNA research harvest (lib/swarm/s-agents → runResearchHarvest)",
      "2. Rank spike against docs/vision/alphaxiv-aurelle-transcript-impact.md",
      "3. FELIX/ATLAS draft in worktree (branch cursor/swarm-*-2c11)",
      "4. FREJ gate",
      "5. humanApproveTask with SWARM_APPROVE_TOKEN — NEVER auto-merge to main",
    ],
    ranked_spikes: ranked,
    focus_spike: focus ?? null,
    forbidden: [
      "overnight auto-merge daemon to main",
      "enable PRAXIS_SHADOW_EVAL_ENABLED without privacy PASS",
      "set approved_for_active_routing true",
      "fake PRAXIS_VISION_DPA_SIGNED",
      "MonoMSK as clinical GT",
      "nail SSS as clinical path",
    ],
  };

  console.log(JSON.stringify(note, null, 2));
  console.log("\n# Draft PR title suggestion");
  console.log(
    `draft: ${focus?.id ?? "spike"} — shadow-only (NO_AUTO_MERGE; routing OFF)`,
  );
  console.log("\n# Stop — human must approve. This script will not merge.");
}

main();

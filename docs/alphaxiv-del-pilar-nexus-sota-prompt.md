# AlphaXiv-prompt · Del Pilar Nexus → state of the art

Kopiér blokken herunder ind i AlphaXiv (deep ask / research chat) eller kør som LUNA harvest-brief.
Passer til PraxisOS research tracks: `foot_scanner`, `vlm_detection`, `nail_materials`, `agent_swarm`, `mdr_safety`.

Companion: `docs/roboflow-del-pilar-nexus-prompt.md` (custom CV models).

---

## Prompt (kopiér fra her)

```
You are AlphaXiv research lead for Del Pilar Nexus (PraxisOS) — a live clinical
foot-scan stack for Danish podiatry clinics (fodpleje), pilot clinic by Pilar,
white-label (no PraxisOS branding on customer hosts). Broser owns platform/API.

MISSION
Research the absolute cutting edge (arXiv + AlphaXiv similar papers + recent CVPR/
MICCAI/SIGGRAPH/ICLR/NeurIPS where relevant) and propose VANVITTIGE but ENGINEERING-
ACTIONABLE developments that could make Del Pilar Nexus unmistakably state of the art
within 1–2 implementation waves — not a wishlist of vaporware.

WHAT WE ALREADY SHIP (do not rediscover — extend or leapfrog)
Live production path on app.bypilar.dk/scan with liveReady providers:

Pipeline (ARIA master orchestrator → S-Agent):
1. Roboflow foot isolation — currently Universe `foot-segmentation-ehn9q/1`
2. Roboflow pathology — Universe `foot-ulcer/1` + `wounds-detection/1`
   (custom Roboflow projects planned: foot-seg / pathology / landmarks)
3. Replicate 3D lift — `firtoz/trellis` → remote GLB
4. MonoMSK kinematic proxy — arch strain MPa, torsion N·m, pronation force from
   synthesized landmark stream (not true force-plate yet)
5. Quality gate A–F — PASS requires remote live mesh + foot detected + score ≥70
6. Journal SOAP writeback — AI findings marked ai_generated; clinician confirms
7. Swarm extras — LUNA arXiv harvest, NINA neural rendering brief, FELIX self-coder,
   AlphaXiv research tracks already seeded (foot_scanner, vlm_detection,
   nail_materials, agent_swarm, mdr_safety)

HARD PRODUCT / REGULATORY CONSTRAINTS
- MDR / CE mindset: Class IIa risk when outputs look like diagnosis → fail-closed,
  shadow mode, audit logs, no silent auto-diagnosis.
- GDPR Art. 9 health data; EU hosting; de-identify research datasets.
- byPilar ≠ PraxisOS B2B branding on customer UI.
- AI findings are suggestions only.
- Prefer methods that plug into our existing contracts:
  - Roboflow detect API → {class,confidence,x,y,width,height}
  - Replicate models API → mesh URL
  - Next.js/Supabase/Hetzner self-host
- Phone-camera clinic capture first; structured light / pressure pad later as addon.

RESEARCH TRACKS TO COVER (map every proposal to one+)
A. foot_scanner — 3D/4D reconstruction, Gaussian splatting, feed-forward mesh,
   watertight topology, orthotic CAD, monocular metric scale, plantar pressure from RGB
B. vlm_detection — MedSAM / foundation VLMs, open-vocab lesion candidates,
   uncertainty, active learning with Roboflow review queue
C. nail_materials — SSS / spectral materials for photoreal atelier (separate from MDR
   clinical path, but shared viewer)
D. agent_swarm — long-horizon research→code agents that propose PRs with MDR gates
E. mdr_safety — shadow evaluation, kappa vs clinician, drift/CUSUM, bias across skin tones

WHAT “VANVITTIGT MEN BYGGBART” MEANS
Propose 8–12 developments ranked by (Impact × Feasibility / MDR_risk).
For EACH development include:
1) Codename (memorable)
2) One-sentence pitch (why SOTA, not incremental)
3) Key papers (arXiv IDs + AlphaXiv abs links if possible) — prefer ≤18 months old
   plus 1–2 canonical classics if needed
4) Leap over our current stack (exactly what it replaces/extends: Roboflow stage,
   Trellis, MonoMSK, quality gate, viewer, swarm)
5) Minimal viable spike (1 PR / 1 weekend / 1 Hetzner GPU job) — concrete
6) Data needed (how many clinic images, sensors, labels)
7) MDR posture: class_0 / shadow / locked until CE
8) Kill criteria (when to abandon)
9) Estimated wow-factor for a fodplejer demo (1–10)

STRETCH THEMES TO FORCE (at least touch these)
- Feed-forward image→3D (Trellis alternatives: LRM, InstantMesh, TripoSR successors,
  Gaussian avatar / 4D GS for gait clips from phone video)
- Metric scale recovery without checkerboard (IMU+homography, object priors, foot length)
- RGB→plantar pressure / shear surrogate (physics-informed nets, pressure datasets)
- Temporal progression: same foot across visits, lesion change heatmaps
- Open-vocabulary VLM that proposes Roboflow classes then human-confirms
- Uncertainty-aware quality gate (calibrated confidence → HOLD/PASS)
- On-device / Edge path for offline hjemmebesøg (felt module)
- Synthetic-to-real: generate annotated feet for Roboflow bootstrapping (diffusion + control)
- Orthotic export: watertight mesh → printable insole candidate (CAD-safe)
- Multi-view phone capture ritual (3 angles) beating single-shot Trellis
- Skin-tone robustness + nail-polish confounders as first-class eval slice
- “Living Organism” loop: LUNA harvest → ranked spike → FELIX worktree PR → human merge

OUTPUT FORMAT (STRICT)
## 1. Executive verdict
What would make Nexus SOTA in 90 days if we only pick THREE bets?

## 2. Ranked developments table
| Rank | Codename | Track | Wow | Feasibility | MDR | Spike size |

## 3. Deep dives (top 5)
Full template fields 1–9 above.

## 4. Paper pack
Bulleted arXiv IDs with 1-line why each matters to Nexus.

## 5. Anti-recommendations
3 hyped ideas we should NOT chase yet (and why).

## 6. Next 14-day Broser plan
Day-by-day engineering checklist Michael’s agent can execute
(env keys already set: Replicate + Roboflow; Hetzner app.bypilar.dk live).

Tone: ambitious, technically precise, hostile to buzzwords without a spike path.
Language: English for research precision; keep clinical disclaimers explicit.
```

---

## Sådan bruger du den

1. AlphaXiv deep ask / research chat → paste prompt  
2. Eller PraxisOS: Research track `foot_scanner` / `vlm_detection` med brief = promptens MISSION  
3. Send AlphaXiv’s top-3 bets tilbage hertil — så prioriterer jeg spikes i koden

## Nuværende harvest-query (LUNA default)

```
(ti:"diabetic foot" OR ti:"plantar pressure" OR ti:"gaussian splatting" OR ti:MonoMSK OR ti:"subsurface scattering")
```

Prompten ovenfor er bevidst bredere end den query — den skal presse AlphaXiv til SOTA-forslag, ikke kun papers der matcher titlen.

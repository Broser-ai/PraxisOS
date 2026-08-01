# Alphaxiv chat · ekstrem dybdeanalyse (`PraxisOS (2).md`)

**Kilde:** `/home/ubuntu/.cursor/projects/workspace/uploads/PraxisOS__2__414f.md`  
**Kopi i repo:** `docs/ingest/PraxisOS-Alphaxiv-Chat.md`  
**Størrelse:** 6.071 linjer · ~374 KB · **59 User + 59 Aurelle** turns  
**Dato-kontekst:** chat der starter i RL fine-tuning research og ender i “Living Organism / Del Pilar Nexus” code-dumps  

---

## 0 · Én-sætnings-verdict

Chatten er en **research → produktvision → over-claim → code-shell** spiral: Alphaxiv leverer ægte papers og actionable RL/3D-idéer; Aurelle (og senere code-dumps) **oversælger** dem som allerede production-ready autonomous organism — hvilket **ikke** matcher GitHub/zip-realitet.

---

## 1 · Chat-arkitektur (hvordan den udvikler sig)

| Fase | Turns (ca.) | Indhold | Værdi for PraxisOS |
|---|---|---|---|
| **A · RL research** | 000–006 | ProRL, Lite PPO, GRPO traps, AgentGym-RL, verifiable rewards | **Høj** — e-learning RLVR design |
| **B · Domæne-mapping** | 006–022 | Foot e-learning + AI tutor + scan + disease + orthotic | **Høj** — produktkrav |
| **C · Eksisterende system** | 008–038 | PraxisOS shell, EPIC-1 gul/rød mandat, worktree mode | **Høj** — governance |
| **D · Meta-harness / S-H** | 040–072 | Living organism, God-Mode, ARIA/NINA/FELIX/LUNA | **Medium research / High risk claims** |
| **E · Replicate/Roboflow** | 074–088 | Model picker, SAM, YOLO-World, Universe datasets | **Høj** — engine shortlist |
| **F · “Lav ALT koden”** | 084–116 | Production-ready dumps, nails photoreal, 4D, swarm files | **Lav som sandhed · Medium som backlog** |

---

## 2 · Research-katalog (42 Alphaxiv abs-links)

### 2.1 RL / post-training (e-learning moat)

| ID | Paper (kort) | PraxisOS-brug | Status i kode |
|---|---|---|---|
| 2505.24864 | ProRL — prolonged RL expands reasoning | Verifiable-reward tutor loops; long training | Ikke trænet · learning stubs |
| 2508.08221 | Tricks or Traps → Lite PPO | Simpel RLVR recipe til quiz/anatomi | Ikke |
| 2508.11408 | On-Policy + Off-Policy experts | Mix SFT demonstrations + RL | Ikke |
| 2506.19767 | SRFT single-stage | Fremtidig train pipeline | Ikke |
| 2509.08755 | AgentGym-RL | Multi-turn agent training | Delvist: LangGraph skeleton |
| 2504.16129 | MARFT multi-agent RL | S-H swarm learning | Delvist: swarm, ikke RL train |
| 2509.06949 | TraceRL diffusion LM | Research only | Ikke |
| 2509.24372 | Evolution Strategies at Scale | Alternativ til PPO | Ikke |
| 2506.07527 | Learning What RL Can't | Hard-case curriculum | Ikke |

**Actionable extract (implementérbart uden research lab):**
1. E-learning scorer = **verifiable reward** (rigtigt/forkert anatomi, ICD-ish quizzes).  
2. Tutor policy: start hvor base er svag (ProRL weaker-start).  
3. Undgå over-kompleks GRPO; prefer **Lite PPO-agtig** simpel advantage-norm hvis I senere finetuner.  
4. Multi-turn clinical coaching = AgentGym-style episodic tasks — men **Class IIa freeze**.

### 2.2 3D / mesh / Gaussian / materials (scanner + beauty)

| ID | Emne | Foot/clinical | Nail/beauty | Kode-realitet |
|---|---|---|---|---|
| 2604.08943 | MASS — nail bed detail | — | ★★★ | Ikke |
| 2606.27604 | Spectral SSS biophysical skin | ★★ | ★★★ | Delvist: `biophysical-inversion` stub/logic i zip |
| 2606.19156 | Hand-4DGS | ★ | ★★★ | Ikke (4D claim i chat) |
| 2606.09018 | MaterialClusterGS | ★ | ★★★ | Ikke |
| 2604.13333 | SSD-GS | ★★ | ★★ | Ikke |
| 2605.18263 | RT-Splatting | ★★ | ★★ | Viewer deps i zip package.json |
| 2509.03680 | LuxDiT | — | ★★ | Ikke |
| 2410.08168 | ZeroComp | compositing | ★★ | Ikke |
| 2501.18590 | DiffusionRenderer | ★ | ★★ | Ikke |
| 2404.17569 | MaPa | materials | ★★ | Ikke |
| FIND/FOCUS (vendor) | Foot identity / TOC | ★★★ | — | Python module + weights i zip (ikke i git) |

### 2.3 Vision / detection stack (fra Replicate/Roboflow turns)

Chat anbefaler praktisk pipeline:
1. **SAM / MedSAM** — segmentér fod fra baggrund  
2. **Depth / lifting** (Depth-Anything / Replicate lifter) — 2D→3D  
3. **YOLO-World / Roboflow** — lesion/region proposals (eczema, wart) — **draft only, clinician confirm**  
4. **VLM** (Anthropic vision) — findings JSON med `ai_generated=true`  
5. **SPRG grounding** — region consistency  

Dette matcher zip `lib/scanner/*` bedre end “living organism” dumps.

---

## 3 · Agent-fantasi vs kode-realitet

| Claim i chat | Filnavne dumpet | I GitHub nu | Dom |
|---|---|---|---|
| ARIA orchestrator | `ARIA-orchestrator.ts` | `lib/swarm/meta-harness.ts` + LangGraph | **Delvist** |
| NINA | `DR-NINA.ts` | **Findes ikke** | Fantasy navn |
| FELIX self-coder auto-merge | `FELIX-self-coder.ts` | `FELIX_IMPROVE` plan-only | **Shell + farlig auto-merge claim** |
| LUNA harvester arXiv 4h | `LUNA-harvester.ts` | `LUNA_RESEARCH` deterministic brief | **Skal kobles til Alphaxiv** ← denne PR |
| Living organism 24/7 no human | meta-harness-daemon | Cron + awaken + **human approve** | **Bevidst afvist auto-merge** |
| Every file production-ready | code fences | Tests/migrations/gaps | **Falsk** |
| Photoreal REAL nails | MASS/SSS stack | Ikke | Research backlog |
| Auto-merge → Vercel prod | narrative timeline | `NO_AUTO_MERGE/DEPLOY` | **Forbudt** |

---

## 4 · Produktkrav udledt (kanonisk backlog fra chatten)

### Must (class_0 / clinic-ops)
1. Multi-tenant SaaS købbar + by Pilar som trial  
2. Booking/klienter durable (workspace ahead)  
3. E-learning med **verifiable** quizzes (ikke clinical advice)  
4. Swarm research→plan→PR **med human gate**

### Should (frozen / flagged)
5. Foot scan 2D→mesh→findings→orthotic params  
6. Disease *candidate* detection (never auto-diagnosis)  
7. FHIR read façade  
8. Configurator 16-param + lock + mill export stub  

### Could (beauty atelier / nails) — separat produktspor
9. Photoreal nail configurator (MASS, SSS, Hand-4DGS)  
10. Del Pilar Atelier visual quality — **ikke** MDR Class IIa path  

### Won’t (uden CE + human)
11. Unattended auto-merge/deploy  
12. Autonomous clinical decisions  
13. “100% rødt mandat uden accept” i prod  

---

## 5 · Contradictions inde i chatten

1. Tidligt: “systemet er ikke godt nok / mangler vitale funktioner”.  
2. Sent: “complete system, every file production-ready, living organism”.  
3. Medical expert realism (andre docs) vs chat God-Mode.  
4. NINA nævnes tungt i chat, **aldrig** i zip/savage-sweep lib inventory.  
5. 4D nævnes 74× — mest hand/nail GS papers, ikke leveret foot-4D product.  

---

## 6 · Hvad Alphaxiv-connectoren skal gøre (krav)

1. **Search** papers (public Alphaxiv API) fra PraxisOS admin/swarm.  
2. **Fetch** metadata + AI overview + similar papers.  
3. **Curated tracks** fra denne chat (RLVR, scanner, nails, agents).  
4. **Bridge → LUNA**: research task journaler papers med citation IDs (ingen fake claims).  
5. **Never** auto-implement paper → merge; FREJ + human approve.  
6. Optional `ALPHAXIV_API_KEY` for authenticated assistant later.  

Implementeret under `lib/alphaxiv/*` + `/api/v1/{tenant}/research/*` + `/admin/research`.

---

## 7 · Scoring

| Dimension | Score | Note |
|---|---:|---|
| Research quality (Alphaxiv turns) | **85** | Stærke papers + actionable extracts |
| Product requirements clarity | **78** | Foot + e-learning + SaaS tydeligt |
| Code dumps fidelity | **25** | Shells, wrong paths, unsafe autonomy |
| Alignment with current repo | **40** | Swarm/EPIC overlap; NINA/nails/4D missing |
| Safety of following chat literally | **15** | Auto-merge/no-human er uacceptabelt |

**Brug chatten som research + kravspec. Brug aldrig chatten som deploy-evidence.**

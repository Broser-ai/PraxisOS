# LoRA status · PraxisOS

**Verdict: not in tree · intentionally deferred**

## Search results

| Source | Finding |
|--------|---------|
| PraxisOS `lib/*`, `agents/*`, tests | **No** LoRA / PEFT / adapter training modules |
| PR #27 Prime RL | RLVR quiz + policy suggestions only; `PRIME_INVARIANTS.NO_MODEL_TRAINING === true` |
| Monorepo research gap | No LoRA MERGE_NOW item; voice “adapter” = interface adapters only |
| Google Drive notes | Mentions of external **Tinker/Inkling** LoRA fine-tune and “Cirkel-Vision = LoRA on Qwen3-VL” as *future research* — not ported code |

## Why no stub trainer

Prime and swarm hard-lock **no model training** from this scaffold (no ProRL / Lite PPO / LoRA weight writes, no vendor `.pth` dumps). Clinical pathology stays shadow + suggestion-only.

## When Broser unlocks LoRA later

1. Flip requires explicit Broser decision + separate PR (not env alone).
2. Keep adapters **out of** clinical diagnosis path until CE / privacy gates.
3. Prefer external trainer (e.g. Tinker) with human-gated promotion — never overnight auto-train from Autonom.
4. Do not merge Clerk Ethos or unreviewed weight dumps.

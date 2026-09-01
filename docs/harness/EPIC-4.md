> **Archive port (additive)** · Source: Google Drive monorepo checkout `praxisos/` (juli 2026 snapshot). GitHub monorepo remote was 404. Historical / human-track material — **not** live production SoT. Do not treat claims here as current product behavior without verifying against `main` code.
>
> Ported for Michael Ambrosius (Broser) · PraxisOS · no Clerk · no vendor weights · no prod DB flip.

Adaptive E-Learning Platform ("Selv den dummeste kan lære det")
Fordi I allerede har en Multi-Tenant struktur (tenants-tabellen), opretter vi E-learning som et separat "Modul", klinikker eller skoler kan slå til.

Dette skal bygges:

Et "Tutor Dashboard" på frontend under /t/[tenant]/portal/learning.
Implementering af "Reflexion" og Feynman-teknikken i en AI-Tutor prompt-kæde.
Tutor-agenten skal have adgang til pgvector for at slå op i medicinske lærebøger (RAG), før den svarer eleven.
Prompt til Claude Code:
"Claude, vi starter Epic 4: E-learning Modulet. Opret en ny route-gruppe under app/(internal)/learning. Byg et UI, hvor en elev kan tage interaktive tests. Forbind dette til vores nye 'Tutor' agent (fra Epic 1). Tutor-agenten SKAL bruge 'Feynman-teknikken' i sit system-prompt og tilpasse sværhedsgraden dynamisk baseret på elevens forrige svar (hentet fra Supabase). Opret test-cases, der verificerer, at AI'en aldrig giver forkerte anatomiske fakta."

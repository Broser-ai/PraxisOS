> **Archive port (additive)** · Source: Google Drive monorepo checkout `praxisos/` (juli 2026 snapshot). GitHub monorepo remote was 404. Historical / human-track material — **not** live production SoT. Do not treat claims here as current product behavior without verifying against `main` code.
>
> Ported for Michael Ambrosius (Broser) · PraxisOS · no Clerk · no vendor weights · no prod DB flip.

The Neural Configurator & Aesthetics (Visuel Hyper-realisme)
PraxisOS henvender sig også til æstetik/skønhed (som jeres demo-kunde "Nordlys"). Her skal vi have den fotorealistiske AR-konfigurator ind (DiffusionRenderer, Biophysical Skin Inversion).

Dette skal bygges:

Udskift standard WebGL med Gaussian Splatting viewere i frontenden (SkinScan.tsx og FootMesh3D.tsx).
Agentisk VLM UI: Et tekstfelt, hvor brugeren kan skrive "Vis hvordan behandlingen/produktet vil se ud", hvorefter systemet genererer et PBR-materiale lagt perfekt over patientens rigtige hud.
Prompt til Claude Code:
"Claude, vi starter Epic 3: Neural Rendering. Opdater vores UI-komponenter til at understøtte 3D Gaussian Splatting (fx via @react-three/drei og gaussian-splatting libraries). Tilføj en 'DiffusionRenderer' webhook i vores API, som tager et billede fra klienten og lægger AI-genererede æstetiske behandlinger (texture/displacement) på, med korrekte sub-surface scattering effekter (hud-integration). Sørg for at integrere dette flot i vores Tailwind v4 designsystem."

> **Archive port (additive)** · Source: Google Drive monorepo checkout `praxisos/` (juli 2026 snapshot). GitHub monorepo remote was 404. Historical / human-track material — **not** live production SoT. Do not treat claims here as current product behavior without verifying against `main` code.
>
> Ported for Michael Ambrosius (Broser) · PraxisOS · no Clerk · no vendor weights · no prod DB flip.

Epic 2: The Clinical AI (Fodscanner, Diagnostik & CAD)
Her bygger vi S-Agent flowet, sygdomsgenkendelse og automatiske sål-indlæg ovenpå jeres FootScan.tsx og lib/scan.ts.

Dette skal bygges:

S-Agent lifting (2D video til præcis 3D Punktsky).
Medical VLM integration for at markere eksem, ligtorne og vorter via bounding-boxes i UI'et.
FEATURE_CAD_EXPORT=true: En Python/Node-mikroservice, der tager 3D-punktskyen og genererer en klar .STL fil til 3D-print.
Prompt til Claude Code:
"Claude, vi starter Epic 2: Clinical Diagnostics & CAD. Omskriv components/FootScan.tsx til at modtage videostreams. Byg en API-route, der sender streamen til en Medical VLM for anomali-detektion (vorter, eksem). Tilføj et CAD-genereringsmodul i lib/scan.ts, der konverterer den metriske 3D data til en .STL fil beregnet til endlæg. Alt skal overholde vores RLS-policies for scans-tabellen."

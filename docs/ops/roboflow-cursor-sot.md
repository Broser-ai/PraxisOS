# Roboflow · Cursor source of truth (ops)

**Ejer:** Broser / Michael  
**Formål:** Undgå dobbelt MCP-wiring og blanding af agent-auth med app-inference-nøgler.

## Agent-tooling = Cursor Roboflow-plugin MCP

- **Source of truth** for Roboflow-værktøjer i Cursor er **Cursor Roboflow-pluginets MCP** (desktop).
- Projektet skal **ikke** have en parallel `.cursor/mcp.json` med Roboflow, så længe pluginet er installeret og autentiseret hos Michael.
- Genindfør kun projekt-`mcp.json` for Roboflow hvis pluginet er utilgængeligt og der er et eksplicit behov — ellers risikerer man duplikat-servere / forvirrende auth.

## Skills (computer vision)

Tilføjet via:

```bash
npx skills add roboflow/computer-vision-skills -a cursor
```

| Placering | Indhold |
|-----------|---------|
| `.agents/skills/roboflow-*` | Lokale skill-mapper (api-reference, inference, universe, …) |
| `skills-lock.json` | Pin/hash af installerede skills fra `roboflow/computer-vision-skills` |

Skills er agent-vejledning; de erstatter ikke runtime-inference i appen.

## MCP-auth ≠ serverless API-nøgle

| Lag | Auth / secret | Bruges til |
|-----|---------------|------------|
| Cursor Roboflow MCP (plugin) | Plugin-/MCP-login (desktop SoT) | Agent-værktøjer, Universe/workspace-opslag i IDE |
| Scan-pipeline (app) | `ROBOFLOW_API_KEY` i `/data/secrets.json` (eller env) | Serverless inference i PraxisOS — **ikke** MCP |

Bland ikke nøglerne: MCP-sessionen er ikke scan-pipelineens nøgle, og omvendt.

Se også model-registry: `docs/vision/model-registry.md` (secrets / pins).

## Cloud agents

Cloud-/baggrundsagenter kan se Roboflow MCP som `needsAuth`. Det er forventet, når plugin-auth kun findes på Michaels desktop. Agenter skal ikke “fikse” det ved at genoprette projekt-`mcp.json` eller committe secrets — brug desktop-pluginet som SoT, eller arbejd uden MCP-kald.

## Må ikke

- Committe API-nøgler, tokens eller `secrets.json`
- Ændre production routing / model-pins uden Broser promotion pack
- Duplikere Roboflow MCP i repoet “for cloud agents” uden aftale

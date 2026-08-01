# Alphaxiv connector · PraxisOS

Interaktiv deep-research bro mellem Alphaxiv og PraxisOS (LUNA /admin/research / swarm).

## Formål

Alphaxiv leverer papers og (med API-key) Assistant-svar om ting der **endnu ikke** er launched.  
PraxisOS må **kun** bruge det som citations + backlog — aldrig auto-implement/merge.

## Env

| Variabel | Betydning |
|---|---|
| `ALPHAXIV_ENABLED` | `0` = stub/catalog only · default live uden for tests |
| `ALPHAXIV_API_KEY` | Bearer til authenticated Assistant / folders (valgfri for public search) |
| `ALPHAXIV_LIVE` | `1` i tests for at tvinge live HTTP |

## Endpoints (staff session)

| Method | Path | Funktion |
|---|---|---|
| GET | `/api/v1/{tenant}/research?view=tracks` | Curated tracks fra chatten |
| GET | `/api/v1/{tenant}/research?view=harvest&track=&q=` | Search + similar expand |
| POST | `/api/v1/{tenant}/research` | Harvest → LUNA journal |
| POST | `/api/v1/{tenant}/research/ask` | Deep Ask: topics + harvest + overview + Assistant |
| GET | `/api/v1/{tenant}/research/papers/{arxivId}` | Paper metadata |

## UI

`/admin/research` — Search · Harvest → LUNA · **Deep Ask (similar + Assistant)**

## Swarm

`LUNA_RESEARCH` kalder `runResearchHarvest()` automatisk på research-tasks (daemon agenda + savage).

## Sikkerhed

- `NO_AUTO_MERGE` / `NO_AUTO_DEPLOY` uændret  
- Assistant-svar journalføres som learning — ikke kode  
- Fantasy-paths: `lib/alphaxiv/chat-claims.ts` → `FANTASY_PATHS`  
- Deep audit af `PraxisOS (2).md`: `docs/ALPHAXIV-CHAT-DEEP-AUDIT.md`

## Public Alphaxiv API (brugt)

Fra observeret inventory (alphaxiv-py):

- `GET /search/v2/paper/fast`
- `GET /v1/search/paper` (rich)
- `GET /v1/search/closest-topic`
- `GET /papers/v3/legacy/{id}`
- `GET /papers/v3/{id}/similar-papers`
- `GET /papers/v3/{versionId}/overview/{lang}`
- `POST /assistant/v2/chat` (auth · SSE)

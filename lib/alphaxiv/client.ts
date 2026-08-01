// Alphaxiv HTTP client — public search/metadata (+ optional API key)

import type { AlphaxivPaper } from "@/lib/alphaxiv/types";
import { alphaxivAbsUrl } from "@/lib/alphaxiv/catalog";

const API_BASE = "https://api.alphaxiv.org";

export function isAlphaxivLiveEnabled(): boolean {
  if (process.env.ALPHAXIV_ENABLED === "0") return false;
  if (process.env.ALPHAXIV_ENABLED === "1") return true;
  // Default: try live in non-test; tests use stub unless ALPHAXIV_LIVE=1
  if (process.env.NODE_ENV === "test" && process.env.ALPHAXIV_LIVE !== "1") {
    return false;
  }
  return true;
}

function authHeaders(): HeadersInit {
  const key = process.env.ALPHAXIV_API_KEY?.trim();
  if (!key || key === "[SENSITIVE]" || key.includes("SENSITIVE")) return {};
  return { authorization: `Bearer ${key}` };
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function pickArxivId(raw: Record<string, unknown>): string {
  const candidates = [
    raw.canonicalId,
    raw.canonical_id,
    raw.arxivId,
    raw.arxiv_id,
    raw.id,
    raw.paperId,
  ];
  for (const c of candidates) {
    const s = asString(c);
    if (!s) continue;
    const m = s.match(/(\d{4}\.\d{4,5})/);
    if (m) return m[1]!;
  }
  return "unknown";
}

function normalizePaper(raw: Record<string, unknown>): AlphaxivPaper {
  const arxivId = pickArxivId(raw);
  const title =
    asString(raw.title) ||
    asString(raw.name) ||
    asString((raw.paper as Record<string, unknown> | undefined)?.title) ||
    `Paper ${arxivId}`;
  const authorsRaw = raw.authors ?? raw.authorNames;
  const authors = Array.isArray(authorsRaw)
    ? authorsRaw
        .map((a) =>
          typeof a === "string"
            ? a
            : asString((a as Record<string, unknown>).name) ?? "",
        )
        .filter(Boolean)
    : undefined;

  return {
    id: asString(raw.universalId) || asString(raw.paperVersionId) || arxivId,
    arxivId,
    title,
    abstract: asString(raw.abstract) || asString(raw.summary),
    authors,
    url: alphaxivAbsUrl(arxivId),
    publishedAt: asString(raw.publishedAt) || asString(raw.date),
    summary: asString(raw.summary) || asString(raw.tldr),
    source: "alphaxiv",
  };
}

async function getJson(path: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        accept: "application/json",
        ...authHeaders(),
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function extractPaperList(payload: unknown): Record<string, unknown>[] {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.filter((x) => x && typeof x === "object") as Record<
      string,
      unknown
    >[];
  }
  if (typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  for (const key of ["papers", "results", "items", "data", "hits", "cards"]) {
    const v = obj[key];
    if (Array.isArray(v)) {
      return v.filter((x) => x && typeof x === "object") as Record<
        string,
        unknown
      >[];
    }
  }
  // nested search response
  if (obj.paper && typeof obj.paper === "object") {
    return [obj.paper as Record<string, unknown>];
  }
  return [];
}

/** Public fast search — falls back through known Alphaxiv search routes. */
export async function searchAlphaxivPapers(
  query: string,
  limit = 8,
): Promise<{ papers: AlphaxivPaper[]; live: boolean; route?: string }> {
  const q = encodeURIComponent(query.slice(0, 200));
  const routes = [
    `/search/v2/paper/fast?q=${q}&includePrivate=false`,
    `/v1/search/paper?q=${q}`,
  ];

  if (!isAlphaxivLiveEnabled()) {
    return { papers: [], live: false };
  }

  for (const route of routes) {
    const json = await getJson(route);
    const list = extractPaperList(json)
      .map(normalizePaper)
      .filter((p) => p.arxivId !== "unknown")
      .slice(0, limit);
    if (list.length > 0) {
      return { papers: list, live: true, route };
    }
  }
  return { papers: [], live: false };
}

export async function getAlphaxivPaper(
  arxivId: string,
): Promise<AlphaxivPaper | null> {
  const bare = arxivId.replace(/v\d+$/i, "");
  if (!isAlphaxivLiveEnabled()) {
    return {
      id: bare,
      arxivId: bare,
      title: `Catalog paper ${bare}`,
      url: alphaxivAbsUrl(bare),
      source: "catalog",
    };
  }

  const routes = [
    `/papers/v3/legacy/${bare}`,
    `/papers/v3/${bare}`,
    `/papers/v3/${bare}/preview`,
  ];
  for (const route of routes) {
    const json = await getJson(route);
    if (!json || typeof json !== "object") continue;
    const obj = json as Record<string, unknown>;
    const paperObj =
      typeof obj.paper === "object" && obj.paper
        ? (obj.paper as Record<string, unknown>)
        : obj;
    const paper = normalizePaper(paperObj);
    if (paper.arxivId !== "unknown" || paper.title) {
      paper.arxivId = paper.arxivId === "unknown" ? bare : paper.arxivId;
      paper.url = alphaxivAbsUrl(paper.arxivId);
      return paper;
    }
  }
  return null;
}

export async function getAlphaxivOverview(
  arxivId: string,
  lang = "en",
): Promise<string | null> {
  if (!isAlphaxivLiveEnabled()) return null;
  const bare = arxivId.replace(/v\d+$/i, "");
  // Need paper-version UUID ideally; try legacy then overview via version id fields
  const meta = await getJson(`/papers/v3/legacy/${bare}`);
  if (!meta || typeof meta !== "object") return null;
  const obj = meta as Record<string, unknown>;
  const versionId =
    asString(obj.paperVersionId) ||
    asString(obj.versionId) ||
    asString((obj.paper as Record<string, unknown> | undefined)?.paperVersionId);
  if (!versionId) return null;
  const overview = await getJson(`/papers/v3/${versionId}/overview/${lang}`);
  if (!overview || typeof overview !== "object") return null;
  const o = overview as Record<string, unknown>;
  return (
    asString(o.markdown) ||
    asString(o.content) ||
    asString(o.overview) ||
    asString(o.text) ||
    null
  );
}

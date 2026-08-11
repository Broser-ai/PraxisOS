// LUNA · 24/7 arXiv paper harvester (PraxisOS swarm)
import { remember } from "@/agents/memory/swarm-memory";
import { reflect } from "@/agents/journal/journal-engine";

export const LUNA_ID = "luna" as const;

export type ArxivPaper = {
  id: string;
  title: string;
  summary: string;
  published: string;
  authors: string[];
  link: string;
  categories: string[];
};

const DEFAULT_QUERY =
  process.env.LUNA_ARXIV_QUERY?.trim() ||
  '(ti:"diabetic foot" OR ti:"plantar pressure" OR ti:"gaussian splatting" OR ti:MonoMSK OR ti:"subsurface scattering")';

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function tagAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(decodeXml(m[1] ?? ""));
  return out;
}

function parseAtom(xml: string): ArxivPaper[] {
  const entries = xml.split("<entry>").slice(1);
  return entries.map((chunk) => {
    const id = tagAll(chunk, "id")[0] ?? "";
    const title = tagAll(chunk, "title")[0]?.replace(/\s+/g, " ") ?? "";
    const summary = tagAll(chunk, "summary")[0]?.replace(/\s+/g, " ") ?? "";
    const published = tagAll(chunk, "published")[0] ?? "";
    const authors = tagAll(chunk, "name");
    const linkMatch = chunk.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i);
    const cats = Array.from(chunk.matchAll(/<category[^>]*term="([^"]+)"/gi)).map((m) => m[1]!);
    return {
      id,
      title,
      summary: summary.slice(0, 600),
      published,
      authors,
      link: linkMatch?.[1] ?? id,
      categories: cats,
    };
  });
}

export async function lunaHarvest(opts?: {
  query?: string;
  maxResults?: number;
  tenant?: string;
}): Promise<{ papers: ArxivPaper[]; stored: number }> {
  const query = opts?.query ?? DEFAULT_QUERY;
  const maxResults = opts?.maxResults ?? 8;
  const tenant = opts?.tenant ?? "bypilar";
  const url =
    "https://export.arxiv.org/api/query?" +
    new URLSearchParams({
      search_query: query,
      start: "0",
      max_results: String(maxResults),
      sortBy: "submittedDate",
      sortOrder: "descending",
    }).toString();

  const res = await fetch(url, {
    headers: { Accept: "application/atom+xml", "User-Agent": "PraxisOS-LUNA/1.0" },
  });
  if (!res.ok) {
    await reflect({
      agentId: LUNA_ID,
      tenant,
      prompt: `arxiv harvest ${query}`,
      outcome: `HTTP ${res.status}`,
      score: 0.1,
    });
    throw new Error(`arxiv_http_${res.status}`);
  }

  const xml = await res.text();
  const papers = parseAtom(xml);
  let stored = 0;
  for (const p of papers) {
    await remember({
      kind: "paper",
      tenant,
      text: `${p.title} — ${p.summary}`,
      meta: { agent: LUNA_ID, arxiv: p.id, link: p.link, published: p.published },
    });
    stored += 1;
  }

  await reflect({
    agentId: LUNA_ID,
    tenant,
    prompt: `Harvest arXiv: ${query}`,
    outcome: `${stored} papers indexed`,
    score: stored > 0 ? 0.85 : 0.3,
  });

  return { papers, stored };
}

/**
 * Replicate Trellis (firtoz/trellis) mesh helpers.
 *
 * Live pin stays conceptually `firtoz/trellis`. The models predictions API
 * (`POST /v1/models/{owner}/{name}/predictions`) returns HTTP 404 for this
 * model; production path must use versioned `POST /v1/predictions` with
 * `generate_model: true` (schema default is false — no GLB otherwise).
 */

export const TRELLIS_OWNER_NAME = "firtoz/trellis" as const;

export type ReplicatePrediction = {
  id?: string;
  status?: string;
  output?: unknown;
  error?: string;
  detail?: string;
  urls?: { get?: string };
};

export type TrellisMeshInput = {
  imageUrl: string;
  token: string;
  /** owner/name — default firtoz/trellis */
  modelRef?: string;
  /**
   * Version hash, or `owner/name:hash`. When unset, latest_version is fetched
   * from GET /v1/models/{owner}/{name}.
   */
  versionPin?: string;
  fetchFn?: typeof fetch;
  pollMaxMs?: number;
};

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
  };
}

export function parseOwnerName(modelRef: string): { owner: string; name: string } {
  const cleaned = modelRef.trim().replace(/:.*$/, "") || TRELLIS_OWNER_NAME;
  const [owner, name] = cleaned.split("/");
  if (!owner || !name) return { owner: "firtoz", name: "trellis" };
  return { owner, name };
}

/** Extract version hash from env-style pin (`hash` or `owner/name:hash`). */
export function parseVersionPin(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const v = raw.trim();
  if (v.includes(":")) {
    const hash = v.slice(v.lastIndexOf(":") + 1).trim();
    return hash || null;
  }
  // bare hex / opaque version id
  if (/^[a-f0-9]{64}$/i.test(v)) return v;
  // ignore owner/name-only values (those belong in REPLICATE_MESH_MODEL)
  if (v.includes("/")) return null;
  return v || null;
}

export function extractMeshUrl(output: unknown): string | null {
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const hit = extractMeshUrl(item);
      if (hit) return hit;
    }
  }
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    // Trellis PredictOutput uses model_file for the GLB URI
    for (const key of [
      "model_file",
      "mesh",
      "model",
      "glb",
      "obj",
      "ply",
      "url",
      "output",
      "gaussian_ply",
    ]) {
      const hit = extractMeshUrl(o[key]);
      if (hit) return hit;
    }
  }
  return null;
}

export async function resolveTrellisVersionId(
  owner: string,
  name: string,
  token: string,
  versionPin: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<{ versionId: string | null; note?: string }> {
  const pinned = parseVersionPin(versionPin);
  if (pinned) return { versionId: pinned };

  try {
    const res = await fetchFn(`https://api.replicate.com/v1/models/${owner}/${name}`, {
      headers: authHeaders(token),
    });
    const data = (await res.json().catch(() => ({}))) as {
      latest_version?: { id?: string };
      detail?: string;
      error?: string;
    };
    if (!res.ok) {
      return {
        versionId: null,
        note: `model lookup HTTP ${res.status}: ${data.detail ?? data.error ?? owner + "/" + name}`,
      };
    }
    const id = data.latest_version?.id?.trim() || null;
    if (!id) {
      return { versionId: null, note: `no latest_version for ${owner}/${name}` };
    }
    return { versionId: id };
  } catch (e) {
    return {
      versionId: null,
      note: `model lookup exception: ${e instanceof Error ? e.message : "error"}`,
    };
  }
}

async function pollReplicate(
  getUrl: string,
  token: string,
  fetchFn: typeof fetch,
  maxMs: number,
): Promise<ReplicatePrediction> {
  const started = Date.now();
  let last: ReplicatePrediction = {};
  while (Date.now() - started < maxMs) {
    const res = await fetchFn(getUrl, { headers: authHeaders(token) });
    last = (await res.json().catch(() => ({}))) as ReplicatePrediction;
    if (
      last.status === "succeeded" ||
      last.status === "failed" ||
      last.status === "canceled"
    ) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { ...last, status: "timeout", error: "Replicate poll timeout" };
}

function trellisInput(imageUrl: string): Record<string, unknown> {
  return {
    images: [imageUrl],
    // Schema default is false — without this, prediction succeeds with no GLB.
    generate_model: true,
    texture_size: 1024,
    mesh_simplify: 0.95,
  };
}

/**
 * Start + poll Trellis mesh generation via versioned predictions API.
 * Tries models API only as a soft first attempt; always falls back to versioned.
 */
export async function runTrellisMeshPrediction(input: TrellisMeshInput): Promise<{
  meshUrl: string | null;
  note: string;
  polledOk: boolean;
  prediction?: ReplicatePrediction;
}> {
  const fetchFn = input.fetchFn ?? fetch;
  const { owner, name } = parseOwnerName(input.modelRef ?? TRELLIS_OWNER_NAME);
  const ownerName = `${owner}/${name}`;
  const inputBody = trellisInput(input.imageUrl);

  // Soft attempt: models API (works for some Replicate models; firtoz/trellis → 404)
  let pred: ReplicatePrediction | null = null;
  let modelsApiOk = false;
  try {
    const startRes = await fetchFn(
      `https://api.replicate.com/v1/models/${owner}/${name}/predictions`,
      {
        method: "POST",
        headers: { ...authHeaders(input.token), Prefer: "wait" },
        body: JSON.stringify({ input: inputBody }),
      },
    );
    pred = (await startRes.json().catch(() => ({}))) as ReplicatePrediction;
    modelsApiOk = startRes.ok;
    if (!startRes.ok) {
      pred = null;
    }
  } catch {
    pred = null;
  }

  if (!modelsApiOk || !pred) {
    const resolved = await resolveTrellisVersionId(
      owner,
      name,
      input.token,
      input.versionPin ?? process.env.REPLICATE_MESH_VERSION,
      fetchFn,
    );
    if (!resolved.versionId) {
      return {
        meshUrl: null,
        note: `Replicate version resolve failed: ${resolved.note ?? ownerName}`,
        polledOk: false,
      };
    }

    const vRes = await fetchFn("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { ...authHeaders(input.token), Prefer: "wait" },
      body: JSON.stringify({
        version: resolved.versionId,
        input: inputBody,
      }),
    });
    pred = (await vRes.json().catch(() => ({}))) as ReplicatePrediction;
    if (!vRes.ok) {
      const detail =
        pred.detail ?? pred.error ?? (vRes.status === 402 ? "insufficient credit" : "start failed");
      return {
        meshUrl: null,
        note: `Replicate HTTP ${vRes.status}: ${detail}`,
        polledOk: false,
        prediction: pred,
      };
    }
  }

  if (pred.status !== "succeeded" && pred.urls?.get) {
    pred = await pollReplicate(
      pred.urls.get,
      input.token,
      fetchFn,
      input.pollMaxMs ?? 90_000,
    );
  }

  if (
    pred.status === "failed" ||
    pred.status === "canceled" ||
    pred.status === "timeout"
  ) {
    return {
      meshUrl: null,
      note: `Replicate ${pred.status}: ${pred.error ?? "no mesh"}`,
      polledOk: false,
      prediction: pred,
    };
  }

  const meshUrl = extractMeshUrl(pred.output);
  if (meshUrl) {
    return {
      meshUrl,
      note: `3D lift OK · ${ownerName} · mesh klar`,
      polledOk: true,
      prediction: pred,
    };
  }

  return {
    meshUrl: null,
    note: "Replicate succeeded uden mesh-URL i output",
    polledOk: false,
    prediction: pred,
  };
}

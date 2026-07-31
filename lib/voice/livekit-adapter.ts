// LiveKit token-adapter · realtime orchestrator (WebRTC ingress).
// Kontrakt: HUMANIZED-FRONTIER-BLUEPRINT §2.2 · Two-plane architecture
//
// Server-side rolle:
//   1. Genererer signed access-tokens til klient-browsers via WebRTC join
//   2. Konfigurerer room-settings (audio-only, opus-codec, echo-cancellation)
//   3. Failsafe: mock-token hvis LIVEKIT_API_KEY/SECRET mangler (til tests)
//
// Sprint 6 · B5:
//   * Ærlig `isMock` — hvis SDK ikke er wired op returnerer vi isMock:true
//     (eller kaster i prod), fremfor at klistre 'stub-signed' på og lade
//     som om det er ægte
//   * Lækker ALDRIG hverken hele eller dele af API-key i mock-token-body

export type LiveKitRoomConfig = {
  roomName: string;
  participantIdentity: string;
  participantName?: string;
  ttlSeconds?: number;
  audioOnly?: boolean;
  metadata?: Record<string, unknown>;
};

export type LiveKitToken = {
  jwt: string;
  wsUrl: string;
  roomName: string;
  expiresAt: string;
  isMock: boolean;
};

const LIVEKIT_WS_URL_DEFAULT = "wss://praxisos.livekit.cloud";

/**
 * Best-effort load af @livekit/server-sdk. Returnerer null hvis pakken
 * ikke er installeret — så kan vi rapportere isMock:true eller kaste i prod.
 */
async function tryLoadLiveKitSdk(): Promise<null | {
  AccessToken: new (apiKey: string, apiSecret: string, opts: unknown) => {
    addGrant(g: unknown): void;
    toJwt(): Promise<string> | string;
  };
}> {
  try {
    // Dynamic import så pakke-fravær ikke crasher build.
    // @ts-expect-error - optional peer dep
    const mod = await import("@livekit/server-sdk");
    return mod?.AccessToken ? { AccessToken: mod.AccessToken } : null;
  } catch {
    return null;
  }
}

/**
 * Genererer access-token. I prod bruges @livekit/server-sdk til at signere
 * JWT'en. Uden nøgler ELLER SDK returneres en mock-token med isMock:true —
 * i produktion kastes i stedet (vi må ikke silent-fake en ægte session).
 */
export async function issueLiveKitToken(config: LiveKitRoomConfig): Promise<LiveKitToken> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL ?? LIVEKIT_WS_URL_DEFAULT;
  const ttl = config.ttlSeconds ?? 3600;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  const isProd = process.env.NODE_ENV === "production";

  const mockJwt = () => {
    // Tydeligt markeret mock-token. Indeholder INGEN hemmeligheder eller
    // dele af API-key — kun room + identity + timestamp.
    const nonce = Date.now().toString(36);
    return `mock.${config.roomName}.${config.participantIdentity}.${nonce}`;
  };

  if (!apiKey || !apiSecret) {
    if (isProd) {
      throw new Error(
        "LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing in production. " +
        "Refuser at issue mock-token i prod (COMPLETE-AUDIT-REPORT · livekit-adapter).",
      );
    }
    console.log("API Key Missing (LIVEKIT_API_KEY / LIVEKIT_API_SECRET) — issuing MOCK token");
    return {
      jwt: mockJwt(),
      wsUrl,
      roomName: config.roomName,
      expiresAt,
      isMock: true,
    };
  }

  const sdk = await tryLoadLiveKitSdk();
  if (!sdk) {
    // Nøgler er sat men SDK ikke wired op. Vi må IKKE returnere isMock:false
    // med en fake JWT — det gjorde vi før (`stub-signed.<key-prefix>`) og
    // lækkede første 4 tegn af API-keyen ovenikøbet.
    if (isProd) {
      throw new Error(
        "LiveKit @livekit/server-sdk not installed but LIVEKIT_API_KEY is set. " +
        "Install the SDK eller fjern nøglerne — vi må ikke silent-mocke i prod.",
      );
    }
    console.log(
      `[voice] @livekit/server-sdk not installed — returning MOCK token for ${config.roomName}`,
    );
    return {
      jwt: mockJwt(),
      wsUrl,
      roomName: config.roomName,
      expiresAt,
      isMock: true,
    };
  }

  // Real signing path.
  const at = new sdk.AccessToken(apiKey, apiSecret, {
    identity: config.participantIdentity,
    name: config.participantName,
    ttl,
    metadata: config.metadata ? JSON.stringify(config.metadata) : undefined,
  });
  at.addGrant({
    roomJoin: true,
    room: config.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  const jwt = await at.toJwt();
  return { jwt, wsUrl, roomName: config.roomName, expiresAt, isMock: false };
}

// ---------------------------------------------------------------------------
// Consent-gated variant (Sprint 6 · B19)
// ---------------------------------------------------------------------------
//
// Callers that talk directly to a patient (Scribe, voice-first Aria, gait
// coach) MUST use this. It refuses to issue a token unless the 4-lags
// Corti-DK consent chain is satisfied within the last 60s.
//
// Internal agent-to-agent LiveKit rooms (server-side worker mesh) can still
// use the raw issueLiveKitToken() above.

import {
  assertConsentToStartSession,
  type ConsentGuardInput,
} from "./consent";

export type GatedLiveKitConfig = LiveKitRoomConfig & {
  consent: ConsentGuardInput;
};

export type GatedLiveKitToken = LiveKitToken & {
  consent_event_id: string;
};

export async function issueLiveKitTokenGated(
  config: GatedLiveKitConfig,
): Promise<GatedLiveKitToken> {
  const guard = assertConsentToStartSession(config.consent);
  if (!guard.ok) {
    throw new Error(guard.reason);
  }

  // Splice consent-event-id ind i room-metadata så det ryger med JWT'en og
  // beviser hvilken samtykke-hændelse denne session hviler på.
  const token = await issueLiveKitToken({
    ...config,
    metadata: {
      ...(config.metadata ?? {}),
      consent_event_id: guard.verbal_ack_id,
    },
  });

  return { ...token, consent_event_id: guard.verbal_ack_id };
}

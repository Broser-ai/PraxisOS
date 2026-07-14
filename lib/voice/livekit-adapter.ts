// LiveKit token-adapter · realtime orchestrator (WebRTC ingress).
// Kontrakt: HUMANIZED-FRONTIER-BLUEPRINT §2.2 · Two-plane architecture
//
// Server-side rolle:
//   1. Genererer signed access-tokens til klient-browsers via WebRTC join
//   2. Konfigurerer room-settings (audio-only, opus-codec, echo-cancellation)
//   3. Failsafe: mock-token hvis LIVEKIT_API_KEY/SECRET mangler (til tests)

export type LiveKitRoomConfig = {
  roomName: string;
  participantIdentity: string;   // fx praktiker-user-id
  participantName?: string;
  ttlSeconds?: number;           // default 3600
  audioOnly?: boolean;           // default true
  metadata?: Record<string, unknown>;
};

export type LiveKitToken = {
  jwt: string;
  wsUrl: string;
  roomName: string;
  expiresAt: string;             // ISO
  isMock: boolean;
};

const LIVEKIT_WS_URL_DEFAULT = "wss://praxisos.livekit.cloud";

/**
 * Genererer access-token. I prod bruges @livekit/server-sdk til at signere
 * JWT'en. I stub-mode (uden nøgler) returneres en synlig mock-token så
 * front-end kan bygges + testes end-to-end uden ekstern afhængighed.
 */
export async function issueLiveKitToken(config: LiveKitRoomConfig): Promise<LiveKitToken> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL ?? LIVEKIT_WS_URL_DEFAULT;
  const ttl = config.ttlSeconds ?? 3600;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  if (!apiKey || !apiSecret) {
    console.log("API Key Missing (LIVEKIT_API_KEY / LIVEKIT_API_SECRET) — issuing MOCK token");
    return {
      jwt: `mock.${config.roomName}.${config.participantIdentity}.${Date.now()}`,
      wsUrl,
      roomName: config.roomName,
      expiresAt,
      isMock: true,
    };
  }

  // Real signing lever bag @livekit/server-sdk (ikke installed i dette scaffold).
  // Adapter-interface holder — tilføj deps + implementation i Sprint 3.
  console.log(
    `[voice] LiveKit real signing not wired up in this scaffold — returning stub-signed token for ${config.roomName}`,
  );
  return {
    jwt: `stub-signed.${apiKey.slice(0, 4)}.${config.roomName}`,
    wsUrl,
    roomName: config.roomName,
    expiresAt,
    isMock: false,
  };
}

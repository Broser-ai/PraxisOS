/** @type {import('next').NextConfig} */

// PraxisOS · Sprint 6 Batch 3 · Security headers (SEC-12)
//
// Kontrakt (COMPLETE-AUDIT-REPORT.md · SEC-12 "Zero security headers"):
//   Next.js server sender lige nu ingen security-headers overhovedet - hverken
//   CSP, HSTS, X-Frame-Options eller Referrer-Policy. For en Class-IIa medical
//   surface er baseline security-headers ikke valgfrit.
//
// Beslutning (mandate):
//   * Content-Security-Policy med strict-dynamic + nonce (nonce injiceres af
//     middleware.ts pr. request og placeholderes her som '{NONCE}' - Next.js
//     replacer i sin egen header-pipeline efter middleware har sat den).
//   * frame-ancestors 'none' (medicinsk journal skal aldrig kunne iframes).
//   * form-action 'self' (blokerer form-hijacking mod eksterne domaener).
//   * img-src 'self' data: https: (tillader base64 previews og HTTPS-assets).
//   * connect-src selv + Supabase + Replicate (adapter-endpoints).
//   * HSTS 2 aar med includeSubDomains + preload (kraeves i praksis for
//     medicinsk-udstyr paa .dk domaene).
//   * Referrer-Policy strict-origin (ingen tenant-slug lek ved outbound klik).
//   * X-Content-Type-Options nosniff (klassisk MIME-sniff blokade).
//   * X-Frame-Options DENY (double-belt oveni frame-ancestors).
//   * Permissions-Policy: camera + microphone kun for /voice + /scanner
//     surfaces - global default deny.

const CSP_DIRECTIVES = [
  // Default-src fallback: kun samme origin.
  "default-src 'self'",
  // script-src: strict-dynamic + nonce (nonce'et injiceres pr. request af
  // middleware.ts). Next.js RSC/JIT-scripts foelger nonce'et via strict-dynamic.
  "script-src 'self' 'nonce-{NONCE}' 'strict-dynamic' https:",
  // style-src: tillad 'unsafe-inline' fordi Next.js emitter inline critical CSS.
  // Kan strammes til nonce senere naar vi migrerer til App Router med style-nonce.
  "style-src 'self' 'unsafe-inline'",
  // Billeder: selvhostede + data:-URIs (base64 previews) + HTTPS.
  "img-src 'self' data: https: blob:",
  // Fonts: selvhostede + data:.
  "font-src 'self' data:",
  // XHR/fetch: Supabase-projekt + Replicate + LiveKit + selv.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.replicate.com https://*.livekit.cloud wss://*.livekit.cloud https://api.anthropic.com",
  // Iframe-forbud (double-belt med X-Frame-Options).
  "frame-ancestors 'none'",
  // Form kun til vores egen origin (blokerer POST-hijack til evil.example).
  "form-action 'self'",
  // Base-URI laases saa injected <base>-tags ikke kan omdirigere alle relative URLs.
  "base-uri 'self'",
  // Objekt/embed forbudt (gammel Flash/Java plugin-flade).
  "object-src 'none'",
  // Worker-scripts selv + blob (Web Workers til gait/scanner beregninger).
  "worker-src 'self' blob:",
  // Manifest til PWA.
  "manifest-src 'self'",
  // Upgrade insecure requests (tvinger https for alle sub-requests).
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: CSP_DIRECTIVES,
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin",
  },
  {
    key: "Permissions-Policy",
    // Camera + microphone kraeves paa /voice + /scanner surfaces; her defaulter
    // vi til deny. Route-specifikke overrides sker via response headers i
    // hver relevant page/API route.
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
];

const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: import.meta.dirname,
  },
  async headers() {
    return [
      {
        // Saet security-headers paa ALLE ruter · middleware.ts overskriver
        // Content-Security-Policy pr. request med et frisk nonce.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// Eksporter security-headers-listen saa tests kan verificere direktiverne
// uden at koere en fuld Next.js server.
export { securityHeaders, CSP_DIRECTIVES };

export default nextConfig;

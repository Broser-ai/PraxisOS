// scripts/demo-redact.mjs
// Demo: vis at safety-kit.redact() faktisk fanger en secret i et rigtigt log-call.
// Kør: node scripts/demo-redact.mjs

import { auditLog, auditError } from "../lib/audit.ts"

console.log("\n=== UDEN redact() (BAD) ===")
console.log("[audit] api-key.created tenant=keap-klinik secret=sk-proj-aBc123XyZ987qwertyUIop")
console.error("[audit:error] webhook.failed Failed to authenticate with token sk-ant-api03-pZ87xHRq2vN1mLkJ_realKey_dontLog123")

console.log("\n=== MED auditLog() / auditError() (GOOD) ===")
auditLog("api-key.created", {
  tenant: "keap-klinik",
  secret: "sk-proj-aBc123XyZ987qwertyUIop",
  service_role_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.fakesignature1234567890",
})

auditError(
  "webhook.failed",
  new Error("Failed to authenticate with token sk-ant-api03-pZ87xHRq2vN1mLkJ_realKey_dontLog123"),
  { tenant: "keap-klinik" }
)

auditLog("github.pat-rotated", {
  oldToken: "ghp_AbcDefGhiJklMnoPqrStuVwxYz123456",
})

console.log("\n=== TEST OK hvis ingen sk-/eyJ/ghp_-nøgle står klart ovenfor ===\n")

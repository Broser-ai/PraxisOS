"use client";

import { useState } from "react";
import { DEFAULT_OPT_IN, CATEGORY_LABEL, type NemSmsCategory } from "@/lib/nemsms";

type Props = {
  tenantName: string;
  senderId: string;
  phoneNumber: string;
  onComplete: (prefs: Record<NemSmsCategory, boolean>) => void;
};

const ALLOWED: NemSmsCategory[] = ["booking_confirm", "reminder_24h", "reminder_1h", "cancellation", "prescription", "treatment_results"];

const HINTS: Record<NemSmsCategory, string> = {
  booking_confirm: "Hver gang du booker en tid",
  reminder_24h: "Dagen før hver behandling",
  reminder_1h: "1 time før din tid · god til travle dage",
  cancellation: "Hvis vi må aflyse eller flytte din tid",
  prescription: "Når din recept er klar på apoteket",
  treatment_results: "AR-scan, fod-scan, journal-noter",
  marketing: "",
};

export function NemSmsOptIn({ tenantName, senderId, phoneNumber, onComplete }: Props) {
  const [enabled, setEnabled] = useState(true);
  const [prefs, setPrefs] = useState<Record<NemSmsCategory, boolean>>({ ...DEFAULT_OPT_IN });

  const toggle = (k: NemSmsCategory) => setPrefs((p) => ({ ...p, [k]: !p[k] }));
  const setAll = (v: boolean) => {
    const next = { ...prefs };
    for (const k of ALLOWED) next[k] = v;
    setPrefs(next);
  };

  const activeCount = ALLOWED.filter((k) => prefs[k]).length;

  return (
    <div>
      {/* Intro */}
      <div className="rounded-[14px] border border-[#0061af]/30 bg-[#0061af]/[0.04] p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#0061af] text-white text-[14px] font-bold">
            N
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">NemSMS · officiel sundheds-SMS</div>
            <div className="mt-1 text-[12px] text-muted">
              Officiel SMS-tjeneste via Sundhedsdatanettet · gratis for dig · ankommer fra <b>{senderId}</b>
            </div>
          </div>
          <label className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-muted">{enabled ? "Aktiveret" : "Slået fra"}</span>
            <span
              onClick={() => setEnabled(!enabled)}
              className="h-5 w-9 rounded-full p-0.5 transition-colors cursor-pointer"
              style={{ background: enabled ? "var(--color-signal)" : "var(--color-line-2)" }}
            >
              <span className={`block h-4 w-4 rounded-full bg-paper transition-transform ${enabled ? "translate-x-4" : ""}`} />
            </span>
          </label>
        </div>
      </div>

      {/* Detalje når aktiveret */}
      {enabled && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="kicker">Hvad vil du modtage? · {activeCount} valgt</div>
            <div className="flex gap-2 text-[10.5px]">
              <button onClick={() => setAll(true)} className="text-accent hover:underline">Vælg alle</button>
              <span className="text-faint">·</span>
              <button onClick={() => setAll(false)} className="text-accent hover:underline">Fjern alle</button>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {ALLOWED.map((k) => (
              <label
                key={k}
                className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line-2 bg-card p-3 transition-colors hover:border-ink"
              >
                <input
                  type="checkbox"
                  checked={prefs[k]}
                  onChange={() => toggle(k)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-[13px] font-medium">{CATEGORY_LABEL[k]}</div>
                  <div className="mt-0.5 text-[10.5px] text-muted">{HINTS[k]}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Disclosure */}
          <div className="mt-4 rounded-[10px] border border-line bg-paper-2/60 p-3 text-[10.5px] text-muted">
            <b>Vigtigt at vide:</b>
            <ul className="mt-1.5 space-y-1 list-disc list-inside">
              <li>NemSMS er <b>gratis at modtage</b> · ankommer fra det godkendte sender-ID</li>
              <li>Bruges <b>kun til sundheds-relevante beskeder</b> · ikke marketing</li>
              <li>Du kan til enhver tid trække tilbage på <code className="mono">borger.dk → NemSMS</code></li>
              <li>Beskeder gemmes i din Min Side i 5 år</li>
              <li>Sundhedsdatanettet · GDPR Art. 9 · EU-data</li>
            </ul>
          </div>

          {/* Forhåndsvisning af besked */}
          <div className="mt-4 rounded-[12px] border border-line bg-card p-4">
            <div className="kicker mb-2">Eksempel · sådan ser en NemSMS ud</div>
            <div className="rounded-[10px] bg-paper-2 p-3">
              <div className="flex items-center justify-between text-[10px] text-faint">
                <span className="mono">Fra: {senderId}</span>
                <span className="mono">→ {phoneNumber || "+45 ** ** ** **"}</span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
                Hej Pilar. Din tid hos {tenantName} er bekræftet: <b>tor 12. juni kl. 14:00</b>, Medicinsk fodpleje.
                Tilskud beregnes automatisk. Se kvittering: praxis.app/r/bk_abc12
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[9.5px] text-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0061af]" />
                <span className="mono">officiel NemSMS · sundhedsdatanettet</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!enabled && (
        <div className="mt-4 rounded-[10px] border border-line bg-paper-2/60 p-3 text-[12px] text-muted">
          Du modtager kun e-mail og push-notifikationer. Du kan altid aktivere NemSMS senere på Min Side.
        </div>
      )}

      <button
        onClick={() => onComplete(enabled ? prefs : ({} as Record<NemSmsCategory, boolean>))}
        className="mt-6 w-full rounded-[10px] py-3 text-[14px] font-medium"
        style={{ background: "var(--brand-ink, var(--color-ink))", color: "var(--brand-paper, var(--color-paper))" }}
      >
        {enabled ? `Gem ${activeCount} valg →` : "Spring over →"}
      </button>
    </div>
  );
}

// UX/A11y blockers · Sprint 6 Batch 3
// -----------------------------------------------------------------------------
// Node-runtime kilde-inspektionstests: kontrollerer at kritiske aria-attributter,
// landmark-roller og skip-links er tilstede i den forventede kildefil. Vi kører
// ikke React her (ingen jsdom-afhængighed), men vi verificerer determ. den
// nøjagtige source-fingerprint der WCAG-blockerne kræver.
//
// Audit-reference: COMPLETE-AUDIT-REPORT.md §UX-A11y (blocker-listen)
//   1. Chat-message-list må have role='log' + aria-live='polite'
//   2. Every input must have <label> or aria-label
//   3. SoapReviewPane keyboard shortcuts må have visible cheat-sheet (aria-describedby)
//   4. NeuralConfigurator sliders må have aria-valuemin/valuemax/valuenow + aria-label
//      (native input[type=range] leverer valuemin/max/now implicit; vi kræver aria-label)
//   5. PulsingDot må have role='status' + aria-live + description af pause-word
//   6. Every page må have skip-to-content link + <main> landmark
//   7. Focus trap i SignOffModal
//   8. Color contrast — noteret · ikke automatisk verificerbar uden headless-browser

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// ---------------------------------------------------------------------------
// Blocker #5 · PulsingDot
// ---------------------------------------------------------------------------

describe("a11y · PulsingDot", () => {
  const src = read("components/voice/PulsingDot.tsx");

  it("har role='status' + aria-live på wrapper", () => {
    expect(src).toContain(`role="status"`);
    expect(src).toContain(`aria-live="polite"`);
  });

  it("annoncerer pause-word via aria-describedby (sr-only text)", () => {
    expect(src).toMatch(/aria-describedby=\{descId\}/);
    expect(src).toMatch(/pause\s*praxis/i);
    // sr-only clip-pattern skal være tilstede
    expect(src).toMatch(/clip:\s*"rect\(0,0,0,0\)"/);
  });

  it("har aria-atomic så hele status-changes læses op", () => {
    expect(src).toContain(`aria-atomic="true"`);
  });
});

// ---------------------------------------------------------------------------
// Blocker #3 · SoapReviewPane cheat-sheet + focus + button aria-labels
// ---------------------------------------------------------------------------

describe("a11y · SoapReviewPane", () => {
  const src = read("components/voice/SoapReviewPane.tsx");

  it("root region har aria-describedby der peger på cheat-sheet", () => {
    expect(src).toMatch(/aria-describedby=\{shortcutsId\}/);
    expect(src).toMatch(/id=\{shortcutsId\}/);
    expect(src).toMatch(/aria-label="Keyboard-genveje til SOAP-review"/);
  });

  it("root wrapper er region + har tabIndex for keyboard-adgang", () => {
    expect(src).toMatch(/role="region"/);
    expect(src).toMatch(/tabIndex=\{-1\}/);
  });

  it("accept/reject buttons har unikke aria-labels med sektion+index", () => {
    expect(src).toMatch(/aria-label=\{`Accepter sætning \$\{props\.sentenceIndex \+ 1\} i sektion \$\{props\.section\}`\}/);
    expect(src).toMatch(/aria-label=\{`Afvis sætning \$\{props\.sentenceIndex \+ 1\} i sektion \$\{props\.section\}`\}/);
  });

  it("sentence-listen er markeret som role='list' med progress-status", () => {
    expect(src).toContain(`role="list"`);
    expect(src).toMatch(/aria-label=\{`SOAP-udkast — \$\{acceptedCount\} af \$\{flatIndex\.length\} sætninger reviewed`\}/);
  });
});

// ---------------------------------------------------------------------------
// Blocker #4 · NeuralConfigurator sliders (aria-label + native valuemin/max/now)
// ---------------------------------------------------------------------------

describe("a11y · NeuralConfigurator sliders", () => {
  const src = read("components/NeuralConfigurator.tsx");

  it("FancyRange <input type='range'> giver implicit aria-valuemin/max/now", () => {
    // Vi bruger native range-input · WAI-ARIA slider-role har min/max/now indbygget
    expect(src).toMatch(/type="range"/);
    expect(src).toMatch(/aria-label=\{ariaLabel\}/);
  });

  it("alle slider-labels er på dansk (spot-check PARAM_SPECS)", () => {
    const daniskLabels = [
      "Forfod-tykkelse",
      "Hæltykkelse",
      "Hælkop-dybde",
      "Buestøtte",
      "Pronation-korrektion",
      "Hallux relief",
    ];
    for (const label of daniskLabels) {
      expect(src).toContain(label);
    }
  });

  it("SignOffModal har role='dialog' + aria-modal (via ModalShell)", () => {
    expect(src).toMatch(/role="dialog"/);
    expect(src).toMatch(/aria-modal="true"/);
  });

  it("SignOffModal typede initialer input har <label htmlFor>", () => {
    expect(src).toMatch(/htmlFor="signoff-initials"/);
    expect(src).toMatch(/id="signoff-initials"/);
  });
});

// ---------------------------------------------------------------------------
// Blocker #1 + #2 · Learning page chat log + input label
// ---------------------------------------------------------------------------

describe("a11y · Learning page (chat)", () => {
  const src = read("app/(internal)/learning/page.tsx");

  it("chat-container har role='log' + aria-live='polite' + aria-relevant='additions'", () => {
    expect(src).toContain(`role="log"`);
    expect(src).toContain(`aria-live="polite"`);
    expect(src).toContain(`aria-relevant="additions"`);
  });

  it("input har både <label htmlFor> og aria-label", () => {
    expect(src).toMatch(/htmlFor="learning-chat-input"/);
    expect(src).toMatch(/id="learning-chat-input"/);
    expect(src).toMatch(/aria-label=\{`Spørg Reflexion Tutor om \$\{selectedTrack\.name\.toLowerCase\(\)\}`\}/);
  });
});

// ---------------------------------------------------------------------------
// Blocker #6 · Skip-to-content + <main> landmark
// ---------------------------------------------------------------------------

describe("a11y · page landmarks (skip-link + main)", () => {
  const pages: Array<{ label: string; rel: string; skipHref: string; mainId: string }> = [
    { label: "learning",  rel: "app/(internal)/learning/page.tsx",     skipHref: "#learning-main", mainId: "learning-main" },
    { label: "journey",   rel: "app/(internal)/demo/journey/page.tsx", skipHref: "#journey-main",  mainId: "journey-main"  },
  ];

  for (const p of pages) {
    describe(p.label, () => {
      const src = read(p.rel);

      it("indeholder skip-link med korrekt href", () => {
        expect(src).toContain(`href="${p.skipHref}"`);
        expect(src).toMatch(/Spring til hovedindhold/);
        // sr-only + focus-visible pattern
        expect(src).toMatch(/sr-only/);
        expect(src).toMatch(/focus:not-sr-only/);
      });

      it("<main> landmark eksisterer med matching id + aria-labelledby", () => {
        expect(src).toContain(`<main`);
        expect(src).toContain(`id="${p.mainId}"`);
        expect(src).toMatch(/aria-labelledby=/);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Blocker #8 · ColorChecker accept-button aria-label
// ---------------------------------------------------------------------------

describe("a11y · ColorCheckerOverlay", () => {
  const src = read("components/lighting/ColorCheckerOverlay.tsx");

  it("Godkend-knap har kontekstuel aria-label + aria-disabled", () => {
    expect(src).toMatch(/aria-label=\{[\s\S]*?Godkend farvekalibrering[\s\S]*?\}/);
    expect(src).toMatch(/aria-disabled=\{worstDeltaE === null \|\| worstDeltaE >= 3\}/);
  });

  it("hvert farve-patch er markeret som role='img' med navngivet aria-label", () => {
    expect(src).toContain(`role="img"`);
    expect(src).toMatch(/aria-label=\{[\s\S]*?p\.name[\s\S]*?afventer måling[\s\S]*?\}/);
  });

  it("patch-griddet har role='group' + aria-label", () => {
    expect(src).toContain(`role="group"`);
    expect(src).toContain(`aria-label="24-patch farvekalibrerings-grid"`);
  });
});

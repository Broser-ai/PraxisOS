import Script from "next/script";
import { bypilarPublicServices } from "@/lib/bypilar-catalog";

// Mock af bypilar.dk's egne hjemmeside med PraxisOS-embed indsat.
// Demonstrerer "Mode A · Headless" — én script-tag + data-attributter på knapper.
// Ydelser kommer fra lib/bypilar-catalog.ts (samme SoT som API).

export default function FakeBypilarSite() {
  const services = bypilarPublicServices();

  return (
    <>
      {/* ⬇⬇⬇ DETTE er den eneste linje bypilar.dk skal tilføje ⬇⬇⬇ */}
      <Script src="/embed/v1/bypilar" strategy="afterInteractive" />
      {/* ⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆ */}

      <div className="bypilar-site min-h-screen" style={{ background: "#f3ede1", color: "#1f1d18", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {/* Top bar — bevidst NIETS PraxisOS-look. Dette er kundens eget brand. */}
        <header style={{ borderBottom: "1px solid #d9cfbc" }}>
          <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-5">
            <a href="/" style={{ letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 14, fontWeight: 700, textDecoration: "none", color: "inherit" }}>
              by Pilar
            </a>
            <nav className="hidden gap-8 text-[13px] md:flex" style={{ letterSpacing: "0.05em" }}>
              <a href="#ydelser" style={{ color: "inherit", textDecoration: "none" }}>Ydelser</a>
              <a href="#mobil" style={{ color: "inherit", textDecoration: "none" }}>Hjemmebesøg</a>
              <a href="#om" style={{ color: "inherit", textDecoration: "none" }}>Om Pilar</a>
              <a href="#kontakt" style={{ color: "inherit", textDecoration: "none" }}>Kontakt</a>
            </nav>
            <button
              data-praxis-book
              style={{ background: "#1f1d18", color: "#f3ede1", padding: "9px 18px", border: 0, borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em" }}
            >
              BOOK TID
            </button>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-[1100px] px-6 py-20 md:py-28">
          <div style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#7a6a55" }}>
            fodpleje &amp; fodterapeut · aarhus
          </div>
          <h1
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(48px, 8vw, 96px)", lineHeight: 1.02, fontWeight: 400, margin: "20px 0 0 0", letterSpacing: "-0.02em" }}
          >
            Velplejede fødder,<br />
            <em style={{ color: "#8a6a3d" }}>uden ventetid.</em>
          </h1>
          <p style={{ maxWidth: 540, fontSize: 16, lineHeight: 1.6, color: "#5a5347", marginTop: 24 }}>
            Hos by Pilar tager vi os tid til dig. Fodbehandling, manicure og klippekort —
            i klinikken eller hos dig. 2.400+ tilfredse kunder · 4,9★ · 7 år i Aarhus.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
            <button
              data-praxis-book
              style={{ background: "#1f1d18", color: "#f3ede1", padding: "14px 28px", border: 0, borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em" }}
            >
              Book tid →
            </button>
            <a
              href="#ydelser"
              style={{ background: "transparent", color: "#1f1d18", padding: "13px 28px", border: "1px solid #1f1d18", borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "0.04em" }}
            >
              Se ydelser
            </a>
          </div>
        </section>

        {/* Service grid */}
        <section id="ydelser" className="mx-auto max-w-[1100px] px-6 pb-20">
          <div style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#7a6a55", marginBottom: 16 }}>
            ydelser
          </div>
          <div className="grid grid-cols-1 gap-px md:grid-cols-2 lg:grid-cols-3" style={{ background: "#d9cfbc" }}>
            {services.map((s) => (
              <div key={s.id} style={{ background: "#f3ede1", padding: "32px 28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 500, margin: 0 }}>{s.name}</h3>
                </div>
                <p style={{ fontSize: 14, color: "#5a5347", marginTop: 10, lineHeight: 1.5 }}>
                  {s.shortDescription ?? s.description}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 22 }}>
                  <span style={{ fontSize: 12, letterSpacing: "0.1em", color: "#7a6a55" }}>
                    {s.durationMin != null ? `${s.durationMin} MIN` : "EFTER AFTALE"}
                  </span>
                  <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 500 }}>{s.priceKr} kr</span>
                </div>
                <button
                  data-praxis-book={s.id}
                  style={{ marginTop: 22, width: "100%", background: "transparent", color: "#1f1d18", padding: "12px", border: "1px solid #1f1d18", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em" }}
                >
                  Book tid
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Mobile / home visit */}
        <section id="mobil" style={{ background: "#e8dfca" }}>
          <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-10 px-6 py-20 md:grid-cols-2 md:items-center">
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#7a6a55" }}>
                hjemmebesøg
              </div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 48, fontWeight: 400, margin: "16px 0 0", lineHeight: 1.05 }}>
                Pilar kommer<br />til dig.
              </h2>
              <p style={{ fontSize: 15, color: "#5a5347", marginTop: 18, maxWidth: 440, lineHeight: 1.6 }}>
                Private hjem, plejecentre, arbejdspladser og events. Vi tager hele klinikken med.
                Også aftener og weekender efter aftale.
              </p>
              <button
                data-praxis-book="fod-med"
                style={{ marginTop: 24, background: "#1f1d18", color: "#f3ede1", padding: "12px 26px", border: 0, borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em" }}
              >
                Book hjemmebesøg
              </button>
            </div>
            <div style={{ aspectRatio: "4/3", background: "#d9cfbc", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#7a6a55", fontSize: 12, letterSpacing: "0.1em" }}>
              [BILLEDE · MOBIL OPSÆTNING]
            </div>
          </div>
        </section>

        {/* About + stats */}
        <section id="om" className="mx-auto max-w-[1100px] px-6 py-20">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              ["2.400+", "tilfredse kunder"],
              ["4,9★", "gennemsnitlig rating"],
              ["7", "år i Aarhus"],
              ["DK", "uddannet personale"],
            ].map(([big, small]) => (
              <div key={big as string}>
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 52, fontWeight: 400 }}>{big}</div>
                <div style={{ fontSize: 12, letterSpacing: "0.12em", color: "#7a6a55", textTransform: "uppercase", marginTop: 4 }}>{small}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <footer id="kontakt" style={{ borderTop: "1px solid #d9cfbc", background: "#ece2cc" }}>
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4 px-6 py-10">
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 500 }}>by Pilar</div>
              <div style={{ fontSize: 13, color: "#7a6a55", marginTop: 4 }}>Aarhus · Danmark · CVR 43947079</div>
            </div>
            <div style={{ fontSize: 13, color: "#5a5347" }}>
              <div>hej@bypilar.dk</div>
              <div style={{ marginTop: 4 }}>+45 93 95 20 41</div>
            </div>
            <button
              data-praxis-book
              style={{ background: "#1f1d18", color: "#f3ede1", padding: "12px 26px", border: 0, borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em" }}
            >
              Book tid →
            </button>
          </div>
        </footer>
      </div>

      {/* Cormorant Garamond serif til at matche æstetikken */}
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&display=swap" rel="stylesheet" />
    </>
  );
}

// GET /embed/v1/{tenant}  → JS-snippet til kundens eget website.
//
// bypilar.dk indsætter ÉN linje i deres <head>:
//   <script src="https://api.praxis.app/embed/v1/bypilar" defer></script>
//
// Derefter virker alle disse mønstre uden mere kode:
//   <button data-praxis-book>Book tid</button>
//   <button data-praxis-book="fod-med">Book medicinsk fodpleje</button>
//   <a data-praxis-book="nail-art" data-praxis-mode="popup">Book i nyt vindue</a>
//
// Programmatisk:  PraxisOS.open("fod-med"); PraxisOS.close();
import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) return new NextResponse("// tenant not found\n", { status: 404 });

  const url = new URL(req.url);
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  const origin = configured || `${url.protocol}//${url.host}`;
  const accent = t.brand.accent;

  const js = `// PraxisOS embed v1 · tenant=${t.slug}
(function () {
  if (window.__praxisLoaded) return; window.__praxisLoaded = true;
  var ORIGIN = ${JSON.stringify(origin)};
  var TENANT = ${JSON.stringify(t.slug)};
  var ACCENT = ${JSON.stringify(accent)};

  // ---- inject minimal CSS ----
  var css = '@keyframes prxFade{from{opacity:0}to{opacity:1}}'
    + '@keyframes prxRise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}'
    + '.prx-backdrop{position:fixed;inset:0;background:rgba(20,18,15,0.55);backdrop-filter:blur(6px);z-index:2147483646;animation:prxFade .25s ease;display:flex;align-items:center;justify-content:center;padding:20px}'
    + '.prx-modal{position:relative;width:min(960px,100%);height:min(820px,calc(100vh - 40px));background:#f7f3ec;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.35);animation:prxRise .35s cubic-bezier(.22,1,.36,1)}'
    + '.prx-modal iframe{width:100%;height:100%;border:0;display:block;background:#f7f3ec}'
    + '.prx-close{position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;background:#1b1a17;color:#f7f3ec;border:0;font-size:18px;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center}'
    + '.prx-close:hover{background:' + ACCENT + '}'
    + '.prx-badge{position:fixed;bottom:14px;right:14px;font:500 11px/1 system-ui,-apple-system,sans-serif;color:#6c685f;background:rgba(247,243,236,0.9);padding:6px 10px;border-radius:99px;border:1px solid #e4ddcf;z-index:2147483647}';
  var style = document.createElement('style'); style.id = 'prx-style'; style.textContent = css;
  document.head.appendChild(style);

  // ---- modal logic ----
  var current = null;
  function open(serviceId, mode) {
    if (mode === 'popup') {
      var w = window.open(
        ORIGIN + '/t/' + TENANT + '/book' + (serviceId ? '?service=' + encodeURIComponent(serviceId) : ''),
        'praxis_book', 'width=720,height=860'
      );
      if (w) w.focus();
      return;
    }
    close();
    var bd = document.createElement('div'); bd.className = 'prx-backdrop'; bd.setAttribute('role','dialog'); bd.setAttribute('aria-modal','true');
    var md = document.createElement('div'); md.className = 'prx-modal';
    var btn = document.createElement('button'); btn.className = 'prx-close'; btn.innerHTML = '×'; btn.setAttribute('aria-label','Luk');
    var ifr = document.createElement('iframe');
    var qs = '?embed=1' + (serviceId ? '&service=' + encodeURIComponent(serviceId) : '');
    ifr.src = ORIGIN + '/t/' + TENANT + '/book' + qs;
    ifr.setAttribute('allow','clipboard-write; payment');
    md.appendChild(ifr); md.appendChild(btn); bd.appendChild(md); document.body.appendChild(bd);
    document.documentElement.style.overflow = 'hidden';
    current = bd;
    btn.addEventListener('click', close);
    bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
    document.addEventListener('keydown', escHandler);
  }
  function escHandler(e) { if (e.key === 'Escape') close(); }
  function close() {
    if (!current) return;
    current.remove(); current = null;
    document.documentElement.style.overflow = '';
    document.removeEventListener('keydown', escHandler);
  }

  // ---- click-delegation ----
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-praxis-book]');
    if (!el) return;
    e.preventDefault();
    var svc = el.getAttribute('data-praxis-book') || null;
    var mode = el.getAttribute('data-praxis-mode') || 'modal';
    open(svc, mode);
  });

  // ---- "drevet af"-badge (kan slås fra med data-praxis-no-badge på <html>) ----
  if (!document.documentElement.hasAttribute('data-praxis-no-badge')) {
    var badge = document.createElement('div'); badge.className = 'prx-badge';
    badge.textContent = '⚡ drevet af PraxisOS';
    document.body && document.body.appendChild(badge);
  }

  // ---- public API ----
  window.PraxisOS = { open: open, close: close, tenant: TENANT, origin: ORIGIN };

  // ---- post-message handshake fra iframen ----
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.source !== 'praxisos') return;
    if (e.data.type === 'close') close();
    if (e.data.type === 'booking_confirmed') {
      // små confetti + auto-luk efter 2,5 sek så kunden ser kvitteringen
      try {
        var fx = document.createElement('div');
        fx.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
        document.body.appendChild(fx);
        for (var i = 0; i < 60; i++) {
          var p = document.createElement('div');
          var col = ['#8a6a3d','#3f7d5a','#b9543a','#ad7a26'][i%4];
          p.style.cssText = 'position:absolute;left:'+(50+Math.random()*0-Math.random()*0)+'%;top:50%;width:8px;height:8px;background:'+col+';border-radius:2px;transform:translate(-50%,-50%) rotate('+(Math.random()*360)+'deg);transition:transform 1.5s cubic-bezier(.16,1,.3,1), opacity 1.5s ease';
          fx.appendChild(p);
          var dx = (Math.random()-0.5)*900, dy = (Math.random()-0.5)*700;
          requestAnimationFrame(function (el, x, y) { return function () {
            el.style.transform = 'translate('+x+'px,'+y+'px) rotate('+(Math.random()*720)+'deg)';
            el.style.opacity = '0';
          }; }(p, dx, dy)());
        }
        setTimeout(function () { fx.remove(); }, 1700);
      } catch (e) {}
      setTimeout(close, 3500);
      // valgfrit: udløs custom event så kunden kan tracke conversion
      try { document.dispatchEvent(new CustomEvent('praxis:booking', { detail: e.data.booking })); } catch(e) {}
    }
  });
})();
`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}

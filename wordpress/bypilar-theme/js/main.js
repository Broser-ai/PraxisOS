// PILAR Theme JavaScript — PraxisOS booking cutover (no Planway)
(function () {
  var PRAXIS_BOOK_ORIGIN = 'https://app.bypilar.dk';
  var PRAXIS_TENANT = 'bypilar';

  function praxisBookUrl(serviceId, embed) {
    var url = PRAXIS_BOOK_ORIGIN + '/t/' + PRAXIS_TENANT + '/book';
    var params = [];
    if (embed) params.push('embed=1');
    if (serviceId) params.push('service=' + encodeURIComponent(serviceId));
    return params.length ? url + '?' + params.join('&') : url;
  }

  /**
   * data-praxis-book click handler → PraxisOS book URL (optional service id).
   * Modes: modal (default iframe overlay), popup, or navigate (data-praxis-mode).
   * Falls through to window.PraxisOS.open when the embed script is loaded.
   */
  function openPraxisBook(serviceId, mode) {
    var svc = serviceId && String(serviceId).trim() ? String(serviceId).trim() : null;
    if (window.PraxisOS && typeof window.PraxisOS.open === 'function') {
      window.PraxisOS.open(svc, mode || 'modal');
      return;
    }
    if (mode === 'popup') {
      var w = window.open(
        praxisBookUrl(svc, false),
        'praxis_book',
        'width=720,height=860'
      );
      if (w) w.focus();
      return;
    }
    if (mode === 'navigate') {
      window.location.href = praxisBookUrl(svc, false);
      return;
    }
    // Lightweight modal fallback when /embed/v1 is not enqueued
    var existing = document.getElementById('pilar-praxis-modal');
    if (existing) existing.remove();
    var bd = document.createElement('div');
    bd.id = 'pilar-praxis-modal';
    bd.setAttribute('role', 'dialog');
    bd.setAttribute('aria-modal', 'true');
    bd.style.cssText =
      'position:fixed;inset:0;background:rgba(20,18,15,0.55);backdrop-filter:blur(6px);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:20px';
    var md = document.createElement('div');
    md.style.cssText =
      'position:relative;width:min(960px,100%);height:min(820px,calc(100vh - 40px));background:#f7f3ec;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.35)';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Luk');
    btn.textContent = '×';
    btn.style.cssText =
      'position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;background:#1b1a17;color:#f7f3ec;border:0;font-size:18px;cursor:pointer;z-index:2';
    var ifr = document.createElement('iframe');
    ifr.src = praxisBookUrl(svc, true);
    ifr.title = 'Book behandling hos by Pilar';
    ifr.setAttribute('allow', 'clipboard-write; payment');
    ifr.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#f7f3ec';
    function close() {
      bd.remove();
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', onEsc);
    }
    function onEsc(e) {
      if (e.key === 'Escape') close();
    }
    btn.addEventListener('click', close);
    bd.addEventListener('click', function (e) {
      if (e.target === bd) close();
    });
    document.addEventListener('keydown', onEsc);
    md.appendChild(ifr);
    md.appendChild(btn);
    bd.appendChild(md);
    document.body.appendChild(bd);
    document.documentElement.style.overflow = 'hidden';
  }

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-praxis-book]');
    if (!el) return;
    e.preventDefault();
    var raw = el.getAttribute('data-praxis-book');
    var svc = raw && raw !== '' && raw !== 'true' ? raw : null;
    var mode = el.getAttribute('data-praxis-mode') || 'modal';
    openPraxisBook(svc, mode);
  });

  document.addEventListener('DOMContentLoaded', function () {
    var nav = document.getElementById('siteNav');
    if (nav) {
      window.addEventListener('scroll', function () {
        nav.classList.toggle('scrolled', window.scrollY > 50);
      });
    }

    var menuLinks = document.querySelectorAll('#primaryMenu a');
    menuLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        var menu = document.getElementById('primaryMenu');
        if (menu) menu.classList.remove('open');
      });
    });

    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var target = document.querySelector(this.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  });

  window.PilarBook = { open: openPraxisBook, url: praxisBookUrl };
})();

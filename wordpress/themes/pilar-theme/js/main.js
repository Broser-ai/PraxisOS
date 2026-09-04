// PILAR Theme JavaScript — PraxisOS booking (white-label on bypilar.dk)
(function () {
  var BOOK_ORIGIN = 'https://app.bypilar.dk';
  var BOOK_PATH = '/t/bypilar/book';

  function bookUrl(serviceId, embed) {
    var qs = [];
    if (embed) qs.push('embed=1');
    if (serviceId) qs.push('service=' + encodeURIComponent(serviceId));
    return BOOK_ORIGIN + BOOK_PATH + (qs.length ? '?' + qs.join('&') : '');
  }

  function openBooking(serviceId, mode) {
    var url = bookUrl(serviceId, mode !== 'popup');
    if (mode === 'popup') {
      var w = window.open(url, 'bypilar_book', 'width=720,height=860');
      if (w) w.focus();
      return;
    }
    // Prefer official embed modal if loaded; else navigate to /booking/ with iframe
    if (window.PraxisOS && typeof window.PraxisOS.open === 'function') {
      try {
        window.PraxisOS.open(serviceId || null, mode || 'modal');
        return;
      } catch (e) { /* fall through */ }
    }
    if (window.location.pathname.indexOf('/booking') === 0) {
      var iframe = document.querySelector('.booking-embed iframe');
      if (iframe) {
        iframe.src = bookUrl(serviceId, true);
        iframe.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    var dest = '/booking/';
    if (serviceId) dest += '?service=' + encodeURIComponent(serviceId);
    window.location.href = dest;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Suppress vendor badge on customer host (white-label)
    document.documentElement.setAttribute('data-praxis-no-badge', '1');
    var badge = document.querySelector('.prx-badge');
    if (badge) badge.remove();

    // Nav scroll effect
    var nav = document.getElementById('siteNav');
    if (nav) {
      window.addEventListener('scroll', function () {
        nav.classList.toggle('scrolled', window.scrollY > 50);
      });
    }

    // Close mobile menu on link click
    var menuLinks = document.querySelectorAll('#primaryMenu a');
    menuLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        var menu = document.getElementById('primaryMenu');
        if (menu) menu.classList.remove('open');
      });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var target = document.querySelector(this.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Force HTTPS on any leftover booking iframes (mixed-content guard)
    document.querySelectorAll('.booking-embed iframe, iframe[src*="app.bypilar"]').forEach(function (ifr) {
      var src = ifr.getAttribute('src') || '';
      if (src.indexOf('http://app.bypilar.dk') === 0) {
        ifr.setAttribute('src', src.replace('http://', 'https://'));
      }
      if (/planway\.com/i.test(src)) {
        ifr.setAttribute('src', bookUrl(null, true));
      }
    });

    // Optional: deep-link ?service= on /booking/
    if (window.location.pathname.indexOf('/booking') === 0) {
      var params = new URLSearchParams(window.location.search);
      var svc = params.get('service');
      if (svc) {
        var iframe = document.querySelector('.booking-embed iframe');
        if (iframe) iframe.src = bookUrl(svc, true);
      }
    }
  });

  // Click-delegation for data-praxis-book (works even if embed script fails)
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-praxis-book]');
    if (!el) return;
    e.preventDefault();
    var svc = el.getAttribute('data-praxis-book') || null;
    if (svc === '') svc = null;
    var mode = el.getAttribute('data-praxis-mode') || 'modal';
    openBooking(svc, mode);
  });

  window.byPilarBook = { open: openBooking, url: bookUrl };
})();

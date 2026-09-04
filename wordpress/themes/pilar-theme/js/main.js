// PILAR Theme JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Nav scroll effect
  var nav = document.getElementById('siteNav');
  if (nav) {
    window.addEventListener('scroll', function() {
      nav.classList.toggle('scrolled', window.scrollY > 50);
    });
  }

  // Close mobile menu on link click
  var menuLinks = document.querySelectorAll('#primaryMenu a');
  menuLinks.forEach(function(link) {
    link.addEventListener('click', function() {
      document.getElementById('primaryMenu').classList.remove('open');
    });
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});

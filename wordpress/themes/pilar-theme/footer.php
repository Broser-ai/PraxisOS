<?php
$home = esc_url(home_url('/'));
$year = (int) gmdate('Y');
?>
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="22.5" stroke="#D4B5A0" stroke-width="1.2"/><text x="24" y="31" text-anchor="middle" font-family="Bodoni Moda, serif" font-size="26" fill="#D4B5A0">P</text></svg>
          <div>
            <div style="font-family:var(--display);font-size:18px;letter-spacing:5px;color:var(--cream)">PILAR</div>
            <div style="font-size:8px;letter-spacing:3px;text-transform:uppercase;color:var(--gray)">Negle &amp; Fodpleje</div>
          </div>
        </div>
        <p class="footer-desc">Din tid til pleje og forkælelse. Negle, fodpleje &amp; nail art i Aarhus — også udekørende.</p>
      </div>

      <div>
        <div class="footer-heading">Sider</div>
        <?php
        wp_nav_menu([
            'theme_location' => 'footer',
            'container' => false,
            'menu_class' => 'footer-menu',
            'fallback_cb' => 'pilar_fallback_footer_menu',
        ]);
        ?>
      </div>

      <div>
        <div class="footer-heading">Kontakt</div>
        <div class="footer-contact">
          📍 Aarhus<br>
          📞 <a href="tel:+4593952041" style="color:var(--cream);opacity:0.6">+45 93 95 20 41</a><br>
          ✉️ <a href="mailto:hej@bypilar.dk" style="color:var(--cream);opacity:0.6">hej@bypilar.dk</a><br>
          📸 <a href="https://instagram.com/bypilar.studio" target="_blank" rel="noopener" style="color:var(--cream);opacity:0.6">@bypilar.studio</a>
        </div>
      </div>

      <div>
        <div class="footer-heading">Åbningstider</div>
        <div class="footer-contact">
          Man–Fre: 9–17<br>
          Lør: 9–14<br>
          Søn: Lukket
        </div>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08)">
          <div class="footer-heading">Udekørende</div>
          <div class="footer-contact">Eft. aftale<br>Også aften &amp; weekend</div>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <span>&copy; <?php echo $year; ?> PILAR · Negle &amp; Fodpleje</span>
      <span>
        <?php echo do_shortcode('[praxis_klinik class=""]'); ?>
        · <a href="<?php echo esc_url(home_url('/privatlivspolitik/')); ?>" style="opacity:0.5">Privatlivspolitik</a>
        · CVR: 43947079
      </span>
    </div>
  </div>
</footer>
<?php wp_footer(); ?>
</body>
</html>

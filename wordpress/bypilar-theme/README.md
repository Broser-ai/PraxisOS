# bypilar-theme (PILAR)

Deploy package for live `bypilar.dk` WordPress theme (`pilar-theme` slug on server).

Canonical booking embed:

```html
<iframe src="https://app.bypilar.dk/t/bypilar/book?embed=1" ...></iframe>
```

Book CTAs use `data-praxis-book` / `data-praxis-book="<service-id>"` (handled by `js/main.js`).

On the live host the active theme directory is:

`wp-content/themes/pilar-theme/`

Copy these files over the live theme (do **not** rename the slug unless activating a new theme):

- `parts/booking.phpfrag`
- `parts/hjem.phpfrag`
- `parts/behandlinger.phpfrag`
- `parts/udekoerende.phpfrag`
- `js/main.js`
- `functions.php`
- `style.css`

Optional MU-plugin: `../mu-plugins/praxisos-bridge.php` → `wp-content/mu-plugins/praxisos-bridge.php`

Planway account must remain; only outbound links are removed.

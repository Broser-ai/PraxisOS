#!/usr/bin/env bash
# Migrér bypilar.dk-indhold (PILAR-tema + sider) ind i Hetzner WordPress
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
WP=(bash "${ROOT}/scripts/wp.sh")

echo "=> Aktiverer pilar-theme..."
"${WP[@]}" theme activate pilar-theme

echo "=> Sletter demo-forside hvis den findes..."
OLD_FRONT="$("${WP[@]}" option get page_on_front 2>/dev/null || true)"
if [[ -n "${OLD_FRONT}" && "${OLD_FRONT}" != "0" ]]; then
  TITLE="$("${WP[@]}" post get "${OLD_FRONT}" --field=post_title 2>/dev/null || true)"
  if [[ "${TITLE}" == "Forside" ]]; then
    "${WP[@]}" post delete "${OLD_FRONT}" --force >/dev/null || true
  fi
fi

create_page() {
  local slug="$1" title="$2"
  local existing
  existing="$("${WP[@]}" post list --post_type=page --name="${slug}" --field=ID 2>/dev/null | head -1 || true)"
  if [[ -n "${existing}" ]]; then
    echo "   (findes) ${slug} → ${existing}"
    echo "${existing}"
    return 0
  fi
  local id
  id="$("${WP[@]}" post create \
    --post_type=page \
    --post_title="${title}" \
    --post_name="${slug}" \
    --post_status=publish \
    --porcelain)"
  echo "   oprettet ${slug} → ${id}"
  echo "${id}"
}

echo "=> Opretter sider..."
HOME_ID="$(create_page hjem Hjem | tail -1)"
create_page behandlinger Behandlinger >/dev/null
create_page udekoerende Udekørende >/dev/null
create_page booking "Book Tid" >/dev/null
create_page om-os "Om Os" >/dev/null
create_page blog Blog >/dev/null
PRIV_ID="$(create_page privatlivspolitik Privatlivspolitik | tail -1)"

echo "=> Forside + blog + privacy..."
"${WP[@]}" option update show_on_front page
"${WP[@]}" option update page_on_front "${HOME_ID}"
BLOG_ID="$("${WP[@]}" post list --post_type=page --name=blog --field=ID | head -1)"
"${WP[@]}" option update page_for_posts "${BLOG_ID}"
"${WP[@]}" option update blogname "PILAR — Negle & Fodpleje"
"${WP[@]}" option update blogdescription "Din tid til pleje og forkælelse"
if [[ -n "${PRIV_ID}" ]]; then
  "${WP[@]}" option update wp_page_for_privacy_policy "${PRIV_ID}"
fi

echo "=> Menuer..."
# Primary
if ! "${WP[@]}" menu list --format=csv 2>/dev/null | grep -q ',primary,'; then
  MENU_ID="$("${WP[@]}" menu create "Primary" --porcelain)"
  "${WP[@]}" menu location assign "${MENU_ID}" primary
else
  MENU_ID="$("${WP[@]}" menu list --format=csv | awk -F, '$2=="Primary" || /primary/{print $1; exit}')"
fi
# Rebuild items
EXISTING_ITEMS="$("${WP[@]}" menu item list "${MENU_ID}" --format=ids 2>/dev/null || true)"
for item in ${EXISTING_ITEMS}; do
  "${WP[@]}" menu item delete "${item}" >/dev/null 2>&1 || true
done
for pair in "hjem:Hjem" "behandlinger:Behandlinger" "udekoerende:Udekørende" "booking:Book Tid" "om-os:Om Os"; do
  slug="${pair%%:*}"; title="${pair#*:}"
  pid="$("${WP[@]}" post list --post_type=page --name="${slug}" --field=ID | head -1)"
  "${WP[@]}" menu item add-post "${MENU_ID}" "${pid}" --title="${title}" >/dev/null
done

# Footer
if ! "${WP[@]}" menu list --fields=name --format=csv 2>/dev/null | grep -qx 'Footer'; then
  FOOTER_ID="$("${WP[@]}" menu create "Footer" --porcelain)"
  "${WP[@]}" menu location assign "${FOOTER_ID}" footer || true
else
  FOOTER_ID="$("${WP[@]}" menu list --format=csv | awk -F, '$2=="Footer"{print $1; exit}')"
fi
EXISTING_ITEMS="$("${WP[@]}" menu item list "${FOOTER_ID}" --format=ids 2>/dev/null || true)"
for item in ${EXISTING_ITEMS}; do
  "${WP[@]}" menu item delete "${item}" >/dev/null 2>&1 || true
done
for pair in "hjem:Hjem" "behandlinger:Behandlinger" "udekoerende:Udekørende" "booking:Book Tid" "om-os:Om Os" "privatlivspolitik:Privatlivspolitik"; do
  slug="${pair%%:*}"; title="${pair#*:}"
  pid="$("${WP[@]}" post list --post_type=page --name="${slug}" --field=ID | head -1)"
  "${WP[@]}" menu item add-post "${FOOTER_ID}" "${pid}" --title="${title}" >/dev/null
done

echo "=> Permalinks..."
"${WP[@]}" rewrite structure '/%postname%/' --hard >/dev/null || true
"${WP[@]}" rewrite flush --hard >/dev/null || true

echo "=> Site URL (Traefik Host bypilar.dk)..."
"${WP[@]}" option update siteurl 'http://bypilar.dk'
"${WP[@]}" option update home 'http://bypilar.dk'

echo ""
echo "FÆRDIG — PILAR-site migreret"
echo "  http://bypilar.dk  (kræver A-record kun til Hetzner)"
echo "  http://167.233.171.184:8088  (direkte)"
echo ""
"${WP[@]}" theme list
"${WP[@]}" post list --post_type=page --fields=ID,post_title,post_name,post_status

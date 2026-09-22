#!/data/data/com.termux/files/usr/bin/sh
# Rebuild frontend + re-injecte PWA + copie vers public/ backend + redemarre serveur.
# Usage local (tablette uniquement, ne touche ni GitHub ni la raspi).
set -e
export LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib
export LD_PRELOAD=libtermux-exec.so
export HOME=/data/data/com.termux/files/home
export PATH=/data/data/com.termux/files/usr/bin:/bin
export TMPDIR=/data/data/com.termux/files/usr/tmp

ROOT="$HOME/marco-tablet"
FRONT="$ROOT/marco-prime-frontend"
BACK="$ROOT/marco-prime-backend"
PWA="$ROOT/frontend-pwa"
LOG="$BACK/server.log"

echo "[build-front] $(date) demarrage" >> "$LOG"

# 1) Build du frontend
cd "$FRONT" || exit 1
pnpm build > "$FRONT/build.log" 2>&1
echo "[build-front] build termine" >> "$LOG"

IDX="$FRONT/dist/index.html"

# 2) Injecter la balise manifest si absente
if ! grep -q 'rel="manifest"' "$IDX"; then
  sed -i 's|<link rel="icon" type="image/svg+xml" href="/marco.svg" />|<link rel="icon" type="image/svg+xml" href="/marco.svg" />\n    <link rel="manifest" href="/manifest.json" />\n    <meta name="theme-color" content="#0f0f0f" />|' "$IDX"
fi

# 3) Injecter l'enregistrement du service worker si absent (apres <script type=module crossorigin src=)
if ! grep -q 'serviceWorker.register' "$IDX"; then
  sed -i 's|<script type="module" crossorigin src="|<script>if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js").catch(function(){})}</script>\n    <script type="module" crossorigin src="|' "$IDX"
fi

# 4) Copier PWA (manifest/sw/icons) dans le dist
cp "$PWA/sw.js" "$FRONT/dist/sw.js"
cp "$PWA/manifest.json" "$FRONT/dist/manifest.json"
mkdir -p "$FRONT/dist/icons"
cp "$PWA/icons/icon-192.png" "$FRONT/dist/icons/"
cp "$PWA/icons/icon-512.png" "$FRONT/dist/icons/"
echo "[build-front] pwa injectee" >> "$LOG"

# 5) Copier dist -> public/ backend
rm -rf "$BACK/public/assets" "$BACK/public/index.html"
cp -r "$FRONT/dist/"* "$BACK/public/"
echo "[build-front] frontend copie vers public/ et termine $(date)" >> "$LOG"
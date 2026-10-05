#!/bin/sh
# Prepara la cartella pubblicata da Cloudflare (vedi wrangler.jsonc).
set -e
OUT=.cf-dist
rm -rf "$OUT"
mkdir -p "$OUT"

# 1. Gestionale del ristorante: file statici, senza compilazione
cp index.html manifest.webmanifest sw.js icon-192.png icon-512.png icon-maskable.png apple-touch-icon.png "$OUT"/

# 2. Custode, pubblicato sotto /custode/
(cd custode && npm ci --no-audit --no-fund && BASE=/custode/ npm run build)
cp -R custode/dist "$OUT"/custode

# 3. Intestazioni: service worker e pagine sempre aggiornati, permessi per fotocamera e GPS
cat > "$OUT"/_headers <<'H'
/sw.js
  Cache-Control: public, max-age=0, must-revalidate
/index.html
  Cache-Control: public, max-age=0, must-revalidate
/manifest.webmanifest
  Content-Type: application/manifest+json
/custode/sw.js
  Cache-Control: public, max-age=0, must-revalidate
/custode/index.html
  Cache-Control: public, max-age=0, must-revalidate
/custode/*
  Permissions-Policy: camera=(self), geolocation=(self), microphone=()
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
H
echo "Pronto: $(find "$OUT" -type f | wc -l) file in $OUT"

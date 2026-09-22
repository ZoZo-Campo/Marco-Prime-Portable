#!/data/data/com.termux/files/usr/bin/sh
B=/data/data/com.termux/files/home/marco-tablet/marco-prime-backend/public/index.html
D=/data/data/com.termux/files/home/marco-tablet/marco-prime-frontend/dist/index.html
INJECT_HEAD='    <link rel="manifest" href="/manifest.json" />\n    <meta name="theme-color" content="#0f0f0f" />'
INJECT_BODY='    <script>\n      if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(function () {});\n    </script>'
for F in $B $D; do
  if grep -q 'rel="manifest"' "$F"; then
    echo "deja injecte: $F"
    continue
  fi
  # inject after <link rel="icon" ...> line
  python3 - "$F" << 'PY'
import re, sys
f = sys.argv[1]
s = open(f).read()
s = re.sub(r'(<link rel="icon"[^>]*>\s*)', r'\1\n    <link rel="manifest" href="/manifest.json" />\n    <meta name="theme-color" content="#0f0f0f" />', s, count=1)
s = re.sub(r'(</body>\s*)', r'\1\n    <script>if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js").catch(function(){})}</script>\n', s, count=1)
open(f, "w").write(s)
PY
  echo "injecte: $F"
done
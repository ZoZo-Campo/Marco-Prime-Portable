#!/data/data/com.termux/files/usr/bin/sh
export LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib
export LD_PRELOAD=libtermux-exec.so
export HOME=/data/data/com.termux/files/home
export PATH=/data/data/com.termux/files/usr/bin:/bin
export TMPDIR=/data/data/com.termux/files/usr/tmp
for p in manifest.json sw.js icons/icon-192.png icons/icon-512.png; do
  printf "%s -> " "$p"
  curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3001/$p"
done

#!/data/data/com.termux/files/usr/bin/sh
set -e
export LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib
export LD_PRELOAD=libtermux-exec.so
export HOME=/data/data/com.termux/files/home
export PATH=/data/data/com.termux/files/usr/bin:/bin
export TMPDIR=/data/data/com.termux/files/usr/tmp
ROOT="$HOME/marco-tablet"
BACK="$ROOT/marco-prime-backend"
LOG="$BACK/server.log"
echo "[rebuild] $(date) -- compile backend + build frontend + deploy" >> "$LOG"

# 1) Backend: compile TS -> dist
cd "$BACK" || exit 1
pnpm build > "$BACK/build-back.log" 2>&1 && echo "[rebuild] backend compile OK" >> "$LOG" || { echo "[rebuild] ECHEC backend" >> "$LOG"; tail -20 "$BACK/build-back.log" >> "$LOG"; exit 1; }

# 2) Frontend: build + inject PWA + copier vers public/
"$HOME/build-front.sh" >> "$LOG" 2>&1 || { echo "[rebuild] ECHEC frontend" >> "$LOG"; exit 1; }
echo "[rebuild] frontend deploye" >> "$LOG"

echo "[rebuild] termine $(date)" >> "$LOG"
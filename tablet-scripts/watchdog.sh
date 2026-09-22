#!/data/data/com.termux/files/usr/bin/sh
export LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib
export LD_PRELOAD=libtermux-exec.so
export HOME=/data/data/com.termux/files/home
export PATH=/data/data/com.termux/files/usr/bin:/bin
export TMPDIR=/data/data/com.termux/files/usr/tmp

ROOT="$HOME/marco-tablet"
BACK="$ROOT/marco-prime-backend"
LOG="$BACK/server.log"
CHECK_INTERVAL=15

log() { echo "[watchdog] $(date '+%Y-%m-%d %H:%M:%S') $@" >> "$LOG"; }

log "demarrage (intervalle ${CHECK_INTERVAL}s)"

while true; do
  # --- Serveur Marco: relance si le process est absent
  if ! pgrep -f "node dist/index.js" > /dev/null 2>&1; then
    log "serveur arrete -> relance"
    cd "$BACK" || { log "chemin backend introuvable"; sleep 30; continue; }
    nohup node dist/index.js >> "$LOG" 2>&1 &
    sleep 4
    if pgrep -f "node dist/index.js" > /dev/null 2>&1; then
      log "relance OK"
    else
      log "ECHEC relance"
    fi
  fi

  sleep "$CHECK_INTERVAL"
done
#!/data/data/com.termux/files/usr/bin/sh
# Relance autonome de Marco Prime (sans l'agent) :
#   - garde un wake-lock (si Termux:API installe)
#   - relance le serveur node s'il est absent (ou le remplace avec --force)
#   - relance le watchdog s'il est absent
# Usage:
#   relance-marco.sh            -> relance ce qui manque
#   relance-marco.sh --force    -> arrete puis redemarre le serveur proprement
export LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib
export LD_PRELOAD=libtermux-exec.so
export HOME=/data/data/com.termux/files/home
export PATH=/data/data/com.termux/files/usr/bin:/bin
export TMPDIR=/data/data/com.termux/files/usr/tmp

ROOT="$HOME/marco-tablet"
BACK="$ROOT/marco-prime-backend"
LOG="$BACK/server.log"
NODE=/data/data/com.termux/files/usr/bin/node

FORCE=0
[ "$1" = "--force" ] && FORCE=1

log() { echo "[relance] $(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

# --- 1) Wake-lock: garde le process Termux prioritaire (anti-kill Android)
if command -v termux-wake-lock >/dev/null 2>&1; then
  if ! pgrep -f "termux-wake-lock" >/dev/null 2>&1; then
    nohup termux-wake-lock >> "$LOG" 2>&1 &
    log "wake-lock relance"
  fi
fi

# --- 2) Serveur
running() { pgrep -f "node dist/index.js" >/dev/null 2>&1; }

if [ "$FORCE" = 1 ] && running; then
  log "force: arret de l'ancien serveur"
  for p in $(pgrep -f "node dist/index.js"); do
    cmd=$(tr "\0" " " < "/proc/$p/cmdline" 2>/dev/null)
    case "$cmd" in
      */node[[:space:]]*dist/index.js*|*"/node dist/index.js"*)
        kill "$p" 2>/dev/null; log "  pid $p arrete" ;;
    esac
  done
  sleep 2
fi

if running; then
  log "serveur deja actif"
else
  cd "$BACK" || { log "chemin backend introuvable — abandon"; exit 1; }
  nohup "$NODE" dist/index.js >> "$LOG" 2>&1 &
  log "serveur relance"
  sleep 2
fi

# --- 3) Watchdog
if ! pgrep -f "watchdog.sh" >/dev/null 2>&1; then
  nohup "$HOME/watchdog.sh" >> "$LOG" 2>&1 &
  log "watchdog relance"
fi

# --- 4) Verification
if pgrep -f "node dist/index.js" >/dev/null 2>&1; then
  echo "OK : serveur Marco actif"
  log "verification : serveur OK"
else
  echo "KO : serveur absent"
  log "verification : serveur ABSENT"
fi

exit 0
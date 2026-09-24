#!/data/data/com.termux/files/usr/bin/sh
# Boot Marco Prime (Termux:Boot) : relance tout seul au demarrage de la tablette.
export LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib
export LD_PRELOAD=libtermux-exec.so
export HOME=/data/data/com.termux/files/home
export PATH=/data/data/com.termux/files/usr/bin:/bin
export TMPDIR=/data/data/com.termux/files/usr/tmp

LOG="$HOME/marco-tablet/marco-prime-backend/server.log"
SETUPPKG=com.tblenovo.setup

echo "[boot] $(date) -- demarrage Marco (serveur seul, local)" >> "$LOG"

# --- 1) Paquets gênants: on purge le setup région s'il existe ---
pm path $SETUPPKG >/dev/null 2>&1 && { pm uninstall --user 0 $SETUPPKG >> "$LOG" 2>&1; echo "[boot] setup region supprime" >> "$LOG"; }

# --- 2) Veille: jamais d'extinction ecran au comptoir ---
settings put system screen_off_timeout 2147483647 2>/dev/null
settings put global stay_on_while_plugged_in 7 2>/dev/null

# --- 3) Fullscreen immersif navigateur (defensif) ---
settings put global policy_control immersive.full=org.bromite.bromite 2>/dev/null

# --- 4) Wake-lock: eviter qu'Android tue Termux en arriere-plan ---
command -v termux-wake-lock >/dev/null 2>&1 && {
  nohup termux-wake-lock >> "$LOG" 2>&1 &
  echo "[boot] wake-lock lance" >> "$LOG";
}

# --- 5) Serveur + watchdog via le script de relance unique ---
if [ -x "$HOME/relance-marco.sh" ]; then
  "$HOME/relance-marco.sh" >> "$LOG" 2>&1
  echo "[boot] relance-marco.sh execute" >> "$LOG"
else
  # Fallback si le script n'est pas la
  if ! pgrep -f "node dist/index.js" > /dev/null 2>&1; then
    cd "$HOME/marco-tablet/marco-prime-backend" || { echo "[boot] backend introuvable" >> "$LOG"; exit 1; }
    nohup /data/data/com.termux/files/usr/bin/node dist/index.js >> "$LOG" 2>&1 &
    echo "[boot] node demarre" >> "$LOG"
  fi
  if ! pgrep -f "watchdog.sh" > /dev/null 2>&1; then
    nohup "$HOME/watchdog.sh" >> "$LOG" 2>&1 &
    echo "[boot] watchdog lance" >> "$LOG"
  fi
fi

# --- 6) Rebuild frontend en arriere-plan (ne bloque pas le demarrage) ---
if [ -f "$HOME/build-front.sh" ]; then
  nohup "$HOME/build-front.sh" >> "$LOG" 2>&1 &
  echo "[boot] build-front lance en fond" >> "$LOG"
fi

exit 0
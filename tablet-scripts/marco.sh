#!/data/data/com.termux/files/usr/bin/sh
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

# --- 4) Serveur: on le demarre tout de suite (le build se fait en fond)
if ! pgrep -f "node dist/index.js" > /dev/null 2>&1; then
  cd "$HOME/marco-tablet/marco-prime-backend" || { echo "[boot] backend introuvable" >> "$LOG"; exit 1; }
  nohup node dist/index.js >> "$LOG" 2>&1 &
  echo "[boot] node demarre" >> "$LOG"
fi

# --- 5) Watchdog: relance le serveur seul si crash (navigateur: libre)
if ! pgrep -f "watchdog.sh" > /dev/null 2>&1; then
  nohup "$HOME/watchdog.sh" >> "$LOG" 2>&1 &
  echo "[boot] watchdog lance" >> "$LOG"
fi

# --- 6) Rebuild frontend en arriere-plan (ne bloque pas le demarrage)
if [ -f "$HOME/build-front.sh" ]; then
  nohup "$HOME/build-front.sh" >> "$LOG" 2>&1 &
  echo "[boot] build-front lance en fond" >> "$LOG"
fi

exit 0
#!/data/data/com.termux/files/usr/bin/sh
# Arret propre de Marco Prime : stoppe le watchdog PUIS le serveur node.
# Le watchdog est stoppe en premier pour eviter qu'il relance le serveur.
# Installe par install.sh dans ~/stop-marco.sh (et ~/.shortcuts/stop.sh).
export HOME=/data/data/com.termux/files/home
export PATH=/data/data/com.termux/files/usr/bin:/bin
BACK="$HOME/marco-tablet/marco-prime-backend"
LOG="$BACK/server.log"
log() { echo "[stop] $(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

log "arret demande"
pkill -f "watchdog.sh" 2>/dev/null && log "watchdog arrete"

for p in $(pgrep -f "node dist/index.js"); do
  kill "$p" 2>/dev/null && log "serveur pid $p (TERM)"
done
sleep 2
for p in $(pgrep -f "node dist/index.js"); do
  kill -9 "$p" 2>/dev/null && log "serveur pid $p (KILL)"
done

if pgrep -f "node dist/index.js" >/dev/null 2>&1; then
  echo "KO : serveur encore actif"; log "echec arret"
else
  echo "OK : serveur Marco arrete proprement"; log "arret OK"
fi
exit 0

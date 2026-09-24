# Marco Prime : relance automatique quand une session Termux s'ouvre.
# A copier dans ~/.bashrc et ~/.profile de la tablette (voir deploy-terms.sh).
# Effet : un simple clic sur l'icone Termux relance serveur + watchdog.
if [ -z "$MARCO_RELANCE_DONE" ]; then
  export MARCO_RELANCE_DONE=1
  if [ -x "$HOME/relance-marco.sh" ]; then
    echo "[Marco] verification / relance du serveur..."
    "$HOME/relance-marco.sh"
  fi
fi
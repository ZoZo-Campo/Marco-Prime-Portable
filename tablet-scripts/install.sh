#!/data/data/com.termux/files/usr/bin/sh
# Installe les scripts et les reglages Termux de Marco Prime dans le home de la tablette.
# A lancer UNE fois, depuis le dossier tablet-scripts (voir INSTALLATION_TABLETTE.md) :
#   cd ~/marco-setup/tablet-scripts && sh install.sh
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
HOME=/data/data/com.termux/files/home

echo "[install] copie de $HERE vers $HOME"

mkdir -p "$HOME/.termux/boot" "$HOME/.shortcuts"

# --- scripts du home ---
cp "$HERE/home/build-front.sh"   "$HOME/build-front.sh"
cp "$HERE/home/rebuild.sh"       "$HOME/rebuild.sh"
cp "$HERE/home/relance-marco.sh" "$HOME/relance-marco.sh"
cp "$HERE/home/stop-marco.sh"    "$HOME/stop-marco.sh"
cp "$HERE/home/watchdog.sh"      "$HOME/watchdog.sh"
cp "$HERE/home/relance.html"     "$HOME/relance.html"

# --- fichiers caches (dotfiles) ---
cp "$HERE/home/.bashrc"  "$HOME/.bashrc"
cp "$HERE/home/.profile" "$HOME/.profile"
cp "$HERE/home/.termux/termux.properties" "$HOME/.termux/termux.properties"
cp "$HERE/home/.termux/boot/marco.sh"     "$HOME/.termux/boot/marco.sh"
cp "$HERE/home/.shortcuts/relance.sh"     "$HOME/.shortcuts/relance.sh"
cp "$HERE/home/.shortcuts/stop.sh"        "$HOME/.shortcuts/stop.sh"

# --- droits ---
chmod +x "$HOME/build-front.sh" "$HOME/rebuild.sh" "$HOME/relance-marco.sh" "$HOME/stop-marco.sh" "$HOME/watchdog.sh"
chmod +x "$HOME/.termux/boot/marco.sh" "$HOME/.shortcuts/relance.sh" "$HOME/.shortcuts/stop.sh"
# StrictModes sshd: le home ne doit pas etre accessible en ecriture aux autres
chmod 700 "$HOME"

# Recharger les reglages Termux (allow-external-apps) si l'outil est present
command -v termux-reload-settings >/dev/null 2>&1 && termux-reload-settings >/dev/null 2>&1 || true

echo "[install] OK : scripts + dotfiles installes dans $HOME"
echo "[install] etape suivante : sh setup-ssh.sh \"<votre cle publique SSH>\""

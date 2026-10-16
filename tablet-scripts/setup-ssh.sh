#!/data/data/com.termux/files/usr/bin/sh
# Active l'acces SSH distant a la tablette (Termux) : port 8022, par cle publique.
# A lancer sur la tablette :
#   sh setup-ssh.sh "ssh-ed25519 AAAA...lenzocampofranco"
#   sh setup-ssh.sh              # lit ~/ssh-pubkey.pub si present
set -e
HOME=/data/data/com.termux/files/home
CFG=/data/data/com.termux/files/usr/etc/ssh/sshd_config
AK="$HOME/.ssh/authorized_keys"
PUBFILE="$HOME/ssh-pubkey.pub"

# 1) Cle publique autorisee
PUB="${1:-}"
mkdir -p "$HOME/.ssh"
if [ -n "$PUB" ]; then
  printf '%s\n' "$PUB" > "$AK"
elif [ -f "$PUBFILE" ]; then
  cat "$PUBFILE" > "$AK"
else
  echo "ERREUR : fournir la cle publique en argument, ou la placer dans $PUBFILE"
  exit 1
fi

# 2) Droits (sshd StrictModes refuse les modes trop ouverts)
chmod 700 "$HOME" "$HOME/.ssh"
chmod 600 "$AK"

# 3) Cle d'hote si absente
[ -f /data/data/com.termux/files/usr/etc/ssh/ssh_host_ed25519_key ] || ssh-keygen -A >/dev/null 2>&1

# 4) Port 8022
grep -q '^Port 8022' "$CFG" || printf '\nPort 8022\n' >> "$CFG"

# 5) Demarrer sshd
if pgrep -x sshd >/dev/null 2>&1; then
  echo "[ssh] sshd deja actif"
else
  sshd && echo "[ssh] sshd demarre"
fi

IP=$(getprop dhcp.wlan0.ipaddress 2>/dev/null)
echo "[ssh] OK. Depuis le Mac :  ssh -p 8022 $(whoami)@${IP:-<IP_TABLETTE>}"

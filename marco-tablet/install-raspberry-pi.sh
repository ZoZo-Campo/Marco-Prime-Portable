#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
KIOSK_USER="${1:-${SUDO_USER:-}}"

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo "$0" "${1:-}"
fi

if [[ -z "${KIOSK_USER}" || "${KIOSK_USER}" == "root" ]]; then
  echo "Erreur : lance ce script avec sudo depuis le compte qui affichera Marco."
  echo "Exemple : sudo ./install-raspberry-pi.sh pi"
  exit 1
fi

if ! id "${KIOSK_USER}" >/dev/null 2>&1; then
  echo "Erreur : l'utilisateur '${KIOSK_USER}' n'existe pas."
  exit 1
fi

if [[ "$(dpkg --print-architecture)" != "arm64" ]]; then
  echo "Erreur : Raspberry Pi OS 64 bits récent (arm64) est requis."
  exit 1
fi

echo "Installation des composants légers du kiosque..."
apt-get update

. /etc/os-release
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates \
  chromium \
  curl \
  dbus-user-session \
  git \
  network-manager \
  python3 \
  rsync

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Installation de Docker Engine et du plugin Compose..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg \
    -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  DOCKER_CODENAME="${VERSION_CODENAME:-trixie}"
  DOCKER_ARCH="$(dpkg --print-architecture)"
  printf '%s\n' \
    "Types: deb" \
    "URIs: https://download.docker.com/linux/debian" \
    "Suites: ${DOCKER_CODENAME}" \
    "Components: stable" \
    "Architectures: ${DOCKER_ARCH}" \
    "Signed-By: /etc/apt/keyrings/docker.asc" \
    > /etc/apt/sources.list.d/docker.sources

  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
fi

systemctl enable --now docker.service
usermod -aG docker "${KIOSK_USER}"

echo "Installation du contrôle Wi-Fi sécurisé..."
install -D -m 0755 \
  "${SCRIPT_DIR}/raspberry-pi/marco-wifi-helper.py" \
  /usr/local/libexec/marco-wifi-helper.py

KIOSK_GID="$(id -g "${KIOSK_USER}")"
cat > /etc/systemd/system/marco-wifi.service <<EOF
[Unit]
Description=Marco Prime restricted Wi-Fi controller
After=NetworkManager.service
Requires=NetworkManager.service

[Service]
Type=simple
User=root
Environment=MARCO_WIFI_SOCKET_GID=${KIOSK_GID}
ExecStart=/usr/bin/python3 /usr/local/libexec/marco-wifi-helper.py
Restart=on-failure
RestartSec=2
RuntimeDirectory=marco-wifi
RuntimeDirectoryMode=0770
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_UNIX

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now NetworkManager.service
systemctl enable --now marco-wifi.service

echo "Préparation du service Marco (lancement manuel depuis le Bureau)..."
KIOSK_GROUP="$(id -gn "${KIOSK_USER}")"
cat > /etc/systemd/system/marco-prime.service <<EOF
[Unit]
Description=Marco Prime Docker application
Requires=docker.service
After=docker.service network-online.target marco-wifi.service
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=oneshot
User=${KIOSK_USER}
Group=${KIOSK_GROUP}
SupplementaryGroups=docker
WorkingDirectory=${SCRIPT_DIR}
ExecStart="${SCRIPT_DIR}/marco" start
RemainAfterExit=yes
TimeoutStartSec=0
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl disable marco-prime.service >/dev/null 2>&1 || true

echo "Installation du lanceur Marco sur le Bureau…"
chmod 0755 \
  "${SCRIPT_DIR}/lancer-marco.sh" \
  "${SCRIPT_DIR}/raspberry-pi/kiosk-control.py"
ln -sfn "${SCRIPT_DIR}/lancer-marco.sh" /usr/local/bin/lancer-marco-prime

KIOSK_HOME="$(getent passwd "${KIOSK_USER}" | cut -d: -f6)"
KIOSK_GROUP="$(id -gn "${KIOSK_USER}")"
DESKTOP_DIR="${KIOSK_HOME}/Desktop"
install -d -m 0755 -o "${KIOSK_USER}" -g "${KIOSK_GROUP}" "${DESKTOP_DIR}"
cat > "${DESKTOP_DIR}/Lancer Marco Prime.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Lancer Marco Prime
Comment=Mettre à jour, démarrer et ouvrir Marco en plein écran
Exec=/usr/local/bin/lancer-marco-prime
Path=${SCRIPT_DIR}
Icon=chromium
Terminal=true
Categories=Utility;
EOF
chown "${KIOSK_USER}:${KIOSK_GROUP}" "${DESKTOP_DIR}/Lancer Marco Prime.desktop"
chmod 0755 "${DESKTOP_DIR}/Lancer Marco Prime.desktop"

echo
echo "Dépendances installées. Marco ne démarrera que lorsque tu cliqueras sur son icône."
echo "Redémarre la Raspberry pour activer l'accès Docker de ${KIOSK_USER}."
echo "Après le redémarrage, double-clique sur 'Lancer Marco Prime' sur le Bureau."
echo "Le lanceur tente la mise à jour Git, reconstruit Docker puis ouvre Home en plein écran."

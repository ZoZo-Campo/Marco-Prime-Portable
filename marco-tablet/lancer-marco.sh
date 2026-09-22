#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.orange-pi"
CONTROL_HELPER="${SCRIPT_DIR}/raspberry-pi/kiosk-control.py"
RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp}/marco-prime-${UID}"
BROWSER_PID_FILE="${RUNTIME_DIR}/chromium.pid"
CONTROL_LOG="${RUNTIME_DIR}/kiosk-control.log"
KIOSK_CONTROL_PID=""
LAUNCH_LOCK_FILE="${RUNTIME_DIR}/launcher.lock"

log() {
  printf '[Marco] %s\n' "$*"
}

cleanup() {
  if [[ -n "${KIOSK_CONTROL_PID:-}" ]]; then
    kill "${KIOSK_CONTROL_PID}" >/dev/null 2>&1 || true
    wait "${KIOSK_CONTROL_PID}" 2>/dev/null || true
  fi
  rm -f "${BROWSER_PID_FILE}"
}

mkdir -p "${RUNTIME_DIR}"
exec 9>"${LAUNCH_LOCK_FILE}"
if ! flock -n 9; then
  log "Marco est déjà en cours de lancement ou déjà ouvert."
  exit 0
fi
trap cleanup EXIT INT TERM

if [[ ! -f "${ENV_FILE}" ]]; then
  log "Configuration absente : ${ENV_FILE}"
  log "Crée-la d'abord à partir de .env.orange-pi.example."
  exit 1
fi

HOST_PORT="$(sed -n 's/^MARCO_HOST_PORT=\([0-9][0-9]*\)$/\1/p' "${ENV_FILE}" | tail -n 1)"
if [[ -z "${HOST_PORT}" ]]; then
  log "MARCO_HOST_PORT est absent ou invalide dans .env.orange-pi."
  exit 1
fi

KIOSK_SCALE="$(sed -n 's/^MARCO_KIOSK_SCALE=\([0-9][0-9]*\([.][0-9][0-9]*\)\{0,1\}\)$/\1/p' "${ENV_FILE}" | tail -n 1)"
# Les installations existantes avaient 1.25 dans leur .env. Ce défaut historique
# rend l'interface minuscule sur le petit écran : la migration ne demande donc
# aucune modification manuelle du fichier contenant les identifiants.
if [[ -z "${KIOSK_SCALE}" || "${KIOSK_SCALE}" == "1.25" ]]; then
  KIOSK_SCALE="1.75"
fi

APP_ORIGIN="http://127.0.0.1:${HOST_PORT}"
APP_URL="${APP_ORIGIN}/"

update_code_if_possible() {
  if ! command -v git >/dev/null 2>&1 || [[ ! -d "${SCRIPT_DIR}/.git" ]]; then
    log "Pas de dépôt Git local : utilisation de la version installée."
    return
  fi

  if ! git -C "${SCRIPT_DIR}" diff --quiet ||
     ! git -C "${SCRIPT_DIR}" diff --cached --quiet; then
    log "Modifications locales détectées : mise à jour Git ignorée pour ne rien écraser."
    return
  fi

  if [[ "$(git -C "${SCRIPT_DIR}" branch --show-current)" != "main" ]]; then
    log "La branche active n'est pas main : mise à jour Git ignorée."
    return
  fi

  local launcher_before launcher_after
  launcher_before="$(git -C "${SCRIPT_DIR}" rev-parse HEAD:lancer-marco.sh 2>/dev/null || true)"
  log "Recherche d'une mise à jour GitHub…"
  if command -v timeout >/dev/null 2>&1; then
    if ! GIT_TERMINAL_PROMPT=0 timeout 30 git -C "${SCRIPT_DIR}" pull --ff-only origin main; then
      log "GitHub inaccessible ou mise à jour impossible : conservation de la version locale."
    fi
  elif ! GIT_TERMINAL_PROMPT=0 git -C "${SCRIPT_DIR}" pull --ff-only origin main; then
    log "GitHub inaccessible ou mise à jour impossible : conservation de la version locale."
  fi

  launcher_after="$(git -C "${SCRIPT_DIR}" rev-parse HEAD:lancer-marco.sh 2>/dev/null || true)"
  if [[ -n "${launcher_before}" && "${launcher_before}" != "${launcher_after}" &&
        "${MARCO_LAUNCHER_REEXEC:-}" != "1" ]]; then
    log "Le lanceur a été mis à jour : application immédiate de la nouvelle version…"
    trap - EXIT INT TERM
    exec 9>&-
    exec env MARCO_LAUNCHER_REEXEC=1 "${SCRIPT_DIR}/lancer-marco.sh"
  fi
}

start_application() {
  log "Construction et démarrage de Docker et de l'API…"
  if "${SCRIPT_DIR}/marco" rebuild; then
    return
  fi

  log "La reconstruction a échoué. Tentative avec la dernière image Docker disponible…"
  "${SCRIPT_DIR}/marco" start
}

wait_for_application() {
  log "Attente de l'API Marco sur ${APP_ORIGIN}…"
  for _attempt in $(seq 1 120); do
    if curl --silent --fail --max-time 2 "${APP_ORIGIN}/health" >/dev/null; then
      if ! curl --silent --fail --max-time 3 "${APP_ORIGIN}/ready" >/dev/null; then
        log "API démarrée, mais la base Fouaille ne répond pas encore."
      fi
      return
    fi
    sleep 1
  done

  log "L'API Marco n'a pas démarré. Consulte les journaux avec : ./marco logs"
  exit 1
}

find_browser() {
  if command -v chromium >/dev/null 2>&1; then
    command -v chromium
  elif command -v chromium-browser >/dev/null 2>&1; then
    command -v chromium-browser
  else
    return 1
  fi
}

launch_kiosk() {
  local browser
  browser="$(find_browser)" || {
    log "Chromium est absent. Relance : sudo ./install-raspberry-pi.sh \"${USER:-$(id -un)}\""
    exit 1
  }
  if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
    log "Aucune session graphique détectée. Lance ce fichier depuis le Bureau de la Raspberry."
    exit 1
  fi

  rm -f "${BROWSER_PID_FILE}"

  log "Ouverture de Marco en plein écran (échelle ${KIOSK_SCALE})…"
  "${browser}" \
    --kiosk \
    --app="${APP_URL}" \
    --no-first-run \
    --no-default-browser-check \
    --noerrdialogs \
    --disable-session-crashed-bubble \
    --disable-features=TranslateUI \
    --overscroll-history-navigation=0 \
    --force-device-scale-factor="${KIOSK_SCALE}" \
    --ozone-platform-hint=auto \
    --user-data-dir="${XDG_CONFIG_HOME:-${HOME}/.config}/marco-prime-chromium" &
  local browser_pid=$!
  printf '%s\n' "${browser_pid}" > "${BROWSER_PID_FILE}"
  chmod 600 "${BROWSER_PID_FILE}"

  if [[ -f "${CONTROL_HELPER}" ]] && command -v python3 >/dev/null 2>&1; then
    python3 "${CONTROL_HELPER}" \
      --pid-file "${BROWSER_PID_FILE}" \
      --origin "${APP_ORIGIN}" \
      >"${CONTROL_LOG}" 2>&1 &
    KIOSK_CONTROL_PID=$!
  else
    log "Contrôle de fermeture indisponible : Alt+F4 reste utilisable."
  fi

  wait "${browser_pid}" || true
}

update_code_if_possible
start_application
wait_for_application
launch_kiosk

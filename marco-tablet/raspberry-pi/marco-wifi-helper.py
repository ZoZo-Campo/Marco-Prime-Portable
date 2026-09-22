#!/usr/bin/env python3
import json
import os
import re
import socketserver
import subprocess
import tempfile

SOCKET_PATH = "/run/marco-wifi/control.sock"
INTERFACE = "wlan0"


def run_nmcli(arguments, timeout=25):
    result = subprocess.run(
        ["nmcli", *arguments],
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "NetworkManager a refusé l’opération")
    return result.stdout


def split_escaped(line):
    values, current, escaped = [], [], False
    for character in line:
        if escaped:
            current.append(character)
            escaped = False
        elif character == "\\":
            escaped = True
        elif character == ":":
            values.append("".join(current))
            current = []
        else:
            current.append(character)
    values.append("".join(current))
    return values


def scan_networks():
    output = run_nmcli([
        "--terse", "--escape", "yes", "--fields",
        "IN-USE,SSID,SIGNAL,SECURITY", "device", "wifi", "list",
        "ifname", INTERFACE, "--rescan", "yes",
    ], timeout=15)
    networks = {}
    for line in output.splitlines():
        fields = split_escaped(line)
        if len(fields) != 4 or not fields[1]:
            continue
        active, ssid, signal, security = fields
        candidate = {
            "ssid": ssid,
            "signal": int(signal or 0),
            "secure": bool(security and security != "--"),
            "active": active == "*",
        }
        previous = networks.get(ssid)
        if previous is None or candidate["signal"] > previous["signal"]:
            networks[ssid] = candidate
    return sorted(networks.values(), key=lambda item: (not item["active"], -item["signal"]))


def wifi_status():
    for network in scan_networks():
        if network["active"]:
            return {"available": True, "connected": True, **network}
    return {"available": True, "connected": False, "ssid": None, "signal": 0}


def connect_wifi(ssid, password):
    if not isinstance(ssid, str) or not ssid or len(ssid.encode("utf-8")) > 32:
        raise ValueError("Nom Wi-Fi invalide")
    if any(ord(character) < 32 for character in ssid):
        raise ValueError("Nom Wi-Fi invalide")
    if not isinstance(password, str):
        raise ValueError("Mot de passe invalide")
    if any(ord(character) < 32 or ord(character) == 127 for character in password):
        raise ValueError("Mot de passe invalide")
    if password and not (8 <= len(password) <= 63 or re.fullmatch(r"[0-9a-fA-F]{64}", password)):
        raise ValueError("Le mot de passe Wi-Fi doit contenir entre 8 et 63 caractères")

    arguments = ["--wait", "25"]
    temporary_path = None
    try:
        if password:
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as secret:
                os.chmod(secret.name, 0o600)
                secret.write(f"802-11-wireless-security.psk:{password}\n")
                temporary_path = secret.name
            arguments.extend(["--passwd-file", temporary_path])
        arguments.extend(["device", "wifi", "connect", ssid, "ifname", INTERFACE])
        run_nmcli(arguments, timeout=30)
    finally:
        if temporary_path:
            try:
                os.unlink(temporary_path)
            except FileNotFoundError:
                pass
    return wifi_status()


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        try:
            request = json.loads(self.rfile.readline(8192))
            action = request.get("action")
            if action == "status":
                result = wifi_status()
            elif action == "scan":
                result = {"networks": scan_networks()}
            elif action == "connect":
                result = connect_wifi(request.get("ssid"), request.get("password", ""))
            else:
                raise ValueError("Action inconnue")
            response = {"ok": True, "result": result}
        except Exception as error:
            response = {"ok": False, "error": str(error)[:300]}
        self.wfile.write((json.dumps(response, ensure_ascii=False) + "\n").encode("utf-8"))


class Server(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True


def main():
    socket_gid = int(os.environ["MARCO_WIFI_SOCKET_GID"])
    socket_directory = os.path.dirname(SOCKET_PATH)
    os.makedirs(socket_directory, mode=0o770, exist_ok=True)
    os.chown(socket_directory, 0, socket_gid)
    os.chmod(socket_directory, 0o770)
    try:
        os.unlink(SOCKET_PATH)
    except FileNotFoundError:
        pass
    with Server(SOCKET_PATH, Handler) as server:
        os.chmod(SOCKET_PATH, 0o660)
        os.chown(SOCKET_PATH, 0, socket_gid)
        server.serve_forever()


if __name__ == "__main__":
    main()

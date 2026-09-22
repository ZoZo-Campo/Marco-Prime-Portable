#!/usr/bin/env python3
"""Loopback-only helper allowing Marco's admin screen to close Chromium."""

import argparse
import json
import os
import signal
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class KioskControlServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, handler, pid_file: Path, allowed_origin: str):
        super().__init__(address, handler)
        self.pid_file = pid_file
        self.allowed_origin = allowed_origin

    def close_browser(self):
        try:
            pid = int(self.pid_file.read_text(encoding="utf-8").strip())
            if pid <= 1:
                raise ValueError("PID Chromium invalide")
            command_line = Path(f"/proc/{pid}/cmdline").read_bytes().lower()
            if b"chromium" not in command_line:
                raise ValueError("Le processus ciblé n'est pas Chromium")
            os.kill(pid, signal.SIGTERM)
        finally:
            self.shutdown()


class Handler(BaseHTTPRequestHandler):
    server: KioskControlServer

    def allowed(self):
        return self.headers.get("Origin") == self.server.allowed_origin

    def send_json_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        if self.allowed():
            self.send_header("Access-Control-Allow-Origin", self.server.allowed_origin)
            self.send_header("Vary", "Origin")
        self.end_headers()

    def payload(self, value, status=200):
        self.send_json_headers(status)
        self.wfile.write(json.dumps(value, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        if self.path not in {"/status", "/exit"} or not self.allowed():
            self.send_json_headers(403)
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.server.allowed_origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_GET(self):
        if self.path != "/status" or not self.allowed():
            self.payload({"available": False}, 403)
            return
        self.payload({"available": True})

    def do_POST(self):
        if self.path != "/exit" or not self.allowed():
            self.payload({"success": False}, 403)
            return
        self.payload({"success": True})
        threading.Thread(target=self.server.close_browser, daemon=True).start()

    def log_message(self, _format, *_args):
        return


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pid-file", required=True, type=Path)
    parser.add_argument("--origin", required=True)
    parser.add_argument("--port", type=int, default=3210)
    arguments = parser.parse_args()

    with KioskControlServer(
        ("127.0.0.1", arguments.port),
        Handler,
        arguments.pid_file,
        arguments.origin,
    ) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()

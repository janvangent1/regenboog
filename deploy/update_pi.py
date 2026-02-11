#!/usr/bin/env python3
"""
Regenboog – Raspberry Pi updaten via SSH (git pull + npm install + pm2 restart)

Gebruik:
  python deploy/update_pi.py

Leest SSH- en projectinstellingen uit deploy/setup_config.json (zoals setup_regenboog_pi.py).
Als je die setup ooit hebt gedraaid, hoef je niets in te vullen.

Als er geen config is, kun je host/gebruiker/wachtwoord ook via environment variabelen
meegeven: REGENBOOG_PI_HOST, REGENBOOG_PI_USER, REGENBOOG_PI_PASSWORD, REGENBOOG_PI_REMOTE_DIR
"""

import json
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
CONFIG_FILE = SCRIPT_DIR / "setup_config.json"

try:
    import paramiko
except ImportError:
    print("Fout: paramiko niet gevonden. Installeer met: pip install paramiko")
    sys.exit(1)


def load_config():
    """Laad instellingen uit setup_config.json (dezelfde als setup_regenboog_pi.py)."""
    try:
        if CONFIG_FILE.is_file():
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except (json.JSONDecodeError, OSError):
        pass
    return {}


def run_ssh_commands(host, port, username, password, key_filename, commands, timeout=120):
    """Voer commando's via SSH uit. Logt naar stdout. Returns (success, error_message)."""
    client = None
    try:
        print(f"Verbinden met {username}@{host}:{port}...")
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        kws = {"hostname": host, "port": port, "username": username, "timeout": 10}
        if key_filename and os.path.isfile(key_filename):
            kws["key_filename"] = key_filename
            print("Gebruik SSH-sleutel:", key_filename)
        if password:
            kws["password"] = password

        client.connect(**kws)
        print("Verbinding geslaagd.\n")

        for i, cmd in enumerate(commands, 1):
            print(f"[{i}/{len(commands)}] $ {cmd}")
            stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
            out = stdout.read().decode("utf-8", errors="replace").strip()
            err = stderr.read().decode("utf-8", errors="replace").strip()
            if out:
                print(out)
            if err:
                print("stderr:", err, file=sys.stderr)
            exit_status = stdout.channel.recv_exit_status()
            if exit_status != 0:
                return False, f"Commando mislukt (exit {exit_status}): {cmd}\n{err or out}"

        print("\nAlles succesvol afgerond.")
        return True, None

    except paramiko.AuthenticationException:
        return False, f"Authenticatie mislukt voor {username}@{host}. Controleer wachtwoord of SSH-sleutel."
    except Exception as e:
        return False, f"Fout: {type(e).__name__}: {e}"
    finally:
        if client:
            client.close()
            print("SSH-verbinding gesloten.")


def main():
    cfg = load_config()

    # SSH-parameters (config of environment)
    host = os.environ.get("REGENBOOG_PI_HOST") or cfg.get("host") or "raspberrypi.local"
    try:
        port = int(os.environ.get("REGENBOOG_PI_PORT") or cfg.get("ssh_port") or "22")
    except ValueError:
        port = 22
    username = os.environ.get("REGENBOOG_PI_USER") or cfg.get("username") or "pi"
    password = os.environ.get("REGENBOOG_PI_PASSWORD") or cfg.get("password") or ""
    key_path = cfg.get("key_path") or ""
    key_filename = key_path.strip() or None
    if key_filename and not os.path.isfile(key_filename):
        key_filename = None

    remote_dir = (
        os.environ.get("REGENBOOG_PI_REMOTE_DIR")
        or cfg.get("remote_dir")
        or "/home/pi/regenboog-game"
    )
    remote_dir = remote_dir.rstrip("/")

    if not password and not (key_filename and os.path.isfile(key_filename)):
        print("Fout: Geen wachtwoord of geldige SSH-sleutel.")
        print("  - Vul in setup_regenboog_pi.py eenmalig je Pi-gegevens in en sla op, of")
        print("  - Zet REGENBOOG_PI_PASSWORD=... (of gebruik een SSH-sleutel in setup_config.json)")
        sys.exit(1)

    # Commando's: cd naar project, git pull, npm install, pm2 restart
    commands = [
        f"cd {remote_dir} && git pull",
        f"cd {remote_dir} && npm install",
        "pm2 restart regenboog",
    ]

    print("=" * 60)
    print("Regenboog – Pi bijwerken (git pull + npm install + pm2 restart)")
    print("=" * 60)
    print(f"Host: {host}:{port}  |  Gebruiker: {username}  |  Map: {remote_dir}")
    print("=" * 60)

    success, err = run_ssh_commands(
        host, port, username, password, key_filename, commands, timeout=300
    )

    if not success:
        print("\n❌ Update mislukt:", err, file=sys.stderr)
        sys.exit(1)
    print("\n✅ Pi is bijgewerkt. App is herstart met pm2.")


if __name__ == "__main__":
    main()

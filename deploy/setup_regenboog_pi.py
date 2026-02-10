#!/usr/bin/env python3
"""
Regenboog – Volledige Setup Script voor Raspberry Pi
Installeert Node.js, nginx, SSL certificaat, en configureert alles voor regenboog.jbouquet.be
Gebruik: python setup_regenboog_pi.py
"""

import json
import os
import sys
import threading
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
CONFIG_FILE = SCRIPT_DIR / "setup_config.json"

try:
    import paramiko
except ImportError:
    print("=" * 60)
    print("Fout: paramiko niet gevonden!")
    print("=" * 60)
    print("\nInstalleer paramiko met:")
    print("   pip install paramiko")
    print("\n" + "=" * 60)
    sys.exit(1)


def log(area, msg, also_print=True):
    """Log message to text area and optionally print."""
    if area:
        area.insert(tk.END, msg + "\n")
        area.see(tk.END)
    if also_print:
        print(msg)


def run_ssh(host, port, username, password, key_filename, commands, log_area, timeout=300):
    """Run commands over SSH. Returns (success, output_lines, error_message)."""
    client = None
    try:
        log(log_area, f"Verbinden met {username}@{host}:{port}...")
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        kws = {"hostname": host, "port": port, "username": username, "timeout": 10}
        if key_filename and os.path.isfile(key_filename):
            kws["key_filename"] = key_filename
            log(log_area, f"Gebruik SSH-sleutel: {key_filename}")
        if password:
            kws["password"] = password
        
        client.connect(**kws)
        log(log_area, "✓ Verbinding geslaagd!")
        
        output_lines = []
        for i, cmd in enumerate(commands, 1):
            log(log_area, f"\n[{i}/{len(commands)}] $ {cmd}")
            try:
                stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
                out = stdout.read().decode("utf-8", errors="replace").strip()
                err = stderr.read().decode("utf-8", errors="replace").strip()
                if out:
                    log(log_area, out)
                    output_lines.append(out)
                if err:
                    log(log_area, f"⚠ stderr: {err}")
                exit_status = stdout.channel.recv_exit_status()
                if exit_status != 0:
                    error_detail = err or f"Command failed with exit code {exit_status}"
                    log(log_area, f"✗ Fout: {error_detail}")
                    return False, output_lines, f"Commando mislukt: {cmd}\nFout: {error_detail}"
            except Exception as cmd_err:
                error_msg = f"Fout bij uitvoeren commando: {cmd}\n{str(cmd_err)}"
                log(log_area, f"✗ {error_msg}")
                return False, output_lines, error_msg
        
        log(log_area, "\n✓ Alle commando's succesvol uitgevoerd!")
        return True, output_lines, None
    except paramiko.AuthenticationException:
        error_msg = f"Authenticatie mislukt voor {username}@{host}. Controleer gebruikersnaam en wachtwoord."
        log(log_area, f"✗ {error_msg}")
        return False, [], error_msg
    except paramiko.SSHException as e:
        error_msg = f"SSH fout: {str(e)}\nControleer of SSH service draait op de Raspberry Pi."
        log(log_area, f"✗ {error_msg}")
        return False, [], error_msg
    except paramiko.socket.timeout:
        error_msg = f"Timeout bij verbinden met {host}:{port}. Controleer of de Raspberry Pi bereikbaar is."
        log(log_area, f"✗ {error_msg}")
        return False, [], error_msg
    except Exception as e:
        error_type = type(e).__name__
        error_msg = f"Onverwachte fout ({error_type}): {str(e)}\nControleer je netwerkverbinding en SSH instellingen."
        log(log_area, f"✗ {error_msg}")
        return False, [], error_msg
    finally:
        if client:
            client.close()
            log(log_area, "SSH verbinding gesloten.")


def deploy_files_sftp(host, port, username, password, key_filename, remote_dir, log_area):
    """Upload project files (excluding node_modules, .git, data) via SFTP."""
    client = None
    try:
        log(log_area, f"SFTP verbinding opzetten naar {username}@{host}:{port}...")
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        kws = {"hostname": host, "port": port, "username": username, "timeout": 10}
        if key_filename and os.path.isfile(key_filename):
            kws["key_filename"] = key_filename
        if password:
            kws["password"] = password
        client.connect(**kws)
        log(log_area, "✓ SFTP verbinding geslaagd!")
        sftp = client.open_sftp()

        def put_dir(local: Path, remote: str):
            try:
                sftp.stat(remote)
            except FileNotFoundError:
                sftp.mkdir(remote)
            for p in local.iterdir():
                if p.name in ("node_modules", ".git", "__pycache__", "data", "deploy", ".venv", "venv", ".gitignore"):
                    continue
                r = f"{remote}/{p.name}"
                if p.is_dir():
                    put_dir(p, r)
                else:
                    log(log_area, f"  Upload: {p.relative_to(PROJECT_ROOT)}")
                    sftp.put(str(p), r)

        log(log_area, "Maken remote map...")
        parts = remote_dir.strip("/").split("/")
        for i in range(1, len(parts) + 1):
            d = "/" + "/".join(parts[:i])
            try:
                sftp.stat(d)
            except FileNotFoundError:
                sftp.mkdir(d)
        
        # Upload directories
        for name in ("server", "public", "scripts"):
            path = PROJECT_ROOT / name
            if path.is_dir():
                put_dir(path, f"{remote_dir}/{name}")
        
        # Upload root files
        for name in ("package.json", "package-lock.json", "README.md"):
            path = PROJECT_ROOT / name
            if path.is_file():
                log(log_area, f"  Upload: {name}")
                sftp.put(str(path), f"{remote_dir}/{name}")
        
        sftp.close()
        log(log_area, "✓ Alle bestanden succesvol geüpload!")
        return True, None
    except paramiko.AuthenticationException:
        error_msg = f"SFTP authenticatie mislukt voor {username}@{host}. Controleer gebruikersnaam en wachtwoord."
        log(log_area, f"✗ {error_msg}")
        return False, error_msg
    except paramiko.SSHException as e:
        error_msg = f"SFTP fout: {str(e)}"
        log(log_area, f"✗ {error_msg}")
        return False, error_msg
    except Exception as e:
        error_type = type(e).__name__
        error_msg = f"Fout bij uploaden bestanden ({error_type}): {str(e)}"
        log(log_area, f"✗ {error_msg}")
        return False, error_msg
    finally:
        if client:
            client.close()


def load_config():
    """Load last-used settings from config file."""
    try:
        if CONFIG_FILE.is_file():
            with open(CONFIG_FILE, "r", encoding="utf-8") as fp:
                return json.load(fp)
    except (json.JSONDecodeError, OSError):
        pass
    return {}


def save_config(data):
    """Save current GUI settings to config file."""
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as fp:
            json.dump(data, fp, indent=2)
        # Print voor debugging (optioneel)
        # print(f"Config opgeslagen naar: {CONFIG_FILE}")
    except OSError as e:
        print(f"Waarschuwing: Kon config niet opslaan: {e}")


class SetupApp:
    def __init__(self):
        self.win = tk.Tk()
        self.win.title("Regenboog – Volledige Setup Raspberry Pi")
        self.win.geometry("750x700")
        self.win.minsize(600, 550)

        f = ttk.Frame(self.win, padding=10)
        f.pack(fill=tk.BOTH, expand=True)

        cfg = load_config()

        # --- SSH-instellingen ---
        ssh_frame = ttk.LabelFrame(f, text="SSH-instellingen", padding=8)
        ssh_frame.grid(row=0, column=0, columnspan=2, sticky=tk.EW, pady=(0, 8))
        ssh_frame.columnconfigure(1, weight=1)

        ttk.Label(ssh_frame, text="Host / IP-adres:").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.host = ttk.Entry(ssh_frame, width=32)
        self.host.insert(0, cfg.get("host", "raspberrypi.local"))
        self.host.grid(row=0, column=1, sticky=tk.EW, pady=2, padx=(8, 0))
        self.host.bind("<KeyRelease>", lambda e: self._auto_save_config())

        ttk.Label(ssh_frame, text="SSH-poort:").grid(row=1, column=0, sticky=tk.W, pady=2)
        self.ssh_port = ttk.Entry(ssh_frame, width=8)
        self.ssh_port.insert(0, cfg.get("ssh_port", "22"))
        self.ssh_port.grid(row=1, column=1, sticky=tk.W, pady=2, padx=(8, 0))
        self.ssh_port.bind("<KeyRelease>", lambda e: self._auto_save_config())

        ttk.Label(ssh_frame, text="Gebruiker:").grid(row=2, column=0, sticky=tk.W, pady=2)
        self.username = ttk.Entry(ssh_frame, width=24)
        self.username.insert(0, cfg.get("username", "pi"))
        self.username.grid(row=2, column=1, sticky=tk.W, pady=2, padx=(8, 0))
        self.username.bind("<KeyRelease>", lambda e: self._auto_save_config())

        ttk.Label(ssh_frame, text="Wachtwoord:").grid(row=3, column=0, sticky=tk.W, pady=2)
        self.password = ttk.Entry(ssh_frame, width=24, show="*")
        # Laad wachtwoord uit config als het bestaat
        if cfg.get("password"):
            self.password.insert(0, cfg.get("password", ""))
        self.password.grid(row=3, column=1, sticky=tk.W, pady=2, padx=(8, 0))
        # Auto-save bij wijziging
        self.password.bind("<KeyRelease>", lambda e: self._auto_save_config())

        ttk.Label(ssh_frame, text="SSH-sleutel (optioneel):").grid(row=4, column=0, sticky=tk.W, pady=2)
        key_f = ttk.Frame(ssh_frame)
        key_f.grid(row=4, column=1, sticky=tk.EW, pady=2, padx=(8, 0))
        self.key_path = ttk.Entry(key_f, width=28)
        if cfg.get("key_path"):
            self.key_path.insert(0, cfg.get("key_path", ""))
        self.key_path.pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(key_f, text="...", width=3, command=self._browse_key).pack(side=tk.LEFT, padx=(4, 0))

        # --- App-instellingen ---
        app_frame = ttk.LabelFrame(f, text="App-instellingen", padding=8)
        app_frame.grid(row=1, column=0, columnspan=2, sticky=tk.EW, pady=(0, 8))
        app_frame.columnconfigure(1, weight=1)

        ttk.Label(app_frame, text="App-poort (bijv. 3001):").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.app_port = ttk.Entry(app_frame, width=8)
        self.app_port.insert(0, cfg.get("app_port", "3001"))
        self.app_port.grid(row=0, column=1, sticky=tk.W, pady=2, padx=(8, 0))
        self.app_port.bind("<KeyRelease>", lambda e: self._auto_save_config())

        ttk.Label(app_frame, text="Remote map op Pi:").grid(row=1, column=0, sticky=tk.W, pady=2)
        self.remote_dir = ttk.Entry(app_frame, width=36)
        self.remote_dir.insert(0, cfg.get("remote_dir", "/home/pi/regenboog-game"))
        self.remote_dir.grid(row=1, column=1, sticky=tk.EW, pady=2, padx=(8, 0))
        self.remote_dir.bind("<KeyRelease>", lambda e: self._auto_save_config())

        # --- Domain-instellingen ---
        domain_frame = ttk.LabelFrame(f, text="Domain-instellingen", padding=8)
        domain_frame.grid(row=2, column=0, columnspan=2, sticky=tk.EW, pady=(0, 8))
        domain_frame.columnconfigure(1, weight=1)

        ttk.Label(domain_frame, text="Subdomein:").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.domain = ttk.Entry(domain_frame, width=32)
        self.domain.insert(0, cfg.get("domain", "regenboog.jbouquet.be"))
        self.domain.grid(row=0, column=1, sticky=tk.EW, pady=2, padx=(8, 0))
        self.domain.bind("<KeyRelease>", lambda e: self._auto_save_config())

        ttk.Label(domain_frame, text="Email voor Let's Encrypt:").grid(row=1, column=0, sticky=tk.W, pady=2)
        self.email = ttk.Entry(domain_frame, width=32)
        self.email.insert(0, cfg.get("email", ""))
        self.email.grid(row=1, column=1, sticky=tk.EW, pady=2, padx=(8, 0))
        self.email.bind("<KeyRelease>", lambda e: self._auto_save_config())
        ttk.Label(domain_frame, text="(vereist voor SSL certificaat)", font=("", 8), foreground="gray").grid(row=2, column=1, sticky=tk.W, padx=(8, 0))

        f.columnconfigure(1, weight=1)

        # --- Buttons ---
        btn_f = ttk.Frame(f)
        btn_f.grid(row=3, column=0, columnspan=2, sticky=tk.EW, pady=12)
        ttk.Button(btn_f, text="Volledige Setup Uitvoeren", command=self._on_full_setup).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(btn_f, text="Alleen Nginx Configureren", command=self._on_nginx_only).pack(side=tk.LEFT)

        # Info label over config opslaan
        info_label = ttk.Label(f, text="💾 Configuratie wordt automatisch opgeslagen bij wijzigingen", 
                              font=("", 8), foreground="gray")
        info_label.grid(row=4, column=0, columnspan=2, sticky=tk.W, pady=(0, 4))
        
        ttk.Label(f, text="Log", font=("", 11, "bold")).grid(row=5, column=0, columnspan=2, sticky=tk.W, pady=(8, 4))
        self.log = scrolledtext.ScrolledText(f, height=18, wrap=tk.WORD, font=("Consolas", 9))
        self.log.grid(row=6, column=0, columnspan=2, sticky=tk.NSEW, pady=(0, 0))
        f.rowconfigure(6, weight=1)
        f.columnconfigure(1, weight=1)

    def _browse_key(self):
        path = filedialog.askopenfilename(title="SSH private key")
        if path:
            self.key_path.delete(0, tk.END)
            self.key_path.insert(0, path)
            self._auto_save_config()

    def _save_config(self):
        """Save current GUI settings."""
        save_config({
            "host": self.host.get().strip() or "raspberrypi.local",
            "ssh_port": self.ssh_port.get().strip() or "22",
            "username": self.username.get().strip() or "pi",
            "password": self.password.get().strip() or "",  # Opslaan van wachtwoord
            "app_port": self.app_port.get().strip() or "3001",
            "remote_dir": self.remote_dir.get().strip() or "/home/pi/regenboog-game",
            "key_path": self.key_path.get().strip() or "",
            "domain": self.domain.get().strip() or "regenboog.jbouquet.be",
            "email": self.email.get().strip() or "",
        })
    
    def _auto_save_config(self):
        """Auto-save config after a short delay (debounce)."""
        # Cancel previous timer if exists
        if hasattr(self, '_save_timer'):
            self.win.after_cancel(self._save_timer)
        # Schedule save after 500ms
        self._save_timer = self.win.after(500, self._save_config)

    def _get_ssh_params(self):
        try:
            port = int(self.ssh_port.get().strip() or "22")
        except ValueError:
            port = 22
        return {
            "host": self.host.get().strip() or "raspberrypi.local",
            "port": port,
            "username": self.username.get().strip() or "pi",
            "password": self.password.get().strip() or None,
            "key_filename": self.key_path.get().strip() or None,
        }

    def _on_full_setup(self):
        """Volledige setup: Node.js, nginx, SSL, deploy, PM2."""
        p = self._get_ssh_params()
        try:
            app_port = int(self.app_port.get().strip() or "3001")
        except ValueError:
            app_port = 3001
        remote = (self.remote_dir.get().strip() or "/home/pi/regenboog-game").rstrip("/")
        domain = self.domain.get().strip() or "regenboog.jbouquet.be"
        email = self.email.get().strip()
        
        # Validatie
        if not p["host"] or not p["host"].strip():
            messagebox.showerror("Validatie Fout", 
                "Vul het IP-adres of hostnaam van de Raspberry Pi in.\n\n"
                "Bijvoorbeeld: 192.168.1.10 of raspberrypi.local")
            return
        
        if not p["username"] or not p["username"].strip():
            messagebox.showerror("Validatie Fout", 
                "Vul de SSH gebruikersnaam in.\n\n"
                "Meestal is dit 'pi' op Raspberry Pi OS.")
            return
        
        if not p["password"] and not (p["key_filename"] and os.path.isfile(p["key_filename"])):
            messagebox.showerror("Validatie Fout", 
                "Vul een wachtwoord in OF kies een SSH-sleutel bestand.\n\n"
                "Je hebt minimaal één van deze nodig voor SSH authenticatie.")
            return
        
        if not email or not email.strip() or "@" not in email:
            messagebox.showerror("Validatie Fout", 
                "Vul een geldig email adres in voor Let's Encrypt.\n\n"
                "Dit is vereist voor het SSL certificaat.\n"
                "Bijvoorbeeld: jouw@email.com")
            return
        
        # Opslaan configuratie voordat we beginnen
        self._save_config()
        
        self.log.delete(1.0, tk.END)
        log(self.log, "=" * 60)
        log(self.log, "VOLLEDIGE SETUP STARTEN")
        log(self.log, "=" * 60)

        def run():
            success = True
            error_msg = None
            
            # Stap 1: Node.js installeren
            log(self.log, "\n" + "="*60)
            log(self.log, "[1/6] Node.js installeren...")
            log(self.log, "="*60)
            ok, _, err = self._install_nodejs(p)
            if not ok:
                success = False
                error_msg = f"❌ Node.js installatie mislukt\n\n{err}\n\n" \
                           f"Mogelijke oorzaken:\n" \
                           f"- Geen internetverbinding op de Raspberry Pi\n" \
                           f"- Geen sudo rechten voor gebruiker '{p['username']}'\n" \
                           f"- Package manager (apt) is niet beschikbaar"
                self._show_result(success, error_msg)
                return
            log(self.log, "✓ Node.js installatie voltooid!")
            
            # Stap 2: Nginx installeren
            log(self.log, "\n" + "="*60)
            log(self.log, "[2/6] Nginx installeren...")
            log(self.log, "="*60)
            ok, _, err = self._install_nginx(p)
            if not ok:
                success = False
                error_msg = f"❌ Nginx installatie mislukt\n\n{err}\n\n" \
                           f"Mogelijke oorzaken:\n" \
                           f"- Geen internetverbinding op de Raspberry Pi\n" \
                           f"- Geen sudo rechten voor gebruiker '{p['username']}'\n" \
                           f"- Port 80 is al in gebruik door een andere service"
                self._show_result(success, error_msg)
                return
            log(self.log, "✓ Nginx installatie voltooid!")
            
            # Stap 3: PM2 installeren
            log(self.log, "\n" + "="*60)
            log(self.log, "[3/6] PM2 installeren...")
            log(self.log, "="*60)
            ok, _, err = self._install_pm2(p)
            if not ok:
                success = False
                error_msg = f"❌ PM2 installatie mislukt\n\n{err}\n\n" \
                           f"Mogelijke oorzaken:\n" \
                           f"- Node.js is niet correct geïnstalleerd\n" \
                           f"- Geen sudo rechten voor npm install -g\n" \
                           f"- npm is niet beschikbaar"
                self._show_result(success, error_msg)
                return
            log(self.log, "✓ PM2 installatie voltooid!")
            
            # Stap 4: Bestanden deployen
            log(self.log, "\n" + "="*60)
            log(self.log, "[4/6] Bestanden deployen naar Raspberry Pi...")
            log(self.log, "="*60)
            ok, err = deploy_files_sftp(p["host"], p["port"], p["username"], p["password"], p["key_filename"], remote, self.log)
            if not ok:
                success = False
                error_msg = f"❌ Bestanden deployen mislukt\n\n{err}\n\n" \
                           f"Mogelijke oorzaken:\n" \
                           f"- SFTP toegang geweigerd\n" \
                           f"- Onvoldoende schijfruimte op de Raspberry Pi\n" \
                           f"- Geen schrijfrechten in map '{remote}'"
                self._show_result(success, error_msg)
                return
            log(self.log, "✓ Bestanden succesvol geüpload!")
            
            # Stap 5: SSL certificaat (Let's Encrypt)
            log(self.log, "\n" + "="*60)
            log(self.log, "[5/6] SSL certificaat installeren...")
            log(self.log, "="*60)
            ok, _, err = self._setup_ssl(p, domain, email)
            if not ok:
                log(self.log, f"\n⚠ WAARSCHUWING: SSL setup mislukt: {err}")
                log(self.log, "\nDit kan gebeuren als:")
                log(self.log, "- DNS nog niet actief is (wacht enkele minuten)")
                log(self.log, "- Domain nog niet naar dit IP-adres wijst")
                log(self.log, "- Port 80 niet bereikbaar is van buitenaf")
                log(self.log, f"\nJe kunt later handmatig SSL installeren met:")
                log(self.log, f"  ssh {p['username']}@{p['host']}")
                log(self.log, f"  sudo certbot --nginx -d {domain}")
            else:
                log(self.log, "✓ SSL certificaat succesvol geïnstalleerd!")
            
            # Stap 6: Nginx configureren en app starten
            log(self.log, "\n" + "="*60)
            log(self.log, "[6/6] Nginx configureren en app starten...")
            log(self.log, "="*60)
            ok, _, err = self._setup_nginx_and_start(p, domain, app_port, remote)
            if not ok:
                success = False
                error_msg = f"❌ Nginx/app setup mislukt\n\n{err}\n\n" \
                           f"Mogelijke oorzaken:\n" \
                           f"- Nginx configuratie bevat fouten\n" \
                           f"- Port {app_port} is al in gebruik\n" \
                           f"- npm install mislukt (check dependencies)\n" \
                           f"- Geen sudo rechten voor nginx configuratie"
            
            self._show_result(success, error_msg, domain, app_port)

        threading.Thread(target=run, daemon=True).start()

    def _on_nginx_only(self):
        """Alleen nginx configureren (als app al draait)."""
        p = self._get_ssh_params()
        try:
            app_port = int(self.app_port.get().strip() or "3001")
        except ValueError:
            app_port = 3001
        domain = self.domain.get().strip() or "regenboog.jbouquet.be"
        
        if not p["host"]:
            messagebox.showerror("Fout", "Vul host in.")
            return
        
        self.log.delete(1.0, tk.END)
        log(self.log, "Nginx configureren...")

        def run():
            ok, _, err = self._setup_nginx_and_start(p, domain, app_port, None)
            self._show_result(ok, err, domain, app_port)

        threading.Thread(target=run, daemon=True).start()

    def _install_nodejs(self, p):
        """Install Node.js if not present."""
        commands = [
            "command -v node >/dev/null 2>&1 && node -v || true",
            """bash -c '
            if ! command -v node >/dev/null 2>&1; then
              echo "Node.js niet gevonden. Installeren..."
              curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
              sudo apt-get install -y nodejs
            else
              echo "Node.js al geïnstalleerd: $(node -v)"
            fi
            '""",
            "node -v && npm -v",
        ]
        return run_ssh(p["host"], p["port"], p["username"], p["password"], p["key_filename"], commands, self.log, timeout=180)

    def _install_nginx(self, p):
        """Install nginx if not present."""
        commands = [
            "command -v nginx >/dev/null 2>&1 && nginx -v || true",
            """bash -c '
            if ! command -v nginx >/dev/null 2>&1; then
              echo "Nginx niet gevonden. Installeren..."
              sudo apt-get update
              sudo apt-get install -y nginx
            else
              echo "Nginx al geïnstalleerd"
            fi
            '""",
            "sudo systemctl enable nginx",
            "sudo systemctl start nginx",
        ]
        return run_ssh(p["host"], p["port"], p["username"], p["password"], p["key_filename"], commands, self.log, timeout=120)

    def _install_pm2(self, p):
        """Install PM2 globally."""
        commands = [
            "command -v pm2 >/dev/null 2>&1 && pm2 -v || true",
            """bash -c '
            if ! command -v pm2 >/dev/null 2>&1; then
              echo "PM2 niet gevonden. Installeren..."
              sudo npm install -g pm2
            else
              echo "PM2 al geïnstalleerd: $(pm2 -v)"
            fi
            '""",
            "pm2 startup systemd -u $USER --hp $HOME || true",
        ]
        return run_ssh(p["host"], p["port"], p["username"], p["password"], p["key_filename"], commands, self.log, timeout=120)

    def _setup_ssl(self, p, domain, email):
        """Setup SSL certificate with Let's Encrypt."""
        commands = [
            "command -v certbot >/dev/null 2>&1 || sudo apt-get install -y certbot python3-certbot-nginx",
            f"sudo certbot --nginx -d {domain} --non-interactive --agree-tos --email {email} --redirect || echo 'Certbot kan certificaat niet automatisch installeren (mogelijk DNS nog niet actief)'",
        ]
        return run_ssh(p["host"], p["port"], p["username"], p["password"], p["key_filename"], commands, self.log, timeout=300)

    def _setup_nginx_and_start(self, p, domain, app_port, remote_dir):
        """Configure nginx and start the app."""
        # Nginx config content
        # Eerst HTTP-only config (voor als SSL nog niet werkt)
        nginx_config_http = f"""server {{
    listen 80;
    server_name {domain};

    # Logging
    access_log /var/log/nginx/regenboog_access.log;
    error_log /var/log/nginx/regenboog_error.log;

    # Proxy naar Node.js app
    location / {{
        proxy_pass http://localhost:{app_port};
        proxy_http_version 1.1;
        
        # Headers voor correcte proxy werking
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }}
}}
"""
        
        # HTTPS config (wordt later toegevoegd door certbot)
        # Certbot zal automatisch de HTTP config aanpassen en HTTPS toevoegen
        
        # Upload nginx config via SFTP naar temp file, dan verplaatsen met sudo
        config_file = f"/etc/nginx/sites-available/{domain}"
        temp_config = f"/tmp/regenboog_nginx_{domain.replace('.', '_')}.conf"
        
        # Upload config naar temp file
        client = None
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            kws = {"hostname": p["host"], "port": p["port"], "username": p["username"], "timeout": 10}
            if p["key_filename"] and os.path.isfile(p["key_filename"]):
                kws["key_filename"] = p["key_filename"]
            if p["password"]:
                kws["password"] = p["password"]
            client.connect(**kws)
            sftp = client.open_sftp()
            
            # Schrijf config naar temp file
            with sftp.file(temp_config, 'w') as f:
                f.write(nginx_config_http)
            sftp.close()
            client.close()
            client = None
        except Exception as e:
            if client:
                client.close()
            return False, [], f"Config upload mislukt: {str(e)}"
        
        # Commands om nginx te configureren
        commands = [
            # Backup bestaande config als die bestaat
            f"sudo cp {config_file} {config_file}.backup 2>/dev/null || true",
            # Verplaats temp file naar definitieve locatie
            f"sudo mv {temp_config} {config_file}",
            f"sudo chown root:root {config_file}",
            f"sudo chmod 644 {config_file}",
            # Maak symlink naar sites-enabled
            f"sudo ln -sf {config_file} /etc/nginx/sites-enabled/{domain}",
            # Verwijder default site als die bestaat (om conflicten te voorkomen)
            "sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true",
            # Test nginx config
            "sudo nginx -t",
            # Herlaad nginx
            "sudo systemctl reload nginx",
        ]
        
        # Als remote_dir gegeven is, start ook de app
        if remote_dir:
            commands.extend([
                # Stop bestaande app
                f"pm2 stop regenboog 2>/dev/null || true",
                f"pm2 delete regenboog 2>/dev/null || true",
                # npm install
                f"cd {remote_dir} && npm install",
                # Start app met PM2
                f"cd {remote_dir} && PORT={app_port} pm2 start server/server.js --name regenboog",
                # Save PM2 config voor auto-start
                "pm2 save",
            ])
        
        return run_ssh(p["host"], p["port"], p["username"], p["password"], p["key_filename"], commands, self.log, timeout=300)

    def _show_result(self, success, error_msg, domain=None, app_port=None):
        """Show result message."""
        def done():
            self._save_config()
            if success:
                msg = "✅ Setup voltooid!\n\n"
                if domain:
                    msg += f"Je applicatie is beschikbaar op:\n🔗 https://{domain}\n\n"
                if app_port:
                    msg += f"(Intern draait de app op poort {app_port})\n\n"
                msg += "De configuratie is opgeslagen in:\n"
                msg += str(CONFIG_FILE)
                messagebox.showinfo("Setup Voltooid", msg)
            else:
                # Toon uitgebreide error message in een scrollbaar venster
                error_window = tk.Toplevel(self.win)
                error_window.title("Setup Mislukt")
                error_window.geometry("600x400")
                
                ttk.Label(error_window, text="❌ Setup Mislukt", font=("", 14, "bold")).pack(pady=10)
                
                error_text = scrolledtext.ScrolledText(error_window, wrap=tk.WORD, font=("Consolas", 9), height=15)
                error_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
                error_text.insert("1.0", error_msg)
                error_text.config(state=tk.DISABLED)
                
                ttk.Button(error_window, text="Sluiten", command=error_window.destroy).pack(pady=10)
        self.win.after(0, done)

    def _on_close(self):
        self._save_config()
        self.win.destroy()

    def run(self):
        self.win.protocol("WM_DELETE_WINDOW", self._on_close)
        self.win.mainloop()


if __name__ == "__main__":
    os.chdir(PROJECT_ROOT)
    app = SetupApp()
    app.run()

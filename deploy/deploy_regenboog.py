#!/usr/bin/env python3
"""
Regenboog – Deploy naar Raspberry Pi
GUI om bestanden te uploaden naar de Raspberry Pi (alleen file transfer, geen installaties).
Gebruik: python deploy_regenboog.py  (of: python -m deploy.deploy_regenboog vanuit projectroot)
"""

import json
import os
import sys
import threading
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
from pathlib import Path

# Project root (parent of deploy/)
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
CONFIG_FILE = SCRIPT_DIR / "deploy_config.json"

try:
    import paramiko
except ImportError:
    print("=" * 60)
    print("Fout: paramiko niet gevonden!")
    print("=" * 60)
    print("\nInstalleer paramiko met een van deze methoden:\n")
    print("1. Met venv geactiveerd:")
    print("   pip install -r deploy/requirements.txt")
    print("\n2. Of direct:")
    print("   pip install paramiko")
    print("\n3. Als je de venv gebruikt, activeer deze eerst:")
    if sys.platform == "win32":
        print("   venv\\Scripts\\activate")
    else:
        print("   source venv/bin/activate")
    print("   pip install -r deploy/requirements.txt")
    print("\n" + "=" * 60)
    sys.exit(1)


def log(area, msg, also_print=True):
    """Log message to text area and optionally print."""
    if area:
        area.insert(tk.END, msg + "\n")
        area.see(tk.END)
    if also_print:
        print(msg)


def deploy_files_sftp(host, port, username, password, key_filename, remote_dir, log_area):
    """Upload project files (excluding node_modules, .git, data) via SFTP."""
    client = None
    try:
        log(log_area, f"Verbinden met {username}@{host}:{port}...")
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        kws = {"hostname": host, "port": port, "username": username, "timeout": 10}
        if key_filename and os.path.isfile(key_filename):
            kws["key_filename"] = key_filename
        if password:
            kws["password"] = password
        client.connect(**kws)
        log(log_area, "✓ Verbinding geslaagd!")
        sftp = client.open_sftp()

        def put_dir(local: Path, remote: str):
            try:
                sftp.stat(remote)
            except FileNotFoundError:
                sftp.mkdir(remote)
            for p in local.iterdir():
                if p.name in ("node_modules", ".git", "__pycache__", "data", "deploy", ".venv", "venv"):
                    continue
                r = f"{remote}/{p.name}"
                if p.is_dir():
                    put_dir(p, r)
                else:
                    log(log_area, f"  📤 Upload: {p.relative_to(PROJECT_ROOT)}")
                    sftp.put(str(p), r)

        log(log_area, "Maken remote map...")
        parts = remote_dir.strip("/").split("/")
        for i in range(1, len(parts) + 1):
            d = "/" + "/".join(parts[:i])
            try:
                sftp.stat(d)
            except FileNotFoundError:
                sftp.mkdir(d)
        
        log(log_area, "\nBestanden uploaden...")
        for name in ("server", "public", "scripts"):
            path = PROJECT_ROOT / name
            if path.is_dir():
                put_dir(path, f"{remote_dir}/{name}")
        for name in ("package.json", "package-lock.json", "README.md"):
            path = PROJECT_ROOT / name
            if path.is_file():
                log(log_area, f"  📤 Upload: {name}")
                sftp.put(str(path), f"{remote_dir}/{name}")
        
        sftp.close()
        log(log_area, "\n✓ Alle bestanden succesvol geüpload!")
        return True, None
    except paramiko.AuthenticationException:
        error_msg = f"Authenticatie mislukt voor {username}@{host}. Controleer gebruikersnaam en wachtwoord."
        log(log_area, f"✗ {error_msg}")
        return False, error_msg
    except paramiko.SSHException as e:
        error_msg = f"SSH fout: {str(e)}"
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


def restart_pm2_app(log_area, host, port, username, password, key_filename, app_name="regenboog"):
    """Restart PM2 app after deployment."""
    client = None
    try:
        log(log_area, f"Verbinden met {username}@{host}:{port}...")
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        kws = {"hostname": host, "port": port, "username": username, "timeout": 10}
        if key_filename and os.path.isfile(key_filename):
            kws["key_filename"] = key_filename
        if password:
            kws["password"] = password
        client.connect(**kws)
        log(log_area, "✓ Verbinding geslaagd!")
        
        commands = [
            f"pm2 restart {app_name}",
            f"pm2 status {app_name}",
        ]
        
        for cmd in commands:
            log(log_area, f"$ {cmd}")
            stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
            out = stdout.read().decode("utf-8", errors="replace").strip()
            err = stderr.read().decode("utf-8", errors="replace").strip()
            if out:
                log(log_area, out)
            if err:
                log(log_area, f"⚠ stderr: {err}")
            exit_status = stdout.channel.recv_exit_status()
            if exit_status != 0:
                return False, err or f"Command failed with exit code {exit_status}"
        
        return True, None
    except Exception as e:
        error_msg = f"Fout bij PM2 restart: {str(e)}"
        log(log_area, f"✗ {error_msg}")
        return False, error_msg
    finally:
        if client:
            client.close()


def load_config():
    """Load last-used SSH and app settings from deploy_config.json."""
    try:
        if CONFIG_FILE.is_file():
            with open(CONFIG_FILE, "r", encoding="utf-8") as fp:
                return json.load(fp)
    except (json.JSONDecodeError, OSError):
        pass
    return {}


def save_config(data):
    """Save current GUI settings to deploy_config.json."""
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as fp:
            json.dump(data, fp, indent=2)
    except OSError:
        pass


class DeployApp:
    def __init__(self):
        self.win = tk.Tk()
        self.win.title("Regenboog – Deploy Bestanden")
        self.win.geometry("650x550")
        self.win.minsize(500, 400)

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
        if cfg.get("password"):
            self.password.insert(0, cfg.get("password", ""))
        self.password.grid(row=3, column=1, sticky=tk.W, pady=2, padx=(8, 0))
        self.password.bind("<KeyRelease>", lambda e: self._auto_save_config())

        ttk.Label(ssh_frame, text="SSH-sleutel (optioneel):").grid(row=4, column=0, sticky=tk.W, pady=2)
        key_f = ttk.Frame(ssh_frame)
        key_f.grid(row=4, column=1, sticky=tk.EW, pady=2, padx=(8, 0))
        self.key_path = ttk.Entry(key_f, width=28)
        if cfg.get("key_path"):
            self.key_path.insert(0, cfg.get("key_path", ""))
        self.key_path.pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(key_f, text="...", width=3, command=self._browse_key).pack(side=tk.LEFT, padx=(4, 0))

        # --- Deploy-instellingen ---
        deploy_frame = ttk.LabelFrame(f, text="Deploy-instellingen", padding=8)
        deploy_frame.grid(row=1, column=0, columnspan=2, sticky=tk.EW, pady=(0, 8))
        deploy_frame.columnconfigure(1, weight=1)

        ttk.Label(deploy_frame, text="Remote map op Pi:").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.remote_dir = ttk.Entry(deploy_frame, width=36)
        self.remote_dir.insert(0, cfg.get("remote_dir", "/home/pi/regenboog-game"))
        self.remote_dir.grid(row=0, column=1, sticky=tk.EW, pady=2, padx=(8, 0))
        self.remote_dir.bind("<KeyRelease>", lambda e: self._auto_save_config())

        # PM2 restart optie
        self.restart_pm2 = tk.BooleanVar(value=cfg.get("restart_pm2", True))
        ttk.Checkbutton(deploy_frame, text="Herstart PM2 app na deploy", variable=self.restart_pm2).grid(row=1, column=0, columnspan=2, sticky=tk.W, pady=4)
        
        ttk.Label(deploy_frame, text="PM2 app naam:").grid(row=2, column=0, sticky=tk.W, pady=2)
        self.pm2_app_name = ttk.Entry(deploy_frame, width=20)
        self.pm2_app_name.insert(0, cfg.get("pm2_app_name", "regenboog"))
        self.pm2_app_name.grid(row=2, column=1, sticky=tk.W, pady=2, padx=(8, 0))
        self.pm2_app_name.bind("<KeyRelease>", lambda e: self._auto_save_config())

        f.columnconfigure(1, weight=1)

        # Info label
        info_label = ttk.Label(f, text="💾 Configuratie wordt automatisch opgeslagen", 
                              font=("", 8), foreground="gray")
        info_label.grid(row=2, column=0, columnspan=2, sticky=tk.W, pady=(0, 4))

        # Buttons
        btn_f = ttk.Frame(f)
        btn_f.grid(row=3, column=0, columnspan=2, sticky=tk.EW, pady=12)
        ttk.Button(btn_f, text="📤 Bestanden Uploaden", command=self._on_deploy).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(btn_f, text="🔄 Alleen PM2 Herstarten", command=self._on_restart_only).pack(side=tk.LEFT)

        ttk.Label(f, text="Log", font=("", 11, "bold")).grid(row=4, column=0, columnspan=2, sticky=tk.W, pady=(8, 4))
        self.log = scrolledtext.ScrolledText(f, height=14, wrap=tk.WORD, font=("Consolas", 9))
        self.log.grid(row=5, column=0, columnspan=2, sticky=tk.NSEW, pady=(0, 0))
        f.rowconfigure(5, weight=1)
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
            "password": self.password.get().strip() or "",
            "remote_dir": self.remote_dir.get().strip() or "/home/pi/regenboog-game",
            "key_path": self.key_path.get().strip() or "",
            "restart_pm2": self.restart_pm2.get(),
            "pm2_app_name": self.pm2_app_name.get().strip() or "regenboog",
        })
    
    def _auto_save_config(self):
        """Auto-save config after a short delay (debounce)."""
        if hasattr(self, '_save_timer'):
            self.win.after_cancel(self._save_timer)
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

    def _on_deploy(self):
        """Upload files and optionally restart PM2."""
        p = self._get_ssh_params()
        remote = (self.remote_dir.get().strip() or "/home/pi/regenboog-game").rstrip("/")
        
        if not p["host"]:
            messagebox.showerror("Fout", "Vul host/IP-adres in.")
            return
        if not p["password"] and not (p["key_filename"] and os.path.isfile(p["key_filename"])):
            messagebox.showerror("Fout", "Vul wachtwoord in of kies een SSH-sleutel.")
            return
        
        self.log.delete(1.0, tk.END)
        log(self.log, "=" * 60)
        log(self.log, "BESTANDEN UPLOADEN")
        log(self.log, "=" * 60)

        def run():
            # Upload files
            ok, err = deploy_files_sftp(
                p["host"], p["port"], p["username"], p["password"], p["key_filename"], 
                remote, self.log
            )
            
            if not ok:
                def done():
                    self._save_config()
                    messagebox.showerror("Fout", f"Upload mislukt:\n{err}")
                self.win.after(0, done)
                return
            
            # Optionally restart PM2
            if self.restart_pm2.get():
                log(self.log, "\n" + "=" * 60)
                log(self.log, "PM2 APP HERSTARTEN")
                log(self.log, "=" * 60)
                pm2_name = self.pm2_app_name.get().strip() or "regenboog"
                ok2, err2 = restart_pm2_app(
                    self.log, p["host"], p["port"], p["username"], p["password"], 
                    p["key_filename"], pm2_name
                )
                if not ok2:
                    log(self.log, f"\n⚠ Waarschuwing: PM2 restart mislukt: {err2}")
                    log(self.log, "Je kunt handmatig herstarten met: pm2 restart " + pm2_name)
                else:
                    log(self.log, "\n✓ PM2 app succesvol herstart!")
            
            def done():
                self._save_config()
                msg = "✓ Bestanden succesvol geüpload!"
                if self.restart_pm2.get():
                    msg += "\n✓ PM2 app herstart"
                messagebox.showinfo("Klaar", msg)
            self.win.after(0, done)

        threading.Thread(target=run, daemon=True).start()

    def _on_restart_only(self):
        """Only restart PM2 without uploading files."""
        p = self._get_ssh_params()
        
        if not p["host"]:
            messagebox.showerror("Fout", "Vul host/IP-adres in.")
            return
        if not p["password"] and not (p["key_filename"] and os.path.isfile(p["key_filename"])):
            messagebox.showerror("Fout", "Vul wachtwoord in of kies een SSH-sleutel.")
            return
        
        self.log.delete(1.0, tk.END)
        log(self.log, "PM2 app herstarten...")

        def run():
            pm2_name = self.pm2_app_name.get().strip() or "regenboog"
            ok, err = restart_pm2_app(
                self.log, p["host"], p["port"], p["username"], p["password"], 
                p["key_filename"], pm2_name
            )
            def done():
                self._save_config()
                if ok:
                    messagebox.showinfo("Klaar", f"PM2 app '{pm2_name}' succesvol herstart!")
                else:
                    messagebox.showerror("Fout", f"PM2 restart mislukt:\n{err}")
            self.win.after(0, done)

        threading.Thread(target=run, daemon=True).start()

    def _on_close(self):
        self._save_config()
        self.win.destroy()

    def run(self):
        self.win.protocol("WM_DELETE_WINDOW", self._on_close)
        self.win.mainloop()


if __name__ == "__main__":
    os.chdir(PROJECT_ROOT)
    app = DeployApp()
    app.run()

#!/usr/bin/env python3
"""
Regenboog Spellen – Windows GUI Launcher
Start en stop de Node.js server vanuit een GUI.
"""

import os
import sys
import subprocess
import threading
import webbrowser
import time
from pathlib import Path
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox

# Project root (where this script is)
PROJECT_ROOT = Path(__file__).resolve().parent
SERVER_SCRIPT = PROJECT_ROOT / "server" / "server.js"
DEFAULT_PORT = 3000


class RegenboogLauncher:
    def __init__(self):
        self.process = None
        self.port = DEFAULT_PORT
        self.win = tk.Tk()
        self.win.title("Regenboog Spellen – Server Launcher")
        self.win.geometry("600x500")
        self.win.minsize(500, 400)
        self.win.protocol("WM_DELETE_WINDOW", self._on_close)

        # Check if running in venv (optional, but recommended)
        self._check_venv()

        # Check if Node.js is available
        self.node_available = self._check_node()
        if not self.node_available:
            messagebox.showerror(
                "Node.js niet gevonden",
                "Node.js is niet geïnstalleerd of niet in PATH.\n\n"
                "Download Node.js van: https://nodejs.org/\n"
                "Installeer het en start deze app opnieuw."
            )

        self._build_ui()

    def _check_venv(self):
        """Check if running in a virtual environment (optional warning)."""
        in_venv = (
            hasattr(sys, 'real_prefix') or
            (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)
        )
        if not in_venv:
            venv_path = PROJECT_ROOT / "venv"
            if venv_path.exists():
                # Venv exists but not activated - show info (not error)
                print("INFO: Virtual environment niet geactiveerd.")
                print(f"Gebruik 'start_regenboog.bat' (Windows) of 'start_regenboog.sh' (Linux/Mac)")
                print(f"om automatisch de venv te activeren.")

    def _check_node(self):
        """Check if Node.js is available."""
        try:
            result = subprocess.run(
                ["node", "--version"],
                capture_output=True,
                text=True,
                timeout=2
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def _build_ui(self):
        f = ttk.Frame(self.win, padding=10)
        f.pack(fill=tk.BOTH, expand=True)

        # Header
        header = ttk.Label(
            f,
            text="Regenboog Spellen Server",
            font=("", 14, "bold")
        )
        header.pack(pady=(0, 10))

        # Status
        status_frame = ttk.LabelFrame(f, text="Status", padding=8)
        status_frame.pack(fill=tk.X, pady=(0, 10))

        self.status_label = ttk.Label(
            status_frame,
            text="Server gestopt",
            font=("", 10)
        )
        self.status_label.pack(anchor=tk.W)

        self.port_label = ttk.Label(
            status_frame,
            text=f"Poort: {self.port}",
            font=("", 9),
            foreground="gray"
        )
        self.port_label.pack(anchor=tk.W)

        # Settings
        settings_frame = ttk.LabelFrame(f, text="Instellingen", padding=8)
        settings_frame.pack(fill=tk.X, pady=(0, 10))

        port_row = ttk.Frame(settings_frame)
        port_row.pack(fill=tk.X, pady=2)
        ttk.Label(port_row, text="Poort:").pack(side=tk.LEFT, padx=(0, 8))
        self.port_entry = ttk.Entry(port_row, width=10)
        self.port_entry.insert(0, str(DEFAULT_PORT))
        self.port_entry.pack(side=tk.LEFT, padx=(0, 8))
        ttk.Label(
            port_row,
            text="(standaard: 3000)",
            font=("", 8),
            foreground="gray"
        ).pack(side=tk.LEFT)

        # Buttons
        btn_frame = ttk.Frame(f)
        btn_frame.pack(fill=tk.X, pady=(0, 10))

        self.start_btn = ttk.Button(
            btn_frame,
            text="Server starten",
            command=self._start_server,
            state=tk.NORMAL if self.node_available else tk.DISABLED
        )
        self.start_btn.pack(side=tk.LEFT, padx=(0, 8))

        self.stop_btn = ttk.Button(
            btn_frame,
            text="Server stoppen",
            command=self._stop_server,
            state=tk.DISABLED
        )
        self.stop_btn.pack(side=tk.LEFT, padx=(0, 8))

        self.open_btn = ttk.Button(
            btn_frame,
            text="Open in browser",
            command=self._open_browser,
            state=tk.DISABLED
        )
        self.open_btn.pack(side=tk.LEFT)

        # Log
        log_frame = ttk.LabelFrame(f, text="Log", padding=8)
        log_frame.pack(fill=tk.BOTH, expand=True)

        self.log = scrolledtext.ScrolledText(
            log_frame,
            height=12,
            wrap=tk.WORD,
            font=("Consolas", 9),
            state=tk.DISABLED
        )
        self.log.pack(fill=tk.BOTH, expand=True)

        # Initial log message
        self._log("Klaar. Klik op 'Server starten' om te beginnen.")
        if not self.node_available:
            self._log("WAARSCHUWING: Node.js niet gevonden!", error=True)

    def _log(self, msg, error=False):
        """Add a message to the log."""
        self.log.config(state=tk.NORMAL)
        timestamp = time.strftime("%H:%M:%S")
        prefix = "[ERROR]" if error else "[INFO]"
        self.log.insert(tk.END, f"{timestamp} {prefix} {msg}\n")
        self.log.see(tk.END)
        self.log.config(state=tk.DISABLED)

    def _start_server(self):
        """Start the Node.js server."""
        if self.process:
            self._log("Server draait al!")
            return

        try:
            port = int(self.port_entry.get().strip() or str(DEFAULT_PORT))
            if port < 1 or port > 65535:
                messagebox.showerror("Fout", "Poort moet tussen 1 en 65535 zijn.")
                return
            self.port = port
        except ValueError:
            messagebox.showerror("Fout", "Ongeldige poort. Gebruik een getal.")
            return

        if not SERVER_SCRIPT.is_file():
            messagebox.showerror(
                "Fout",
                f"Server script niet gevonden:\n{SERVER_SCRIPT}\n\n"
                "Zorg dat je deze launcher in de project root draait."
            )
            return

        self._log(f"Server starten op poort {self.port}...")
        self.status_label.config(text="Server starten...")
        self.start_btn.config(state=tk.DISABLED)
        self.port_entry.config(state=tk.DISABLED)

        env = os.environ.copy()
        env["PORT"] = str(self.port)

        try:
            self.process = subprocess.Popen(
                ["node", str(SERVER_SCRIPT)],
                cwd=str(PROJECT_ROOT),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )

            # Start thread to read output
            threading.Thread(
                target=self._read_output,
                daemon=True
            ).start()

            # Wait a moment, then check if process is still running
            threading.Thread(
                target=self._check_started,
                daemon=True
            ).start()

        except Exception as e:
            self._log(f"Fout bij starten: {e}", error=True)
            self.process = None
            self.status_label.config(text="Server gestopt")
            self.start_btn.config(state=tk.NORMAL)
            self.port_entry.config(state=tk.NORMAL)

    def _check_started(self):
        """Check if server started successfully."""
        time.sleep(2)
        if self.process and self.process.poll() is None:
            self.win.after(0, lambda: self.status_label.config(text=f"Server draait op poort {self.port}"))
            self.win.after(0, lambda: self.start_btn.config(state=tk.DISABLED))
            self.win.after(0, lambda: self.stop_btn.config(state=tk.NORMAL))
            self.win.after(0, lambda: self.open_btn.config(state=tk.NORMAL))
            self.win.after(0, lambda: self.port_label.config(text=f"Poort: {self.port}"))
            self._log(f"Server gestart! Open http://localhost:{self.port}")
        elif self.process:
            # Process died
            self.win.after(0, lambda: self._log("Server stopte onverwacht.", error=True))
            self.win.after(0, lambda: self._stop_server())

    def _read_output(self):
        """Read server output and display in log."""
        if not self.process:
            return
        try:
            for line in iter(self.process.stdout.readline, ''):
                if not line:
                    break
                line = line.strip()
                if line:
                    self.win.after(0, lambda l=line: self._log(l))
        except Exception as e:
            self.win.after(0, lambda: self._log(f"Fout bij lezen output: {e}", error=True))

    def _stop_server(self):
        """Stop the Node.js server."""
        if not self.process:
            return

        self._log("Server stoppen...")
        try:
            if sys.platform == "win32":
                # Windows: use taskkill to stop process tree
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(self.process.pid)],
                    capture_output=True
                )
            else:
                self.process.terminate()
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
        except Exception as e:
            self._log(f"Fout bij stoppen: {e}", error=True)

        self.process = None
        self.status_label.config(text="Server gestopt")
        self.start_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.open_btn.config(state=tk.DISABLED)
        self.port_entry.config(state=tk.NORMAL)
        self._log("Server gestopt.")

    def _open_browser(self):
        """Open the app in the default browser."""
        url = f"http://localhost:{self.port}"
        try:
            webbrowser.open(url)
            self._log(f"Browser geopend: {url}")
        except Exception as e:
            self._log(f"Kon browser niet openen: {e}", error=True)

    def _on_close(self):
        """Handle window close - stop server if running."""
        if self.process:
            if messagebox.askyesno(
                "Server draait",
                "De server draait nog. Wil je deze stoppen voordat je de app sluit?"
            ):
                self._stop_server()
                time.sleep(0.5)
        self.win.destroy()

    def run(self):
        """Start the GUI."""
        self.win.mainloop()


if __name__ == "__main__":
    os.chdir(PROJECT_ROOT)
    app = RegenboogLauncher()
    app.run()

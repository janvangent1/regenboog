#!/usr/bin/env python3
"""
Load test voor Regenboog Raspberry Pi server – met GUI.
Stel URL, aantal gelijktijdige gebruikers en timeout in en start de test.
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import urllib.request
import urllib.error
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

# Standaardinstellingen
DEFAULT_URL = "https://regenboog.jbouquet.be"
DEFAULT_CONCURRENT = 10
DEFAULT_TIMEOUT = 15
MIN_CONCURRENT = 1
MAX_CONCURRENT = 500
PATHS = ["/", "/games/zebras.html", "/api/leaderboard/zebras"]


def fetch_one(base_url: str, path: str, timeout_sec: int) -> dict:
    """Eén HTTP GET; retourneert dict met ok, status_code, ms, path, error."""
    url = base_url.rstrip("/") + path
    start = time.perf_counter()
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            body = resp.read()
        ms = int((time.perf_counter() - start) * 1000)
        status = resp.status
        ok = 200 <= status < 400
        return {"ok": ok, "status_code": status, "ms": ms, "path": path}
    except urllib.error.HTTPError as e:
        ms = int((time.perf_counter() - start) * 1000)
        return {"ok": False, "status_code": e.code, "ms": ms, "path": path, "error": str(e)}
    except urllib.error.URLError as e:
        ms = int((time.perf_counter() - start) * 1000)
        return {"ok": False, "status_code": None, "ms": ms, "path": path, "error": str(e.reason)}
    except TimeoutError:
        ms = timeout_sec * 1000
        return {"ok": False, "status_code": None, "ms": ms, "path": path, "error": "timeout"}
    except Exception as e:
        ms = int((time.perf_counter() - start) * 1000)
        return {"ok": False, "status_code": None, "ms": ms, "path": path, "error": str(e)}


def simulate_one_player(base_url: str, paths: list, timeout_sec: int, player_id: int) -> dict:
    """Simuleer één speler: vraag elk pad na elkaar aan."""
    results = []
    for path in paths:
        r = fetch_one(base_url, path, timeout_sec)
        results.append(r)
        if not r.get("ok", True):
            break
    return {"player_id": player_id, "results": results}


def run_load_test(
    base_url: str,
    concurrent: int,
    timeout_sec: int,
    paths: list,
    cancel_flag: threading.Event,
) -> dict:
    """Voer load test uit; cancel_flag om (later) te kunnen stoppen."""
    base_url = base_url.rstrip("/")
    start = time.perf_counter()
    outcomes = []

    with ThreadPoolExecutor(max_workers=concurrent) as ex:
        futures = {
            ex.submit(simulate_one_player, base_url, paths, timeout_sec, i + 1): i + 1
            for i in range(concurrent)
        }
        for fut in as_completed(futures):
            if cancel_flag.is_set():
                break
            try:
                outcomes.append(fut.result())
            except Exception as e:
                outcomes.append({"player_id": futures[fut], "results": [{"ok": False, "error": str(e)}]})

    total_ms = int((time.perf_counter() - start) * 1000)
    success_count = 0
    fail_count = 0
    times = []

    for item in outcomes:
        results = item.get("results", [])
        all_ok = all(r.get("ok", False) for r in results)
        if all_ok and results:
            success_count += 1
            times.append(sum(r.get("ms", 0) for r in results))
        else:
            fail_count += 1

    times.sort()
    n = len(times)
    avg_ms = round(sum(times) / n) if n else 0
    p50 = times[n // 2] if n else 0
    p95 = times[int(n * 0.95)] if n else 0

    return {
        "base_url": base_url,
        "concurrent": concurrent,
        "success_count": success_count,
        "fail_count": fail_count,
        "total_ms": total_ms,
        "avg_ms": avg_ms,
        "p50": p50,
        "p95": p95,
        "outcomes": outcomes,
    }


class LoadTestApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Regenboog – Load test Pi")
        self.root.minsize(480, 420)
        self.root.geometry("620 520")

        self.cancel_flag = threading.Event()
        self.test_thread = None
        self._build_ui()

    def _build_ui(self):
        main = ttk.Frame(self.root, padding=12)
        main.pack(fill=tk.BOTH, expand=True)

        # ——— Instellingen ———
        settings = ttk.LabelFrame(main, text="Instellingen", padding=8)
        settings.pack(fill=tk.X, pady=(0, 10))

        ttk.Label(settings, text="Server URL:").grid(row=0, column=0, sticky=tk.W, padx=(0, 8), pady=4)
        self.url_var = tk.StringVar(value=DEFAULT_URL)
        self.url_entry = ttk.Entry(settings, textvariable=self.url_var, width=50)
        self.url_entry.grid(row=0, column=1, sticky=tk.EW, padx=(0, 8), pady=4)
        settings.columnconfigure(1, weight=1)

        ttk.Label(settings, text="Gelijktijdige gebruikers:").grid(row=1, column=0, sticky=tk.W, padx=(0, 8), pady=4)
        self.concurrent_var = tk.StringVar(value=str(DEFAULT_CONCURRENT))
        self.concurrent_spin = ttk.Spinbox(
            settings,
            from_=MIN_CONCURRENT,
            to=MAX_CONCURRENT,
            textvariable=self.concurrent_var,
            width=8,
        )
        self.concurrent_spin.grid(row=1, column=1, sticky=tk.W, padx=(0, 8), pady=4)

        ttk.Label(settings, text="Timeout per request (sec):").grid(row=2, column=0, sticky=tk.W, padx=(0, 8), pady=4)
        self.timeout_var = tk.StringVar(value=str(DEFAULT_TIMEOUT))
        self.timeout_spin = ttk.Spinbox(
            settings,
            from_=5,
            to=120,
            textvariable=self.timeout_var,
            width=8,
        )
        self.timeout_spin.grid(row=2, column=1, sticky=tk.W, padx=(0, 8), pady=4)

        # ——— Knoppen ———
        btn_frame = ttk.Frame(main)
        btn_frame.pack(fill=tk.X, pady=(0, 8))
        self.start_btn = ttk.Button(btn_frame, text="Start test", command=self._on_start)
        self.start_btn.pack(side=tk.LEFT, padx=(0, 8))
        self.stop_btn = ttk.Button(btn_frame, text="Stop", command=self._on_stop, state=tk.DISABLED)
        self.stop_btn.pack(side=tk.LEFT)

        self.status_var = tk.StringVar(value="Klaar. Stel URL en aantal in en klik op Start test.")
        ttk.Label(btn_frame, textvariable=self.status_var).pack(side=tk.LEFT, padx=(20, 0))

        # ——— Resultaat / log ———
        result_frame = ttk.LabelFrame(main, text="Resultaat", padding=4)
        result_frame.pack(fill=tk.BOTH, expand=True)
        self.log_text = scrolledtext.ScrolledText(result_frame, height=18, wrap=tk.WORD, state=tk.DISABLED)
        self.log_text.pack(fill=tk.BOTH, expand=True)

    def _log(self, msg: str):
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, msg + "\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _clear_log(self):
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.delete(1.0, tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _on_start(self):
        url = self.url_var.get().strip()
        if not url:
            messagebox.showwarning("URL leeg", "Vul een server-URL in (bijv. https://regenboog.jbouquet.be)")
            return
        try:
            concurrent = int(self.concurrent_var.get())
            concurrent = max(MIN_CONCURRENT, min(MAX_CONCURRENT, concurrent))
        except ValueError:
            messagebox.showwarning("Ongeldig getal", "Gelijktijdige gebruikers moet een getal zijn.")
            return
        try:
            timeout = int(self.timeout_var.get())
            timeout = max(5, min(120, timeout))
        except ValueError:
            timeout = DEFAULT_TIMEOUT

        self.concurrent_var.set(str(concurrent))
        self.timeout_var.set(str(timeout))
        self.cancel_flag.clear()
        self.start_btn.configure(state=tk.DISABLED)
        self.stop_btn.configure(state=tk.NORMAL)
        self.status_var.set("Test wordt uitgevoerd...")
        self._clear_log()
        self._log(f"Load test – URL: {url}")
        self._log(f"Gelijktijdige gebruikers: {concurrent}  |  Timeout: {timeout} s")
        self._log("Paden: " + ", ".join(PATHS))
        self._log("")
        self._log("Bezig...")

        def run():
            result = run_load_test(url, concurrent, timeout, PATHS, self.cancel_flag)
            self.root.after(0, lambda: self._on_test_done(result))

        self.test_thread = threading.Thread(target=run, daemon=True)
        self.test_thread.start()

    def _on_stop(self):
        self.cancel_flag.set()
        self.status_var.set("Stoppen...")

    def _on_test_done(self, r: dict):
        self.start_btn.configure(state=tk.NORMAL)
        self.stop_btn.configure(state=tk.DISABLED)
        self.status_var.set("Test klaar.")

        # Log bijwerken: "Bezig..." vervangen door resultaat
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.delete(1.0, tk.END)
        self.log_text.configure(state=tk.DISABLED)

        self._log("--- Resultaat ---")
        self._log(f"Server:            {r['base_url']}")
        self._log(f"Gelijktijdig:      {r['concurrent']}")
        self._log(f"Geslaagd:          {r['success_count']}")
        self._log(f"Gefaald:           {r['fail_count']}")
        self._log(f"Totale tijd:       {r['total_ms'] / 1000:.1f} s")
        if r["success_count"] > 0:
            self._log(f"Response (gem):   {r['avg_ms']} ms")
            self._log(f"Response (mediaan): {r['p50']} ms")
            self._log(f"Response (p95):   {r['p95']} ms")
        if r["fail_count"] > 0:
            for o in r["outcomes"]:
                res = o.get("results", [])
                if not all(x.get("ok", False) for x in res):
                    bad = next((x for x in res if not x.get("ok", True)), {})
                    err = bad.get("error") or bad.get("status_code")
                    self._log(f"Voorbeeld fout:   {err} bij {bad.get('path', '?')}")
                    break
        self._log("")
        if r["fail_count"] > 0 and r["fail_count"] < r["concurrent"]:
            self._log(f"Tip: Verlaag het aantal (bijv. {max(1, r['success_count'])}) voor stabiel gedrag.")
        if r["success_count"] == r["concurrent"]:
            self._log(f"Tip: Probeer een hoger getal (bijv. {r['concurrent'] + 10}) om het maximum te vinden.")

    def run(self):
        self.root.mainloop()


def main():
    app = LoadTestApp()
    app.run()


if __name__ == "__main__":
    main()

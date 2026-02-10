#!/usr/bin/env python3
"""
Setup script: maak een Python virtual environment voor de Regenboog launcher.
"""

import os
import sys
import subprocess
import venv
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
VENV_DIR = PROJECT_ROOT / "venv"


def remove_venv_safely(venv_path):
    """Try to remove venv directory, handling locked files on Windows."""
    import shutil
    
    # On Windows, try to kill Python processes that might be using the venv
    if sys.platform == "win32":
        try:
            python_exe = venv_path / "Scripts" / "python.exe"
            if python_exe.exists():
                # Try to find and kill processes using this Python
                result = subprocess.run(
                    ["tasklist", "/FI", f"IMAGENAME eq python.exe", "/FO", "CSV"],
                    capture_output=True,
                    text=True
                )
                if python_exe.as_posix() in result.stdout or str(python_exe) in result.stdout:
                    print("Waarschuwing: Python processen gevonden die mogelijk de venv gebruiken.")
                    print("  Sluit alle Python vensters en probeer opnieuw.")
        except Exception:
            pass  # Ignore errors in process checking
    
    # Try deletion with retries
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Use onerror handler for Windows file locks
            def handle_remove_readonly(func, path, exc):
                import stat
                os.chmod(path, stat.S_IWRITE)
                func(path)
            
            shutil.rmtree(venv_path, onerror=handle_remove_readonly)
            print("Oude venv verwijderd.")
            return True
        except PermissionError as e:
            if attempt < max_retries - 1:
                print(f"Toegang geweigerd (poging {attempt + 1}/{max_retries}). Wachten...")
                time.sleep(1)
            else:
                print(f"\n✗ Kon venv niet verwijderen: {e}")
                print("\nMogelijke oplossingen:")
                print("  1. Sluit alle Python vensters en terminals")
                print("  2. Deactiveer de venv als deze actief is")
                print("  3. Sluit OneDrive tijdelijk (als bestanden worden gesynchroniseerd)")
                print("  4. Herstart je computer en probeer opnieuw")
                print("  5. Verwijder de 'venv' map handmatig en run dit script opnieuw")
                return False
        except Exception as e:
            print(f"\n✗ Fout bij verwijderen venv: {e}")
            return False
    
    return False


def create_venv():
    """Create a virtual environment."""
    # Check if we're running from within the venv (would prevent deletion)
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        venv_python = Path(sys.executable)
        if VENV_DIR in venv_python.parents:
            print("⚠ WAARSCHUWING: Je draait dit script vanuit de venv!")
            print("  Sluit deze terminal en run het script opnieuw met de systeem Python.")
            print(f"  Bijvoorbeeld: python {Path(__file__).name}")
            return False
    
    if VENV_DIR.exists():
        print(f"Virtual environment bestaat al: {VENV_DIR}")
        response = input("Wil je deze opnieuw aanmaken? (j/n): ").strip().lower()
        if response != 'j':
            print("Geannuleerd.")
            return False
        
        if not remove_venv_safely(VENV_DIR):
            print("\nSetup geannuleerd. Los het probleem op en probeer opnieuw.")
            return False

    print(f"Virtual environment aanmaken in: {VENV_DIR}")
    venv.create(VENV_DIR, with_pip=True)
    print("✓ Virtual environment aangemaakt.")

    # Upgrade pip (use python -m pip instead of pip.exe directly)
    print("pip upgraden...")
    if sys.platform == "win32":
        python_exe = VENV_DIR / "Scripts" / "python.exe"
    else:
        python_exe = VENV_DIR / "bin" / "python"
    
    try:
        subprocess.run(
            [str(python_exe), "-m", "pip", "install", "--upgrade", "pip"],
            check=True,
            capture_output=True
        )
        print("✓ pip geüpgraded.")
    except subprocess.CalledProcessError as e:
        # Non-critical: pip upgrade failed, but venv is still usable
        print(f"⚠ pip upgrade mislukt (niet kritisch): {e}")
        print("  De venv werkt nog steeds, maar pip is mogelijk niet de nieuwste versie.")

    # Optionally install deploy dependencies
    deploy_req = PROJECT_ROOT / "deploy" / "requirements.txt"
    if deploy_req.exists():
        print("\nDeploy dependencies installeren (paramiko voor SSH)...")
        try:
            subprocess.run(
                [str(python_exe), "-m", "pip", "install", "-r", str(deploy_req)],
                check=True,
                capture_output=True
            )
            print("✓ Deploy dependencies geïnstalleerd.")
        except subprocess.CalledProcessError as e:
            print(f"⚠ Deploy dependencies installatie mislukt (niet kritisch): {e}")
            print("  Je kunt ze later installeren met: pip install -r deploy/requirements.txt")

    print("\n✓ Setup voltooid!")
    print(f"\nGebruik 'start_regenboog.bat' (Windows) of 'start_regenboog.sh' (Linux/Mac)")
    print("om de launcher te starten met de venv geactiveerd.")
    return True


if __name__ == "__main__":
    try:
        create_venv()
    except Exception as e:
        print(f"\n✗ Fout: {e}")
        sys.exit(1)

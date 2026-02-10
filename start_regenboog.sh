#!/bin/bash
# Regenboog Spellen Launcher - Linux/Mac shell script
# Activeert venv en start de Python GUI launcher

cd "$(dirname "$0")"

# Check if venv exists
if [ ! -f "venv/bin/activate" ]; then
    echo "Virtual environment niet gevonden!"
    echo ""
    echo "Maak eerst de venv aan met:"
    echo "  python setup_venv.py"
    echo ""
    exit 1
fi

# Activate venv
source venv/bin/activate

# Run the launcher
python start_regenboog.py

# Deactivate venv when done
deactivate

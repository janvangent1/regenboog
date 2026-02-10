# Regenboog Spellen – Windows Launcher

Python GUI om de Regenboog Spellen server te starten en stoppen op Windows.

## Eerste keer opzetten

**1. Maak de virtual environment aan:**
```bash
python setup_venv.py
```

Dit maakt een `venv` map aan met een geïsoleerde Python omgeving.

## De launcher starten

**Windows:**
Dubbelklik op `start_regenboog.bat` of run:
```bash
start_regenboog.bat
```

Dit activeert automatisch de venv en start de GUI launcher.

**Linux / macOS:**
```bash
chmod +x start_regenboog.sh
./start_regenboog.sh
```

**Of direct (zonder venv):**
```bash
python start_regenboog.py
```

## Wat doet de launcher?

- ✅ Start/stopt de Node.js server vanuit een GUI
- ✅ Configureerbare poort (standaard: 3000)
- ✅ Status weergave (draait / gestopt)
- ✅ Log venster met server output
- ✅ Knop om browser automatisch te openen
- ✅ Controleert of Node.js geïnstalleerd is

## Vereisten

- **Python 3** (meestal al geïnstalleerd op Windows)
- **Node.js** (download van https://nodejs.org/)
- **tkinter** (meestal al bij Python, anders: `pip install tk`)

## Troubleshooting

**"Virtual environment niet gevonden"**
- Run eerst: `python setup_venv.py`

**"Node.js niet gevonden"**
- Installeer Node.js van https://nodejs.org/
- Zorg dat `node` in je PATH staat

**"tkinter niet gevonden"**
- Windows: tkinter komt met Python
- Linux: `sudo apt-get install python3-tk`
- macOS: tkinter komt met Python

## Project structuur

```
regenboog-game/
├── start_regenboog.py      # Python GUI launcher
├── start_regenboog.bat     # Windows wrapper (activeert venv)
├── start_regenboog.sh      # Linux/Mac wrapper (activeert venv)
├── setup_venv.py           # Script om venv aan te maken
├── requirements.txt        # Python dependencies
└── venv/                   # Virtual environment (wordt aangemaakt)
```

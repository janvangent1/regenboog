╔════════════════════════════════════════════════════════════════════════════════╗
║         REGENBOOG SCHOOL GAME SUITE - PROJECT OVERVIEW & FILE STRUCTURE        ║
║                            Dutch Educational Games                              ║
╚════════════════════════════════════════════════════════════════════════════════╝

PROJECT OVERVIEW
════════════════════════════════════════════════════════════════════════════════

"Regenboog Spellen" is an educational mini-game platform designed for elementary
school students ("Basisschool De Regenboog"). It features 20+ animal-themed games
in Dutch with difficulty levels matching grades 1-6, complete with scoring and
leaderboard functionality.

TECH STACK:
  • Backend: Node.js/Express server with SQLite database
  • Frontend: HTML5, CSS3, and vanilla JavaScript
  • Deployment: Windows GUI launcher, Raspberry Pi support
  • Real-time: Socket.io for multiplayer games


FILE STRUCTURE (VISUAL TREE)
════════════════════════════════════════════════════════════════════════════════

regenboog-game/
│
├── 📄 package.json                    [NPM dependencies & scripts]
├── 📄 requirements.txt                [Python deployment dependencies]
├── 📄 README.md                       [Main project documentation]
├── 📄 LAUNCHER_README.md              [Windows launcher docs]
│
├── 🎮 start_regenboog.py              [Windows GUI launcher (Python/Tkinter)]
├── 🎮 start_regenboog.bat             [Windows batch starter]
├── 🎮 start_regenboog.sh              [Linux/Mac shell starter]
├── 🛠️ setup_venv.py                   [Virtual environment setup (Python)]
│
├── 📁 server/                         [BACKEND - Node.js Express Server]
│   ├── server.js                      [Main server entry point]
│   ├── routes.js                      [API endpoints (scores, rankings)]
│   ├── database.js                    [SQLite database initialization]
│   ├── sockets.js                     [Socket.io configuration]
│   │
│   ├── dammen-game.js                 [Dammen (Checkers) game logic]
│   ├── schaken-game.js                [Schaken (Chess) game logic]
│   ├── zeeslag-game.js                [Zeeslag (Battleship) game logic]
│   ├── vieropeenrij-game.js           [Four-in-a-row game logic]
│   ├── reken-duel-game.js             [Reken Duel (Math Battle) game logic]
│   └── vlinders_words.js              [Vlinders word matching data]
│
├── 📁 public/                         [FRONTEND - Web Content & Games]
│   │
│   ├── 📄 index.html                  [Home page / Main menu]
│   ├── 📄 admin.html                  [Admin dashboard]
│   ├── 📄 analytics.html              [Analytics/statistics page]
│   ├── 📄 class-rankings.html         [Full class leaderboards]
│   │
│   ├── 📁 assets/                     [Media files]
│   │   └── images/
│   │       ├── animals/               [Animal class icons (22 classes)]
│   │       └── classes/               [Class logos & downloads.ps1]
│   │
│   ├── 📁 css/                        [Stylesheets]
│   │   ├── main.css                   [Main styles]
│   │   └── games.css                  [Game-specific styles]
│   │
│   ├── 📁 js/                         [Frontend JavaScript]
│   │   ├── main.js                    [Navigation & UI]
│   │   ├── core.js                    [Shared game utilities]
│   │   ├── classes.js                 [Class management]
│   │   ├── leaderboard.js             [Leaderboard display]
│   │   ├── analytics-tracker.js       [Gameplay analytics]
│   │   ├── animal-icons.js            [Animal/class icons]
│   │   │
│   │   └── games/                     [Individual game scripts (22 games)]
│   │       ├── konijnen.js            [Rabbits - Carrot finder]
│   │       ├── muizen.js              [Mice - Cheese search]
│   │       ├── pinguins.js            [Penguins - Color matching]
│   │       ├── eenden.js              [Ducks - Duck catching]
│   │       ├── dolfijnen.js           [Dolphins - Ring jumping]
│   │       ├── nijlpaarden.js         [Hippos - Health quiz]
│   │       ├── lieveheersbeestjes.js  [Ladybugs - Spot counting]
│   │       ├── uilen.js               [Owls - Shape finding]
│   │       ├── kangoeroes.js          [Kangaroos - Jump obstacles]
│   │       ├── vossen.js              [Foxes - Rhyming game]
│   │       ├── draken.js              [Dragons - Math fireballs]
│   │       ├── beren.js               [Bears - Berry counting]
│   │       ├── leeuwen.js             [Lions - Multiplication tables]
│   │       ├── vlinders.js            [Butterflies - Symmetry]
│   │       ├── egels.js               [Hedgehogs - Reading/logic]
│   │       ├── wolven.js              [Wolves - Pack logic]
│   │       ├── koalas.js              [Koalas - Climb & answer]
│   │       ├── olifanten.js           [Elephants - Memory facts]
│   │       ├── giraffen.js            [Giraffes - Height/fractions]
│   │       ├── zebras.js              [Zebras - Arrow codes]
│   │       ├── pandas.js              [Pandas - Bamboo game]
│   │       ├── zwaluwen.js            [Swallows - Map navigation]
│   │       ├── reken-duel.js          [Math duel (multiplayer)]
│   │       ├── schaken.js             [Chess game]
│   │       ├── dammen.js              [Checkers game]
│   │       ├── vieropeenrij.js        [Four-in-a-row game]
│   │       └── zeeslag.js             [Battleship game]
│   │
│   └── 📁 games/                      [Game HTML pages (22 games)]
│       └── [One .html file per game]  [Template + game-specific versions]
│
├── 📁 deploy/                         [DEPLOYMENT - Raspberry Pi Setup]
│   ├── deploy_regenboog.py            [GUI tool for Pi deployment via SSH]
│   ├── setup_regenboog_pi.py          [Automated setup script for Pi]
│   ├── update_pi.py                   [Updates the Pi installation]
│   ├── requirements.txt               [Python library requirements]
│   ├── README.md                      [Deployment documentation]
│   ├── SETUP_README.md                [Detailed setup instructions]
│   ├── QUICK_REFERENCE.md             [Quick reference guide]
│   └── MANUAL_SETUP.md                [Manual setup steps]
│
├── 📁 scripts/                        [UTILITIES - Development Tools]
│   ├── load-test-pi.js                [Load testing script for Pi]
│   ├── load_test_pi_gui.py            [GUI for load testing]
│   └── remove-white-bg.js             [Image processing utility]
│
└── 📁 data/                           [DATABASE & STORAGE]
    └── scores.db                      [SQLite database (player scores)]


DETAILED COMPONENT BREAKDOWN
════════════════════════════════════════════════════════════════════════════════

1. ROOT LEVEL - Project Configuration & Launchers
   ─────────────────────────────────────────────────────────────────────────────

   package.json
   • NPM package configuration
   • Dependencies: Express, Socket.io, SQLite3, CORS, Sharp (image processing)
   • Scripts: start, dev, remove-logo-bg, load-test

   start_regenboog.py
   • Python/Tkinter GUI launcher for Windows
   • Features: Check for Node.js/venv, start/stop server, open browser
   • User-friendly port configuration

   start_regenboog.bat / start_regenboog.sh
   • Quick starters for Windows and Unix systems
   • Alternative to the Python GUI launcher

   setup_venv.py
   • Creates Python virtual environment
   • Used for deployment and launcher scripts


2. SERVER/ - Express.js Backend
   ─────────────────────────────────────────────────────────────────────────────

   server.js
   • Main Express server (port 3000 by default)
   • Initializes database and routes
   • Serves static files from public/
   • Socket.io attachment for real-time communication

   routes.js
   • API endpoints:
     GET  /api/scores     → Get scores for a class
     POST /api/submit     → Submit a new score
     GET  /api/leaderboard → Top 10 for a class

   database.js
   • SQLite initialization and schema
   • Tables: classes, scores, players
   • Connection pooling

   sockets.js
   • Socket.io namespace setup
   • Real-time multiplayer game synchronization
   • Used by: dammen, schaken, zeeslag, vieropeenrij

   Game-Specific Backend Modules:
   • dammen-game.js       → Checkers game rules & state
   • schaken-game.js      → Chess game rules & state
   • zeeslag-game.js      → Battleship game logic
   • vieropeenrij-game.js → Four-in-a-row game logic
   • reken-duel-game.js   → Math duel game logic
   • vlinders_words.js    → Word pairs for Butterfly game


3. PUBLIC/ - Frontend Web Application
   ─────────────────────────────────────────────────────────────────────────────

   HTML Pages:
   • index.html          → Main hub, class selector, game list
   • admin.html          → Admin dashboard for scores management
   • analytics.html      → Game play statistics and trends
   • class-rankings.html → Complete leaderboards for all classes
   • games/*.html        → Individual game pages (22 games)

   CSS Stylesheets:
   • main.css           → Global styling and layout
   • games.css          → Common game styles (timers, scores, buttons)

   JavaScript - Core Functions:
   • main.js            → Page navigation, class switching, UI handlers
   • core.js            → Shared utilities, timer management, scoring
   • classes.js         → Class/animal data management
   • leaderboard.js     → Fetch and display rankings
   • analytics-tracker.js → Track gameplay events and analytics
   • animal-icons.js    → Animal name-to-emoji/icon mapping

   JavaScript - Game Logic:
   • games/*.js (22 files) → Individual game implementations
     Each game has:
       - Game initialization
       - Event handlers (clicks, keyboard)
       - Scoring logic
       - Win/loss conditions
       - Socket.io for multiplayer (if applicable)

   Assets:
   • images/animals/ → 22 animal class icons for UI
   • images/classes/ → Class logos and branding


4. DEPLOY/ - Raspberry Pi Deployment Automation
   ─────────────────────────────────────────────────────────────────────────────

   deploy_regenboog.py
   • Python/Tkinter GUI for Raspberry Pi deployment via SSH
   • Features:
     - SSH connection management
     - Remote Node.js installation
     - File upload and synchronization
     - Remote service starting/stopping
     - Automatic port configuration

   setup_regenboog_pi.py
   • Automated setup script (runs on the Pi)
   • Installs Node.js and dependencies
   • Creates system service for auto-start

   update_pi.py
   • Updates existing Pi installation
   • Pull latest files from repository

   Documentation:
   • README.md           → Deployment overview
   • SETUP_README.md     → Step-by-step setup guide
   • QUICK_REFERENCE.md  → Fast reference for common tasks
   • MANUAL_SETUP.md     → Manual installation steps


5. SCRIPTS/ - Development Utilities
   ─────────────────────────────────────────────────────────────────────────────

   load-test-pi.js
   • Node.js script to stress-test the Pi server
   • Simulates multiple concurrent users

   load_test_pi_gui.py
   • Python GUI for load testing
   • Visual metrics for performance monitoring

   remove-white-bg.js
   • Image processing to remove white backgrounds
   • Used for animal icon preparation


6. DATA/ - Persistent Storage
   ─────────────────────────────────────────────────────────────────────────────

   scores.db
   • SQLite database containing:
     - Player names and class assignments
     - Individual game scores and timestamps
     - Game completion statistics
   • Automatically created on first server start
   • Persists between server restarts


GAME CLASSES & DIFFICULTY PROGRESSION
════════════════════════════════════════════════════════════════════════════════

Arranged by age/difficulty:

EARLY CHILDHOOD (Instap + 1e Kleuter, age 3-5):
  Konijnen    → Wortels voeren (Carrot finder)
  Muizen      → Kaas zoeken (Cheese search)
  Pinguïns    → Kleur bij de iglo (Color matching)
  Eenden      → Eenden vangen (Duck catching)

LOWER PRESCHOOL (2e-3e Kleuter, age 4-6):
  Dolfijnen   → Door de hoepel (Ring jumping)
  Nijlpaarden → Gezond of niet (Health quiz)
  Lieveheersbeestjes → Stippen tellen (Spot counting)
  Uilen       → Vorm in het hol (Shape finding)
  Kangoeroes  → Spring over de struik (Jump obstacles)

EARLY GRADES (1e-2e Leerjaar, age 6-8):
  Vossen      → Rijm met Vos (Rhyming)
  Draken      → Reken vuurballen (Math)
  Beren       → Precies zoveel bessen (Exact quantities)
  Leeuwen     → Tafels 2, 5, 10 (Multiplication tables)
  Vlinders    → Symmetrie (Symmetry)

MIDDLE GRADES (3e-4e Leerjaar, age 8-10):
  Egels       → Lezen en winterslaap (Reading comprehension)
  Wolven      → Roedel logica (Pack logic)
  Koala's     → Klim en beantwoord (Climbing & Q&A)
  Olifanten   → Geheugen met feiten (Memory facts)

UPPER GRADES (5e-6e Leerjaar, age 10-12):
  Giraffen    → Hoogte met breuken (Height/fractions)
  Zebra's     → Pijlen code (Arrow codes)
  Panda's     → Bamboe en panda's (Bamboo game)
  Zwaluwen    → Navigatie op de kaart (Map navigation)

MULTIPLAYER/STRATEGY:
  Reken Duel  → Math duel (2 players)
  Schaken     → Chess game
  Dammen      → Checkers game
  Vier op Rij → Four-in-a-row
  Zeeslag     → Battleship


ARCHITECTURE OVERVIEW
════════════════════════════════════════════════════════════════════════════════

CLIENT-SERVER ARCHITECTURE:
┌──────────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client-Side)                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ index.html (class/game selector) → games/*.html (game pages)   │    │
│  │                                                                  │    │
│  │ public/js/: Game logic, UI handlers, scoring, analytics        │    │
│  │ public/css/: Responsive styling                                │    │
│  │ public/assets/: Images, icons, media                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↕
                            (HTTP + WebSocket)
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                    Express.js Server (Node.js)                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ server.js (main) → routes.js (API) ← sockets.js (real-time)    │   │
│  │      ↓                                                           │   │
│  │ Static file serving + API endpoints:                            │   │
│  │  • POST /api/submit  → Score submission                         │   │
│  │  • GET  /api/scores  → Leaderboard data                         │   │
│  │  • Socket events (multiplayer games)                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
                            SQLite Database
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                         data/scores.db                                   │
│  ├── classes table  (class names, animals)                              │
│  ├── players table  (player names, class ID)                            │
│  └── scores table   (game name, score, timestamp, player ID)           │
└──────────────────────────────────────────────────────────────────────────┘


DEPLOYMENT SCENARIOS
════════════════════════════════════════════════════════════════════════════════

1. LOCAL DEVELOPMENT (Windows PC):
   • npm install
   • npm start
   • Open http://localhost:3000

2. MANUAL DEPLOYMENT (Any OS):
   • Install Node.js
   • npm install
   • PORT=3000 npm start

3. WINDOWS GUI LAUNCHER:
   • python start_regenboog.py
   • Click "Start Server" button
   • Browser opens automatically

4. RASPBERRY PI (with nginx proxy):
   • Use deploy/deploy_regenboog.py (GUI or remote)
   • App runs on port 3000 (or custom)
   • nginx reverse proxy on port 80/443


TECHNOLOGY STACK SUMMARY
════════════════════════════════════════════════════════════════════════════════

Frontend:
  • HTML5             - Semantic markup
  • CSS3              - Responsive design, animations
  • Vanilla JavaScript - Game logic, UI interactions
  • Canvas/DOM        - Game rendering
  • No framework!     - Lightweight, fast loading

Backend:
  • Node.js           - JavaScript runtime
  • Express.js        - Web framework
  • Socket.io         - Real-time multiplayer
  • SQLite3           - Persistent database
  • CORS              - Cross-origin requests
  • Sharp             - Image processing

Deployment:
  • Python            - Automation scripts
  • Tkinter           - GUI applications
  • SSH/SCP           - Remote deployment
  • Bash/Batch        - Shell scripts

Development Tools:
  • npm               - Package manager
  • Git               - Version control
  • Node.js CLI       - Server management


KEY FEATURES
════════════════════════════════════════════════════════════════════════════════

✓ 22+ Educational Games    - Animal-themed, Dutch language, age-appropriate
✓ Difficulty Progression   - Games scale from age 3 to 12
✓ Scoring & Leaderboards  - SQLite-backed persistent rankings
✓ Multiplayer Support     - Real-time games via Socket.io
✓ Admin Dashboard         - Game statistics and management
✓ Analytics Tracking      - Gameplay metrics and trends
✓ Cross-Platform         - Windows, Linux, macOS, Raspberry Pi
✓ Easy Deployment        - GUI tools for Raspberry Pi setup
✓ Lightweight            - No heavy frameworks, vanilla JavaScript
✓ Offline Ready          - Games work without internet
✓ Responsive Design      - Tablets, touch screens, keyboards


COMMON WORKFLOWS
════════════════════════════════════════════════════════════════════════════════

Starting the Server:
  Windows (GUI):    python start_regenboog.py
  Windows (CLI):    npm start
  Linux/Mac:        PORT=3000 npm start
  Raspberry Pi:     systemctl start regenboog (if using systemd)

Adding a New Game:
  1. Create public/games/mynewgame.html (copy game-template.html)
  2. Create public/js/games/mynewgame.js (game logic)
  3. Add class entry to public/js/classes.js
  4. Update HTML with game title and class name

Viewing Admin Panel:
  http://localhost:3000/admin.html

Checking Leaderboards:
  http://localhost:3000/class-rankings.html

Deploying to Raspberry Pi:
  pip install -r deploy/requirements.txt
  python deploy/deploy_regenboog.py
  [Fill in SSH details, choose port, deploy]


FILE SIZE & PERFORMANCE
════════════════════════════════════════════════════════════════════════════════

Total Size (without node_modules):
  • Backend code:     ~30 KB
  • Frontend code:    ~200 KB (HTML, CSS, JS)
  • Assets:           ~2-5 MB (images)
  • Database:         ~100 KB (starts empty)

Load Times (on modern hardware):
  • Server startup:   < 1 second
  • Page load:        < 2 seconds
  • Game load:        < 500 ms
  • Raspberry Pi:     ~3-5 seconds per game


DEPENDENCIES & LICENSES
════════════════════════════════════════════════════════════════════════════════

Production Dependencies (npm):
  • express        (MIT)       - Web server framework
  • socket.io      (MIT)       - Real-time communication
  • sqlite3        (MIT)       - Database driver
  • cors           (MIT)       - CORS middleware
  • sharp          (Apache)    - Image processing

Development Dependencies:
  • Python 3.7+    (PSF)       - Deployment scripting
  • Node.js 14+    (MIT)       - Runtime environment


TROUBLESHOOTING QUICK REFERENCE
════════════════════════════════════════════════════════════════════════════════

Issue: "Port 3000 already in use"
→ Use different port: PORT=3001 npm start

Issue: "Node.js not found"
→ Install from https://nodejs.org/

Issue: "SQLite database errors"
→ Delete data/scores.db, restart server (will auto-recreate)

Issue: "Games not loading on Raspberry Pi"
→ Check: systemctl status regenboog (or service status)
→ Verify: PORT environment variable set correctly

Issue: "SSH deployment connection refused"
→ Verify: Pi is powered on, on network, SSH enabled
→ Check: Username and password/key pair correct


CONTACT & SUPPORT
════════════════════════════════════════════════════════════════════════════════

Repository root: /server, /public, /deploy
Main entry: server/server.js
Database: data/scores.db
Admin access: http://[server]:3000/admin.html

For deployment help: See deploy/README.md
For quick setup: See deploy/QUICK_REFERENCE.md
For detailed docs: See README.md


═══════════════════════════════════════════════════════════════════════════════
Last Updated: February 2026
Version: 1.0.0
All documentation in Dutch and English-friendly
═══════════════════════════════════════════════════════════════════════════════

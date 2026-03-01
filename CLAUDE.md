# Regenboog Spellen — Claude Code Guide

Educational game suite for Regenboog School. 27 animal-themed games (24 single-player, 3 multiplayer board games, 2 competitive duels).

## Key commands

```bash
npm start          # Start the server (http://localhost:3000)
npm run lint       # ESLint check (0 errors, 0 warnings expected)
npm run lint:fix   # Auto-fix ESLint issues
```

## Tech stack

- **Backend**: Node.js + Express + Socket.io + SQLite3
- **Frontend**: Vanilla JS, Canvas, Web Audio API — no frameworks, no build step
- **Deployment**: Raspberry Pi (production), Windows + Python GUI launcher (development)

## Project structure

```
server/
  server.js      — Express entry point, rate limiters, dotenv
  routes.js      — REST API; admin password from process.env.ADMIN_PASSWORD
  database.js    — Persistent SQLite connection, WAL mode, migration system
  sockets.js     — Socket.io for all 5 multiplayer games (3 namespaces)
  zeeslag-game.js — Ship config + board logic for Battleship
  reken-duel-game.js — Question generation for Math Duel
public/
  js/
    core.js        — Shared utilities; global escapeHtml() + playSound() at end of file
    classes.js     — Master list of all 27 games with id/name/grade/gameName
    leaderboard.js — Leaderboard submit + render
    analytics-tracker.js — Visitor tracking (no IP, heartbeat pauses on hidden tabs)
    games/         — One .js file per game (27 files)
  css/
  *.html           — One HTML page per game + index/admin/analytics/leaderboard
data/
  regenboog.db    — SQLite database (gitignored)
.env              — ADMIN_PASSWORD=jeroom (gitignored)
```

## Architecture rules

### Frontend
- `escapeHtml` and `playSound` are **global functions** defined at the end of `core.js`. Do NOT add them to individual game files — they are already available everywhere.
- All 27 game HTML pages load `core.js`, so these globals are always present.
- Canvas games already use `requestAnimationFrame` — don't change to `setInterval`.
- Analytics already handles tab visibility (heartbeat pauses when tab hidden).

### Backend
- **Single persistent DB connection** — `database.js` exports a module-level `db`. Don't open/close per query.
- **Migrations** run automatically on startup via `runMigrations()`. Add new migrations to the array in `database.js`.
- **Admin password** comes from `.env` → `process.env.ADMIN_PASSWORD`. Never hardcode it.
- **Rate limiting**: general 200/15min, score submit 30/min, admin 20/15min, analytics 120/min.

### Multiplayer (sockets.js)
Five games share one sockets.js file across 3 Socket.io namespaces:

| Namespace | Games |
|-----------|-------|
| `/` (default) | Dammen (checkers) |
| `/schaken` | Chess + Vieropeenrij (Connect Four) |
| `/zeeslag` | Battleship |
| `/reken-duel` | Math Duel |

Grace period: 10s before disconnected player is kicked from room (`GRACE_PERIOD_MS`).
When a player disconnects: server emits `opponentDisconnected` to the other player immediately, then emits `opponentLeft` after 10s via `leaveRoom()`.
Stale invites: auto-cleaned every 60s, expire after 30s (`INVITE_TIMEOUT_MS`).
Per-socket move rate limit: minimum 50ms between moves (`MIN_MOVE_INTERVAL_MS`).

## Game patterns

Each single-player game follows this pattern:
1. IIFE wrapping all code: `(function () { ... })()`
2. `const CLASS_ID = 'gamename'` — matches the `id` in classes.js
3. Rounds handled by local `currentRound` / `totalScore` variables
4. Score submitted via `window.Leaderboard.showSubmitForm(CLASS_ID, score, callback)`
5. Leaderboard rendered via `window.Leaderboard.render(leaderboardEl, CLASS_ID)`

Each multiplayer game follows this pattern:
1. `setupSocketListeners()` always calls `socket.off(event)` before `socket.on(event)` to prevent duplicate handlers
2. `opponentDisconnected` → show fixed orange banner at top of page
3. `opponentLeft` → remove banner + return to `step = 'mp-lobby'` + `render()`

## Environment setup (Raspberry Pi or new machine)

```bash
npm install              # Install dependencies
echo "ADMIN_PASSWORD=jeroom" > .env   # Create env file (not in git)
npm start
```

## ESLint config

`eslint.config.js` uses ESLint v10 flat config with the `globals` package.
Browser globals (escapeHtml, playSound, io, RegenboogCore, etc.) are declared in the config.
Target: **0 errors, 0 warnings**. Run `npm run lint` to verify before committing.

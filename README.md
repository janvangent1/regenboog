# Basisschool De Regenboog – Spellen

Educatieve minispellen voor elke klas (dierenthema), met ranglijst. 27 spellen: 22 single-player en 5 multiplayer. Alles in het Nederlands. Draait in de browser en kan op een Raspberry Pi gehost worden.

## Vereisten

- Node.js (v14 of nieuwer)
- npm

## Eerste keer opzetten

```bash
npm install
echo "ADMIN_PASSWORD=jeroom" > .env
npm start
```

Open in de browser: **http://localhost:3000**

## Beschikbare commando's

```bash
npm start          # Start de server
npm run lint       # ESLint-check (0 errors, 0 warnings)
npm run lint:fix   # Auto-fix ESLint problemen
```

## Poort wijzigen

Stel de omgevingsvariabele `PORT` in:

```bash
# Windows (PowerShell)
$env:PORT=8080; node server/server.js

# Linux / macOS
PORT=8080 node server/server.js
```

## Windows launcher (GUI)

Er is een Python GUI-launcher voor Windows die de server start/stopt, logs toont en de browser automatisch opent:

```bash
python start_regenboog.py
```

## Hosting op Raspberry Pi

1. Installeer Node.js op de Pi (via [nodesource](https://github.com/nodesource/distributions) of `apt install nodejs npm`).
2. Kopieer het project naar de Pi (bijv. met `scp` of `git clone`).
3. Op de Pi:
   ```bash
   cd regenboog-game
   echo "ADMIN_PASSWORD=jeroom" > .env
   npm install
   npm start
   ```
4. Open op een apparaat in hetzelfde netwerk: **http://[IP-van-de-Pi]:3000**

Als je al nginx op poort 80/443 gebruikt, laat je de app op poort 3000 draaien en configureer je nginx als reverse proxy naar `http://localhost:3000`.

## Deploy naar Raspberry Pi (GUI)

Er is een Python GUI om via SSH de benodigde software op de Pi te installeren, bestanden te synchroniseren en de app te starten. Zie `deploy/README.md` en run:

```bash
pip install -r deploy/requirements.txt
python deploy/deploy_regenboog.py
```

## Leeftijden en moeilijkheid (Vlaanderen)

| Fase                | Leeftijd  | Klassen                                                          |
|---------------------|-----------|------------------------------------------------------------------|
| Instap + 1e kleuter | 3–5 jaar  | Konijnen, Muizen, Pinguïns, Eenden                               |
| 2e–3e kleuter       | 4–6 jaar  | Dolfijnen, Nijlpaarden, Lieveheersbeestjes, Uilen, Kangoeroes    |
| 1e leerjaar         | 6–7 jaar  | Vossen, Draken, Beren                                            |
| 2e leerjaar         | 7–8 jaar  | Leeuwen, Vlinders                                                |
| 3e leerjaar         | 8–9 jaar  | Egels, Wolven                                                    |
| 4e leerjaar         | 9–10 jaar | Koala's, Olifanten                                               |
| 5e leerjaar         | 10–11 jaar| Giraffen, Zebra's                                                |
| 6e leerjaar         | 11–12 jaar| Panda's, Zwaluwen                                                |

## Klassen en spellen

### Single-player (22 spellen)

| Klas                | Spel                          |
|---------------------|-------------------------------|
| Konijnen            | Wortels tikken                |
| Muizen              | Kaas memory                   |
| Pinguïns            | Visjes vangen                 |
| Eenden              | Kleuren naar de eend          |
| Dolfijnen           | Zwem door de hoepels          |
| Nijlpaarden         | Eten tellen                   |
| Lieveheersbeestjes  | Vlieg en verzamel bloemen     |
| Uilen               | Dieren memory                 |
| Kangoeroes          | Rekensommen oplossen          |
| Vossen              | Vos door het doolhof          |
| Draken              | Reken vuurballen              |
| Beren               | Beer naar de honing           |
| Leeuwen             | Leeuw op jacht                |
| Vlinders            | Dier namen maken              |
| Egels               | Weg oversteken                |
| Wolven              | Roedel jacht                  |
| Koala's             | Koala pong duel               |
| Olifanten           | Waterpoel route geheugen      |
| Giraffen            | Vallende dieren               |
| Zebra's             | Getallenpatronen              |
| Panda's             | Panda space verdediging       |
| Zwaluwen            | Luchtdoolhof                  |

### Multiplayer (5 spellen)

| Spel        | Type                    |
|-------------|-------------------------|
| Dammen      | 2 spelers, om beurten   |
| Schaken     | 2 spelers, om beurten   |
| 4 op een rij| 2 spelers, om beurten   |
| Zeeslag     | 2 spelers, gelijktijdig |
| Reken-duel  | 2 spelers, gelijktijdig |

## Admin en ranglijst

- **Admin**: http://localhost:3000/admin.html (vereist `ADMIN_PASSWORD` in `.env`)
- **Ranglijsten**: http://localhost:3000/class-rankings.html
- Scores worden opgeslagen in `data/scores.db` (SQLite, aangemaakt bij eerste start). Na een spel kan de speler een naam invoeren; de top 10 per klas wordt getoond.

## Projectstructuur

```
server/
  server.js             — Expressserver, rate limiting, dotenv
  routes.js             — REST API (scores, admin)
  database.js           — SQLite-verbinding, WAL-modus, migraties
  sockets.js            — Socket.io voor alle 5 multiplayer-spellen
  zeeslag-game.js       — Zeeslag: scheepsconfiguratie en bordlogica
  reken-duel-game.js    — Reken-duel: vraaggeranking
  dammen-game.js        — Dammen: spelregels
  schaken-game.js       — Schaken: spelregels
  vieropeenrij-game.js  — 4 op een rij: spelregels
  vlinders_words.js     — Woordenlijst voor het Vlinders-spel

public/
  *.html                — Eén HTML-pagina per spel + index/admin/analytics
  js/core.js            — Gedeelde hulpfuncties (escapeHtml, playSound)
  js/classes.js         — Lijst van alle 27 spellen
  js/games/             — Eén .js-bestand per spel (27 bestanden)
  css/                  — Opmaak

deploy/                 — Python GUI-tool voor Raspberry Pi-deployment via SSH
scripts/                — Hulpscripts (load-test, afbeeldingsverwerking)
data/
  scores.db             — SQLite-database (aangemaakt bij eerste start)
```

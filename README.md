# Basisschool De Regenboog – Spellen

Educatieve minispellen voor elke klas (dierenthema), met ranglijst. Alles in het Nederlands. Draait in de browser en kan op een Raspberry Pi gehost worden.

## Vereisten

- Node.js (v14 of nieuwer)
- npm

## Lokaal starten

```bash
npm install
npm start
```

Open in de browser: **http://localhost:3000**

## Poort wijzigen

Stel de omgevingsvariabele `PORT` in:

```bash
# Windows (PowerShell)
$env:PORT=8080; node server/server.js

# Linux / macOS
PORT=8080 node server/server.js
```

## Hosting op Raspberry Pi

1. Installeer Node.js op de Raspberry Pi (bijv. via [nodeource](https://github.com/nodesource/distributions) of `apt install nodejs npm`).
2. Kopieer het project naar de Pi (bijv. met scp of git clone).
3. Op de Pi:
   ```bash
   cd regenboog-game
   npm install
   PORT=3000 node server/server.js
   ```
4. Open op een apparaat in hetzelfde netwerk: **http://[IP-van-de-Pi]:3000**

Als je al nginx op poort 80/443 gebruikt, laat je de app op een andere poort (bijv. 3000) draaien en eventueel via nginx als reverse proxy naar `http://localhost:3000` doorverwijzen.

## Deploy naar Raspberry Pi (GUI)

Er is een **Python GUI** om via SSH de benodigde software op de Pi te installeren, alle bestanden te deployen en de app op een gekozen poort te starten (handig als nginx al 80/443 gebruikt). Zie **`deploy/README.md`** en run:

```bash
pip install -r deploy/requirements.txt
python deploy/deploy_regenboog.py
```

## Leeftijden en moeilijkheid (Vlaanderen)

- **Instap + 1e kleuter** ≈ 3–5 jaar: eenvoudige klik- en sorteerspellen (Konijnen, Muizen, Pinguïns, Eenden).
- **2e–3e kleuter** ≈ 4–6 jaar: korte reeksen, geheugen, tellen (Dolfijnen, Nijlpaarden, Lieveheersbeestjes, Uilen, Kangoeroes).
- **1e leerjaar** ≈ 6–7 jaar: eenvoudig doolhof of actie (Vossen, Draken, Beren).
- **2e leerjaar** ≈ 7–8 jaar: doolhof 5×5, eenvoudige doelen (Leeuwen, Vlinders).
- **3e leerjaar** ≈ 8–9 jaar: langere paden, obstakels (Egels, Wolven).
- **4e leerjaar** ≈ 9–10 jaar: herhaling en geheugen (Koala's, Olifanten).
- **5e leerjaar** ≈ 10–11 jaar: groter doolhof, lastige patronen (Giraffen, Zebra's).
- **6e leerjaar** ≈ 11–12 jaar: grootste doolhof of reactiespel (Panda's, Zwaluwen).

## Klassen en spellen

| Klas            | Spel                     |
|-----------------|--------------------------|
| Konijnen        | Wortels voeren           |
| Muizen          | Kaas zoeken              |
| Pinguïns        | Kleur bij de iglo        |
| Eenden          | Eenden vangen            |
| Dolfijnen       | Door de hoepel           |
| Nijlpaarden     | Gezond of niet           |
| Lieveheersbeestjes | Stippen tellen        |
| Uilen           | Vorm in het hol          |
| Kangoeroes      | Spring over de struik    |
| Vossen          | Rijm met Vos             |
| Draken          | Reken vuurballen         |
| Beren           | Precies zoveel bessen    |
| Leeuwen         | Tafels 2, 5, 10          |
| Vlinders        | Symmetrie                |
| Egels           | Lezen en winterslaap     |
| Wolven          | Roedel logica            |
| Koala's         | Klim en beantwoord       |
| Olifanten       | Geheugen met feiten      |
| Giraffen        | Hoogte met breuken      |
| Zebra's         | Pijlen code              |
| Panda's         | Bamboe en panda's        |
| Zwaluwen        | Navigatie op de kaart    |

## Ranglijst

Scores worden opgeslagen in een SQLite-database in de map `data/`. Na een spel kan de speler een naam invoeren; de top 10 per klas wordt getoond.

## Projectstructuur

- `server/` – Express-server en SQLite
- `public/` – HTML, CSS, JS en spellen
- `public/games/` – Eén HTML-pagina per spel
- `public/js/games/` – JavaScript per spel
- `data/` – scores.db (wordt aangemaakt bij eerste start)

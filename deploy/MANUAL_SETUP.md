# Regenboog – Handmatige Setup Instructies voor Raspberry Pi

Deze handleiding legt stap-voor-stap uit hoe je de Regenboog applicatie handmatig installeert en configureert op een Raspberry Pi.

## Vereisten

- Raspberry Pi met Raspberry Pi OS (of vergelijkbare Linux distributie)
- SSH toegang tot de Raspberry Pi
- Sudo/root rechten op de Pi
- DNS A-record voor `regenboog.jbouquet.be` dat naar het IP-adres van de Pi wijst
- Internetverbinding op de Raspberry Pi

## Overzicht van de stappen

1. [SSH verbinding maken](#1-ssh-verbinding-maken)
2. [Node.js installeren](#2-nodejs-installeren)
3. [Nginx installeren](#3-nginx-installeren)
4. [PM2 installeren](#4-pm2-installeren)
5. [Bestanden kopiëren naar de Pi](#5-bestanden-kopiëren-naar-de-pi)
6. [Dependencies installeren](#6-dependencies-installeren)
7. [App starten met PM2](#7-app-starten-met-pm2)
8. [Nginx configureren](#8-nginx-configureren)
8b. [Firewall (UFW) configureren](#8b-firewall-ufw-configureren)
9. [SSL certificaat installeren](#9-ssl-certificaat-installeren)
10. [Verificatie](#10-verificatie)

**Alternatief (geen port forwarding):** [Appendix A: Cloudflare](#appendix-a-cloudflare-optie-zonder-port-forwarding)

---

## 1. SSH verbinding maken

Open een terminal op je Windows PC en maak verbinding met de Raspberry Pi:

```bash
ssh pi@192.168.1.10
```

Vervang `192.168.1.10` met het IP-adres van jouw Raspberry Pi. Als je de hostnaam hebt geconfigureerd, kun je ook gebruiken:

```bash
ssh pi@raspberrypi.local
```

Voer je wachtwoord in wanneer daarom wordt gevraagd.

---

## 2. Node.js installeren

Controleer eerst of Node.js al geïnstalleerd is:

```bash
node -v
npm -v
```

Als Node.js niet geïnstalleerd is, installeer het dan:

```bash
# Download en voeg NodeSource repository toe
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Installeer Node.js
sudo apt-get install -y nodejs

# Verifieer installatie
node -v
npm -v
```

Je zou nu Node.js versie 20.x moeten zien.

**Alternatief (als NodeSource niet werkt):**

```bash
sudo apt-get update
sudo apt-get install -y nodejs npm
```

---

## 3. Nginx installeren

Installeer Nginx:

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

Start en enable Nginx:

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

Verifieer dat Nginx draait:

```bash
sudo systemctl status nginx
```

Je zou nu kunnen testen door in je browser te gaan naar `http://<IP-van-je-Pi>` - je zou de standaard Nginx welkomstpagina moeten zien.

---

## 4. PM2 installeren

PM2 is een process manager voor Node.js applicaties. Installeer het globaal:

```bash
sudo npm install -g pm2
```

Verifieer installatie:

```bash
pm2 -v
```

Configureer PM2 om automatisch te starten na een reboot:

```bash
pm2 startup systemd -u pi --hp /home/pi
```

Dit commando geeft je een commando terug dat je moet uitvoeren met `sudo`. Kopieer en voer dat commando uit.

---

## 5. Bestanden kopiëren naar de Pi

### Optie A: Via SCP (vanaf je Windows PC)

Open een **nieuwe** terminal op je Windows PC (laat de SSH sessie open) en navigeer naar de projectmap:

```bash
cd "d:\OneDrive\Documenten\software projects\regenboog game"
```

Kopieer alle bestanden naar de Pi (exclusief node_modules, .git, etc.):

```bash
scp -r server public scripts package.json package-lock.json README.md pi@192.168.1.10:/home/pi/regenboog-game
```

Vervang `192.168.1.10` met het IP-adres van jouw Pi.

### Optie B: Via SFTP client

Gebruik een SFTP client zoals WinSCP of FileZilla:
- **Host:** IP-adres van je Pi
- **Username:** `pi`
- **Password:** Je SSH wachtwoord
- **Remote directory:** `/home/pi/regenboog-game`

Kopieer de volgende mappen/bestanden:
- `server/`
- `public/`
- `scripts/`
- `package.json`
- `package-lock.json`
- `README.md`

**NIET kopiëren:**
- `node_modules/`
- `.git/`
- `deploy/`
- `.venv/` of `venv/`

### Optie C: Via Git (als je een repository hebt)

Op de Pi:

```bash
cd /home/pi
git clone <jouw-repository-url> regenboog-game
cd regenboog-game
```

---

## 6. Dependencies installeren

Op de Raspberry Pi, navigeer naar de projectmap:

```bash
cd /home/pi/regenboog-game
```

Installeer alle Node.js dependencies:

```bash
npm install
```

Dit kan enkele minuten duren, vooral voor native modules zoals `sqlite3`.

---

## 7. App starten met PM2

Start de applicatie met PM2 op poort 3001 (of een andere poort naar keuze):

```bash
cd /home/pi/regenboog-game
PORT=3001 pm2 start server/server.js --name regenboog
```

Verifieer dat de app draait:

```bash
pm2 status
pm2 logs regenboog
```

Je zou output moeten zien die aangeeft dat de server draait op poort 3001.

**Sla de PM2 configuratie op** zodat de app automatisch start na een reboot:

```bash
pm2 save
```

---

## 8. Nginx configureren

Maak een nieuwe Nginx configuratie voor je subdomein:

```bash
sudo nano /etc/nginx/sites-available/regenboog.jbouquet.be
```

Plak de volgende configuratie:

```nginx
server {
    listen 80;
    server_name regenboog.jbouquet.be;

    # Logging
    access_log /var/log/nginx/regenboog_access.log;
    error_log /var/log/nginx/regenboog_error.log;

    # Proxy naar Node.js app
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        
        # Headers voor correcte proxy werking
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Sla op met `Ctrl+O`, druk `Enter`, en sluit af met `Ctrl+X`.

Activeer de configuratie:

```bash
sudo ln -s /etc/nginx/sites-available/regenboog.jbouquet.be /etc/nginx/sites-enabled/
```

Verwijder de standaard site (optioneel, om conflicten te voorkomen):

```bash
sudo rm /etc/nginx/sites-enabled/default
```

Test de Nginx configuratie:

```bash
sudo nginx -t
```

Als alles goed is, herlaad Nginx:

```bash
sudo systemctl reload nginx
```

---

## 8b. Firewall (UFW) configureren

Als je de Pi niet kunt bereiken vanaf je PC of telefoon in hetzelfde netwerk, blokkeert de firewall waarschijnlijk de poorten. Configureer UFW als volgt:

**Controleer of UFW actief is:**

```bash
sudo ufw status
```

**Stel de regels in (voer uit op de Pi):**

```bash
# SSH toestaan (anders verlies je verbinding!)
sudo ufw allow 22/tcp

# HTTP en HTTPS voor nginx (voor regenboog.jbouquet.be)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Optioneel: directe toegang tot de app op poort 3001 (bv. voor testen als http://<pi-ip>:3001)
sudo ufw allow 3001/tcp

# Firewall activeren (als nog niet actief)
sudo ufw enable

# Status controleren
sudo ufw status numbered
```

**Belangrijk:** Zonder `allow 22/tcp` kun je na `ufw enable` geen SSH meer! Als UFW al actief was en 22 nog niet open stond, voeg die regel toe en herlaad: `sudo ufw reload`.

Na het openen van de poorten kun je:
- vanaf je PC: **http://\<IP-van-de-Pi\>:3001** (direct naar de app), of
- via domein: **https://regenboog.jbouquet.be** (via nginx, poorten 80/443).

---

## 9. SSL certificaat installeren

Nginx kan meerdere domeinen op dezelfde poorten 80 en 443 bedienen (SNI). Je hoeft dus **geen extra poorten** te openen als jbouquet.be al op de Pi draait.

---

### Snel: Alleen HTTPS voor regenboog (jbouquet.be heeft al een certificaat)

Als **http://regenboog.jbouquet.be** al werkt en je **alleen voor regenboog** HTTPS wilt toevoegen **zonder het bestaande jbouquet.be-certificaat aan te raken**:

1. **SSH naar de Pi:**  
   `ssh pi@<IP-van-je-Pi>`

2. **Eén commando (certbot maakt een apart certificaat voor het subdomein):**
   ```bash
   sudo certbot --nginx -d regenboog.jbouquet.be
   ```
   - Geef je e-mail op als gevraagd; akkoord met de voorwaarden.
   - Certbot maakt een **nieuw** certificaat voor `regenboog.jbouquet.be` en past alleen de Nginx-config van dat subdomein aan. Het certificaat van **jbouquet.be** blijft ongewijzigd.

3. **Controleren:**  
   - `https://regenboog.jbouquet.be` moet laden met slot-icoon.  
   - `https://jbouquet.be` (of je andere site) blijft gewoon werken.

**Als certbot klaagt** dat er geen server_name match is: zorg dat er een Nginx-site voor regenboog bestaat (zie [stap 8](#8-nginx-configureren)), bijv. `/etc/nginx/sites-available/regenboog.jbouquet.be` met `server_name regenboog.jbouquet.be;`, en dat die gelinkt is in `sites-enabled`. Daarna opnieuw `sudo certbot --nginx -d regenboog.jbouquet.be`.

---

### Situatie A: Certbot staat nog niet op de Pi

Installeer Certbot (Let's Encrypt client):

```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

Ga daarna door naar [Certificaat voor regenboog.jbouquet.be](#certificaat-voor-regenboogjbouquetbe) hieronder.

---

### Situatie B: Certbot is al geïnstalleerd (bijv. voor jbouquet.be)

Je hoeft niets extra te installeren. Certbot kan een **extra certificaat** voor het subdomein aanmaken zonder het bestaande certificaat van jbouquet.be te wijzigen.

Ga direct door naar [Certificaat voor regenboog.jbouquet.be](#certificaat-voor-regenboogjbouquetbe).

---

### Certificaat voor regenboog.jbouquet.be

**Voorwaarden:**
- DNS A-record voor `regenboog.jbouquet.be` wijst naar het IP-adres van je Pi
- Nginx-configuratie voor regenboog.jbouquet.be staat in plaats (stap 8)
- Poorten 80 en 443 zijn bereikbaar (zelfde als voor jbouquet.be)

Voer op de Pi uit:

```bash
sudo certbot --nginx -d regenboog.jbouquet.be
```

- Als om een e-mailadres wordt gevraagd: hetzelfde als voor jbouquet.be mag, of een ander.
- Accepteer de voorwaarden als dat gevraagd wordt.

Certbot zal:
- Een apart certificaat voor `regenboog.jbouquet.be` aanmaken (naast dat van jbouquet.be),
- De bestaande Nginx-config voor regenboog.jbouquet.be aanpassen voor HTTPS,
- Een HTTP → HTTPS redirect voor dat subdomein toevoegen.

**Verlenging:** De bestaande Certbot-timer/cron verlengt alle certificaten (inclusief dit nieuwe). Controleren kan met:

```bash
sudo certbot renew --dry-run
```

---

## 10. Verificatie

### Test de applicatie

1. **HTTP redirect:** Ga naar `http://regenboog.jbouquet.be` - je zou automatisch doorgestuurd moeten worden naar HTTPS.

2. **HTTPS:** Ga naar `https://regenboog.jbouquet.be` - je zou de applicatie moeten zien draaien met een geldig SSL certificaat.

3. **PM2 status:** Controleer of de app nog draait:
   ```bash
   pm2 status
   pm2 logs regenboog --lines 50
   ```

4. **Nginx logs:** Bekijk de logs als er problemen zijn:
   ```bash
   sudo tail -f /var/log/nginx/regenboog_access.log
   sudo tail -f /var/log/nginx/regenboog_error.log
   ```

### Handige commando's

**PM2:**
```bash
pm2 status              # Status van alle processen
pm2 logs regenboog      # Logs bekijken
pm2 restart regenboog   # App herstarten
pm2 stop regenboog      # App stoppen
pm2 start regenboog     # App starten
pm2 save                # Configuratie opslaan
```

**Nginx:**
```bash
sudo systemctl status nginx    # Status checken
sudo systemctl reload nginx    # Configuratie herladen
sudo nginx -t                  # Configuratie testen
```

**SSL certificaat:**
```bash
sudo certbot certificates      # Certificaten bekijken
sudo certbot renew             # Certificaat verlengen
```

---

## Troubleshooting

### App start niet

1. Controleer of de poort beschikbaar is:
   ```bash
   sudo netstat -tulpn | grep 3001
   ```

2. Bekijk PM2 logs:
   ```bash
   pm2 logs regenboog --lines 100
   ```

3. Test de app handmatig:
   ```bash
   cd /home/pi/regenboog-game
   PORT=3001 node server/server.js
   ```

### Nginx geeft 502 Bad Gateway

1. Controleer of de app draait:
   ```bash
   pm2 status
   ```

2. Test of de app lokaal bereikbaar is:
   ```bash
   curl http://localhost:3001
   ```

3. Controleer Nginx error logs:
   ```bash
   sudo tail -f /var/log/nginx/regenboog_error.log
   ```

### Niet bereikbaar vanaf PC/telefoon in hetzelfde netwerk

Als `localhost:3001` op de Pi werkt maar `http://<pi-ip>:3001` vanaf je PC niet, blokkeert waarschijnlijk de firewall (UFW) poort 3001.

**Oplossing:** Open de benodigde poorten (zie [8b. Firewall (UFW) configureren](#8b-firewall-ufw-configureren)):

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp
sudo ufw enable
sudo ufw status
```

Daarna zou `http://<IP-van-de-Pi>:3001` vanaf je PC moeten werken.

### SSL certificaat installatie mislukt

1. Controleer DNS:
   ```bash
   nslookup regenboog.jbouquet.be
   ```
   Dit moet het IP-adres van je Pi teruggeven.

2. Controleer of port 80 bereikbaar is:
   ```bash
   sudo ufw status
   ```
   Als firewall actief is, open port 80 en 443:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

3. Test handmatig:
   ```bash
   sudo certbot certonly --standalone -d regenboog.jbouquet.be
   ```

### App stopt na reboot

1. Controleer PM2 startup configuratie:
   ```bash
   pm2 startup
   ```
   Voer het commando uit dat wordt getoond.

2. Sla PM2 configuratie op:
   ```bash
   pm2 save
   ```

---

## Raspberry Pi updaten met de laatste code van GitHub

### Optie 1: Python-script vanaf je PC (aanbevolen)

Op je **Windows PC** (in de projectmap), één commando:

```bash
python deploy/update_pi.py
```

Het script verbindt via SSH met de Pi (gebruikt dezelfde gegevens als `setup_regenboog_pi.py` uit `deploy/setup_config.json`), voert uit: `git pull`, `npm install`, `pm2 restart regenboog`, en klaar.

- **Eerste keer:** zorg dat je ooit `setup_regenboog_pi.py` hebt gedraaid zodat host/wachtwoord in `deploy/setup_config.json` staan, of zet bijvoorbeeld:  
  `set REGENBOOG_PI_PASSWORD=je_wachtwoord` (Windows) voor die ene run.
- **Vereiste:** Op de Pi moet de app uit een **git clone** komen (map met `.git`), anders heeft `git pull` geen effect.

### Optie 2: Handmatig via SSH op de Pi

**Als de app op de Pi via Git is geïnstalleerd** (je hebt ooit `git clone` gedaan):

1. SSH in op de Pi:
   ```bash
   ssh pi@<IP-van-je-Pi>
   ```
2. Ga naar de projectmap (pas aan als je andere map gebruikt):
   ```bash
   cd /home/pi/regenboog-game
   ```
3. Haal de laatste wijzigingen op:
   ```bash
   git pull
   ```
4. Installeer eventueel nieuwe npm-pakketten (na wijzigingen in `package.json`):
   ```bash
   npm install
   ```
5. Herstart de app:
   ```bash
   pm2 restart regenboog
   ```

**Als je de app via het deploy-script (SFTP) hebt geplaatst:** run het deploy-script opnieuw vanaf je PC om bestanden te uploaden, en herstart daarna op de Pi met `pm2 restart regenboog` (of via het script als dat herstart ondersteunt).

---

## Volgende stappen

- **Updates deployen:** Zie hierboven (Git pull of deploy-script) en herstart met `pm2 restart regenboog`
- **Monitoring:** Overweeg PM2 monitoring of andere monitoring tools
- **Backups:** Maak regelmatig backups van de database en configuratie bestanden

---

## Appendix A: Cloudflare (optie zonder port forwarding)

Als je nu **port forwarding** op je router gebruikt (poort 80/443 naar de Pi), kun je overstappen naar **Cloudflare**. Dat kan op twee manieren.

### Hoe het werkt (kort)

| Aanpak | Wat gebeurt er? | Port forwarding nodig? |
|--------|------------------|------------------------|
| **Huidige setup** | Router stuurt poort 80/443 door naar de Pi; DNS wijst regenboog.jbouquet.be naar je thuis-IP. | Ja |
| **Cloudflare DNS + proxy** | DNS wordt door Cloudflare beheerd; verkeer gaat eerst naar Cloudflare, daarna naar jouw IP. Je opent nog steeds 80/443 op de router. | Ja |
| **Cloudflare Tunnel** | Een programmaatje op de Pi (cloudflared) maakt een **uitgaande** verbinding naar Cloudflare. Verkeer: bezoeker → Cloudflare → tunnel → Pi. Je thuis-IP hoeft niet bereikbaar te zijn. | **Nee** |

**Aanrader als je port forwarding wilt kwijtraken:** **Cloudflare Tunnel**. Geen poorten openen, werkt ook achter CGNAT of strikte firewalls, en Cloudflare regelt SSL.

---

### Optie 1: Cloudflare Tunnel (aanbevolen – geen port forwarding)

De Pi praat **uitgaand** met Cloudflare. Je router hoeft geen poorten door te sturen.

#### Stap 1: Domein bij Cloudflare

1. Ga naar [dash.cloudflare.com](https://dash.cloudflare.com) en log in (of maak een gratis account).
2. **Add a site** → vul `jbouquet.be` in (of alleen het deel dat je gebruikt).
3. Kies het **Free** plan.
4. Cloudflare toont twee nameservers (bijv. `ada.ns.cloudflare.com` en `bob.ns.cloudflare.com`). Ga naar je **domeinregistrar** (waar jbouquet.be is geregistreerd) en vervang de bestaande nameservers door deze twee. Soms duurt het even (minuten tot uren) tot dit actief is.

#### Stap 2: Tunnel aanmaken in het Cloudflare-dashboard

1. In Cloudflare: kies je zone **jbouquet.be**.
2. Links: **Zero Trust** (of **Networks** → **Tunnels**). Als Zero Trust nog niet is ingeschakeld, volg de korte setup (gratis).
3. **Create a tunnel** → kies **Cloudflared**.
4. Geef de tunnel een naam, bijv. `regenboog-pi`.
5. Klik **Next**. Je krijgt een **token** (lange regel). **Kopieer die** – die gebruik je op de Pi.

#### Stap 3: cloudflared op de Pi installeren en tunnel starten

SSH naar de Pi en voer uit:

```bash
# Download en installeer cloudflared (arm64 voor Pi 4/5, pas aan als je armhf gebruikt)
curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i /tmp/cloudflared.deb
```

Voor **32-bit Raspberry Pi OS (armhf)** gebruik in plaats daarvan:

```bash
curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm.deb
sudo dpkg -i /tmp/cloudflared.deb
```

Registreer de tunnel met het token uit stap 2 (vervang `JOUW_TOKEN` door het echte token):

```bash
sudo cloudflared service install JOUW_TOKEN
```

Start de service:

```bash
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

#### Stap 4: Publieke hostname koppelen aan de tunnel

1. Terug in het Cloudflare-dashboard: bij je tunnel → **Configure** (of **Public Hostname**).
2. **Add a public hostname**:
   - **Subdomain:** `regenboog` (dus wordt regenboog.jbouquet.be).
   - **Domain:** `jbouquet.be`.
   - **Service type:** HTTP.
   - **URL:** `localhost:3001` (of de poort waar je Regenboog-app op de Pi op luistert, bijv. 3001).
3. Sla op.

Na een paar seconden is **https://regenboog.jbouquet.be** bereikbaar via de tunnel. Geen nginx of certbot op de Pi nodig voor dit subdomein; Cloudflare verzorgt SSL.

**Optioneel:** Je kunt nginx op de Pi uitzetten voor regenboog (poort 80/443) en eventueel port forwarding voor 80/443 verwijderen als je regenboog alleen via de tunnel bereikbaar wilt maken.

---

### Beide domeinen via Tunnel + nginx/certbot opruimen (jbouquet.be én regenboog)

Als je **jbouquet.be** en **regenboog.jbouquet.be** allebei via de Cloudflare Tunnel wilt laten lopen, hoef je op de Pi **geen SSL (certbot) en geen nginx op poort 443** meer te gebruiken. Cloudflare regelt HTTPS. Dat lost ook het **ERR_SSL_VERSION_OR_CIPHER_MISMATCH**-probleem op: nginx luistert niet meer op 443, dus er is geen verkeerde SSL-config meer die het verkeer kan “pakken”.

#### Stap 1: jbouquet.be aan de tunnel toevoegen

1. In Cloudflare: **Zero Trust** → **Networks** → **Tunnels** → jouw tunnel (bijv. `regenboog-pi`) → **Configure** / **Public Hostname**.
2. **Add a public hostname**:
   - **Subdomain:** leeg laten of `@` (voor het hoofddomein jbouquet.be).
   - **Domain:** `jbouquet.be`.
   - **Service type:** HTTP.
   - **URL:** `http://localhost:80` (als nginx voor jbouquet.be op poort 80 luistert) of de poort waar je hoofdsite draait.
3. Sla op.

Controleer in **DNS** dat er voor jbouquet.be (root) alleen een CNAME naar de tunnel staat (geen A-record meer naar je thuis-IP). Zo niet: verwijder het A-record; de tunnel zorgt voor het juiste record.

#### Stap 2: Nginx op de Pi alleen nog HTTP (geen SSL)

Alle HTTPS wordt door Cloudflare afgehandeld; de tunnel praat lokaal alleen HTTP met nginx.

**Op de Pi (SSH):**

1. Bekijk welke site-configs er zijn:
   ```bash
   ls -la /etc/nginx/sites-enabled/
   ```

2. Verwijder of pas alle configs aan die op **poort 443** luisteren (SSL). Je kunt de bestanden in `sites-available` laten staan maar de symlinks uit `sites-enabled` halen, of de bestanden aanpassen.

   **Alle SSL-serverblocks uitschakelen (aanbevolen):**
   ```bash
   # Verwijder alle sites uit sites-enabled (nginx stopt dan met luisteren op 80 en 443)
   sudo rm /etc/nginx/sites-enabled/*

   # Of: alleen de SSL-configs uitschakelen en een simpele HTTP-only config behouden voor jbouquet.be (zie hieronder).
   ```

3. **Als jbouquet.be nog door nginx op de Pi bediend moet worden** (via de tunnel), maak dan één eenvoudige **alleen-HTTP** config:

   ```bash
   sudo nano /etc/nginx/sites-available/jbouquet.be-http-only
   ```

   Inhoud (pas `root` en `server_name` aan naar jouw situatie):

   ```nginx
   server {
       listen 80;
       server_name jbouquet.be www.jbouquet.be;
       root /var/www/jbouquet.be;   # pas aan naar jouw document root
       index index.html;
       location / {
           try_files $uri $uri/ =404;
       }
       access_log /var/log/nginx/jbouquet_access.log;
       error_log /var/log/nginx/jbouquet_error.log;
   }
   ```

   Alleen deze config inschakelen (geen andere):

   ```bash
   sudo ln -sf /etc/nginx/sites-available/jbouquet.be-http-only /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Geen** `listen 443 ssl` meer in `sites-enabled`. Daarmee verdwijnt de cipher/SSL-fout voor regenboog.jbouquet.be.

#### Stap 3: Certbot niet meer gebruiken (optioneel)

Certificaten van Let’s Encrypt op de Pi zijn niet meer nodig; Cloudflare verzorgt SSL.

- **Certbot-timer uitschakelen** (verlenging stopt):
  ```bash
  sudo systemctl stop certbot.timer
  sudo systemctl disable certbot.timer
  ```
- **Certificaten verwijderen** (optioneel, alleen als je ze echt niet meer nodig hebt):
  ```bash
  sudo rm -rf /etc/letsencrypt/live/regenboog.jbouquet.be
  sudo rm -rf /etc/letsencrypt/archive/regenboog.jbouquet.be
  sudo rm -rf /etc/letsencrypt/renewal/regenboog.jbouquet.be.*
  # Idem voor jbouquet.be als je die ook via de tunnel doet.
  ```
- **Certbot zelf verwijderen** (optioneel):
  ```bash
  sudo apt-get remove --purge -y certbot python3-certbot-nginx
  ```

#### Stap 4: Port forwarding op de router (optioneel uitzetten)

Als **alle** verkeer voor jbouquet.be en regenboog.jbouquet.be via de tunnel loopt, kun je **poort 80 en 443** in de router **niet meer** naar de Pi doorsturen. Dan kan er van buitenaf geen verkeer meer op nginx/443 terechtkomen.

#### Controle

- **https://regenboog.jbouquet.be** → werkt via de tunnel (geen nginx, geen certbot).
- **https://jbouquet.be** → werkt via de tunnel naar nginx op localhost:80 (alleen HTTP op de Pi).
- Geen **ERR_SSL_VERSION_OR_CIPHER_MISMATCH** meer, omdat er op de Pi geen SSL meer op 443 wordt aangeboden.

---

### Optie 2: Alleen Cloudflare DNS + proxy (met port forwarding)

Je wilt wel Cloudflare (DNS, cache, DDoS-bescherming) maar blijft port forwarding gebruiken:

1. **Domein toevoegen aan Cloudflare** (zoals in Optie 1, stap 1) en nameservers bij je registrar aanpassen.
2. In Cloudflare: **DNS** → **Records**. Voeg een record toe:
   - Type: **A**
   - Name: `regenboog`
   - IPv4 address: **het publieke IP-adres van je thuisverbinding**
   - **Proxy status: Proxied (oranje wolk)** aan.
3. **Port forwarding** op je router blijft: 80 en 443 naar de Pi.
4. Op de Pi: nginx + Let’s Encrypt (certbot) zoals in [sectie 8 en 9](#8-nginx-configureren). In Cloudflare: **SSL/TLS** → **Overview** → kies bijv. **Full** of **Full (strict)** zodat Cloudflare met je Pi over HTTPS praat.

Hier verberg je wel je thuis-IP achter Cloudflare, maar je moet nog steeds poorten 80/443 open hebben.

---

### Samenvatting

- **Geen port forwarding meer, geen nginx/certbot voor regenboog nodig:** gebruik **Cloudflare Tunnel** (Optie 1).
- **Port forwarding behouden maar verkeer via Cloudflare:** gebruik **DNS + proxy** (Optie 2).

---

## Troubleshooting

### "Actieve bezoekers" blijft op 0 op de Pi

De teller **Actieve bezoekers** toont bezoekers van de **server waarop je de analytics-pagina opent**. Als je de analytics op je PC opent (bijv. `http://localhost:3000/analytics.html`), zie je alleen bezoekers van je lokale server, niet van de Pi.

- **Om bezoekers op de Pi te zien:** open de analytics-pagina **op het adres van de Pi**, bijvoorbeeld:
  - `https://regenboog.jbouquet.be/analytics.html`  
  - of `http://<IP-van-de-Pi>:3001/analytics.html` als je direct op de app gaat.
- **Controleren of tracking op de Pi aankomt:** zet op de Pi (in de projectmap) de omgevingsvariabele `LOG_ANALYTICS=1` en herstart de app zodat die variabele wordt gebruikt. Bijvoorbeeld:
  ```bash
  cd /home/pi/regenboog-game
  pm2 delete regenboog
  LOG_ANALYTICS=1 PORT=3001 pm2 start server/server.js --name regenboog
  pm2 save
  pm2 logs regenboog
  ```
  Open daarna vanaf een ander device (telefoon/PC) de site op de Pi (bijv. https://regenboog.jbouquet.be). Je zou in de logs regels moeten zien zoals `[track-visit] / ...` en `[track-visit-heartbeat] ...`. Zie je die niet, dan komen de verzoeken niet aan op de Pi (firewall, Nginx, of verkeerde URL). Zie je ze wel maar blijft de teller 0, controleer dan of de servertijd op de Pi klopt (`date`) en of de database schrijfbaar is (`data/scores.db`). Na het debuggen kun je `LOG_ANALYTICS` weglaten en de app opnieuw starten als je geen tracking-logs meer wilt.

---

## Hulp nodig?

- Check de logs: `pm2 logs` en `sudo tail -f /var/log/nginx/regenboog_error.log`
- Test individuele componenten (Node.js app, Nginx, SSL)
- Controleer firewall en poort forwarding instellingen

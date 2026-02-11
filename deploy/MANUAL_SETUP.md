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

## Hulp nodig?

- Check de logs: `pm2 logs` en `sudo tail -f /var/log/nginx/regenboog_error.log`
- Test individuele componenten (Node.js app, Nginx, SSL)
- Controleer firewall en poort forwarding instellingen

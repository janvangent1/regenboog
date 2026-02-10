# Regenboog – Volledige Setup Script voor Raspberry Pi

Dit script configureert automatisch alles wat nodig is om de Regenboog applicatie op een Raspberry Pi te draaien met nginx als reverse proxy en SSL certificaat.

## Wat doet het script?

Het script voert de volgende stappen automatisch uit:

1. **Node.js installeren** (als nog niet geïnstalleerd)
2. **Nginx installeren** (als nog niet geïnstalleerd)
3. **PM2 installeren** (voor process management en auto-start)
4. **Bestanden deployen** naar de Raspberry Pi
5. **SSL certificaat installeren** met Let's Encrypt (certbot)
6. **Nginx configureren** als reverse proxy voor `regenboog.jbouquet.be`
7. **App starten** met PM2 op een interne poort (bijv. 3001)

## Vereisten

### Op je Windows PC:
- Python 3.7+
- `paramiko` library: `pip install paramiko`

### Op de Raspberry Pi:
- SSH toegang (standaard op Raspberry Pi OS)
- Root/sudo toegang (voor nginx en certbot installatie)
- **DNS moet al geconfigureerd zijn**: `regenboog.jbouquet.be` moet naar het IP-adres van de Raspberry Pi wijzen

## DNS Configuratie (VOOR je het script draait!)

Zorg ervoor dat je DNS A-record al bestaat:

```
Type: A
Name: regenboog
Value: <IP-adres van je Raspberry Pi>
TTL: 3600
```

Dit moet je doen in je DNS provider (waar `jbouquet.be` geconfigureerd is).

## Gebruik

1. **Start het script:**
   ```bash
   python deploy/setup_regenboog_pi.py
   ```

2. **Vul de instellingen in:**
   - **SSH-instellingen:**
     - Host/IP: Bijv. `192.168.1.10` of `raspberrypi.local`
     - SSH-poort: Meestal `22`
     - Gebruiker: Meestal `pi`
     - Wachtwoord: Je SSH wachtwoord
     - SSH-sleutel (optioneel): Als je key-based auth gebruikt
   
   - **App-instellingen:**
     - App-poort: Interne poort waar de Node.js app draait (bijv. `3001`)
     - Remote map: Waar de app op de Pi komt te staan (bijv. `/home/pi/regenboog-game`)
   
   - **Domain-instellingen:**
     - Subdomein: `regenboog.jbouquet.be`
     - Email: Je email adres (vereist voor Let's Encrypt)

3. **Klik op "Volledige Setup Uitvoeren"**

4. **Wacht tot alles klaar is** - het script toont voortgang in het log venster

5. **Na voltooiing:** Je applicatie is beschikbaar op `https://regenboog.jbouquet.be`

## Troubleshooting

### SSL certificaat installatie mislukt
Als certbot faalt (bijv. omdat DNS nog niet actief is), kun je later handmatig SSL installeren:

```bash
ssh pi@raspberrypi.local
sudo certbot --nginx -d regenboog.jbouquet.be
```

### Nginx configuratie alleen aanpassen
Als je alleen de nginx configuratie wilt aanpassen (bijv. na SSL installatie), gebruik dan de knop **"Alleen Nginx Configureren"**.

### App opnieuw starten
Na code wijzigingen:

```bash
ssh pi@raspberrypi.local
cd /home/pi/regenboog-game
pm2 restart regenboog
```

Of gebruik het bestaande `deploy_regenboog.py` script om alleen de bestanden te deployen.

### Logs bekijken
- **App logs:** `pm2 logs regenboog`
- **Nginx logs:** 
  - Access: `sudo tail -f /var/log/nginx/regenboog_access.log`
  - Error: `sudo tail -f /var/log/nginx/regenboog_error.log`

## Architectuur

```
Internet
   ↓
regenboog.jbouquet.be (DNS → Raspberry Pi IP)
   ↓
Nginx (poort 443 HTTPS, poort 80 HTTP → redirect naar HTTPS)
   ↓
Node.js app (poort 3001, alleen lokaal toegankelijk)
```

De Node.js app draait alleen lokaal op de Pi (localhost:3001). Nginx fungeert als reverse proxy en zorgt voor SSL/TLS encryptie.

## PM2 Commands

- **Status bekijken:** `pm2 status`
- **Logs bekijken:** `pm2 logs regenboog`
- **App herstarten:** `pm2 restart regenboog`
- **App stoppen:** `pm2 stop regenboog`
- **App starten:** `pm2 start regenboog`
- **PM2 configuratie opslaan:** `pm2 save` (voor auto-start na reboot)

## Auto-start na reboot

PM2 wordt automatisch geconfigureerd om de app te starten na een reboot. Als dit niet werkt:

```bash
pm2 startup systemd -u pi --hp /home/pi
pm2 save
```

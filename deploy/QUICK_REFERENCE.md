# Regenboog Setup - Snelle Referentie

## Essentiële Commando's

### SSH Verbinding
```bash
ssh pi@<IP-ADRES>
```

### Node.js Installeren
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Nginx Installeren
```bash
sudo apt-get update && sudo apt-get install -y nginx
sudo systemctl enable nginx && sudo systemctl start nginx
```

### PM2 Installeren
```bash
sudo npm install -g pm2
pm2 startup systemd -u pi --hp /home/pi
# Voer het getoonde commando uit met sudo
```

### Bestanden Kopiëren (van Windows PC)
```bash
scp -r server public scripts package.json package-lock.json pi@<IP>:/home/pi/regenboog-game
```

### App Starten
```bash
cd /home/pi/regenboog-game
npm install
PORT=3001 pm2 start server/server.js --name regenboog
pm2 save
```

### Nginx Configureren
```bash
sudo nano /etc/nginx/sites-available/regenboog.jbouquet.be
# Plak configuratie (zie MANUAL_SETUP.md)
sudo ln -s /etc/nginx/sites-available/regenboog.jbouquet.be /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### SSL Certificaat
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d regenboog.jbouquet.be
```

## Handige Commando's

### PM2
```bash
pm2 status              # Status
pm2 logs regenboog      # Logs
pm2 restart regenboog   # Herstarten
pm2 stop regenboog      # Stoppen
```

### Nginx
```bash
sudo nginx -t           # Test config
sudo systemctl reload nginx
sudo tail -f /var/log/nginx/regenboog_error.log
```

### Troubleshooting
```bash
# App testen
curl http://localhost:3001

# Poort checken
sudo netstat -tulpn | grep 3001

# DNS checken
nslookup regenboog.jbouquet.be
```

## Checklist

- [ ] DNS A-record voor `regenboog.jbouquet.be` wijst naar Pi IP
- [ ] Node.js geïnstalleerd (`node -v`)
- [ ] Nginx geïnstalleerd en draait
- [ ] PM2 geïnstalleerd en geconfigureerd
- [ ] Bestanden gekopieerd naar `/home/pi/regenboog-game`
- [ ] `npm install` uitgevoerd
- [ ] App gestart met PM2 op poort 3001
- [ ] Nginx configuratie aangemaakt en geactiveerd
- [ ] SSL certificaat geïnstalleerd
- [ ] `https://regenboog.jbouquet.be` werkt

Zie `MANUAL_SETUP.md` voor gedetailleerde instructies.

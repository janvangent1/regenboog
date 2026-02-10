# Regenboog – Deploy naar Raspberry Pi

GUI om de Regenboog-spellen via SSH op een Raspberry Pi te installeren en te starten.

## Vereisten

- Python 3.7+
- Op de Pi: SSH toegang (standaard op Raspberry Pi OS)

## Installatie (op je PC)

```bash
# Optioneel: venv
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/macOS

pip install -r deploy/requirements.txt
```

## Gebruik

```bash
# Vanuit de projectmap
python deploy/deploy_regenboog.py
```

1. **SSH**: Vul host in (bijv. `192.168.1.10` of `raspberrypi.local`), gebruiker (bijv. `pi`), wachtwoord of kies een SSH-sleutel.
2. **App-poort**: Kies een poort zoals `3000` (nginx gebruikt al 80 en 443).
3. **Alleen software installeren**: Installeert Node.js op de Pi als dat nog niet aanwezig is.
4. **Deploy + start app**: Kopieert alle bestanden (zonder `node_modules`), voert `npm install` uit op de Pi en start de app met `PORT=<jouw poort>`.

Daarna open je in de browser: **http://\<ip-van-de-pi\>:3000** (of de gekozen poort).

## nginx als reverse proxy (optioneel)

Als je de app achter nginx op poort 80/443 wilt aanbieden, voeg in nginx bijvoorbeeld toe:

```nginx
location /regenboog {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Start de app dan op de Pi met poort 3000 (via deze tool) en herlaad nginx.

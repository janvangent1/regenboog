const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
const { registerRoutes } = require('./routes');
const { attachSockets } = require('./sockets');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.use(cors());
app.use(express.json());
// Trust proxy to get correct IP addresses
app.set('trust proxy', true);

initDatabase();

// Register API routes BEFORE static files
registerRoutes(app);

app.use(express.static(publicDir));

app.get('/games/:game', (req, res) => {
  res.sendFile(path.join(publicDir, 'games', `${req.params.game}.html`));
});

attachSockets(server);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Fout: Poort ${PORT} is al in gebruik. Stop het andere proces of kies een andere poort (bijv. PORT=3001).`);
  } else {
    console.error('Serverfout:', err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Regenboog Spellen draait op http://localhost:${PORT}`);
});

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
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

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

const scoreLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Te veel score-inzendingen. Probeer het later opnieuw.' },
});

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Te veel admin-verzoeken.' },
});

app.use('/api', generalLimiter);
app.use('/api/score', scoreLimiter);
app.use('/api/track-visit', analyticsLimiter);
app.use('/api/track-visit-end', analyticsLimiter);
app.use('/api/track-visit-heartbeat', analyticsLimiter);
app.use('/api/admin', adminLimiter);

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

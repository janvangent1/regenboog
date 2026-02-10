const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
const { registerRoutes } = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.use(cors());
app.use(express.json());

initDatabase();
registerRoutes(app);

app.use(express.static(publicDir));

app.get('/games/:game', (req, res) => {
  res.sendFile(path.join(publicDir, 'games', `${req.params.game}.html`));
});

app.listen(PORT, () => {
  console.log(`Regenboog Spellen draait op http://localhost:${PORT}`);
});

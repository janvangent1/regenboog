const { getLeaderboard, submitScore, getAllLeaderboards, getPlayStatistics, deleteScoresByGame, getAllScores } = require('./database');

function registerRoutes(app) {
  app.get('/api/leaderboard/:class', (req, res) => {
    const className = req.params.class;
    getLeaderboard(className)
      .then((rows) => res.json(rows))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: 'Kon leaderboard niet laden' });
      });
  });

  app.post('/api/score', (req, res) => {
    const { class_name, player_name, student_class, score } = req.body;
    if (!class_name || player_name == null || score == null) {
      return res.status(400).json({ error: 'class_name, player_name en score zijn verplicht' });
    }
    const parsedScore = parseInt(score, 10);
    if (!Number.isFinite(parsedScore) || parsedScore < 0) {
      return res.status(400).json({ error: 'Score moet een getal groter dan of gelijk aan 0 zijn' });
    }
    const safeName = String(player_name).trim().slice(0, 50);
    if (!safeName) {
      return res.status(400).json({ error: 'Voer een naam in' });
    }
    const safeClass = student_class ? String(student_class).trim().slice(0, 50) : null;
    submitScore(class_name, safeName, safeClass, parsedScore)
      .then((result) => res.json(result))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: 'Score kon niet worden opgeslagen' });
      });
  });

  // Admin routes - password protected
  const ADMIN_PASSWORD = 'jeroom';
  
  function checkAdminPassword(req, res, next) {
    const provided = req.headers['x-admin-password'] || req.body.password || req.query.password;
    if (provided === ADMIN_PASSWORD) {
      next();
    } else {
      res.status(401).json({ error: 'Ongeldig wachtwoord' });
    }
  }

  app.get('/api/admin/stats', checkAdminPassword, (req, res) => {
    getPlayStatistics()
      .then((stats) => res.json(stats))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: 'Kon statistieken niet laden' });
      });
  });

  app.get('/api/admin/all-scores', checkAdminPassword, (req, res) => {
    getAllScores(500)
      .then((scores) => res.json(scores))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: 'Kon scores niet laden' });
      });
  });

  app.get('/api/admin/leaderboards', checkAdminPassword, (req, res) => {
    Promise.all([
      getAllLeaderboards(),
      getAllScores(1000)
    ])
      .then(([counts, scores]) => {
        const byGame = {};
        scores.forEach(score => {
          if (!byGame[score.class_name]) {
            byGame[score.class_name] = [];
          }
          byGame[score.class_name].push(score);
        });
        Object.keys(byGame).forEach(game => {
          byGame[game].sort((a, b) => b.score - a.score);
        });
        res.json({ counts, leaderboards: byGame });
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: 'Kon ranglijsten niet laden' });
      });
  });

  app.delete('/api/admin/scores/:game', checkAdminPassword, (req, res) => {
    const game = req.params.game;
    deleteScoresByGame(game)
      .then((result) => res.json(result))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: 'Kon scores niet verwijderen' });
      });
  });
}

module.exports = { registerRoutes };

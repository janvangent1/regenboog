const { getLeaderboard, submitScore, getAllLeaderboards, getPlayStatistics, deleteScoresByGame, getAllScores, trackVisit, endVisit, pingVisit, getAnalytics, getActiveVisitors, getClassRankings } = require('./database');

function registerRoutes(app) {
  // Import vlinders words module inside function to prevent blocking other routes
  let getWordsForRound, prepareWords;
  try {
    const vlindersWords = require('./vlinders_words');
    getWordsForRound = vlindersWords.getWordsForRound;
    prepareWords = vlindersWords.prepareWords;
  } catch (err) {
    console.error('Error loading vlinders_words module:', err);
  }
  app.get('/api/leaderboard/:class', (req, res) => {
    const className = req.params.class;
    getLeaderboard(className)
      .then((rows) => res.json(rows))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: 'Kon leaderboard niet laden' });
      });
  });

  app.get('/api/class-rankings', (req, res) => {
    getClassRankings()
      .then((data) => res.json(data))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: 'Kon klas rankings niet laden' });
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

  // Analytics tracking routes (public)
  app.post('/api/track-visit', (req, res) => {
    const { visitor_id, page, user_agent, referrer } = req.body;
    if (!visitor_id || !page) {
      return res.status(400).json({ error: 'visitor_id en page zijn verplicht' });
    }
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    trackVisit(visitor_id, page, user_agent, referrer, ipAddress)
      .then((result) => res.json(result))
      .catch((err) => {
        console.error('Error tracking visit:', err);
        res.status(500).json({ error: 'Kon bezoek niet tracken' });
      });
  });

  app.post('/api/track-visit-end', (req, res) => {
    const { visitor_id, page, duration } = req.body;
    if (!visitor_id || !page || duration == null) {
      return res.status(400).json({ error: 'visitor_id, page en duration zijn verplicht' });
    }
    endVisit(visitor_id, page, parseInt(duration, 10))
      .then((result) => res.json(result))
      .catch((err) => {
        console.error('Error ending visit:', err);
        res.status(500).json({ error: 'Kon bezoek niet beëindigen' });
      });
  });

  app.post('/api/track-visit-heartbeat', (req, res) => {
    const { visitor_id, page } = req.body;
    if (!visitor_id || !page) {
      return res.status(400).json({ error: 'visitor_id en page zijn verplicht' });
    }
    pingVisit(visitor_id, page)
      .then((result) => res.json(result))
      .catch((err) => {
        console.error('Error heartbeat visit:', err);
        res.status(500).json({ error: 'Kon bezoek status niet updaten' });
      });
  });


  // Vlinders game - get 3 words for round
  app.get('/api/vlinders/word/:round', (req, res) => {
    if (!getWordsForRound || !prepareWords) {
      return res.status(500).json({ error: 'Vlinders words module niet geladen' });
    }
    
    const round = parseInt(req.params.round, 10);
    if (!round || round < 1 || round > 3) {
      return res.status(400).json({ error: 'Round moet 1, 2 of 3 zijn' });
    }
    
    try {
      const words = getWordsForRound(round);
      if (!words || words.length === 0) {
        return res.status(500).json({ error: `Geen dieren gevonden voor ronde ${round}` });
      }
      const prepared = prepareWords(words, round);
      if (!prepared || prepared.length === 0) {
        return res.status(500).json({ error: 'Fout bij voorbereiden van letters' });
      }
      res.json({ words: prepared });
    } catch (err) {
      console.error('Error getting words:', err);
      res.status(500).json({ error: 'Kon dieren niet ophalen: ' + err.message });
    }
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

  app.get('/api/admin/analytics', checkAdminPassword, (req, res) => {
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    getAnalytics(startDate, endDate)
      .then((analytics) => res.json(analytics))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: 'Kon analytics niet laden' });
      });
  });

  app.get('/api/admin/active-visitors', checkAdminPassword, (req, res) => {
    getActiveVisitors()
      .then((active) => res.json(active))
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: 'Kon actieve bezoekers niet laden' });
      });
  });
}

module.exports = { registerRoutes };

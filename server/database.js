const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'scores.db');

function getDb() {
  return new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database open error:', err);
  });
}

function initDatabase() {
  const db = getDb();
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_name TEXT NOT NULL,
        player_name TEXT NOT NULL,
        student_class TEXT,
        score INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add student_class column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE scores ADD COLUMN student_class TEXT`, (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding student_class column:', err);
      }
    });
    
    // Create visits table for analytics
    db.run(`
      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id TEXT NOT NULL,
        page TEXT NOT NULL,
        user_agent TEXT,
        referrer TEXT,
        visit_start DATETIME NOT NULL,
        last_seen DATETIME,
        visit_end DATETIME,
        duration INTEGER,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add last_seen column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE visits ADD COLUMN last_seen DATETIME`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding last_seen column:', err);
      }
    });
    
    // Create indexes for better query performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_visits_visitor_id ON visits(visitor_id)`, (err) => {
      if (err && !err.message.includes('duplicate')) console.error('Error creating index:', err);
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_visits_visit_start ON visits(visit_start)`, (err) => {
      if (err && !err.message.includes('duplicate')) console.error('Error creating index:', err);
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_visits_page ON visits(page)`, (err) => {
      if (err && !err.message.includes('duplicate')) console.error('Error creating index:', err);
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_visits_last_seen ON visits(last_seen)`, (err) => {
      if (err && !err.message.includes('duplicate')) console.error('Error creating index:', err);
    });
  });
  db.close();
}

function getLeaderboard(class_name, limit = 10) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      'SELECT id, class_name, player_name, student_class, score, created_at FROM scores WHERE class_name = ? ORDER BY score DESC, created_at ASC LIMIT ?',
      [class_name, limit],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function submitScore(class_name, player_name, student_class, score) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(
      'INSERT INTO scores (class_name, player_name, student_class, score) VALUES (?, ?, ?, ?)',
      [class_name, player_name, student_class || null, score],
      function (err) {
        db.close();
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

function getAllLeaderboards() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      'SELECT class_name, COUNT(*) as count FROM scores GROUP BY class_name ORDER BY class_name',
      [],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getPlayStatistics() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      `SELECT 
        class_name,
        COUNT(*) as play_count,
        MIN(created_at) as first_play,
        MAX(created_at) as last_play,
        GROUP_CONCAT(created_at, '|') as all_times
      FROM scores 
      GROUP BY class_name 
      ORDER BY class_name`,
      [],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else {
          const stats = rows.map(row => ({
            game: row.class_name,
            count: row.play_count,
            firstPlay: row.first_play,
            lastPlay: row.last_play,
            times: row.all_times ? row.all_times.split('|') : []
          }));
          resolve(stats);
        }
      }
    );
  });
}

function deleteScoresByGame(class_name) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(
      'DELETE FROM scores WHERE class_name = ?',
      [class_name],
      function (err) {
        db.close();
        if (err) reject(err);
        else resolve({ deleted: this.changes });
      }
    );
  });
}

function getAllScores(limit = 100) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      'SELECT id, class_name, player_name, student_class, score, created_at FROM scores ORDER BY created_at DESC LIMIT ?',
      [limit],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

// Analytics functions
function trackVisit(visitorId, page, userAgent, referrer, ipAddress) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO visits (visitor_id, page, user_agent, referrer, visit_start, last_seen, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [visitorId, page, userAgent || null, referrer || null, now, now, ipAddress || null],
      function (err) {
        db.close();
        if (err) reject(err);
        else resolve({ id: this.lastID, visitStart: now });
      }
    );
  });
}

function endVisit(visitorId, page, duration) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const now = new Date().toISOString();
    // SQLite doesn't support ORDER BY/LIMIT in UPDATE, so we use a subquery
    db.run(
      `UPDATE visits 
       SET visit_end = ?, duration = ?, last_seen = ? 
       WHERE id = (
         SELECT id FROM visits 
         WHERE visitor_id = ? AND page = ? AND visit_end IS NULL 
         ORDER BY visit_start DESC 
         LIMIT 1
       )`,
      [now, duration, now, visitorId, page],
      function (err) {
        db.close();
        if (err) reject(err);
        else resolve({ updated: this.changes });
      }
    );
  });
}

function pingVisit(visitorId, page) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const now = new Date().toISOString();
    db.run(
      `UPDATE visits
       SET last_seen = ?
       WHERE id = (
         SELECT id FROM visits
         WHERE visitor_id = ? AND page = ? AND visit_end IS NULL
         ORDER BY visit_start DESC
         LIMIT 1
       )`,
      [now, visitorId, page],
      function (err) {
        db.close();
        if (err) reject(err);
        else resolve({ updated: this.changes, lastSeen: now });
      }
    );
  });
}

function getActiveVisitors(activeWindowSeconds = 90) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const cutoff = new Date(Date.now() - (activeWindowSeconds * 1000)).toISOString();
    db.get(
      `SELECT COUNT(DISTINCT visitor_id) as active_visitors
       FROM visits
       WHERE visit_end IS NULL
         AND COALESCE(last_seen, visit_start) >= ?`,
      [cutoff],
      (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve({
          currentVisitors: row.active_visitors || 0,
          activeWindowSeconds: activeWindowSeconds
        });
      }
    );
  });
}

function getAnalytics(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();
    
    Promise.all([
      getVisitorStats(start, end),
      getPageViews(start, end),
      getVisitDurations(start, end),
      getPeakHours(start, end),
      getReturnVisitors(start, end),
      getDeviceStats(start, end),
      getVisitorsOverTime(start, end),
      getActiveVisitors()
    ])
      .then(([visitorStats, pageViews, durations, peakHours, returnVisitors, deviceStats, visitorsOverTime, activeVisitors]) => {
        resolve({
          visitorStats,
          pageViews,
          durations,
          peakHours,
          returnVisitors,
          deviceStats,
          visitorsOverTime,
          activeVisitors
        });
      })
      .catch(reject);
  });
}

function getVisitorStats(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get(
      `SELECT 
        COUNT(DISTINCT visitor_id) as unique_visitors,
        COUNT(*) as total_visits
      FROM visits 
      WHERE visit_start >= ? AND visit_start <= ?`,
      [startDate, endDate],
      (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve({
          uniqueVisitors: row.unique_visitors || 0,
          totalVisits: row.total_visits || 0
        });
      }
    );
  });
}

function getPageViews(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      `SELECT 
        page,
        COUNT(*) as views
      FROM visits 
      WHERE visit_start >= ? AND visit_start <= ?
      GROUP BY page
      ORDER BY views DESC
      LIMIT 20`,
      [startDate, endDate],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows.map(r => ({ page: r.page, views: r.views })));
      }
    );
  });
}

function getVisitDurations(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      `SELECT 
        duration
      FROM visits 
      WHERE visit_start >= ? AND visit_start <= ? AND duration IS NOT NULL AND duration > 0`,
      [startDate, endDate],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else {
          const durations = rows.map(r => r.duration);
          const avgDuration = durations.length > 0 
            ? durations.reduce((a, b) => a + b, 0) / durations.length 
            : 0;
          
          // Create duration distribution buckets
          const buckets = {
            '0-10': 0,
            '11-30': 0,
            '31-60': 0,
            '61-120': 0,
            '121-300': 0,
            '301+': 0
          };
          
          durations.forEach(d => {
            if (d <= 10) buckets['0-10']++;
            else if (d <= 30) buckets['11-30']++;
            else if (d <= 60) buckets['31-60']++;
            else if (d <= 120) buckets['61-120']++;
            else if (d <= 300) buckets['121-300']++;
            else buckets['301+']++;
          });
          
          resolve({
            average: Math.round(avgDuration),
            distribution: buckets,
            total: durations.length
          });
        }
      }
    );
  });
}

function getPeakHours(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      `SELECT 
        CAST(strftime('%H', visit_start) AS INTEGER) as hour,
        COUNT(*) as visits
      FROM visits 
      WHERE visit_start >= ? AND visit_start <= ?
      GROUP BY hour
      ORDER BY hour`,
      [startDate, endDate],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else {
          // Initialize all hours with 0
          const hours = {};
          for (let i = 0; i < 24; i++) {
            hours[i] = 0;
          }
          rows.forEach(r => {
            hours[r.hour] = r.visits;
          });
          resolve(hours);
        }
      }
    );
  });
}

function getReturnVisitors(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      `SELECT 
        visitor_id,
        COUNT(*) as visit_count
      FROM visits 
      WHERE visit_start >= ? AND visit_start <= ?
      GROUP BY visitor_id`,
      [startDate, endDate],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else {
          const newVisitors = rows.filter(r => r.visit_count === 1).length;
          const returnVisitors = rows.filter(r => r.visit_count > 1).length;
          const total = rows.length;
          
          resolve({
            newVisitors,
            returnVisitors,
            total,
            returnRate: total > 0 ? Math.round((returnVisitors / total) * 100) : 0
          });
        }
      }
    );
  });
}

function getDeviceStats(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      `SELECT 
        user_agent
      FROM visits 
      WHERE visit_start >= ? AND visit_start <= ? AND user_agent IS NOT NULL`,
      [startDate, endDate],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else {
          const devices = { mobile: 0, tablet: 0, desktop: 0, unknown: 0 };
          const browsers = {};
          
          rows.forEach(row => {
            const ua = (row.user_agent || '').toLowerCase();
            
            // Device detection
            if (ua.match(/mobile|android|iphone|ipod/)) {
              devices.mobile++;
            } else if (ua.match(/tablet|ipad/)) {
              devices.tablet++;
            } else if (ua.match(/windows|macintosh|linux|ubuntu/)) {
              devices.desktop++;
            } else {
              devices.unknown++;
            }
            
            // Browser detection
            let browser = 'unknown';
            if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
            else if (ua.includes('firefox')) browser = 'Firefox';
            else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
            else if (ua.includes('edg')) browser = 'Edge';
            else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';
            
            browsers[browser] = (browsers[browser] || 0) + 1;
          });
          
          resolve({ devices, browsers });
        }
      }
    );
  });
}

function getVisitorsOverTime(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      `SELECT 
        DATE(visit_start) as date,
        COUNT(DISTINCT visitor_id) as unique_visitors,
        COUNT(*) as total_visits
      FROM visits 
      WHERE visit_start >= ? AND visit_start <= ?
      GROUP BY DATE(visit_start)
      ORDER BY date`,
      [startDate, endDate],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows.map(r => ({
          date: r.date,
          uniqueVisitors: r.unique_visitors,
          totalVisits: r.total_visits
        })));
      }
    );
  });
}

function getClassRankings() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    // First, get all unique games
    db.all(
      'SELECT DISTINCT class_name FROM scores WHERE student_class IS NOT NULL',
      [],
      (err, games) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        if (games.length === 0) {
          db.close();
          return resolve({ rankings: [], details: {} });
        }
        
        // For each game, get the best score per class
        const gamePromises = games.map(game => {
          return new Promise((resolveGame, rejectGame) => {
            db.all(
              `SELECT 
                student_class,
                MAX(score) as best_score
              FROM scores 
              WHERE class_name = ? AND student_class IS NOT NULL
              GROUP BY student_class
              ORDER BY best_score DESC, student_class ASC`,
              [game.class_name],
              (err, rows) => {
                if (err) rejectGame(err);
                else resolveGame({
                  game: game.class_name,
                  classScores: rows.map(r => ({
                    class: r.student_class,
                    score: r.best_score
                  }))
                });
              }
            );
          });
        });
        
        Promise.all(gamePromises)
          .then(gameResults => {
            db.close();
            
            // Calculate points per game (1st = 5, 2nd = 3, 3rd = 1)
            const classPoints = {};
            const gameDetails = {};
            
            gameResults.forEach(gameResult => {
              const { game, classScores } = gameResult;
              gameDetails[game] = [];
              
              // Process all classes, assign points only to top 3
              classScores.forEach((classScore, index) => {
                const position = index + 1;
                const points = index === 0 ? 5 : (index === 1 ? 3 : (index === 2 ? 1 : 0));
                const className = classScore.class;
                
                if (!classPoints[className]) {
                  classPoints[className] = 0;
                }
                classPoints[className] += points;
                
                gameDetails[game].push({
                  class: className,
                  score: classScore.score,
                  position: position,
                  points: points
                });
              });
            });
            
            // Create ranking array
            const rankings = Object.keys(classPoints)
              .map(className => ({
                class: className,
                totalPoints: classPoints[className]
              }))
              .sort((a, b) => b.totalPoints - a.totalPoints)
              .map((item, index) => ({
                ...item,
                rank: index + 1
              }));
            
            resolve({
              rankings: rankings,
              details: gameDetails
            });
          })
          .catch(err => {
            db.close();
            reject(err);
          });
      }
    );
  });
}

module.exports = { 
  initDatabase, 
  getLeaderboard, 
  submitScore,
  getAllLeaderboards,
  getPlayStatistics,
  deleteScoresByGame,
  getAllScores,
  trackVisit,
  endVisit,
  pingVisit,
  getAnalytics,
  getActiveVisitors,
  getVisitorStats,
  getPageViews,
  getVisitDurations,
  getPeakHours,
  getReturnVisitors,
  getDeviceStats,
  getVisitorsOverTime,
  getClassRankings
};

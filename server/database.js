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

module.exports = { 
  initDatabase, 
  getLeaderboard, 
  submitScore,
  getAllLeaderboards,
  getPlayStatistics,
  deleteScoresByGame,
  getAllScores
};

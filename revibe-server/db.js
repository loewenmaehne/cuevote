const Database = require('better-sqlite3');
const db = new Database('revibe.db'); // Creates the file if missing

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- Google 'sub' ID
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    role TEXT DEFAULT 'user', -- 'admin', 'mod', 'user'
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

module.exports = {
  getUser: (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  getUserByEmail: (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email),
  upsertUser: (user) => {
    const stmt = db.prepare(`
      INSERT INTO users (id, email, name, picture)
      VALUES (@id, @email, @name, @picture)
      ON CONFLICT(id) DO UPDATE SET
        name = @name,
        picture = @picture
    `);
    stmt.run(user);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  },
  createSession: (token, userId, expiresAt) => {
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  },
  getSession: (token) => {
    return db.prepare(`
        SELECT s.*, u.name, u.email, u.picture, u.role 
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > ?
    `).get(token, Math.floor(Date.now() / 1000));
  },
  deleteSession: (token) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
};

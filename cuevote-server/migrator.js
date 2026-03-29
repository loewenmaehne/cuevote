const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_version ORDER BY version').all().map(r => r.version)
  );

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10);
    if (isNaN(version)) {
      logger.warn(`[Migrator] Skipping file with invalid name: ${file}`);
      continue;
    }
    if (applied.has(version)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    logger.info(`[Migrator] Applying migration ${version}: ${file}`);

    const migrate = db.transaction(() => {
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        db.exec(stmt);
      }
      db.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)').run(version, file);
    });

    try {
      migrate();
      logger.info(`[Migrator] Migration ${version} applied successfully.`);
    } catch (err) {
      logger.error(`[Migrator] Migration ${version} FAILED: ${err.message}`);
      throw err;
    }
  }

  const latest = db.prepare('SELECT MAX(version) as v FROM schema_version').get();
  logger.info(`[Migrator] Schema is at version ${latest?.v ?? 0}.`);
}

module.exports = { runMigrations };

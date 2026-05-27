// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
const fs = require('fs');
const path = require('path');
const db = require('./db');
const logger = require('./logger');

// GDPR: Backups contain personal data (users table: email, name, picture). Old backups
// are pruned after KEEP_BACKUPS_DAYS so deleted users' data is not retained indefinitely.
const BACKUP_DIR = path.join(__dirname, 'backups');
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const KEEP_BACKUPS_DAYS = 7;

// Ensure backup directory exists and is owner-only (no world/group read).
// Backups contain users, sessions (tokens in plaintext), and bcrypt hashes,
// so any process running as a different user should not be able to slurp them.
if (!fs.existsSync(BACKUP_DIR)) {
	fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
try {
	fs.chmodSync(BACKUP_DIR, 0o700);
} catch (e) {
	logger.warn('[Backup] Could not chmod backup dir to 0700:', e.message);
}

async function runBackup() {
	logger.info('[Backup] Starting database backup...');
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const filename = `backup-${timestamp}.db`;
	const destination = path.join(BACKUP_DIR, filename);

	try {
		await db.backup(destination);
		// Tighten permissions immediately. Default umask leaves backups
		// world-readable on shared hosting, which would expose every
		// active session token in the DB snapshot.
		try {
			fs.chmodSync(destination, 0o600);
		} catch (e) {
			logger.warn(`[Backup] Could not chmod ${filename} to 0600:`, e.message);
		}
		logger.info(`[Backup] detailed success: ${destination}`);

		// Prune old backups
		pruneBackups();
	} catch (error) {
		logger.error('[Backup] Failed:', error);
	}
}

function pruneBackups() {
	logger.info('[Backup] Pruning old backups...');
	try {
		const files = fs.readdirSync(BACKUP_DIR);
		const now = Date.now();
		const maxAge = KEEP_BACKUPS_DAYS * 24 * 60 * 60 * 1000;

		files.forEach(file => {
			const filePath = path.join(BACKUP_DIR, file);
			const stats = fs.statSync(filePath);
			if (now - stats.mtimeMs > maxAge) {
				logger.info(`[Backup] Deleting old backup: ${file}`);
				fs.unlinkSync(filePath);
			}
		});
	} catch (error) {
		logger.error('[Backup] Prune failed:', error);
	}
}

function start() {
	logger.info(`[Backup] Scheduler started. Interval: ${BACKUP_INTERVAL / 3600000} hours. Retention: ${KEEP_BACKUPS_DAYS} days.`);

	// Run one immediately on startup (optional, maybe wait?)
	// Let's run one immediately to be safe, or maybe after a small delay to not block startup
	setTimeout(runBackup, 10000); // 10 seconds after startup

	// Schedule periodic
	setInterval(runBackup, BACKUP_INTERVAL);
}

module.exports = {
	start,
	runBackup
};

const fs = require('fs');
const path = require('path');
const db = require('./db');

const BACKUP_DIR = path.join(__dirname, 'backups');
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const KEEP_BACKUPS_DAYS = 7;

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
	fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function runBackup() {
	console.log('[Backup] Starting database backup...');
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const filename = `backup-${timestamp}.db`;
	const destination = path.join(BACKUP_DIR, filename);

	try {
		await db.backup(destination);
		console.log(`[Backup] detailed success: ${destination}`);

		// Prune old backups
		pruneBackups();
	} catch (error) {
		console.error('[Backup] Failed:', error);
	}
}

function pruneBackups() {
	console.log('[Backup] Pruning old backups...');
	try {
		const files = fs.readdirSync(BACKUP_DIR);
		const now = Date.now();
		const maxAge = KEEP_BACKUPS_DAYS * 24 * 60 * 60 * 1000;

		files.forEach(file => {
			const filePath = path.join(BACKUP_DIR, file);
			const stats = fs.statSync(filePath);
			if (now - stats.mtimeMs > maxAge) {
				console.log(`[Backup] Deleting old backup: ${file}`);
				fs.unlinkSync(filePath);
			}
		});
	} catch (error) {
		console.error('[Backup] Prune failed:', error);
	}
}

function start() {
	console.log(`[Backup] Scheduler started. Interval: ${BACKUP_INTERVAL / 3600000} hours. Retention: ${KEEP_BACKUPS_DAYS} days.`);

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

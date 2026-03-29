// Async DB wrapper — offloads heavy/periodic write operations to a worker thread.
// All methods are fire-and-forget; the worker handles errors internally.
// The main thread's synchronous db.js is still used for reads and critical writes.
const { Worker } = require('worker_threads');
const path = require('path');
const logger = require('./logger');

let worker = null;

function ensureWorker() {
  if (worker) return worker;

  worker = new Worker(path.join(__dirname, 'db-worker.js'));

  worker.on('error', (err) => {
    logger.error('[DB Async] Worker error:', err.message);
    worker = null;
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      logger.warn(`[DB Async] Worker exited with code ${code}. Will restart on next operation.`);
    }
    worker = null;
  });

  logger.info('[DB Async] Worker thread started.');
  return worker;
}

function post(msg) {
  try {
    ensureWorker().postMessage(msg);
  } catch (err) {
    logger.error(`[DB Async] Failed to post ${msg.op}:`, err.message);
  }
}

module.exports = {
  addToRoomHistory: (roomId, track) => {
    post({ op: 'addToRoomHistory', roomId, track });
  },

  saveRoomStateAndActivity: (roomId, state) => {
    post({ op: 'saveRoomStateAndActivity', roomId, state });
  },

  saveRoomState: (roomId, state) => {
    post({ op: 'saveRoomState', roomId, state });
  },

  runDailyCleanup: () => {
    post({ op: 'runDailyCleanup' });
  },

  shutdown: () => {
    if (worker) {
      try { worker.postMessage({ op: 'shutdown' }); } catch (e) { /* ignore */ }
      worker = null;
    }
  }
};

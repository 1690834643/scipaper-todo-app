const fs = require('fs');
const { ARTICLES_DIRECTORY, DATABASE_PATH, THESES_DIRECTORY } = require('./schema.cjs');
const { normalizeStoredDatabase } = require('./normalize.cjs');

let databaseCache = null;

function cloneDatabase(data) {
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
}

function getDatabaseMtimeMs() {
  try {
    return fs.statSync(DATABASE_PATH).mtimeMs;
  } catch {
    return -1;
  }
}

function setDatabaseCache(data) {
  databaseCache = {
    mtimeMs: getDatabaseMtimeMs(),
    data: cloneDatabase(data),
  };
}

function clearDatabaseCache() {
  databaseCache = null;
}

function ensureStore() {
  fs.mkdirSync(ARTICLES_DIRECTORY, { recursive: true });
  fs.mkdirSync(THESES_DIRECTORY, { recursive: true });

  if (!fs.existsSync(DATABASE_PATH)) {
    fs.writeFileSync(
      DATABASE_PATH,
      JSON.stringify({
        version: 1,
        articles: [],
        theses: [],
        writingStreak: {
          currentStreak: 0,
          longestStreak: 0,
          lastWriteDate: null,
          totalWritingDays: 0,
          todayWords: 0,
        dailyGoal: 500,
        streakHistory: [],
        moodHistory: [],
      },
    }, null, 2),
      'utf-8',
    );
  }
}

function readDatabase() {
  ensureStore();
  // Recover from a crashed write: if main file gone but .bak exists, promote .bak
  if (!fs.existsSync(DATABASE_PATH) && fs.existsSync(DATABASE_PATH + '.bak')) {
    fs.copyFileSync(DATABASE_PATH + '.bak', DATABASE_PATH);
    clearDatabaseCache();
  }
  const mtimeMs = getDatabaseMtimeMs();
  if (databaseCache && databaseCache.mtimeMs === mtimeMs) {
    return cloneDatabase(databaseCache.data);
  }
  const raw = fs.readFileSync(DATABASE_PATH, 'utf-8');
  try {
    const normalized = normalizeStoredDatabase(JSON.parse(raw));
    setDatabaseCache(normalized);
    return cloneDatabase(normalized);
  } catch (error) {
    if (!fs.existsSync(DATABASE_PATH + '.bak')) {
      throw error;
    }
    try {
      const backupRaw = fs.readFileSync(DATABASE_PATH + '.bak', 'utf-8');
      const backup = JSON.parse(backupRaw);
      fs.copyFileSync(DATABASE_PATH + '.bak', DATABASE_PATH);
      const normalized = normalizeStoredDatabase(backup);
      setDatabaseCache(normalized);
      return cloneDatabase(normalized);
    } catch {
      throw error;
    }
  }
}

let lastBackupAt = 0;
const BACKUP_INTERVAL_MS = 5 * 60 * 1000;

// Inter-process write guard for the GUI ↔ WSL MCP scenario. Sentinel-file lock:
// a writer creates `database.json.lock` (O_CREAT|O_EXCL); a concurrent writer
// sees it and aborts. Stale locks (>30s) are reclaimed; both writers crash-safe
// because the .tmp + rename atomic write is unchanged.
const STALE_LOCK_MS = 30_000;

function acquireWriteLock() {
  const lockPath = DATABASE_PATH + '.lock';
  try {
    return { fd: fs.openSync(lockPath, 'wx'), path: lockPath };
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    let stat = null;
    try { stat = fs.statSync(lockPath); } catch {}
    if (stat && Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
      try { fs.unlinkSync(lockPath); } catch {}
      return { fd: fs.openSync(lockPath, 'wx'), path: lockPath };
    }
    const ageMs = stat ? Date.now() - stat.mtimeMs : -1;
    throw new Error(
      'database is locked by another writer (' + lockPath + ', age ' + ageMs + 'ms). ' +
      'Close the other SciPaper Todo writer (GUI app or WSL MCP) and retry. ' +
      'If stuck, delete the .lock file manually.',
    );
  }
}

function releaseWriteLock(lock) {
  if (!lock) return;
  try { fs.closeSync(lock.fd); } catch {}
  try { fs.unlinkSync(lock.path); } catch {}
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function renameDatabaseFile(tmpPath, targetPath) {
  const retryableCodes = new Set(['EPERM', 'EACCES', 'EBUSY']);
  let lastError;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.renameSync(tmpPath, targetPath);
      return;
    } catch (error) {
      lastError = error;
      if (!retryableCodes.has(error?.code) || attempt === 5) {
        throw error;
      }
      sleepSync(25 * (attempt + 1));
    }
  }

  throw lastError;
}

function writeDatabase(data) {
  ensureStore();
  const normalized = normalizeStoredDatabase(data);
  const json = JSON.stringify(normalized, null, 2);
  const tmpPath = DATABASE_PATH + '.tmp';
  const lock = acquireWriteLock();
  try {
    fs.writeFileSync(tmpPath, json, 'utf-8');
    // Snapshot last good copy at most every BACKUP_INTERVAL_MS
    if (fs.existsSync(DATABASE_PATH) && Date.now() - lastBackupAt > BACKUP_INTERVAL_MS) {
      try {
        fs.copyFileSync(DATABASE_PATH, DATABASE_PATH + '.bak');
        lastBackupAt = Date.now();
      } catch {}
    }
    // Atomic on POSIX; Node fs.renameSync replaces target on Windows too
    renameDatabaseFile(tmpPath, DATABASE_PATH);
    setDatabaseCache(normalized);
  } finally {
    releaseWriteLock(lock);
  }
}

module.exports = {
  ensureStore,
  readDatabase,
  writeDatabase,
};

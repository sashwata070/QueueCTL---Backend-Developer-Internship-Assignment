// db.js - database connection
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'queue.db');
const db = new Database(dbPath);

// Initialize tables if they don't exist
db.prepare(`
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  state TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  worker_id TEXT,
  last_error TEXT,
  created_at TEXT,
  updated_at TEXT,
  available_at INTEGER,
  priority INTEGER DEFAULT 0,
  run_at TEXT,
  stdout TEXT,
  stderr TEXT,
  started_at TEXT,
  completed_at TEXT,
  timeout_seconds INTEGER DEFAULT 300
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
)
`).run();

// Add index for priority
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_priority ON jobs(state, priority DESC, created_at ASC)
`).run();

module.exports = db;
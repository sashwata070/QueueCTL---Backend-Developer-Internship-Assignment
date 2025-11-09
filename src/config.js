// config.js - store config in DB (simple key-value)
const db = require('./db');


const DEFAULTS = {
'max_retries': '3',
'backoff_base': '2'
};


function get(key) {
const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
if (row) return row.value;
return DEFAULTS[key];
}


function set(key, value) {
const exists = db.prepare('SELECT 1 FROM config WHERE key = ?').get(key);
if (exists) {
db.prepare('UPDATE config SET value = ? WHERE key = ?').run(String(value), key);
} else {
db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run(key, String(value));
}
}


module.exports = { get, set };
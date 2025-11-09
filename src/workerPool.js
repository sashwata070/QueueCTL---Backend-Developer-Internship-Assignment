// workerPool.js - manages N worker loops in-process
const db = require('./db');
const { execCommand, nowISO } = require('./util');
const config = require('./config');

let stopRequested = false;

function gracefulStop() {
  stopRequested = true;
}

async function workerLoop(id) {
  while (!stopRequested) {
    try {
      // Pick a pending job that is available
      const row = db.prepare(`
        SELECT * FROM jobs
        WHERE state = 'pending' 
          AND (available_at <= ?)
          AND (run_at IS NULL OR run_at <= ?)
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      `).get(Date.now(), new Date().toISOString());

      if (!row) {
        // Nothing ready to process; sleep briefly
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      // Attempt to lock it atomically
      const res = db.prepare(`
        UPDATE jobs SET state = 'processing', worker_id = ?, updated_at = ?, started_at = ?
        WHERE id = ? AND state = 'pending'
      `).run(id, nowISO(), nowISO(), row.id);

      if (res.changes === 0) {
        // Another worker claimed it
        continue;
      }

      // Execute command
      console.log(`[worker ${id}] processing job ${row.id} -> ${row.command}`);
      const timeout = row.timeout_seconds || 300;
      const { code, stdout, stderr, timedOut } = await execCommand(row.command, timeout * 1000);

      if (timedOut) {
        // Handle timeout as failure
        console.log(`[worker ${id}] job ${row.id} timed out after ${timeout}s`);
        const attempts = row.attempts + 1;
        const maxRetries = row.max_retries;
        const backoffBase = Number(config.get('backoff_base') || 2);
        
        if (attempts > maxRetries) {
          db.prepare(`
            UPDATE jobs 
            SET state = 'dead', attempts = ?, updated_at = ?, last_error = ?, stdout = ?, stderr = ?
            WHERE id = ?
          `).run(attempts, nowISO(), 'Job timed out', stdout, stderr, row.id);
          console.log(`[worker ${id}] job ${row.id} moved to DLQ after ${attempts} attempts (timeout)`);
        } else {
          const delay = Math.pow(backoffBase, attempts) * 1000;
          const availAt = Date.now() + delay;
          db.prepare(`
            UPDATE jobs 
            SET state = 'pending', attempts = ?, updated_at = ?, last_error = ?, available_at = ?, stdout = ?, stderr = ?
            WHERE id = ?
          `).run(attempts, nowISO(), 'Job timed out', availAt, stdout, stderr, row.id);
          console.log(`[worker ${id}] job ${row.id} timed out (attempt ${attempts}), retrying after ${delay/1000}s`);
        }
        continue;
      }

      if (code === 0) {
        // Success
        db.prepare(`
          UPDATE jobs 
          SET state = 'completed', updated_at = ?, completed_at = ?, stdout = ?, stderr = ?
          WHERE id = ?
        `).run(nowISO(), nowISO(), stdout, stderr, row.id);
        console.log(`[worker ${id}] job ${row.id} completed`);
      } else {
        // Failure: increment attempts and decide retry or dead
        const attempts = row.attempts + 1;
        const maxRetries = row.max_retries;
        const backoffBase = Number(config.get('backoff_base') || 2);
        
        if (attempts > maxRetries) {
          // Move to DLQ
          db.prepare(`
            UPDATE jobs 
            SET state = 'dead', attempts = ?, updated_at = ?, last_error = ?, stdout = ?, stderr = ?
            WHERE id = ?
          `).run(attempts, nowISO(), stderr || `exit:${code}`, stdout, stderr, row.id);
          console.log(`[worker ${id}] job ${row.id} moved to DLQ after ${attempts} attempts`);
        } else {
          // Schedule retry with backoff
          const delay = Math.pow(backoffBase, attempts) * 1000;
          const availAt = Date.now() + delay;
          db.prepare(`
            UPDATE jobs 
            SET state = 'pending', attempts = ?, updated_at = ?, last_error = ?, available_at = ?, stdout = ?, stderr = ?
            WHERE id = ?
          `).run(attempts, nowISO(), stderr || `exit:${code}`, availAt, stdout, stderr, row.id);
          console.log(`[worker ${id}] job ${row.id} failed (attempt ${attempts}), retrying after ${delay/1000}s`);
        }
      }
    } catch (err) {
      console.error('worker error', err);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function startWorkers(count = 1) {
  const workers = [];
  for (let i = 1; i <= count; i++) {
    workers.push(workerLoop(i));
  }
  await Promise.all(workers);
}

module.exports = { startWorkers, gracefulStop };
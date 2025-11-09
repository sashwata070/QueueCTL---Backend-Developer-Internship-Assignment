const db = require('./db');

function getMetrics() {
  // Job counts by state
  const stateCounts = db.prepare(`
    SELECT state, COUNT(*) as count 
    FROM jobs 
    GROUP BY state
  `).all();
  
  // Average execution time for completed jobs (last 24 hours)
  const avgTime = db.prepare(`
    SELECT AVG(
      (julianday(completed_at) - julianday(started_at)) * 86400
    ) as avg_seconds
    FROM jobs
    WHERE state = 'completed' 
      AND started_at IS NOT NULL 
      AND completed_at IS NOT NULL
      AND completed_at > datetime('now', '-1 day')
  `).get();
  
  // Success rate (last 24 hours)
  const successRate = db.prepare(`
    SELECT 
      SUM(CASE WHEN state = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as rate
    FROM jobs
    WHERE created_at > datetime('now', '-1 day')
  `).get();
  
  // Jobs processed per hour (last 24 hours)
  const throughput = db.prepare(`
    SELECT COUNT(*) * 1.0 / 24 as jobs_per_hour
    FROM jobs
    WHERE state = 'completed' 
      AND completed_at > datetime('now', '-1 day')
  `).get();
  
  return {
    stateCounts,
    avgExecutionTime: avgTime.avg_seconds,
    successRate: successRate.rate,
    throughput: throughput.jobs_per_hour
  };
}

module.exports = { getMetrics };
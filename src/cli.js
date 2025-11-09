#!/usr/bin/env node
const { Command } = require('commander');
const db = require('./db');
const { nowISO, uuidv4 } = require('./util');
const config = require('./config');
const { startWorkers, gracefulStop } = require('./workerPool');
const { getMetrics } = require('./metrics');
const program = new Command();
program.name('queuectl').description('CLI job queue system');

// Enqueue command
program.command('enqueue')
  .argument('<json>', 'job json string')
  .action((json) => {
    let job;
    try { 
      job = JSON.parse(json); 
    } catch (e) { 
      console.error('✗ Error: Invalid JSON format'); 
      process.exit(1); 
    }
    
    if (!job.command) {
      console.error('✗ Error: Missing required field: command');
      process.exit(1);
    }
    
    if (!job.id) job.id = uuidv4();
    const now = nowISO();
  const stmt = db.prepare(`
  INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at, available_at, priority, timeout_seconds) 
  VALUES (?,?,?,?,?,?,?,?,?,?)
`);
const maxRetries = job.max_retries || Number(config.get('max_retries') || 3);
const priority = job.priority || 0;
const timeout = job.timeout_seconds || 300;  // Add this

stmt.run(
  job.id, 
  job.command, 
  job.state || 'pending', 
  job.attempts || 0, 
  maxRetries, 
  job.created_at || now, 
  job.updated_at || now, 
  Date.now(),
  priority,
  timeout  // Add this
);
    console.log('✓ Job', job.id, 'enqueued');
    console.log('  Command:', job.command);
    console.log('  Max retries:', maxRetries);
  });

// Schedule command
program.command('schedule')
  .argument('<json>', 'job json with run_at timestamp (ISO or ms)')
  .description('Schedule a job to run at a specific time')
  .action((json) => {
    let job;
    try { 
      job = JSON.parse(json); 
    } catch (e) { 
      console.error('✗ Error: Invalid JSON format'); 
      process.exit(1); 
    }

    if (!job.command) {
      console.error('✗ Error: Missing required field: command');
      process.exit(1);
    }

    if (!job.run_at) {
      console.error('✗ Missing run_at field (expected ISO string or timestamp)');
      process.exit(1);
    }

    if (!job.id) job.id = uuidv4();
    const now = nowISO();

    // Convert run_at to timestamp
    const runAt = isNaN(job.run_at) ? new Date(job.run_at).getTime() : Number(job.run_at);
    if (isNaN(runAt)) {
      console.error('✗ Invalid run_at value');
      process.exit(1);
    }

   const stmt = db.prepare(`
  INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at, available_at, priority, timeout_seconds) 
  VALUES (?,?,?,?,?,?,?,?,?,?)
`);
const maxRetries = job.max_retries || Number(config.get('max_retries') || 3);
const priority = job.priority || 0;
const timeout = job.timeout_seconds || 300;  // Add this

stmt.run(
  job.id, 
  job.command, 
  job.state || 'pending', 
  job.attempts || 0, 
  maxRetries, 
  job.created_at || now, 
  job.updated_at || now, 
  Date.now(),
  priority,
  timeout  // Add this
);

    console.log(`✓ Scheduled job ${job.id}`);
    console.log('  Command:', job.command);
    console.log('  Runs at:', new Date(runAt).toLocaleString());
  });


// Worker start command
program
  .command('worker-start')
  .description('Start worker processes')
  .option('--count <n>', 'number of workers', '3')
  .action(async (opts) => {
    const count = Number(opts.count || 3);
    console.log(`Starting ${count} worker(s)... (press Ctrl+C to stop)`);
    
    process.on('SIGINT', async () => {
      console.log('\n\nReceived SIGINT, stopping workers gracefully...');
      gracefulStop();
      process.exit(0);
    });
    
    await startWorkers(count);
  });

// Worker stop command (info only)
program.command('worker-stop')
  .description('Stop workers')
  .action(() => {
    console.log('Workers run in foreground. Use Ctrl+C to stop them gracefully.');
    console.log('If workers are stuck, use task manager to kill node.exe processes.');
  });

// Status command
program.command('status')
  .description('Show queue status and statistics')
  .action(() => {
    console.log('=== Queue Status ===\n');
    
    // Job statistics
    console.log('Job Statistics:');
    const rows = db.prepare(`
      SELECT state, COUNT(*) as count FROM jobs GROUP BY state
    `).all();
    
    const stats = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead: 0
    };
    
    rows.forEach(row => {
      stats.total += row.count;
      stats[row.state] = row.count;
    });
    
    console.table([
      { Metric: 'Total Jobs', Count: stats.total },
      { Metric: 'Pending', Count: stats.pending },
      { Metric: 'Processing', Count: stats.processing },
      { Metric: 'Completed', Count: stats.completed },
      { Metric: 'Failed', Count: stats.failed },
      { Metric: 'Dead (DLQ)', Count: stats.dead }
    ]);
    
    // Configuration
    console.log('\nConfiguration:');
    console.table([
      { Key: 'Max Retries', Value: config.get('max_retries') },
      { Key: 'Backoff Base', Value: config.get('backoff_base') }
    ]);
  });

// List command
program.command('list')
  .description('List jobs')
  .option('--state <state>', 'filter by state (pending, processing, completed, failed, dead)')
  .option('--limit <n>', 'maximum number of jobs to display', '20')
  .action((opts) => {
    let query = 'SELECT * FROM jobs';
    const params = [];
    
    if (opts.state) {
      query += ' WHERE state = ?';
      params.push(opts.state);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Number(opts.limit || 20));
    
    const stmt = db.prepare(query).all(...params);
    
    if (stmt.length === 0) {
      console.log('No jobs found');
    } else {
      // Format for display
      const formatted = stmt.map(job => ({
        ID: job.id.substring(0, 12) + '...',
        Command: job.command.length > 40 ? job.command.substring(0, 40) + '...' : job.command,
        State: job.state,
        Attempts: `${job.attempts}/${job.max_retries}`,
        Created: new Date(job.created_at).toLocaleString()
      }));
      console.table(formatted);
      
      if (stmt.length === Number(opts.limit || 20)) {
        console.log(`\n(Showing first ${opts.limit || 20} jobs)`);
      }
    }
  });

// DLQ list command
program
  .command('dlq-list')
  .description('List jobs in Dead Letter Queue')
  .option('--limit <n>', 'maximum number of jobs to display', '20')
  .action((opts) => {
    const stmt = db.prepare(`
      SELECT * FROM jobs 
      WHERE state = 'dead' 
      ORDER BY updated_at DESC 
      LIMIT ?
    `).all(Number(opts.limit || 20));
    
    if (stmt.length === 0) {
      console.log('No jobs in DLQ');
    } else {
      const formatted = stmt.map(job => ({
        ID: job.id.substring(0, 12) + '...',
        Command: job.command.length > 30 ? job.command.substring(0, 30) + '...' : job.command,
        Attempts: job.attempts,
        'Last Error': job.last_error ? 
          (job.last_error.length > 50 ? job.last_error.substring(0, 50) + '...' : job.last_error) 
          : 'N/A',
        'Failed At': new Date(job.updated_at).toLocaleString()
      }));
      console.table(formatted);
    }
  });

// DLQ retry command
program
  .command('dlq-retry')
  .description('Retry a job from Dead Letter Queue')
  .argument('<job_id>', 'Job ID to retry')
  .action((jobId) => {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    
    if (!job) {
      console.error(`✗ Job ${jobId} not found`);
      process.exit(1);
    }
    
    if (job.state !== 'dead') {
      console.error(`✗ Job ${jobId} is not in DLQ (current state: ${job.state})`);
      process.exit(1);
    }
    
    // Reset job for retry
    db.prepare(`
      UPDATE jobs 
      SET state = 'pending', attempts = 0, updated_at = ?, available_at = ?, last_error = NULL
      WHERE id = ?
    `).run(nowISO(), Date.now(), jobId);
    
    console.log(`✓ Job ${jobId} moved back to queue`);
  });

// Config show command
program
  .command('config-show')
  .description('Show current configuration')
  .action(() => {
    const rows = db.prepare('SELECT * FROM config').all();
    
    console.log('Current Configuration:');
    
    if (rows.length === 0) {
      console.log('No custom config set. Using defaults:');
      console.table([
        { Key: 'max_retries', Value: '3' },
        { Key: 'backoff_base', Value: '2' }
      ]);
    } else {
      const formatted = rows.map(row => ({
        Key: row.key,
        Value: row.value
      }));
      console.table(formatted);
    }
  });

// Config set command
program
  .command('config-set')
  .description('Set configuration value')
  .argument('<key>', 'Config key (max_retries, backoff_base)')
  .argument('<value>', 'Config value')
  .action((key, value) => {
    const validKeys = ['max_retries', 'backoff_base'];
    
    if (!validKeys.includes(key)) {
      console.error(`✗ Unknown configuration key: ${key}`);
      console.log(`Available keys: ${validKeys.join(', ')}`);
      process.exit(1);
    }
    
    config.set(key, value);
    console.log(`✓ Configuration updated: ${key} = ${value}`);
  });

program.command('logs')
  .argument('<job_id>', 'Job ID')
  .action((jobId) => {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) {
      console.error(`✗ Job ${jobId} not found`);
      process.exit(1);
    }
    
    console.log('=== Job Logs ===');
    console.log('Job ID:', job.id);
    console.log('Command:', job.command);
    console.log('State:', job.state);
    console.log('Started:', job.started_at);
    console.log('Completed:', job.completed_at);
    console.log('\n--- STDOUT ---');
    console.log(job.stdout || '(no output)');
    console.log('\n--- STDERR ---');
    console.log(job.stderr || '(no errors)');
  });

program.command('metrics')
  .description('Show system metrics')
  .action(() => {
    const metrics = getMetrics();
    
    console.log('=== System Metrics ===\n');
    
    console.log('Job Counts:');
    console.table(metrics.stateCounts);
    
    console.log('\nPerformance (Last 24 Hours):');
    console.table([
      { Metric: 'Avg Execution Time', Value: `${metrics.avgExecutionTime?.toFixed(2) || 0}s` },
      { Metric: 'Success Rate', Value: `${metrics.successRate?.toFixed(2) || 0}%` },
      { Metric: 'Throughput', Value: `${metrics.throughput?.toFixed(2) || 0} jobs/hour` }
    ]);
  });

program.command('dashboard')
  .option('--port <n>', 'Port number', '3000')
  .action((opts) => {
    process.env.PORT = opts.port;
    require('./web');   
  });

program.parse(process.argv);
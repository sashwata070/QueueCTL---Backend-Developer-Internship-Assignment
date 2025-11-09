# queuectl - Production-Grade CLI Job Queue System

A robust, feature-rich background job queue system built with Node.js, SQLite, and a clean CLI interface. Supports job priorities, retries with exponential backoff, dead letter queues, scheduled jobs, timeouts, and real-time monitoring.

---

## 📋 Table of Contents

- [Features](#features)
- [Setup Instructions](#setup-instructions)
- [Usage Examples](#usage-examples)
- [Architecture Overview](#architecture-overview)
- [Assumptions & Trade-offs](#assumptions--trade-offs)
- [Testing Instructions](#testing-instructions)


---

## ✨ Features

### Core Features
- ✅ **Background Job Processing** - Execute shell commands asynchronously
- ✅ **Multi-Worker Support** - Run multiple workers concurrently (in-process)
- ✅ **Job Priorities** - High/normal/low priority queue ordering
- ✅ **Retry Mechanism** - Exponential backoff with configurable max retries
- ✅ **Dead Letter Queue (DLQ)** - Capture and retry permanently failed jobs
- ✅ **Job Timeouts** - Configurable timeout per job (default: 5 minutes)
- ✅ **Scheduled Jobs** - Execute jobs at specific future times
- ✅ **Job Output Logging** - Capture and store stdout/stderr for each job
- ✅ **Metrics & Analytics** - Track success rates, throughput, and execution times
- ✅ **Web Dashboard** - Real-time monitoring interface
- ✅ **Persistent Storage** - SQLite-based job queue with ACID guarantees
- ✅ **Graceful Shutdown** - Workers handle SIGINT/SIGTERM properly

---

## 🚀 Setup Instructions

### Prerequisites

- **Node.js** >= 14.0.0
- **npm** >= 6.0.0

### Installation

1. **Clone or download the project:**
   ```bash
   cd queuectl
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Verify installation:**
   ```bash
   node src/cli.js --help
   ```

   You should see the command list.

### Project Structure

```
queuectl/
├── src/
│   ├── cli.js          # Command-line interface
│   ├── db.js           # SQLite database initialization
│   ├── config.js       # Configuration management
│   ├── util.js         # Utility functions (command execution, UUID)
│   ├── workerPool.js   # Worker loop logic
│   ├── metrics.js      # Performance metrics
│   └── web.js          # Web dashboard server
├── package.json        # Dependencies and scripts
├── queue.db           # SQLite database (created automatically)
└── README.md          # This file
```

---

## 📖 Usage Examples

### 1. Starting Workers

```bash
# Start 3 workers
node src/cli.js worker-start --count 3
```

**Output:**
```
Starting 3 worker(s)... (press Ctrl+C to stop)
[worker 1] processing job abc123... -> echo Hello
[worker 1] job abc123 completed
```

**Note:** Workers run in the foreground. Press `Ctrl+C` to stop gracefully.

---

### 2. Enqueuing Jobs

#### Basic Job
```bash
node src/cli.js enqueue "{\"command\":\"echo Hello World\"}"
```

**Output:**
```
[OK] Job abc-123-def enqueued
  Command: echo Hello World
  Max retries: 3
```

#### Job with Priority
```bash
# High priority (processed first)
node src/cli.js enqueue "{\"command\":\"echo Urgent Task\",\"priority\":10}"

# Normal priority (default: 0)
node src/cli.js enqueue "{\"command\":\"echo Normal Task\"}"

# Low priority (processed last)
node src/cli.js enqueue "{\"command\":\"echo Background Task\",\"priority\":-10}"
```

#### Job with Custom Timeout
```bash
# Job that times out after 10 seconds
node src/cli.js enqueue "{\"command\":\"sleep 15\",\"timeout_seconds\":10}"
```

#### Job with Custom Retries
```bash
# Retry up to 5 times on failure
node src/cli.js enqueue "{\"command\":\"curl https://api.example.com\",\"max_retries\":5}"
```

---

### 3. Scheduling Jobs

#### Schedule for Future Execution
```bash
# PowerShell: Schedule job to run in 1 hour
$runAt = (Get-Date).AddHours(1).ToString("o")
node src/cli.js schedule "{\"command\":\"backup.bat\",\"run_at\":\"$runAt\"}"
```

**Output:**
```
[OK] Scheduled job xyz-789-abc
  Command: backup.bat
  Runs at: 12/10/2024, 3:00:00 PM
```

#### Using Timestamp (milliseconds)
```bash
# Schedule using Unix timestamp (in ms)
node src/cli.js schedule "{\"command\":\"echo Future\",\"run_at\":1733900000000}"
```

---

### 4. Monitoring Jobs

#### Check Queue Status
```bash
node src/cli.js status
```

**Output:**
```
=== Queue Status ===

Job Statistics:
┌─────────┬──────────────┬───────┐
│ (index) │    Metric    │ Count │
├─────────┼──────────────┼───────┤
│    0    │ Total Jobs   │  25   │
│    1    │ Pending      │   5   │
│    2    │ Processing   │   2   │
│    3    │ Completed    │  15   │
│    4    │ Failed       │   1   │
│    5    │ Dead (DLQ)   │   2   │
└─────────┴──────────────┴───────┘

Configuration:
┌─────────┬──────────────┬───────┐
│ (index) │     Key      │ Value │
├─────────┼──────────────┼───────┤
│    0    │ Max Retries  │  '3'  │
│    1    │ Backoff Base │  '2'  │
└─────────┴──────────────┴───────┘
```

#### List All Jobs
```bash
node src/cli.js list
```

#### Filter by State
```bash
# Show only pending jobs
node src/cli.js list --state pending

# Show only completed jobs
node src/cli.js list --state completed

# Show only failed jobs
node src/cli.js list --state failed
```

**Output:**
```
┌─────────┬─────────────────┬──────────────────┬───────────┬──────────┬─────────────────────┐
│ (index) │       ID        │     Command      │   State   │ Attempts │       Created       │
├─────────┼─────────────────┼──────────────────┼───────────┼──────────┼─────────────────────┤
│    0    │ abc123-456...   │ echo Hello       │ completed │   0/3    │ 12/9/2024, 10:30 AM │
│    1    │ def789-012...   │ sleep 5          │ completed │   0/3    │ 12/9/2024, 10:31 AM │
└─────────┴─────────────────┴──────────────────┴───────────┴──────────┴─────────────────────┘
```

---

### 5. Viewing Job Logs

```bash
# View output of a specific job
node src/cli.js logs <job-id>
```

**Output:**
```
=== Job Logs ===
Job ID: abc-123-def-456
Command: echo Hello World
State: completed
Started: 2024-12-09T10:30:15.000Z
Completed: 2024-12-09T10:30:16.000Z

--- STDOUT ---
Hello World

--- STDERR ---
(no errors)
```

---

### 6. Managing Dead Letter Queue (DLQ)

#### List Failed Jobs in DLQ
```bash
node src/cli.js dlq-list
```

**Output:**
```
┌─────────┬─────────────────┬──────────────┬──────────┬────────────────────┬────────────────────┐
│ (index) │       ID        │   Command    │ Attempts │    Last Error      │     Failed At      │
├─────────┼─────────────────┼──────────────┼──────────┼────────────────────┼────────────────────┤
│    0    │ xyz789-012...   │ exit 1       │    3     │ exit:1             │ 12/9/2024, 10:45   │
│    1    │ abc456-789...   │ invalid-cmd  │    3     │ command not found  │ 12/9/2024, 10:50   │
└─────────┴─────────────────┴──────────────┴──────────┴────────────────────┴────────────────────┘
```

#### Retry a Failed Job
```bash
# Move job from DLQ back to pending queue
node src/cli.js dlq-retry <job-id>
```

**Output:**
```
[OK] Job xyz-789-012 moved back to queue
```

---

### 7. Configuration Management

#### View Current Configuration
```bash
node src/cli.js config-show
```

#### Update Configuration
```bash
# Change max retries to 5
node src/cli.js config-set max_retries 5

# Change exponential backoff base to 3
node src/cli.js config-set backoff_base 3
```

**Output:**
```
[OK] Configuration updated: max_retries = 5
```

---

### 8. Performance Metrics

```bash
node src/cli.js metrics
```

**Output:**
```
=== System Metrics ===

Job Counts:
┌─────────┬───────────┬───────┐
│ (index) │   state   │ count │
├─────────┼───────────┼───────┤
│    0    │ completed │  150  │
│    1    │ pending   │   10  │
│    2    │ dead      │   3   │
└─────────┴───────────┴───────┘

Performance (Last 24 Hours):
┌─────────┬─────────────────────┬──────────────┐
│ (index) │       Metric        │    Value     │
├─────────┼─────────────────────┼──────────────┤
│    0    │ Avg Execution Time  │ 2.45s        │
│    1    │ Success Rate        │ 96.30%       │
│    2    │ Throughput          │ 25.5 jobs/hr │
└─────────┴─────────────────────┴──────────────┘
```

---

### 9. Web Dashboard

```bash
# Start dashboard on default port (3000)
node src/cli.js dashboard

# Start on custom port
node src/cli.js dashboard --port 8080
```

**Output:**
```
📊 Dashboard running at http://localhost:3000
```

**Dashboard Features:**
- Real-time queue status
- Recent jobs list
- Auto-refresh every 5 seconds
- Metrics visualization

Open `http://localhost:3000` in your browser.

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────┐
│   CLI       │  ← User interacts via command-line
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  SQLite DB  │  ← Persistent job queue storage
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Worker Pool │  ← N concurrent worker loops
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Job Executor│  ← Spawns shell processes
└─────────────┘
```

### Job Lifecycle

```
┌───────────┐
│  PENDING  │ ← Job enqueued
└─────┬─────┘
      │
      │ Worker picks job
      ▼
┌───────────┐
│PROCESSING │ ← Job executing
└─────┬─────┘
      │
      ├─── Success ────────────┐
      │                        ▼
      │                  ┌──────────┐
      │                  │COMPLETED │
      │                  └──────────┘
      │
      └─── Failure ───────────┐
                              ▼
                        ┌──────────┐
                        │  FAILED  │ (retry with backoff)
                        └─────┬────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
             Retry < max         Retry >= max
                    │                   │
                    ▼                   ▼
              ┌──────────┐        ┌────────┐
              │ PENDING  │        │  DEAD  │ (DLQ)
              └──────────┘        └────────┘
```

### Data Persistence

**Database Schema:**
```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  state TEXT NOT NULL,              -- pending, processing, completed, failed, dead
  attempts INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  priority INTEGER DEFAULT 0,       -- Higher = more important
  timeout_seconds INTEGER DEFAULT 300,
  worker_id TEXT,
  last_error TEXT,
  stdout TEXT,
  stderr TEXT,
  created_at TEXT,
  updated_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  available_at INTEGER,             -- Timestamp when job becomes available
  run_at TEXT                       -- Scheduled execution time
)
```

**Indexes:**
- `idx_priority` on `(state, priority DESC, created_at ASC)` for efficient job selection

### Worker Logic

**Worker Algorithm:**
```
1. SELECT job WHERE state='pending' AND available_at <= NOW() AND (run_at IS NULL OR run_at <= NOW())
   ORDER BY priority DESC, created_at ASC
   LIMIT 1

2. Atomically UPDATE job to 'processing' (prevents duplicate processing)

3. Execute command with timeout

4. If success:
   - Mark as 'completed'
   - Store stdout/stderr
   
5. If failure or timeout:
   - Increment attempts
   - If attempts > max_retries:
     - Mark as 'dead' (DLQ)
   - Else:
     - Mark as 'failed'
     - Set available_at = NOW() + (backoff_base ^ attempts) seconds
     - Worker will retry later

6. Repeat
```

### Retry Strategy

**Exponential Backoff:**
- Attempt 1: Wait 2^1 = 2 seconds
- Attempt 2: Wait 2^2 = 4 seconds
- Attempt 3: Wait 2^3 = 8 seconds
- Attempt N: Wait 2^N seconds

**Configurable:**
- `max_retries` - Maximum retry attempts (default: 3)
- `backoff_base` - Exponential base (default: 2)

### Concurrency Model

- **In-Process Workers**: Multiple async worker loops in same Node.js process
- **Atomic Job Locking**: SQL UPDATE with WHERE condition prevents race conditions
- **Non-Blocking I/O**: Uses async/await throughout

---

## 🤔 Assumptions & Trade-offs

### Assumptions

1. **Single Node Deployment**
   - System runs on a single machine
   - No distributed worker coordination needed
   - Suitable for small to medium workloads

2. **Shell Command Execution**
   - Jobs are shell commands (not JavaScript functions)
   - Commands must be idempotent (safe to retry)
   - Workers have necessary permissions to execute commands

3. **Job Persistence**
   - SQLite provides sufficient ACID guarantees
   - Database file accessible to all workers
   - No need for cross-server job distribution

4. **Network Reliability**
   - Workers and database on same machine (no network latency)
   - No partition tolerance required

### Trade-offs

#### ✅ Pros

1. **Simplicity**
   - Single dependency: SQLite (no Redis, RabbitMQ, etc.)
   - Easy to deploy and maintain
   - No external services required

2. **Reliability**
   - ACID transactions prevent job loss
   - Automatic retry with exponential backoff
   - Dead letter queue captures permanent failures

3. **Visibility**
   - All job history stored in database
   - Output logging for debugging
   - Metrics for performance monitoring

4. **Flexibility**
   - Priority queues for urgent tasks
   - Scheduled jobs for future execution
   - Configurable timeouts and retries

#### ❌ Cons & Limitations

1. **Scalability**
   - Limited to single machine throughput
   - SQLite has write serialization (one writer at a time)
   - Not suitable for high-volume (>10,000 jobs/hour) systems

2. **No Distributed Workers**
   - Can't scale horizontally across multiple servers
   - Single point of failure
   - For distributed setup, consider: Bull (Redis), RabbitMQ, or AWS SQS

3. **In-Process Workers**
   - Workers share same process memory
   - One crashed worker doesn't affect others (but whole process crash loses all)
   - For isolation, consider separate worker processes

4. **Job Persistence Only**
   - No pub/sub or real-time notifications
   - No webhook callbacks on completion
   - Manual polling required for job status

5. **Shell Command Limitations**
   - Can't pass complex objects between jobs
   - No native support for job chaining/workflows
   - Environment variables must be set externally

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite over Redis | Simplicity, no external service, ACID guarantees |
| In-process workers | Lower latency, simpler deployment |
| Shell commands | Flexibility (any language/script), language-agnostic |
| Exponential backoff | Prevents thundering herd, gives services time to recover |
| Priority queues | Urgent tasks don't wait behind low-priority jobs |
| Output logging | Debugging, audit trail, compliance |
| Web dashboard | Better UX than CLI-only monitoring |

### When to Use This System

**✅ Good Fit:**
- Background task processing (emails, reports, data processing)
- Scheduled jobs (cron-like tasks)
- Retry-sensitive operations (API calls, file processing)
- Single-server deployments
- Prototypes and MVPs
- Small to medium workloads (<1000 jobs/hour)

**❌ Not Recommended:**
- High-volume systems (>10,000 jobs/hour)
- Distributed multi-server architectures
- Real-time processing requirements (<100ms latency)
- Mission-critical systems requiring 99.99% uptime
- Complex workflow orchestration (use Temporal, Airflow instead)

---

## 🧪 Testing Instructions

### 1. Basic Functionality Test

```bash
# Terminal 1: Start workers
node src/cli.js worker-start --count 3

# Terminal 2: Run tests
# Test 1: Simple job
node src/cli.js enqueue "{\"command\":\"echo Test 1\"}"

# Test 2: Multiple jobs
for ($i=1; $i -le 5; $i++) { 
  node src/cli.js enqueue "{\"command\":\"echo Job $i\"}" 
}

# Verify: Check status
node src/cli.js status
# Expected: 5 completed jobs

# Verify: List completed jobs
node src/cli.js list --state completed
# Expected: See all 5 jobs
```

**Expected Output:**
- Workers should process all 5 jobs
- Status shows 5 completed
- No jobs in pending or failed state

---

### 2. Priority Queue Test

```bash
# Enqueue jobs in order: low, normal, high priority
node src/cli.js enqueue "{\"command\":\"echo Low Priority\",\"priority\":-10}"
node src/cli.js enqueue "{\"command\":\"echo Normal Priority\"}"
node src/cli.js enqueue "{\"command\":\"echo High Priority\",\"priority\":10}"

# Check worker logs
```

**Expected Behavior:**
- Workers should process in order: High → Normal → Low
- Worker logs show: "High Priority" completes first

---

### 3. Retry & Failure Test

```bash
# Test 1: Job that fails once, then succeeds (transient failure)
node src/cli.js enqueue "{\"command\":\"exit 1\",\"max_retries\":2}"

# Wait 2-4 seconds, check status
node src/cli.js list --state failed

# Test 2: Job that always fails (permanent failure)
node src/cli.js enqueue "{\"command\":\"exit 1\",\"max_retries\":2}"

# Wait ~15 seconds (2s + 4s + 8s), check DLQ
node src/cli.js dlq-list
# Expected: Job moved to DLQ after 3 attempts
```

**Expected Behavior:**
- Job retries with exponential backoff (2s, 4s, 8s delays)
- After max_retries, job moves to DLQ
- Worker logs show: "failed (attempt 1), retrying after 2s"

---

### 4. Timeout Test

```bash
# Job that times out
node src/cli.js enqueue "{\"command\":\"sleep 30\",\"timeout_seconds\":5}"

# Wait 5 seconds, check status
node src/cli.js list
```

**Expected Behavior:**
- Job terminates after 5 seconds
- Worker log: "job timed out after 5s"
- Job retries or moves to DLQ depending on max_retries

---

### 5. Scheduled Job Test

```bash
# PowerShell: Schedule job for 30 seconds from now
$runAt = (Get-Date).AddSeconds(30).ToString("o")
node src/cli.js schedule "{\"command\":\"echo Scheduled Task\",\"run_at\":\"$runAt\"}"

# Check status immediately
node src/cli.js list --state pending
# Expected: Job shows in pending

# Wait 30+ seconds
# Expected: Job executes and completes
```

**Expected Behavior:**
- Job stays pending for 30 seconds
- Workers don't pick it up until run_at time
- Job processes exactly at scheduled time

---

### 6. Job Logging Test

```bash
# Enqueue job with output
node src/cli.js enqueue "{\"command\":\"echo Hello && echo Error >&2\"}"

# Get job ID from status
node src/cli.js list --state completed

# View logs (use actual job ID)
node src/cli.js logs <job-id>
```

**Expected Output:**
```
=== Job Logs ===
...
--- STDOUT ---
Hello

--- STDERR ---
Error
```

---

### 7. DLQ Retry Test

```bash
# Create a failed job
node src/cli.js enqueue "{\"command\":\"exit 1\",\"max_retries\":1}"

# Wait for it to fail and move to DLQ (~6 seconds)
node src/cli.js dlq-list

# Retry the job (use actual job ID)
node src/cli.js dlq-retry <job-id>

# Verify it's back in queue
node src/cli.js list --state pending
```

**Expected Behavior:**
- Job moves from DLQ to pending
- Attempts reset to 0
- Workers pick it up again

---

### 8. Configuration Test

```bash
# Change config
node src/cli.js config-set max_retries 5
node src/cli.js config-set backoff_base 3

# Verify
node src/cli.js config-show

# Test with new config
node src/cli.js enqueue "{\"command\":\"exit 1\"}"
# Expected: Job retries 5 times with 3^N backoff
```

---

### 9. Metrics Test

```bash
# Enqueue and process several jobs
for ($i=1; $i -le 20; $i++) { 
  node src/cli.js enqueue "{\"command\":\"echo Metric Test $i\"}" 
}

# Wait for completion, then check metrics
node src/cli.js metrics
```

**Expected Output:**
- Shows job counts
- Average execution time ~0.1-0.5 seconds
- Success rate ~100% (assuming no failures)
- Throughput shows jobs/hour

---

### 10. Web Dashboard Test

```bash
# Start dashboard
node src/cli.js dashboard

# Open browser
# Navigate to: http://localhost:3000

# In another terminal, enqueue jobs
node src/cli.js enqueue "{\"command\":\"echo Dashboard Test\"}"

# Dashboard should auto-refresh and show the new job
```

**Expected Behavior:**
- Dashboard loads successfully
- Shows current queue status
- Updates automatically every 5 seconds
- Recent jobs list displays correctly

---

### 11. Stress Test (Optional)

```bash
# Enqueue 100 jobs rapidly
for ($i=1; $i -le 100; $i++) { 
  node src/cli.js enqueue "{\"command\":\"echo Stress Test $i\"}" 
}

# Monitor status
node src/cli.js status

# Check metrics after completion
node src/cli.js metrics
```

**Expected Behavior:**
- All jobs eventually complete
- No jobs stuck in processing
- System remains stable

---

### 12. Graceful Shutdown Test

```bash
# Start workers
node src/cli.js worker-start --count 3

# Enqueue long-running job
node src/cli.js enqueue "{\"command\":\"sleep 10\"}"

# Wait 2 seconds, then press Ctrl+C

# Check status
node src/cli.js list
```

**Expected Behavior:**
- Workers stop after current jobs complete
- No jobs stuck in "processing" state
- Clean shutdown message displayed

---


const express = require('express');
const db = require('./db');
const { getMetrics } = require('./metrics');

const app = express();
const PORT = 3000;

// Serve static HTML
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>  
    <head>
      <title>queuectl Dashboard</title>
      <style>
        body { font-family: Arial; margin: 20px; background: #ffffffff; }
        .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333333ff; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddddddff; }
        th { background: #4eaf4cff; color: white; }
        .metric { font-size: 2em; font-weight: bold; color: #5eaf4cff; }
        .refresh { margin: 20px 0; }
      </style>
      <script>
        function refresh() {
          location.reload();
        }
        setInterval(refresh, 5000); // Auto-refresh every 5 seconds
      </script>
    </head>
    <body>
      <h1>🚀 queuectl Dashboard</h1>
      <button class="refresh" onclick="refresh()">↻ Refresh Now</button>
      
      <div class="card">
        <h2>Queue Status</h2>
        <div id="status"></div>
      </div>
      
      <div class="card">
        <h2>Recent Jobs</h2>
        <div id="jobs"></div>
      </div>
      
      <script>
        fetch('/api/status').then(r => r.json()).then(data => {
          document.getElementById('status').innerHTML = 
            '<table><tr><th>State</th><th>Count</th></tr>' +
            data.map(s => '<tr><td>'+s.state+'</td><td>'+s.count+'</td></tr>').join('') +
            '</table>';
        });
        
        fetch('/api/jobs').then(r => r.json()).then(data => {
          document.getElementById('jobs').innerHTML = 
            '<table><tr><th>ID</th><th>Command</th><th>State</th><th>Created</th></tr>' +
            data.map(j => '<tr><td>'+j.id.substring(0,8)+'...</td><td>'+j.command.substring(0,40)+'</td><td>'+j.state+'</td><td>'+new Date(j.created_at).toLocaleString()+'</td></tr>').join('') +
            '</table>';
        });
      </script>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/status', (req, res) => {
  const rows = db.prepare(`
    SELECT state, COUNT(*) as count FROM jobs GROUP BY state
  `).all();
  res.json(rows);
});

app.get('/api/jobs', (req, res) => {
  const jobs = db.prepare(`
    SELECT * FROM jobs ORDER BY created_at DESC LIMIT 20
  `).all();
  res.json(jobs);
});

app.get('/api/metrics', (req, res) => {
  res.json(getMetrics());
});

app.listen(PORT, () => {
  console.log(`📊 Dashboard running at http://localhost:${PORT}`);
});
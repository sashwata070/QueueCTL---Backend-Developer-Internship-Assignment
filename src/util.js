const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');


function nowISO() {
return (new Date()).toISOString();
}


function execCommand(command, timeout = 300000) { // 5 min default
  return new Promise((resolve) => {
    const sh = spawn(command, { shell: true });
    let out = '';
    let err = '';
    let timedOut = false;
    
    // Set timeout
    const timer = setTimeout(() => {
      timedOut = true;
      sh.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => sh.kill('SIGKILL'), 5000);
    }, timeout);
    
    sh.stdout.on('data', (d) => out += d.toString());
    sh.stderr.on('data', (d) => err += d.toString());
    sh.on('close', (code) => {
      clearTimeout(timer);
      resolve({ 
        code: timedOut ? -1 : code, 
        stdout: out, 
        stderr: timedOut ? 'Job timed out' : err,
        timedOut 
      });
    });
  });
}


module.exports = { nowISO, execCommand, uuidv4 };
const { spawn } = require('child_process');
const path = require('path');

// Path to the CLI
const cliPath = path.join(__dirname, 'dist', 'cli.js');

// Start the CLI process
const cli = spawn('node', [cliPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Log output clearly
cli.stdout.on('data', (data) => {
  console.log('OUTPUT:', data.toString());
});

cli.stderr.on('data', (data) => {
  console.error('ERROR:', data.toString());
});

// Send commands with timeouts to see clear responses
setTimeout(() => {
  cli.stdin.write('123 .\n');
  
  setTimeout(() => {
    cli.stdin.write('3.14 .\n');
    
    setTimeout(() => {
      cli.stdin.write('( 1 2 ) .\n');
      
      setTimeout(() => {
        cli.stdin.write('( 1 ( 2 3 ) 4 ) .\n');
        
        setTimeout(() => {
          cli.stdin.write('exit\n');
        }, 500);
      }, 500);
    }, 500);
  }, 500);
}, 500);

// Handle process exit
cli.on('close', (code) => {
  console.log(`CLI process exited with code ${code}`);
});

// Node.js script to test Tacit print operation with clear markers
const { spawn } = require('child_process');
const path = require('path');

// CLI path
const cliPath = path.join('dist', 'cli.js');

// Start the CLI process
const cli = spawn('node', [cliPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Log output with clear markers
cli.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`--- OUTPUT START ---\n${output}\n--- OUTPUT END ---`);
});

cli.stderr.on('data', (data) => {
  console.error(`--- ERROR ---\n${data.toString()}\n--- ERROR END ---`);
});

// Send commands to test printing
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
          // Give time for exit to process
          setTimeout(() => {
            console.log("Test complete");
            process.exit(0);
          }, 500);
        }, 500);
      }, 500);
    }, 500);
  }, 500);
}, 500);

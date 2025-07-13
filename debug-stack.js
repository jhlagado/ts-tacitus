// Debug script to examine the stack structure in the CLI
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

// Send commands to create a list and examine the stack
setTimeout(() => {
  // First create a simple list
  cli.stdin.write('( 1 2 ) \n');
  
  setTimeout(() => {
    // Print stack inspection code
    cli.stdin.write('show-stack \n');
    
    setTimeout(() => {
      cli.stdin.write('exit\n');
      // Give time for exit to process
      setTimeout(() => {
        console.log("Test complete");
        process.exit(0);
      }, 500);
    }, 1000);
  }, 1000);
}, 1000);

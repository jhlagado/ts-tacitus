import { spawn } from 'child_process';
import path from 'path';

const cliPath = path.join('dist', 'cli.js');

const cli = spawn('node', [cliPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

cli.stdout.on('data', data => {
  const output = data.toString();
  console.log(`--- OUTPUT START ---\n${output}\n--- OUTPUT END ---`);
});

cli.stderr.on('data', data => {
  console.error(`--- ERROR ---\n${data.toString()}\n--- ERROR END ---`);
});

setTimeout(() => {
  cli.stdin.write('( 1 2 ) \n');

  setTimeout(() => {
    cli.stdin.write('show-stack \n');

    setTimeout(() => {
      cli.stdin.write('exit\n');

      setTimeout(() => {
        console.log('Test complete');
        process.exit(0);
      }, 500);
    }, 1000);
  }, 1000);
}, 1000);

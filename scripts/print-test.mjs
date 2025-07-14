import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliPath = path.join(__dirname, 'dist', 'cli.js');

const cli = spawn('node', [cliPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

cli.stdout.on('data', data => {
  console.log('OUTPUT:', data.toString());
});

cli.stderr.on('data', data => {
  console.error('ERROR:', data.toString());
});

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

cli.on('close', code => {
  console.log(`CLI process exited with code ${code}`);
});

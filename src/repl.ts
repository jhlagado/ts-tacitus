import { createInterface } from 'readline';
import { execute, initializeInterpreter } from './interpreter';

/**
 * Starts the Read-Eval-Print Loop (REPL) for the Forth interpreter.
 */
export function startREPL(): void {
  initializeInterpreter();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();

  rl.on('line', (line) => {
    const command = line.trim();
    if (command === 'exit') {
      console.log('Goodbye!');
      rl.close();
      return; // Ensure no further processing happens
    }

    try {
      const result = execute(command);
      console.log(result);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('Unknown error occurred');
      }
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('REPL exited.');
  });
}
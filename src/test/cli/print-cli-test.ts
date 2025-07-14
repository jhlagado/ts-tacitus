import { executeTacitCode, resetVM } from '../utils/test-utils';
import { vm } from '../../core/globalState';

/**
 * Simple CLI test for print operations to verify that our fix works in the actual CLI
 */
function main() {
  console.log('Testing print operations in CLI mode');
  console.log('===================================');

  console.log('\nTesting atomic values:');
  resetVM();
  executeTacitCode('123 .');

  resetVM();
  executeTacitCode('3.14 .');

  console.log('\nTesting simple list:');
  resetVM();
  executeTacitCode('( 1 2 ) .');

  console.log('\nTesting nested list:');
  resetVM();
  executeTacitCode('( 1 ( 2 3 ) 4 ) .');

  console.log('\nTesting list with LINK:');
  resetVM();
  executeTacitCode('( 10 20 ) dup .');

  console.log('\nTesting deeply nested list:');
  resetVM();
  executeTacitCode('( 1 ( 2 ( 3 4 ) 5 ) 6 ) .');
}

main();

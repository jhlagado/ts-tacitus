import { initializeInterpreter, vm } from './src/core/globalState';
import { executeTacitCode } from './src/test/utils/vm-test-utils';

// Test storing empty list in local variable
initializeInterpreter();

try {
  const result = executeTacitCode(`
    : test-empty-var
      () var emptyList
      emptyList
    ;
    test-empty-var
  `);
  
  console.log('Success! Result:', result);
} catch (error) {
  console.log('Error:', error.message);
  console.log('Stack:', vm.getStackData());
}
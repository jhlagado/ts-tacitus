const { executeTacitCode, resetVM } = require('./dist/test/utils/test-utils.js');

console.log('Testing simple swap operation...');

resetVM();
const result = executeTacitCode('10 20 30 swap');
console.log('Result of "10 20 30 swap":', result);

// Should be [10, 30, 20] after swapping 20 and 30

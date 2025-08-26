#!/usr/bin/env node

const { executeTacitCode, resetVM, vm } = require('./dist/test/utils/vm-test-utils.js');

resetVM();

console.log('=== Debug Compound Local Variable Access ===');

try {
  // Test simple case first
  console.log('\n1. Test basic compound local var creation:');
  const result1 = executeTacitCode(': test-basic ( 10 20 30 ) var mylist mylist ; test-basic');
  console.log('Result:', result1);
  console.log('VM stack data:', vm.getStackData());

  console.log('\n2. Test size operation on compound local var:');
  const result2 = executeTacitCode(': test-size ( 10 20 30 ) var mylist mylist size ; test-size');
  console.log('Result:', result2);
  console.log('VM stack data:', vm.getStackData());

  console.log('\n3. Test size operation on regular list:');
  const result3 = executeTacitCode('( 10 20 30 ) size');
  console.log('Result:', result3);
  console.log('VM stack data:', vm.getStackData());

} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
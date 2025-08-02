// Quick bytecode inspection using existing test infrastructure

const { vm } = require('./dist/core/globalState');
const { parse } = require('./dist/lang/parser');
const { Tokenizer } = require('./dist/lang/tokenizer');

try {
  // Reset VM
  vm.reset();

  console.log('=== Built-in Indices ===');
  console.log('dup:', vm.symbolTable.find('dup'));
  console.log('mul:', vm.symbolTable.find('mul'));
  console.log('*:', vm.symbolTable.find('*'));

  // Parse square definition
  console.log('\n=== Parsing : square dup mul ; ===');
  parse(new Tokenizer(': square dup mul ;'));

  console.log('Bytecode length:', vm.compiler.CP);

  // Read bytecode manually
  console.log('\n=== Bytecode Sequence ===');
  for (let i = 0; i < vm.compiler.CP; i++) {
    const byte = vm.memory.read8(0, i); // SEG_CODE = 0
    console.log(`[${i.toString().padStart(2)}]: ${byte.toString().padStart(3)} (0x${byte.toString(16).padStart(2, '0')})`);
  }

  // Check square address
  const squareAddr = vm.symbolTable.findBytecodeAddress('square');
  console.log('\nsquare bytecode address:', squareAddr);

} catch (error) {
  console.error('Error:', error.message);
}

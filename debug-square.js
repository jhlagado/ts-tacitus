const { vm } = require('./dist/core/globalState');
const { parse } = require('./dist/lang/parser');
const { Tokenizer } = require('./dist/lang/tokenizer');
const { execute } = require('./dist/lang/interpreter');

// Reset VM
vm.reset();

console.log('=== Built-in indices ===');
console.log('dup index:', vm.symbolTable.find('dup'));
console.log('mul index:', vm.symbolTable.find('mul'));

// Parse the square definition
console.log('\n=== Parsing `: square dup mul ;` ===');
parse(new Tokenizer(': square dup mul ;'));

// Check what got compiled
console.log('\nBytecode length:', vm.compiler.CP);
console.log('Memory contents (first 20 bytes):');
for (let i = 0; i < Math.min(20, vm.compiler.CP); i++) {
  console.log(`[${i}]: ${vm.memory.getUint8(i)}`);
}

// Check symbol table for square
console.log('\n=== Symbol table ===');
const squareAddr = vm.symbolTable.findBytecodeAddress('square');
console.log('square bytecode address:', squareAddr);

// Try to manually execute the square definition
console.log('\n=== Manual execution test ===');
vm.reset(); // Reset VM state
vm.push(3); // Push test value
console.log('Stack before square:', vm.getStackData());

if (squareAddr !== undefined) {
  console.log('Manually jumping to square at address:', squareAddr);
  
  // Set up call frame like executeOp does
  const { toTaggedValue, Tag } = require('./dist/core/tagged');
  vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
  vm.rpush(vm.BP);
  vm.BP = vm.RP;
  vm.IP = squareAddr;
  
  console.log('IP set to:', vm.IP);
  console.log('First opcode at square address:', vm.memory.getUint8(vm.IP));
  console.log('Second opcode:', vm.memory.getUint8(vm.IP + 1));
  
  // Execute a few steps manually
  try {
    execute(); // This should run the square definition
    console.log('Stack after execution:', vm.getStackData());
  } catch (error) {
    console.log('Execution error:', error.message);
    console.log('IP at error:', vm.IP);
    console.log('Current opcode:', vm.memory.getUint8(vm.IP));
    console.log('Stack at error:', vm.getStackData());
  }
}

import { vm } from './src/core/globalState';
import { parse } from './src/lang/parser';
import { Tokenizer } from './src/lang/tokenizer';
import { Op } from './src/ops/opcodes';
import { SEG_CODE } from './src/core/constants';

// Reset VM to clean state
vm.reset();

console.log('=== Initial Setup ===');
console.log('Built-in function indices:');
console.log('  dup:', vm.symbolTable.find('dup'));
console.log('  mul:', vm.symbolTable.find('mul'));
console.log('  *:', vm.symbolTable.find('*'));

// Parse the square definition
console.log('\n=== Parsing ": square dup mul ;" ===');
const code = ': square dup mul ;';
parse(new Tokenizer(code));

console.log('Total bytecode length:', vm.compiler.CP);

// Show the complete bytecode sequence
console.log('\n=== Complete Bytecode Sequence ===');
const opcodeNames: { [key: number]: string } = {};
for (const [name, value] of Object.entries(Op)) {
  if (typeof value === 'number') {
    opcodeNames[value] = name;
  }
}

for (let i = 0; i < vm.compiler.CP; i++) {
  const byte = vm.memory.read8(SEG_CODE, i);
  let description = `raw byte ${byte}`;
  
  // Try to identify what this byte represents
  if (opcodeNames[byte]) {
    description = `Op.${opcodeNames[byte]}`;
  } else {
    // Check if it's a built-in function index
    const dupIndex = vm.symbolTable.find('dup');
    const mulIndex = vm.symbolTable.find('mul');
    const starIndex = vm.symbolTable.find('*');
    
    if (byte === dupIndex) {
      description = `dup (function index ${byte})`;
    } else if (byte === mulIndex) {
      description = `mul (function index ${byte})`;
    } else if (byte === starIndex) {
      description = `* (function index ${byte})`;
    } else if (byte >= 128) {
      description = `high-byte opcode marker (${byte})`;
    }
  }
  
  console.log(`[${i.toString().padStart(2)}]: 0x${byte.toString(16).padStart(2, '0')} (${byte.toString().padStart(3)}) - ${description}`);
}

// Show symbol table entry for square
console.log('\n=== Symbol Table ===');
const squareAddr = vm.symbolTable.findBytecodeAddress('square');
console.log('square bytecode address:', squareAddr);

// Analyze the branch structure
console.log('\n=== Branch Analysis ===');
if (vm.memory.read8(SEG_CODE, 0) === Op.Branch) {
  const branchOffset = vm.memory.read16(SEG_CODE, 1);
  console.log(`Branch at [0]: offset=${branchOffset}, used to skip over definition body`);
  console.log(`Square definition actual address: ${squareAddr}`);
  console.log(`Square definition starts at: ${3}`);
  console.log(`Square definition should be at bytecode address: ${squareAddr}`);
}

// Show what happens when we try to decode opcodes starting from square address
if (squareAddr !== undefined) {
  console.log(`\n=== Decoding from square address ${squareAddr} ===`);
  let pos = squareAddr;
  let step = 0;
  while (pos < vm.compiler.CP && step < 5) {
    const firstByte = vm.memory.read8(SEG_CODE, pos);
    let opcode = firstByte;
    let bytesUsed = 1;
    
    if ((firstByte & 0x80) !== 0) {
      // Multi-byte opcode
      const secondByte = vm.memory.read8(SEG_CODE, pos + 1);
      const lowBits = firstByte & 0x7f;
      const highBits = secondByte << 7;
      opcode = highBits | lowBits;
      bytesUsed = 2;
    }
    
    let description = `opcode ${opcode}`;
    if (opcodeNames[opcode]) {
      description = `Op.${opcodeNames[opcode]}`;
    } else if (opcode === vm.symbolTable.find('dup')) {
      description = `dup (${opcode})`;
    } else if (opcode === vm.symbolTable.find('mul') || opcode === vm.symbolTable.find('*')) {
      description = `mul/* (${opcode})`;
    }
    
    const byteDesc = bytesUsed === 1 ? 
      `0x${firstByte.toString(16).padStart(2, '0')}` :
      `0x${firstByte.toString(16).padStart(2, '0')} 0x${vm.memory.read8(SEG_CODE, pos + 1).toString(16).padStart(2, '0')}`;
      
    console.log(`  Step ${step}: [${pos}] ${byteDesc} -> ${description}`);
    
    pos += bytesUsed;
    step++;
  }
}

import { vm, initializeInterpreter } from './src/lang/runtime';
import { parse } from './src/lang/parser';
import { Tokenizer } from './src/lang/tokenizer';
import { Op } from './src/ops/opcodes';
import { SEG_CODE } from './src/core/constants';
import { findBytecodeAddress } from './src/core/dictionary';
import { getTaggedInfo } from './src/core';
import { memoryRead8, memoryRead16 } from './src/core/memory';

// Initialize VM and compiler (global vm singleton)
initializeInterpreter();
vm.IP = 0; // ensure clean IP for this debug run

console.log('=== Initial Setup ===');
console.log('Built-in function indices:');
const dupRef = vm.resolveSymbol('dup');
const mulRef = vm.resolveSymbol('mul');
const starRef = vm.resolveSymbol('*');
console.log('  dup:', dupRef ? getTaggedInfo(dupRef).value : 'undefined');
console.log('  mul:', mulRef ? getTaggedInfo(mulRef).value : 'undefined');
console.log('  *:', starRef ? getTaggedInfo(starRef).value : 'undefined');

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
  const byte = memoryRead8(vm.memory, SEG_CODE, i);
  let description = `raw byte ${byte}`;

  // Try to identify what this byte represents
  if (opcodeNames[byte]) {
    description = `Op.${opcodeNames[byte]}`;
  } else {
    // Check if it's a built-in function index
    const dupRef = vm.resolveSymbol('dup');
    const mulRef = vm.resolveSymbol('mul');
    const starRef = vm.resolveSymbol('*');
    const dupIndex = dupRef ? getTaggedInfo(dupRef).value : undefined;
    const mulIndex = mulRef ? getTaggedInfo(mulRef).value : undefined;
    const starIndex = starRef ? getTaggedInfo(starRef).value : undefined;

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

  console.log(
    `[${i.toString().padStart(2)}]: 0x${byte.toString(16).padStart(2, '0')} (${byte.toString().padStart(3)}) - ${description}`,
  );
}

// Show dictionary entry for square
console.log('\n=== Dictionary ===');
const squareAddr = findBytecodeAddress(vm, 'square');
console.log('square bytecode address:', squareAddr);

// Analyze the branch structure
console.log('\n=== Branch Analysis ===');
if (memoryRead8(vm.memory, SEG_CODE, 0) === Op.Branch) {
  const branchOffset = memoryRead16(vm.memory, SEG_CODE, 1);
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
    const firstByte = memoryRead8(vm.memory, SEG_CODE, pos);
    let opcode = firstByte;
    let bytesUsed = 1;

    if ((firstByte & 0x80) !== 0) {
      // Multi-byte opcode
      const secondByte = memoryRead8(vm.memory, SEG_CODE, pos + 1);
      const lowBits = firstByte & 0x7f;
      const highBits = secondByte << 7;
      opcode = highBits | lowBits;
      bytesUsed = 2;
    }

    let description = `opcode ${opcode}`;
    if (opcodeNames[opcode]) {
      description = `Op.${opcodeNames[opcode]}`;
    } else {
      const dupRef = vm.resolveSymbol('dup');
      const mulRef = vm.resolveSymbol('mul');
      const starRef = vm.resolveSymbol('*');
      const dupIndex = dupRef ? getTaggedInfo(dupRef).value : undefined;
      const mulIndex = mulRef ? getTaggedInfo(mulRef).value : undefined;
      const starIndex = starRef ? getTaggedInfo(starRef).value : undefined;
      if (opcode === dupIndex) {
        description = `dup (${opcode})`;
      } else if (opcode === mulIndex || opcode === starIndex) {
        description = `mul/* (${opcode})`;
      }
    }

    const byteDesc =
      bytesUsed === 1
        ? `0x${firstByte.toString(16).padStart(2, '0')}`
        : `0x${firstByte.toString(16).padStart(2, '0')} 0x${vm.memory
            .read8(SEG_CODE, pos + 1)
            .toString(16)
            .padStart(2, '0')}`;

    console.log(`  Step ${step}: [${pos}] ${byteDesc} -> ${description}`);

    pos += bytesUsed;
    step++;
  }
}

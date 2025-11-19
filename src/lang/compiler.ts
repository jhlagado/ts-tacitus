/**
 * @file Compiler for the Tacit virtual machine
 * Bytecode compiler for the Tacit language.
 */

import { type VM, Tag, Tagged, SEG_CODE, MIN_USER_OPCODE, InvalidOpcodeAddressError } from '@src/core';
import { encodeX1516 } from '../core/code-ref';
import { Op } from '../ops/opcodes';

export type CompilerState = {
  CP: number;
  BCP: number;
  preserve: boolean;
  isInFunction: boolean;
  reservePatchAddr: number;
};

export function makeCompiler(): CompilerState {
  return {
    CP: 0,
    BCP: 0,
    preserve: false,
    isInFunction: false,
    reservePatchAddr: -1,
  };
}

export function compilerCompile8(vm: VM, compiler: CompilerState, value: number): void {
  vm.memory.write8(SEG_CODE, compiler.CP, value);
  compiler.CP += 1;
}

export function compilerCompile16(vm: VM, compiler: CompilerState, value: number): void {
  const unsignedValue = value & 0xffff;
  vm.memory.write16(SEG_CODE, compiler.CP, unsignedValue);
  compiler.CP += 2;
}

export function compilerCompileFloat32(vm: VM, compiler: CompilerState, value: number): void {
  vm.memory.writeFloat32(SEG_CODE, compiler.CP, value);
  compiler.CP += 4;
}

export function compilerCompileAddress(vm: VM, compiler: CompilerState, value: number): void {
  const encoded = encodeX1516(value);
  const tagNum = Tagged(encoded, Tag.CODE);
  compilerCompileFloat32(vm, compiler, tagNum);
}

export function compilerCompileOpcode(vm: VM, compiler: CompilerState, opcodeAddress: number): void {
  if (opcodeAddress < 0 || opcodeAddress >= 32768) {
    throw new InvalidOpcodeAddressError(opcodeAddress);
  }

  if (opcodeAddress < MIN_USER_OPCODE) {
    compilerCompile8(vm, compiler, opcodeAddress);
    return;
  }

  compilerCompile8(vm, compiler, 0x80 | (opcodeAddress & 0x7f));
  compilerCompile8(vm, compiler, (opcodeAddress >> 7) & 0xff);
}

export function compilerCompileUserWordCall(vm: VM, compiler: CompilerState, address: number): void {
  if (address < 0 || address >= 32768) {
    throw new InvalidOpcodeAddressError(address);
  }

  compilerCompile8(vm, compiler, 0x80 | (address & 0x7f));
  compilerCompile8(vm, compiler, (address >> 7) & 0xff);
}

export function compilerReset(compiler: CompilerState): void {
  if (compiler.preserve) {
    compiler.BCP = compiler.CP;
  } else {
    compiler.CP = compiler.BCP;
  }
}

export function compilerPatch16(vm: VM, _compiler: CompilerState, address: number, value: number): void {
  vm.memory.write16(SEG_CODE, address, value);
}

export function compilerPatchOpcode(
  vm: VM,
  _compiler: CompilerState,
  address: number,
  opcodeAddress: number,
): void {
  if (opcodeAddress < 0 || opcodeAddress >= 32768) {
    throw new InvalidOpcodeAddressError(opcodeAddress);
  }

  if (opcodeAddress < MIN_USER_OPCODE) {
    vm.memory.write8(SEG_CODE, address, opcodeAddress);
    return;
  }

  vm.memory.write8(SEG_CODE, address, 0x80 | (opcodeAddress & 0x7f));
  vm.memory.write8(SEG_CODE, address + 1, (opcodeAddress >> 7) & 0xff);
}

export function compilerEnterFunction(compiler: CompilerState): void {
  compiler.isInFunction = true;
  compiler.reservePatchAddr = -1;
}

export function compilerEmitReserveIfNeeded(vm: VM, compiler: CompilerState): void {
  if (compiler.isInFunction && compiler.reservePatchAddr === -1) {
    compilerCompileOpcode(vm, compiler, Op.Reserve);
    compiler.reservePatchAddr = compiler.CP;
    compilerCompile16(vm, compiler, 0);
  }
}

export function compilerExitFunction(vm: VM, compiler: CompilerState): void {
  if (compiler.isInFunction && compiler.reservePatchAddr !== -1) {
    compilerPatch16(vm, compiler, compiler.reservePatchAddr, vm.localCount);
  }

  compiler.isInFunction = false;
  compiler.reservePatchAddr = -1;
}

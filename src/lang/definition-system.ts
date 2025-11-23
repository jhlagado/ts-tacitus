import {
  NestedDefinitionError,
  SyntaxError,
  UnclosedDefinitionError,
  Tagged,
  Tag,
} from '@src/core';
import {
  type VM,
  getStackData,
  emitOpcode,
  emitUint16,
  beginFunctionCompile,
  finishFunctionCompile,
  setCompilerPreserve,
  getCompilePointer,
  patchUint16,
  alignCompilePointer,
} from '../core/vm';
import { TokenType, type Tokenizer, tokenizerNext } from './tokenizer';
import { Op } from '../ops/opcodes';
import {
  markWithLocalReset,
  define,
  forget,
  hideDictionaryHead,
  unhideDictionaryHead,
  getDictionaryEntryInfo,
} from '../core/dictionary';
import { encodeX1516 } from '../core/code-ref';

export function beginDefinition(vm: VM, tokenizer: Tokenizer): void {
  if (vm.compile.entryCell !== -1) {
    throw new NestedDefinitionError(getStackData(vm));
  }

  const nameToken = tokenizerNext(tokenizer);
  if (nameToken.type !== TokenType.WORD && nameToken.type !== TokenType.NUMBER) {
    throw new SyntaxError('Expected word name after :', getStackData(vm));
  }

  const wordName = String(nameToken.value);

  if (wordName === ':' || wordName === ';') {
    throw new SyntaxError('Expected word name after :', getStackData(vm));
  }

  emitOpcode(vm, Op.Branch);
  const branchPos = getCompilePointer(vm);
  emitUint16(vm, 0);

  // Align the entrypoint so CODE references respect configured alignment
  alignCompilePointer(vm);

  const definitionStart = getCompilePointer(vm);
  define(vm, wordName, Tagged(encodeX1516(definitionStart), Tag.CODE, 0));
  hideDictionaryHead(vm);

  const checkpoint = markWithLocalReset(vm);

  vm.compile.branchPos = branchPos;
  vm.compile.checkpoint = checkpoint;
  vm.compile.entryCell = vm.compile.head;

  setCompilerPreserve(vm, true);
  beginFunctionCompile(vm);
}

export function endDefinition(vm: VM): void {
  if (vm.compile.entryCell === -1) {
    throw new SyntaxError('Unexpected semicolon', getStackData(vm));
  }

  emitOpcode(vm, Op.Exit);
  finishFunctionCompile(vm);

  patchBranchOffset(vm, vm.compile.branchPos);

  const checkpoint = vm.compile.checkpoint;
  const entryCell = vm.compile.entryCell;

  forget(vm, checkpoint);

  if (vm.compile.head !== entryCell) {
    throw new Error('Dictionary head changed during definition');
  }
  unhideDictionaryHead(vm);

  vm.compile.branchPos = -1;
  vm.compile.checkpoint = -1;
  vm.compile.entryCell = -1;
}

export function ensureNoOpenDefinition(vm: VM): void {
  if (vm.compile.entryCell === -1) {
    return;
  }

  let name = '<definition>';
  try {
    const { name: entryName } = getDictionaryEntryInfo(vm, vm.compile.entryCell);
    name = entryName;
  } catch {
    // fallback to placeholder if entry cannot be retrieved
  }

  throw new UnclosedDefinitionError(name, []);
}

export function patchBranchOffset(vm: VM, branchPos: number): void {
  const branchOffset = getCompilePointer(vm) - (branchPos + 2);
  patchUint16(vm, branchPos, branchOffset);
}

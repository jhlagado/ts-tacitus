import { NestedDefinitionError, SyntaxError, UnclosedDefinitionError, Tagged, Tag } from '@src/core';
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

export function beginDefinition(
  vm: VM,
  tokenizer: Tokenizer,
): void {
  if (vm.compile.defEntryCell !== -1) {
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

  const definitionStart = branchPos + 2;
  define(vm, wordName, Tagged(encodeX1516(definitionStart), Tag.CODE, 0));
  hideDictionaryHead(vm);

  const checkpoint = markWithLocalReset(vm);

  vm.compile.defBranchPos = branchPos;
  vm.compile.defCheckpoint = checkpoint;
  vm.compile.defEntryCell = vm.compile.head;

  setCompilerPreserve(vm, true);
  beginFunctionCompile(vm);
}

export function endDefinition(
  vm: VM,
): void {
  if (vm.compile.defEntryCell === -1) {
    throw new SyntaxError('Unexpected semicolon', getStackData(vm));
  }

  emitOpcode(vm, Op.Exit);
  finishFunctionCompile(vm);

  patchBranchOffset(vm, vm.compile.defBranchPos);

  const checkpoint = vm.compile.defCheckpoint;
  const entryCell = vm.compile.defEntryCell;

  forget(vm, checkpoint);

  if (vm.compile.head !== entryCell) {
    throw new Error('Dictionary head changed during definition');
  }
  unhideDictionaryHead(vm);

  vm.compile.defBranchPos = -1;
  vm.compile.defCheckpoint = -1;
  vm.compile.defEntryCell = -1;
}

export function ensureNoOpenDefinition(vm: VM): void {
  if (vm.compile.defEntryCell === -1) {
    return;
  }

  let name = '<definition>';
  try {
    const { name: entryName } = getDictionaryEntryInfo(vm, vm.compile.defEntryCell);
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

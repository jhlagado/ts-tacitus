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
import { TokenType, type Tokenizer } from './tokenizer';
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
  if (vm.defEntryCell !== -1) {
    throw new NestedDefinitionError(getStackData(vm));
  }

  const nameToken = tokenizer.nextToken();
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

  vm.defBranchPos = branchPos;
  vm.defCheckpoint = checkpoint;
  vm.defEntryCell = vm.head;

  setCompilerPreserve(vm, true);
  beginFunctionCompile(vm);
}

export function endDefinition(
  vm: VM,
): void {
  if (vm.defEntryCell === -1) {
    throw new SyntaxError('Unexpected semicolon', getStackData(vm));
  }

  emitOpcode(vm, Op.Exit);
  finishFunctionCompile(vm);

  patchBranchOffset(vm, vm.defBranchPos);

  const checkpoint = vm.defCheckpoint;
  const entryCell = vm.defEntryCell;

  forget(vm, checkpoint);

  if (vm.head !== entryCell) {
    throw new Error('Dictionary head changed during definition');
  }
  unhideDictionaryHead(vm);

  vm.defBranchPos = -1;
  vm.defCheckpoint = -1;
  vm.defEntryCell = -1;
}

export function ensureNoOpenDefinition(vm: VM): void {
  if (vm.defEntryCell === -1) {
    return;
  }

  let name = '<definition>';
  try {
    const { name: entryName } = getDictionaryEntryInfo(vm, vm.defEntryCell);
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

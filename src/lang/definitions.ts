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

export type ActiveDefinition = {
  branchPos: number;
  checkpoint: number; // Dictionary mark (heap position)
  entryCell: number;
};

export function beginDefinition(
  vm: VM,
  tokenizer: Tokenizer,
): void {
  if (vm.currentDefinition) {
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
  const definition: ActiveDefinition = {
    branchPos,
    checkpoint,
    entryCell: vm.head,
  };
  vm.currentDefinition = definition;

  setCompilerPreserve(vm, true);
  beginFunctionCompile(vm);
}

export function endDefinition(
  vm: VM,
): void {
  if (!vm.currentDefinition) {
    throw new SyntaxError('Unexpected semicolon', getStackData(vm));
  }

  emitOpcode(vm, Op.Exit);
  finishFunctionCompile(vm);

  patchBranchOffset(vm, vm.currentDefinition.branchPos);

  const { checkpoint, entryCell } = vm.currentDefinition;

  forget(vm, checkpoint);

  if (vm.head !== entryCell) {
    throw new Error('Dictionary head changed during definition');
  }
  unhideDictionaryHead(vm);

  vm.currentDefinition = null;
}

export function ensureNoOpenDefinition(vm: VM): void {
  const { currentDefinition } = vm;
  if (!currentDefinition) {
    return;
  }

  let name = '<definition>';
  try {
    const { name: entryName } = getDictionaryEntryInfo(vm, currentDefinition.entryCell);
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

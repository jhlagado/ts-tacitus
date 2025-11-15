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
import { type ActiveDefinition } from './state';
import { markWithLocalReset, define, forget } from '../core/dictionary';
import { encodeX1516 } from '../core/code-ref';

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

  const checkpoint = markWithLocalReset(vm);
  const definition: ActiveDefinition = {
    name: wordName,
    branchPos,
    checkpoint,
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

  const { name, branchPos, checkpoint } = vm.currentDefinition;
  const defStart = branchPos + 2;

  // Restore dictionary to checkpoint to remove local variable entries
  // This must happen BEFORE define so the function definition itself is preserved
  // This allows globals to be accessible after function definition
  forget(vm, checkpoint);

  define(vm, name, Tagged(encodeX1516(defStart), Tag.CODE, 0));

  vm.currentDefinition = null;
}

export function ensureNoOpenDefinition(currentDefinition: ActiveDefinition | null): void {
  if (currentDefinition) {
    throw new UnclosedDefinitionError(currentDefinition.name, []);
  }
}

export function patchBranchOffset(vm: VM, branchPos: number): void {
  const branchOffset = getCompilePointer(vm) - (branchPos + 2);
  patchUint16(vm, branchPos, branchOffset);
}

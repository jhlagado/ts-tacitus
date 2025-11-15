import { NestedDefinitionError, SyntaxError, UnclosedDefinitionError, Tagged, Tag } from '@src/core';
import { type VM, getStackData } from '../core/vm';
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

  vm.compiler.compileOpcode(Op.Branch);
  const branchPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  const checkpoint = markWithLocalReset(vm);
  const definition: ActiveDefinition = {
    name: wordName,
    branchPos,
    checkpoint,
  };
  vm.currentDefinition = definition;

  vm.compiler.preserve = true;
  vm.compiler.enterFunction();
}

export function endDefinition(
  vm: VM,
): void {
  if (!vm.currentDefinition) {
    throw new SyntaxError('Unexpected semicolon', getStackData(vm));
  }

  vm.compiler.compileOpcode(Op.Exit);
  vm.compiler.exitFunction();

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
  const endAddress = vm.compiler.CP;
  const branchOffset = endAddress - (branchPos + 2);

  const prevCP = vm.compiler.CP;

  vm.compiler.CP = branchPos;
  vm.compiler.compile16(branchOffset);

  vm.compiler.CP = prevCP;
}

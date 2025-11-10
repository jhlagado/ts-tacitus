import { NestedDefinitionError, SyntaxError, UnclosedDefinitionError } from '@src/core';
import { getStackData, type VM } from '../core/vm';
import { TokenType, type Tokenizer } from './tokenizer';
import { Op } from '../ops/opcodes';
import type { ActiveDefinition } from './state';
import { markWithLocalReset, defineCode, forget } from '../core/dictionary';

export function beginDefinition(
  vm: VM,
  tokenizer: Tokenizer,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  if (currentDefinition.current) {
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
  currentDefinition.current = definition;

  vm.compiler.preserve = true;
  vm.compiler.enterFunction();
}

export function endDefinition(
  vm: VM,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  if (!currentDefinition.current) {
    throw new SyntaxError('Unexpected semicolon', getStackData(vm));
  }

  vm.compiler.compileOpcode(Op.Exit);
  vm.compiler.exitFunction();

  patchBranchOffset(vm, currentDefinition.current.branchPos);

  const { name, branchPos, checkpoint } = currentDefinition.current;
  const defStart = branchPos + 2;
  
  // Restore dictionary to checkpoint to remove local variable entries
  // This must happen BEFORE defineCode so the function definition itself is preserved
  // This allows globals to be accessible after function definition
  forget(vm, checkpoint);
  
  defineCode(vm, name, defStart);

  currentDefinition.current = null;
}

export function ensureNoOpenDefinition(currentDefinition: {
  current: ActiveDefinition | null;
}): void {
  if (currentDefinition.current) {
    throw new UnclosedDefinitionError(currentDefinition.current.name, []);
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

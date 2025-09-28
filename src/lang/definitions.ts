import { NestedDefinitionError, SyntaxError, UnclosedDefinitionError } from '@src/core';
import { vm } from './runtime';
import { TokenType } from './tokenizer';
import { Op } from '../ops/opcodes';
import type { ParserState, ActiveDefinition } from './state';

export function beginDefinition(state: ParserState): void {
  if (state.currentDefinition) {
    throw new NestedDefinitionError(vm.getStackData());
  }

  const nameToken = state.tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD && nameToken.type !== TokenType.NUMBER) {
    throw new SyntaxError('Expected word name after :', vm.getStackData());
  }

  const wordName = String(nameToken.value);

  if (wordName === ':' || wordName === ';') {
    throw new SyntaxError('Expected word name after :', vm.getStackData());
  }

  vm.compiler.compileOpcode(Op.Branch);
  const branchPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  const checkpoint = vm.symbolTable.mark();
  const definition: ActiveDefinition = {
    name: wordName,
    branchPos,
    checkpoint,
  };
  state.currentDefinition = definition;

  vm.compiler.preserve = true;
  vm.compiler.enterFunction();
}

export function endDefinition(state: ParserState): void {
  if (!state.currentDefinition) {
    throw new SyntaxError('Unexpected semicolon', vm.getStackData());
  }

  vm.compiler.compileOpcode(Op.Exit);
  vm.compiler.exitFunction();

  patchBranchOffset(state.currentDefinition.branchPos);

  const { name, branchPos } = state.currentDefinition;
  const defStart = branchPos + 2;
  vm.symbolTable.defineCode(name, defStart);

  state.currentDefinition = null;
}

export function ensureNoOpenDefinition(state: ParserState): void {
  if (state.currentDefinition) {
    throw new UnclosedDefinitionError(state.currentDefinition.name, vm.getStackData());
  }
}

export function patchBranchOffset(branchPos: number): void {
  const endAddress = vm.compiler.CP;
  const branchOffset = endAddress - (branchPos + 2);

  const prevCP = vm.compiler.CP;

  vm.compiler.CP = branchPos;
  vm.compiler.compile16(branchOffset);

  vm.compiler.CP = prevCP;
}

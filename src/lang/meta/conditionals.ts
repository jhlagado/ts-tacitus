import { SyntaxError, Tag, getTaggedInfo } from '@src/core';
import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import { type VM, peekAt, depth, getStackData, pop, push } from '../../core/vm';
import { type Tokenizer } from '../tokenizer';

const ENDIF_CODE_REF = createBuiltinRef(Op.EndIf);

function patchPlaceholder(vm: VM, rawPos: number, word: string): void {
  if (!Number.isFinite(rawPos)) {
    throw new SyntaxError(`${word} missing branch placeholder`, getStackData(vm));
  }

  const branchPos = Math.trunc(rawPos);
  if (branchPos < 0) {
    throw new SyntaxError(`${word} invalid branch placeholder`, getStackData(vm));
  }

  const endAddress = vm.compiler.CP;
  const branchOffset = endAddress - (branchPos + 2);

  const prevCP = vm.compiler.CP;
  vm.compiler.CP = branchPos;
  vm.compiler.compile16(branchOffset);
  vm.compiler.CP = prevCP;
}

export function beginIfImmediate(
  vm: VM,
  _tokenizer: Tokenizer,
): void {
  vm.compiler.compileOpcode(Op.IfFalseBranch);
  const falseBranchPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  push(vm, falseBranchPos);
  push(vm, ENDIF_CODE_REF);
}

export function beginElseImmediate(
  vm: VM,
  _tokenizer: Tokenizer,
): void {
  if (depth(vm) < 2) {
    throw new SyntaxError('ELSE without IF', getStackData(vm));
  }

  const closer = pop(vm);
  const closerInfo = getTaggedInfo(closer);
  // Check Tag.CODE < 128 (represents builtin opcode)
  if (closerInfo.tag !== Tag.CODE || closerInfo.value >= 128 || closerInfo.value !== Op.EndIf) {
    throw new SyntaxError('ELSE without IF', getStackData(vm));
  }

  if (depth(vm) === 0) {
    throw new SyntaxError('ELSE without IF', getStackData(vm));
  }

  const placeholder = pop(vm);

  vm.compiler.compileOpcode(Op.Branch);
  const exitBranchPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  patchPlaceholder(vm, placeholder, 'ELSE');

  push(vm, exitBranchPos);
  push(vm, closer);
}

export function ensureNoOpenConditionals(vm: VM): void {
  // Scan stack via VM.peekAt to avoid potential NaN canonicalization issues
  const stackDepth = depth(vm);
  for (let offset = 0; offset < stackDepth; offset++) {
    const tval = peekAt(vm, offset); // 0 = TOS
    const { tag, value: opcode } = getTaggedInfo(tval);
    // Check Tag.CODE < 128 (represents builtin opcode)
    if (tag === Tag.CODE && opcode < 128) {
      if (opcode === Op.EndIf) {
        throw new SyntaxError('Unclosed IF', getStackData(vm));
      }
      if (opcode === Op.EndMatch) {
        throw new SyntaxError('Unclosed `match`', getStackData(vm));
      }
      if (opcode === Op.EndCase) {
        throw new SyntaxError('Unclosed case', getStackData(vm));
      }
    }
  }
}

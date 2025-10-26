import { SyntaxError, Tag, fromTaggedValue, STACK_BASE_CELLS } from '@src/core';
import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import { vm } from '../runtime';
import { requireParserState } from '../state';

const ENDIF_CODE_REF = createBuiltinRef(Op.EndIf);

function patchPlaceholder(rawPos: number, word: string): void {
  if (!Number.isFinite(rawPos)) {
    throw new SyntaxError(`${word} missing branch placeholder`, vm.getStackData());
  }

  const branchPos = Math.trunc(rawPos);
  if (branchPos < 0) {
    throw new SyntaxError(`${word} invalid branch placeholder`, vm.getStackData());
  }

  const endAddress = vm.compiler.CP;
  const branchOffset = endAddress - (branchPos + 2);

  const prevCP = vm.compiler.CP;
  vm.compiler.CP = branchPos;
  vm.compiler.compile16(branchOffset);
  vm.compiler.CP = prevCP;
}

export function beginIfImmediate(): void {
  requireParserState();

  vm.compiler.compileOpcode(Op.IfFalseBranch);
  const falseBranchPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  vm.push(falseBranchPos);
  vm.push(ENDIF_CODE_REF);
}

export function beginElseImmediate(): void {
  requireParserState();

  if (vm.sp - STACK_BASE_CELLS < 2) {
    throw new SyntaxError('ELSE without IF', vm.getStackData());
  }

  const closer = vm.pop();
  const closerInfo = fromTaggedValue(closer);
  if (closerInfo.tag !== Tag.BUILTIN || closerInfo.value !== Op.EndIf) {
    throw new SyntaxError('ELSE without IF', vm.getStackData());
  }

  if (vm.sp - STACK_BASE_CELLS === 0) {
    throw new SyntaxError('ELSE without IF', vm.getStackData());
  }

  const placeholder = vm.pop();

  vm.compiler.compileOpcode(Op.Branch);
  const exitBranchPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  patchPlaceholder(placeholder, 'ELSE');

  vm.push(exitBranchPos);
  vm.push(closer);
}

export function ensureNoOpenConditionals(): void {
  // Scan stack via VM.peekAt to avoid potential NaN canonicalization issues
  const depth = vm.sp - STACK_BASE_CELLS;
  for (let offset = 0; offset < depth; offset++) {
    const tval = vm.peekAt(offset); // 0 = TOS
    const { tag, value: opcode } = fromTaggedValue(tval);
    if (tag === Tag.BUILTIN) {
      if (opcode === Op.EndIf) {
        throw new SyntaxError('Unclosed IF', vm.getStackData());
      }
      if (opcode === Op.EndWhen) {
        throw new SyntaxError('Unclosed `when`', vm.getStackData());
      }
      if (opcode === Op.EndCase) {
        throw new SyntaxError('Unclosed case', vm.getStackData());
      }
    }
  }
}

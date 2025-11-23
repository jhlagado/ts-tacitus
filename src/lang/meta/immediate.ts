import { SyntaxError, Tag, getTaggedInfo, Tagged, Sentinel } from '@src/core';
import { createCodeRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import {
  type VM,
  rdepth,
  depth,
  getStackData,
  peek,
  push,
  pop,
  peekAt,
  emitOpcode,
  emitUint16,
  emitFloat32,
  getCompilePointer,
  patchUint16,
  alignCompilePointer,
} from '../../core/vm';

const ENDMATCH_CODE_REF = createCodeRef(Op.EndMatch);
const ENDWITH_CODE_REF = createCodeRef(Op.EndWith);
const ENDCASE_CODE_REF = createCodeRef(Op.EndCase);
const ENDOF_CODE_REF = createCodeRef(Op.EndOf);
const ENDIF_CODE_REF = createCodeRef(Op.EndIf);

// --- Match / With ---

export function beginMatchImmediateOp(vm: VM): void {
  // Push saved return stack snapshot as relative cells
  push(vm, rdepth(vm));
  push(vm, ENDMATCH_CODE_REF);
}

export function beginWithImmediateOp(vm: VM): void {
  if (depth(vm) === 0) {
    throw new SyntaxError('with without match', getStackData(vm));
  }

  const top = peek(vm);
  const { tag, value } = getTaggedInfo(top);
  // Check Tag.CODE < 128 (represents builtin opcode)
  if (tag !== Tag.CODE || value >= 128 || value !== Op.EndMatch) {
    throw new SyntaxError('with without match', getStackData(vm));
  }

  emitOpcode(vm, Op.IfFalseBranch);
  const skipPos = getCompilePointer(vm);
  emitUint16(vm, 0);

  push(vm, skipPos);
  push(vm, ENDWITH_CODE_REF);
}

// --- Capsules ---

/**
 * `capsule` opener (immediate):
 * - Validates we are inside a colon definition (TOS must be EndDefinition closer)
 * - Swaps the definition closer with EndCapsule so the shared `;` will close the capsule body
 * - Emits Op.ExitConstructor to freeze locals and return a capsule handle at runtime
 */
export function beginCapsuleImmediateOp(vm: VM): void {
  if (depth(vm) === 0) {
    throw new SyntaxError('`capsule` must appear inside a colon definition', getStackData(vm));
  }

  const tos = peek(vm);
  const { tag, value } = getTaggedInfo(tos);
  // Check Tag.CODE < 128 (represents builtin opcode)
  if (tag !== Tag.CODE || value >= 128 || value !== Op.EndDefinition) {
    throw new SyntaxError('`capsule` must appear inside a colon definition', getStackData(vm));
  }

  // Swap closer: EndDefinition -> EndCapsule
  pop(vm);
  push(vm, createCodeRef(Op.EndCapsule));

  // Emit constructor-exit opcode
  alignCompilePointer(vm);
  emitOpcode(vm, Op.ExitConstructor);
}

// --- Case ---

function assertOpenCase(vm: VM, word: string): void {
  if (depth(vm) === 0) {
    throw new SyntaxError(`${word} without open case`, getStackData(vm));
  }
  const closer = peek(vm);
  const { tag, value } = getTaggedInfo(closer);
  // Check Tag.CODE < 128 (represents builtin opcode)
  if (tag !== Tag.CODE || value >= 128 || value !== Op.EndCase) {
    throw new SyntaxError(`${word} without open case`, getStackData(vm));
  }
}

export function beginCaseImmediateOp(vm: VM): void {
  // Push saved return stack snapshot as relative cells
  push(vm, rdepth(vm));
  push(vm, ENDCASE_CODE_REF);
}

export function clauseDoImmediateOp(vm: VM): void {
  assertOpenCase(vm, "'do'");

  emitOpcode(vm, Op.Over);
  emitOpcode(vm, Op.Equal);
  emitOpcode(vm, Op.IfFalseBranch);
  const skipPos = getCompilePointer(vm);
  emitUint16(vm, 0);

  push(vm, skipPos);
  push(vm, ENDOF_CODE_REF);

  emitOpcode(vm, Op.Drop);
}

function compileSentinelLiteral(vm: VM, value: Sentinel): void {
  emitOpcode(vm, Op.LiteralNumber);
  emitFloat32(vm, Tagged(value, Tag.SENTINEL));
}

export function defaultImmediateOp(vm: VM): void {
  compileSentinelLiteral(vm, Sentinel.DEFAULT);
}

export function nilImmediateOp(vm: VM): void {
  compileSentinelLiteral(vm, Sentinel.NIL);
}

// --- Conditionals ---

function patchPlaceholder(vm: VM, rawPos: number, word: string): void {
  if (!Number.isFinite(rawPos)) {
    throw new SyntaxError(`${word} missing branch placeholder`, getStackData(vm));
  }

  const branchPos = Math.trunc(rawPos);
  if (branchPos < 0) {
    throw new SyntaxError(`${word} invalid branch placeholder`, getStackData(vm));
  }

  const branchOffset = getCompilePointer(vm) - (branchPos + 2);
  patchUint16(vm, branchPos, branchOffset);
}

export function beginIfImmediateOp(vm: VM): void {
  emitOpcode(vm, Op.IfFalseBranch);
  const falseBranchPos = getCompilePointer(vm);
  emitUint16(vm, 0);

  push(vm, falseBranchPos);
  push(vm, ENDIF_CODE_REF);
}

export function beginElseImmediateOp(vm: VM): void {
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

  emitOpcode(vm, Op.Branch);
  const exitBranchPos = getCompilePointer(vm);
  emitUint16(vm, 0);

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

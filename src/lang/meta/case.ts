import { SyntaxError, Tag, getTaggedInfo, Tagged, Sentinel } from '@src/core';
import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import {
  type VM,
  depth,
  rdepth,
  getStackData,
  peek,
  push,
  emitOpcode,
  emitUint16,
  emitFloat32,
  getCompilePointer,
} from '../../core/vm';

const ENDCASE_CODE_REF = createBuiltinRef(Op.EndCase);
const ENDOF_CODE_REF = createBuiltinRef(Op.EndOf);

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

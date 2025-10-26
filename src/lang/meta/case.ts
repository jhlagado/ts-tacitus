import {
  SyntaxError,
  Tag,
  fromTaggedValue,
  toTaggedValue,
  Sentinel,
  STACK_BASE_CELLS,
} from '@src/core';
import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import { vm } from '../runtime';
import { requireParserState } from '../state';

const ENDCASE_CODE_REF = createBuiltinRef(Op.EndCase);
const ENDOF_CODE_REF = createBuiltinRef(Op.EndOf);

function assertOpenCase(word: string): void {
  if (vm.sp - STACK_BASE_CELLS === 0) {
    throw new SyntaxError(`${word} without open case`, vm.getStackData());
  }
  const closer = vm.peek();
  const { tag, value } = fromTaggedValue(closer);
  if (tag !== Tag.BUILTIN || value !== Op.EndCase) {
    throw new SyntaxError(`${word} without open case`, vm.getStackData());
  }
}

export function beginCaseImmediate(): void {
  requireParserState();

  vm.push(vm.RSP);
  vm.push(ENDCASE_CODE_REF);
}

export function clauseOfImmediate(): void {
  requireParserState();

  assertOpenCase("'of'");

  vm.compiler.compileOpcode(Op.Over);
  vm.compiler.compileOpcode(Op.Equal);
  vm.compiler.compileOpcode(Op.IfFalseBranch);
  const skipPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  vm.push(skipPos);
  vm.push(ENDOF_CODE_REF);

  vm.compiler.compileOpcode(Op.Drop);
}

function compileSentinelLiteral(value: Sentinel): void {
  vm.compiler.compileOpcode(Op.LiteralNumber);
  vm.compiler.compileFloat32(toTaggedValue(value, Tag.SENTINEL));
}

export function defaultImmediate(): void {
  requireParserState();
  compileSentinelLiteral(Sentinel.DEFAULT);
}

export function nilImmediate(): void {
  requireParserState();
  compileSentinelLiteral(Sentinel.NIL);
}

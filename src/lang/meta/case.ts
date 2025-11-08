import { SyntaxError, Tag, fromTaggedValue, toTaggedValue, Sentinel } from '@src/core';
import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import { VM, depth, rdepth, getStackData, peek, push } from '../../core/vm';
import type { Tokenizer } from '../tokenizer';
import type { ActiveDefinition } from '../state';

const ENDCASE_CODE_REF = createBuiltinRef(Op.EndCase);
const ENDOF_CODE_REF = createBuiltinRef(Op.EndOf);

function assertOpenCase(vm: VM, word: string): void {
  if (depth(vm) === 0) {
    throw new SyntaxError(`${word} without open case`, getStackData(vm));
  }
  const closer = peek(vm);
  const { tag, value } = fromTaggedValue(closer);
  if (tag !== Tag.BUILTIN || value !== Op.EndCase) {
    throw new SyntaxError(`${word} without open case`, getStackData(vm));
  }
}

export function beginCaseImmediate(
  vm: VM,
  _tokenizer: Tokenizer,
  _currentDefinition: { current: ActiveDefinition | null },
): void {
  // Push saved return stack snapshot as relative cells
  push(vm, rdepth(vm));
  push(vm, ENDCASE_CODE_REF);
}

export function clauseOfImmediate(
  vm: VM,
  _tokenizer: Tokenizer,
  _currentDefinition: { current: ActiveDefinition | null },
): void {

  assertOpenCase(vm, "'of'");

  vm.compiler.compileOpcode(Op.Over);
  vm.compiler.compileOpcode(Op.Equal);
  vm.compiler.compileOpcode(Op.IfFalseBranch);
  const skipPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  push(vm, skipPos);
  push(vm, ENDOF_CODE_REF);

  vm.compiler.compileOpcode(Op.Drop);
}

function compileSentinelLiteral(vm: VM, value: Sentinel): void {
  vm.compiler.compileOpcode(Op.LiteralNumber);
  vm.compiler.compileFloat32(toTaggedValue(value, Tag.SENTINEL));
}

export function defaultImmediate(
  vm: VM,
  _tokenizer: Tokenizer,
  _currentDefinition: { current: ActiveDefinition | null },
): void {
  compileSentinelLiteral(vm, Sentinel.DEFAULT);
}

export function nilImmediate(
  vm: VM,
  _tokenizer: Tokenizer,
  _currentDefinition: { current: ActiveDefinition | null },
): void {
  compileSentinelLiteral(vm, Sentinel.NIL);
}

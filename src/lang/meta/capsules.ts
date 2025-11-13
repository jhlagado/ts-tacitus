import { SyntaxError, getTaggedInfo, Tag } from '@src/core';
import { type VM, getStackData, peek, pop, push, depth } from '../../core/vm';
import { createBuiltinRef } from '@src/core/code-ref';
import { Op } from '@src/ops/opcodes';
import { type Tokenizer } from '../tokenizer';
import { type ActiveDefinition } from '../state';

/**
 * `capsule` opener (immediate):
 * - Validates we are inside a colon definition (TOS must be EndDefinition closer)
 * - Swaps the definition closer with EndCapsule so the shared `;` will close the capsule body
 * - Emits Op.ExitConstructor to freeze locals and return a capsule handle at runtime
 */
export function beginCapsuleImmediate(
  vm: VM,
  _tokenizer: Tokenizer,
  _currentDefinition: { current: ActiveDefinition | null },
): void {
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
  push(vm, createBuiltinRef(Op.EndCapsule));

  // Emit constructor-exit opcode
  vm.compiler.compileOpcode(Op.ExitConstructor);
}

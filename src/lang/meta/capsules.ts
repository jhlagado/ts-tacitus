import { SyntaxError, fromTaggedValue, Tag } from '@src/core';
import { vm } from '../runtime';
import { createBuiltinRef } from '@src/core/code-ref';
import { Op } from '@src/ops/opcodes';

/**
 * `capsule` opener (immediate):
 * - Validates we are inside a colon definition (TOS must be EndDefinition closer)
 * - Swaps the definition closer with EndCapsule so the shared `;` will close the capsule body
 * - Emits Op.ExitConstructor to freeze locals and return a capsule handle at runtime
 */
export function beginCapsuleImmediate(): void {
  if (vm.SP === 0) {
    throw new SyntaxError('`capsule` must appear inside a colon definition', vm.getStackData());
  }

  const tos = vm.peek();
  const { tag, value } = fromTaggedValue(tos);
  if (tag !== Tag.BUILTIN || value !== Op.EndDefinition) {
    throw new SyntaxError('`capsule` must appear inside a colon definition', vm.getStackData());
  }

  // Swap closer: EndDefinition -> EndCapsule
  vm.pop();
  vm.push(createBuiltinRef(Op.EndCapsule));

  // Emit constructor-exit opcode
  vm.compiler.compileOpcode(Op.ExitConstructor);
}

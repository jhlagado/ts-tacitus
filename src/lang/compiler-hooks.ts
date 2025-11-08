/**
 * @file src/lang/compiler-hooks.ts
 * Provides hook registration for compiler-time operations that need to be invoked from VM opcodes.
 */

import type { VM } from '../core/vm';
import type { ActiveDefinition } from './state';
import { endDefinition } from './definitions';

/**
 * Invokes the end-definition handler using the currentDefinition stored on vm.
 * Throws if vm doesn't have currentDefinition set.
 */
export function invokeEndDefinitionHandler(vm: VM & { _currentDefinition?: { current: ActiveDefinition | null } }): void {
  if (!vm._currentDefinition) {
    throw new Error('End-definition handler not installed');
  }
  endDefinition(vm, vm._currentDefinition);
}

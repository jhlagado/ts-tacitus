/**
 * @file src/ops/access-ops.ts
 *
 * High-level access combinators for TACIT VM.
 * Provides path-based navigation through nested list/maplist structures.
 *
 * Stack Effects:
 * - get: ( target { path } -- value | nil )
 * - set: ( value target { path } -- ok | nil )
 */

import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { NIL } from '@src/core/tagged';

/**
 * Get combinator stub - Step 2 minimal implementation
 *
 * Stack effect: ( target blockAddr -- nil )
 *
 * This is a placeholder that ensures syntax works without crashing.
 * Full implementation will be added in Step 3.
 */
export const getOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'get');

  // Pop the path block and target (ignore for now)
  vm.pop(); // path block
  vm.pop(); // target

  // Always return NIL for Step 2
  vm.push(NIL);
};

/**
 * Set combinator stub - Step 2 minimal implementation
 *
 * Stack effect: ( value target blockAddr -- nil )
 *
 * This is a placeholder that ensures syntax works without crashing.
 * Full implementation will be added in Step 3.
 */
export const setOp: Verb = (vm: VM) => {
  vm.ensureStackSize(3, 'set');

  // Pop the path block, target, and value (ignore for now)
  vm.pop(); // path block
  vm.pop(); // target
  vm.pop(); // value

  // Always return NIL for Step 2
  vm.push(NIL);
};

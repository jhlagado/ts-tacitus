/**
 * @file src/ops/access/retrieve-update-ops.ts
 * High-level path-based retrieve/update built from select/load/store.
 */

import { VM, Verb } from '@src/core';
import { selectOp } from './select-ops';
import { loadOp, storeOp } from '../lists';
import { nipOp } from '../stack';

/**
 * retrieve: ( target path -- value|NIL )
 * - Uses select to get a reference to the addressed cell
 * - load to apply value-by-default semantics (materialize lists)
 * - nip to drop the original target
 */
export const retrieveOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'retrieve');
  // ( target path )
  selectOp(vm); // -> ( target ref|NIL )
  loadOp(vm);   // -> ( target value|NIL )
  nipOp(vm);    // -> ( value|NIL )
};

/**
 * update: ( value target path -- )
 * - Uses select to get reference to destination cell for target/path
 * - nip to drop the target while keeping (value ref) order
 * - store to apply assignment rules (simple/simple or compound/compound)
 *
 * Note for locals:
 * - To mutate a local in-place, pass a reference target (e.g., `&x`).
 *   Bare `x` compiles to value semantics (materialized list) and will not
 *   write through to the local's return-stack storage.
 */
export const updateOp: Verb = (vm: VM) => {
  vm.ensureStackSize(3, 'update');
  // Stack: ( value target path )
  // select expects (target path) at the top; `value` sits below and is ignored by select
  selectOp(vm); // -> ( value target ref|NIL )
  // Remove target, keep (value ref) for store
  nipOp(vm);    // -> ( value ref|NIL )
  // store expects address/ref on TOS and value below; our order matches
  storeOp(vm);  // -> ( ) side-effect only
};


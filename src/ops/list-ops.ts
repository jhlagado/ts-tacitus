/**
 * @file src/ops/list-ops.ts
 * LIST operations for the Tacit VM.
 */

import { VM } from '../core/vm';
import { fromTaggedValue, toTaggedValue, Tag, getTag, NIL } from '../core/tagged';
import { isRef, createStackRef, resolveReference, readReference, createSegmentRef } from '../core/refs';
import { evalOp } from './core-ops';
import { SEG_STACK, SEG_RSTACK } from '../core/constants';
import { Verb } from '../core/types';
import { ReturnStackUnderflowError } from '../core/errors';
import { getListLength, reverseSpan, getListElementAddress, isList } from '../core/list';
import { getListHeaderAndBase, computeHeaderAddr } from './lists/core-helpers';
import { dropOp, findElement, swapOp } from './stack-ops';
import { isCompoundData, isCompatibleCompound, mutateCompoundInPlace } from './local-vars-transfer';
import { areValuesEqual } from '../core/utils';

const CELL_SIZE = 4;

/**
 * Opens LIST construction.
 */
// openListOp moved to src/ops/lists/build-ops.ts

/**
 * Closes LIST construction.
 */
// closeListOp moved to src/ops/lists/build-ops.ts

// getListHeaderAndBase now imported from './lists/core-helpers'

/**
 * Gets slot count from LIST header.
 * Returns the total number of stack slots occupied by the list (including nested lists).
 * See docs/specs/lists.md for slot vs element count semantics.
 * Renamed from slots to length.
 */
// lengthOp moved to src/ops/lists/query-ops.ts

/**
 * Returns element count by traversal.
 * Counts the number of top-level elements in the list (not stack slots).
 * See docs/specs/lists.md for slot vs element count semantics.
 */
// sizeOp moved to src/ops/lists/query-ops.ts

/**
 * cons: ( list value — list' )
 */

/**
 * tail: ( list — list' )
 * Removes the first element from a list (drops the head).
 */
// tailOp moved to src/ops/lists/structure-ops.ts
// dropHeadOp moved to src/ops/lists/structure-ops.ts

/**
 * Concatenates two lists into a new combined list.
 * Stack effect: ( listA listB — listC )
 *
 * NOTE: Current implementation is incomplete - only creates combined headers
 * without properly copying payload data for list-to-list concatenation.
 *
 * Working fallback semantics:
 * - If listA is not a list: returns NIL
 * - If listB is not a list: performs cons(listA, listB)
 * - Empty list cases work correctly
 *
 * See docs/specs/lists.md for list concatenation semantics.
 */

/**
 * Polymorphic concatenation operation.
 * Stack effect: ( a b — result )
 * Dispatches to optimal implementation based on argument types:
 * - simple + simple → create 2-element list
 * - list + simple → O(1) append (increment header)
 * - simple + list → O(n) prepend
 * - list + list → O(n) concatenate
 */
// concatOp moved to src/ops/lists/structure-ops.ts

// removed deprecated concat sub-ops (now in structure-ops unified path)

/**
 * Returns first element or nil.
 * Stack effect: ( list -- head | nil )
 * Spec: lists.md §12
 */
// headOp moved to src/ops/lists/structure-ops.ts


/**
 * Returns address of payload slot at slot index.
 * Stack effect: ( list_or_ref idx -- list_or_ref addr )
 * Spec: lists.md §10 - addr = SP - 1 - idx
 *
 * Polymorphic: accepts LIST (stack-relative) or STACK_REF (memory-based)
 */
// slotOp moved to src/ops/lists/query-ops.ts

/**
 * Returns address of element start at logical index.
 * Stack effect: ( list_or_ref idx -- list_or_ref addr )
 * Spec: lists.md §10 - uses traversal to find element start
 *
 * Polymorphic: accepts LIST (stack-relative) or STACK_REF (memory-based)
 */
// elemOp moved to src/ops/lists/query-ops.ts

/**
 * Fetches value at memory address.
 * Stack effect: ( addr -- value )
 * Spec: lists.md §10 - Simple values direct, compound values materialized
 *
 * Polymorphic: accepts STACK_REF and RSTACK_REF (cell addresses)
 */
// fetchOp moved to src/ops/lists/query-ops.ts

/**
 * Stores value at memory address (simple values only).
 * Stack effect: ( value addr -- )
 * Spec: lists.md §10 - Only simple values, compounds are no-op
 *
 * Polymorphic: accepts STACK_REF, RSTACK_REF, and GLOBAL_REF addresses
 */
// storeOp moved to src/ops/lists/query-ops.ts

/**
 * Generic block-to-list converter.
 * Stack effect: ( {block} -- list )
 *
 * Executes the block and converts all pushed elements into a list.
 * Uses the same SP marking and list construction patterns as openListOp/closeListOp.
 */
// makeListOp moved to src/ops/lists/build-ops.ts

/**
 * Creates list from n stack items.
 * Stack effect: ( item-n ... item-0 n -- list )
 * Spec: glossary.md - Build list from n stack items
 */
// packOp moved to src/ops/lists/build-ops.ts

/**
 * Pushes list elements onto stack individually.
 * Stack effect: ( list -- item-n ... item-0 )
 * Spec: glossary.md - Push elements; inverse of pack (without count)
 */
// unpackOp moved to src/ops/lists/build-ops.ts

/**
 * Implements the enlist operation.
 * Converts a single value into a single-element list.
 *
 * Stack effect: ( value — LIST:1 )
 */
// enlistOp moved to src/ops/lists/build-ops.ts

/**
 * Reverses the elements of a list.
 * Stack effect: ( list -- list' )
 * Spec: Returns a new list with elements in reverse order
 */
// reverseOp moved to src/ops/lists/structure-ops.ts


/**
 * Implements maplist key lookup with address-returning semantics.
 * Stack effect: ( maplist_or_ref key -- maplist_or_ref addr | default-addr | NIL )
 * Spec: maplists.md §4 - Returns address of value by key comparison
 *
 * Maplist convention: ( key1 value1 key2 value2 ... )
 * Keys at even positions (0,2,4), values at odd positions (1,3,5)
 * On key match: returns address of corresponding value
 * On miss with 'default' key present: returns default value address
 * On miss without default: returns NIL
 *
 * Polymorphic: accepts LIST (stack-relative) or STACK_REF (memory-based)
 */
// findOp moved to src/ops/lists/query-ops.ts

/**
 * Extracts all keys from a maplist.
 * Stack effect: ( maplist -- maplist keys )
 * Spec: maplists.md §9 - Extract keys at positions 0,2,4...
 *
 * Returns a new list containing only the keys from even positions.
 * Invalid maplist (odd slot count) returns NIL.
 */
export function keysOp(vm: VM): void {
  vm.ensureStackSize(1, 'keys');
  const target = vm.peek();

  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  if (slotCount % 2 !== 0) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  // Preserve original target on the stack as per spec stack effect
  vm.pop();
  vm.push(info.header);

  if (slotCount === 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const keyCount = slotCount / 2;
  const headerAddr = info.baseAddr + slotCount * CELL_SIZE;

  for (let i = keyCount - 1; i >= 0; i--) {
    const keyAddr = headerAddr - CELL_SIZE - i * 2 * CELL_SIZE;
    const keyValue = vm.memory.readFloat32(info.segment, keyAddr);
    vm.push(keyValue);
  }

  vm.push(toTaggedValue(keyCount, Tag.LIST));
}

/**
 * Extracts all values from a maplist.
 * Stack effect: ( maplist -- maplist values )
 * Spec: maplists.md §9 - Extract values at positions 1,3,5...
 *
 * Returns a new list containing only the values from odd positions.
 * Invalid maplist (odd slot count) returns NIL.
 */
export function valuesOp(vm: VM): void {
  vm.ensureStackSize(1, 'values');
  const target = vm.peek();

  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  if (slotCount % 2 !== 0) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  // Preserve original target on the stack as per spec stack effect
  vm.pop();
  vm.push(info.header);

  if (slotCount === 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const valueCount = slotCount / 2;
  const headerAddr = info.baseAddr + slotCount * CELL_SIZE;

  for (let i = valueCount - 1; i >= 0; i--) {
    const valueAddr = headerAddr - CELL_SIZE - (i * 2 + 1) * CELL_SIZE;
    const valueValue = vm.memory.readFloat32(info.segment, valueAddr);
    vm.push(valueValue);
  }

  vm.push(toTaggedValue(valueCount, Tag.LIST));
}

/**
 * Creates a STACK_REF pointing to a list on the data stack.
 * Stack effect: ( list -- list STACK_REF )
 * Spec: polymorphic-operations.md §84 - Convert list to reference
 *
 * The list remains on the stack, the STACK_REF points to its header location.
 * Only works with LIST values on the data stack.
 */
export function refOp(vm: VM): void {
  vm.ensureStackSize(1, 'ref');
  const value = vm.peek();
  const tag = getTag(value);

  if (tag === Tag.LIST) {
    const headerCellIndex = (vm.SP - 4) / 4;
    vm.push(createSegmentRef(SEG_STACK, headerCellIndex));
  }
}

/**
 * Materializes any reference to the data stack.
 * Stack effect: ( ref -- value )
 * Spec: polymorphic-operations.md §95 - Polymorphic reference materialization
 *
 * Works with STACK_REF, RSTACK_REF, and GLOBAL_REF (when implemented).
 * For compound data (lists), materializes the entire structure.
 * For simple values, copies the value directly.
 */
export function resolveOp(vm: VM): void {
  vm.ensureStackSize(1, 'resolve');
  const value = vm.pop();

  if (isRef(value)) {
    const { address, segment } = resolveReference(vm, value);
    const referencedValue = vm.memory.readFloat32(segment, address);

    if (getTag(referencedValue) === Tag.LIST) {
      const slotCount = getListLength(referencedValue);

      for (let i = 0; i < slotCount; i++) {
        const slotValue = vm.memory.readFloat32(segment, address - (slotCount - i) * CELL_SIZE);
        vm.push(slotValue);
      }
      vm.push(referencedValue);
    } else {
      vm.push(referencedValue);
    }
  } else {
    vm.push(value);
  }
}

// Forward exports for moved query ops (Phase 2)
export { lengthOp, sizeOp, slotOp, elemOp, fetchOp, storeOp, findOp } from './lists/query-ops';
// Forward exports for moved build ops (Phase 3)
export { openListOp, closeListOp, makeListOp, packOp, unpackOp, enlistOp } from './lists/build-ops';

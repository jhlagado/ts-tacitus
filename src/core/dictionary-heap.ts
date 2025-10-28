/**
 * @file src/core/dictionary-heap.ts
 * Helpers for building dictionary entries on top of the global heap.
 *
 * This module depends on global heap primitives but keeps heap unaware of
 * dictionary layout. It writes entries as [payload name prev LIST:3].
 */
import { VM } from './vm';
import { CELL_SIZE, GLOBAL_BASE, GLOBAL_SIZE, SEG_DATA } from './constants';
import { createGlobalRef } from './refs';
import { toTaggedValue, Tag, NIL } from './tagged';


/**
 * Pushes a dictionary entry onto the global heap with layout:
 * [ payload  name  prev  LIST:3 ]
 * Returns references to the entry header and the payload cell.
 */
export interface DictionaryEntryHandles {
  entryRef: number;
  payloadRef: number;
}

export function pushDictionaryEntry(
  vm: VM,
  payload: number,
  name: number,
  prev: number = NIL,
): DictionaryEntryHandles {
  const slotCount = 3;
  const span = slotCount + 1;

  // Capacity check consistent with heap discipline
  const globalCapacityCells = GLOBAL_SIZE / CELL_SIZE;
  if (vm.gp + span > globalCapacityCells) {
    throw new Error('Global heap exhausted');
  }

  const baseCell = vm.gp;

  vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + (baseCell + 0) * CELL_SIZE, payload);
  vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + (baseCell + 1) * CELL_SIZE, name);
  vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + (baseCell + 2) * CELL_SIZE, prev);
  const headerCellIndex = baseCell + slotCount;
  vm.memory.writeFloat32(
    SEG_DATA,
    GLOBAL_BASE + headerCellIndex * CELL_SIZE,
    toTaggedValue(slotCount, Tag.LIST),
  );

  vm.gp = baseCell + span;
  const entryRef = createGlobalRef(headerCellIndex);
  const payloadRef = createGlobalRef(baseCell);
  return { entryRef, payloadRef };
}

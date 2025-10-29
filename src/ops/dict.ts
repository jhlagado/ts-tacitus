/**
 * @file src/ops/dict.ts
 * Heap-backed dictionary ops that do not depend on symbol-table or dictionary-heap.
 *
 * Entry layout on global heap (LIST of 3): [prevRef, valueRef, name]
 * - prevRef: DATA_REF | NIL to previous entry header
 * - valueRef: DATA_REF to value (simple cell or LIST header)
 * - name: STRING tagged value
 */

import {
  VM,
  NIL,
  Tag,
  toTaggedValue,
  fromTaggedValue,
  isString,
  isList,
  isNIL,
  getListLength,
  validateListHeader,
  pushListToGlobalHeap,
  pushSimpleToGlobalHeap,
  isRef,
  getByteAddressFromRef,
  SEG_DATA,
  CELL_SIZE,
  createGlobalRef,
  getAbsoluteCellIndexFromRef,
} from '@src/core';

// Build a LIST entry [prevRef, valueRef, name] on data stack and copy to global heap.
function pushEntryToHeap(vm: VM, prevRef: number, valueRef: number, name: number): number {
  // Payload order: prevRef, valueRef, name, then LIST header of length 3
  vm.push(prevRef);
  vm.push(valueRef);
  vm.push(name);
  const header = toTaggedValue(3, Tag.LIST);
  vm.push(header);
  const baseCell = vm.sp - 1 - 3;
  const baseAddrBytes = baseCell * CELL_SIZE;
  const ref = pushListToGlobalHeap(vm, { header, baseAddrBytes });
  validateListHeader(vm);
  // Remove temporary list from data stack
  for (let i = 0; i < 4; i++) vm.pop();
  return ref;
}

// Converts a value at NOS (under name) into a DATA_REF on global heap, preserving refs.
function materializeValueRef(vm: VM, value: number): number {
  if (isRef(value)) {
    return value;
  }
  if (isList(value)) {
    // Header is currently under TOS once name is popped
    validateListHeader(vm);
    const header = vm.peek();
    const n = getListLength(header);
    const baseCell = vm.sp - 1 - n;
    const baseAddrBytes = baseCell * CELL_SIZE;
    const ref = pushListToGlobalHeap(vm, { header, baseAddrBytes });
    // Drop the original list from the data stack
    for (let i = 0; i < n + 1; i++) vm.pop();
    return ref;
  }
  // Simple scalar: copy one cell to heap and consume it from stack
  const ref = pushSimpleToGlobalHeap(vm, value);
  return ref;
}

// define: ( value name — )
export function defineOp(vm: VM): void {
  vm.ensureStackSize(2, 'define');
  const name = vm.peek();
  if (!isString(name)) {
    throw new Error('define expects STRING name');
  }
  const value = vm.peekAt(1);

  // Pop name to expose value (especially for LIST path)
  vm.pop();

  let valueRef: number;
  if (isList(value)) {
    valueRef = materializeValueRef(vm, value);
  } else if (isRef(value)) {
    // Remove original value from stack
    vm.pop();
    valueRef = value;
  } else {
    valueRef = pushSimpleToGlobalHeap(vm, value);
    // Remove original value from stack
    vm.pop();
  }

  // Build entry list and update new dictionary head
  const prevRef = vm.newDictHead ?? NIL;
  const entryRef = pushEntryToHeap(vm, prevRef, valueRef, name);
  vm.newDictHead = entryRef;
}

// lookup: ( name — ref|NIL )
export function lookupOp(vm: VM): void {
  vm.ensureStackSize(1, 'lookup');
  const name = vm.pop();
  if (!isString(name)) {
    throw new Error('lookup expects STRING name');
  }

  let cur = vm.newDictHead;
  const targetName = vm.digest.get(fromTaggedValue(name).value);
  while (!isNIL(cur)) {
    // Read header at global ref
    const hAddr = getByteAddressFromRef(cur);
    const header = vm.memory.readFloat32(SEG_DATA, hAddr);
    if (!isList(header) || getListLength(header) !== 3) {
      // Malformed entry; abort search
      break;
    }
    const base = hAddr - 3 * CELL_SIZE;
    const prevRef = vm.memory.readFloat32(SEG_DATA, base + 0 * CELL_SIZE);
    const valueRef = vm.memory.readFloat32(SEG_DATA, base + 1 * CELL_SIZE);
    const entryName = vm.memory.readFloat32(SEG_DATA, base + 2 * CELL_SIZE);

    const n1 = fromTaggedValue(entryName);
    const n2 = fromTaggedValue(name);
    if (n1.tag === Tag.STRING && n2.tag === Tag.STRING) {
      const entryStr = vm.digest.get(n1.value);
      if (entryStr === targetName) {
        vm.push(valueRef);
        return;
      }
    }

    cur = isRef(prevRef) ? prevRef : NIL;
  }
  // Fallback: consult SymbolTable for transitional phase; return tagged value directly
  const fallback = vm.symbolTable.findTaggedValue(targetName);
  if (fallback !== undefined) {
    vm.push(fallback);
    return;
  }
  vm.push(NIL);
}

// mark: ( — ref )
export function markOp(vm: VM): void {
  const ref = createGlobalRef(vm.gp);
  vm.push(ref);
}

// forget: ( ref — )
export function forgetOp(vm: VM): void {
  vm.ensureStackSize(1, 'forget');
  const ref = vm.pop();
  const abs = getAbsoluteCellIndexFromRef(ref);
  const gBase = createGlobalRef(0); // absolute of first global cell
  const baseAbs = getAbsoluteCellIndexFromRef(gBase);
  const gpNew = abs - baseAbs;
  if (!Number.isInteger(gpNew) || gpNew < 0 || gpNew > vm.gp) {
    throw new Error('forget mark out of range');
  }
  vm.gp = gpNew;
}

// Dict-first lookup toggles (no stack effect)
export function dictFirstOnOp(vm: VM): void {
  vm.symbolTable.setDictFirstLookup(true);
}

export function dictFirstOffOp(vm: VM): void {
  vm.symbolTable.setDictFirstLookup(false);
}

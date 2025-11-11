# Cell Conversion Audit

This document identifies all code that uses `writeFloat32` and `readFloat32` with `SEG_DATA` that should be converted to use `writeCell` and `readCell` instead.

## Conversion Patterns

### Pattern 1: `BASE_BYTES + cellIndex * CELL_SIZE` → `BASE_CELLS + cellIndex`

These can be directly converted to use cell indices.

### Pattern 2: `byteAddress` (absolute) → `byteAddress / CELL_SIZE`

When an absolute byte address is used, convert to cell index by dividing by `CELL_SIZE`.

### Pattern 3: `vm.sp * CELL_SIZE` or `vm.bp * CELL_SIZE` → `vm.sp` or `vm.bp`

VM registers are already in cells, so no conversion needed.

## Source Files Requiring Conversion

### Core Files

#### `src/core/refs.ts`

- **Line 84**: `vm.memory.readFloat32(SEG_DATA, byteAddr)`
  - Convert: `vm.memory.readCell(byteAddr / CELL_SIZE)`
- **Line 206**: `vm.memory.writeFloat32(SEG_DATA, address, value)`
  - Convert: `vm.memory.writeCell(address / CELL_SIZE, value)`

#### `src/core/global-heap.ts`

- **Line 37**: `vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE_BYTES + byteOffset, value)`
  - Convert: `vm.memory.writeCell(GLOBAL_BASE_CELLS + cellIndex, value)`
- **Line 58**: `vm.memory.readFloat32(SEG_DATA, srcBase + i * CELL_SIZE)`
  - Convert: `vm.memory.readCell((srcBase / CELL_SIZE) + i)`
- **Line 59**: `vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE_BYTES + (destBaseCell + i) * CELL_SIZE, value)`
  - Convert: `vm.memory.writeCell(GLOBAL_BASE_CELLS + destBaseCell + i, value)`
- **Line 63**: `vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE_BYTES + headerCellIndex * CELL_SIZE, source.header)`
  - Convert: `vm.memory.writeCell(GLOBAL_BASE_CELLS + headerCellIndex, source.header)`

#### `src/core/vm.ts`

- **Line 255**: `const byteOffset = STACK_BASE_BYTES + i * CELL_SIZE_BYTES;`
  - Convert: `vm.memory.readCell(STACK_BASE_CELLS + i)`
- **Line 465**: `const byteOffset = GLOBAL_BASE_BYTES + vm.gp * CELL_SIZE_BYTES;`
  - Convert: `vm.memory.writeCell(GLOBAL_BASE_CELLS + vm.gp, value)`
- **Line 480**: `const byteOffset = GLOBAL_BASE_BYTES + (vm.gp - 1) * CELL_SIZE_BYTES;`
  - Convert: `vm.memory.readCell(GLOBAL_BASE_CELLS + vm.gp - 1)`
- **Line 495**: `const byteOffset = GLOBAL_BASE_BYTES + vm.gp * CELL_SIZE_BYTES;`
  - Convert: `vm.memory.writeCell(GLOBAL_BASE_CELLS + vm.gp, value)`

#### `src/core/dictionary.ts`

- **Line 31**: `return GLOBAL_BASE_BYTES + cellIndex * CELL_SIZE;`
  - This is a helper function returning byte address, not a memory access - may not need conversion

### Operations Files

#### `src/ops/local-vars-transfer.ts`

- **Line 60**: `vm.memory.readFloat32(SEG_DATA, STACK_BASE_BYTES + elementCell * CELL_SIZE)`
  - Convert: `vm.memory.readCell(STACK_BASE_CELLS + elementCell)`
- **Line 80**: `const header = vm.memory.readFloat32(SEG_DATA, RSTACK_BASE_BYTES + headerAddr)`
  - Convert: `vm.memory.readCell(RSTACK_BASE_CELLS + (headerAddr / CELL_SIZE))`
- **Line 96**: `vm.memory.readFloat32(SEG_DATA, RSTACK_BASE_BYTES + (baseCell + i) * CELL_SIZE)`
  - Convert: `vm.memory.readCell(RSTACK_BASE_CELLS + baseCell + i)`
- **Line 166**: `const existingHeader = vm.memory.readFloat32(SEG_DATA, targetAbsHeaderAddr)`
  - Convert: `vm.memory.readCell(targetAbsHeaderAddr / CELL_SIZE)`
- **Line 172**: `vm.memory.writeFloat32(SEG_DATA, targetAbsHeaderAddr, header)`
  - Convert: `vm.memory.writeCell(targetAbsHeaderAddr / CELL_SIZE, header)`
- **Line 184**: `vm.memory.readFloat32(SEG_DATA, STACK_BASE_BYTES + sourceCell * CELL_SIZE)`
  - Convert: `vm.memory.readCell(STACK_BASE_CELLS + sourceCell)`

#### `src/ops/builtins.ts`

- **Line 302**: `vm.memory.writeFloat32(SEG_DATA, RSTACK_BASE_BYTES + slotAddr, localRef)`
  - Convert: `vm.memory.writeCell(RSTACK_BASE_CELLS + (slotAddr / CELL_SIZE), localRef)`
- **Line 305**: `vm.memory.writeFloat32(SEG_DATA, RSTACK_BASE_BYTES + slotAddr, simpleValue)`
  - Convert: `vm.memory.writeCell(RSTACK_BASE_CELLS + (slotAddr / CELL_SIZE), simpleValue)`
- **Line 342**: `const slotValue = vm.memory.readFloat32(SEG_DATA, RSTACK_BASE_BYTES + slotAddr)`
  - Convert: `vm.memory.readCell(RSTACK_BASE_CELLS + (slotAddr / CELL_SIZE))`
- **Line 350**: `const targetValue = vm.memory.readFloat32(SEG_DATA, absAddrBytes)`
  - Convert: `vm.memory.readCell(absAddrBytes / CELL_SIZE)`

#### `src/ops/stack/data-move-ops.ts`

- **Line 47**: `const value = vm.memory.readFloat32(SEG_DATA, absByte)`
  - Convert: `vm.memory.readCell(absByte / CELL_SIZE)`
- **Line 72**: `const slot = vm.memory.readFloat32(SEG_DATA, absByte)`
  - Convert: `vm.memory.readCell(absByte / CELL_SIZE)`
- **Line 94-98**: Multiple read/write operations with `leftByte` and `rightByte`
  - Convert: `vm.memory.readCell(leftByte / CELL_SIZE)` etc.
- **Line 243**: `vm.memory.readFloat32(SEG_DATA, (secondAbsCell + i) * CELL_SIZE)`
  - Convert: `vm.memory.readCell(secondAbsCell + i)`
- **Line 408-409**: Copy operations with `sourceAddr` and `destAddr`
  - Convert: `vm.memory.readCell(sourceAddr / CELL_SIZE)` and `vm.memory.writeCell(destAddr / CELL_SIZE, value)`

#### `src/ops/lists/query-ops.ts`

- **Line 209**: `vm.memory.readFloat32(SEG_DATA, rootAbsAddr)`
  - Convert: `vm.memory.readCell(rootAbsAddr / CELL_SIZE)`
- **Line 226**: `vm.memory.readFloat32(SEG_DATA, resolvedAbsAddr)`
  - Convert: `vm.memory.readCell(resolvedAbsAddr / CELL_SIZE)`
- **Line 266-270**: Copy operations in `copyCompoundFromReference`
  - Convert: `vm.memory.readCell((srcBaseAbs / CELL_SIZE) + i)` and `vm.memory.writeCell((targetBaseAbs / CELL_SIZE) + i, v)`
- **Line 380**: `const v = vm.memory.readFloat32(SEG_DATA, cellAbsAddr)`
  - Convert: `vm.memory.readCell(cellAbsAddr / CELL_SIZE)`

#### `src/ops/capsules/capsule-ops.ts`

- **Line 37-38**: `vm.memory.readFloat32(SEG_DATA, RSTACK_BASE_BYTES + (oldBpRel - 1) * CELL_SIZE)`
  - Convert: `vm.memory.readCell(RSTACK_BASE_CELLS + oldBpRel - 1)`

#### `src/ops/heap/global-heap-ops.ts`

- **Line 90**: `const headerValue = vm.memory.readFloat32(SEG_DATA, topCell * CELL_SIZE)`
  - Convert: `vm.memory.readCell(topCell)`

### Test Files

#### `src/test/core/list.test.ts`

- **Line 105**: `vm.memory.readFloat32(SEG_DATA, (vm.sp - 1) * CELL_SIZE)`
  - Convert: `vm.memory.readCell(vm.sp - 1)`
- **Line 123-126**: Multiple reads with `vm.sp - N * CELL_SIZE`
  - Convert: `vm.memory.readCell(vm.sp - N)`
- **Line 391-394**: Multiple writes with `STACK_BASE_BYTES + (cellHeader - N) * 4`
  - Convert: `vm.memory.writeCell(STACK_BASE_CELLS + cellHeader - N, value)`
- **Line 405**: `vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE_BYTES + cellIndex * CELL_SIZE, 123.456)`
  - Convert: `vm.memory.writeCell(GLOBAL_BASE_CELLS + cellIndex, 123.456)`

#### `src/test/core/refs.test.ts`

- **Line 90**: `vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE_BYTES + 10 * CELL_SIZE, 321.25)`
  - Convert: `vm.memory.writeCell(GLOBAL_BASE_CELLS + 10, 321.25)`
- **Line 96**: `vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE_BYTES + cellIndex * CELL_SIZE, 777.5)`
  - Convert: `vm.memory.writeCell(GLOBAL_BASE_CELLS + cellIndex, 777.5)`
- **Line 109**: `vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE_BYTES + cellIndex * CELL_SIZE)`
  - Convert: `vm.memory.readCell(GLOBAL_BASE_CELLS + cellIndex)`

#### `src/test/ops/heap/global-heap.test.ts`

- **Line 25**: `vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE_BYTES + cellIndex * CELL_SIZE)`
  - Convert: `vm.memory.readCell(GLOBAL_BASE_CELLS + cellIndex)`
- **Line 36-39**: Multiple reads with `GLOBAL_BASE_BYTES + (cellIndex - N) * CELL_SIZE`
  - Convert: `vm.memory.readCell(GLOBAL_BASE_CELLS + cellIndex - N)`
- **Line 103**: `vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE_BYTES + (baseGp + 1) * CELL_SIZE)`
  - Convert: `vm.memory.readCell(GLOBAL_BASE_CELLS + baseGp + 1)`

#### `src/test/ops/local-vars/initvar.test.ts`

- **Line 34, 48, 60, 72, 84, 139**: Multiple reads with `vm.bp * CELL_SIZE` or calculated addresses
  - Convert: `vm.memory.readCell(vm.bp + offset)` where offset is in cells
- **Line 116-118**: Multiple reads with `vm.bp * CELL_SIZE + N * CELL_SIZE`
  - Convert: `vm.memory.readCell(vm.bp + N)`

#### `src/test/ops/local-vars/in-place-mutation.test.ts`

- Multiple patterns with `RSTACK_BASE_BYTES + targetAddr` where `targetAddr` is in bytes
  - Convert: `vm.memory.writeCell(RSTACK_BASE_CELLS + (targetAddr / CELL_SIZE), value)`
- Patterns with `RSTACK_BASE_BYTES + targetAddr - N * CELL_SIZE`
  - Convert: `vm.memory.writeCell(RSTACK_BASE_CELLS + (targetAddr / CELL_SIZE) - N, value)`

#### `src/test/ops/local-vars/ref-assign-fast-path.test.ts`

- **Line 75**: `vm.memory.readFloat32(SEG_DATA, STACK_BASE_BYTES + i * CELL_SIZE)`
  - Convert: `vm.memory.readCell(STACK_BASE_CELLS + i)`

#### `src/test/core/vm-push-symbol-ref.test.ts`

- **Line 108**: `vm.memory.readFloat32(SEG_DATA, STACK_BASE_BYTES + i * CELL_SIZE)`
  - Convert: `vm.memory.readCell(STACK_BASE_CELLS + i)`

#### `src/test/core/memory-segdata.test.ts`

- **Line 17, 25**: `vm.memory.readFloat32(SEG_DATA, offsetBytes)` where `offsetBytes = (depthAbs - 1) * CELL_SIZE`
  - Convert: `vm.memory.readCell(depthAbs - 1)`

#### `src/test/core/units.test.ts`

- Multiple patterns with `(baseCell + i) * 4` or `(baseCell + i) * CELL_SIZE`
  - Convert: `mem.writeCell(baseCell + i, value)` and `mem.readCell(baseCell + i)`

#### `src/test/utils/core-test-utils.ts`

- **Line 52-56**: Swap operations with `leftAddr` and `rightAddr` in bytes
  - Convert: `vm.memory.readCell(leftAddr / CELL_SIZE)` etc.

#### `src/test/utils/vm-test-utils.ts`

- **Line 62**: `vm.memory.readFloat32(SEG_DATA, i * CELL_SIZE)`
  - Convert: `vm.memory.readCell(i)`

## Summary

**Total files requiring conversion: 20 source files + 12 test files = 32 files**

**Key conversion patterns:**

1. `BASE_BYTES + cellIndex * CELL_SIZE` → `BASE_CELLS + cellIndex`
2. `byteAddr` (absolute) → `byteAddr / CELL_SIZE`
3. `vm.sp * CELL_SIZE` → `vm.sp` (already in cells)
4. `vm.bp * CELL_SIZE` → `vm.bp` (already in cells)
5. `(cellIndex + i) * CELL_SIZE` → `cellIndex + i`

## Notes

- Some operations may need to verify that addresses are cell-aligned before conversion
- The `writeCell` and `readCell` methods currently only support `SEG_DATA`
- All conversions should maintain the same behavior, just using cell addressing instead of byte addressing


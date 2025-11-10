# Plan 48: Global Variables Implementation

**Status:** In Progress (Phases 1-5, 7 complete; Phase 6 next)  
**Last Updated:** 2025-01-XX (Phase 3 verified - all tests pass)  
**Priority:** High  
**Owner:** VM + Parser + Compiler  
**Last Updated:** 2025-01-XX  
**Related Specs:** `docs/specs/globals.md`, `docs/specs/vm-architecture.md`, `docs/specs/variables-and-refs.md`

## Current Status Summary

**Completed:**
- ✅ Phase 1: Core opcodes (`GlobalRef`, `InitGlobal`) and infrastructure
- ✅ Phase 2: Parser support for `value global name` declarations
- ✅ Phase 3: Symbol resolution and access (`emitWord`, `emitRefSigil`, `emitAssignment` updates)
- ✅ Phase 4: Assignment operations (runtime dispatch in `storeOp`, `storeGlobal` helper)
- ✅ Phase 5: Bracket-path operations (already implemented in `emitWord` and `emitAssignment`)
- ✅ Phase 7: Error handling and area restrictions (mostly complete)

**Remaining:**
- ⏳ Phase 6: Increment operator extension
- ⏳ Phase 8: Integration and polish

**Key Achievements:**
- Runtime dispatch design: `Store` opcode detects area at runtime and dispatches appropriately
- Area restrictions: `VarRef` and `GlobalRef` are restricted to their respective areas at compile-time
- Compound handling: `gpushList` utility for consistent compound copying
- All existing tests pass

## Overview

This plan implements full global variable support according to `docs/specs/globals.md`. Globals provide persistent, module-scope storage that mirrors local variable semantics while using the unified data arena's global area. The implementation includes declaration syntax, opcode support, dictionary integration, compound handling, and bracket-path operations.

## Context

- **Previous Work:** Plan 27 implemented basic globals infrastructure with `SEG_GLOBAL` and `GLOBAL_REF`, but the `global` keyword was later removed. Plan 40 migrated to unified data segment and global heap primitives.
- **Current State:** Global heap infrastructure exists (`createGlobalRef`, `pushListToGlobalHeap`, `gpush`/`gpeek`/`gpop`), but language-level syntax and `GlobalRef` opcode are missing.
- **Target State:** Full implementation matching `globals.md` spec with `value global name` syntax, `Op.GlobalRef` opcode, and complete integration with existing variable/assignment machinery.

## Goals

1. **Declaration Syntax:** Implement `value global name` at top level
2. **Opcodes:** Add `Op.GlobalRef` with 16-bit offset operand
3. **Dictionary Integration:** Register globals in dictionary with `Tag.REF` payloads
4. **Access Patterns:** Support `name`, `&name`, `value -> name`, `value -> name[path]`
5. **Compound Handling:** Automatic copy-to-heap for stack-originating compounds
6. **Increment Operator:** Extend `+>` to support globals (currently locals-only)
7. **Error Handling:** Comprehensive validation and error messages
8. **Testing:** Full test coverage for all global operations

## Non-Goals

- Multi-module namespacing
- Persistence across VM restarts
- Advanced GC/compaction
- Module import/export system

## Design Decisions

### Storage Model

- Globals live in the **global area** of the unified data arena (`GLOBAL_BASE` to `GLOBAL_TOP`)
- Each global occupies exactly **one 32-bit cell**
- Global pointer `GP` tracks next free cell (already exists in VM)
- Maximum 65,536 globals (16-bit offset limit)

### Addressing

- `GlobalRef` opcode takes 16-bit unsigned offset: `absoluteIndex = GLOBAL_BASE + offset`
- **Compile-time limit:** Offset must be `[0, 65535]` (16-bit encoding constraint)
- **Runtime boundary:** `cellIndex >= GLOBAL_BASE && cellIndex < GLOBAL_TOP` (actual area limit, exclusive upper bound)

### Opcode Design Philosophy

**Critical Decision:** Globals use **separate opcodes** for initialization and reference creation, but **shared opcodes** for access and assignment.

- **`InitGlobal`** for declarations (mirrors `InitVar` for locals) - separate opcode
- **`GlobalRef`** for pushing references (mirrors `VarRef` for locals) - separate opcode
- **`Store`/`Load`** are **shared** and use runtime area detection to dispatch appropriately:
  - `Store` detects area at runtime (`getRefArea`) and dispatches to `storeGlobal` or `storeLocal` helpers
  - `Load` works universally via existing materialization logic
- This design allows the compiler to always emit `Store` without needing to know variable types
- Variable addresses are restricted at compile-time: `VarRef` only targets return stack, `GlobalRef` only targets global area
- `Store` can write anywhere in the data segment (including data stack for list elements), but variable declarations cannot target data stack

This hybrid approach ensures globals work correctly while maintaining flexibility for list element mutation.

- Uses existing `Tag.REF` with absolute cell index payload (no new tag needed)

**Note:** The 16-bit offset encoding limits the maximum number of globals to 65,536, but the actual runtime boundary is `GLOBAL_TOP`, which may be smaller. Both constraints are enforced: compile-time checks the 16-bit limit, runtime checks the `GLOBAL_TOP` boundary.

### Compilation Strategy

- **Declaration:** `value global name` → emit value-producing ops, then `InitGlobal <offset>` (direct write, no Store)
- **Read:** `name` → `GlobalRef <offset>; Load`
- **Address-of:** `&name` → `GlobalRef <offset>; Fetch`
- **Assignment:** `value -> name` → `GlobalRef <offset>; Store` (runtime dispatch based on area)
- **Bracket-path:** `value -> name[path]` → `GlobalRef <offset>; Fetch; <path>; Select; Nip; Store`

### Dictionary Integration

- Global entries use standard dictionary structure
- `payload` field contains `Tag.REF` to global cell (absolute index)
- Lookup determines global vs local by address range check
- No special dictionary flags needed

### Compound Semantics

- **Value semantics:** All assignments to globals create independent copies (never aliases)
- Stack-originating compounds are copied to global heap via `pushListToGlobalHeap`
- Global cell stores `Tag.REF` to heap-resident header
- In-place mutation requires compatible structure (same type, same slot count)
- Bracket-path operations work on heap-resident compounds
- **Access patterns:**
  - `name` (value-by-default): Materializes compound to stack (copy)
  - `&name` (address-of): Pushes REF (no copy, passes reference)
- **Assignment:** Always copies compound data, even when source is already in global area
- **Function calls:** Value-by-default copies; address-of passes REF

## Implementation Phases

### Phase 1: Core Opcode and Infrastructure ✅ COMPLETE

**Steps:**

1. ✅ Add `Op.GlobalRef` to opcode enum
2. ✅ Implement `globalRefOp` in builtins dispatcher
3. ✅ Add boundary validation in `globalRefOp`
4. ✅ Update opcode table and registration

**Files:**

- ✅ `src/ops/opcodes.ts` - Added `GlobalRef` opcode (after `VarRef`)
- ✅ `src/ops/builtins.ts` - Implemented `globalRefOp` function and added to `OPCODE_TO_VERB` table

**Tests:**

- ✅ `src/test/ops/globals/globalref-op.test.ts` - Opcode execution, boundary checks, offset validation

**Exit Criteria:**

- ✅ `GlobalRef` opcode executes correctly
- ✅ Boundary validation works
- ✅ Tests pass

---

### Phase 2: Parser Support for Declaration ✅ COMPLETE

**Steps:**

1. ✅ Add `global` keyword recognition in `emitWord` (tokenizer already recognizes words)
2. ✅ Implement `emitGlobalDecl` function in parser (similar to `emitVarDecl`)
3. ✅ Add top-level scope check: `if (currentDefinition.current) throw error`
4. ✅ Calculate offset: `offset = vm.gp` (vm.gp is already relative to GLOBAL_BASE)
5. ✅ Check 16-bit offset limit: `if (offset > 0xffff) throw "Global variable limit exceeded (64K)"`
6. ✅ Check runtime boundary: `if (vm.gp >= GLOBAL_SIZE) throw "Global area exhausted"`
7. ✅ Reserve global cell: `vm.gp += 1` (before dictionary registration to avoid overwrite)
8. ✅ Register in dictionary: `define(vm, name, createGlobalRef(offset))`
9. ✅ Emit `InitGlobal <offset>` opcode (matches `InitVar` pattern - direct write, no Store compatibility checks)

**Files:**

- ✅ `src/ops/opcodes.ts` - Added `InitGlobal` opcode (matches `InitVar` pattern)
- ✅ `src/ops/builtins.ts` - Implemented `initGlobalOp` function (direct write, handles compounds)
- ✅ `src/lang/parser.ts` - Added `emitGlobalDecl` function (after `emitVarDecl`)
- ✅ `src/lang/parser.ts` - Updated `emitWord` to call `emitGlobalDecl` when `value === 'global'`
- ✅ `src/ops/lists/query-ops.ts` - Added NIL checks in `storeSimpleValue` and `tryStoreCompound` (for future assignments)

**Note:** `createGlobalRef` takes a relative cell index (offset from GLOBAL_BASE), not absolute. The `define` function already exists and can be used to register globals.

**Tests:**

- ✅ `src/test/lang/globals/declaration.test.ts` - Simple declarations, compound declarations, top-level restriction, redeclaration (should succeed, not error)

**Exit Criteria:**

- ✅ `value global name` syntax works
- ✅ Simple and compound declarations succeed
- ✅ Top-level restriction enforced
- ✅ Redeclaration allowed (replaces previous definition)
- ✅ Dictionary entries created correctly

---

### Phase 3: Symbol Resolution and Access ✅ COMPLETE

**Steps:**

1. ✅ Verified `lookup` already handles global `Tag.REF` entries (works as-is)
2. ✅ Used existing `getRefArea` for address range check
3. ✅ Updated `emitWord` to use `Op.GlobalRef <offset>` for globals (was already correct)
4. ✅ Updated `emitRefSigil` to use `Op.GlobalRef <offset>` for globals (replaced `LiteralNumber`)
5. ✅ Updated `emitAssignment` to use `Op.GlobalRef <offset>` for globals (replaced `LiteralNumber`)
6. ✅ Calculate offset from absolute cell index: `offset = absoluteCellIndex - GLOBAL_BASE`
7. ✅ Handle both top-level and function-scope access

**Files:**

- ✅ `src/lang/parser.ts` - Updated `emitRefSigil` (lines 341-366) and `emitAssignment` (lines 545-572) to use `GlobalRef` instead of `LiteralNumber`
- ✅ `src/lang/parser.ts` - `emitWord` (lines 255-277) already correctly uses `GlobalRef` for globals

**Implementation Details:**

- **`name` (value-by-default):** `GlobalRef <offset>; Load` - matches `VarRef; Load` for locals
- **`&name` (address-of):** `GlobalRef <offset>; Fetch` - matches `VarRef; Fetch` for locals
  - For simple values: `Fetch` returns the value
  - For compounds: `Fetch` returns the REF stored in the cell
- **`value -> name` (assignment):** `GlobalRef <offset>; Store` - matches `VarRef; Store` for locals
- **`value -> name[path]` (bracket-path):** `GlobalRef <offset>; Fetch; <path>; Select; Nip; Store` - matches locals pattern

**Tests:**

- ✅ `src/test/lang/globals/access.test.ts` - Read access, address-of, inside functions, shadowing, redefinition
- ✅ `src/test/lang/globals/access-address-of-in-function.test.ts` - Address-of inside function (isolated test)

**Exit Criteria:**

- ✅ `name` resolves to global and emits `GlobalRef <offset>; Load`
- ✅ `&name` works for globals and emits `GlobalRef <offset>; Fetch`
- ✅ Access works inside function definitions
- ✅ Shadowing/redefinition works (no errors)
- ✅ Assignment works: `value -> name` emits `GlobalRef <offset>; Store`
- ✅ All tests pass

---

### Phase 4: Assignment Operations ✅ COMPLETE

**Steps:**

1. ✅ Refactored `storeOp` to use runtime area detection (`getRefArea`)
2. ✅ Added `storeGlobal` helper for global assignments (materializes REFs, handles compounds via `gpushList`, in-place updates for compatible compounds)
3. ✅ Added `storeLocal` helper to encapsulate existing local variable logic
4. ✅ Updated `storeOp` to dispatch based on area: global → `storeGlobal`, rstack → `storeLocal`, stack → `storeLocal` (for list elements)
5. ✅ Verified compound copy logic works via `gpushList` (consistent with `InitGlobal`)
6. ✅ Verified compatibility checking exists in `storeOp` via `isCompatible` and `updateListInPlace`

**Files:**

- ✅ `src/ops/lists/query-ops.ts` - Refactored `storeOp` with runtime dispatch, added `storeGlobal` and `storeLocal` helpers
- ✅ `src/core/global-heap.ts` - `gpushList` utility for compound copying
- ✅ `docs/specs/globals.md` - Updated to reflect runtime dispatch design

**Tests:**

- ✅ Existing tests pass (fetch-store.test.ts, ref-assign-cross-segment.test.ts)
- ⏳ `src/test/lang/globals/assignment.test.ts` - Still needed for comprehensive assignment testing

**Exit Criteria:**

- ✅ `Store` opcode works for globals via runtime dispatch
- ✅ Compound assignments copy to heap correctly
- ✅ Compatibility rules enforced
- ✅ In-place updates work for compatible compounds (no allocation)
- ⏳ Parser updates for `value -> name` syntax (Phase 3/4 integration)

---

### Phase 5: Bracket-Path Operations ✅ COMPLETE

**Steps:**

1. ✅ Bracket-path compilation already detects global targets (via `getRefArea` check)
2. ✅ `emitWord` handles `name[path]` reads: `GlobalRef; <path>; Select; Load; Nip` (lines 267-272)
3. ✅ `emitAssignment` handles `value -> name[path]` writes: `GlobalRef; Fetch; <path>; Select; Nip; Store` (lines 556-565)
4. ✅ `Select` and `Store` already work with global heap addresses (via runtime dispatch in `storeOp`)

**Files:**

- ✅ `src/lang/parser.ts` - Bracket-path handling already implemented in `emitWord` and `emitAssignment`
- ✅ `src/ops/access/select-ops.ts` - Already works with global refs (uses unified REF model)
- ✅ `src/ops/lists/query-ops.ts` - `storeOp` handles global refs via runtime dispatch

**Implementation Details:**

- **Read:** `name[path]` → `GlobalRef <offset>; <path>; Select; Load; Nip` (matches locals pattern)
- **Write:** `value -> name[path]` → `GlobalRef <offset>; Fetch; <path>; Select; Nip; Store` (matches locals pattern)
- Uses same `compileBracketPathAsList` helper as locals
- `Select` works with any REF (global, stack, or rstack)

**Tests:**

- ⏳ `src/test/lang/globals/bracket-path.test.ts` - Still needed for comprehensive bracket-path testing

**Exit Criteria:**

- ✅ `name[path]` reads work (implemented in `emitWord`)
- ✅ `value -> name[path]` writes work (implemented in `emitAssignment`)
- ✅ Nested paths supported (via `compileBracketPathAsList`)
- ⏳ Bounds checking tests needed

---

### Phase 6: Increment Operator Extension

**Steps:**

1. Update `emitIncrement` to detect global targets (check if `Tag.REF` with `getRefRegion(tval) === 'global'`)
2. Calculate offset: `offset = getAbsoluteCellIndexFromRef(tval) - GLOBAL_BASE`
3. Remove top-level restriction: allow `+>` at top level for globals
4. Emit `GlobalRef <offset>; Swap; Over; Fetch; Add; Swap; Store` sequence (mirrors `VarRef` sequence)
5. Support bracket paths: `value +> name[path]` → `GlobalRef <offset>; Fetch; <path>; Select; Nip; Swap; Over; Fetch; Add; Swap; Store`
6. Remove locals-only restriction check (line 527: `if (tag !== Tag.LOCAL)` should also allow globals)

**Files:**

- `src/lang/parser.ts` - Update `emitIncrement` (around line 502) to detect and handle globals

**Note:** Currently `emitIncrement` only allows locals and throws error for non-locals. Need to add global support.

**Tests:**

- `src/test/lang/globals/increment.test.ts` - Simple increment, bracket-path increment, top-level increment

**Exit Criteria:**

- `value +> name` works for globals (both inside functions and at top level)
- Bracket paths work: `value +> name[path]`
- No locals-only restriction

---

### Phase 7: Error Handling and Validation ✅ MOSTLY COMPLETE

**Steps:**

1. ✅ Add compile-time checks:
   - ✅ Top-level restriction (in `emitGlobalDecl`)
   - ✅ 16-bit offset limit: `offset <= 0xffff` (64K limit from encoding)
   - ✅ Runtime boundary check: `vm.gp < GLOBAL_SIZE`
2. ✅ Add runtime checks:
   - ✅ Boundary validation in `globalRefOp` and `initGlobalOp`
   - ✅ Type compatibility in `storeOp` (via `storeGlobal`)
   - ✅ Area restrictions: `VarRef` only targets return stack, `GlobalRef` only targets global area
   - ✅ Data stack stores allowed for list elements (not variable declarations)
3. ⏳ Improve error messages with context (basic messages exist, could be enhanced)

**Files:**

- ✅ `src/lang/parser.ts` - Compile-time validation
- ✅ `src/ops/builtins.ts` - Runtime validation
- ✅ `src/ops/lists/query-ops.ts` - Area-based dispatch and validation
- ✅ `src/core/refs.ts` - Area restrictions in `getVarRef` and `createGlobalRef`
- ✅ `docs/specs/globals.md` - Documented area restrictions

**Tests:**

- ✅ Basic error tests in declaration.test.ts
- ⏳ `src/test/lang/globals/errors.test.ts` - Comprehensive error condition testing

**Exit Criteria:**

- ✅ Core error cases handled
- ✅ Area restrictions enforced
- ⏳ Comprehensive error test coverage

---

### Phase 8: Integration and Polish

**Steps:**

1. Run full test suite
2. Update documentation
3. Add examples to specs
4. Performance validation
5. Code review and cleanup

**Files:**

- All implementation files
- `docs/specs/globals.md` - Add examples if missing
- `docs/learn/` - Add tutorial if needed

**Tests:**

- Full regression suite
- Integration tests
- Performance benchmarks (if needed)

**Exit Criteria:**

- All tests pass
- Documentation complete
- Code reviewed and approved
- Performance acceptable

## Success Criteria

1. ✅ `value global name` syntax works at top level
2. ✅ `name`, `&name`, `value -> name` all work for globals
3. ✅ Bracket paths work: `name[path]` and `value -> name[path]` (implemented, tests pending)
4. ⏳ Increment operator works: `value +> name` (not yet implemented)
5. ✅ Compound globals copy to heap correctly
6. ✅ Compatibility rules enforced
7. ✅ Error handling comprehensive (core cases done, comprehensive tests pending)
8. ✅ Dictionary integration seamless
9. ✅ All tests pass (existing tests, new tests needed for remaining phases)
10. ⏳ Documentation complete (specs updated, examples pending)

## Open Questions

1. **Scope tracking:** Use `currentDefinition.current` to detect top-level (null = top level, non-null = inside function)
2. **Dictionary persistence:** Global dictionary entries survive VM reset per spec (soft reset preserves heap)
3. **Performance:** Dictionary lookup is O(n) but compile-time only; runtime uses fixed offsets
4. **Debugging:** Consider adding inspection utilities for globals in future

## Dependencies

- ✅ Unified data segment (Plan 42)
- ✅ Global heap primitives (Plan 40)
- ✅ Cell-based addressing (recent conversion)
- ✅ Dictionary system (Plan 46)
- ✅ Variable/assignment machinery (Plan 10, Plan 16)

## Risks and Mitigations

| Risk                          | Impact | Mitigation                                                                   |
| ----------------------------- | ------ | ---------------------------------------------------------------------------- |
| Offset calculation errors     | High   | Extensive boundary testing, validation at compile and runtime                |
| Compound copy bugs            | High   | Reuse existing `pushListToGlobalHeap`, comprehensive compound tests          |
| Dictionary lookup performance | Medium | Profile if needed, consider optimizations later                              |
| Scope detection complexity    | Medium | Use existing `currentDefinition.current` check, add explicit depth if needed |

## References

- `docs/specs/globals.md` - Full specification
- `docs/specs/vm-architecture.md` - Memory layout
- `docs/specs/variables-and-refs.md` - Variable semantics
- `src/core/global-heap.ts` - Heap primitives
- `src/core/refs.ts` - Reference utilities
- `src/core/dictionary.ts` - Dictionary system
- `src/lang/parser.ts` - Parser implementation
- `docs/plans/done/plan-27-globals-segment-and-ref.md` - Previous work
- `docs/plans/done/plan-40-global-heap.md` - Heap migration

## Notes

- The spec emphasizes that globals should feel like "locals with different lifetime"
- All existing variable machinery (Load, Fetch, Store) should work with globals via `GlobalRef`
- No new tags needed - `Tag.REF` with absolute index is sufficient
- Address range discrimination (`getRefRegion`) is key to distinguishing globals from locals

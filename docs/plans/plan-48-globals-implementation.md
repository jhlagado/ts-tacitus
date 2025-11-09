# Plan 48: Global Variables Implementation

**Status:** Current  
**Priority:** High  
**Owner:** VM + Parser + Compiler  
**Last Updated:** 2025-01-XX  
**Related Specs:** `docs/specs/globals.md`, `docs/specs/vm-architecture.md`, `docs/specs/variables-and-refs.md`

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

- Globals live in the **global area** of the unified data arena (`GLOBAL_BASE_CELLS` to `GLOBAL_TOP_CELLS`)
- Each global occupies exactly **one 32-bit cell**
- Global pointer `GP` tracks next free cell (already exists in VM)
- Maximum 65,536 globals (16-bit offset limit)

### Addressing

- `GlobalRef` opcode takes 16-bit offset: `absoluteIndex = GLOBAL_BASE_CELLS + offset`
- Runtime validates: `cellIndex >= GLOBAL_BASE_CELLS && cellIndex < GLOBAL_BASE_CELLS + 65536`
- Uses existing `Tag.REF` with absolute cell index payload (no new tag needed)

### Compilation Strategy

- **Declaration:** `value global name` → emit value-producing ops, then `GlobalRef <offset>; Store`
- **Read:** `name` → `GlobalRef <offset>; Load`
- **Address-of:** `&name` → `GlobalRef <offset>; Fetch`
- **Assignment:** `value -> name` → `GlobalRef <offset>; Store`
- **Bracket-path:** `value -> name[path]` → `GlobalRef <offset>; Fetch; <path>; Select; Nip; Store`

### Dictionary Integration

- Global entries use standard dictionary structure
- `payload` field contains `Tag.REF` to global cell (absolute index)
- Lookup determines global vs local by address range check
- No special dictionary flags needed

### Compound Semantics

- Stack-originating compounds are copied to global heap via `pushListToGlobalHeap`
- Global cell stores `Tag.REF` to heap-resident header
- In-place mutation requires compatible structure (same type, same slot count)
- Bracket-path operations work on heap-resident compounds

## Implementation Phases

### Phase 1: Core Opcode and Infrastructure

**Steps:**

1. Add `Op.GlobalRef` to opcode enum
2. Implement `globalRefOp` in builtins dispatcher
3. Add boundary validation in `globalRefOp`
4. Update opcode table and registration

**Files:**

- `src/core/opcodes.ts` - Add `GlobalRef` opcode
- `src/ops/builtins.ts` - Implement `globalRefOp` function
- `src/ops/builtins-register.ts` - Register opcode (if needed)

**Tests:**

- `src/test/ops/globals/globalref-op.test.ts` - Opcode execution, boundary checks, offset validation

**Exit Criteria:**

- `GlobalRef` opcode executes correctly
- Boundary validation works
- Tests pass

---

### Phase 2: Parser Support for Declaration

**Steps:**

1. Add `global` keyword recognition in tokenizer (if not already present)
2. Implement `emitGlobalDecl` function in parser
3. Add top-level scope check (globals only at top level)
4. Calculate offset from `vm.gp`
5. Emit `GlobalRef <offset>; Store` sequence
6. Register in dictionary with `createGlobalRef`
7. Increment `vm.gp`

**Files:**

- `src/lang/parser.ts` - Add `emitGlobalDecl` function
- `src/lang/tokenizer.ts` - Ensure `global` is recognized (may already be)

**Tests:**

- `src/test/lang/globals/declaration.test.ts` - Simple declarations, compound declarations, top-level restriction, redeclaration errors

**Exit Criteria:**

- `value global name` syntax works
- Simple and compound declarations succeed
- Top-level restriction enforced
- Dictionary entries created correctly

---

### Phase 3: Symbol Resolution and Access

**Steps:**

1. Update `lookup` to handle global `Tag.REF` entries
2. Implement address range check (`getRefRegion` or similar)
3. Update `emitWord` to emit `GlobalRef; Load` for globals
4. Update `emitRefSigil` to emit `GlobalRef; Fetch` for globals
5. Handle both top-level and function-scope access

**Files:**

- `src/core/dictionary.ts` - Ensure lookup returns global refs correctly
- `src/core/refs.ts` - Verify `getRefRegion` works for globals
- `src/lang/parser.ts` - Update `emitWord` and `emitRefSigil`

**Tests:**

- `src/test/lang/globals/access.test.ts` - Read access, address-of, inside functions, shadowing

**Exit Criteria:**

- `name` resolves to global and emits correct bytecode
- `&name` works for globals
- Access works inside function definitions
- Shadowing rules enforced

---

### Phase 4: Assignment Operations

**Steps:**

1. Update `emitAssignment` to detect global targets
2. Emit `GlobalRef <offset>; Store` for global assignments
3. Ensure `Store` handles global-area compounds correctly
4. Add compatibility checking for compound reassignments

**Files:**

- `src/lang/parser.ts` - Update `emitAssignment`
- `src/ops/lists/query-ops.ts` - Verify `storeOp` handles global refs
- `src/core/global-heap.ts` - Ensure compound copy logic works

**Tests:**

- `src/test/lang/globals/assignment.test.ts` - Simple assignment, compound assignment, compatibility checks, incompatible type errors

**Exit Criteria:**

- `value -> name` works for globals
- Compound assignments copy to heap correctly
- Compatibility rules enforced
- Error messages clear

---

### Phase 5: Bracket-Path Operations

**Steps:**

1. Update bracket-path compilation to detect global targets
2. Emit `GlobalRef; Fetch; <path>; Select; Nip; Store` for writes
3. Emit `GlobalRef; Fetch; <path>; Select; Load; Nip` for reads
4. Ensure `Select` and `Store` work with global heap addresses

**Files:**

- `src/lang/parser.ts` - Update bracket-path handling
- `src/ops/access/select-ops.ts` - Verify works with global refs

**Tests:**

- `src/test/lang/globals/bracket-path.test.ts` - Read paths, write paths, nested paths, out-of-bounds

**Exit Criteria:**

- `name[path]` reads work
- `value -> name[path]` writes work
- Nested paths supported
- Bounds checking works

---

### Phase 6: Increment Operator Extension

**Steps:**

1. Update `emitIncrementOp` to detect global targets
2. Emit `GlobalRef; Swap; Over; Fetch; Add; Swap; Store` sequence
3. Support bracket paths: `value +> name[path]`
4. Remove locals-only restriction

**Files:**

- `src/lang/parser.ts` - Update `emitIncrementOp`
- Remove any locals-only checks

**Tests:**

- `src/test/lang/globals/increment.test.ts` - Simple increment, bracket-path increment

**Exit Criteria:**

- `value +> name` works for globals
- Bracket paths work
- No locals-only restriction

---

### Phase 7: Error Handling and Validation

**Steps:**

1. Add compile-time checks:
   - Top-level restriction
   - 64K limit check
   - Redeclaration detection
2. Add runtime checks:
   - Boundary validation in `globalRefOp`
   - Type compatibility in `storeOp`
   - Out-of-bounds in bracket paths
3. Improve error messages with context

**Files:**

- `src/lang/parser.ts` - Compile-time validation
- `src/ops/builtins.ts` - Runtime validation
- `src/core/errors.ts` - Error types (if needed)

**Tests:**

- `src/test/lang/globals/errors.test.ts` - All error conditions

**Exit Criteria:**

- All error cases handled
- Error messages clear and helpful
- Tests cover all error paths

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
3. ✅ Bracket paths work: `name[path]` and `value -> name[path]`
4. ✅ Increment operator works: `value +> name`
5. ✅ Compound globals copy to heap correctly
6. ✅ Compatibility rules enforced
7. ✅ Error handling comprehensive
8. ✅ Dictionary integration seamless
9. ✅ All tests pass
10. ✅ Documentation complete

## Open Questions

1. **Scope tracking:** Do we need explicit `vm.scopeDepth` or can we infer from `currentDefinition.current`?
2. **Dictionary persistence:** Should global dictionary entries survive VM reset? (Spec says yes for soft reset)
3. **Performance:** Any optimizations needed for dictionary lookup of globals?
4. **Debugging:** Should we add inspection utilities for globals?

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

# Plan 13: Access Operations Foundation - Cleanup & Integration

**Status:** ✅ COMPLETED  
**Priority:** HIGH  
**Complexity:** MEDIUM  

## Objective

Clean up deprecated operations and establish integration testing foundation for the unified data access architecture. Advanced search/sort operations are covered by a separate plan. This excludes the high-level `get`/`set` combinators which will be addressed separately.

## Background

The `access.md` specification defines a layered data access system built on address-returning operations. The current codebase has partial implementation - some operations exist but others are missing, and there may be legacy operations that need cleanup.

## Current Implementation Status

### ✅ **Already Implemented** 
**Core List Operations (lists.md compliant):**
- ✅ `slots` → `listSlotOp` (Op.Slots) - payload slot count
- ✅ `length` → `lengthOp` (Op.Length) - element count by traversal  
- ✅ `slot` → `slotOp` (Op.Slot) - address of payload slot
- ✅ `elem` → `elemOp` (Op.Elem) - address of element start
- ✅ `fetch` → `fetchOp` (Op.Fetch) - get value at address
- ✅ `store` → `storeOp` (Op.Store) - set value at address

**Maplist Operations (maplists.md compliant):**
- ✅ `find` → `findOp` (Op.Find) - address-returning key lookup with default fallback
- ✅ `keys` → `keysOp` (Op.Keys) - extract keys from maplist
- ✅ `values` → `valuesOp` (Op.Values) - extract values from maplist

### ⏳ **Future Operations (Separate Plan)**
**Advanced Search & Sorting Operations (covered by draft plan):**
- ⏳ `bfind` - binary search for sorted lists/maplists
- ⏳ `hfind` - hash-based lookup for maplists with indices  
- ⏳ `hindex` - build hash index for maplist
- ⏳ `sort` - sort lists with comparator  
- ⏳ `mapsort` - sort maplists by keys while preserving pairs

### 🚩 **Legacy Operations to Review**
**Deprecated LIST operations (still in opcodes/builtins):**
- 🚩 `ListSlot` (Op.ListSlot=92) - superseded by `slots`
- 🚩 `ListSkip` (Op.ListSkip=93) - superseded by standard `drop` 
- 🚩 `ListPrepend` (Op.ListPrepend=94) - superseded by `cons`
- 🚩 `ListAppend` (Op.ListAppend=95) - superseded by `append`
- 🚩 `ListGetAt` (Op.ListGetAt=96) - superseded by `elem` + `fetch`
- 🚩 `ListSetAt` (Op.ListSetAt=97) - superseded by `elem` + `store`

**Utility functions (in stack-ops.ts):**
- 🚩 `findElement(vm, startSlot)` - internal utility, not user-facing operation
- 🚩 `findElementAtIndex(vm, index)` - internal utility

## Implementation Strategy

**Consolidation-First Approach:**
- **Extend existing `list-ops.ts`** - continue consolidation pattern from maplist implementation
- **Remove deprecated operations** - clean up opcodes and registration
- **C-port compatible** - direct loops, simple address arithmetic, no JavaScript idioms
- **Specification-driven** - exact implementation per access.md, lists.md, maplists.md

## Phases

### Phase 1: Legacy Cleanup and Assessment
**Goal:** Clean up deprecated operations and assess current state

#### Step 1.1: Audit Legacy Operations  
- [ ] Review `ListSlot`, `ListSkip`, `ListPrepend`, `ListAppend`, `ListGetAt`, `ListSetAt` implementations
- [ ] Verify they're truly superseded by modern equivalents
- [ ] Check test coverage - identify any tests that depend on legacy operations
- [ ] Document migration path for any remaining usage

#### Step 1.2: Remove Deprecated Operations
- [ ] Remove deprecated opcodes from `opcodes.ts` (Op.ListSlot through Op.ListSetAt)
- [ ] Remove registrations from `builtins-register.ts`  
- [ ] Update any tests using deprecated operations to use modern equivalents
- [ ] Run full test suite to verify no regressions

#### Step 1.3: Clean Up Internal Utilities
- [ ] Review `findElement` and `findElementAtIndex` in `stack-ops.ts`
- [ ] Determine if they're still needed for stack operations
- [ ] If obsolete, remove; if needed, document their internal-only usage

**Success Criteria:**
- [ ] All deprecated LIST operations removed
- [ ] Full test suite passes (923+ tests)
- [ ] Clean opcodes enumeration
- [ ] No dead code remaining

### Phase 2: Integration Testing Foundation
**Goal:** Establish comprehensive testing foundation for current and future operations

#### Step 2.1: Current Access Pattern Integration Tests
- [ ] Test complete workflows with existing operations: `find` → `fetch`, `elem` → `store`
- [ ] Test mixed list/maplist scenarios with current operations
- [ ] Verify address-returning semantics across all existing operations
- [ ] Test error paths and edge cases for current implementation

#### Step 2.2: Testing Infrastructure for Future Operations
- [ ] Create test framework for future comparator-based operations
- [ ] Establish performance benchmarking infrastructure
- [ ] Create test data sets of various sizes for future performance testing
- [ ] Document testing patterns for upcoming sort/search operations

#### Step 2.3: Documentation and Baseline
- [ ] Update operation documentation for current implementations
- [ ] Document current performance characteristics as baseline
- [ ] Create comprehensive test checklist for access operations conformance
- [ ] Prepare integration points for future advanced operations

**Success Criteria:**
- [ ] All current operations meet specification requirements
- [ ] Robust testing foundation established
- [ ] Zero regressions in existing functionality  
- [ ] Ready infrastructure for future advanced operations and `get`/`set` combinators

## Quality Metrics

**Code Quality:**
- **Clean Architecture:** Deprecated operations removed, clear operation hierarchy
- **C-port Ready:** Maintain existing C-compatible patterns
- **Specification Compliant:** Current operations validated against access.md requirements
- **Legacy-Free:** No deprecated opcodes or dead code remaining

**Testing:**
- **100% existing test pass rate** maintained (923+ tests)
- **Edge case coverage:** Invalid inputs, empty structures, malformed data
- **Integration testing:** Cross-operation workflows verified with existing operations
- **Infrastructure readiness:** Testing framework prepared for future advanced operations

## Dependencies

**Prerequisites:**
- ✅ Existing list infrastructure (`list-ops.ts`)
- ✅ Maplist operations (`findOp`, `keysOp`, `valuesOp`)
- ✅ Tagged value system with address-returning semantics
- ✅ Symbol table for string interning

**Specifications:**
- `docs/specs/access.md` - Primary specification
- `docs/specs/lists.md` - Foundation operations  
- `docs/specs/maplists.md` - Maplist conventions

## Risk Mitigation

**Technical Risks:**
- **Test dependencies:** Some tests may rely on deprecated operations
- **Opcode gaps:** Removing opcodes 92-97 may affect opcode numbering expectations
- **Internal utility usage:** Stack operations may depend on `findElement` utilities

**Integration Risks:**
- **Backward compatibility:** Existing code may reference deprecated operations
- **Performance regression:** Cleanup should not impact existing operation performance
- **Testing coverage:** Must maintain comprehensive test coverage during cleanup

## Success Definition

🎯 **Clean Access Operations Foundation**
- ✅ All deprecated operations removed cleanly  
- ✅ Legacy code and dead opcodes eliminated
- ✅ Current operations validated against specifications
- ✅ Comprehensive testing foundation established
- ✅ Infrastructure ready for future advanced operations
- ✅ Ready to support high-level `get`/`set` combinators

This plan provides a clean foundation for TACIT's unified data access architecture, preparing the codebase for future advanced search/sort operations and high-level combinators.

---

## Implementation Notes

### Opcode Allocation Strategy
- **Reuse freed opcodes:** Opcodes 92-97 will be freed by removing deprecated LIST operations
- **Sequential allocation:** Assign new opcodes in logical groupings
- **Future expansion:** Reserve space for additional access operations

### Testing Strategy  
- **Behavioral testing only:** Avoid `fromTaggedValue` usage per established guidelines
- **Cross-operation verification:** Test complete workflows end-to-end
- **Performance benchmarking:** Validate complexity claims with real data

### C-Port Readiness
- **Direct loops:** No JavaScript array methods or functional programming
- **Simple address arithmetic:** Direct memory calculations
- **Fixed-size structures:** Power-of-two hash tables, bounded recursion
- **Explicit control flow:** Clear branching, minimal abstraction layers
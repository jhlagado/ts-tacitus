# Unimplemented Features - Development Status

**Last Updated:** 2025-01-13  
**Based on:** Spec audit findings

## Overview

This document summarizes all features that are specified but not yet implemented, along with their development planning status.

---

## 1. Finally Blocks ⚠️ **NO PLAN DOCUMENT**

**Spec:** `docs/specs/finally.md`  
**Status:** ❌ Not Implemented  
**Priority:** High  
**Complexity:** High

### Missing Components:

- `ERR` register (error state tracking)
- `IN_FINALLY` register (cleanup execution flag)
- `finally` keyword parsing
- Wrapper rebinding compilation
- Error propagation during cleanup

### Development Status:

- **No plan document exists** for this feature
- Spec is marked with "NOT YET IMPLEMENTED" warning
- Consider creating a plan document or moving spec to `docs/specs/drafts/`

---

## 2. List Sorting & Search Operations ✅ **DRAFT PLAN EXISTS**

**Spec:** `docs/specs/lists.md` §15-16, §25  
**Status:** ❌ Not Implemented  
**Priority:** Medium  
**Complexity:** Medium-High  
**Plan:** `docs/plans/draft/plan-13-advanced-search-performance.md`

### Missing Operations:

#### List Operations:

- `sort` - Stable list sorting with comparator
- `bfind` - Binary search on sorted lists

#### Maplist Operations:

- `mapsort` - Sort maplists by keys (pair-atomic)
- `bfind` (maplist variant) - Binary search on sorted maplists
- `hfind` - Hash-based O(1) lookup (requires `hindex`)

### Development Plan:

**Location:** `docs/plans/draft/plan-13-advanced-search-performance.md`

**Status:** 📝 DRAFT  
**Priority:** MEDIUM  
**Complexity:** HIGH

**Phases:**

- **Phase A:** List Sorting & Search (`sort`, `bfind` for lists)
- **Phase B:** Maplist Sorting & Search (`mapsort`, `bfind` for maplists)
- **Phase C:** Hash Indexing (`hindex`, `hfind`)

**Dependencies:**

- ✅ Core list operations complete
- ✅ Core maplist operations complete
- ✅ Plan 13 completed (legacy cleanup)

**Notes:**

- Essential for binary search capabilities
- Performance critical (O(log n) vs O(n) lookup)
- Specification ready (already defined in specs)

---

## 3. Broadcasting (APL-style) ✅ **DRAFT PLAN EXISTS**

**Spec:** `docs/specs/broadcasting.md` (if exists), `docs/specs/lists.md`  
**Status:** ❌ Not Implemented  
**Priority:** Medium  
**Complexity:** High  
**Plan:** `docs/plans/draft/plan-29-broadcasting-implementation.md`

### Missing Operations:

- Elementwise broadcasting for unary/binary built-ins over lists
- Scalar extension and cycle-to-match for list×list operations
- Recursive broadcasting into nested lists
- Integration with core arithmetic and comparison operations

### Development Plan:

**Location:** `docs/plans/draft/plan-29-broadcasting-implementation.md`

**Status:** 📝 DRAFT  
**Priority:** MEDIUM  
**Complexity:** HIGH

**Phases:**

- **M1:** Engine scaffolding (unary broadcasting with `negate`)
- **M2:** Binary scalar extension (simple×list, list×simple)
- **M3:** Binary list×list with modulo cycling
- **M4:** Extend builtin coverage (comparisons, numeric ops)
- **M5:** Performance optimization and polish

**Dependencies:**

- ✅ Core list operations complete
- ✅ Core built-in operations complete

**Notes:**

- Enables APL-style elementwise operations
- Performance critical (fast paths for equal-length flat numeric lists)
- Specification ready

---

## 4. Tacit Native Testing System ✅ **DRAFT PLAN EXISTS**

**Spec:** Not yet specified (proposed feature)  
**Status:** ❌ Not Implemented  
**Priority:** Medium  
**Complexity:** High  
**Plan:** `docs/plans/draft/plan-50-tacit-native-testing-system.md`

### Missing Components:

- Assertion primitives (`expect`, `assert`, `assert-eq`, etc.)
- Test organization (`test`, `describe`, `before-each`, `after-each`)
- Test runner and execution engine
- Test result reporting and formatting

### Development Plan:

**Location:** `docs/plans/draft/plan-50-tacit-native-testing-system.md`

**Status:** 📝 DRAFT  
**Priority:** MEDIUM  
**Complexity:** HIGH

**Phases:**

- **Phase 0:** Design & Specification
- **Phase 1:** Core Assertions
- **Phase 2:** Test Organization
- **Phase 3:** Test Runner
- **Phase 4:** Reporting

**Dependencies:**

- ✅ Core VM functionality complete
- ✅ Error handling system complete
- ✅ Stack operations complete

**Notes:**

- Enables unit testing entirely in Tacit
- No external test runner dependencies
- More idiomatic testing experience for Tacit developers

---

## 5. Global Variable Declaration Syntax ⚠️ **PLAN EXISTS BUT DEFERRED**

**Spec:** `docs/specs/quick-reference.md`, `docs/specs/variables-and-refs.md`  
**Status:** ❌ Not Implemented  
**Priority:** Low  
**Complexity:** Low  
**Plan:** `docs/plans/done/plan-27-globals-segment-and-ref.md`

### Missing:

- `global` keyword parsing
- `value global name` syntax support

### Current State:

- Globals can be accessed/assigned via dictionary entries
- Parser code shows: `// 'global' keyword has been removed`
- `emitGlobalDecl` function is commented out

### Development Plan:

**Location:** `docs/plans/done/plan-27-globals-segment-and-ref.md`

**Status:** Draft (Phases 1–2 complete; **no further work scheduled**)

**History:**

- Plan 27 originally included `global` declaration
- Phase 1 marked as "Implemented" but parser code shows it was removed
- Current status: **Deferred/Removed**

**Recommendation:**

- Either implement the `global` keyword as planned
- Or update spec to reflect that globals are dictionary-only (no syntax sugar)

---

## Summary Table

| Feature               | Spec Location        | Plan Document                               | Plan Status | Priority | Complexity |
| --------------------- | -------------------- | ------------------------------------------- | ----------- | -------- | ---------- |
| Finally blocks        | `finally.md`         | ❌ None                                     | N/A         | High     | High       |
| `sort` (lists)        | `lists.md` §15       | ✅ `plan-13-advanced-search-performance.md` | Draft       | Medium   | Medium     |
| `bfind` (lists)       | `lists.md` §16       | ✅ `plan-13-advanced-search-performance.md` | Draft       | Medium   | Medium     |
| `mapsort`             | `lists.md` §25       | ✅ `plan-13-advanced-search-performance.md` | Draft       | Medium   | Medium     |
| `bfind` (maplists)    | `lists.md` §25       | ✅ `plan-13-advanced-search-performance.md` | Draft       | Medium   | Medium     |
| `hfind`               | `lists.md` §25       | ✅ `plan-13-advanced-search-performance.md` | Draft       | Low      | High       |
| Broadcasting          | (proposed)           | ✅ `plan-29-broadcasting-implementation.md` | Draft       | Medium   | High       |
| Native testing system | (proposed)           | ✅ `plan-50-tacit-native-testing-system.md` | Draft       | Medium   | High       |
| Global declaration    | `quick-reference.md` | ⚠️ `plan-27` (deferred)                     | Deferred    | Low      | Low        |

---

## Recommended Next Steps

### High Priority

1. **Create plan for finally blocks** - This is a major feature with no development plan
   - Consider: `docs/plans/plan-51-finally-blocks.md` (or next available number)
   - Or move `finally.md` to `docs/specs/drafts/` until planning begins

### Medium Priority

2. **Finalize plan-13** - Promote draft plan to active status
   - Review and update dependencies
   - Break into smaller, implementable phases
   - Set timeline and assign ownership

3. **Review broadcasting plan (plan-29)** - Consider implementation priority
   - Evaluate performance impact
   - Assess integration complexity with existing operations

4. **Develop testing system spec** - Create specification for plan-50
   - Define assertion API
   - Design test organization syntax
   - Document expected behavior

### Low Priority

5. **Clarify global declaration status** - Decide on direction
   - Implement `global` keyword as originally planned
   - Or update specs to reflect dictionary-only approach

---

## Related Documents

- **Spec Status:** `docs/specs/SPEC_STATUS.md` (overview of all specs)
- **Draft Plans:**
  - `docs/plans/draft/plan-13-advanced-search-performance.md` (sort/bfind)
  - `docs/plans/draft/plan-29-broadcasting-implementation.md` (broadcasting)
  - `docs/plans/draft/plan-50-tacit-native-testing-system.md` (testing)
- **Global Plan:** `docs/plans/done/plan-27-globals-segment-and-ref.md`

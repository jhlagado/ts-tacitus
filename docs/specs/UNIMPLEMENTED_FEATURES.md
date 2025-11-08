# Unimplemented Features - Development Status

**Last Updated:** 2024-12-19  
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

## 3. Global Variable Declaration Syntax ⚠️ **PLAN EXISTS BUT DEFERRED**

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

| Feature | Spec Location | Plan Document | Plan Status | Priority | Complexity |
|---------|---------------|---------------|------------|----------|------------|
| Finally blocks | `finally.md` | ❌ None | N/A | High | High |
| `sort` (lists) | `lists.md` §15 | ✅ `plan-13-advanced-search-performance.md` | Draft | Medium | Medium |
| `bfind` (lists) | `lists.md` §16 | ✅ `plan-13-advanced-search-performance.md` | Draft | Medium | Medium |
| `mapsort` | `lists.md` §25 | ✅ `plan-13-advanced-search-performance.md` | Draft | Medium | Medium |
| `bfind` (maplists) | `lists.md` §25 | ✅ `plan-13-advanced-search-performance.md` | Draft | Medium | Medium |
| `hfind` | `lists.md` §25 | ✅ `plan-13-advanced-search-performance.md` | Draft | Low | High |
| Global declaration | `quick-reference.md` | ⚠️ `plan-27` (deferred) | Deferred | Low | Low |

---

## Recommended Next Steps

### High Priority
1. **Create plan for finally blocks** - This is a major feature with no development plan
   - Consider: `docs/plans/plan-48-finally-blocks.md`
   - Or move `finally.md` to `docs/specs/drafts/` until planning begins

### Medium Priority
2. **Finalize plan-13** - Promote draft plan to active status
   - Review and update dependencies
   - Break into smaller, implementable phases
   - Set timeline and assign ownership

### Low Priority
3. **Clarify global declaration status** - Decide on direction
   - Implement `global` keyword as originally planned
   - Or update specs to reflect dictionary-only approach

---

## Related Documents

- **Spec Status:** `docs/specs/SPEC_STATUS.md` (overview of all specs)
- **Draft Plan:** `docs/plans/draft/plan-13-advanced-search-performance.md`
- **Global Plan:** `docs/plans/done/plan-27-globals-segment-and-ref.md`


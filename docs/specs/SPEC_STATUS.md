# Specification Status Report

**Last Updated:** 2024-12-19  
**Purpose:** Current status of all specifications and unimplemented features

---

## Quick Status

| Spec File | Status | Notes |
|-----------|--------|-------|
| core-invariants.md | ✅ Accurate | All invariants match implementation |
| vm-architecture.md | ✅ Updated | Fixed reference helpers (absolute-only model) |
| tagged.md | ✅ Accurate | Tag system, NaN-boxing, meta bits all accurate |
| variables-and-refs.md | ✅ Updated | Fixed opcodes (Reserve/InitVar/VarRef), removed migration notes |
| lists.md | ✅ Updated | Full review complete, unimplemented features marked |
| metaprogramming.md | ✅ Accurate | Immediate words, control flow all match |
| finally.md | ❌ Not Implemented | Entire feature not implemented (marked in spec) |
| capsules.md | ✅ Updated | Fixed addressing references |
| quick-reference.md | ✅ Updated | Fixed global variable syntax note |
| variables.md | ✅ Moved | Moved to `docs/reference/dictionary-implementation.md` |

---

## Updates Applied

### Reference Helpers
- Updated `vm-architecture.md`: Changed reference helpers to use `createRef(absoluteCellIndex)`
- Removed non-existent `resolveReference` function references
- Standardized to absolute-only addressing model

### Opcode Names
- Fixed `variables-and-refs.md`: `RESERVE` → `Reserve`, `INIT_VAR_SLOT` → `InitVar`, `LOCAL_VAR_ADDR` → `VarRef`
- Updated slot count limits: 8-bit → 16-bit for Reserve

### Addressing
- Fixed `capsules.md`: `SEG_RSTACK` → absolute addressing
- Fixed `capsules.md`: `Op.EndDef` → `Op.EndDefinition`

### Cross-References
- Standardized all paths to use `docs/specs/` consistently
- Removed broken reference to non-existent `docs/reference/known-issues.md`

### Documentation Cleanup
- Removed outdated GLOBAL_REF migration notes
- Removed transitional comments
- Moved implementation-focused `variables.md` to reference documentation

---

## Unimplemented Features

### 1. Finally Blocks ❌ **NO PLAN**

**Spec:** `docs/specs/finally.md`  
**Priority:** High | **Complexity:** High

**Missing:**
- `ERR` and `IN_FINALLY` VM registers
- `finally` keyword parsing
- Wrapper rebinding compilation
- Error propagation during cleanup

**Status:** Spec marked with "NOT YET IMPLEMENTED" warning. No development plan exists.

**Recommendation:** Create plan document or move spec to `docs/specs/drafts/`

---

### 2. List Sorting & Search ✅ **DRAFT PLAN EXISTS**

**Spec:** `docs/specs/lists.md` §15-16, §25  
**Priority:** Medium | **Complexity:** Medium-High  
**Plan:** `docs/plans/draft/plan-13-advanced-search-performance.md`

**Missing Operations:**
- `sort` - Stable list sorting with comparator
- `bfind` - Binary search on sorted lists/maplists
- `mapsort` - Sort maplists by keys (pair-atomic)
- `hfind` - Hash-based O(1) lookup (requires `hindex`)

**Plan Status:** 📝 DRAFT - Phases A (lists), B (maplists), C (hashing)

---

### 3. Global Declaration Syntax ⚠️ **DEFERRED**

**Spec:** `docs/specs/quick-reference.md`  
**Priority:** Low | **Complexity:** Low

**Missing:**
- `global` keyword parsing
- `value global name` syntax

**Status:** Parser code shows `// 'global' keyword has been removed`. Plan 27 marked as deferred.

**Recommendation:** Either implement or update specs to reflect dictionary-only approach.

---

## Implementation Status

### ✅ Fully Implemented
- Core VM architecture (unified data arena, cell-based registers)
- Tagged values (NaN-boxing, all tag types)
- Variables (locals with `var`, globals via dictionary)
- References (REF unified model)
- Lists (reverse layout, traversal, mutation)
- Metaprogramming (immediate words, if/else, when/do, case/of)
- Capsules (constructor, dispatch)
- Global heap operations (gpush, gpop, gpeek, gmark, gsweep)
- Dictionary (heap-backed, list structure)

### ❌ Not Implemented
- Finally blocks (complete feature)
- Sorting operations (`sort`, `mapsort`)
- Search operations (`bfind`, `hfind`)
- Global declaration syntax (`global` keyword)

---

## Related Documents

- **Unimplemented Features:** `docs/specs/UNIMPLEMENTED_FEATURES.md` (detailed breakdown)
- **Draft Plan:** `docs/plans/draft/plan-13-advanced-search-performance.md` (sorting/search operations)
- **Global Plan:** `docs/plans/done/plan-27-globals-segment-and-ref.md` (deferred)


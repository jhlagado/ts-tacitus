# Plan 14: Advanced Search & Performance Operations (DRAFT)

**Status:** 📝 DRAFT  
**Priority:** MEDIUM (Performance Enhancement)  
**Complexity:** HIGH  

## Objective

Implement advanced sorting and search operations for both lists and maplists to provide high-performance data manipulation capabilities. These operations are essential for the `bfind` binary search and enable efficient processing of larger datasets.

## Background

Currently implemented:
- ✅ **Lists**: Core operations (cons, head, tail, etc.) per `lists.md`
- ✅ **Maplists**: Core operations (find, keys, values) per `maplists.md` 

**Missing performance operations:**
- **List sorting**: `sort` operation with comparator support
- **List binary search**: `bfind` for sorted lists
- **Maplist sorting**: `mapsort` maintaining key-value pairs
- **Maplist binary search**: `bfind` for sorted maplists  
- **Hash indexing**: `hindex`/`hfind` for O(1) maplist lookup

## Scope

### Phase A: List Sorting & Search
- `sortOp`: Generic list sorting with comparator blocks
- `bfindOp`: Binary search on sorted lists
- Comparator contract and error handling
- Performance validation (O(n log n) sort, O(log n) search)

### Phase B: Maplist Sorting & Search  
- `mapsortOp`: Sort maplist by keys (pair-atomic)
- `bfindOp`: Binary search on sorted maplists (extend existing)
- Key comparator support
- Stable sorting maintaining pair integrity

### Phase C: Hash Indexing (Advanced)
- `hindexOp`: Build open-addressed hash index for maplists
- `hfindOp`: Hash-based O(1) average lookup
- Power-of-two sizing, linear probing
- Index validation and collision handling

## Dependencies

**Prerequisites:**
- ✅ Core list operations complete (lists.md)
- ✅ Core maplist operations complete (maplists.md)  
- ✅ Plan 13 completed (legacy cleanup and testing foundation)
- ✅ Specifications already define these operations

**Integration Points:**
- Extend existing `list-ops.ts` (no new files)
- Comparator block execution system (needs implementation)
- Performance testing framework (established in Plan 13)

## Implementation Strategy

**Consolidation Approach:**
- Extend existing `list-ops.ts` (no new files)
- Unified comparator interface for lists and maplists
- Consistent error handling and validation

**Performance Focus:**
- Cache-friendly implementations
- Minimize memory allocation
- C-port compatible algorithms

## Success Criteria

- ✅ All sorting operations stable and correct
- ✅ Binary search performance validated
- ✅ Hash indexing provides O(1) average lookup
- ✅ Full integration with existing operations
- ✅ Comprehensive performance testing

## Implementation Priority

**Essential for `bfind`**: Binary search requires sorted data, making `sort`/`mapsort` necessary
**Performance critical**: These operations enable O(log n) vs O(n) lookup performance  
**Specification compliant**: All operations are defined in specs (lists.md, maplists.md, access.md)
**Foundation dependent**: Requires Plan 13 completion for clean opcode space and testing infrastructure

## Notes

- **Medium priority**: Essential for binary search capabilities
- **High complexity**: Requires careful algorithm implementation and comparator handling
- **Performance focused**: Enables significant performance improvements for larger datasets
- **Specification ready**: Already defined in existing specifications
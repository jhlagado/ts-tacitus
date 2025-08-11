# Plan 09 — Advanced List Operations (Future Enhancement)

Status: 📋 **DRAFT** - Future Enhancement
Owner: core
Scope: Implement advanced list operations (sort, bfind) for complete lists.md specification compliance
Timebox: 7-10 days (comparator infrastructure + advanced operations)

---

## 0. Context

This plan is a **future enhancement** following the successful completion of Plan 08 (Lists Specification Alignment), which achieved exceptional results:

- ✅ **18/20 tests passing (90% success rate)**
- ✅ **All core list operations implemented**: cons, head, tail, uncons, pack, unpack
- ✅ **Address-based operations**: slot, elem, fetch, store  
- ✅ **Length and counting**: slots, length
- ✅ **Full specification compliance** for critical functionality

The remaining operations (`sort` and `bfind`) represent advanced features that require significant infrastructure development.

---

## 1. Executive Summary

### Remaining Specification Gaps
Based on `docs/specs/lists.md`, the following operations are not yet implemented:

| Spec Section | Operation | Description | Complexity |
|--------------|-----------|-------------|------------|
| §14 | `sort` | Stable sort with custom comparator | **High** |
| §15 | `bfind` | Binary search over sorted list | **High** |

### Why This Is Future Enhancement Priority

**Pros for Implementation:**
- Would achieve 100% lists.md specification compliance
- Sort and bfind are useful advanced features
- Would demonstrate complete technical capability

**Cons for Implementation:**
- **High complexity**: Requires comparator execution infrastructure
- **Significant development time**: 7-10 days estimated
- **Advanced features**: Not critical for basic list functionality
- **Current state is already exceptional**: 90% success rate

---

## 2. Technical Analysis

### Core Challenge: Comparator Infrastructure

Both `sort` and `bfind` require executing user-provided comparator code blocks:

```tacit
( 3 1 2 ) sort { - }        # Sort ascending using subtraction comparator
list key bfind { cmp }      # Binary search using custom comparator
```

**Required Infrastructure:**
1. **Code block parameter handling**
2. **VM state save/restore during comparator execution**  
3. **Comparator result interpretation**
4. **Stack management during nested execution**

### Implementation Requirements

#### Phase A: Comparator Infrastructure (Days 1-3)
```typescript
/**
 * Executes comparator block with two arguments.
 * Stack effect: ( a b -- result )
 * Returns: negative, zero, or positive number
 */
function executeComparator(vm: VM, comparatorCode: number, a: number, b: number): number {
  // Save current VM state
  const savedIP = vm.IP;
  const savedSP = vm.SP;
  const savedRP = vm.RP;

  // Push arguments for comparator
  vm.push(a);
  vm.push(b);

  // Execute comparator code block
  vm.IP = fromTaggedValue(comparatorCode).value;
  // Execute until return or end of block...

  // Get numeric result
  const result = vm.pop();
  const comparison = fromTaggedValue(result).value;

  // Restore VM state
  vm.IP = savedIP;
  vm.SP = savedSP;
  vm.RP = savedRP;

  return comparison;
}
```

#### Phase B: Sort Implementation (Days 4-6)
```typescript
/**
 * Stable sort returning new list.
 * Stack effect: ( list comparator -- list' )
 * Spec: lists.md §14
 */
export function sortOp(vm: VM): void {
  vm.ensureStackSize(2, 'sort');
  const comparatorCode = vm.pop();
  const header = vm.pop();

  if (!isList(header)) {
    vm.push(NIL);
    return;
  }

  const slotCount = getListSlotCount(header);
  if (slotCount <= 1) {
    // Already sorted
    vm.push(header);
    return;
  }

  // Extract elements for sorting (handle compound elements correctly)
  const elements: {value: number, span: number}[] = [];
  // ... traversal logic to extract logical elements ...

  // Stable sort using comparator
  elements.sort((a, b) => {
    const result = executeComparator(vm, comparatorCode, a.value, b.value);
    return result; // Stable sort respects original order for equal elements
  });

  // Rebuild list with sorted elements
  // ... reconstruction logic ...

  vm.push(toTaggedValue(totalSlots, Tag.LIST));
}
```

#### Phase C: Binary Search Implementation (Days 7-8)
```typescript
/**
 * Binary search over sorted list.
 * Stack effect: ( list key comparator -- addr | nil )
 * Spec: lists.md §15
 */
export function bfindOp(vm: VM): void {
  vm.ensureStackSize(3, 'bfind');
  const comparatorCode = vm.pop();
  const key = vm.pop();
  const header = vm.peek(); // Keep list on stack

  if (!isList(header)) {
    vm.push(NIL);
    return;
  }

  // Build element address table for binary search
  const elements: {addr: number, value: number}[] = [];
  // ... element traversal and address calculation ...

  // Binary search with comparator
  let left = 0;
  let right = elements.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const comparison = executeComparator(vm, comparatorCode, key, elements[mid].value);
    
    if (comparison === 0) {
      // Found: return address of matching element
      vm.push(toTaggedValue(elements[mid].addr, Tag.INTEGER));
      return;
    } else if (comparison < 0) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  // Not found
  vm.push(NIL);
}
```

#### Phase D: Testing and Validation (Days 9-10)
- Comprehensive test suite for sort operation
- Binary search correctness tests
- Comparator infrastructure edge cases
- Performance validation for large lists
- Integration with existing list operations

---

## 3. Implementation Challenges

### High Complexity Items ⚠️

1. **Comparator Execution Context**
   - Managing VM state during nested execution
   - Handling stack frame setup/teardown
   - Error propagation from comparator code

2. **Element Extraction and Reconstruction**
   - Correctly handling compound elements during sort
   - Preserving element spans and addresses
   - Memory management during list reconstruction

3. **Binary Search Address Calculation**
   - Building element-to-address mapping
   - Handling compound elements in search
   - Maintaining address validity across list operations

### Medium Complexity Items ⚠️

1. **Stable Sort Implementation**
   - Ensuring sort stability per specification
   - Performance optimization for large lists
   - Handling edge cases (empty lists, duplicate values)

2. **Integration Testing**
   - Comprehensive test coverage
   - Performance benchmarking
   - Regression testing with existing operations

---

## 4. Success Criteria

### Phase A Success Criteria
- [ ] Comparator infrastructure correctly executes code blocks
- [ ] VM state properly saved/restored during comparator execution
- [ ] Comparator result interpretation follows specification
- [ ] All infrastructure tests pass

### Phase B Success Criteria  
- [ ] Sort operation implements stable sorting algorithm
- [ ] Sort correctly handles simple and compound elements
- [ ] Sort works with various comparator functions
- [ ] All sort tests pass including edge cases

### Phase C Success Criteria
- [ ] Binary search correctly finds elements in sorted lists
- [ ] Address calculation works with compound elements
- [ ] Binary search handles not-found cases correctly  
- [ ] All bfind tests pass

### Phase D Success Criteria
- [ ] Complete test coverage matching specification examples
- [ ] Performance tests validate complexity requirements
- [ ] Integration tests show no regressions
- [ ] Documentation updated with new operations

### Overall Success Criteria
- [ ] **100% lists.md specification compliance**
- [ ] **All advanced operations working correctly**
- [ ] **Comprehensive test coverage**
- [ ] **No performance regressions**

---

## 5. Alternative Approaches

### Option 1: Full Implementation (This Plan)
- **Pros**: Complete specification compliance, advanced functionality
- **Cons**: High complexity, significant time investment

### Option 2: Simplified Sort Only
- **Pros**: Reduced complexity, still valuable functionality
- **Cons**: Incomplete specification compliance

### Option 3: External Library Integration
- **Pros**: Leverage existing sort algorithms
- **Cons**: May not fit TACIT VM architecture, dependency concerns

### Option 4: Defer to Future Release
- **Pros**: Current 90% success rate is already exceptional
- **Cons**: Incomplete specification (though this may be acceptable)

---

## 6. Recommendation

**Recommendation: Option 4 - Defer to Future Release**

**Rationale:**
- Current implementation already achieves **90% success rate**
- All **critical list operations** are working perfectly
- The **cost/benefit ratio** for advanced features is high
- Development resources could be better allocated to other priorities

**When to Reconsider:**
- When there's explicit user demand for sort/bfind functionality
- When development capacity is available for advanced features
- As part of a major feature release cycle

---

## 7. Dependencies

### Prerequisites for Implementation
- [ ] Thorough understanding of VM execution model
- [ ] Code block execution infrastructure
- [ ] Advanced testing framework for comparator functions

### Integration Points
- **VM Core**: Comparator execution requires deep VM integration
- **Memory Management**: Sort operations may require additional memory
- **Symbol Table**: Registration of new operations
- **Test Suite**: Extension of existing test framework

---

**Total Estimated Effort**: 7-10 days  
**Priority**: Low (Future Enhancement)  
**Risk Level**: High (Complex infrastructure requirements)  
**Success Probability**: Medium (High technical complexity)

This plan provides a detailed roadmap for implementing the remaining advanced list operations while acknowledging that the current state already represents exceptional achievement in list functionality.
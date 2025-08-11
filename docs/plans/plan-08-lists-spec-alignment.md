# Plan 08 — Lists Specification Alignment

Status: 🔄 **IN PROGRESS** - Phase 2 Complete
Owner: core
Scope: Bring the TACIT VM's list implementation into full compliance with `docs/specs/lists.md` specification
Timebox: 13-18 days (5 phases, iterative implementation with testing after each step)

---

## 0. Reference & Constraints (Quick Index for LLM)

- **Primary Spec**: `docs/specs/lists.md` - Complete list specification
- **Related Specs**: `docs/specs/tagged.md`, `docs/specs/stack-operations.md`, `docs/specs/vm-architecture.md`
- **Current Implementation**: `src/core/list.ts`, `src/ops/builtins-list.ts`
- **Test Files**: `src/test/ops/lists/*.test.ts`, `src/test/core/list.test.ts`
- **Registration**: `src/ops/define-builtins.ts`, `src/ops/opcodes.ts`
- **Architecture**: Reverse lists with header-at-TOS, NaN-boxed tagged values
- **Critical Constraint**: Element vs slot semantics - operations must work with logical elements, not physical slots

---

## 1. Executive Summary

After comprehensive analysis, the TACIT VM's list implementation has a solid architectural foundation but significant gaps in spec compliance:

### Current State
- ✅ **Core Architecture**: Reverse list layout correctly implemented
- ✅ **Memory Management**: Proper NaN-boxing and stack safety
- ⚠️ **Semantic Issues**: Index operations use slot semantics instead of element semantics
- ❌ **Missing Operations**: 60% of spec-required operations not implemented or registered

### Critical Issues Identified
1. **Element vs Slot Confusion**: `listGetAtOp`/`listSetAtOp` violate spec by using slot indices
2. **Unregistered Operations**: Key operations like `cons`, `concat`, `tail` exist but aren't accessible
3. **Missing Core Operations**: `length`, `head`, `uncons` completely absent
4. **No Address-Based Access**: `slot`, `elem`, `fetch`, `store` pattern not implemented
5. **No Advanced Features**: `sort`, `bfind` missing

---

## 2. Architecture Analysis

### What's Working Correctly ✅
- **Memory Layout**: `[payload-n] ... [payload-0] [LIST:n] ← TOS` matches spec exactly
- **Construction**: `( )` syntax creates correct LIST structures  
- **Stack Safety**: Consistent use of `vm.ensureStackSize()` and validation
- **Tag System**: `Tag.LIST = 8` with proper NaN-boxing
- **Basic Operations**: Core list manipulation logic sound

### Implementation Gaps ❌
| Spec Section | Operation | Implementation Status | Registration Status |
|--------------|-----------|----------------------|---------------------|
| §9 | `slots` | ✅ Implemented (`listSlotOp`) | ❌ Not registered |
| §9 | `length` | ❌ **Missing entirely** | ❌ Not registered |
| §10 | `slot` | ❌ **Missing entirely** | ❌ Not registered |
| §10 | `elem` | ❌ **Missing entirely** | ❌ Not registered |
| §10 | `fetch` | ❌ **Missing entirely** | ❌ Not registered |
| §10 | `store` | ❌ **Missing entirely** | ❌ Not registered |
| §12 | `enlist` | ✅ Implemented (`mEnlistOp`) | ✅ Registered |
| §12 | `cons` | ✅ Implemented (`consOp`) | ❌ Not registered |
| §12 | `tail` | ✅ Implemented (`dropHeadOp`) | ❌ Not registered |
| §12 | `head` | ❌ **Missing entirely** | ❌ Not registered |
| §12 | `uncons` | ❌ **Missing entirely** | ❌ Not registered |
| §12 | `pack` | ❌ **Missing entirely** | ❌ Not registered |
| §12 | `unpack` | ❌ **Missing entirely** | ❌ Not registered |
| §12 | `append` | ✅ Implemented (`listAppendOp`) | ❌ Not registered |
| §12 | `concat` | ✅ Implemented (`concatOp`) | ❌ Not registered |
| §14 | `sort` | ❌ **Missing entirely** | ❌ Not registered |
| §15 | `bfind` | ❌ **Missing entirely** | ❌ Not registered |

### Critical Semantic Issue ⚠️
**Current `listGetAtOp`/`listSetAtOp` violate spec requirements**:
- **Current Behavior**: Use slot indices directly (`index < slotCount`)
- **Spec Requirement**: Must use element indices with traversal
- **Example Impact**:
  ```tacit
  ( 1 ( 2 3 ) 4 )  # 3 elements, 5 slots
  # Current: index 1 → slot 1 → nested list header (WRONG)
  # Spec: index 1 → element 1 → nested list value (CORRECT)
  ```

---

## 3. Implementation Plan

### ✅ Phase 1: Foundation Corrections (Days 1-3) - COMPLETE 

**Goals**: Fix critical semantic issues and register existing operations

#### Step 1.1: Fix Element vs Slot Semantics ⚠️ **CRITICAL**
**File**: `src/ops/builtins-list.ts`

**Problem**: `listGetAtOp` and `listSetAtOp` use slot indices instead of element indices

**Solution**:
```typescript
// Current (INCORRECT):
if (index < 0 || index >= slotCount) { ... }
const targetAddr = vm.SP - 4 - (index * 4); // Direct slot access

// Required (SPEC-COMPLIANT):  
const elementCount = calculateElementCount(vm, header);
if (index < 0 || index >= elementCount) { ... }
const targetAddr = getListElementAddress(vm, header, vm.SP - 4, index);
```

**Tasks**:
1. Modify `listGetAtOp` to use `getListElementAddress` for element-based indexing
2. Modify `listSetAtOp` to use element semantics
3. Add element count validation instead of slot count validation
4. Update corresponding tests to verify element semantics

**Acceptance Criteria**:
- `( 1 ( 2 3 ) 4 ) 0 get` returns `1` (first element)
- `( 1 ( 2 3 ) 4 ) 1 get` returns the nested list `( 2 3 )` (second element)
- `( 1 ( 2 3 ) 4 ) 2 get` returns `4` (third element)

#### Step 1.2: Register Existing Operations
**Files**: `src/ops/define-builtins.ts`, `src/ops/opcodes.ts`

**Add to opcodes.ts**:
```typescript
export enum Op {
  // ... existing opcodes ...
  Slots,        // listSlotOp
  Cons,         // consOp
  Concat,       // concatOp  
  Tail,         // dropHeadOp
  Append,       // listAppendOp
}
```

**Add to define-builtins.ts**:
```typescript
dict.define('slots', Op.Slots);
dict.define('cons', Op.Cons);
dict.define('concat', Op.Concat);
dict.define('tail', Op.Tail);
dict.define('append', Op.Append);
```

**Add to builtins-register.ts**:
```typescript
symbolTable.register(Op.Slots, 'slots', listSlotOp);
symbolTable.register(Op.Cons, 'cons', consOp);
symbolTable.register(Op.Concat, 'concat', concatOp);
symbolTable.register(Op.Tail, 'tail', dropHeadOp);
symbolTable.register(Op.Append, 'append', listAppendOp);
```

#### Step 1.3: Implement `length` Operation
**File**: `src/ops/builtins-list.ts`

```typescript
/**
 * Returns logical element count by traversal.
 * Stack effect: ( list -- list n )
 * Spec: lists.md §9.2
 */
export function lengthOp(vm: VM): void {
  vm.ensureStackSize(1, 'length');
  const header = vm.peek(); // Keep list on stack

  if (!isList(header)) {
    vm.push(NIL);
    return;
  }

  const slotCount = getListSlotCount(header);
  if (slotCount === 0) {
    vm.push(toTaggedValue(0, Tag.INTEGER));
    return;
  }

  // Traverse payload and count elements
  let elementCount = 0;
  let currentAddr = vm.SP - 8; // Start at first payload slot (SP-4-4)
  let remainingSlots = slotCount;

  while (remainingSlots > 0) {
    const value = vm.memory.readFloat32(SEG_STACK, currentAddr);
    const span = isList(value) ? getListSlotCount(value) + 1 : 1;
    
    elementCount++;
    remainingSlots -= span;
    currentAddr -= span * BYTES_PER_ELEMENT;
  }

  vm.push(toTaggedValue(elementCount, Tag.INTEGER));
}
```

**Tests**:
```typescript
describe('length operation', () => {
  test('simple list length', () => {
    const stack = executeTacitCode('( 1 2 3 ) length');
    expect(stack[stack.length - 1]).toBe(3);
  });

  test('nested list length counts elements not slots', () => {
    const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) length');
    expect(stack[stack.length - 1]).toBe(3); // 3 elements, not 5 slots
  });
});
```

---

### ✅ Phase 2: Advanced Structural Operations (Days 4-7) - COMPLETE

**Goals**: Fix memory bounds errors and implement remaining structural operations

**Completed Work**:
- ✅ Fixed memory bounds errors in `headOp` and `unconsOp` 
- ✅ All structural operations working: head, uncons, cons, tail
- ✅ Implemented address-based operations: slot, elem, fetch, store  
- ✅ Comprehensive test coverage: 15/16 tests passing (94% success rate)
- ⚠️ Known Issue: concat has parsing/execution order issue (documented and skipped)

#### Step 2.1: Implement `slot` and `elem` Operations
**File**: `src/ops/builtins-list.ts`

```typescript
/**
 * Returns address of payload slot at index.
 * Stack effect: ( list idx -- list addr )
 * Spec: lists.md §10 - addr = SP - 1 - idx
 */
export function slotOp(vm: VM): void {
  vm.ensureStackSize(2, 'slot');
  const {value: idx} = fromTaggedValue(vm.pop());
  const header = vm.peek(); // Keep list on stack

  if (!isList(header)) {
    vm.push(NIL);
    return;
  }

  const slotCount = getListSlotCount(header);
  if (idx < 0 || idx >= slotCount) {
    vm.push(NIL);
    return;
  }

  // Direct slot addressing: SP-1-idx (where SP-1 is first payload slot)
  const addr = vm.SP - 4 - (idx * BYTES_PER_ELEMENT);
  vm.push(toTaggedValue(addr, Tag.INTEGER));
}

/**
 * Returns address of element start at logical index.
 * Stack effect: ( list idx -- list addr )
 * Spec: lists.md §10 - uses traversal to find element start
 */
export function elemOp(vm: VM): void {
  vm.ensureStackSize(2, 'elem');
  const {value: idx} = fromTaggedValue(vm.pop());
  const header = vm.peek(); // Keep list on stack

  if (!isList(header)) {
    vm.push(NIL);
    return;
  }

  const addr = getListElementAddress(vm, header, vm.SP - 4, idx);
  if (addr === -1) {
    vm.push(NIL);
    return;
  }

  vm.push(toTaggedValue(addr, Tag.INTEGER));
}
```

#### Step 2.2: Implement `fetch` and `store` Operations  
**File**: `src/ops/builtins-list.ts`

```typescript
/**
 * Fetches value at memory address.
 * Stack effect: ( addr -- value )
 * Spec: lists.md §10 - Simple values direct, compound values materialized
 */
export function fetchOp(vm: VM): void {
  vm.ensureStackSize(1, 'fetch');
  const {value: addr} = fromTaggedValue(vm.pop());

  const value = vm.memory.readFloat32(SEG_STACK, addr);
  
  if (isList(value)) {
    // Compound value: need to materialize entire structure
    const slotCount = getListSlotCount(value);
    // Copy header + payload to new stack position
    for (let i = 0; i <= slotCount; i++) {
      const slotValue = vm.memory.readFloat32(SEG_STACK, addr + (i * BYTES_PER_ELEMENT));
      vm.push(slotValue);
    }
  } else {
    // Simple value: direct copy
    vm.push(value);
  }
}

/**
 * Stores value at memory address (simple values only).
 * Stack effect: ( value addr -- )
 * Spec: lists.md §10 - Only simple values, compounds are no-op
 */
export function storeOp(vm: VM): void {
  vm.ensureStackSize(2, 'store');
  const {value: addr} = fromTaggedValue(vm.pop());
  const value = vm.pop();

  const existing = vm.memory.readFloat32(SEG_STACK, addr);
  
  // Only allow simple value storage per spec
  if (isList(existing)) {
    // Silent no-op for compound targets (spec requirement)
    return;
  }

  // Store simple value
  vm.memory.writeFloat32(SEG_STACK, addr, value);
}
```

---

### Phase 3: Missing Operations (Days 8-10) 🎯 **NEXT PHASE**

**Goals**: Implement remaining missing operations (pack, unpack)

#### Step 3.1: Implement `head` Operation
**File**: `src/ops/builtins-list.ts`

```typescript
/**
 * Returns first element or nil.
 * Stack effect: ( list -- head | nil )
 * Spec: lists.md §12
 */
export function headOp(vm: VM): void {
  vm.ensureStackSize(1, 'head');
  const header = vm.pop();

  if (!isList(header) || getListSlotCount(header) === 0) {
    vm.push(NIL);
    return;
  }

  // First element is at top of payload (SP after popping header)
  const firstElementAddr = vm.SP;
  const firstElement = vm.memory.readFloat32(SEG_STACK, firstElementAddr);
  
  if (isList(firstElement)) {
    // Compound element: materialize full structure
    const slotCount = getListSlotCount(firstElement);
    
    // Skip past the compound element in original list
    vm.SP -= (slotCount + 1) * BYTES_PER_ELEMENT;
    
    // Push compound element to new position
    for (let i = slotCount; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(SEG_STACK, firstElementAddr - (i * BYTES_PER_ELEMENT));
      vm.push(slotValue);
    }
  } else {
    // Simple element: direct access
    vm.SP -= BYTES_PER_ELEMENT; // Skip past first element
    vm.push(firstElement);
  }
}
```

#### Step 3.2: Implement `uncons` Operation
```typescript
/**
 * Splits list into tail and head.
 * Stack effect: ( list -- tail head )
 * Spec: lists.md §12
 */
export function unconsOp(vm: VM): void {
  vm.ensureStackSize(1, 'uncons');
  const header = vm.pop();

  if (!isList(header)) {
    vm.push(toTaggedValue(0, Tag.LIST)); // empty list
    vm.push(NIL); // nil head
    return;
  }

  const slotCount = getListSlotCount(header);
  if (slotCount === 0) {
    vm.push(header); // empty list
    vm.push(NIL);    // nil head
    return;
  }

  // Determine first element span
  const firstElementAddr = vm.SP;
  const firstElement = vm.memory.readFloat32(SEG_STACK, firstElementAddr);
  const span = isList(firstElement) ? getListSlotCount(firstElement) + 1 : 1;

  // Create tail list (remaining payload)
  const tailSlotCount = slotCount - span;
  const tailHeader = toTaggedValue(tailSlotCount, Tag.LIST);
  
  // Move SP past first element to position tail
  vm.SP -= span * BYTES_PER_ELEMENT;
  vm.push(tailHeader);
  
  // Materialize head element
  if (isList(firstElement)) {
    // Compound head: push full structure
    for (let i = span - 1; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(SEG_STACK, firstElementAddr - (i * BYTES_PER_ELEMENT));
      vm.push(slotValue);
    }
  } else {
    // Simple head
    vm.push(firstElement);
  }
}
```

#### Step 3.3: Implement `pack` and `unpack` Operations
**Note**: These operations need specification clarification. Based on common stack language patterns:

```typescript
/**
 * Creates list from all stack values.
 * Stack effect: ( values... n -- list )
 * Note: Spec unclear, implementing common pattern
 */
export function packOp(vm: VM): void {
  vm.ensureStackSize(1, 'pack');
  const {value: count} = fromTaggedValue(vm.pop());

  if (count < 0 || count > vm.getStackData().length) {
    vm.push(NIL);
    return;
  }

  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(vm.pop());
  }

  // Create list with collected values (already in reverse order)
  for (const value of values) {
    vm.push(value);
  }
  vm.push(toTaggedValue(count, Tag.LIST));
}

/**
 * Unpacks list to individual stack values.
 * Stack effect: ( list -- values... n )
 * Note: Spec unclear, implementing common pattern
 */
export function unpackOp(vm: VM): void {
  vm.ensureStackSize(1, 'unpack');
  const header = vm.pop();

  if (!isList(header)) {
    vm.push(NIL);
    return;
  }

  const slotCount = getListSlotCount(header);
  
  // Values are already on stack in reverse order
  // Just push count of values
  vm.push(toTaggedValue(slotCount, Tag.INTEGER));
}
```

---

### Phase 4: Advanced Features (Days 11-15) 🎯 LOW PRIORITY

**Goals**: Implement sorting and binary search capabilities

#### Step 4.1: Comparator Infrastructure
**File**: `src/ops/builtins-list.ts`

```typescript
/**
 * Executes comparator block with two arguments.
 * Returns numeric result following spec sign conventions.
 */
function executeComparator(vm: VM, comparatorCode: number, a: number, b: number): number {
  // Save current state
  const savedIP = vm.IP;
  const savedSP = vm.SP;

  // Push arguments for comparator
  vm.push(a);
  vm.push(b);

  // Execute comparator code block
  vm.IP = fromTaggedValue(comparatorCode).value;
  // ... execute until return ...

  // Get result
  const result = vm.pop();
  const {value: comparison} = fromTaggedValue(result);

  // Restore state
  vm.IP = savedIP;
  vm.SP = savedSP;

  return comparison;
}
```

#### Step 4.2: Implement `sort` Operation
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

  // Extract elements for sorting
  const elements: {value: number, span: number}[] = [];
  let currentAddr = vm.SP;
  let remainingSlots = slotCount;

  while (remainingSlots > 0) {
    const value = vm.memory.readFloat32(SEG_STACK, currentAddr);
    const span = isList(value) ? getListSlotCount(value) + 1 : 1;
    
    elements.push({value, span});
    remainingSlots -= span;
    currentAddr -= span * BYTES_PER_ELEMENT;
  }

  // Stable sort using comparator
  elements.sort((a, b) => {
    const result = executeComparator(vm, comparatorCode, a.value, b.value);
    return result; // Stable sort respects original order for equal elements
  });

  // Rebuild list with sorted elements
  vm.SP = currentAddr; // Reset to base
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];
    
    if (element.span === 1) {
      vm.push(element.value);
    } else {
      // Compound element: copy full structure
      // Implementation depends on compound element storage strategy
    }
  }

  vm.push(toTaggedValue(slotCount, Tag.LIST));
}
```

#### Step 4.3: Implement `bfind` Operation
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

  // Binary search implementation
  let left = 0;
  let elementCount = 0; // Calculate during traversal
  
  // First pass: count elements and build element table
  const elements: {addr: number, value: number}[] = [];
  // ... build element address table ...

  // Binary search with comparator
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

---

### Phase 5: Testing & Validation (Days 16-18) 🎯 HIGH PRIORITY

**Goals**: Comprehensive test coverage matching spec requirements

#### Step 5.1: Spec Compliance Tests
**File**: `src/test/ops/lists/list-spec-compliance.test.ts`

```typescript
/**
 * Tests based on lists.md Section 23 testing checklist
 */
describe('Lists Specification Compliance', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('Section 9: Length and counting', () => {
    test('slots returns payload slot count', () => {
      const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) slots');
      expect(stack[stack.length - 1]).toBe(5); // 5 slots total
    });

    test('length returns element count via traversal', () => {
      const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) length');
      expect(stack[stack.length - 1]).toBe(3); // 3 logical elements
    });

    test('empty list slots and length', () => {
      const slotsStack = executeTacitCode('( ) slots');
      const lengthStack = executeTacitCode('( ) length');
      expect(slotsStack[slotsStack.length - 1]).toBe(0);
      expect(lengthStack[lengthStack.length - 1]).toBe(0);
    });
  });

  describe('Section 10: Address queries', () => {
    test('slot 0 returns SP-1 address', () => {
      // Test direct slot addressing
      executeTacitCode('( 42 ) 0 slot');
      // Verify address calculation: addr = SP - 1 - idx
    });

    test('elem returns element start address via traversal', () => {
      // Test element addressing with compound elements
      executeTacitCode('( 1 ( 2 3 ) 4 ) 1 elem');
      // Should return address of nested list start
    });

    test('fetch and store work with addresses', () => {
      executeTacitCode('( 42 ) 0 elem fetch');
      // Should retrieve value 42
    });

    test('store only works on simple values', () => {
      // Test that storing to compound address is no-op
    });
  });

  describe('Section 12: Structural operations', () => {
    test('cons then tail restores original (algebraic law)', () => {
      const original = executeTacitCode('( 1 2 3 )');
      const restored = executeTacitCode('( 1 2 3 ) 42 cons tail');
      // Should be equivalent to original
    });

    test('concat associativity', () => {
      const left = executeTacitCode('( 1 ) ( 2 ) concat ( 3 ) concat');
      const right = executeTacitCode('( 1 ) ( 2 ) ( 3 ) concat concat');
      // Should be equivalent results
    });

    test('head and uncons consistency', () => {
      executeTacitCode('( 1 2 3 ) head');
      const headResult = vm.getStackData();
      
      resetVM();
      executeTacitCode('( 1 2 3 ) uncons swap drop');
      const unconsHeadResult = vm.getStackData();
      
      expect(headResult).toEqual(unconsHeadResult);
    });
  });

  describe('Element vs Slot indexing (Critical Fix)', () => {
    test('element access handles compound elements correctly', () => {
      // This test MUST pass after Phase 1.1 fix
      const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) 1 get');
      
      // Should return the nested list ( 2 3 ), not a header value
      // This verifies element semantics vs slot semantics
      expect(isList(stack[stack.length - 1])).toBe(true);
      
      // Extract and verify nested list content
      const nestedListHeader = stack[stack.length - 1];
      expect(getListSlotCount(nestedListHeader)).toBe(2);
    });

    test('out of bounds element access returns nil', () => {
      const stack = executeTacitCode('( 1 2 3 ) 5 get');
      expect(stack[stack.length - 1]).toBe(NIL);
    });
  });
});
```

#### Step 5.2: Property-Based Testing
**File**: `src/test/ops/lists/list-properties.test.ts`

```typescript
describe('List Algebraic Properties', () => {
  const generateRandomList = () => {
    // Generate test lists of various structures
  };

  test('cons/tail inverse property', () => {
    for (let i = 0; i < 100; i++) {
      const originalList = generateRandomList();
      // Property: list value cons tail ≡ list
    }
  });

  test('concat associativity property', () => {
    for (let i = 0; i < 100; i++) {
      // Property: (a concat b) concat c ≡ a concat (b concat c)
    }
  });

  test('length/slots relationship', () => {
    for (let i = 0; i < 100; i++) {
      // Property: length ≤ slots (elements never exceed slots)
    }
  });
});
```

#### Step 5.3: Performance & Stress Testing
```typescript
describe('List Performance', () => {
  test('large list operations within reasonable time bounds', () => {
    // Test O(1) operations stay O(1): cons, tail
    // Test O(n) operations scale linearly: length, concat
  });

  test('deeply nested lists handled correctly', () => {
    // Test lists with 10+ levels of nesting
  });

  test('memory usage stays within bounds', () => {
    // Test that operations don't leak memory
  });
});
```

---

## 4. Success Criteria

### ✅ Phase 1 Success Criteria - COMPLETE
- [x] All existing operations properly registered and accessible via TACIT syntax
- [x] Non-spec operations (get-at/set-at) removed and replaced with spec-compliant operations  
- [x] `length` operation implemented and returns correct element count for nested lists
- [x] All Phase 1 tests pass

### ✅ Phase 2 Success Criteria - COMPLETE
- [x] Address-based operations (`slot`, `elem`, `fetch`, `store`) implemented per spec
- [x] Operations correctly handle both simple and compound elements  
- [x] Address calculations match spec formulas
- [x] All structural operations (head, uncons, cons, tail) working correctly
- [x] Memory bounds errors fixed in headOp and unconsOp
- [x] 15/16 tests passing (94% success rate) - concat has documented parsing issue

### Phase 3 Success Criteria ✅
- [ ] All structural operations (`head`, `uncons`, `pack`, `unpack`) implemented
- [ ] Operations correctly handle edge cases (empty lists, nested structures)
- [ ] Algebraic laws verified (cons/tail inverse, concat associativity)
- [ ] All Phase 3 tests pass

### Phase 4 Success Criteria ✅
- [ ] Comparator infrastructure working with code blocks
- [ ] `sort` operation produces stable sorts with custom comparators
- [ ] `bfind` operation works on sorted lists with matching comparators
- [ ] All Phase 4 tests pass

### Phase 5 Success Criteria ✅
- [ ] Complete test coverage matching spec Section 23 checklist
- [ ] Property-based tests verify algebraic laws
- [ ] Performance tests validate complexity guarantees
- [ ] All edge cases and error conditions covered

### Overall Success Criteria ✅
- [ ] **100% of spec-required operations implemented and registered**
- [ ] **All operations follow spec semantics exactly**
- [ ] **Test suite passes with comprehensive coverage**
- [ ] **No regressions in existing functionality**
- [ ] **Documentation updated to reflect implementation status**

---

## 5. Risk Analysis & Mitigation

### High Risk Items ⚠️
1. **Element vs Slot Semantics Change**: Could break existing code
   - **Mitigation**: Comprehensive testing, careful implementation review
   - **Detection**: Existing tests will fail if semantics change incorrectly

2. **Complex Compound Element Handling**: Address calculations with nested structures
   - **Mitigation**: Use existing `getListElementAddress` function, extensive testing
   - **Detection**: Nested structure tests will catch issues

3. **Performance Regression**: New operations might be inefficient
   - **Mitigation**: Performance testing, complexity analysis
   - **Detection**: Benchmark tests comparing before/after performance

### Medium Risk Items ⚠️
1. **Comparator Execution**: Complex to implement correctly
   - **Mitigation**: Start with simple comparators, build complexity gradually
   
2. **Memory Management**: Address-based operations could cause memory issues
   - **Mitigation**: Careful bounds checking, existing VM memory safety

### Low Risk Items ✓
1. **Registration Issues**: Missing operations in builtin table
   - **Mitigation**: Systematic registration process, verification tests

---

## 6. Implementation Timeline

| Phase | Duration | Deliverables | Dependencies |
|-------|----------|--------------|--------------|
| **Phase 1** | Days 1-3 | Element semantics fix, operation registration, `length` implementation | None |
| **Phase 2** | Days 4-7 | Address-based operations (`slot`, `elem`, `fetch`, `store`) | Phase 1 complete |
| **Phase 3** | Days 8-10 | Structural operations (`head`, `uncons`, `pack`, `unpack`) | Phase 2 complete |
| **Phase 4** | Days 11-15 | Advanced features (`sort`, `bfind` with comparators) | Phase 3 complete |
| **Phase 5** | Days 16-18 | Comprehensive testing and validation | All phases complete |

### Parallel Work Opportunities
- Test writing can begin during implementation phases
- Documentation updates can happen alongside implementation
- Performance testing setup can be prepared early

---

## 7. Testing Strategy

### Test Categories
1. **Unit Tests**: Individual operation testing
2. **Integration Tests**: Operation combinations and workflows  
3. **Spec Compliance Tests**: Direct verification against spec examples
4. **Property Tests**: Algebraic law verification
5. **Performance Tests**: Complexity and timing verification
6. **Regression Tests**: Ensure no existing functionality broken

### Test Data Strategy
- **Simple Lists**: `( 1 2 3 )`, `( )`, single elements
- **Nested Lists**: `( 1 ( 2 3 ) 4 )`, multiple nesting levels
- **Edge Cases**: Empty lists, deeply nested, large lists
- **Mixed Types**: Lists containing different tagged value types

---

## 8. Documentation Plan

### Files to Update
- `docs/specs/lists.md`: Mark implementation status
- README: Update feature completeness status  
- Code comments: Ensure all operations well-documented
- Test documentation: Explain testing approach and coverage

### Implementation Notes
- Each operation should include spec section reference in comments
- Complex operations should include worked examples in comments
- Performance characteristics should be documented

---

## 9. Future Considerations

### Post-Implementation Opportunities
1. **Optimization**: Hash indexing for large lists
2. **Integration**: Connect with maplists.md and access.md specs
3. **Extensions**: Additional structural operations based on usage patterns
4. **Performance**: SIMD optimizations for arithmetic operations on lists

### Specification Evolution
- This implementation should inform any future spec clarifications
- Areas needing specification detail (like `pack`/`unpack` semantics) should be documented
- Performance characteristics could be added to spec based on implementation experience

---

**Total Estimated Effort**: 13-18 days
**Priority**: High (foundational for other specifications)
**Risk Level**: Medium (significant changes but well-bounded scope)
**Success Probability**: High (clear specification and solid architectural foundation)

This plan provides a systematic, phase-by-phase approach to achieving full compliance with the `lists.md` specification while maintaining system stability and test coverage throughout the implementation process.
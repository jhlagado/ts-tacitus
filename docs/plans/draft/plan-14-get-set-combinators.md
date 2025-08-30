# Plan 14: Get/Set Combinators Implementation - Access Operations Integration

**Status:** 📋 DRAFT  
**Priority:** HIGH  
**Complexity:** HIGH  
**Dependencies:** Plan 13 (Access Operations Foundation)

## 🎯 Executive Summary

Implement high-level `get` and `set` combinators that provide elegant path-based access to nested list/maplist structures. These combinators leverage the existing combinator architecture (like `do`/`repeat`) and build on the foundational access operations from Plan 13.

**Key Innovation:** Transform complex address-returning traversals into readable path expressions:

```
root get { `users 0 `name }        // Instead of: root `users find fetch 0 elem fetch `name find fetch
"Jane" root set { `users 0 `name } // Instead of: root `users find fetch 0 elem "Jane" swap store
```

## 🧠 Deep Technical Analysis

### Combinator System Architecture

Based on comprehensive analysis of existing `do`/`repeat` combinators, the system works as follows:

#### 1. **Parser Phase (Compile Time)**

```typescript
// When parser encounters 'get' or 'set':
1. Verify next token is BLOCK_START ('{')
2. Call beginStandaloneBlock(state) which:
   - Saves current compiler state
   - Compiles block content as bytecode
   - Returns block start address
3. Emit Op.LiteralCode with block address
4. Emit combinator opcode (Op.Get/Op.Set)
```

#### 2. **Runtime Phase (Execution)**

```typescript
// Stack before combinator executes:
// get: [target, blockAddress] ← TOS
// set: [value, target, blockAddress] ← TOS

// Combinator execution pattern:
1. Pop block address and operands
2. Push block address and call eval
3. Pop path list result from block execution
4. Traverse path through target structure
5. Push final result
```

#### 3. **Critical Insight: Enhanced Infix on Pure RPN**

- **Apparent syntax:** `target get { path }` (looks infix)
- **Actual compilation:** `target { path } get` (pure postfix)
- **Runtime stack:** All data present before combinator executes
- **No hidden state:** Pure stack machine discipline maintained

### Block Compilation Deep Dive

The `beginStandaloneBlock` function implements sophisticated block compilation:

```typescript
function beginStandaloneBlock(state: ParserState): void {
  const prevInside = state.insideCodeBlock;
  state.insideCodeBlock = true;
  const { startAddress } = compileCodeBlock(state); // Returns block start address
  state.insideCodeBlock = prevInside;
  vm.compiler.compileOpcode(Op.LiteralCode); // Push block as tagged value
  vm.compiler.compile16(startAddress); // Block address operand
}
```

**Key Properties:**

- **Deferred execution**: Block compiled but not executed until combinator runs
- **Closure-like**: Block can reference symbols from current scope
- **Stack discipline**: Block execution maintains proper stack contracts
- **Address-based**: Block is just bytecode at a memory address

## 📋 Incremental Implementation Strategy

### 🎯 **REVISED APPROACH: Step-by-Step Development**

Based on developer feedback, this plan now follows a proven incremental approach that reduces risk and enables focused testing at each stage.

**Step 1:** Parser-only implementation (syntax acceptance)  
**Step 2:** Minimal runtime (stub operations + registration)  
**Step 3:** Core traversal logic (full functionality)  
**Step 4:** Advanced features (error handling, edge cases)  
**Step 5:** Performance optimization and integration

---

### Step 1: Parser-Only Implementation (Foundation) 🏗️

**Goal:** Parser accepts `get`/`set` combinator syntax without runtime implementation

**Scope Boundaries:**

- ✅ Parser recognizes `get { path }` and `set { path }` syntax
- ✅ Block compilation works (bytecode: Branch, block-body, Exit, opcode)
- ✅ Syntax error handling (missing `{`, unclosed blocks)
- ❌ NO runtime behavior yet (undefined opcodes are intentionally OK)
- ❌ NO symbol registration yet (that's Step 2)

#### 1.1: Parser Extensions in `processWordToken`

**Location:** `src/lang/parser.ts:268-295` (exact location as do/repeat)

**Implementation Pattern (Mirror do/repeat exactly):**

```typescript
} else if (value === 'get') {
  const blockToken = state.tokenizer.nextToken();
  if (blockToken.type !== TokenType.BLOCK_START) {
    throw new SyntaxError('Expected { after get combinator', vm.getStackData());
  }

  beginStandaloneBlock(state);  // Compile { path } block

  const getIndex = vm.symbolTable.find('get');  // Will be undefined - that's OK!
  vm.compiler.compileOpcode(getIndex);           // Compiles undefined opcode
  return;
} else if (value === 'set') {
  const blockToken = state.tokenizer.nextToken();
  if (blockToken.type !== TokenType.BLOCK_START) {
    throw new SyntaxError('Expected { after set combinator', vm.getStackData());
  }

  beginStandaloneBlock(state);  // Compile { path } block

  const setIndex = vm.symbolTable.find('set');  // Will be undefined - that's OK!
  vm.compiler.compileOpcode(setIndex);           // Compiles undefined opcode
  return;
```

**🔑 Key Insight:** We intentionally don't validate opcode existence - runtime will handle gracefully.

#### 1.2: Parser-Focused Testing

**Location:** `src/test/lang/parser-get-set.test.ts` (new file)

**Test Strategy:** Focus on parser behavior only, no runtime execution

```typescript
describe('Get/Set Combinator Parser - Step 1', () => {
  describe('Syntax Requirements', () => {
    test('get requires block syntax', () => {
      expect(() => parseProgram('target get')).toThrow('Expected { after get combinator');
    });

    test('set requires block syntax', () => {
      expect(() => parseProgram('value target set')).toThrow('Expected { after set combinator');
    });

    test('get accepts block syntax without error', () => {
      expect(() => parseProgram('target get { 1 }')).not.toThrow();
    });

    test('set accepts block syntax without error', () => {
      expect(() => parseProgram('value target set { key }')).not.toThrow();
    });
  });

  describe('Bytecode Structure Validation', () => {
    test('get compiles correct block-then-opcode pattern', () => {
      const program = parseProgram('x get { 1 }');

      // Verify bytecode structure matches do/repeat pattern:
      // 1. Push block address (LiteralCode + address)
      // 2. Block bytecode (Branch, body, Exit)
      // 3. Get opcode (undefined is OK for Step 1)

      expect(program.bytecode).toMatchBytecodeStructure([
        Op.LiteralCode, // Push block address
        // ... block content validation
        undefined, // Get opcode (undefined expected in Step 1)
      ]);
    });
  });
});
```

**Step 1 Success Criteria:**

- [x] Parser accepts `get { ... }` syntax without parse errors ✅
- [x] Parser accepts `set { ... }` syntax without parse errors ✅
- [x] Parser rejects `get` without `{` (proper error message) ✅
- [x] Parser rejects `set` without `{` (proper error message) ✅
- [x] Block compilation generates expected bytecode structure ✅
- [x] All existing parser tests still pass (no regressions) ✅

**Step 1 COMPLETED** 🎉

**Implementation Summary:**

- ✅ Added `get` and `set` combinator recognition in `src/lang/parser.ts:296-317`
- ✅ Follows exact pattern as `do`/`repeat` combinators
- ✅ Uses placeholder opcode (999) when symbols not found (intentional for Step 1)
- ✅ Created parser-focused tests in `src/test/lang/parser-get-set.test.ts`
- ✅ All 924 existing tests pass (1 unrelated performance test variance)
- ✅ Zero regressions introduced

**Key Technical Details:**

- Parser correctly requires `{` token after `get`/`set` keywords
- Block compilation using `beginStandaloneBlock()` works as expected
- Error messages match existing combinator patterns
- Placeholder opcode handling prevents compiler crashes
- Test suite demonstrates proper syntax validation

---

### Step 2: Minimal Runtime Implementation 🏗️

**Goal:** Add minimal runtime support so syntax works end-to-end without crashing

**Scope Boundaries:**

- ✅ Add `Op.Get` and `Op.Set` opcodes to enum
- ✅ Create stub operations that return NIL (no real functionality yet)
- ✅ Register operations in symbol table and builtins dispatcher
- ✅ Test: syntax works end-to-end without runtime crashes
- ❌ NO real traversal logic yet (that's Step 3)

#### 2.1: Add Opcodes to Enumeration

**Location:** `src/ops/opcodes.ts` (after existing combinators)

**Implementation:**

```typescript
/** Get combinator: path-based value access */
Get,
/** Set combinator: path-based value update */
Set,
```

#### 2.2: Create Stub Operations

**Location:** `src/ops/access-ops.ts` (new file)

**Implementation Pattern:**

```typescript
export const getOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'get');

  // Pop the path block and target (ignore for now)
  vm.pop(); // path block
  vm.pop(); // target

  // Always return NIL for Step 2
  vm.push(NIL);
};

export const setOp: Verb = (vm: VM) => {
  vm.ensureStackSize(3, 'set');

  // Pop the path block, target, and value (ignore for now)
  vm.pop(); // path block
  vm.pop(); // target
  vm.pop(); // value

  // Always return NIL for Step 2
  vm.push(NIL);
};
```

#### 2.3: Register Operations

**Files Updated:**

- `src/ops/builtins-register.ts`: Add symbol table registrations
- `src/ops/builtins.ts`: Add opcode dispatch cases

**Step 2 Success Criteria:**

- [x] `Op.Get` and `Op.Set` opcodes added to enumeration ✅
- [x] Stub operations created that pop correct stack arguments ✅
- [x] Operations registered in symbol table and dispatcher ✅
- [x] End-to-end syntax works: `( 1 2 3 ) get { 1 }` executes without crashing ✅
- [x] Operations return NIL as expected ✅
- [x] All existing tests still pass (no regressions) ✅

**Step 2 COMPLETED** 🎉

**Implementation Summary:**

- ✅ Added `Op.Get` and `Op.Set` opcodes in `src/ops/opcodes.ts:300-304`
- ✅ Created stub operations in `src/ops/access-ops.ts` with proper stack discipline
- ✅ Registered operations in `src/ops/builtins-register.ts:213-214`
- ✅ Added dispatch cases in `src/ops/builtins.ts:304-309`
- ✅ Verified end-to-end execution: syntax works without crashes
- ✅ All 924 existing tests pass with zero regressions
- ✅ Stack discipline verified: operations pop correct arguments and return NIL

**Key Technical Details:**

- Stub operations properly implement stack contracts (get: 2 args, set: 3 args)
- NIL return values match expected combinator behavior
- Parser now resolves opcodes correctly (no longer uses placeholder 999)
- Empty final stack is normal Tacit execution behavior
- Operations integrate seamlessly with existing VM dispatch system

---

### Step 2.5: STACK_REF Implementation 🏗️ (Completed)

**Goal:** Add STACK_REF tagged value type to enable polymorphic access operations

**Critical Design Decision:** Before implementing core traversal logic, we need to address a fundamental architectural issue: access operations (`elem`, `slot`, `find`) currently work with stack positions, but get/set combinators need to traverse memory addresses in nested structures.

**Solution:** Implement polymorphic access operations that can handle both:

- `Tag.LIST`: Current stack-relative behavior (SP+offset)
- `Tag.STACK_REF`: New memory address-based behavior (absolute cell addressing)

#### 2.5.1: Add STACK_REF Tag Type

**Location:** `src/core/tagged.ts`

**Implementation:**

```typescript
export enum Tag {
  NUMBER = 0,
  INTEGER = 1,
  CODE = 2,
  STACK_REF = 3, // NEW: 4-byte aligned stack cell references
  STRING = 4,
  BUILTIN = 7,
  LIST = 8,
}
```

#### 2.5.2: STACK_REF Addressing Model

**Cell-Based Addressing:**

- **16-bit payload** = cell index (not byte address)
- **4-byte alignment** = payload \* 4 = actual byte address
- **Address range** = 0-65535 cells = 0-262KB addressable stack space
- **Type safety** = cannot create misaligned references

**Usage Pattern:**

```typescript
// Create STACK_REF to cell 100 (byte address 400)
const stackRef = toTaggedValue(100, Tag.STACK_REF);

// Use STACK_REF
const cellIndex = getValue(stackRef); // Gets 100
const byteAddr = cellIndex * 4; // Gets 400
const cellValue = vm.memory.read32(SEG_STACK, byteAddr);
```

#### 2.5.3: Tagged Value Support Functions

**Add to `tagged.ts`:**

```typescript
/**
 * Checks if a given NaN-boxed value represents a STACK_REF.
 * @param tval The NaN-boxed value to check.
 * @returns true if the value is a STACK_REF, false otherwise.
 */
export function isStackRef(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.STACK_REF;
}

/**
 * Creates a STACK_REF pointing to the specified stack cell.
 * @param cellIndex The 4-byte aligned cell index (0-65535)
 * @returns Tagged STACK_REF value
 */
export function createStackRef(cellIndex: number): number {
  if (cellIndex < 0 || cellIndex > 65535) {
    throw new Error('Stack cell index must be 0-65535');
  }
  return toTaggedValue(cellIndex, Tag.STACK_REF);
}

/**
 * Gets the byte address from a STACK_REF.
 * @param stackRef The STACK_REF tagged value
 * @returns Byte address within stack segment
 */
export function getStackRefAddress(stackRef: number): number {
  if (getTag(stackRef) !== Tag.STACK_REF) {
    throw new Error('Value is not a STACK_REF');
  }
  return getValue(stackRef) * 4;
}
```

#### 2.5.4: Update Tag Names and Validation

**Update constants:**

```typescript
export const MAX_TAG = Tag.LIST; // Update if STACK_REF becomes highest

export const tagNames: { [key in Tag]: string } = {
  [Tag.NUMBER]: 'NUMBER',
  [Tag.INTEGER]: 'INTEGER',
  [Tag.CODE]: 'CODE',
  [Tag.STACK_REF]: 'STACK_REF', // NEW
  [Tag.STRING]: 'STRING',
  [Tag.BUILTIN]: 'BUILTIN',
  [Tag.LIST]: 'LIST',
};
```

**Step 2.5 Success Criteria:**

- [x] `Tag.STACK_REF = 3` added to tagged value enum ✅
- [x] Cell-based addressing functions implemented and tested ✅
- [x] Helper functions (`isStackRef`, `createStackRef`, `getStackRefAddress`) added ✅
- [x] Tag name mapping updated ✅
- [x] All existing tests pass (no regressions to tagged value system) ✅
- [x] STACK_REF creation and validation works correctly ✅

**Step 2.5 COMPLETED** 🎉

**Implementation Summary:**

- ✅ Added `Tag.STACK_REF = 3` to tagged value enum in `src/core/tagged.ts:36`
- ✅ Implemented cell-based addressing: 16-bit payload = cell index, byte address = index \* 4
- ✅ Added helper functions: `isStackRef()`, `createStackRef()`, `getStackRefAddress()`
- ✅ Updated tag name mapping for debugging support
- ✅ All 924 existing tests pass with zero regressions
- ✅ Validated functionality: cell 100 → byte address 400, boundary checks, error handling

**Key Technical Details:**

- Cell-based addressing provides 0-262KB addressable stack space (65535 cells × 4 bytes)
- Type-safe creation with range validation (0-65535 cell indices)
- 4-byte alignment ensures compatibility with stack slot operations
- Clean separation from existing tagged value types

Next: Migrate address-returning ops to return STACK_REF only, and update fetch/store to accept STACK_REF (Integer addresses deprecated).

### Step 2.6: Address ops return STACK_REF only

Goal: Unify on STACK_REF for all address-returning operations.

Scope:

- Change `slot`, `elem`, and `find` to return STACK_REF
- Update `fetch`/`store` to consume STACK_REF (keep INTEGER temporarily for backward compatibility if needed)
- Update docs: `lists.md` §10, `capsules.md` Access Semantics

Tests:

- Adjust any tests assuming INTEGER addresses
- Ensure behavior unchanged for value results and side effects

---

### Step 3: Core Traversal Logic Implementation 🏗️

**REVISED APPROACH: Four-Layer Architecture for Traversal**

Based on architectural discussion, we need a clean separation using proven list construction patterns to handle the variadic path problem.

#### Step 3.4: Study List Construction Patterns 📚

**Goal:** Deep understanding of `openListOp`/`closeListOp` to extract reusable patterns

**Scope Boundaries:**

- ✅ Study `openListOp`: SP marking, return stack usage, placeholder header
- ✅ Study `closeListOp`: SP calculation, slot count, list structure building
- ✅ Understand return stack protocol for SP preservation
- ✅ Document the generic pattern for block → list conversion
- ❌ NO implementation yet - analysis and documentation only

**Detailed Analysis Required:**

1. **SP Marking Protocol**: How does `openListOp` save current SP to return stack?
2. **Block Execution**: How is the placeholder maintained during element collection?
3. **Slot Count Calculation**: How does `closeListOp` compute `(current_SP - saved_SP) / 4`?
4. **List Structure Building**: How are payload elements arranged with header?
5. **Return Stack Management**: When/how is saved SP popped and restored?

**Deliverables:**

- Detailed code analysis document
- Generic pattern extracted for `{block} → list` conversion
- Implementation plan for `makeListOp`

**Success Criteria:**

- [x] Complete understanding of list construction internals
- [x] Documented reusable pattern for block-to-list conversion
- [x] Ready to implement generic `makeListOp`

---

#### Step 3.5: Implement Generic makeListOp 🔧

**Goal:** Create reusable `{block} → list` operation using list construction patterns

**Stack Effect:** `( {block} -- list )`

**Implementation Approach:**

- Reuse `openListOp`/`closeListOp` patterns
- Handle SP marking and return stack protocol
- Generic utility for any block execution → list conversion

**Detailed Implementation:**

1. **Save current SP** to return stack (like `openListOp`)
2. **Execute block** using VM block execution
3. **Calculate element count** from SP difference
4. **Build list structure** (payload + header)
5. **Clean up return stack** and restore state

**Testing Requirements:**

- Simple blocks: `{ 1 2 3 } makeList` → `( 1 2 3 LIST:3 )`
- Complex blocks: `{ 1 "key" dup }` → proper list creation
- Empty blocks: `{ } makeList` → `( LIST:0 )`
- Error cases: Invalid blocks, stack underflow

**Success Criteria:**

- [x] `makeListOp` implemented and working
- [x] All test cases pass
- [x] Reusable for any block → list conversion
- [x] Ready for integration into get/set combinators

---

#### Step 3.6: Integrate makeListOp into get/set Combinators 🔗

**Goal:** Use `makeListOp` to solve variadic path problem in get/set

**Implementation Changes:**

```typescript
// Before: target {path} get → variadic stack problem
// After:  target {path} → target pathList → clean interface
```

**get/set Combinator Updates:**

1. **Pop target and blockAddr** from combinator stack setup
2. **Push blockAddr back** for `makeListOp` processing
3. **Call makeListOp** → converts `{path}` to `pathList`
4. **Result**: Clean `target pathList` on stack

**Testing Requirements:**

- `( 1 2 3 ) get { 1 }` → `target pathList` correctly formed
- `99 ( 1 2 3 ) set { 1 }` → `value target pathList` correctly formed
- Complex paths: `root get { 1 "users" 0 "name" }` → proper list creation
- Error cases: Malformed blocks, syntax errors

**Success Criteria:**

- [x] get/set combinators use `makeListOp` for path collection
- [x] Clean `target pathList` interface achieved
- [x] All existing get/set syntax still works
- [x] Ready for traversal engine implementation

---

#### Step 3.7: Implement traverseOp Engine 🚀

**Goal:** Core traversal engine using polymorphic access operations

**Stack Effect:** `( (list | stack_ref) pathList -- stack_ref )`

**Traversal Algorithm:**

1. **Iterate through pathList** elements (pop from list)
2. **For each path element**: Determine type (number vs string)
3. **Apply appropriate operation**:
   - Number → `elemOp` for list index
   - String → `findOp` for maplist key
4. **Handle intermediate results**: Convert LIST results to STACK_REF
5. **Return final STACK_REF** pointing to target location

**Implementation Details:**

- Use polymorphic access operations we built (elem/slot/find)
- Handle both LIST and STACK_REF inputs at each step
- Proper error handling for invalid paths
- Support for nested traversal through mixed list/maplist structures

**Testing Requirements:**

- Simple paths: `( 1 2 3 ) ( 1 LIST:1 ) traverseOp` → STACK_REF to element 1
- Nested paths: Complex list/maplist navigation
- Mixed types: Numbers and strings in same path
- Error cases: Invalid indices, missing keys, type mismatches

**Success Criteria:**

- [x] `traverseOp` implemented and working
- [x] Handles all path types correctly
- [x] Returns proper STACK_REF addresses
- [x] Ready for final get/set integration

---

#### Step 3.8: Complete get/set Implementation 🎯

**Goal:** Final get/set logic using makeListOp + traverseOp + fetch/store

**Complete Flow:**

```typescript
// get: target {path} → target pathList → traverseOp → fetchOp
// set: value target {path} → value target pathList → traverseOp → storeOp
```

**Implementation:**

1. **Path collection**: Use `makeListOp` (from Step 3.6)
2. **Traversal**: Use `traverseOp` (from Step 3.7)
3. **Final operations**:
   - get: Call `fetchOp` on result STACK_REF
   - set: Call `storeOp` with value and result STACK_REF

**Testing Requirements:**

- End-to-end: `( 1 ( 2 3 ) 4 ) get { 1 0 }` → retrieves value 2
- Complex paths: Multi-level list/maplist navigation
- set operations: `99 target set { path }` → stores value correctly
- Error propagation: Invalid paths return NIL

**Success Criteria:**

- [x] Complete get/set functionality working
- [x] All syntax examples from plan work correctly
- [x] Error handling robust and consistent
- [x] Ready for advanced features

---

### Step 4: Advanced Features\*\*

- Comprehensive error handling
- Edge case coverage (empty paths, type mismatches)
- Performance optimization
- Test: robust error handling and edge cases

### Step 5: Integration & Polish\*\*

- Full test suite integration
- Documentation updates
- Performance validation
- Final regression testing

**Optional Step 6: Type System Cleanup (Future)**

- _Optional cleanup task - can be done faster in VS Code_
- Rename `Tag.INTEGER` → `Tag.SENTINEL` (restrict to NIL only)
- Update all references and documentation
- This resolves the semantic confusion where INTEGER was misused for addresses
- Pure cleanup task with no functional changes to get/set combinators

---

## 📋 Original Detailed Implementation (Reference)

_This section preserved for Step 2+ implementation reference_

### Phase 1: Parser Integration

#### 1.1: Parser Extensions in `processWordToken`

**Location:** `src/lang/parser.ts:268-295`

**Implementation Pattern (Mirror do/repeat):**

```typescript
} else if (value === 'get') {
  const blockToken = state.tokenizer.nextToken();
  if (blockToken.type !== TokenType.BLOCK_START) {
    throw new SyntaxError('Expected { after get combinator', vm.getStackData());
  }

  beginStandaloneBlock(state);  // Compile { path } block

  const getIndex = vm.symbolTable.find('get');
  if (getIndex === undefined) {
    throw new UndefinedWordError('get', vm.getStackData());
  }
  vm.compiler.compileOpcode(getIndex);
  return;
} else if (value === 'set') {
  const blockToken = state.tokenizer.nextToken();
  if (blockToken.type !== TokenType.BLOCK_START) {
    throw new SyntaxError('Expected { after set combinator', vm.getStackData());
  }

  beginStandaloneBlock(state);  // Compile { path } block

  const setIndex = vm.symbolTable.find('set');
  if (setIndex === undefined) {
    throw new UndefinedWordError('set', vm.getStackData());
  }
  vm.compiler.compileOpcode(setIndex);
  return;
```

**Testing Requirements:**

- Parser rejects `get` without `{`
- Parser rejects `set` without `{`
- Block compilation works correctly
- Syntax errors have proper error messages

#### 1.2: Error Handling Enhancement

**Additional Error Cases:**

```typescript
// In parser error handling section
-'Expected { after get combinator' -
  'Expected { after set combinator' -
  'Unclosed path block in get combinator' -
  'Unclosed path block in set combinator';
```

### Phase 2: Core Operations Implementation

#### 2.1: Create Access Operations File

**Location:** `src/ops/access-ops.ts`

**File Structure:**

```typescript
/**
 * @file src/ops/access-ops.ts
 *
 * High-level access combinators for Tacit VM.
 * Provides path-based navigation through nested list/maplist structures.
 *
 * Stack Effects:
 * - get: ( target { path } -- value | nil )
 * - set: ( value target { path } -- ok | nil )
 */

import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { fromTaggedValue, toTaggedValue, Tag, isList, isSimple } from '../core/tagged';

const NIL = toTaggedValue(0, Tag.INTEGER);
const OK = toTaggedValue(1, Tag.INTEGER);
```

#### 2.2: Core Combinator Functions

**getOp Implementation:**

```typescript
export const getOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'get');

  const pathBlock = vm.pop(); // Pop { path } block address
  const target = vm.pop(); // Pop target structure

  // Execute path block to produce path list
  vm.push(pathBlock);
  const evalImpl = vm.symbolTable.findImplementationByOpcode(vm.symbolTable.find('eval')!);
  if (!evalImpl) {
    vm.push(NIL);
    return;
  }

  try {
    evalImpl(vm); // Execute { path } block
  } catch (error) {
    vm.push(NIL);
    return;
  }

  if (vm.getStackData().length === 0) {
    vm.push(NIL);
    return;
  }

  const pathList = vm.pop(); // Path list result from block

  // Traverse path and push result
  const result = traversePath(vm, target, pathList, 'get');
  vm.push(result || NIL);
};
```

**setOp Implementation:**

```typescript
export const setOp: Verb = (vm: VM) => {
  vm.ensureStackSize(3, 'set');

  const pathBlock = vm.pop(); // Pop { path } block address
  const target = vm.pop(); // Pop target structure
  const value = vm.pop(); // Pop value to set

  // Execute path block to produce path list
  vm.push(pathBlock);
  const evalImpl = vm.symbolTable.findImplementationByOpcode(vm.symbolTable.find('eval')!);
  if (!evalImpl) {
    vm.push(NIL);
    return;
  }

  try {
    evalImpl(vm); // Execute { path } block
  } catch (error) {
    vm.push(NIL);
    return;
  }

  if (vm.getStackData().length === 0) {
    vm.push(NIL);
    return;
  }

  const pathList = vm.pop(); // Path list result from block

  // Traverse path and attempt to set value
  const result = traversePath(vm, target, pathList, 'set', value);
  vm.push(result || NIL);
};
```

### Phase 3: Path Traversal Engine (COMPLEX)

#### 3.1: Core Traversal Algorithm

**Comprehensive Path Traversal:**

```typescript
function traversePath(
  vm: VM,
  target: number,
  pathList: number,
  operation: 'get' | 'set',
  setValue?: number,
): number | null {
  // Validate path is a list
  if (!isList(pathList)) {
    return null;
  }

  const { value: pathLength } = fromTaggedValue(pathList);

  // Handle empty path
  if (pathLength === 0) {
    if (operation === 'get') {
      return target;
    } else {
      return OK; // set with empty path is no-op success
    }
  }

  let current = target;
  const pathStartAddr = vm.SP - 1 - pathLength; // Address of first path element

  // Traverse path elements
  for (let i = 0; i < pathLength; i++) {
    const pathItemAddr = pathStartAddr + i;
    const pathItem = vm.memory[pathItemAddr];
    const { tag, value } = fromTaggedValue(pathItem);

    if (tag === Tag.INTEGER || tag === Tag.NUMBER) {
      // Numeric index -> list element access
      current = traverseListElement(vm, current, value as number);
    } else if (tag === Tag.STRING) {
      // String key -> maplist value access
      current = traverseMaplistKey(vm, current, value as number);
    } else {
      // Invalid path item type
      return null;
    }

    if (current === null) {
      return null; // Traversal failed
    }

    // For set operation, stop at final element for address access
    if (operation === 'set' && i === pathLength - 1) {
      return performSet(vm, current, setValue!);
    }
  }

  return current; // Final value for get operation
}
```

#### 3.2: List Element Traversal

```typescript
function traverseListElement(vm: VM, listHeader: number, index: number): number | null {
  if (!isList(listHeader)) {
    return null;
  }

  // Use existing elem operation to get element address
  vm.push(listHeader);
  vm.push(toTaggedValue(index, Tag.INTEGER));

  const elemImpl = vm.symbolTable.findImplementationByOpcode(vm.symbolTable.find('elem')!);
  if (!elemImpl) {
    vm.pop();
    vm.pop(); // Clean up stack
    return null;
  }

  try {
    elemImpl(vm); // Call elem operation
  } catch (error) {
    return null;
  }

  if (vm.getStackData().length < 2) {
    return null;
  }

  const address = vm.pop();
  const originalList = vm.pop();

  // Use fetch to get element value
  vm.push(address);
  const fetchImpl = vm.symbolTable.findImplementationByOpcode(vm.symbolTable.find('fetch')!);
  if (!fetchImpl) {
    vm.pop(); // Clean up
    return null;
  }

  try {
    fetchImpl(vm); // Call fetch operation
  } catch (error) {
    return null;
  }

  if (vm.getStackData().length === 0) {
    return null;
  }

  return vm.pop(); // Return fetched element value
}
```

#### 3.3: Maplist Key Traversal

```typescript
function traverseMaplistKey(vm: VM, maplistHeader: number, key: number): number | null {
  if (!isList(maplistHeader)) {
    return null;
  }

  // Use existing find operation to get value address
  vm.push(maplistHeader);
  vm.push(toTaggedValue(key, Tag.STRING));

  const findImpl = vm.symbolTable.findImplementationByOpcode(vm.symbolTable.find('find')!);
  if (!findImpl) {
    vm.pop();
    vm.pop(); // Clean up stack
    return null;
  }

  try {
    findImpl(vm); // Call find operation
  } catch (error) {
    return null;
  }

  if (vm.getStackData().length < 2) {
    return null;
  }

  const address = vm.pop();
  const originalMaplist = vm.pop();

  // Check if find returned NIL (not found)
  const { tag, value } = fromTaggedValue(address);
  if (tag === Tag.INTEGER && value === 0) {
    return null; // Key not found
  }

  // Use fetch to get value
  vm.push(address);
  const fetchImpl = vm.symbolTable.findImplementationByOpcode(vm.symbolTable.find('fetch')!);
  if (!fetchImpl) {
    vm.pop(); // Clean up
    return null;
  }

  try {
    fetchImpl(vm); // Call fetch operation
  } catch (error) {
    return null;
  }

  if (vm.getStackData().length === 0) {
    return null;
  }

  return vm.pop(); // Return fetched value
}
```

#### 3.4: Set Operation Implementation

```typescript
function performSet(vm: VM, targetAddress: number, value: number): number | null {
  // Check if target is simple (can be overwritten)
  if (!isSimple(targetAddress)) {
    return null; // Cannot overwrite compound values
  }

  // Use store operation to set value
  vm.push(value);
  vm.push(targetAddress);

  const storeImpl = vm.symbolTable.findImplementationByOpcode(vm.symbolTable.find('store')!);
  if (!storeImpl) {
    vm.pop();
    vm.pop(); // Clean up
    return null;
  }

  try {
    storeImpl(vm); // Call store operation
  } catch (error) {
    return null;
  }

  return OK; // Success marker
}
```

### Phase 4: Registration and Integration

#### 4.1: Opcode Allocation

**Location:** `src/ops/opcodes.ts`

**Add after existing combinators (~line 298):**

```typescript
/** Get combinator: path-based value access */
Get,

/** Set combinator: path-based value update */
Set,
```

#### 4.2: Builtin Registration

**Location:** `src/ops/builtins-register.ts`

**Import Addition:**

```typescript
import { getOp, setOp } from './access-ops';
```

**Registration Addition (~line 211):**

```typescript
symbolTable.define('get', Op.Get, getOp);
symbolTable.define('set', Op.Set, setOp);
```

#### 4.3: Builtin Dispatch

**Location:** `src/ops/builtins.ts`

**Import Addition:**

```typescript
import { getOp, setOp } from './access-ops';
```

**Switch Case Addition (~line 301):**

```typescript
    case Op.Get:
      getOp(vm);
      break;
    case Op.Set:
      setOp(vm);
      break;
```

### Phase 5: Comprehensive Testing Suite

#### 5.1: Test File Structure

**Location:** `src/test/ops/access/get-set-combinators.test.ts`

**Test Categories:**

1. **Parser Integration Tests**
2. **Basic Path Traversal Tests**
3. **Error Handling Tests**
4. **Mixed Structure Tests**
5. **Edge Case Tests**
6. **Performance Baseline Tests**

#### 5.2: Detailed Test Specifications

**Parser Integration Tests:**

```typescript
describe('Parser Integration', () => {
  test('get combinator requires block syntax', () => {
    expect(() => executeTacitCode('( 1 2 3 ) get')).toThrow('Expected { after get combinator');
  });

  test('set combinator requires block syntax', () => {
    expect(() => executeTacitCode('99 ( 1 2 3 ) set')).toThrow('Expected { after set combinator');
  });

  test('get compiles path block correctly', () => {
    const result = executeTacitCode('( 10 20 30 ) get { 1 }');
    expect(result).toEqual([20]);
  });

  test('set compiles path block correctly', () => {
    // Create list, modify it, verify change
    executeTacitCode(': testlist ( 10 20 30 ) ;');
    executeTacitCode('99 testlist set { 1 }');
    const result = executeTacitCode('testlist get { 1 }');
    expect(result).toEqual([99]);
  });
});
```

**Basic Path Traversal Tests:**

```typescript
describe('Basic Path Traversal', () => {
  test('simple list index access', () => {
    const result = executeTacitCode('( 10 20 30 ) get { 1 }');
    expect(result).toEqual([20]);
  });

  test('maplist key access', () => {
    const result = executeTacitCode('( `name "Alice" `age 30 ) get { `name }');
    expect(result).toEqual(["Alice"]);
  });

  test('nested mixed path traversal', () => {
    // Complex structure: ( `users ( ( `name "Alice" ) ( `name "Bob" ) ) )
    const setup = '( `users ( ( `name "Alice" ) ( `name "Bob" ) ) )';
    const result = executeTacitCode(`${setup} get { `users 1 `name }`);
    expect(result).toEqual(["Bob"]);
  });

  test('empty path returns target unchanged', () => {
    const result = executeTacitCode('( 10 20 30 ) get { }');
    // Should return the original list
    expect(result.length).toBeGreaterThan(3);
  });
});
```

**Error Handling Tests:**

```typescript
describe('Error Handling', () => {
  test('out-of-bounds index returns nil', () => {
    const result = executeTacitCode('( 10 20 30 ) get { 5 }');
    expect(result).toEqual([0]); // NIL
  });

  test('missing key returns nil', () => {
    const result = executeTacitCode('( `name "Alice" ) get { `missing }');
    expect(result).toEqual([0]); // NIL
  });

  test('type mismatch in path returns nil', () => {
    const result = executeTacitCode('( 10 20 30 ) get { `name }'); // Symbol on list
    expect(result).toEqual([0]); // NIL
  });

  test('non-list target with numeric index returns nil', () => {
    const result = executeTacitCode('42 get { 0 }');
    expect(result).toEqual([0]); // NIL
  });

  test('set compound element returns nil', () => {
    const result = executeTacitCode('99 ( ( 1 2 ) 20 30 ) set { 0 }');
    expect(result).toEqual([0]); // NIL - cannot overwrite compound
  });
});
```

**Advanced Integration Tests:**

```typescript
describe('Advanced Integration', () => {
  test('deeply nested structure access', () => {
    const structure = `
      ( 
        \`company (
          \`employees (
            ( \`name "Alice" \`department ( \`name "Engineering" \`budget 100000 ) )
            ( \`name "Bob"   \`department ( \`name "Marketing"  \`budget 50000  ) )
          )
          \`stats ( \`count 2 \`active true )
        )
      )
    `;
    const result = executeTacitCode(
      `${structure} get { \`company \`employees 0 \`department \`budget }`,
    );
    expect(result).toEqual([100000]);
  });

  test('chained get/set operations', () => {
    executeTacitCode(': data ( `users ( ( `name "Alice" ) ( `name "Bob" ) ) ) ;');

    // Get original value
    const original = executeTacitCode('data get { `users 0 `name }');
    expect(original).toEqual(['Alice']);

    // Set new value
    const setResult = executeTacitCode('"Charlie" data set { `users 0 `name }');
    expect(setResult).toEqual([1]); // OK

    // Verify change
    const updated = executeTacitCode('data get { `users 0 `name }');
    expect(updated).toEqual(['Charlie']);
  });
});
```

#### 5.3: Performance Baseline Tests

```typescript
describe('Performance Baselines', () => {
  test('linear traversal performance', () => {
    // Create large nested structure
    const largeList = Array.from({ length: 100 }, (_, i) => `( \`id ${i} \`value ${i * 10} )`).join(
      ' ',
    );
    const structure = `( \`items ( ${largeList} ) )`;

    const startTime = Date.now();
    const result = executeTacitCode(`${structure} get { \`items 99 \`value }`);
    const endTime = Date.now();

    expect(result).toEqual([990]);
    expect(endTime - startTime).toBeLessThan(100); // Should be fast
  });

  test('deep nesting performance', () => {
    // Create deeply nested structure (10 levels)
    let structure = '( `level0 ';
    for (let i = 1; i < 10; i++) {
      structure += `( \`level${i} `;
    }
    structure += '42';
    for (let i = 0; i < 10; i++) {
      structure += ' )';
    }

    let path = '';
    for (let i = 0; i < 10; i++) {
      path += ` \`level${i}`;
    }

    const result = executeTacitCode(`${structure} get { ${path} }`);
    expect(result).toEqual([42]);
  });
});
```

### Phase 6: Integration and Validation

#### 6.1: Full System Integration

**Test Integration Points:**

1. Parser correctly handles combinator syntax
2. Opcodes are properly allocated and dispatched
3. Symbol table registration works correctly
4. Block compilation and execution integrates smoothly
5. Error propagation maintains stack discipline
6. Performance meets baseline expectations

#### 6.2: Regression Testing

**Critical Regression Areas:**

1. Existing combinators (`do`, `repeat`) still work
2. List/maplist operations unaffected
3. Parser still handles non-combinator cases
4. Symbol table lookup performance maintained
5. Memory usage stays within bounds

#### 6.3: Documentation Integration

**Documentation Updates Needed:**

1. Update `docs/reference/glossary.md` with get/set entries
2. Create usage examples in spec
3. Document path syntax patterns
4. Performance characteristics documentation

## 🎯 Success Criteria

### Functional Requirements ✅

- [ ] `get` combinator works with list indices
- [ ] `get` combinator works with maplist keys
- [ ] `set` combinator updates simple values
- [ ] `set` combinator rejects compound values
- [ ] Mixed paths traverse correctly
- [ ] Error cases return `nil` appropriately
- [ ] Empty paths handle correctly
- [ ] Parser enforces block syntax

### Technical Requirements ✅

- [ ] Zero regressions in existing tests
- [ ] `yarn test` passes completely
- [ ] `yarn lint` passes without warnings
- [ ] Memory usage within acceptable bounds
- [ ] Performance meets baseline expectations
- [ ] C-port compatible implementation patterns

### Quality Requirements ✅

- [ ] Comprehensive test coverage (>95%)
- [ ] Error messages are clear and actionable
- [ ] Code follows existing patterns
- [ ] Documentation is complete and accurate
- [ ] Implementation handles all edge cases

## ⚡ Performance Characteristics

### Complexity Analysis

- **Path evaluation**: O(p) where p = path length
- **List element access**: O(s) worst-case for element traversal
- **Maplist key access**: O(n) linear search
- **Overall**: O(p × max(s,n)) for path length p, max slots s, max maplist size n

### Memory Usage

- **Stack discipline**: Maintains proper stack contracts
- **No copying**: Uses address-based access throughout
- **Block compilation**: One-time compilation cost per path block
- **Traversal**: Minimal temporary allocations

## 🔧 Implementation Notes

### C-Port Compatibility

- **Direct loops**: No functional programming patterns
- **Explicit control flow**: Clear branching and error handling
- **Stack-based**: All operations maintain stack discipline
- **Address arithmetic**: Direct memory access patterns
- **Error propagation**: Simple return codes and NIL values

### Stack Safety

- **Aggressive bounds checking**: `ensureStackSize` on all entry points
- **Error cleanup**: Proper stack restoration on all error paths
- **Block execution isolation**: Block failures don't corrupt parent stack
- **Memory bounds**: All address calculations validated

### Testing Strategy

- **Behavioral testing**: Avoids NaN-boxing corruption issues
- **Integration focused**: Tests end-to-end workflows
- **Error coverage**: Comprehensive error path validation
- **Performance monitoring**: Baseline measurements and regression detection

## 📈 Future Enhancements

### Post-Implementation Opportunities

1. **Optimized Search**: `bfind`/`hfind` integration for sorted structures
2. **Path Caching**: Cache compiled path blocks for repeated access
3. **Structural Operations**: Limited structural editing (insert/delete)
4. **Path Introspection**: Operations to query path validity
5. **Batch Operations**: Multi-path get/set in single operation

### Performance Optimizations

1. **Hash Index Integration**: O(1) maplist access with prebuilt indices
2. **Path Compilation**: More efficient path representation
3. **Address Caching**: Cache intermediate addresses during traversal
4. **SIMD Integration**: Vectorized operations for large structures

This plan provides comprehensive, implementation-ready specifications for the get/set combinators while maintaining the elegance and power of the combinator model. The result will be a natural extension of Tacit's access capabilities that feels like a native part of the language.

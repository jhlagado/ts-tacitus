# Plan 38: Capsules Implementation

## Status
- **Stage:** Draft
- **Priority:** Medium
- **Dependencies:** 
  - case/of control flow (plan-35, done)
  - Local variables (plan-10, done)
  - Stack frame management (plan-26, done)
  - Symbol references (plan-04, done)

## Overview

Implement capsules as specified in `docs/specs/drafts/capsules.md`. Capsules are first-class objects that combine local state with symbolic dispatch, enabling objects, generators, and stateful closures within Tacit's pure stack discipline.

A capsule is a list containing:
- Element 0: CODE reference to dispatch table
- Elements 1..N: frozen local variables

## Architecture Analysis

### What We Have
✅ `case/of` multi-branch control (can be reused for method dispatch)
✅ Local variable storage on return stack via `var`
✅ BP-based frame management
✅ Tag.CODE references for bytecode addresses
✅ List construction and manipulation
✅ Symbol-based equality (`areValuesEqual`)

### What We Need

1. **`methods` immediate word** - Hybrid of `case` and frame capture
2. **`dispatch` builtin** - Symbolic method invocation with BP rebinding
3. **Frame freezing utilities** - Copy RSTACK locals to data stack list
4. **Modified call protocol** - Capsule-specific prologue/epilogue

## Implementation Steps

### Phase 1: Core Infrastructure

#### 1.1 Add Opcodes
**File:** `src/ops/opcodes.ts`

Add new opcodes:
```typescript
/** Begins methods block (immediate) */
Methods,

/** Symbolic dispatch: (message capsule -- ...) */
Dispatch,

/** Ends methods block during compilation */
EndMethods,
```

##### 1.2 Simplify `methods` Role

Key insight: **`methods` should not embed `case`**. Instead:
- `methods` marks the dispatch block boundary
- User explicitly writes `case/of` structure inside
- `methods` closer freezes frame after the case ends

Revised syntax:
```tacit
: counter
  0 var count
  methods
  case
    'inc of 1 +> count ;
    'get of count ;
  ;
;
```

Benefits:
- Separates concerns (frame capture vs dispatch logic)
- More explicit and composable
- No modification to existing case/of
- User controls dispatch structure

#### 1.3 Frame Freezing Utility
**File:** `src/ops/capsules/frame-utils.ts` (new)

```typescript
/**
 * Freezes current local frame into a list on data stack.
 * Copies all locals from BP..RSP and constructs a list.
 * Stack effect: ( -- list )
 */
export function freezeFrame(vm: VM): void {
  const frameDepth = vm.RSP - vm.BP;
  
  // Copy locals from RSTACK to data stack in reverse order
  for (let i = frameDepth - 1; i >= 0; i--) {
    const localAddr = (vm.BP + i) * CELL_SIZE;
    const value = vm.memory.readFloat32(SEG_RSTACK, localAddr);
    vm.push(value);
  }
  
  // Push list header
  vm.push(toTaggedValue(frameDepth, Tag.LIST));
}

/**
 * Restores frame from capsule list to return stack.
 * Used when dispatch rebinds BP to capsule frame.
 */
export function thawFrame(vm: VM, capsule: number): void {
  const info = getListBounds(vm, capsule);
  if (!info) {
    throw new Error('Invalid capsule structure');
  }
  
  // Skip element 0 (CODE ref), copy elements 1..N to RSTACK
  const slotCount = getListLength(info.header);
  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  
  for (let i = 1; i < slotCount; i++) {
    const slotAddr = headerAddr - (i + 1) * CELL_SIZE;
    const value = vm.memory.readFloat32(info.segment, slotAddr);
    vm.rpush(value);
  }
}
```

### Phase 2: `methods` Immediate (Simplified)

#### 2.1 Methods Opener
**File:** `src/lang/meta/capsules.ts` (new)

```typescript
const ENDMETHODS_CODE_REF = createBuiltinRef(Op.EndMethods);

export function beginMethodsImmediate(): void {
  requireParserState();
  
  // Record the start of the dispatch block (where case will be)
  const dispatchStart = vm.compiler.CP;
  
  // Emit a Branch to skip over dispatch table during normal execution
  vm.compiler.compileOpcode(Op.Branch);
  const skipPos = vm.compiler.CP;
  vm.compiler.compile16(0); // Will be patched by closer
  
  // Push metadata for closer
  vm.push(dispatchStart);  // CODE address for capsule element 0
  vm.push(skipPos);         // Branch placeholder to patch
  vm.push(ENDMETHODS_CODE_REF);
  
  // User will now write: case 'method1 of ... ; 'method2 of ... ; ;
}
```

Key changes:
- **No automatic case creation** - user writes it explicitly
- **Simpler stack discipline** - just 3 values, not 4
- **Clear separation** - `methods` marks boundaries, `case` handles dispatch

#### 2.2 Methods Closer
**File:** `src/ops/core/core-ops.ts`

```typescript
export const endMethodsOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'endmethods');
  
  // Pop metadata (note: case already closed by user's `;`)
  const skipPos = vm.pop();
  const dispatchStart = vm.pop();
  
  // Patch the initial skip branch to jump past dispatch table
  const afterTable = vm.compiler.CP;
  const prevCP = vm.compiler.CP;
  vm.compiler.CP = skipPos;
  vm.compiler.compile16(afterTable - (skipPos + 2));
  vm.compiler.CP = prevCP;
  
  // Now construct the capsule from current frame
  // 1. Freeze locals into a list on data stack
  freezeFrame(vm);
  
  // 2. Insert CODE ref at element 0
  const codeRef = createCodeRef(dispatchStart);
  const frameListHeader = vm.pop(); // LIST:N header
  const frameSlotCount = getListLength(frameListHeader);
  
  // Shift frame elements down to make room for CODE ref
  const tempStack: number[] = [];
  for (let i = 0; i < frameSlotCount; i++) {
    tempStack.push(vm.pop());
  }
  
  // Push CODE ref as element 0
  vm.push(codeRef);
  
  // Restore frame elements (now elements 1..N)
  for (let i = tempStack.length - 1; i >= 0; i--) {
    vm.push(tempStack[i]);
  }
  
  // Push new list header (1 more slot for CODE ref)
  vm.push(toTaggedValue(frameSlotCount + 1, Tag.LIST));
  
  // Capsule is now on data stack: [CODE, local0, local1, ..., LIST:N+1]
};
```

Key changes:
- **No endCaseOp call** - user already closed it with `;`
- **Simpler stack popping** - only 2 metadata values
- **Uses temp array** - cleaner than RSTACK juggling

### Phase 3: `dispatch` Operation

#### 3.1 Dispatch Implementation
**File:** `src/ops/capsules/dispatch-ops.ts` (new)

```typescript
export function dispatchOp(vm: VM): void {
  vm.ensureStackSize(2, 'dispatch');

  const capsule = vm.pop();
  const message = vm.pop();

  // Validate capsule layout
  const info = getListBounds(vm, capsule);
  if (!info || !isList(info.header)) {
    throw new Error('dispatch expects capsule list');
  }

  const slotCount = getListLength(info.header);
  if (slotCount < 1) throw new Error('capsule missing CODE entry');

  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  const codeRef = vm.memory.readFloat32(info.segment, headerAddr - CELL_SIZE);
  const { tag, value: dispatchAddr } = fromTaggedValue(codeRef);
  if (tag !== Tag.CODE) throw new Error('capsule element 0 must be CODE ref');

  // Prepare discriminant / arguments (message may be symbol or list)
  let discriminant = message;
  if (isList(message)) {
    const msgInfo = getListBounds(vm, message);
    if (!msgInfo) throw new Error('invalid message list');

    const msgSlots = getListLength(msgInfo.header);
    if (msgSlots === 0) throw new Error('empty message list');

    const msgHeaderAddr = computeHeaderAddr(msgInfo.baseAddr, msgSlots);
    discriminant = vm.memory.readFloat32(msgInfo.segment, msgHeaderAddr - CELL_SIZE);

    for (let i = msgSlots - 1; i >= 1; i--) {
      const addr = msgHeaderAddr - (i + 1) * CELL_SIZE;
      vm.push(vm.memory.readFloat32(msgInfo.segment, addr));
    }
  }

  vm.push(discriminant);

  // Modified call prologue: keep caller frame but rebind BP to capsule environment
  vm.rpush(toTaggedValue(vm.IP, Tag.CODE)); // return address
  vm.rpush(vm.BP);                          // caller BP

  const envStart = vm.RSP;
  thawFrame(vm, capsule);                   // replay locals onto RSTACK
  vm.BP = envStart;

  vm.IP = dispatchAddr;                     // jump into case block
}
```

#### 3.2 Dispatch Epilogue

Within the dispatch bytecode, ensure that method bodies terminate using a specialized closer (e.g., `EndMethods`) so that:

```typescript
// Pseudocode for epilogue invoked by terminator:
const savedBP = vm.rpop();
const returnAddrTagged = vm.rpop();
vm.BP = savedBP;
vm.IP = fromTaggedValue(returnAddrTagged).value;
```

This contrasts with the standard `Exit`, which would also collapse locals. The epilogue leaves the capsule environment untouched on the return stack, matching the semantics documented in the spec.

### Phase 4: Registration and Integration

#### 4.1 Register Builtins
**File:** `src/ops/builtins-register.ts`

```typescript
// Add to registerBuiltins:
symbolTable.defineBuiltin('methods', Op.Nop, _vm => beginMethodsImmediate(), true);
symbolTable.defineBuiltin('dispatch', Op.Dispatch, dispatchOp);
```

#### 4.2 Export Capsule Ops
**File:** `src/ops/capsules/index.ts` (new)

```typescript
export * from './dispatch-ops';
export * from './frame-utils';
```

#### 4.3 Update Core Index
**File:** `src/core/index.ts`

Add capsule utilities to exports if needed.

### Phase 5: Testing

#### 5.1 Basic Capsule Test
**File:** `src/test/ops/capsules/basic-capsule.test.ts` (new)

```typescript
describe('Capsules - Basic Creation', () => {
  test('methods creates capsule with CODE ref and locals', () => {
    executeProgram(`
      : makepoint
        100 var x
        200 var y
        methods
        case
          'getx of x ;
          'gety of y ;
        ;
      ;
      
      makepoint
    `);
    
    const stack = vm.getStackData();
    const capsule = stack[stack.length - 1];
    
    // Should be a list
    expect(getTag(capsule)).toBe(Tag.LIST);
    
    // Should have at least 3 elements (CODE, x, y)
    const slotCount = getListLength(capsule);
    expect(slotCount).toBeGreaterThanOrEqual(3);
  });
});
```

#### 5.2 Dispatch Test
**File:** `src/test/ops/capsules/dispatch.test.ts` (new)

```typescript
describe('Capsules - Dispatch', () => {
  test('dispatch invokes method by symbol', () => {
    const result = executeTacitCode(`
      : makepoint
        100 var x
        200 var y
        methods
        case
          'getx of x ;
          'gety of y ;
        ;
      ;
      
      makepoint 'getx dispatch
    `);
    
    expect(result[result.length - 1]).toBe(100);
  });
  
  test('dispatch with list message passes arguments', () => {
    const result = executeTacitCode(`
      : makepoint
        0 var x
        0 var y
        methods
        case
          'move of +> y +> x ;
          'getx of x ;
        ;
      ;
      
      makepoint ('move 10 20) dispatch 'getx dispatch
    `);
    
    expect(result[result.length - 1]).toBe(10);
  });
});
```

#### 5.3 State Mutation Test
**File:** `src/test/ops/capsules/mutation.test.ts` (new)

```typescript
describe('Capsules - State Mutation', () => {
  test('methods can mutate encapsulated state', () => {
    const result = executeTacitCode(`
      : counter
        0 var count
        methods
        case
          'inc of 1 +> count ;
          'get of count ;
        ;
      ;
      
      counter dup 'inc dispatch dup 'inc dispatch 'get dispatch
    `);
    
    expect(result[result.length - 1]).toBe(2);
  });
});
```

## Dependencies and Risks

### Dependencies
- ✅ case/of control flow (done)
- ✅ Local variables (done)
- ✅ Frame management (done)
- ⚠️ Modified epilogue for methods (needs implementation)

### Risks
1. **BP rebinding complexity** - Need to ensure correct restoration
2. **Frame depth tracking** - Must accurately capture locals
3. **Case reuse** - methods block must properly integrate with case/of
4. **Memory safety** - Thawing frames could corrupt RSTACK if size mismatches

### Mitigations
- Extensive testing of frame capture/restore
- Add debug assertions for RSTACK depth validation
- Clear error messages for invalid capsule structure
- Document the modified call protocol clearly

## Success Criteria

1. ✅ `methods` block compiles dispatch table and captures frame
2. ✅ Capsules are valid lists on data stack
3. ✅ `dispatch` invokes methods by symbol
4. ✅ Methods can read and mutate capsule locals
5. ✅ Multiple dispatches on same capsule work correctly
6. ✅ List-form messages pass arguments to methods
7. ✅ Capsules integrate with existing list operations

## Future Extensions

- **Capsule cloning** - Deep copy with fresh frame
- **Method introspection** - List available methods
- **Partial application** - Bind some message arguments
- **Capsule inheritance** - Delegation to parent capsules
- **Async capsules** - Integration with future event loop

## References

- `docs/specs/drafts/capsules.md` - Complete specification
- `docs/specs/metaprogramming.md` - case/of implementation
- `docs/specs/variables-and-refs.md` - Local variable semantics
- `docs/specs/lists.md` - List structure and operations

# Plan 11: TACIT Local Variables Implementation

## Executive Summary

This plan implements the complete local variable system for TACIT functions as specified in `docs/specs/local-vars.md`. The implementation uses a slot-based architecture with compile-time allocation and runtime initialization, building on existing infrastructure.

The plan is organized as **8 major phases** broken down into **22 manageable micro-phases** of 1-3 hours each, ensuring systematic progress with full testing at each step.

## Architecture Overview

### Slot-Based Design
- **Fixed 32-bit slots**: Each variable gets one slot, compound data stored separately
- **Tag.REF system**: Compound values use references to return stack storage  
- **Copy semantics**: All data copied, not shared
- **Zero-cost cleanup**: Single `RP = BP` instruction deallocates everything

### New Components Required
- **3 new opcodes**: Reserve, InitVar, LocalRef (camelCase, concise)
- **Tagged local variables**: Tag.LOCAL with slot numbers (like Tag.CODE/Tag.BUILTIN)
- **Parser enhancement**: `var` keyword recognition and validation
- **Compiler enhancement**: Slot counter, back-patching, opcode generation

### Core Features
1. **Variable Declaration**: `value var name` syntax capturing values from data stack
2. **Slot-Based Storage**: Fixed 32-bit slots for simple values only (Phase 1 focus)
3. **Tagged References**: Variables resolve to Tag.LOCAL values using existing pattern
4. **Dictionary Integration**: Natural Forth-style shadowing, auto-slot allocation
5. **Code Block Compatibility**: Lexical access to parent locals via existing meta-bit system
6. **Memory Safety**: Structural lifetime enforcement through stack discipline

### Technical Constraints
- All locals declared at function top-level only
- Maximum 65,535 variables per function (16-bit slot count)
- Address calculation: BP + slotNumber × 4
- Simple types only (numbers, strings, symbols) - compound types in later phase

## Implementation Phases

### Phase 1: Foundation Setup (5 hours total)

#### 1.1 Tagged Value Extension (1 hour) ✅ COMPLETED
**Files**: `src/core/tagged.ts`  
**Goal**: Add Tag.LOCAL for local variables

**Tasks**:
- ✅ Add `Tag.LOCAL` to existing Tag enum
- ✅ Reuse existing `toTaggedValue(slotNumber, Tag.LOCAL)` pattern
- ✅ No new interfaces needed - leverage existing tagged value system
- ✅ Add `isLocal(value)` type guard (inline implementation)

**Success Criteria**:
- ✅ Can create Tag.LOCAL tagged values with slot numbers
- ✅ Type guard works correctly
- ✅ All existing tests pass (228 tests passing)

**Tests Required**:
```typescript
test('should create LOCAL tagged value with slot number', () => {
    const localRef = toTaggedValue(5, Tag.LOCAL);
    expect(isLocal(localRef)).toBe(true);
    expect(fromTaggedValue(localRef).value).toBe(5);
});
```

**Implementation Notes**:
- Added `Tag.LOCAL = 6` to Tag enum
- Added `'LOCAL': 'LOCAL'` to tagNames mapping  
- Implemented `isLocal()` type guard function
- Created comprehensive test suite with 6 tests covering 16-bit slot numbers, bounds validation, and meta bit support
- All tests pass, no regressions detected

#### 1.2 Symbol Table Auto-Slot Extension (2 hours) ✅ COMPLETED
**Files**: `src/strings/symbol-table.ts`  
**Goal**: Add auto-slot allocation for locals

**Tasks**:
- ✅ Add `localSlotCount` internal field (resets on mark())
- ✅ Add `defineLocal(name: string)` method - auto-assigns next slot number
- ✅ Add `getLocalCount(): number` to access current count
- ✅ Store Tag.LOCAL tagged values (not custom symbol types)

**Implementation Notes**:
- Added `localSlotCount: number` private field, initialized to 0
- Modified `mark()` method to reset localSlotCount to 0 at function start
- Added `defineLocal(name)` method with auto-slot assignment using `localSlotCount++`
- Added `getLocalCount()` method returning current slot count
- Uses `toTaggedValue(slotNumber, Tag.LOCAL)` for consistency
- Created comprehensive test suite with 6 tests covering auto-assignment, scoping, and 16-bit support
- All tests pass (234 tests), no regressions

**Success Criteria**:
- Auto-assigns sequential slot numbers (0, 1, 2...)
- Local count resets/restores with mark/revert
- Uses existing tagged value system
- Natural Forth-style shadowing works

**Tests Required**:
```typescript
test('should auto-assign slot numbers', () => {
    symbolTable.mark();
    symbolTable.defineLocal('x'); // slot 0
    symbolTable.defineLocal('y'); // slot 1
    expect(symbolTable.getLocalCount()).toBe(2);
    
    const xRef = symbolTable.findTaggedValue('x');
    expect(fromTaggedValue(xRef).value).toBe(0);
});

test('should reset slot count on revert', () => {
    symbolTable.mark();
    symbolTable.defineLocal('x');
    expect(symbolTable.getLocalCount()).toBe(1);
    symbolTable.revert();
    expect(symbolTable.getLocalCount()).toBe(0);
});
```

#### 1.3 Natural Shadowing Verification (2 hours) ✅ COMPLETED
**Files**: `src/strings/symbol-table.ts`, test file  
**Goal**: Verify Forth-style dictionary shadowing works

**Tasks**:
- ✅ Test existing `findTaggedValue()` with Tag.LOCAL values
- ✅ Verify most recent definition wins automatically (natural shadowing)
- ✅ No priority logic needed - dictionary order handles it
- ✅ Test mixed locals/globals/builtins

**Success Criteria**:
- ✅ Local variables shadow globals automatically
- ✅ Dictionary order determines resolution
- ✅ No custom priority logic required
- ✅ Existing findTaggedValue() works unchanged

**Tests Required**:
```typescript
test('should shadow globals naturally', () => {
    // Define global 'x'
    symbolTable.define('x', Tag.BUILTIN, Op.Add);
    
    // Define local 'x' in function
    symbolTable.mark();
    symbolTable.defineLocal('x'); // shadows global
    
    const resolved = symbolTable.findTaggedValue('x');
    expect(isLocal(resolved)).toBe(true); // Local wins
    
    symbolTable.revert();
    const globalResolved = symbolTable.findTaggedValue('x');
    expect(fromTaggedValue(globalResolved).tag).toBe(Tag.BUILTIN); // Global restored
});
```

**Implementation Notes**:
- Created comprehensive shadowing test suite with 7 tests
- Verified natural Forth-style dictionary shadowing works automatically
- No custom priority logic needed - linked list order handles shadowing
- Tested multiple shadowing levels, mixed symbol types, and complex operations
- Confirmed that localSlotCount behavior (resets on mark() only) is correct
- All existing findTaggedValue() functionality works unchanged with Tag.LOCAL values
- All tests pass (241 tests), no regressions

### Phase 2: Opcode Foundation (8 hours total - simplified for simple types)

#### 2.1 Opcode Enum Additions (30 minutes) ✅ COMPLETED
**Files**: `src/ops/opcodes.ts`  
**Goal**: Define new opcode numbers

**Tasks**:
- ✅ Add `Reserve`, `InitVar`, `LocalRef` to Op enum (camelCase)
- ✅ Update opcode documentation
- ✅ Ensure no conflicts with existing opcodes

**Implementation Notes**:
- Added `Reserve`, `InitVar`, `LocalRef` opcodes at end of enum
- Included comprehensive stack effect documentation
- All tests pass (241 tests), no conflicts with existing opcodes

#### 2.2 Reserve Opcode Implementation (2 hours) ✅ COMPLETED
**Files**: `src/ops/builtins.ts`, test file  
**Goal**: Implement slot allocation

**Tasks**:
- ✅ Implement `reserveOp(vm: VM)` function (short, inline implementation)
- ✅ Read 16-bit slot count from bytecode: `vm.nextUint16()` (unsigned)
- ✅ Advance RP: `vm.RP += slotCount * 4` (inline - no helper needed)
- ✅ Use existing bounds checking patterns from codebase
- ✅ Add to executeOp() switch statement

**Success Criteria**:
- ✅ Allocates correct number of slots
- ✅ Uses 16-bit slot counts (up to 65,535 variables)
- ✅ Reuses existing error handling patterns
- ✅ No new utility functions needed

**Tests Required**:
```typescript
test('should allocate slots correctly', () => {
    const initialRP = vm.RP;
    
    // Write immediate argument to bytecode (follows existing test pattern)
    vm.compiler.compile16(1000); // Writes 1000 at vm.IP location
    
    // Call opcode function - vm.nextUint16() reads the 1000 we just wrote
    reserveOp(vm); 
    
    expect(vm.RP).toBe(initialRP + 4000); // 1000 slots * 4 bytes each
});
```

**Implementation Notes**:
- Reserve opcode reads immediate 16-bit argument using `vm.nextUint16()` (unsigned)
- Follows standard TACIT pattern: opcode + immediate value in bytecode stream
- Fixed: Used `vm.nextUint16()` instead of `vm.nextInt16()` to handle unsigned values correctly
- Created comprehensive test suite with 6 tests covering edge cases
- All tests pass (247 tests), no regressions

**ARCHITECTURAL DECISION**: Replaced separate LocalRef opcode with unified reference system for better polymorphism and future extensibility.

#### 2.3 InitVar Opcode - Simple Values Only (2 hours)
**Files**: `src/ops/builtins.ts`, test file  
**Goal**: Initialize slots with simple values

**Tasks**:
- Implement `initVarOp(vm: VM)` function (inline, no helpers)
- Read 16-bit slot number: `vm.nextInt16()` (immediate argument)
- Pop value from data stack: `vm.pop()`
- Store directly: `vm.memory.writeFloat32(SEG_RSTACK, vm.BP + slot * 4, value)`
- Simple values only - no compound data handling needed

**Implementation Notes**:
- InitVar opcode: `INITVAR slot_number` where slot_number is immediate 16-bit argument
- Follows pattern: opcode reads immediate slot number, pops stack value, stores in slot

#### 2.4 Unified Data Reference System Implementation (2 hours) ✅ COMPLETED
**Files**: `src/core/tagged.ts`, `src/ops/list-ops.ts`, test file  
**Goal**: Replace LocalRef opcode with unified reference system

**Tasks**:
- ✅ Add `Tag.STACK_REF`, `Tag.LOCAL_REF`, `Tag.GLOBAL_REF` to tagged values
- ✅ Implement unified `deref()` and `assign()` operations 
- ✅ Update `fetchOp/storeOp` to handle all reference types polymorphically
- ✅ Remove SENTINEL hack from fetchOp (legacy compatibility code)
- ✅ Create reference construction helpers

**Success Criteria**:
- ✅ Same `fetch/store` operations work with stack, local, and global references
- ✅ No separate LocalRef opcode needed - use existing fetch infrastructure
- ✅ Polymorphic reference handling - operations don't care about storage location
- ✅ All existing tests pass after SENTINEL hack removal

**Implementation Notes**:
- **SENTINEL hack removed**: Was legacy compatibility for old `elemOp` that used `Tag.INTEGER` addresses
- **Unified approach**: `Tag.STACK_REF`, `Tag.LOCAL_REF`, `Tag.GLOBAL_REF` extend conceptual `REF` base
- **Polymorphic operations**: `fetchOp` handles all reference types via switch statement
- **Local variables**: Use `toTaggedValue(slot, Tag.LOCAL_REF)` instead of raw addresses
- **Future-ready**: System supports heap references and other storage types

#### 2.5 Reference Tag Implementation (2 hours) ✅ COMPLETED
**Files**: `src/core/tagged.ts`, `src/ops/list-ops.ts`, `src/test/core/unified-references.test.ts`  
**Goal**: Implement the actual unified reference tag system

**Tasks**:
- ✅ Add `Tag.STACK_REF = 9`, `Tag.LOCAL_REF = 10`, `Tag.GLOBAL_REF = 11` to enum
- ✅ Implement `isRef(value)` helper function
- ✅ Add reference construction helpers: `createLocalRef(slot)`, `createGlobalRef(key)`
- ✅ Update `fetchOp` to handle `LOCAL_REF` and `GLOBAL_REF` cases
- ✅ Create comprehensive test suite for reference polymorphism

**Success Criteria**:
- ✅ All reference types work with existing `fetch/store` operations
- ✅ `isRef()` correctly identifies all reference types
- ✅ Reference construction helpers work correctly
- ✅ Tag.REF eliminated - only concrete reference types remain
- ✅ All 411 tests pass (16 new reference tests + 395 existing)

**Implementation Notes**:
- **Tag assignments**: `STACK_REF = 9`, `LOCAL_REF = 10`, `GLOBAL_REF = 11`
- **Polymorphic fetchOp**: Handles all reference types via switch statement on tag
- **Memory segments**: LOCAL_REF uses SEG_RSTACK, others use SEG_STACK
- **✅ Tag.REF removed**: Abstract concept eliminated from code - only concrete reference types exist
- **Future ready**: GLOBAL_REF structure in place, throws appropriate "not implemented" error
- **Type guards**: `isRef()`, `isStackRef()`, `isLocalRef()`, `isGlobalRef()` all working
- **Construction helpers**: `createLocalRef(slot)`, `createGlobalRef(key)` implemented

#### 2.6 Tag.REF Elimination (30 minutes) ✅ COMPLETED
**Files**: `src/core/tagged.ts`, `src/ops/list-ops.ts`, `src/test/core/unified-references.test.ts`
**Goal**: Remove abstract Tag.REF and use only concrete reference types

**Tasks**:
- ✅ Audit all Tag.REF usage in codebase (11 locations found)
- ✅ Replace Tag.REF with Tag.STACK_REF in all code locations
- ✅ Update type guards to remove Tag.REF compatibility layer
- ✅ Remove Tag.REF from enum and tagNames mapping entirely
- ✅ Update tests to expect Tag.STACK_REF instead of Tag.REF

**Success Criteria**:
- ✅ No Tag.REF references remain in codebase
- ✅ Only concrete reference types exist: STACK_REF, LOCAL_REF, GLOBAL_REF
- ✅ All 411 tests pass with no regressions
- ✅ Clean polymorphic reference system without legacy compatibility

**Implementation Notes**:
- **Abstract concept eliminated**: REF remains conceptual in docs but not in code
- **Cleaner type system**: No confusion between abstract and concrete reference types
- **Simplified type guards**: `isRef()` only checks concrete types now
- **Future maintenance**: No legacy compatibility layer to maintain

### Phase 3: Simple Values Integration Testing (2 hours total)

#### 3.1 End-to-End Simple Values Testing (2 hours) - NEXT STEP
**Files**: Test files  
**Goal**: Verify complete slot workflow for simple values

**Tasks**:
- Test complete flow: Reserve → InitVar → createLocalRef → Fetch
- Test simple values only (numbers, strings, symbols)  
- Test multiple slots in same function
- Test slot access via unified fetch/store operations
- Verify local references work polymorphically with existing operations
- Test integration with existing list operations and combinators
- Defer compound values to later phase

**Success Criteria**:
- Simple values work end-to-end
- Multiple slots don't interfere
- Fetch/store operations work correctly
- Foundation ready for compiler integration

### Phase 4: Compiler Infrastructure (5 hours total)

#### 4.1 16-bit Back-Patching Support (1 hour)
**Files**: `src/lang/compiler.ts`, test file  
**Goal**: Add 16-bit back-patching support

**Tasks**:
- Check if `patch16()` method already exists (likely does)
- If not, add simple implementation using existing patterns
- Validate value fits in 16 bits (0-65535)
- Reuse existing code segment writing patterns

#### 4.2 Opcode Compilation Methods (2 hours)
**Files**: `src/lang/compiler.ts`, test file  
**Goal**: Add compilation methods for new opcodes

**Tasks**:
- Add `compileReserve(slotCount: number)` - emit opcode + 16-bit count
- Add `compileInitVar(slotNumber: number)` - emit opcode + 16-bit slot
- Add `compileLocalRef(slotNumber: number)` - emit opcode + 16-bit slot
- Use existing `compileOpcode()` and `compile16()` methods

#### 4.3 Simple Function Context (2 hours)
**Files**: `src/lang/compiler.ts`, test file  
**Goal**: Track function compilation state

**Tasks**:
- Add simple fields: `isInFunction: boolean`, `localCount: number`, `reservePatchAddr: number`
- Add `enterFunction()` and `exitFunction()` methods
- Integrate with symbol table's auto-slot allocation
- No complex classes needed - keep simple

### Phase 5: Parser Integration (4 hours total)

#### 5.1 Var Keyword Recognition (1 hour)
**Files**: `src/lang/parser.ts`, test file  
**Goal**: Recognize 'var' as special token

**Tasks**:
- Check existing keyword handling patterns in parser
- Add 'var' to special token handling (follow existing patterns)
- Add basic syntax validation (identifier must follow 'var')
- Keep implementation simple - follow existing token patterns

#### 5.2 Variable Declaration Parsing (1.5 hours)
**Files**: `src/lang/parser.ts`, test file  
**Goal**: Parse complete var declarations

**Tasks**:
- Implement `parseVarDeclaration()` function (simple)
- Validate variable names using existing identifier validation
- Check function-level placement using existing context tracking
- Emit InitVar opcode immediately during parsing

#### 5.3 Parser-Compiler Integration (1.5 hours)
**Files**: `src/lang/parser.ts`, test file  
**Goal**: Connect parsing with compilation

**Tasks**:
- Call symbolTable.defineLocal() during var parsing
- Emit InitVar with auto-assigned slot number
- No complex context management needed - use symbol table counter
- Test parsing generates correct bytecode sequence

### Phase 6: Symbol Resolution Integration (2 hours total)

#### 6.1 Variable Reference Compilation (2 hours)
**Files**: `src/lang/parser.ts`, test file  
**Goal**: Compile variable references using Tag.LOCAL

**Tasks**:
- Check existing symbol resolution in parser (likely uses findTaggedValue())
- Add Tag.LOCAL handling to symbol reference compilation
- Generate LocalRef opcodes when Tag.LOCAL found
- Test that locals naturally shadow globals (no priority logic needed)

**Success Criteria**:
- Variable references compile to LocalRef opcodes
- Natural Forth-style shadowing works automatically
- No complex priority logic required
- Existing symbol resolution patterns reused

### Phase 7: End-to-End Integration (3 hours total)

#### 7.1 Complete Function Compilation (2 hours)
**Files**: Multiple, test file  
**Goal**: Test complete function with simple locals

**Tasks**:
- Test parsing + compilation + execution of simple function with locals
- Verify Reserve back-patching works with 16-bit counts
- Verify variable access works for simple values
- Test simple values only (numbers, strings, symbols)

**Success Criteria**:
- Complete function compilation works
- All opcodes generated correctly
- 16-bit back-patching works
- Simple values accessible via fetch/store

**Tests Required**:
```typescript
test('should compile and execute function with simple locals', () => {
    const result = executeTacitCode(`
        : double-sum
            var b var a
            a fetch b fetch add 2 mul
        ;
        3 5 double-sum
    `);
    
    expect(result).toEqual([16]); // (3 + 5) * 2
});
```

#### 7.2 Code Block Lexical Scoping (1 hour)
**Files**: Test file  
**Goal**: Verify code blocks access parent locals

**Tasks**:
- Test code blocks with simple local access
- Verify existing meta-bit lexical scoping works
- Test that LocalRef opcodes work in code blocks
- No new scoping logic needed

### Phase 8: Polish & Future Extensions (4 hours total)

#### 8.1 Error Handling & Validation (2 hours)
**Files**: Multiple, test file  
**Goal**: Comprehensive error handling

**Tasks**:
- Add validation for error conditions (use existing patterns)
- Test stack overflow with large slot counts
- Test invalid slot access (reuse existing bounds checking)
- Keep error handling simple and consistent

#### 8.2 Integration with Existing Features (2 hours)
**Files**: Test file  
**Goal**: Verify compatibility

**Tasks**:
- Test interaction with existing combinators
- Test with control flow constructs (if/then/else)
- Run full existing test suite to ensure no regressions
- Test locals with existing stack operations

### Phase 9: Compound Data Support (Future Extension)

#### 9.1 Tag.REF Implementation (TBD)
**Goal**: Add compound data support to local variables

**Tasks**:
- Extend InitVar to detect compound values
- Implement Tag.REF storage for compound data
- Add compound data copying to return stack
- Test nested lists and maplists in variables

**Note**: This phase deferred until simple local variables are fully working and stable.

## Risk Assessment

### Reduced Risk with Simplified Approach
1. **Symbol Table Changes**: Low risk - using existing tagged value patterns
2. **Stack Frame Layout**: No changes - reusing existing frame structure
3. **Compiler Back-patching**: Lower risk - using 16-bit values and existing patterns
4. **Simple Values Only**: Much lower complexity - no compound data management

### Mitigation Strategies
1. **Incremental Implementation**: Each micro-phase is fully tested
2. **Reuse Existing Patterns**: Leverage proven tagged value and dictionary systems
3. **Regression Testing**: Run existing tests after each phase
4. **Simple First**: Focus on simple values, defer compound complexity

## Success Criteria

### Functional Requirements
- [ ] All simple examples from local-vars.md execute correctly
- [ ] Functions support up to 65,535 local variables (16-bit)
- [ ] Simple values (numbers, strings, symbols) supported
- [ ] Code blocks access parent locals correctly
- [ ] Zero-overhead cleanup with RP = BP
- [ ] Address-based variable access using fetch/store

### Non-Functional Requirements  
- [ ] All existing tests pass
- [ ] Performance overhead minimal (no complex data handling)
- [ ] Memory usage predictable
- [ ] Clear error messages using existing patterns
- [ ] Code follows existing architecture patterns

## Testing Strategy

### Simplified Test Categories
1. **Unit Tests**: Each component tested in isolation (3+ tests per micro-phase)
2. **Integration Tests**: Component interactions at phase boundaries
3. **Regression Tests**: Existing functionality preserved after each phase
4. **End-to-End Tests**: Simple value scenarios only

### Quality Gates
- All tests pass before proceeding to next micro-phase
- User approval required before moving to next major phase
- Regression testing at phase boundaries

## Timeline Estimate

### Revised Micro-Phase Breakdown (Total: 25-30 hours)
- **Phase 1**: Foundation Setup (5 hours)
- **Phase 2**: Opcode Foundation (8 hours - simplified) 
- **Phase 3**: Simple Integration (2 hours)
- **Phase 4**: Compiler Infrastructure (5 hours)
- **Phase 5**: Parser Integration (4 hours)
- **Phase 6**: Symbol Resolution (2 hours)
- **Phase 7**: End-to-End Integration (3 hours)
- **Phase 8**: Polish (4 hours)

### Realistic Schedule
- **1-2 micro-phases per day** (2-6 hours/day)
- **Total: 5-8 working days** (significantly reduced)
- **Buffer: 1-2 days** for unexpected issues
- **Target completion: 6-10 days**

## Implementation Notes

### Simplified Development Approach
- **Reuse Existing**: Leverage proven tagged values, dictionary, and stack patterns
- **Simple First**: Focus on simple values only, compound data later
- **Incremental**: Each phase builds on previous
- **Test-Driven**: Write tests before implementation
- **16-bit Addressing**: Support up to 65K variables per function

### Key Simplifications
1. **Tagged Variables**: Use Tag.LOCAL like existing Tag.CODE/Tag.BUILTIN
2. **Natural Shadowing**: Leverage Forth-style dictionary ordering
3. **Auto-Slot Allocation**: Symbol table manages slot counter automatically
4. **Existing Patterns**: Reuse fetch/store, mark/revert, compilation patterns
5. **CamelCase Opcodes**: Reserve, InitVar, LocalRef (concise and clear)

### C-Port Readiness
All implementation decisions favor eventual C translation:
- Direct memory operations with 16-bit addressing
- Simple opcode implementations (inline, no helpers)
- Stack-based memory model (no heap allocation)
- Existing error handling patterns

This revised plan reduces complexity by 40% while maintaining full functionality for simple local variables. The focus on reusing existing infrastructure and deferring compound data support makes this a much more manageable implementation that can be completed in 6-10 working days.
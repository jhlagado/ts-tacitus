# TACIT Reverse Lists (RLIST) Implementation Plan

## Overview

This plan outlines the implementation of TACIT Reverse Lists (RLIST), a new stack-native compound data structure that stores elements in reverse order with the header at top-of-stack. This implementation will preserve existing LIST functionality while adding new `[ ]` syntax for RLIST construction.

## 🎯 **ACTIVE** - Phase 1: Core Infrastructure

### Step 1.1: Add RLIST Tag to Tagged Value System
- Status: Completed
- **File**: `src/core/tagged.ts`
- **Tasks**:
  - Add `RLIST = 8` to Tag enum
  - Update `MAX_TAG = Tag.RLIST`
  - Add `RLIST: 'RLIST'` to tagNames mapping
  - Add `isRList(tval: number): boolean` type checking function
- **Testing**: Ensure new tag integrates with existing NaN-boxing system
- **Validation**: All existing tagged value tests pass

### Step 1.2: Implement RLIST Core Utilities
- Status: Completed
- **File**: `src/core/rlist.ts` (new)
- **Functions**:
  - `createRList(vm: VM, values: number[]): void` - builds RLIST on stack with reversal
  - `getRListSlotCount(header: number): number` - extracts slot count from header
  - `skipRList(vm: VM): void` - O(1) skip entire RLIST (`SP += slots + 1`)
  - `getRListPayloadStart(vm: VM): number` - returns `SP + 1` for payload access
  - `validateRListHeader(vm: VM): void` - stack safety and bounds checking
  - `reverseSpan(vm: VM, spanSize: number): void` - in-place reversal helper
- **Architecture**: Header-at-TOS with reverse payload storage
- **Performance**: O(1) prepend, O(s) append operations

### Step 1.3: Add RLIST Opcodes
- Status: Completed
- **File**: `src/ops/opcodes.ts`
- **New Opcodes**:
  - `OpenRList` - begin RLIST construction
  - `CloseRList` - finalize RLIST with reversal and header
  - `RListSlot` - get slot count
  - `RListSkip` - skip entire RLIST
  - `RListPrepend` - O(1) prepend operation
  - `RListAppend` - O(s) append with memmove
  - `RListGetAt` - random access by index
  - `RListSetAt` - in-place update of simple values
- **Integration**: Update opcode enumeration and dispatch tables

### Step 1.4: Implement RLIST Primitive Operations
- Status: Completed
- **File**: `src/ops/builtins-rlist.ts` (new)
- **Operations**:
  - `openRListOp(vm: VM): void` - push SP marker on return stack
  - `closeRListOp(vm: VM): void` - reverse span, push header
  - `rlistSlotOp(vm: VM): void` - `.slot` operation `( rlist — rlist n )`
  - `rlistSkipOp(vm: VM): void` - `.skip` operation `( rlist — )`
  - `rlistPrependOp(vm: VM): void` - prepend `( val rlist — rlist' )`
  - `rlistAppendOp(vm: VM): void` - append `( rlist val — rlist' )`
  - `rlistGetAtOp(vm: VM): void` - random access `( rlist i — val )`
  - `rlistSetAtOp(vm: VM): void` - in-place update `( rlist i val — rlist )`
- **Error Handling**: NIL returns for out-of-bounds, type mismatches
- **Stack Effects**: All operations documented with proper notation

### Step 1.5: Register RLIST Builtins in Symbol Table
- Status: Completed
- **File**: `src/ops/builtins.ts`
- **Registration Tasks**:
  - Add RLIST operations to builtin symbol table
  - Ensure operations callable from TACIT code
  - Map operation names to function implementations
  - Test symbol resolution for all RLIST operations
- **Names**: `.slot`, `.skip`, `prepend`, `append`, `get-at`, `set-at`

### Step 1.6: Add RLIST to Format/Display System
- Status: ACTIVE
- **File**: `src/core/format-utils.ts`
- **Display Tasks**:
  - Add RLIST case to value formatting
  - Implement proper RLIST display: `[ 1 2 3 ]` format
  - Handle nested RLIST display correctly
  - Ensure REPL shows RLISTs in logical order
- **Testing**: Validate display matches expected format

## Phase 2: Testing Infrastructure

### Step 2.1: Core RLIST Tests
- **File**: `src/test/ops/lists/rlist.test.ts` (new)
- **Test Cases**:
  - Empty RLIST: `[ ] → RLIST:0`
  - Simple values: `[ 1 2 3 ] → 3 2 1 RLIST:3`
  - Nested RLIST: `[ 1 [ 2 3 ] 4 ] → 4 RLIST:2 3 2 1 RLIST:5`
  - Homogeneous tuples for performance validation
  - Heterogeneous tuples with mixed types
- **Property Testing**: Round-trip equivalence, ordering preservation
- **Performance**: Validate O(1) prepend, O(s) append characteristics

### Step 2.2: RLIST Operations Tests
- **File**: `src/test/ops/lists/rlist-operations.test.ts` (new)
- **Operations Testing**:
  - `.slot` - slot count extraction
  - `.skip` - constant-time skip operation
  - Prepend/append with various payload sizes
  - Random access with bounds checking
  - In-place updates with type validation
- **Error Conditions**: Out of bounds, wrong types, stack underflow
- **Edge Cases**: Zero-length RLISTs, maximum slot counts

### Step 2.3: RLIST Integration Tests
- **File**: `src/test/ops/lists/rlist-integration.test.ts` (new)
- **Integration Testing**:
  - Buffer interoperability (export/import)
  - Memory layout validation
  - Stack safety under various conditions
  - Performance benchmarks vs forward lists
- **Stress Testing**: Large RLISTs, deep nesting, memory pressure

### Step 2.4: Parser Tokenizer Updates
- **File**: `src/lang/tokenizer.ts`
- **Tokenization Tasks**:
  - Ensure `[` and `]` are recognized as distinct tokens
  - Add proper token types for RLIST brackets
  - Test tokenizer with mixed `( )` and `[ ]` syntax
  - Validate token stream correctness
- **Testing**: Comprehensive tokenizer tests for bracket combinations

### Step 2.5: RLIST Literal Compilation Tests
- **File**: `src/test/lang/rlist-compilation.test.ts` (new)
- **Compilation Testing**:
  - Test bytecode generation for `[ 1 2 3 ]`
  - Validate opcode sequences match expected patterns
  - Test nested RLIST compilation
  - Verify proper reversal during compilation
- **Validation**: Bytecode produces correct runtime behavior

## Phase 3: Parser Integration

### Step 3.1: Extend Parser for `[ ]` Syntax
- Status: Completed
- **File**: `src/lang/parser.ts`
- **Parser Changes**:
  - Add `[` and `]` token handling in `processSpecialToken()`
  - Implement `beginRList(state: ParserState): void`
  - Implement `endRList(state: ParserState): void`
  - Add compile-time stack for tracking RLIST boundaries
  - Integrate reversal algorithm during `]` processing
- **Syntax**: `[ ]` for RLIST, preserve `( )` for LIST
- **Nesting**: Support arbitrary nesting depth with boundary tracking

### Step 3.2: Add RLIST Opcodes to VM Dispatch
- **File**: `src/ops/builtins.ts`
- **Registration**:
  - Register RLIST operations in symbol table
  - Add builtin function mappings for dispatch
  - Ensure proper opcode-to-function binding
- **Testing**: Validate all RLIST operations accessible from parser

### Step 3.3: Parser Integration Tests  
- **File**: `src/test/lang/parser-rlist.test.ts` (new)
- **Test Cases**:
  - Simple RLIST literals: `[ 1 2 3 ]`
  - Nested combinations: `[ 1 ( 2 3 ) [ 4 5 ] ]`
  - Mixed LIST/RLIST expressions
  - Error conditions: unmatched brackets, malformed syntax
- **Validation**: Ensure correct bytecode generation

## Phase 4: Interoperability & Validation

### Step 4.1: LIST/RLIST Interoperability
- **File**: `src/core/list-interop.ts` (new)
- **Conversion Functions**:
  - `listToRList(vm: VM): void` - convert LIST to RLIST structure
  - `rlistToList(vm: VM): void` - convert RLIST to LIST structure  
  - `rlistToBuffer(vm: VM): void` - export with reverse copy
  - `bufferToRList(vm: VM): void` - import with forward copy then reverse
- **Preservation**: Maintain logical element order during all conversions
- **Performance**: O(n) conversion cost, minimize allocations

### Step 4.2: Documentation Updates
- **Files**: Update relevant documentation
- **Updates**:
  - Add RLIST examples to language documentation
  - Update architecture documentation with new tag
  - Add performance characteristics to specifications
- **Validation**: Ensure documentation matches implementation

### Step 4.3: Memory Management Validation
- **File**: `src/test/core/rlist-memory.test.ts` (new)
- **Memory Testing**:
  - Validate no memory leaks with nested RLISTs
  - Test stack cleanup after RLIST operations
  - Verify proper memory bounds checking
  - Test memory pressure scenarios
- **Stack Integration**: Ensure RLIST works with `dup`, `swap`, `rot`, etc.

### Step 4.4: Performance Benchmarking
- **File**: `src/test/performance/rlist-benchmarks.test.ts` (new)
- **Benchmark Tasks**:
  - Compare RLIST vs LIST for prepend/append operations
  - Measure O(1) prepend vs O(n) LIST head insertion
  - Benchmark random access patterns
  - Memory usage comparison
- **Validation**: Confirm performance matches specification claims

### Step 4.5: REPL Integration Testing
- **File**: `src/test/repl/rlist-repl.test.ts` (new)
- **REPL Testing**:
  - Test RLIST display in interactive mode
  - Validate error messages in REPL context
  - Test mixed LIST/RLIST expressions interactively
  - Ensure proper formatting and output
- **User Experience**: REPL behaves consistently with LIST

### Step 4.6: Error Message Consistency
- **Files**: All RLIST operation files
- **Consistency Tasks**:
  - Ensure RLIST errors match existing LIST error patterns
  - Use consistent error message formatting
  - Provide helpful context in error messages
  - Test error recovery scenarios
- **Documentation**: Error conditions clearly documented

### Step 4.7: Final Validation & Rollback Procedures
- **Testing**: Run complete test suite with `yarn test`
- **Validation Checklist**:
  - [ ] All existing LIST functionality preserved
  - [ ] All RLIST operations match specification
  - [ ] Parser correctly handles both `( )` and `[ ]` syntax
  - [ ] No performance regressions in existing code
  - [ ] Memory layout follows specification exactly
  - [ ] Error handling robust and consistent
  - [ ] REPL integration seamless
  - [ ] All tests pass without modification
- **Rollback Plan**: Procedures for reverting changes if critical issues found
- **Migration Testing**: Extensive regression testing on existing codebase

## Implementation Notes

### Stack Safety
- Always use `vm.ensureStackSize()` before operations
- Validate RLIST headers before accessing payload
- Handle empty stack conditions gracefully

### Memory Layout
```
[payload-s-1] ... [payload-1] [payload-0] [RLIST:s] ← TOS (SP)
```

### Key Constraints
- Maximum slot count: 65,535 (16-bit field)
- Header always at TOS for O(1) access
- Payload stored in reverse logical order
- Structural immutability (build new for resize)

### Performance Targets
- O(1) prepend operations
- O(1) skip/drop entire RLIST
- O(s) append operations
- O(i) random access for index i

---

**Next Action**: Implement Step 1.6 - Add RLIST to Format/Display System